'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const {buildCompactContext}=require('./lib/context');

const MAX_BODY = 8 * 1024 * 1024;
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.svg':'image/svg+xml'};
const SAFE_PROVIDERS = new Set(['openai-compatible','openai','openrouter','ollama']);

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store','x-content-type-options':'nosniff'});
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve,reject)=>{
    let size=0, chunks=[];
    req.on('data', chunk=>{ size+=chunk.length; if(size>MAX_BODY){ reject(Object.assign(new Error('Request too large'),{status:413})); req.destroy(); return; } chunks.push(chunk); });
    req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch{reject(Object.assign(new Error('Invalid JSON'),{status:400}))}});
    req.on('error',reject);
  });
}
function loadCharacters(file){try{const arr=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(arr)?arr:[]}catch{return []}}
const SETTINGS_KEYS=new Set(['globalPrompt','tokenBudget','replyBudget','worldSettings','providerSettings','modelCache','userProfiles','activeProfileId','favorites','activeLocale','customLocales','dynamicCustomHosts']);
function loadSettings(file){try{const o=JSON.parse(fs.readFileSync(file,'utf8'));return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}}
// Sanitize a single custom host string: must be a valid HTTPS hostname, no path, no port tricks.
function sanitizeCustomHost(raw){
  const s=String(raw||'').trim().toLowerCase().slice(0,300);
  if(!s)return null;
  try{
    const u=new URL(s.includes('://')?s:`https://${s}`);
    if(u.protocol!=='https:')return null;
    // Reject IP addresses and localhost (those are fine for Ollama but not for custom HTTPS endpoints)
    if(/^(\d{1,3}\.){3}\d{1,3}$/.test(u.hostname)||u.hostname==='localhost')return null;
    // Must have at least one dot (real domain)
    if(!u.hostname.includes('.'))return null;
    // Hostname-only, no path beyond what the user intended
    return u.hostname;
  }catch{return null}
}
function sanitizeSetting(key,value){
  if(key==='tokenBudget')return Math.max(400,Math.min(8000,Math.round(Number(value))||1200));
  if(key==='replyBudget')return Math.max(64,Math.min(1200,Math.round(Number(value))||300));
  if(key==='globalPrompt')return String(value||'').slice(0,8000);
  if(key==='activeProfileId')return String(value||'').slice(0,100);
  if(key==='activeLocale')return /^[a-zA-Z0-9_-]{2,20}$/.test(String(value||''))?String(value).slice(0,20):'th';
  if(key==='customLocales'){
    if(!value||typeof value!=='object'||Array.isArray(value))return {};
    const out={};
    for(const [code,loc] of Object.entries(value).slice(0,30)){
      const cleanCode=String(code).trim().toLowerCase().slice(0,10);
      if(!/^[a-z0-9_-]{2,10}$/.test(cleanCode)||!loc||typeof loc!=='object')continue;
      const name=String(loc.name||cleanCode).slice(0,50);
      const dict={};
      if(loc.dict&&typeof loc.dict==='object'&&!Array.isArray(loc.dict)){
        for(const [k,v] of Object.entries(loc.dict).slice(0,300)){
          dict[String(k).slice(0,80)]=String(v||'').slice(0,1000);
        }
      }
      out[cleanCode]={name,dict};
    }
    return out;
  }
  if(key==='favorites'){
    if(!Array.isArray(value))return [];
    return value.slice(0,500).map(x=>String(x||'').slice(0,100)).filter(Boolean);
  }
  if(key==='userProfiles'){
    if(!Array.isArray(value))return [];
    return value.slice(0,20).map(p=>{
      if(!p||typeof p!=='object')return null;
      return {
        id:String(p.id||'').slice(0,100),
        name:String(p.name||'').slice(0,100),
        role:String(p.role||'').slice(0,100),
        appearance:String(p.appearance||'').slice(0,2000),
        bio:String(p.bio||'').slice(0,2000),
        avatarUrl:String(p.avatarUrl||'').slice(0,500),
        coverUrl:String(p.coverUrl||'').slice(0,500)
      };
    }).filter(Boolean);
  }
  if(key==='providerSettings'){const v=value&&typeof value==='object'?value:{};return {provider:String(v.provider||'').slice(0,40),baseUrl:String(v.baseUrl||'').slice(0,300),model:String(v.model||'').slice(0,150),customBaseUrl:String(v.customBaseUrl||'').slice(0,300)}}
  if(key==='modelCache'){const v=value&&typeof value==='object'?value:{};const out={};for(const [p,list] of Object.entries(v).slice(0,10)){if(Array.isArray(list))out[String(p).slice(0,40)]=list.filter(x=>typeof x==='string').slice(0,300).map(x=>x.slice(0,150))}return out}
  if(key==='worldSettings'){const v=value&&typeof value==='object'?value:{};return {name:String(v.name||'').slice(0,200),description:String(v.description||'').slice(0,4000),rules:String(v.rules||'').slice(0,4000)}}
  if(key==='dynamicCustomHosts'){
    if(!Array.isArray(value))return [];
    const seen=new Set();
    return value.slice(0,30).map(sanitizeCustomHost).filter(h=>h&&!seen.has(h)&&seen.add(h));
  }
  return value;
}
// Cut a reply back to its last complete sentence so an answer never ends mid-sentence.
function trimToCompleteSentence(text){
  const t=String(text||'').replace(/\s+$/,'');
  const m=t.match(/^[\s\S]*[.!?…。！？」”)\]\*]/);
  return m&&m[0].length>=Math.floor(t.length*0.4)?m[0]:t;
}
function safeWriteJson(file,data){
  const tmp=`${file}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n','utf8');
  fs.renameSync(tmp,file);
}
function listPrivateIPv4(){
  const found=[];
  for(const entries of Object.values(os.networkInterfaces()))for(const item of entries||[]){
    if(item.family==='IPv4'&&!item.internal&&isPrivateLanAddress(item.address))found.push(item.address);
  }
  return [...new Set(found)];
}
function isPrivateLanAddress(address){
  let ip=String(address||'').replace(/^::ffff:/i,'').split('%')[0].toLowerCase();
  if(ip==='localhost'||ip==='127.0.0.1'||ip==='::1')return true;
  if(ip.includes(':'))return ip==='::1'||ip.startsWith('fc')||ip.startsWith('fd')||/^fe[89ab]/.test(ip);
  const parts=ip.split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return false;
  const [a,b]=parts;return a===10||a===127||a===192&&b===168||a===172&&b>=16&&b<=31||a===169&&b===254||a===0;
}
function remoteAddressAllowed(remoteAddress, lanOnly){return !lanOnly||isPrivateLanAddress(remoteAddress)}

function isAllowedCustomProviderUrl(value,allowlist){
  let base;try{base=value instanceof URL?value:new URL(String(value||''))}catch{return false}
  if(base.protocol!=='https:')return false;
  const allowed=new Set((allowlist||[]).flatMap(entry=>{const raw=String(entry||'').trim().toLowerCase();if(!raw)return[];try{return[new URL(raw.includes('://')?raw:`https://${raw}`).hostname.toLowerCase()]}catch{return[raw.split('/')[0].split(':')[0]]}}));
  return allowed.has(base.hostname.toLowerCase());
}

