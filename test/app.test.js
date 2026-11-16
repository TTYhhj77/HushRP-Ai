const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');
const { readFrontendBundle } = require('./helpers');

async function withServer(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hushrp-'));
  const app = createServer({ dataDir: dir, apiKey: '' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try { await fn(base, dir); } finally { await new Promise(resolve => app.server.close(resolve)); fs.rmSync(dir, {recursive:true,force:true}); }
}

test('serves prototype and keeps API key out of static page', async () => {
  await withServer(async base => {
    const r = await fetch(base + '/'); const body = await r.text();
    assert.equal(r.status, 200); assert.match(body,/id="view-chat"/); assert.match(body,/toggleSound/); assert.match(body,/chatBackground/); assert.match(body,/characterImage/); assert.doesNotMatch(body,/แนบไฟล์/); assert.doesNotMatch(body, /data-api-key/i);
  });
});

test('characters persist locally and reject oversized image payloads', async () => {
  await withServer(async (base, dir) => {
    const payload = { name:'Mira', role:'นักเดินทาง', appearance:'ผมดำ', desc:'ใจเย็น', genre:['แฟนตาซี'], adult:true, systemPrompt:'รักษาบุคลิก', greeting:'สวัสดี', imageDataUrl:'' };
    let r = await fetch(base + '/api/characters', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(r.status, 201); const saved = await r.json(); assert.equal(saved.name,'Mira');
    r = await fetch(base + '/api/characters'); assert.equal((await r.json()).length,1);
    assert.ok(fs.existsSync(path.join(dir,'characters.json')));
    const big = {...payload,name:'Huge',imageDataUrl:'data:image/png;base64,'+'A'.repeat(5.1*1024*1024|0)};
    r = await fetch(base + '/api/characters', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(big)});
    assert.equal(r.status,413);
  });
});

test('deleting character removes from list and cleans up upload file', async () => {
  await withServer(async (base, dir) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const payload = { name:'DelMe', role:'ทดสอบ', appearance:'', desc:'', genre:[], adult:false, systemPrompt:'', greeting:'hi', imageDataUrl:png };
    const r1 = await fetch(base + '/api/characters', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(r1.status, 201);
    const created = await r1.json();
    assert.ok(created.id);
    const imgName = path.basename(created.imageUrl);
    const uploadPath = path.join(dir, 'uploads', imgName);
    assert.ok(fs.existsSync(uploadPath));
    const r2 = await fetch(base + '/api/characters/' + created.id, {method:'DELETE'});
    assert.equal(r2.status, 200);
    const list = await (await fetch(base + '/api/characters')).json();
    assert.equal(list.length, 0);
    assert.equal(fs.existsSync(uploadPath), false);
  });
});

test('handles character cover avatar alongside background image and cleans both on delete', async () => {
  await withServer(async (base, dir) => {
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const payload = { name:'DualImg', role:'ผู้ทดสอบ', appearance:'', desc:'', genre:[], adult:false, systemPrompt:'', greeting:'hi', imageDataUrl:png, avatarDataUrl:png };
    const r1 = await fetch(base + '/api/characters', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    assert.equal(r1.status, 201);
    const created = await r1.json();
    assert.ok(created.imageUrl.startsWith('/uploads/'));
    assert.ok(created.avatarUrl.startsWith('/uploads/'));
    const imgName = path.basename(created.imageUrl);
    const avName = path.basename(created.avatarUrl);
    assert.ok(fs.existsSync(path.join(dir, 'uploads', imgName)));
    assert.ok(fs.existsSync(path.join(dir, 'uploads', avName)));
    const r2 = await fetch(base + '/api/characters/' + created.id, {method:'DELETE'});
    assert.equal(r2.status, 200);
    assert.equal(fs.existsSync(path.join(dir, 'uploads', imgName)), false);
    assert.equal(fs.existsSync(path.join(dir, 'uploads', avName)), false);
  });
});

test('chat context optimizer caps payload and output token budget',async()=>{
  let sent=null;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-context-http-'));const app=createServer({dataDir:dir,apiKey:'test-key',contextLimits:{maxInputTokens:120,memoryChars:120},fetch:async(url,init)=>{sent=JSON.parse(init.body);return{ok:true,json:async()=>({choices:[{message:{content:'*พยักหน้า* “ได้”'}}]})}}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
  const msgs=[{role:'system',content:'World rules and * means narration.'},...Array.from({length:20},(_,i)=>({role:i%2?'assistant':'user',content:`Long turn ${i} ${'detail '.repeat(20)}`})),{role:'user',content:'latest'}];
  try{const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai',baseUrl:'https://api.openai.com/v1',model:'m',messages:msgs})});assert.equal(r.status,200);assert.ok(sent.messages.length<msgs.length);assert.ok(sent.max_tokens<=500);assert.match(sent.messages[0].content,/\* means narration/)}finally{await new Promise(resolve=>app.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});

test('loads model names via adapter and passes server key privately',async()=>{
  let receivedKey='';const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-models-'));const app=createServer({dataDir:dir,apiKey:'server-secret',providerAdapters:{openai:{listModels:async({apiKey})=>{receivedKey=apiKey;return ['model-a','model-b']}}}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{const r=await fetch(base+'/api/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai',baseUrl:'https://api.openai.com/v1'})});assert.equal(r.status,200);assert.deepEqual((await r.json()).models,['model-a','model-b']);assert.equal(receivedKey,'server-secret')}finally{await new Promise(resolve=>app.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});

test('browser key setting never discloses key and remains disabled in VPS runtime',async()=>{
  const make=async runtimeMode=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-keymode-'));const app=createServer({dataDir:dir,apiKey:'',allowClientKeys:true,runtimeMode});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return {dir,app,base:`http://127.0.0.1:${app.server.address().port}`}};
  const local=await make('local'),lan=await make('lan'),vps=await make('vps');
  try{const l=await(await fetch(local.base+'/api/status')).json(),n=await(await fetch(lan.base+'/api/status')).json(),v=await(await fetch(vps.base+'/api/status')).json();assert.equal(l.allowClientKeys,true);assert.equal(n.allowClientKeys,true);assert.equal(v.allowClientKeys,false);assert.equal(v.runtimeMode,'vps');for(const state of [l,n,v])assert.equal(JSON.stringify(state).includes('secret'),false)}finally{for(const x of [local,lan,vps]){await new Promise(resolve=>x.app.server.close(resolve));fs.rmSync(x.dir,{recursive:true,force:true})}}
});

test('model listing rejects browser key when client key mode is disabled',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-model-key-'));const app=createServer({dataDir:dir,apiKey:'server-key',allowClientKeys:false});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{const r=await fetch(base+'/api/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai',baseUrl:'https://api.openai.com/v1',apiKey:'client-secret'})});assert.equal(r.status,403);assert.equal(JSON.stringify(await r.json()).includes('client-secret'),false)}finally{await new Promise(resolve=>app.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});

test('browser keys are gated locally and always disabled for VPS',async()=>{
  const make=async runtimeMode=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-keymode-'));const app=createServer({dataDir:dir,apiKey:'',allowClientKeys:true,runtimeMode});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));return{dir,app,base:`http://127.0.0.1:${app.server.address().port}`}};
  const local=await make('local'),lan=await make('lan'),vps=await make('vps');
  try{const l=await(await fetch(local.base+'/api/status')).json(),n=await(await fetch(lan.base+'/api/status')).json(),v=await(await fetch(vps.base+'/api/status')).json();assert.equal(l.allowClientKeys,true);assert.equal(n.allowClientKeys,true);assert.equal(v.allowClientKeys,false);assert.equal(v.runtimeMode,'vps');for(const state of [l,n,v])assert.equal(JSON.stringify(state).includes('secret'),false)}finally{for(const x of [local,lan,vps]){await new Promise(resolve=>x.app.server.close(resolve));fs.rmSync(x.dir,{recursive:true,force:true})}}
});

test('browser keys cannot be used for custom provider URLs',async()=>{
  await withServer(async base=>{const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai-compatible',baseUrl:'https://malicious.example/v1',model:'x',apiKey:'client-secret',messages:[{role:'user',content:'x'}]})});assert.equal(r.status,403)},{apiKey:'server-key',allowClientKeys:true});
});

test('browser API key is rejected when server switch is off',async()=>{
  await withServer(async base=>{const r=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai',baseUrl:'https://api.openai.com/v1',model:'x',apiKey:'client-secret',messages:[{role:'user',content:'x'}]})});assert.equal(r.status,403);assert.equal(JSON.stringify(await r.json()).includes('client-secret'),false)},{apiKey:'server-key',allowClientKeys:false});
});

test('model-list endpoint rejects browser API key when disabled',async()=>{
  await withServer(async base=>{const r=await fetch(base+'/api/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai',baseUrl:'https://api.openai.com/v1',apiKey:'client-secret'})});assert.equal(r.status,403);assert.equal(JSON.stringify(await r.json()).includes('client-secret'),false)},{apiKey:'server-key',allowClientKeys:false});
});


test('chat endpoint returns configuration error without leaking server key', async () => {
  await withServer(async base => {
    const r = await fetch(base + '/api/chat', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai',baseUrl:'https://api.openai.com/v1',model:'test',messages:[{role:'user',content:'hello'}]})});
    assert.equal(r.status,503); const body = await r.json(); assert.match(body.error,/not configured/i); assert.doesNotMatch(JSON.stringify(body),/sk-[a-z0-9]+|secret/i);
  });
});

test('custom provider host matching normalizes Base URL to its hostname',()=>{
  const {isAllowedCustomProviderUrl}=require('../server');
  assert.equal(isAllowedCustomProviderUrl('https://api.xkiro.com/v1',['https://api.xkiro.com/v1']),true);
  assert.equal(isAllowedCustomProviderUrl('https://api.xkiro.com/v1',['api.xkiro.com']),true);
  assert.equal(isAllowedCustomProviderUrl('https://api.xkiro.com/v1',[]),false);
});

test('custom model and chat endpoints accept the same allow-listed host with server key',async()=>{
  let adapterCalled=false,fetchCalled=false;
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-custom-host-'));
  const app=createServer({dataDir:dir,apiKey:'test-server-key',customEndpointHosts:['https://api.xkiro.com/v1'],providerAdapters:{'openai-compatible':{listModels:async()=>{adapterCalled=true;return ['sample-model']}}},fetch:async()=>{fetchCalled=true;return new Response(JSON.stringify({choices:[{message:{content:'ok'}}]}),{status:200,headers:{'content-type':'application/json'}})}});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${app.server.address().port}`;
  try{
    const models=await fetch(base+'/api/models',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai-compatible',baseUrl:'https://api.xkiro.com/v1'})});
    assert.equal(models.status,200);assert.deepEqual((await models.json()).models,['sample-model']);assert.equal(adapterCalled,true);
    const chat=await fetch(base+'/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({provider:'openai-compatible',baseUrl:'https://api.xkiro.com/v1',model:'sample-model',messages:[{role:'user',content:'hello'}]})});
    assert.equal(chat.status,200);assert.equal((await chat.json()).text,'ok');assert.equal(fetchCalled,true);
  }finally{await new Promise(resolve=>app.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
});

test('reports server-side AI key status without disclosing key value', async () => {
  await withServer(async base => {
    const status=await(await fetch(base+'/api/status')).json();assert.equal(status.aiConfigured,false);assert.equal(status.allowClientKeys,false);assert.equal(status.runtimeMode,'local');assert.equal(JSON.stringify(status).includes('server-secret'),false);
  });
});

test('loads local dotenv values and preserves pre-existing environment values', async () => {
  const {loadDotEnv}=require('../server');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'hush-env-'));const file=path.join(dir,'.env-test');
  const key='HUSHRP_TEST_'+Date.now();fs.writeFileSync(file,`${key}=from-file\n`);delete process.env[key];loadDotEnv(file);assert.equal(process.env[key],'from-file');process.env[key]='already-set';loadDotEnv(file);assert.equal(process.env[key],'already-set');delete process.env[key];fs.rmSync(dir,{recursive:true,force:true});
});

test('LAN-only mode accepts home/private client addresses but rejects public addresses', () => {
  const {isPrivateLanAddress}=require('../server');
  for(const ip of ['127.0.0.1','::1','192.168.1.20','10.2.3.4','172.20.1.2','169.254.5.2','fc00::123'])assert.equal(isPrivateLanAddress(ip),true,ip);
  for(const ip of ['8.8.8.8','1.1.1.1','172.32.0.1','2001:4860:4860::8888'])assert.equal(isPrivateLanAddress(ip),false,ip);
});

test('Windows launcher exposes local, home-LAN and VPS modes', () => {
  const launcher=fs.readFileSync(path.join(__dirname,'..','start.cmd'),'utf8');
  assert.match(launcher,/RUNTIME_MODE=vps/); assert.match(launcher,/RUNTIME_MODE=lan/); assert.match(launcher,/RUNTIME_MODE=local/);
  assert.match(launcher,/HOST=0.0.0.0/);assert.match(launcher,/LAN_ONLY=true/);assert.match(launcher,/HUSHRP_PORT/);assert.match(launcher,/firewall-private-lan/);assert.match(launcher,/Private networks/);assert.match(launcher,/listPrivateIPv4/);
  const lan=launcher.substring(launcher.indexOf(':lan'),launcher.indexOf(':vps'));
  assert.match(lan,/set "HOST=0\.0\.0\.0"/);assert.match(lan,/set "PORT=%HUSHRP_PORT%"/);assert.match(lan,/node server\.js/);
});

test('Linux launcher offers local, home-LAN and VPS modes with shell-safe config bootstrap',()=>{
  const launcher=fs.readFileSync(path.join(__dirname,'..','install-linux.sh'),'utf8');
  assert.match(launcher,/127\.0\.0\.1/); assert.match(launcher,/0\.0\.0\.0/); assert.match(launcher,/run_server 127\.0\.0\.1 false/); assert.match(launcher,/run_server 0\.0\.0\.0 true/); assert.match(launcher,/LAN_ONLY=/); assert.match(launcher,/\.env\.example/); assert.match(launcher,/node server\.js/); assert.match(launcher,/listPrivateIPv4/);
});

test('container recipe preserves data and defaults to loopback-only access',()=>{
  const compose=fs.readFileSync(path.join(__dirname,'..','compose.yaml'),'utf8');
  const dockerfile=fs.readFileSync(path.join(__dirname,'..','Dockerfile'),'utf8');
  assert.match(compose,/BIND_ADDRESS:-127\.0\.0\.1/); assert.match(compose,/PORT:-3000/); assert.match(compose,/\.\/data:\/app\/data/); assert.match(compose,/LAN_ONLY:-false/);
  assert.match(dockerfile,/USER node/); assert.match(dockerfile,/CMD \["node","server\.js"\]/);
});

test('Linux launcher passes shell syntax validation', t => {
  const {spawnSync, execFileSync}=require('node:child_process');
  const check = spawnSync('bash', ['--version'], { encoding: 'utf8' });
  if (check.error || check.status !== 0) {
    t.skip('bash is not available in test environment');
    return;
  }
  execFileSync('bash',['-n',path.join(__dirname,'..','install-linux.sh')]);
});

test('compose config parses with Docker compose when installed',t=>{
  const {spawnSync,execFileSync}=require('node:child_process');const check=spawnSync('docker',['compose','version'],{encoding:'utf8'});
  if(check.status!==0){t.skip('Docker Compose not installed in test environment');return;}
  execFileSync('docker',['compose','-f',path.join(__dirname,'..','compose.yaml'),'config','--quiet']);
});

test('custom provider panel provides saved-entry actions and server allow-list guidance',()=>{
  const html=readFrontendBundle();
  assert.doesNotMatch(html,/customProviderPanel|id="customProviderList"/);assert.match(html,/OpenAI compatible \/ Custom/);
  assert.match(html,/server does not allow|server allow-list|ไม่อนุญาต host|allowlist/i);
});

test('mobile sidebar has a visible toggle control and hides drawer by default',()=>{
  const html=readFrontendBundle();
  assert.match(html,/id="mobileMenuToggle"/);assert.match(html,/id="mobileNavOverlay"/);
  assert.match(html,/aria-controls="mobileNavDrawer"/);assert.match(html,/aria-expanded="false"/);
});

test('mobile settings controls fit small screens without fixed widths',()=>{
  const html=readFrontendBundle();
  assert.match(html,/\.settings-row\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.match(html,/\.provider-select\{width:100%;max-width:100%;min-width:0\}/);
  assert.match(html,/\.main\{padding-bottom:calc\(72px \+ env\(safe-area-inset-bottom\)\)\}/);
});

test('phone-width media query keeps two card columns and usable bottom navigation',()=>{
  const html=readFrontendBundle();
  const phone=html.match(/@media\(max-width:370px\)\{([^{}]+(?:\{[^{}]*\}[^{}]*)*)\}/)?.[0]||'';
  assert.match(html,/\.cards\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.doesNotMatch(html,/\.cards\{grid-template-columns:1fr\}/);
  assert.match(html,/\.nav-item\{min-width:48px/);
});

test('prototype keeps image upload in character editor and text-only compose',async()=>{
  await withServer(async base=>{
    const body=await(await fetch(base+'/')).text();
    assert.match(body,/id="characterImage"/);assert.match(body,/id="chatBackground"/);
    const chatStart=body.indexOf('<section class="view" id="view-chat">');const composeStart=body.indexOf('class="chat-compose"',chatStart);const createStart=body.indexOf('<section class="view" id="view-create">',chatStart);
    const compose=body.slice(composeStart,createStart);assert.ok(composeStart>chatStart&&createStart>composeStart);assert.doesNotMatch(compose,/type="file"|accept="image\//);
  });
});

test('settings panel has deduplicated controls and token budget presets', () => {
  const html = readFrontendBundle();
  const tokenBudgetMatches = html.match(/id="tokenBudget"/g) || [];
  const maxReplyMatches = html.match(/id="maxReplyTokens"/g) || [];
  assert.equal(tokenBudgetMatches.length, 1, 'id="tokenBudget" must be unique in DOM');
  assert.equal(maxReplyMatches.length, 1, 'id="maxReplyTokens" must be unique in DOM');
  assert.match(html, /setBudgetPreset/);
  assert.match(html, /preset-chips/);
});

test('character studio provides both cover image and background image inputs', () => {
  const html = readFrontendBundle();
  assert.match(html, /id="charCoverImage"/);
  assert.match(html, /id="characterImage"/);
  assert.match(html, /previewCoverImage/);
  assert.match(html, /previewCharacterImage/);
});

test('chat session isolation and smooth glide animation are configured', () => {
  const html = readFrontendBundle();
  assert.match(html, /sessionChatStores/);
  assert.match(html, /chat-glide-in/);
  assert.match(html, /messages\.switching/);
});

test('serverApiKey can be saved and cleared from settings API without exposing raw secret', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-webkey-'));
  const app = createServer({ dataDir: dir, apiKey: '' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const rawSecret = 'sk-proj-supersecret9876';
    const putRes = await fetch(base + '/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serverApiKey: rawSecret })
    });
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(JSON.stringify(putData).includes(rawSecret), false);
    assert.equal(putData.serverKeyMasked, 'sk-••••9876');

    const getSettings = await (await fetch(base + '/api/settings')).json();
    assert.equal(JSON.stringify(getSettings).includes(rawSecret), false);
    assert.equal(getSettings.serverKeyMasked, 'sk-••••9876');

    const status = await (await fetch(base + '/api/status')).json();
    assert.equal(status.aiConfigured, true);
    assert.equal(status.serverKeyMasked, 'sk-••••9876');
    assert.equal(JSON.stringify(status).includes(rawSecret), false);

    const clearRes = await fetch(base + '/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serverApiKey: '' })
    });
    assert.equal(clearRes.status, 200);
    const statusAfter = await (await fetch(base + '/api/status')).json();
    assert.equal(statusAfter.aiConfigured, false);
    assert.equal(statusAfter.serverKeyMasked, '');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('VPS without authToken blocks modifying serverApiKey from Web UI', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-vps-webkey-'));
  const app = createServer({ dataDir: dir, apiKey: '', runtimeMode: 'vps' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const r = await fetch(base + '/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ serverApiKey: 'sk-attempted-overwrite' })
    });
    assert.equal(r.status, 403);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Ollama supports both /v1/models and /api/tags fallback, disables thinking mode, strips think tags, ignores browser keys, and falls back to native /api/chat', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-ollama-'));
  const seen = [];
  let force404OnV1 = false;
  const fakeFetch = async (url, init) => {
    seen.push({ url, headers: init?.headers || {}, body: init?.body ? JSON.parse(init.body) : null });
    if (url === 'http://192.168.1.55:11434/v1/models') {
      return new Response('not found', { status: 404 });
    }
    if (url === 'http://192.168.1.55:11434/api/tags') {
      return new Response(JSON.stringify({ models: [{ name: 'qwen2.5:7b' }] }), { status: 200 });
    }
    if (url === 'http://192.168.1.55:11434/v1/chat/completions') {
      if (force404OnV1) return new Response('not found', { status: 404 });
      return new Response(JSON.stringify({ choices: [{ message: { content: '<think>planning silently</think>\nสวัสดีจาก Ollama' }, finish_reason: 'stop' }] }), { status: 200 });
    }
    if (url === 'http://192.168.1.55:11434/api/chat') {
      return new Response(JSON.stringify({ message: { role: 'assistant', content: 'ตอบผ่าน native Ollama' }, done_reason: 'stop' }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  };
  const app = createServer({ dataDir: dir, apiKey: '', runtimeMode: 'lan', fetch: fakeFetch });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const mRes = await fetch(base + '/api/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'ollama', baseUrl: 'http://192.168.1.55:11434/v1' })
    });
    assert.equal(mRes.status, 200);
    assert.deepEqual((await mRes.json()).models, ['qwen2.5:7b']);

    const cRes = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'ollama',
        baseUrl: 'http://192.168.1.55:11434/v1',
        model: 'qwen2.5:7b',
        apiKey: 'stray-browser-key',
        maxInputTokens: 2400,
        messages: [{ role: 'user', content: 'ทักทาย' }]
      })
    });
    assert.equal(cRes.status, 200);
    assert.equal((await cRes.json()).text, 'สวัสดีจาก Ollama');

    const chatCall = seen.find(x => x.url.endsWith('/v1/chat/completions'));
    assert.ok(chatCall);
    assert.equal(chatCall.headers.authorization, undefined);
    assert.equal(chatCall.body.think, false);
    assert.equal(chatCall.body.reasoning_effort, 'none');
    assert.equal(chatCall.body.stream, false);
    assert.ok(chatCall.body.options && chatCall.body.options.num_ctx >= 2048);

    force404OnV1 = true;
    const nativeRes = await fetch(base + '/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'ollama',
        baseUrl: 'http://192.168.1.55:11434/v1',
        model: 'qwen2.5:7b',
        messages: [{ role: 'user', content: 'ทดสอบ native' }]
      })
    });
    assert.equal(nativeRes.status, 200);
    assert.equal((await nativeRes.json()).text, 'ตอบผ่าน native Ollama');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('POST /api/test-connection checks provider discovery and reports latency', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-testconn-'));
  const fakeFetch = async url => {
    assert.equal(url, 'https://api.openai.com/v1/models');
    return new Response(JSON.stringify({ data: [{ id: 'gpt-4o-mini' }] }), { status: 200 });
  };
  const app = createServer({ dataDir: dir, apiKey: 'sk-test-key', fetch: fakeFetch });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const r = await fetch(base + '/api/test-connection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' })
    });
    assert.equal(r.status, 200);
    const data = await r.json();
    assert.equal(data.ok, true);
    assert.equal(data.mode, 'models');
    assert.equal(data.modelCount, 1);
    assert.equal(typeof data.latencyMs, 'number');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('serves static frontend assets from public/ and blocks path traversal', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-static-'));
  const app = createServer({ dataDir: dir });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    for (const [assetPath, expectedType] of [
      ['/css/styles.css', 'text/css'],
      ['/js/app.js', 'text/javascript'],
      ['/locales/th.js', 'text/javascript']
    ]) {
      const r = await fetch(base + assetPath);
      assert.equal(r.status, 200, `${assetPath} should return 200`);
      assert.ok((r.headers.get('content-type') || '').includes(expectedType));
    }
    const trav = await fetch(base + '/js/%2e%2e/%2e%2e/server.js');
    assert.ok([403, 404].includes(trav.status));
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('PUT /api/characters/:id updates saved characters and frontend includes greeting & preserves chat history', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hush-edit-char-'));
  const app = createServer({ dataDir: dir });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const createRes = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Kael', role: 'Wizard', desc: 'Original', greeting: 'Welcome!' })
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();

    const updateRes = await fetch(base + '/api/characters/' + encodeURIComponent(created.id), {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Kael', role: 'Archmage', desc: 'Updated desc', greeting: 'Welcome back!' })
    });
    assert.equal(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.equal(updated.role, 'Archmage');
    assert.equal(updated.desc, 'Updated desc');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }

  const bundle = readFrontendBundle();
  assert.match(bundle, /character\.greeting\s*\?/);
  assert.doesNotMatch(bundle, /history\.splice\(0,\s*history\.length,\s*\.\.\.compactNow\)/);
  assert.match(bundle, /saveServerKeyFromUi/);
  assert.match(bundle, /testAiConnection/);
  assert.match(bundle, /selectProviderPreset/);
  assert.match(bundle, /saveCharacterDraft/);
  assert.match(bundle, /editCharacter/);
});


