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
function readJson(req, limit = MAX_BODY) {
  return new Promise((resolve,reject)=>{
    let size=0, chunks=[];
    req.on('data', chunk=>{ size+=chunk.length; if(size>limit){ reject(Object.assign(new Error('Request too large'),{status:413})); req.destroy(); return; } chunks.push(chunk); });
    req.on('end',()=>{try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}'))}catch{reject(Object.assign(new Error('Invalid JSON'),{status:400}))}});
    req.on('error',reject);
  });
}
function loadCharacters(file){try{const arr=JSON.parse(fs.readFileSync(file,'utf8'));return Array.isArray(arr)?arr:[]}catch{return []}}
const SETTINGS_KEYS=new Set(['globalPrompt','tokenBudget','replyBudget','worldSettings','providerSettings','modelCache','userProfiles','activeProfileId','favorites','activeLocale','customLocales','dynamicCustomHosts','serverApiKey','activeTheme']);
function loadSettings(file){try{const o=JSON.parse(fs.readFileSync(file,'utf8'));return o&&typeof o==='object'&&!Array.isArray(o)?o:{}}catch{return {}}}
function timingSafeCheck(a, b){
  if(typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if(bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
function isLoopbackAddress(address){
  const ip = String(address || '').replace(/^::ffff:/i, '').split('%')[0].toLowerCase();
  return ip === 'localhost' || ip === '127.0.0.1' || ip === '::1';
}
function verifyImageMagicBytes(bytes, format){
  if(!bytes || bytes.length < 12) return false;
  if(format === 'png'){
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
           bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A;
  }
  if(format === 'jpeg' || format === 'jpg'){
    return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  }
  if(format === 'webp'){
    return bytes.slice(0, 4).toString('ascii') === 'RIFF' &&
           bytes.slice(8, 12).toString('ascii') === 'WEBP';
  }
  return false;
}
function validateCharacterName(name){
  const s = String(name || '').trim();
  if(!s || s.length > 100) return null;
  if(s === '__proto__' || s === 'constructor' || s === 'prototype') return null;
  return s;
}
// Sanitize a single custom host string: must be a valid HTTPS hostname, no path, no port tricks.
function sanitizeCustomHost(raw){
  const s=String(raw||'').trim().toLowerCase().slice(0,300);
  if(!s)return null;
  try{
    const u=new URL(s.includes('://')?s:`https://${s}`);
    if(u.protocol!=='https:')return null;
    const h = u.hostname.toLowerCase();
    // Reject IP addresses (IPv4, IPv6, localhost, loopback, private)
    if(/^(\d{1,3}\.){3}\d{1,3}$/.test(h)||h==='localhost'||h.includes(':')||h.startsWith('[')||h.endsWith(']'))return null;
    if(h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.localhost')||h.endsWith('.lan'))return null;
    if(/^0x[0-9a-f]+$/i.test(h))return null;
    // Must have at least one dot (real domain) and only valid domain chars
    if(!h.includes('.')||!/^[a-z0-9.-]+$/.test(h))return null;
    return h;
  }catch{return null}
}
function sanitizeSetting(key,value){
  if(key==='tokenBudget')return Math.max(400,Math.min(8000,Math.round(Number(value))||1200));
  if(key==='replyBudget')return Math.max(64,Math.min(1200,Math.round(Number(value))||300));
  if(key==='globalPrompt')return String(value||'').slice(0,8000);
  if(key==='activeProfileId')return String(value||'').slice(0,100);
  if(key==='activeLocale')return /^[a-zA-Z0-9_-]{2,20}$/.test(String(value||''))?String(value).slice(0,20):'th';
  if(key==='activeTheme')return ['obsidian','sakura','emerald','ocean','parchment'].includes(String(value||''))?String(value):'obsidian';
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
  if(key==='providerSettings'){const v=value&&typeof value==='object'?value:{};return {provider:String(v.provider||'').slice(0,40),baseUrl:String(v.baseUrl||'').slice(0,300),model:String(v.model||'').slice(0,150),customBaseUrl:String(v.customBaseUrl||'').slice(0,300),keyMode:v.keyMode==='browser'?'browser':'server'}}
  if(key==='serverApiKey')return String(value||'').trim().slice(0,500);
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
function stripThinkingTags(text){
  return String(text||'')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi,'')
    .replace(/<think\b[^>]*>[\s\S]*$/gi,'')
    .trim();
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
  const envApiKey=options.apiKey!==undefined?options.apiKey:process.env.AI_API_KEY||'';
  const publicDir=path.join(root,'public');
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
  const configuredAuthToken = options.authToken !== undefined ? options.authToken : (process.env.AUTH_TOKEN || process.env.HUSH_AUTH_TOKEN || '');
  function maskKey(k){const s=String(k||'').trim();if(!s)return '';return s.length>8?s.slice(0,3)+'••••'+s.slice(-4):'••••'}
  function getEffectiveServerApiKey(){const saved=String(loadSettings(settingsFile).serverApiKey||'').trim();return saved||String(envApiKey||'').trim()}
  function redactSettings(obj){const out={...(obj||{})};const hasKey=Boolean(out.serverApiKey);if(hasKey){out.serverKeyMasked=maskKey(out.serverApiKey);out.serverApiKey=out.serverKeyMasked}else{delete out.serverApiKey;out.serverKeyMasked=''}return out}
  function isAllowedOllamaUrl(base){const h=base.hostname.toLowerCase();if(!['http:','https:'].includes(base.protocol))return false;if(['localhost','127.0.0.1','[::1]'].includes(h))return true;return runtimeMode!=='vps'&&isPrivateLanAddress(h)}
  async function fetchWithLocalhostFallback(targetUrl,makeInit){
    try{return await httpFetch(targetUrl,makeInit())}catch(err){
      try{const u=new URL(targetUrl);if(u.hostname==='localhost'){u.hostname='127.0.0.1';return await httpFetch(u.toString(),makeInit())}}catch{}
      throw err;
    }
  }
  function normalizeProviderBase(base){const u=new URL(base.toString());u.search='';u.hash='';u.pathname=u.pathname.replace(/\/+$/,'').replace(/\/(chat\/completions|models|api\/tags)$/,'');return u}
  function buildOllamaChatEndpoint(base){const u=normalizeProviderBase(base);const cleanPath=u.pathname.replace(/\/+$/,'');return cleanPath.endsWith('/v1')?`${u.origin}${cleanPath}/chat/completions`:`${u.origin}${cleanPath}/v1/chat/completions`}
  function resolveProviderRequest(req,body,{requireKey=true,missingKeyError='No permitted API key is configured for this provider'}={}){
    if(!body||!SAFE_PROVIDERS.has(body.provider))return {status:400,error:{error:'Unsupported provider'}};
    let base;try{base=new URL(String(body.baseUrl||''))}catch{return {status:400,error:{error:'Invalid provider base URL'}}}
    if(!['https:','http:'].includes(base.protocol))return {status:400,error:{error:'Unsupported provider URL protocol'}};
    const isOllama=body.provider==='ollama';
    if(!isOllama&&body.apiKey&&(!allowClientKeys||!clientKeyHosts.has(base.hostname.toLowerCase())))return {status:403,error:{error:allowClientKeys?'Browser API keys are disabled or not allowed for this provider':'Browser API keys are disabled by server settings'}};
    if((isOllama||!body.apiKey)&&configuredAuthToken&&!isAuthorized(req))return {status:401,error:{error:'Unauthorized: valid auth token required'}};
    if(body.provider==='openai'&&(base.hostname!=='api.openai.com'||base.protocol!=='https:'))return {status:400,error:{error:'OpenAI base URL must be https://api.openai.com'}};
    if(body.provider==='openrouter'&&(base.hostname!=='openrouter.ai'||base.protocol!=='https:'))return {status:400,error:{error:'OpenRouter base URL must be https://openrouter.ai'}};
    if(isOllama&&!isAllowedOllamaUrl(base))return {status:400,error:{error:'Ollama requests must target localhost or a private LAN host (not allowed on VPS)'}};
    if(body.provider==='openai-compatible'){
      if(base.protocol!=='https:')return {status:400,error:{error:'Custom provider URL must use HTTPS'}};
      const dynHosts=runtimeMode!=='vps'?(loadSettings(settingsFile).dynamicCustomHosts||[]):[];
      const effectiveAllowlist=[...customHostEntries,...dynHosts];
      if(!isAllowedCustomProviderUrl(base,effectiveAllowlist)){
        const host=base.hostname.toLowerCase(),allowed=effectiveAllowlist.map(entry=>{try{return new URL(String(entry).includes('://')?String(entry):`https://${entry}`).hostname.toLowerCase()}catch{return String(entry).toLowerCase()}});
        return {status:400,error:{error:`Custom endpoint host is not on the server allow-list: ${host}`,host,allowedHosts:allowed,canAddDynamic:runtimeMode!=='vps'}};
      }
    }
    const useClient=!isOllama&&allowClientKeys&&clientKeyHosts.has(base.hostname.toLowerCase())&&!!body.apiKey;
    const serverKey=getEffectiveServerApiKey();
    const effectiveKey=isOllama?'':(useClient?String(body.apiKey):serverKey);
    if(requireKey&&!effectiveKey&&!isOllama)return {status:503,error:{error:missingKeyError}};
    return {ok:true,base,useClient,effectiveKey,serverKey};
  }
  async function discoverProviderModels({provider,base,useClient,effectiveKey,serverKey}){
    if(provider==='ollama'){
      const norm=normalizeProviderBase(base);
      const basePath=norm.pathname.replace(/\/+$/,'');
      const candidates=basePath.endsWith('/v1')
        ? [`${norm.origin}${basePath}/models`, `${norm.origin}/api/tags`, `${norm.origin}/models`]
        : [`${norm.origin}/api/tags`, `${norm.origin}${basePath}/v1/models`, `${norm.origin}${basePath}/models`];
      let lastStatus=0;
      for(const endpoint of candidates){
        try{
          const r=await fetchWithLocalhostFallback(endpoint,()=>({signal:AbortSignal.timeout(15000),redirect:'error'}));
          lastStatus=r.status;
          if(!r.ok)continue;
          const d=await r.json().catch(()=>({}));
          const list=[
            ...(Array.isArray(d.data)?d.data.map(m=>m&&m.id):[]),
            ...(Array.isArray(d.models)?d.models.map(m=>m&&(m.name||m.id)):[])
          ].filter(x=>typeof x==='string'&&x);
          if(list.length)return {ok:true,models:[...new Set(list)]};
        }catch{}
      }
      if(lastStatus>=400)return {status:502,error:'Ollama model list request failed ('+lastStatus+')'};
      return {status:502,error:'Could not reach Ollama on the Hush host'};
    }
    const adapter=providerAdapters[provider];
    if(adapter&&typeof adapter.listModels==='function'){
      try{
        const models=await adapter.listModels({baseUrl:base.toString().replace(/\/$/,''),apiKey:useClient?'':serverKey,clientKey:useClient?effectiveKey:'',fetch:httpFetch});
        return {ok:true,models:Array.isArray(models)?models.filter(x=>typeof x==='string'):[]};
      }catch{return {status:502,error:'Could not load models from provider'}}
    }
    const endpoint=provider==='openrouter'?'https://openrouter.ai/api/v1/models':normalizeProviderBase(base).toString().replace(/\/$/,'')+'/models';
    const headers={'content-type':'application/json'};
    if(effectiveKey)headers.authorization='Bearer '+effectiveKey;
    try{
      const r=await httpFetch(endpoint,{headers,signal:AbortSignal.timeout(15000),redirect:'error'});
      if(!r.ok)return {status:502,error:(provider==='openrouter'?'OpenRouter':'Provider')+' model list request failed ('+r.status+')'};
      const data=await r.json().catch(()=>({}));
      return {ok:true,models:Array.isArray(data.data)?data.data.map(m=>m&&m.id).filter(Boolean):[]};
    }catch{return {status:502,error:provider==='openrouter'?'Could not reach OpenRouter':'Could not reach the provider model-list endpoint'}}
  }
  function isAuthorized(req){
    if(configuredAuthToken){
      const authHeader = req.headers['authorization'];
      const bearerToken = (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) ? authHeader.slice(7).trim() : null;
      const customHeaderToken = req.headers['x-hush-token'] ? String(req.headers['x-hush-token']).trim() : null;
      const candidate = bearerToken || customHeaderToken;
      return Boolean(candidate && timingSafeCheck(candidate, configuredAuthToken));
    }
    if(options.requireAuth){
      return false;
    }
    if(runtimeMode === 'local' && isLoopbackAddress(req.socket.remoteAddress)){
      return true;
    }
    return true;
  }

  fs.mkdirSync(uploadsDir,{recursive:true});
  fs.mkdirSync(sessionsDir,{recursive:true});
  if(!fs.existsSync(charactersFile))fs.writeFileSync(charactersFile,'[]\n','utf8');

  const sessionRegistry = new Map();
  const sessionMetaFile = path.join(sessionsDir, 'sessions_meta.json');
  function loadSessionMeta(){
    try {
      const data = JSON.parse(fs.readFileSync(sessionMetaFile, 'utf8'));
      if(data && typeof data === 'object'){
        for(const [k,v] of Object.entries(data)){
          if(v && typeof v.tokenHash === 'string') sessionRegistry.set(k, v);
        }
      }
    } catch {}
  }
  function saveSessionMeta(){
    try {
      const out = Object.fromEntries(sessionRegistry.entries());
      safeWriteJson(sessionMetaFile, out);
    } catch {}
  }
  loadSessionMeta();

  function validateSessionAccess(req){
    // In local/LAN mode all connections share the same single-user data store.
    // Different LAN IPs are different browser origins → different localStorage →
    // different session IDs, which would cause data isolation.  We avoid that by
    // ignoring the session ID entirely and routing everything to the shared file.
    if(runtimeMode !== 'vps'){
      return { ok: true, targetFile: chatsFile, sid: null };
    }

    const rawSid = String(req.headers['x-session-id'] || '').trim();
    const rawToken = String(req.headers['x-session-token'] || '').trim();

    if(runtimeMode === 'vps'){
      if(!rawSid || !/^[a-zA-Z0-9_-]{8,64}$/.test(rawSid)){
        return { ok: false, status: 400, error: 'Valid x-session-id header is required in VPS mode' };
      }
    }

    if(!rawSid){
      return { ok: true, targetFile: chatsFile, sid: null };
    }

    if(!/^[a-zA-Z0-9_-]{8,64}$/.test(rawSid) || path.basename(rawSid) !== rawSid){
      return { ok: false, status: 400, error: 'Invalid session ID format' };
    }

    const sid = rawSid;
    const targetFile = path.join(sessionsDir, `chats_${sid}.json`);

    const existing = sessionRegistry.get(sid);
    if(existing && existing.tokenHash){
      if(!rawToken){
        return { ok: false, status: 403, error: 'Forbidden: Session token required for this session' };
      }
      const candidateHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      if(!timingSafeCheck(candidateHash, existing.tokenHash)){
        return { ok: false, status: 403, error: 'Forbidden: Invalid session token' };
      }
    } else if(rawToken){
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      sessionRegistry.set(sid, { tokenHash, createdAt: Date.now() });
      saveSessionMeta();
    }

    return { ok: true, targetFile, sid };
  }
  function getChatsTargetFile(req){
    const acc = validateSessionAccess(req);
    return acc.ok && acc.targetFile ? acc.targetFile : chatsFile;
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
    if(req.method==='GET'&&url.pathname==='/api/status'){
      const apiKey=getEffectiveServerApiKey();
      return json(res,200,{aiConfigured:Boolean(apiKey),serverKeyMasked:apiKey?maskKey(apiKey):'',allowClientKeys,runtimeMode,authRequired:Boolean(configuredAuthToken)});
    }
    if(url.pathname.startsWith('/api/') && !checkRateLimit(req.socket.remoteAddress)) return json(res, 429, {error: 'Too many requests. Please wait a moment.'});
    if(req.method==='POST'&&url.pathname==='/api/sessions'){
      const sessionId = 'sid_' + crypto.randomBytes(12).toString('hex');
      const sessionToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
      sessionRegistry.set(sessionId, { tokenHash, createdAt: Date.now() });
      saveSessionMeta();
      return json(res, 201, { sessionId, sessionToken });
    }
    if(req.method==='GET'&&url.pathname==='/api/characters')return json(res,200,loadCharacters(charactersFile));
    if(req.method==='DELETE'&&url.pathname.startsWith('/api/characters/')){
      if(configuredAuthToken && !isAuthorized(req)) return json(res, 401, {error: 'Unauthorized: valid auth token required'});
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
    if(req.method==='GET'&&url.pathname==='/api/settings')return json(res,200,redactSettings(loadSettings(settingsFile)));
    if(req.method==='PUT'&&url.pathname==='/api/settings'){
      if(!isAuthorized(req))return json(res, 401, {error: 'Unauthorized: valid auth token required'});
      let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      if(!body||typeof body!=='object'||Array.isArray(body))return json(res,400,{error:'Invalid settings'});
      if(Object.prototype.hasOwnProperty.call(body,'serverApiKey')&&runtimeMode==='vps'&&!configuredAuthToken){
        return json(res,403,{error:'Changing server API key from Web UI in VPS mode requires AUTH_TOKEN'});
      }
      const current=loadSettings(settingsFile);
      for(const [key,value] of Object.entries(body)){
        if(!SETTINGS_KEYS.has(key))continue;
        const cleanVal=sanitizeSetting(key,value);
        if(key==='serverApiKey'&&!cleanVal){delete current.serverApiKey;continue}
        current[key]=cleanVal;
      }
      safeWriteJson(settingsFile,current);
      const out=redactSettings(current);
      const effective=getEffectiveServerApiKey();
      out.serverKeyMasked=effective?maskKey(effective):'';
      return json(res,200,out);
    }
    // Dynamic custom-host allowlist (local/LAN only, disabled in VPS mode)
    if(url.pathname==='/api/custom-hosts'){
      if(runtimeMode==='vps')return json(res,403,{error:'Dynamic host management is disabled in VPS mode'});
      if(req.method==='GET'){
        const s=loadSettings(settingsFile);return json(res,200,{hosts:s.dynamicCustomHosts||[]});
      }
      if(req.method==='POST'){
        if(!isAuthorized(req))return json(res, 401, {error: 'Unauthorized: valid auth token required'});
        let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})};
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
        if(!isAuthorized(req))return json(res, 401, {error: 'Unauthorized: valid auth token required'});
        let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})};
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
      const access = validateSessionAccess(req);
      if(!access.ok)return json(res, access.status, {error: access.error});
      return json(res,200,loadChats(access.targetFile));
    }
    if(req.method==='PUT'&&url.pathname.startsWith('/api/chats/')){
      const rawName=decodeURIComponent(url.pathname.slice('/api/chats/'.length)).trim();
      const charName=validateCharacterName(rawName);
      if(!charName)return json(res,400,{error:'Character name is invalid or required'});
      const access = validateSessionAccess(req);
      if(!access.ok)return json(res, access.status, {error: access.error});
      let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      if(!body||typeof body!=='object')return json(res,400,{error:'Invalid chat payload'});
      const all=loadChats(access.targetFile);
      const rawList=Array.isArray(body.history)?body.history:(Array.isArray(body.messages)?body.messages:[]);
      const history=rawList.slice(-100).map(m=>{
        if(!m||typeof m!=='object')return null;
        const role=m.role==='assistant'?'assistant':'user';
        const content=String(m.content||'').slice(0,20000);
        return {role,content};
      }).filter(Boolean);
      const rawMem=Array.isArray(body.aiMemory)?body.aiMemory:[];
      const aiMemory=rawMem.slice(-20).map(x=>typeof x==='string'?x.trim().slice(0,280):'').filter(Boolean);
      all[charName]={history,messages:history,aiMemory,lastUpdated:Number(body.lastUpdated)||Date.now()};
      safeWriteJson(access.targetFile,all);
      return json(res,200,{ok:true,name:charName,count:history.length,saved:history.length,memoryCount:aiMemory.length});
    }
    if(req.method==='DELETE'&&url.pathname.startsWith('/api/chats/')){
      const rawName=decodeURIComponent(url.pathname.slice('/api/chats/'.length)).trim();
      const charName=validateCharacterName(rawName);
      if(!charName)return json(res,400,{error:'Character name is invalid or required'});
      const access = validateSessionAccess(req);
      if(!access.ok)return json(res, access.status, {error: access.error});
      const all=loadChats(access.targetFile);
      if(Object.hasOwn(all, charName)){delete all[charName];safeWriteJson(access.targetFile,all);}
      return json(res,200,{ok:true,name:charName});
    }
    if(req.method==='POST'&&url.pathname==='/api/models'){
      let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      const resolved=resolveProviderRequest(req,body,{requireKey:true,missingKeyError:'No permitted API key is configured for this provider'});
      if(!resolved.ok)return json(res,resolved.status,resolved.error);
      const discovered=await discoverProviderModels({provider:body.provider,...resolved});
      if(!discovered.ok)return json(res,discovered.status||502,{error:discovered.error||'Could not load models from provider'});
      return json(res,200,{models:discovered.models});
    }
    if(req.method==='POST'&&url.pathname==='/api/test-connection'){
      let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      const resolved=resolveProviderRequest(req,body,{requireKey:true,missingKeyError:'No permitted API key is configured for this provider'});
      if(!resolved.ok)return json(res,resolved.status,{ok:false,...resolved.error});
      const started=Date.now();
      const model=String(body.model||'').trim().slice(0,150);
      const discovered=await discoverProviderModels({provider:body.provider,...resolved});
      if(discovered.ok){
        return json(res,200,{ok:true,mode:'models',latencyMs:Date.now()-started,models:discovered.models,modelCount:discovered.models.length,model:model||discovered.models[0]||''});
      }
      if(!model){
        return json(res,discovered.status||502,{ok:false,error:discovered.error||'Connection test failed'});
      }
      try{
        const endpoint=body.provider==='ollama'
          ? buildOllamaChatEndpoint(resolved.base)
          : normalizeProviderBase(resolved.base).toString().replace(/\/$/,'')+'/chat/completions';
        const headers={'content-type':'application/json'};
        if(resolved.effectiveKey)headers.authorization='Bearer '+resolved.effectiveKey;
        const testPayload=body.provider==='ollama'
          ? {model,messages:[{role:'user',content:'Reply with OK'}],max_tokens:8,temperature:0,stream:false,think:false,reasoning_effort:'none',options:{num_ctx:2048,num_predict:16}}
          : {model,messages:[{role:'user',content:'Reply with OK'}],max_tokens:8,temperature:0};
        const makeInit=()=>({method:'POST',headers,body:JSON.stringify(testPayload),signal:AbortSignal.timeout(body.provider==='ollama'?45000:15000),redirect:'error'});
        const upstream=body.provider==='ollama'?await fetchWithLocalhostFallback(endpoint,makeInit):await httpFetch(endpoint,makeInit());
        const data=await upstream.json().catch(()=>({}));
        if(!upstream.ok)return json(res,502,{ok:false,error:'Provider returned HTTP '+upstream.status});
        const raw=data&&data.choices&&data.choices[0]&&data.choices[0].message&&data.choices[0].message.content;
        if(typeof raw!=='string')return json(res,502,{ok:false,error:'Provider response format was not recognized'});
        return json(res,200,{ok:true,mode:'chat',latencyMs:Date.now()-started,models:[],modelCount:0,model});
      }catch(e){
        return json(res,502,{ok:false,error:e.name==='TimeoutError'?'Connection timed out':'Could not connect to provider'});
      }
    }
    async function handleSaveCharacter(targetId=''){
      if(configuredAuthToken && !isAuthorized(req))return json(res, 401, {error: 'Unauthorized: valid auth token required'});
      try{
        const c=await readJson(req, MAX_BODY);
        if(!c||typeof c.name!=='string'||!c.name.trim())return json(res,400,{error:'Character name is required'});
        const validName=validateCharacterName(c.name);
        if(!validName)return json(res,400,{error:'Invalid character name'});
        if(typeof c.imageDataUrl==='string'&&c.imageDataUrl.length>5*1024*1024)return json(res,413,{error:'Image is too large (5 MB max)'});
        if(typeof c.avatarDataUrl==='string'&&c.avatarDataUrl.length>5*1024*1024)return json(res,413,{error:'Avatar image is too large (5 MB max)'});
        let imageUrl='';
        if(c.imageDataUrl){
          const m=c.imageDataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
          if(!m)return json(res,400,{error:'Image must be PNG, JPEG, or WebP'});
          const bytes=Buffer.from(m[2],'base64');
          if(bytes.length>3*1024*1024)return json(res,413,{error:'Image is too large (3 MB decoded max)'});
          const ext=m[1]==='jpeg'?'jpg':m[1];
          if(!verifyImageMagicBytes(bytes, ext))return json(res, 400, {error:'Image content does not match declared image type (invalid magic bytes)'});
          const filename=crypto.randomBytes(16).toString('hex')+'.'+ext;
          fs.writeFileSync(path.join(uploadsDir,filename),bytes,{flag:'wx'});imageUrl='/uploads/'+filename;
        }
        let avatarUrl='';
        if(c.avatarDataUrl){
          const m=c.avatarDataUrl.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/);
          if(!m)return json(res,400,{error:'Avatar image must be PNG, JPEG, or WebP'});
          const bytes=Buffer.from(m[2],'base64');
          if(bytes.length>3*1024*1024)return json(res,413,{error:'Avatar image is too large (3 MB decoded max)'});
          const ext=m[1]==='jpeg'?'jpg':m[1];
          if(!verifyImageMagicBytes(bytes, ext))return json(res, 400, {error:'Avatar image content does not match declared image type (invalid magic bytes)'});
          const filename=crypto.randomBytes(16).toString('hex')+'.'+ext;
          fs.writeFileSync(path.join(uploadsDir,filename),bytes,{flag:'wx'});avatarUrl='/uploads/'+filename;
        }
        const resolvedId=targetId||(typeof c.id==='string'&&c.id.trim()?c.id.trim():crypto.randomUUID());
        const clean={id:resolvedId,name:c.name.trim().slice(0,80),role:String(c.role||'').slice(0,300),appearance:String(c.appearance||'').slice(0,1000),desc:String(c.desc||'').slice(0,1500),genre:Array.isArray(c.genre)?c.genre.filter(x=>typeof x==='string').slice(0,10):[],adult:c.adult===true,systemPrompt:String(c.systemPrompt||'').slice(0,10000),greeting:String(c.greeting||'').slice(0,3000),imageUrl:imageUrl||String(c.imageUrl||'').slice(0,500),avatarUrl:avatarUrl||String(c.avatarUrl||'').slice(0,500),updatedAt:new Date().toISOString()};
        const all=loadCharacters(charactersFile);
        const i=targetId
          ? all.findIndex(x=>x.id===targetId||x.name===targetId)
          : all.findIndex(x=>x.id===clean.id||x.name===clean.name);
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
          all[i]={...all[i],...clean,id:all[i].id||clean.id};
          safeWriteJson(charactersFile,all);return json(res,targetId?200:201,all[i]);
        }
        if(targetId)return json(res,404,{error:'Character not found'});
        all.unshift(clean);
        safeWriteJson(charactersFile,all);return json(res,201,clean);
      }catch(e){if(!res.headersSent)return json(res,e.status||400,{error:e.status===413?'Request too large':e.status===400?e.message:'Could not save character'});return}
    }
    if(req.method==='POST'&&url.pathname==='/api/characters'){
      return handleSaveCharacter();
    }
    if(req.method==='PUT'&&url.pathname.startsWith('/api/characters/')){
      const charId=decodeURIComponent(url.pathname.slice('/api/characters/'.length)).trim();
      if(!charId)return json(res,400,{error:'Character ID required'});
      return handleSaveCharacter(charId);
    }
    if(req.method==='POST'&&url.pathname==='/api/chat'){
      let body;try{body=await readJson(req, 1024 * 1024)}catch(e){return json(res,e.status||400,{error:e.status===413?'Request too large':'Invalid request'})}
      const resolved=resolveProviderRequest(req,body,{requireKey:true,missingKeyError:'AI provider not configured on the server.'});
      if(!resolved.ok)return json(res,resolved.status,resolved.error);
      if(!Array.isArray(body.messages)||body.messages.length>80||body.messages.some(m=>!m||!['system','user','assistant'].includes(m.role)||typeof m.content!=='string'||m.content.length>20000))return json(res,400,{error:'Invalid messages'});
      const model=String(body.model||'').trim().slice(0,150);if(!model)return json(res,400,{error:'Model is required'});
      const limits=options.contextLimits||{};
      const defaultMaxInput=Number(process.env.MAX_INPUT_TOKENS||1800);
      const clientRequestedTokens=Number(body.maxInputTokens);
      const maxInputTokens=limits.maxInputTokens!==undefined
        ? Number(limits.maxInputTokens)
        : (Number.isFinite(clientRequestedTokens)&&clientRequestedTokens>0?Math.max(400,Math.min(8000,clientRequestedTokens)):defaultMaxInput);
      const systemText=body.messages.filter(m=>m.role==='system').map(m=>m.content).filter(Boolean).join('\n\n');
      const historyTurns=body.messages.filter(m=>m.role!=='system');
      const compact=buildCompactContext({system:systemText,history:historyTurns,maxInputTokens,memoryChars:Number(limits.memoryChars||process.env.MEMORY_SUMMARY_CHARS||900)});
      const endpoint=body.provider==='ollama'
        ? buildOllamaChatEndpoint(resolved.base)
        : normalizeProviderBase(resolved.base).toString().replace(/\/$/,'')+'/chat/completions';
      const headers={'content-type':'application/json'};
      if(resolved.effectiveKey)headers.authorization='Bearer '+resolved.effectiveKey;
      const maxTokens=Math.max(64,Math.min(1200,Number(body.maxTokens||process.env.MAX_OUTPUT_TOKENS||300)));
      const temperature=Math.max(0,Math.min(2,Number(body.temperature??0.8)));
      const ollamaNumCtx=Math.min(8192,Math.max(2048,maxInputTokens*2));
      const upstreamPayload=body.provider==='ollama'
        ? {model,messages:compact.messages,temperature,max_tokens:maxTokens,stream:false,think:false,reasoning_effort:'none',options:{num_ctx:ollamaNumCtx,num_predict:maxTokens,temperature}}
        : {model,messages:compact.messages,temperature,max_tokens:maxTokens};
      const timeoutMs=body.provider==='ollama'?180000:60000;
      try{
        const makeInit=(payloadObj=upstreamPayload)=>({method:'POST',headers,body:JSON.stringify(payloadObj),signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
        let upstream=body.provider==='ollama'?await fetchWithLocalhostFallback(endpoint,()=>makeInit()):await httpFetch(endpoint,makeInit());
        if(body.provider==='ollama'&&upstream.status===404){
          const nativeEndpoint=`${normalizeProviderBase(resolved.base).origin}/api/chat`;
          upstream=await fetchWithLocalhostFallback(nativeEndpoint,()=>makeInit({model,messages:compact.messages,stream:false,think:false,options:{num_ctx:ollamaNumCtx,num_predict:maxTokens,temperature}}));
        }
        const data=await upstream.json().catch(()=>({}));if(!upstream.ok)return json(res,502,{error:'Provider request failed ('+upstream.status+'). Check server logs/provider settings.'});
        const choice=data&&data.choices&&data.choices[0];
        const rawMsg=(choice&&choice.message)||(data&&data.message)||null;
        let raw=rawMsg&&typeof rawMsg.content==='string'?rawMsg.content:null;
        if(typeof raw!=='string')return json(res,502,{error:'Provider response format was not recognized'});
        if(body.provider==='ollama'||/<think\b/i.test(raw))raw=stripThinkingTags(raw);
        if(!raw.trim())return json(res,502,{error:'Model returned an empty response. Try increasing max reply tokens or testing connection.'});
        const finishReason=(choice&&choice.finish_reason)||(data&&data.done_reason)||'';
        const text=finishReason==='length'?trimToCompleteSentence(raw):raw;
        return json(res,200,{text});
      }catch(e){console.error('AI upstream error:',e.name);return json(res,502,{error:e.name==='TimeoutError'?'Provider timed out':'Could not connect to provider'});}
    }
    if(req.method==='GET'&&url.pathname.startsWith('/uploads/')){
      const name=path.basename(url.pathname);if(!/^[a-f0-9]{32}\.(png|jpg|webp)$/.test(name))return json(res,404,{error:'Not found'});
      const file=path.join(uploadsDir,name);try{const stat=fs.statSync(file);res.writeHead(200,{'content-type':MIME[path.extname(file)],'content-length':stat.size,'cache-control':'public, max-age=31536000, immutable','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'referrer-policy':'no-referrer'});return fs.createReadStream(file).pipe(res)}catch{return json(res,404,{error:'Not found'})}
    }
    if(req.method==='GET'&&(url.pathname.startsWith('/css/')||url.pathname.startsWith('/js/')||url.pathname.startsWith('/locales/'))){
      let relPath='';
      try{relPath=decodeURIComponent(url.pathname).replace(/^\/+/,'')}catch{return json(res,400,{error:'Bad path'})}
      const target=path.resolve(publicDir,relPath);
      if(!target.startsWith(publicDir+path.sep))return json(res,403,{error:'Forbidden'});
      try{
        const stat=fs.statSync(target);
        if(!stat.isFile())return json(res,404,{error:'Not found'});
        const ctype=MIME[path.extname(target)]||'application/octet-stream';
        res.writeHead(200,{'content-type':ctype,'content-length':stat.size,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
        return fs.createReadStream(target).pipe(res);
      }catch{return json(res,404,{error:'Not found'})}
    }
    if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html')){
      const file=path.join(publicDir,'index.html');try{const stat=fs.statSync(file);res.writeHead(200,{'content-type':MIME['.html'],'content-length':stat.size,'cache-control':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'SAMEORIGIN','content-security-policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' https: http:; media-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self';"});return fs.createReadStream(file).pipe(res)}catch{return json(res,500,{error:'UI file missing'})}
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