function loadDotEnv(file=path.join(__dirname,'.env')){try{const lines=fs.readFileSync(file,'utf8').split(/\r?\n/);for(const line of lines){const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);if(!m||Object.hasOwn(process.env,m[1]))continue;let value=m[2];if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);process.env[m[1]]=value}}catch{}}
function createServer(options={}) {
  const root=options.root||path.resolve(__dirname);
  const dataDir=options.dataDir||path.join(root,'data');
  const uploadsDir=path.join(dataDir,'uploads');
  const charactersFile=path.join(dataDir,'characters.json');
  const settingsFile=path.join(dataDir,'settings.json');
  const chatsFile=path.join(dataDir,'chats.json');
  const sessionsDir=path.join(dataDir,'sessions');
  const apiKey=options.apiKey!==undefined?options.apiKey:process.env.AI_API_KEY||'';
  const lanOnly=options.lanOnly??process.env.LAN_ONLY==='true';
  const customHostEntries=String(options.customEndpointHosts??process.env.CUSTOM_ENDPOINT_HOSTS??'').split(',').map(x=>x.trim()).filter(Boolean);
  const customHosts=new Set(customHostEntries.flatMap(entry=>{const raw=entry.toLowerCase();try{return[new URL(raw.includes('://')?raw:`https://${raw}`).hostname.toLowerCase()]}catch{return[]}}));
  const runtimeMode=options.runtimeMode||process.env.RUNTIME_MODE||'local';
  const explicitClientKeys = options.allowClientKeys !== undefined
    ? options.allowClientKeys
    : (process.env.ALLOW_CLIENT_API_KEYS !== undefined ? process.env.ALLOW_CLIENT_API_KEYS === 'true' : undefined);
  const requestedClientKeys = explicitClientKeys !== undefined ? explicitClientKeys : (lanOnly || runtimeMode === 'lan');
  const allowClientKeys=!!requestedClientKeys&&runtimeMode!=='vps';
  const clientKeyHosts=new Set(String(options.clientKeyHosts??process.env.CLIENT_KEY_HOSTS??'api.openai.com,openrouter.ai').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
  const httpFetch=options.fetch||globalThis.fetch;
  const providerAdapters=options.providerAdapters||{};
  fs.mkdirSync(uploadsDir,{recursive:true});
  fs.mkdirSync(sessionsDir,{recursive:true});
  if(!fs.existsSync(charactersFile))fs.writeFileSync(charactersFile,'[]\n','utf8');
  function getChatsTargetFile(req){
    if(runtimeMode==='vps'){
      const rawSid=String(req.headers['x-session-id']||'').trim();
      const sid=/^[a-zA-Z0-9_-]{8,64}$/.test(rawSid)?rawSid:'anonymous';
      return path.join(sessionsDir,`chats_${sid}.json`);
    }
    return chatsFile;
  }
  function loadChats(file){try{const o=JSON.parse(fs.readFileSync(file,'utf8'));return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}}
  const rateLimitRPM=Number(options.rateLimitRpm||process.env.RATE_LIMIT_RPM||60);
  const rateLimits=new Map();
  function checkRateLimit(ip){
    if(options.rateLimit===false)return true;
    const now=Date.now();
    const item=rateLimits.get(ip)||[0,now+60000];
    if(now>item[1]){item[0]=0;item[1]=now+60000;}
    item[0]++;
    rateLimits.set(ip,item);
    if(rateLimits.size>2000){for(const [k,v] of rateLimits)if(now>v[1])rateLimits.delete(k);}
    return item[0]<=rateLimitRPM;
  }
  const server=http.createServer(async(req,res)=>{
    if(!remoteAddressAllowed(req.socket.remoteAddress,lanOnly))return json(res,403,{error:'LAN-only mode: use a private home network address'});
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/health')return json(res,200,{ok:true});
    if(req.method==='GET'&&url.pathname==='/api/status')return json(res,200,{aiConfigured:Boolean(apiKey),allowClientKeys,runtimeMode});
    if(req.method==='GET'&&url.pathname==='/api/characters')return json(res,200,loadCharacters(charactersFile));
    if(req.method==='DELETE'&&url.pathname.startsWith('/api/characters/')){
      const charId=decodeURIComponent(url.pathname.slice('/api/characters/'.length)).trim();
      if(!charId)return json(res,400,{error:'Character ID required'});
      const all=loadCharacters(charactersFile);
      const i=all.findIndex(x=>x.id===charId||x.name===charId);
      if(i<0)return json(res,404,{error:'Character not found'});
      const target=all[i];
      all.splice(i,1);
      safeWriteJson(charactersFile,all);
      const cFile=getChatsTargetFile(req);
      const allChats=loadChats(cFile);
      if(allChats[target.name]||allChats[charId]){
        delete allChats[target.name];
        delete allChats[charId];
        safeWriteJson(cFile,allChats);
      }
      if(target.imageUrl&&target.imageUrl.startsWith('/uploads/')){
        const imgFile=path.basename(target.imageUrl);
        const stillUsed=all.some(c=>(c.imageUrl&&c.imageUrl.includes(imgFile))||(c.avatarUrl&&c.avatarUrl.includes(imgFile)));
        if(!stillUsed){try{fs.unlinkSync(path.join(uploadsDir,imgFile))}catch{}}
      }
      if(target.avatarUrl&&target.avatarUrl.startsWith('/uploads/')){
        const avFile=path.basename(target.avatarUrl);
        const stillUsed=all.some(c=>(c.imageUrl&&c.imageUrl.includes(avFile))||(c.avatarUrl&&c.avatarUrl.includes(avFile)));
        if(!stillUsed){try{fs.unlinkSync(path.join(uploadsDir,avFile))}catch{}}
      }
      return json(res,200,{ok:true,id:charId});
    }
    if(req.method==='GET'&&url.pathname==='/api/settings')return json(res,200,loadSettings(settingsFile));
    if(req.method==='PUT'&&url.pathname==='/api/settings'){
      let body;try{body=await readJson(req)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Invalid settings'});
      const current=loadSettings(settingsFile);
      for(const [key,value] of Object.entries(body)){if(!SETTINGS_KEYS.has(key))continue;current[key]=sanitizeSetting(key,value)}
      safeWriteJson(settingsFile,current);
      return json(res,200,current);
    }
    // Dynamic custom-host allowlist (local/LAN only, disabled in VPS mode)
    if(url.pathname==='/api/custom-hosts'){
      if(runtimeMode==='vps')return json(res,403,{error:'Dynamic host management is disabled in VPS mode'});
      if(req.method==='GET'){
        const s=loadSettings(settingsFile);return json(res,200,{hosts:s.dynamicCustomHosts||[]});
      }
      if(req.method==='POST'){
        let body;try{body=await readJson(req)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})};
        const hostname=sanitizeCustomHost(body&&body.host);
        if(!hostname)return json(res,400,{error:'Invalid hostname. Must be a valid HTTPS domain (e.g. api.example.com).'});
        const current=loadSettings(settingsFile);
        const list=Array.isArray(current.dynamicCustomHosts)?current.dynamicCustomHosts:[];
        if(!list.includes(hostname)){
          if(list.length>=30)return json(res,400,{error:'Dynamic host list is full (max 30).'});
          list.push(hostname);current.dynamicCustomHosts=list;safeWriteJson(settingsFile,current);
        }
        return json(res,200,{ok:true,hosts:list});
      }
      if(req.method==='DELETE'){
        let body;try{body=await readJson(req)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})};
        const hostname=sanitizeCustomHost(body&&body.host);
        if(!hostname)return json(res,400,{error:'Invalid hostname'});
        const current=loadSettings(settingsFile);
        const list=Array.isArray(current.dynamicCustomHosts)?current.dynamicCustomHosts:[];
        current.dynamicCustomHosts=list.filter(h=>h!==hostname);safeWriteJson(settingsFile,current);
        return json(res,200,{ok:true,hosts:current.dynamicCustomHosts});
      }
      return json(res,405,{error:'Method not allowed'});
    }
    if(req.method==='GET'&&url.pathname==='/api/chats'){
      const file=getChatsTargetFile(req);
      return json(res,200,loadChats(file));
    }
    if(req.method==='PUT'&&url.pathname.startsWith('/api/chats/')){
      const charName=decodeURIComponent(url.pathname.slice('/api/chats/'.length)).trim();
      if(!charName)return json(res,400,{error:'Character name is required'});
      let body;try{body=await readJson(req)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      if(!body||typeof body!=='object')return json(res,400,{error:'Invalid chat payload'});
      const file=getChatsTargetFile(req);
      const all=loadChats(file);
      const rawList=Array.isArray(body.history)?body.history:(Array.isArray(body.messages)?body.messages:[]);
      const history=rawList.slice(-100).map(m=>{
        if(!m||typeof m!=='object')return null;
        const role=m.role==='assistant'?'assistant':'user';
        const content=String(m.content||'').slice(0,20000);
        return {role,content};
      }).filter(Boolean);
      all[charName]={history,messages:history,lastUpdated:Number(body.lastUpdated)||Date.now()};
      safeWriteJson(file,all);
      return json(res,200,{ok:true,name:charName,count:history.length,saved:history.length});
    }
    if(req.method==='DELETE'&&url.pathname.startsWith('/api/chats/')){
      const charName=decodeURIComponent(url.pathname.slice('/api/chats/'.length)).trim();
      if(!charName)return json(res,400,{error:'Character name is required'});
      const file=getChatsTargetFile(req);
      const all=loadChats(file);
      if(all[charName]){delete all[charName];safeWriteJson(file,all);}
      return json(res,200,{ok:true,name:charName});
    }
    if(req.method==='POST'&&url.pathname==='/api/models'){
      let body;try{body=await readJson(req)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      if(!body||!SAFE_PROVIDERS.has(body.provider))return json(res,400,{error:'Unsupported provider'});
      if(body.apiKey&&!allowClientKeys)return json(res,403,{error:'Browser API keys are disabled by server settings'});
      let base;try{base=new URL(String(body.baseUrl||''))}catch{return json(res,400,{error:'Invalid provider base URL'})}
      if(!['https:','http:'].includes(base.protocol))return json(res,400,{error:'Unsupported provider URL protocol'});
      if(body.provider==='openai'&&(base.hostname!=='api.openai.com'||base.protocol!=='https:'))return json(res,400,{error:'OpenAI base URL must be https://api.openai.com'});
      if(body.provider==='openrouter'&&(base.hostname!=='openrouter.ai'||base.protocol!=='https:'))return json(res,400,{error:'OpenRouter base URL must be https://openrouter.ai'});
      if(body.apiKey&&(!allowClientKeys||!clientKeyHosts.has(base.hostname.toLowerCase())))return json(res,403,{error:'Browser API keys are disabled or not allowed for this provider'});
      if(body.provider==='ollama'&&(!['localhost','127.0.0.1'].includes(base.hostname)||base.protocol!=='http:'))return json(res,400,{error:'Ollama discovery must use localhost HTTP'});
      if(body.provider==='openai-compatible'){
        const dynHosts=runtimeMode!=='vps'?(loadSettings(settingsFile).dynamicCustomHosts||[]):[];
        const effectiveAllowlist=[...customHostEntries,...dynHosts];
        if(!isAllowedCustomProviderUrl(base,effectiveAllowlist)){
          const host=base.hostname.toLowerCase(),allowed=effectiveAllowlist.map(entry=>{try{return new URL(String(entry).includes('://')?String(entry):`https://${entry}`).hostname.toLowerCase()}catch{return String(entry).toLowerCase()}});
          return json(res,400,{error:`Custom endpoint host is not on the server allow-list: ${host}`,host,allowedHosts:allowed,canAddDynamic:runtimeMode!=='vps'})
        }
      }
      if(body.provider==='ollama'){
        try{const r=await httpFetch(base.toString().replace(/\/$/,'')+'/models',{signal:AbortSignal.timeout(15000)});if(!r.ok)return json(res,502,{error:'Ollama model list request failed'});const d=await r.json();return json(res,200,{models:Array.isArray(d.models)?d.models.map(m=>m&&m.name).filter(Boolean):[]})}catch{return json(res,502,{error:'Could not reach Ollama on the Hush host'})}
      }
      const adapter=providerAdapters[body.provider];
      if(adapter&&typeof adapter.listModels==='function'){
        try{const useClient=allowClientKeys&&clientKeyHosts.has(base.hostname.toLowerCase())&&!!body.apiKey;const models=await adapter.listModels({baseUrl:base.toString().replace(/\/$/,''),apiKey:useClient?'':apiKey,clientKey:useClient?body.apiKey:'',fetch:httpFetch});return json(res,200,{models:Array.isArray(models)?models.filter(x=>typeof x==='string'):[]})}catch{return json(res,502,{error:'Could not load models from provider'})}
      }
      if(body.provider==='openrouter'&&allowClientKeys&&clientKeyHosts.has(base.hostname.toLowerCase())){
        const key=body.apiKey||apiKey;
        if(!key)return json(res,503,{error:'Configure a server key or enable browser-key mode'});
        try{const r=await httpFetch('https://openrouter.ai/api/v1/models',{headers:{authorization:'Bearer '+key},signal:AbortSignal.timeout(15000)});if(!r.ok)return json(res,502,{error:'OpenRouter model list request failed ('+r.status+')'});const d=await r.json();return json(res,200,{models:Array.isArray(d.data)?d.data.map(m=>m&&m.id).filter(Boolean):[]})}catch{return json(res,502,{error:'Could not reach OpenRouter'})}
      }
      const useClient=allowClientKeys&&clientKeyHosts.has(base.hostname.toLowerCase())&&!!body.apiKey; if(body.apiKey&&!useClient)return json(res,403,{error:'Browser API keys are disabled or not allowed for this provider'});
      if(!apiKey&&!useClient)return json(res,503,{error:'No permitted API key is configured for this provider'});
      try{const headers={'content-type':'application/json','authorization':'Bearer '+(useClient?body.apiKey:apiKey)};const r=await httpFetch(base.toString().replace(/\/$/,'')+'/models',{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)return json(res,502,{error:'Provider model-list request failed ('+r.status+')'});const data=await r.json();return json(res,200,{models:Array.isArray(data.data)?data.data.map(m=>m&&m.id).filter(Boolean):[]})}catch{return json(res,502,{error:'Could not reach the provider model-list endpoint'})}
    }
    if(req.method==='POST'&&url.pathname==='/api/characters'){
      try{
        const c=await readJson(req);
        if(!c||typeof c.name!=='string'||!c.name.trim())return json(res,400,{error:'Character name is required'});
        if(typeof c.imageDataUrl==='string'&&c.imageDataUrl.length>5*1024*1024)return json(res,413,{error:'Image is too large (5 MB max)'});
        if(typeof c.avatarDataUrl==='string'&&c.avatarDataUrl.length>5*1024*1024)return json(res,413,{error:'Avatar image is too large (5 MB max)'});
        let imageUrl='';
        if(c.imageDataUrl){
          const m=c.imageDataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
          if(!m)return json(res,400,{error:'Image must be PNG, JPEG, or WebP'});
          const bytes=Buffer.from(m[2],'base64');
          if(bytes.length>3*1024*1024)return json(res,413,{error:'Image is too large (3 MB decoded max)'});
          const ext=m[1]==='jpeg'?'jpg':m[1]; const filename=crypto.randomBytes(16).toString('hex')+'.'+ext;
          fs.writeFileSync(path.join(uploadsDir,filename),bytes,{flag:'wx'});imageUrl='/uploads/'+filename;
        }
        let avatarUrl='';
        if(c.avatarDataUrl){
          const m=c.avatarDataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
          if(!m)return json(res,400,{error:'Avatar image must be PNG, JPEG, or WebP'});
          const bytes=Buffer.from(m[2],'base64');
          if(bytes.length>3*1024*1024)return json(res,413,{error:'Avatar image is too large (3 MB decoded max)'});
          const ext=m[1]==='jpeg'?'jpg':m[1]; const filename=crypto.randomBytes(16).toString('hex')+'.'+ext;
          fs.writeFileSync(path.join(uploadsDir,filename),bytes,{flag:'wx'});avatarUrl='/uploads/'+filename;
        }
        const clean={id:typeof c.id==='string'?c.id:crypto.randomUUID(),name:c.name.trim().slice(0,80),role:String(c.role||'').slice(0,300),appearance:String(c.appearance||'').slice(0,1000),desc:String(c.desc||'').slice(0,1500),genre:Array.isArray(c.genre)?c.genre.filter(x=>typeof x==='string').slice(0,10):[],adult:c.adult===true,systemPrompt:String(c.systemPrompt||'').slice(0,10000),greeting:String(c.greeting||'').slice(0,3000),imageUrl:imageUrl||String(c.imageUrl||'').slice(0,500),avatarUrl:avatarUrl||String(c.avatarUrl||'').slice(0,500),updatedAt:new Date().toISOString()};
        const all=loadCharacters(charactersFile);const i=all.findIndex(x=>x.id===clean.id||x.name===clean.name);
        if(i>=0){
          const prevImg=all[i].imageUrl;
          if(prevImg&&prevImg!==clean.imageUrl&&prevImg.startsWith('/uploads/')){
            const oldFile=path.basename(prevImg);
            const stillUsed=all.some((item,idx)=>idx!==i&&((item.imageUrl&&item.imageUrl.includes(oldFile))||(item.avatarUrl&&item.avatarUrl.includes(oldFile))));
            if(!stillUsed){try{fs.unlinkSync(path.join(uploadsDir,oldFile))}catch{}}
          }
          const prevAv=all[i].avatarUrl;
          if(prevAv&&prevAv!==clean.avatarUrl&&prevAv.startsWith('/uploads/')){
            const oldFile=path.basename(prevAv);
            const stillUsed=all.some((item,idx)=>idx!==i&&((item.imageUrl&&item.imageUrl.includes(oldFile))||(item.avatarUrl&&item.avatarUrl.includes(oldFile))));
            if(!stillUsed){try{fs.unlinkSync(path.join(uploadsDir,oldFile))}catch{}}
          }
          all[i]={...all[i],...clean};
        }else all.unshift(clean);
        safeWriteJson(charactersFile,all);return json(res,201,clean);
      }catch(e){if(!res.headersSent)return json(res,e.status||400,{error:e.status===413?'Request too large':e.status===400?e.message:'Could not save character'});return}
    }
    if(req.method==='POST'&&url.pathname==='/api/chat'){
      if(!checkRateLimit(req.socket.remoteAddress))return json(res,429,{error:'Too many requests. Please wait a moment before sending more messages.'});
      let body;try{body=await readJson(req)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      if(!body||!SAFE_PROVIDERS.has(body.provider))return json(res,400,{error:'Unsupported provider adapter'});
      let base;try{base=new URL(String(body.baseUrl||''))}catch{return json(res,400,{error:'Invalid provider base URL'})}
      if(body.apiKey&&(!allowClientKeys||!clientKeyHosts.has(base.hostname.toLowerCase())))return json(res,403,{error:'Browser API keys are disabled or not allowed for this provider'});
      const allowLocal=body.provider==='ollama';
      if(base.protocol!=='https:'&&!(allowLocal&&['localhost','127.0.0.1'].includes(base.hostname)&&base.protocol==='http:'))return json(res,400,{error:'Provider URL must use HTTPS (HTTP allowed for local Ollama only)'});
      if(body.provider==='openrouter'&&(base.hostname!=='openrouter.ai'||base.protocol!=='https:'))return json(res,400,{error:'OpenRouter requests must use https://openrouter.ai'});
      if(body.provider==='openai'&&(base.hostname!=='api.openai.com'||base.protocol!=='https:'))return json(res,400,{error:'OpenAI requests must use https://api.openai.com'});
      if(body.provider==='ollama'&&(!allowLocal||!['localhost','127.0.0.1'].includes(base.hostname)))return json(res,400,{error:'Ollama adapter is limited to local host URLs'});
      if(!Array.isArray(body.messages)||body.messages.length>80||body.messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>20000))return json(res,400,{error:'Invalid messages'});
      const model=String(body.model||'').trim().slice(0,150);if(!model)return json(res,400,{error:'Model is required'});
      if(!['openai-compatible','openai','openrouter','ollama'].includes(body.provider))return json(res,400,{error:'Unsupported provider'});
      if(body.provider==='openai-compatible'){
        const dynHosts=runtimeMode!=='vps'?(loadSettings(settingsFile).dynamicCustomHosts||[]):[];
        const effectiveAllowlist=[...customHostEntries,...dynHosts];
        if(!isAllowedCustomProviderUrl(base,effectiveAllowlist)){
          const host=base.hostname.toLowerCase(),allowed=effectiveAllowlist.map(entry=>{try{return new URL(String(entry).includes('://')?String(entry):`https://${entry}`).hostname.toLowerCase()}catch{return String(entry).toLowerCase()}});
          return json(res,400,{error:`Custom endpoint host is not on the server allow-list: ${host}`,host,allowedHosts:allowed,canAddDynamic:runtimeMode!=='vps'})
        }
      }
      const requestApiKey=body.apiKey?(allowClientKeys&&clientKeyHosts.has(base.hostname.toLowerCase())?body.apiKey:''):(options.apiKey!==undefined?options.apiKey:process.env.AI_API_KEY||'');
      if(!requestApiKey&&body.provider!=='ollama')return json(res,503,{error:'AI provider not configured on the server.'});
      const limits=options.contextLimits||{};
      const compact=buildCompactContext({system:body.messages[0]?.role==='system'?body.messages[0].content:'',history:body.messages[0]?.role==='system'?body.messages.slice(1):body.messages,maxInputTokens:Number(limits.maxInputTokens||process.env.MAX_INPUT_TOKENS||1800),memoryChars:Number(limits.memoryChars||process.env.MEMORY_SUMMARY_CHARS||900)});
      const endpoint=body.provider==='ollama'?'http://127.0.0.1:11434/v1/chat/completions':base.toString().replace(/\/$/,'')+'/chat/completions';
      try{
        const upstream=await httpFetch(endpoint,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+requestApiKey},body:JSON.stringify({model,messages:compact.messages,temperature:Math.max(0,Math.min(2,Number(body.temperature??0.8))),max_tokens:Math.max(64,Math.min(1200,Number(body.maxTokens||process.env.MAX_OUTPUT_TOKENS||300))) }),signal:AbortSignal.timeout(60000)});
        const data=await upstream.json().catch(()=>({}));if(!upstream.ok)return json(res,502,{error:'Provider request failed ('+upstream.status+'). Check server logs/provider settings.'});
        const choice=data&&data.choices&&data.choices[0];
        const raw=choice&&choice.message&&choice.message.content;
        if(typeof raw!=='string')return json(res,502,{error:'Provider response format was not recognized'});
        const text=choice.finish_reason==='length'?trimToCompleteSentence(raw):raw;
        return json(res,200,{text});
      }catch(e){console.error('AI upstream error:',e.name);return json(res,502,{error:e.name==='TimeoutError'?'Provider timed out':'Could not connect to provider'});}
    }
    if(req.method==='GET'&&url.pathname.startsWith('/uploads/')){
      const name=path.basename(url.pathname);if(!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(name))return json(res,404,{error:'Not found'});
      const file=path.join(uploadsDir,name);try{const stat=fs.statSync(file);res.writeHead(200,{'content-type':MIME[path.extname(file)],'content-length':stat.size,'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff'});return fs.createReadStream(file).pipe(res)}catch{return json(res,404,{error:'Not found'})}
    }
    if(req.method==='GET'&&url.pathname==='/'){
      const file=path.join(root,'roleplay-ai-prototype-v3.html');try{const stat=fs.statSync(file);res.writeHead(200,{'content-type':MIME['.html'],'content-length':stat.size,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'SAMEORIGIN'});return fs.createReadStream(file).pipe(res)}catch{return json(res,500,{error:'UI file missing'})}
    }
    return json(res,404,{error:'Not found'});
  });
  return {server,dataDir,uploadsDir};
}
if(require.main===module){
  loadDotEnv();
  const {server}=createServer();
  const port=Number(process.env.PORT||3000);
  const host=process.env.HOST||'127.0.0.1';
  const s=server.listen(port,host,()=>console.log(`HushRP listening on http://${host}:${port}`));
  const stop=()=>{s.close(()=>process.exit(0));setTimeout(()=>process.exit(0),3000).unref();};
  process.on('SIGINT',stop);
  process.on('SIGTERM',stop);
}
module.exports={createServer,loadDotEnv,isPrivateLanAddress,remoteAddressAllowed,listPrivateIPv4,isAllowedCustomProviderUrl};
