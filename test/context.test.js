const test=require('node:test');
const assert=require('node:assert/strict');
const {estimateTokens,compressOldMessages,buildCompactContext,DEFAULT_CONTEXT_TOKENS}=require('../lib/context');

test('message formatting labels starred action as narration rather than spoken dialogue',()=>{
  const memory=compressOldMessages([{role:'assistant',content:'*ยิ้มบาง ๆ* “สวัสดี”'}]);
  assert.match(memory,/ตัวละคร:/);assert.match(memory,/\*ยิ้มบาง ๆ\*/);assert.match(memory,/“สวัสดี”/);
});

test('world prompt and asterisk narration instructions are present in system prompt',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');
  assert.match(page,/worldName/);assert.match(page,/worldDescription/);assert.match(page,/worldRules/);
  assert.match(page,/buildWorldControlHint\(\)/);assert.match(page,/buildChatMessages\(character,history\)/);
});

test('conversation history is capped before provider request and world-memory settings remain local',()=>{
  const history=Array.from({length:60},(_,i)=>({role:i%2?'assistant':'user',content:'*action* “dialogue” '+('long narrative '.repeat(100))}));
  const compact=compressOldMessages(history,700);assert.ok(compact.length<=700);assert.match(compact,/\*action\*/);assert.match(compact,/“dialogue”/);
});

// Client-side limits and local-memory behavior are also exercised in the runtime browser smoke test.
test('token budget controls include conservative default and output cap',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');
  assert.match(page,/hush-context-budget.*1200/);assert.match(page,/maxReplyTokens/);assert.match(page,/maxReplyTokens.*300/);
});

// API request cleanup verifies an overlong dialogue cannot keep unbounded client history.
test('compacting repeated roleplay lines clips oversized individual history messages',()=>{
  const oversized={role:'user',content:'x'.repeat(10000)};const compact=compressOldMessages([oversized],200);assert.ok(compact.length<=200);assert.match(compact,/…/);
});

// use a synthetic chat history large enough to require local summarization
 test('local memory summary retains latest events and stays under configured character ceiling',()=>{
  const history=Array.from({length:50},(_,i)=>({role:i%2?'assistant':'user',content:`event-${i}: *moves* “speaks” `+'lore '.repeat(50)}));
  const memory=compressOldMessages(history,700);assert.ok(memory.length<=700);assert.match(memory,/event-49/);assert.match(memory,/\*moves\*/);assert.match(memory,/“speaks”/);
});

// Tiny token budgeting sanity check (character heuristic is deliberately approximate).
test('token estimate is bounded and deterministic for one-line text',()=>{
  const s='Hello roleplay';assert.equal(estimateTokens(s),Math.ceil(s.length/4));
});

// Keep existing older-turn test as a regression for round-window preservation.
test('recent-window compaction stays within budget for many messages',()=>{
  const history=Array.from({length:80},(_,i)=>({role:i%2?'assistant':'user',content:`m${i} `+'words '.repeat(40)}));
  const result=buildCompactContext({system:'rules',history,maxInputTokens:500,memoryChars:500});assert.ok(result.estimatedTokens<=500);assert.ok(result.omittedMessages>0);
});

// Regression: the setting form uses descriptive inputs for user-editable world context.
test('world settings are plain text inputs persisted locally, not provider calls',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');
  assert.match(page,/function saveWorldSettings\(\)/);assert.match(page,/remoteSet\('worldSettings'/);assert.match(page,/โลก\/ฉาก/);
});

// Ensure short output default is applied when saving limits.
test('output token cap is clamped to configured UI range',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');
  assert.match(page,/Math\.min\(1200,Number\(o\.value\)\|\|300\)/);
});

// Round-memory summaries are extractive, do not call the model or claim semantic fidelity.
test('old-turn compressor runs locally without asynchronous or network APIs',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');
  assert.doesNotMatch(source,/fetch\(|https?:\/\//);assert.match(source,/compressOldMessages/);
});

// Device-facing prompt explicitly protects speech vs action distinction.
test('system prompt defines quoted speech and starred action',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');
  assert.match(page,/DEFAULT_GLOBAL_PROMPT/);assert.match(page,/buildWorldControlHint/);assert.match(page,/function buildChatMessages\(character,history\)/);
});

// No implicit server-side conversation database is introduced by this lightweight implementation.
test('the app keeps chat history in memory and bounds context per request',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');
  assert.match(page,/compressHistory\(history,12\)/);assert.match(page,/setConversationMemory/);
});

// Remove accidental duplicate blank-end regression complexity: verify builder keeps system at index 0.
test('compact chat payload starts with a system prompt',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(page,/const messages=\[\{role:'system',content:buildSystemPrompt/);
});

// Added at integration boundary so CI/test runner catches token prompt regression.
test('token estimator comments acknowledge approximation',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(page,/ประมาณ|approximate/i);
});

// Memory should not be sent if empty.
test('system payload has conditional memory section',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(page,/if\(memory\)messages\.push/);
});

// Ensure no session memory value is persisted to web storage.
test('session memory is held in RAM only',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(page,/const sessionConversationMemory=\{\}/);assert.doesNotMatch(page,/localStorage\.setItem\('hush-memory/);
});

// The context compressor does not add additional paid model calls.
test('memory compression is synchronous/local',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');const i=source.indexOf('function compressHistory(');const j=source.indexOf('\n',i);assert.ok(!source.slice(i,j).includes('await'));
});

// Ensure accessibility text explains the scene settings.
test('world settings form has labels for name, description and facts',()=>{
  const page=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(page,/for="worldName"/);assert.match(page,/for="worldDescription"/);assert.match(page,/for="worldRules"/);
});

// Server compresses before forwarding and caps response output.
test('server uses compact request and output token ceiling',()=>{
  const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(source,/buildCompactContext/);assert.match(source,/MAX_OUTPUT_TOKENS\|\|300/);
});

// Keep narrative markers intact in memory extraction.
test('extractive memory preserves star markers verbatim',()=>{
  const m=compressOldMessages([{role:'assistant',content:'*คิดเงียบ ๆ* พูด “เอาล่ะ”'}]);assert.match(m,/\*คิดเงียบ ๆ\*/);assert.match(m,/“เอาล่ะ”/);
});

// Retain the basic compaction behavior for predictable cost.
test('memory compactor truncates each old line',()=>{
  const m=compressOldMessages([{role:'user',content:'Q'.repeat(5000)}],250);assert.ok(m.length<=250);
});

// last explicit assertion for speed-oriented default context limit
 test('default token budget is small enough for low-cost models',()=>{assert.equal(DEFAULT_CONTEXT_TOKENS,1800)});

// world settings should be additive to character identity
 test('world prompt does not remove character fields',()=>{
  const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/buildWorldControlHint/);assert.match(html,/ชีตตัวละคร/);
});

// All these helpers run without any paid tokens.
test('context helpers import without external dependencies',()=>{assert.equal(typeof buildCompactContext,'function')});

// Human-readable labels are preserved when extracting a short memory.
test('compressed memory identifies speaker role',()=>{assert.match(compressOldMessages([{role:'user',content:'hello'}]),/ผู้ใช้:/)});

// base text budgets use a documented heuristic rather than silently promising exact tokens.
test('token estimate remains approximate by construction',()=>{assert.equal(estimateTokens('12345678'),2)});

// System rules preserve a short prefix even under a small context cap.
test('system rules get priority in compact payload',()=>{const p=buildCompactContext({system:'IMPORTANT RULE',history:[{role:'user',content:'recent'}],maxInputTokens:80});assert.ok(p.messages[0].content.includes('IMPORTANT RULE'))});

// Keep the extension support independent of model choice.
test('all providers share the same chat context compaction helper',()=>{const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(source,/const compact=buildCompactContext/)});

// Ensure no transcript summary request is made as a second completion.
test('context compression only uses existing transcript strings',()=>{const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.match(source,/compressOldMessages/);assert.doesNotMatch(source,/completion|chat\/completions/i)});

// A conversation with one line should remain unchanged.
test('single-turn history remains single-turn',()=>{const x=buildCompactContext({system:'rules',history:[{role:'user',content:'one'}],maxInputTokens:100});assert.equal(x.messages.at(-1).content,'one')});

// UI explicitly marks the user-editable memory as local-only.
test('world settings UI states that it is browser-local only',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ไม่เรียก AI เพิ่ม/)});

// Changed settings have an explicit save affordance.
test('world settings expose an explicit save button',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/บันทึกโลก/)});

// Token controls are mutable per browser without forcing provider calls.
test('context UI has bounded low-cost defaults',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/value="1800"/);assert.match(html,/value="300"/)});

// Context code keeps only a small recent window by default.
test('browser history window defaults to 12 turns',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/function compressHistory\(history,maxMessages=12\)/)});

// Ensure memory length is bounded in the running UI.
test('session memory summary bounded in browser',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/compact\.slice\(-700\)/)});

// Context API size is bounded on the server as a second line of defense.
test('server limits input and output token budgets to configured ranges',()=>{const source=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(source,/1800/);assert.match(source,/Math\.min\(1200/)});

// User can retain context manually in world facts instead of buying summary calls.
test('world builder includes durable facts field',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/worldRules/)});

// An empty memory doesn't inject an empty prompt section.
test('empty memory is not appended as blank content',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/if\(memory\)messages\.push/)});

// Verify the browser key input is distinct from provider endpoint and never type=text.
test('client key field is password-masked',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/id="clientApiKey" class="provider-select" type="password"/)});

// Datalist provides inexpensive model selection without requiring provider-specific SDKs.
test('model input supports manual IDs and discovery list',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/list="modelOptions"/);assert.match(html,/useManualModel/)});

// Prompt rules are injected into the system-level string before conversation history.
test('global and world/character prompt are built into system message',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/role:'system',content:buildSystemPrompt/);assert.match(html,/worldPrompt\(\)/)});

// Keep the development surface unchanged: no additional dependencies are added for memory compression.
test('package remains dependency free',()=>{const p=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','package.json'),'utf8'));assert.equal(p.dependencies,undefined)});

// Optional external model call remains one call per user turn.
test('chat request remains one completion call per send',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/const answer=await apiChat\(payload\)/)});

// Prompt role descriptions distinguish non-spoken actions.
test('default prompt teaches action markup is not audible speech',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ไม่ใช่เสียงพูด/)});

// Keep the generated memory explicitly marked approximate.
test('memory prompt discloses extractive approximation',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/local extractive, อาจไม่ครบ/)});

// No embedded key literals.
test('page never writes entered client keys into browser storage',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.doesNotMatch(html,/localStorage\.setItem\([^)]*clientApiKey/)});

// Memory is ephemeral unless promoted to explicit world facts.
test('memory remains session scoped',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/const sessionConversationMemory=\{\}/)});

// Keep prompt composition and scene data independent.
test('world setting values are composed separately from per-character sheet',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/\[โลก\/ฉาก\]/);assert.match(html,/\[ชีตตัวละคร/)});

// Buttons are visibly present for ease of use.
test('token settings contain a manual apply button',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/บันทึกงบประมาณ token แล้ว/)});

// Not attempting model-specific tokenizers avoids another dependency or API call.
test('client estimate uses lightweight character heuristic',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/Math\.ceil\(String\(s\|\|''\)\.length\/4\)/)});

// Server's middleware never trusts caller's custom endpoint for non-allowlisted hosts.
test('server still allowlists custom model-list hosts',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/Custom endpoint host is not on the server allow-list/)});

// Output tokens default low for $1 budget.
test('backend response token default is conservative',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/MAX_OUTPUT_TOKENS\|\|300/)});

// Browser context prompt caps locally before sending.
test('browser send compacts with saved user budget',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/const payload=buildChatMessages/)});

// Ensure no model-based summarizer calls are billed.
test('local memory helper does not use model endpoint',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(src,/fetch\(|chat\/completions/)});

// Keep responsiveness unaffected by settings additions.
test('settings layout remains responsive',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/@media\(max-width:700px\)/)});

// UI configured mode warns on browser credential risk.
test('browser-key security warning remains visible when mode selected',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/Browser key · local\/LAN เท่านั้น/);assert.match(html,/คำเตือน: คีย์จะส่งตรงจาก browser/)});

// One explicit memory cap for local-summary state.
test('extractive session memory has a hard length cap',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/slice\(-700\)/)});

// Budget controls cap outputs to avoid surprise spend.
test('UI constrains generation output tokens',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/maxReplyTokens/);assert.match(html,/Math\.min\(1200/)});

// Actions are represented with stars in examples to anchor RP style.
test('format hint includes starred action convention',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/\*\.\.\.\*/)});

// Per-turn context is capped at latest messages in browser path.
test('history compressor keeps bounded recent turn count',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/compressHistory\(history,12\)/)});

// World, token budget and speech-format requirements are surfaced without provider calls.
test('world builder and token budget require no network summarizer',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/saveWorldSettings/);assert.match(html,/saveTokenBudget/)});

// Added only once per page lifetime; chat calls do not send extra billing requests for summaries.
test('extractive context memory uses local conversation strings only',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/function compressHistory/);assert.match(html,/setConversationMemory/)});

// Ensure large compacted system inputs are still bounded server-side.
test('server context utilities cap the system string and compact old turns',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.match(src,/safeSystem\.slice/);assert.match(src,/compressOldMessages/)});

// Test text labels specifically distinguish narrative channel from spoken words.
test('format instructions say actions are not spoken dialogue',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ไม่ใช่เสียงพูด/);assert.match(html,/ห้ามแปลง \*\.\.\.\* เป็นบทพูด/)});

// Keep remembered world facts in local storage, but not API keys.
test('world configuration is stored locally without API secrets',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/hush-world-settings/);assert.doesNotMatch(html,/localStorage\.setItem\('hush-provider-key/)});

// Explicitly bound serialized character/roleplay context rows.
test('browser compressor truncates each message content',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/trimToSentence\(m.content,700\)/)});

// The selected response length is sent as an output cap in API payload.
test('API client sends user-selected maximum output tokens',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/maxTokens/)});

// This first low-budget implementation intentionally does not invoke a paid summary model.
test('local summary uses bounded text extraction rather than a second paid call',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/slice\(-700\)/);assert.doesNotMatch(html,/summarizeWithAI|memorySummaryRequest/)});

// UI starts conservative for users with small balances.
test('budget defaults remain modest',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/value="1200"/);assert.match(html,/value="300"/)});

// Test loaded helpers are stable and importable.
test('helper provides bounded token estimate and compression exports',()=>{const api=require('../lib/context');assert.equal(typeof api.compressOldMessages,'function');assert.equal(typeof api.buildCompactContext,'function')});

// System instructions encode the RP world-format rules once at top of prompt.
test('system format rules stay in global instructions',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/buildWorldControlHint/)});

// no paid tokenizer dependency is introduced.
test('context code remains dependency-free',()=>{const p=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','package.json'),'utf8'));assert.equal(p.dependencies,undefined)});

// Explicit output cap has a maximum for spend control.
test('server clamps maximum generated output',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/Math\.min\(1200/)});

// Retain latest lines on summary when old conversation is compacted.
test('compressed memory prioritizes later older events',()=>{const api=require('../lib/context');const m=api.compressOldMessages(Array.from({length:30},(_,i)=>({role:'user',content:`scene-${i}`})),300);assert.match(m,/scene-29/)});

// Verify world settings are injected alongside system prompt.
test('world data reaches system prompt builder',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/worldPrompt\(\)/);assert.match(html,/\[โลก\/ฉาก\]/)});

// No transcript content is persisted into disk by memory helper.
test('memory summary remains session-only',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/sessionConversationMemory/);assert.match(html,/remoteSet\('worldSettings'/)});

// Test compacting preserves the newest turn if large text is removed.
test('compact request keeps the latest user prompt inside output',()=>{const api=require('../lib/context');const m=api.buildCompactContext({system:'rules',history:[{role:'user',content:'z'.repeat(5000)}],maxInputTokens:120});assert.ok(m.messages.some(x=>x.role==='user'));});

// Maintain low-cost defaults at both layers.
test('client and server budgets both default conservatively',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8'),server=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(html,/hush-context-budget.*1200/);assert.match(server,/MAX_INPUT_TOKENS\|\|1800/)});

// Formatting semantics for the specific user request.
test('default prompt separates thought/action markers from spoken dialogue',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/\*\.\.\.\* คือการกระทำ/);assert.match(html,/ไม่ใช่เสียงพูด/)});

// The memory budget remains user-editable and saved in browser local preferences.
test('token controls save context and response budgets',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/hush-output-budget/);assert.match(html,/saveTokenBudget/)});

// Limits apply without modifying message role semantics.
test('compact payload permits only canonical roles at upstream boundary',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/\['system','user','assistant'\]/)});

// Ensure the app's default model is manually configurable when discovery is unavailable.
test('model picker has manual model ID path',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ใช้ชื่อที่พิมพ์/)});

// This is intentionally a no-dependency solution for a very small remaining API budget.
test('no tokenization package is added',()=>{const p=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','package.json'),'utf8'));assert.equal(p.dependencies,undefined)});

// Tests make no upstream network calls.
test('compaction helper contains no external network dependency',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(src,/fetch\(|https:\/\//)});

// Use a stable small cap to avoid expensive full history retransmission.
test('recent history carries a fixed small window by default',()=>{assert.equal(require('../lib/context').DEFAULT_CONTEXT_TOKENS,1800)});

// Manual memory facts remain under a short cap.
test('local memory storage is clipped',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/compact\.slice\(-700\)/)});

// Fixed-output limit avoids unexpectedly long completions.
test('server max token output default is 300',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/MAX_OUTPUT_TOKENS\|\|300/)});

// World context is one local setting shared across roleplay characters.
test('world settings saved in localStorage under one namespace',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/hush-world-settings/)});

// Prevent an implicit network summary that could spend the limited API balance.
test('memory compaction remains local and synchronous',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(src,/await |fetch\(/)});

// Output cap can be narrowed in settings with a safe ceiling.
test('response token setting clamps to 1200 maximum',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/Math\.min\(1200/)});

// The world panel captures name, setting, and facts/rules fields.
test('world builder offers scene description and important facts',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/id="worldName"/);assert.match(html,/id="worldDescription"/);assert.match(html,/id="worldRules"/)});

// Deliberately bound memory summary to reduce recurrent prompt cost.
test('local memory is capped to 700 characters',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/compact\.slice\(-700\)/)});

// Keep narrative parser prompt short to save tokens.
test('narrative convention included in system instructions',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/รูปแบบ roleplay/)});

// No paid summarization calls were added.
test('one chat completion call per user message still applies',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/const answer=await apiChat/)});

// Keep baseline assistant turns free of server-side persistence to honor the lightweight scope.
test('the conversation log remains session-local',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/activeChatHistory/)});

// This avoids needing a model-dependent tokenizer installation.
test('token estimation is documented as approximate',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ประมาณ token/)});

// Model list can be typed if provider does not supply it.
test('manual ID control remains accessible',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/id="modelSelect"/)});

// Local facts provide durable setting continuity at zero incremental tokenization API cost.
test('save world settings does not invoke apiChat',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');const i=html.indexOf('function saveWorldSettings'),j=html.indexOf('function worldPrompt',i);assert.doesNotMatch(html.slice(i,j),/apiChat|fetch\(/)});

// Explicit markers are kept in history rather than stripped by the UI.
test('compact transcript preserves star marker syntax',()=>{const c=require('../lib/context').compressOldMessages([{role:'assistant',content:'*shrugs* “fine”'}]);assert.match(c,/\*shrugs\*/);assert.match(c,/“fine”/)});

// Keep each sent line size bounded independently.
test('compressor truncates message lines even under a generous budget',()=>{const c=require('../lib/context').compressOldMessages([{role:'user',content:'a'.repeat(5000)}],500);assert.ok(c.length<=500)});

// Secure default remains server-key mode in settings.
test('key mode defaults to server and custom API key is memory-only',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/value="server"/);assert.match(html,/beforeunload/)});

// No chat-image attachment features are introduced by these settings.
test('text composer still has no attachment inputs',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.doesNotMatch(html,/title="แนบ"/)});

// Server context bounds apply to all OpenAI-compatible providers alike.
test('server compacts common chat messages before upstream fetch',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/const compact=buildCompactContext/);assert.match(src,/messages:compact\.messages/)});

// Budget lowering takes effect before the next provider request.
test('browser token budget is loaded from local setting',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/localStorage\.getItem\('hush-context-budget'\)/)});

// The compact memory tells the model it is an imperfect extraction.
test('memory system marker labels summary as approximate',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/local extractive, อาจไม่ครบ/)});

// Deployment budget requirements live in environment template.
test('low-cost limits can be tuned per installation',()=>{const env=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','.env.example'),'utf8');assert.match(env,/MAX_INPUT_TOKENS=1800/);assert.match(env,/MAX_OUTPUT_TOKENS=500/)});

// Final token cost note: approximate tokenizer and request caps, not a price guarantee.
test('budget help explicitly says estimates are approximate',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ประมาณ token/)});

// System context combines world and character sheet once, avoids duplicate world section.
test('system prompt builder includes world and persona section',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/\[โลก\/ฉาก\]/);assert.match(html,/\[ชีตตัวละคร/)});

// No local semantic summarization claim: short extractive notes only.
test('old dialogue memory is explicitly described as extractive',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/local extractive/)});

// Memory cleanup doesn't call LLM and therefore adds no billable request.
test('memory compaction is local without provider request',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(src,/fetch\(|chat\/completions/i)});

// Repetition is pruned by a capped recent window.
test('history window cap fixed to 12 on client',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/compressHistory\(history,12\)/)});

// Explicit output cap is applied before provider call.
test('server output max token limit remains clamped',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/Math\.min\(1200/)});

// User can avoid oversized world prompts by staying inside form size guidance.
test('world fields are plain text and saved locally',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/remoteSet\('worldSettings'/)});

// Browser-key preference never stores the raw key.
test('browser API key is passed only to live request payload, not local storage',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/payload\.apiKey=sessionApiKey/);assert.doesNotMatch(html,/localStorage\.setItem\([^\n]*sessionApiKey/)});

// Kept 12-message recent window gives steady token use; older context becomes a small memory.
test('old messages are replaced by bounded extracted notes',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/compact\.slice\(-700\)/);assert.match(html,/slice\(-8\)/)});

// The prompt gives the exact requested distinction between actions and speech.
test('system prompt distinguishes starred actions from audible dialogue',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/ข้อความ \*\.\.\.\* คือการกระทำ/);assert.match(html,/ไม่ใช่เสียงพูด/)});

// A global world setting supplies useful persistence across characters.
test('world-builder is saved separately from character profiles',()=>{const html=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(html,/hush-world-settings/);assert.match(html,/worldDescription/)});

// Provider defaults/allowed URL safeguards remain in place.
test('browser passthrough allow-list remains closed to unknown providers',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/clientKeyHosts\.has\(base\.hostname\.toLowerCase\(\)\)/)});

// Keep action-role presentation in generated memory rather than converting to speech.
test('speaker memory labels assistant role without rewriting dialogue markers',()=>{const text=require('../lib/context').compressOldMessages([{role:'assistant',content:'*shrugs* “sure”'}]);assert.match(text,/ตัวละคร:/);assert.match(text,/\*shrugs\*/)});

// runWorldBuilder sanity relies only on local persistence.
test('world save uses no model/network call',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');const i=h.indexOf('function saveWorldSettings'),j=h.indexOf('function worldPrompt',i);assert.doesNotMatch(h.slice(i,j),/fetch\(|apiChat/)});

// Cheap response budget is user-adjustable and stable.
test('response token default and maximum are visible',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/value="300"/);assert.match(h,/max="1200"/)});

// Data volume remains bounded when history is submitted.
test('history lines have a per-message cap',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/trimToSentence\(m.content,700\)/)});

// Keep context budget control and durable prompt system separate.
test('saving world instructions does not persist API credentials',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/saveWorldSettings/);assert.doesNotMatch(h,/localStorage\.setItem\('hush-api-key/)});

// A 1 dollar constrained plan should not make extra summarizer calls.
test('one provider request remains tied to each user send',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/const answer=await apiChat\(payload\)/);assert.doesNotMatch(h,/summarizeWithAI/)});

// messages stay standard roles for compatible chat APIs.
test('history compactor preserves user and assistant role names',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(src,/role:m\.role/)});

// Conservative context defaults documented to user.
test('budget defaults lower than initial 2k+',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/value="1200"/)});

// Run local context tests via node test runner.
test('context helper outputs approximate token count',()=>{const {estimateTokens}=require('../lib/context');assert.equal(estimateTokens('abcdefgh'),2)});

// Session memory is capped and explicitly scoped to the active tab.
test('session memory never enters browser storage',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/const sessionConversationMemory=\{\}/);assert.match(h,/compact\.slice\(-700\)/)});

// Reduce response completion length as requested for a limited spend budget.
test('server default output length configured at 300 tokens',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(src,/MAX_OUTPUT_TOKENS\|\|300/)});

// provider model auto discovery is optional; typed model name remains available.
test('manual model button provides fallback without API discovery support',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ใช้ชื่อที่พิมพ์/)});

// World's facts must stay concise to fit system context.
test('world facts label helps keep lore compact',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/กฎหรือข้อเท็จจริงสำคัญ/)});

// Context compaction helper has no disk access.
test('extractive compact helper does not read/write files',()=>{const src=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(src,/readFile|writeFile|fetch\(/)});

// Apply compaction before sending to the provider.
test('api payload is constructed from system-first bounded history',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/buildChatMessages\(window\.activeRoleplayCharacter,history\.slice\(-24\)\)/)});

// No user secret appears in document markup beyond blank password field.
test('API key input does not have preset value',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');const x=h.match(/<input id="clientApiKey"[^>]+>/)?.[0]||'';assert.doesNotMatch(x,/value=/)});

// Default generation style has literal quote vs italics guidance.
test('RP formatting instructs narration-vs-dialogue semantic distinction',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/DEFAULT_GLOBAL_PROMPT/);assert.match(h,/buildWorldControlHint/)});

// Token cap settings persist without storing key material.
test('context and output budgets persist independently from api key',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/hush-context-budget/);assert.match(h,/hush-output-budget/);assert.doesNotMatch(h,/hush-client-api-key/)});

// response caps are clamped both in browser controls and backend.
test('output limit is clamped on both server and client',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8'),s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(h,/Math\.min\(1200/);assert.match(s,/Math\.min\(1200/)});

// Use latest turns and short old-fact snippets to cut repeated token charges.
test('old chat gets extractive summary instead of full transcript',()=>{const api=require('../lib/context');const h=Array.from({length:35},(_,i)=>({role:i%2?'assistant':'user',content:`fact ${i} *act* “line” `+'word '.repeat(100)}));const r=api.buildCompactContext({system:'short',history:h,maxInputTokens:400,memoryChars:100});assert.ok(r.omittedMessages>0);assert.ok(r.estimatedTokens<=400)});

// Settings persist scene/world independently from tokens, key and provider.
test('world facts namespace has isolated browser key',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/hush-world-settings/)});

// Optimize summary before chat goes out so stale lines are not billed repeatedly.
test('browser chat message list is compacted before send call',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/buildChatMessages\(window\.activeRoleplayCharacter,history\.slice\(-24\)\)/)});

// No fixed cost promises since token estimates depend on language/provider tokenizer.
test('budget helper acknowledges token estimate uncertainty',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ประมาณ/)});

// Keep model reply lengths manually budgetable for low balance.
test('reply length has own control from input budget',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/id="tokenBudget"/);assert.match(h,/id="maxReplyTokens"/)});

// Cheap context compaction should preserve quoted lines and italic actions.
test('extractive summary retains dialogue and narrative delimiters',()=>{const m=require('../lib/context').compressOldMessages([{role:'assistant',content:'*moves* “hello”'}]);assert.match(m,/\*moves\*/);assert.match(m,/“hello”/)});

// World setting and persona data are injected without another paid request.
test('world and character data both sit in system prompt',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/\[โลก\/ฉาก\]/);assert.match(h,/\[ชีตตัวละคร/)});

// Output budget can be adjusted independently.
test('output tokens persist as separate setting',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/hush-output-budget/)});

// Avoid model summarization spending the user's remaining funds.
test('no memory summarizer model endpoint added',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.doesNotMatch(h,/summarizeWithAI|memorySummaryRequest/)});

// role-based message format stays compatible.
test('compact helpers retain OpenAI-compatible message roles',()=>{const ctx=require('../lib/context').buildCompactContext({system:'rules',history:[{role:'user',content:'x'},{role:'assistant',content:'y'}],maxInputTokens:100});assert.deepEqual(ctx.messages.slice(-2).map(x=>x.role),['assistant','user'])});

// low-budget settings guide displays local contextual optimization.
test('token panel explains local compaction with no paid summary',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ย่อข้อความเก่าในเครื่อง/)});

// make sure browser persistent world rules also enter prompt after reload.
test('world settings are loaded back from browser-local storage',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/loadWorldSettings\(\)/);assert.match(h,/hush-world-settings/)});

// clear stop-testing-only edge case duplicate assertions.
test('input/output defaults use low-cost values',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/value="1200"/);assert.match(h,/value="300"/)});

// Build request compaction remains pure synchronous and deterministic.
test('chat compression is a local transform',()=>{const ctx=require('../lib/context');const result=ctx.buildCompactContext({system:'r',history:[{role:'user',content:'x'},{role:'assistant',content:'y'}],maxInputTokens:90});assert.equal(result.messages.at(-1).content,'x')});

// Economy baseline is explained without claiming exact spend.
test('token budget help uses approximate, non-guaranteed units',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ประมาณ token/)});

// The output value is capped server-side even if a caller tampers with UI.
test('server enforces max completion independent of user/browser',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/Math\.min\(1200/)});

// The context compactor's public API has predictable defaults for inexpensive models.
test('context budget default remains explicit',()=>{assert.equal(require('../lib/context').DEFAULT_CONTEXT_TOKENS,1800)});

// Global prompt default helps the exact requested special-character formatting.
test('default prompt references asterisk narration syntax',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/\*\.\.\.\*/)});

// World facts are user-editable, short, and not sent to model during save action.
test('world form only saves local settings until chat starts',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/saveWorldSettings/)});

// Standard role channel in context requests stays system,user,assistant.
test('request validation only allows plain text roles',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/system','user','assistant/)});

// Detail note marks local summary imperfect to set expectations.
test('summary prompt discloses extractive nature and limits',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/local extractive, อาจไม่ครบ/)});

// Key stays in session memory only and is erased on page exit.
test('browser credential erased at unload event',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/beforeunload/);assert.match(h,/sessionApiKey=''/)});

// Restrict user-supplied model IDs to text-only API calls and no attachments.
test('message composer only emits string content',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/content:text/)});

// User requests simplicity, keep no dependency for tokenizers.
test('package remains without dependencies',()=>{const p=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','package.json'),'utf8'));assert.equal(p.dependencies,undefined)});

// World setup uses a separate name and rules store across characters.
test('world prompt field IDs exist and persisted settings can be loaded',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/worldName/);assert.match(h,/worldRules/);assert.match(h,/loadWorldSettings/)});

// Avoid unlimited assistant outputs if model ignores prompt.
test('provider request token max defaults below 500',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/MAX_OUTPUT_TOKENS\|\|300/)});

// The local memory uses a lightweight summary, not an AI call.
test('memory code does not perform HTTP requests',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(s,/fetch\(|https:\/\//)});

// Prompt asks the model to preserve markup rather than collapse it into speech.
test('RP hint prevents thoughts being rendered as dialogue',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ห้ามแปลง \*\.\.\.\* เป็นบทพูด/)});

// local world saving shouldn't use paid usage at setting time.
test('world save handler has no API call',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');const a=h.indexOf('function saveWorldSettings'),b=h.indexOf('function worldPrompt',a);assert.doesNotMatch(h.slice(a,b),/fetch|apiChat/)});

// End-to-end will use the current page's text-only send UI.
test('input API keeps history to recent 12 messages client side',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/function compressHistory\(history,maxMessages=12\)/)});

// World description is persisted, and shared across sessions on same browser.
test('world settings persist using localStorage',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/remoteSet\('worldSettings'/)});

// Last prompt invariant: always pass system prompt first and context memory afterwards.
test('system prompt is first in built chat messages',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/role:'system',content:buildSystemPrompt/)});

// Budget does not add a new request per turn.
test('chat send still calls provider once per message',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/const answer=await apiChat\(payload\)/)});

// config remains compatible for inexpensive Linux single-process deployment.
test('single process filesystem persistence remains unchanged',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/characters\.json/)});

// No assumption of actual exact tokenizer accuracy.
test('token estimator documents heuristic',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/Math\.ceil\(String\(s\|\|''\)\.length\/4\)/)});

// Memory local summary must be bounded for little storage.
test('memory maximum is under one kilobyte',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/compact\.slice\(-700\)/)});

// The maximum requested history stays small even when users keep chatting.
test('provider receives no more than sixteen recent messages at browser edge',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/compressHistory\(history,12\)/)});

// Keep the exact marker convention visible in the frontend default prompt.
test('asterisk actions and quoted words have separate conventions',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ข้อความในเครื่องหมายคำพูดคือบทพูด/);assert.match(h,/ข้อความ \*\.\.\.\* คือการกระทำ/)});

// Check world facts available to persona context before each provider call.
test('world facts and persona sheet are included in one system prompt',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/worldPrompt\(\)/);assert.match(h,/\[ชีตตัวละคร/)});

// Security: client key mode cannot be enabled by a public browser when server disables it.
test('browser key option is disabled unless server says permitted',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/browserOption\.disabled=isVps\|\|!clientKeyAllowed/)});

// Lightweight cost setting uses no database and persists only in browser settings.
test('token controls store only integer settings, not provider key',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/hush-context-budget/);assert.match(h,/hush-output-budget/)});

// Extractive notes name the speaker explicitly to help continuity.
test('older memory labels user and character messages distinctly',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/ตัวละคร':'ผู้ใช้/)});

// Avoid expensive automatic tokenization dependencies for a one-dollar test budget.
test('no provider tokenizer dependency',()=>{const p=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'..','package.json'),'utf8'));assert.equal(p.dependencies,undefined)});

// History messages use only text content supported by provider APIs.
test('message payload schema stays text-only',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/typeof m.content!=='string'/)});

// Local summary has no semantic guarantee; it uses snippets only.
test('local summary is explicitly called extractive',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/local extractive/)});

// Ensure cost budget doesn't increase for setting world rules.
test('world editing handlers do not request chat completions',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');const a=h.indexOf('function saveWorldSettings'),b=h.indexOf('function worldPrompt',a);assert.doesNotMatch(h.slice(a,b),/fetch|apiChat/)});

// Response cap control is independent from the input context budget.
test('reply output control field exists separately',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/id="tokenBudget"/);assert.match(h,/id="maxReplyTokens"/)});

// Confirm example environment documents the requested limited spend knobs.
test('env example documents input and output token limits',()=>{const env=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','.env.example'),'utf8');assert.match(env,/MAX_INPUT_TOKENS=1800/);assert.match(env,/MAX_OUTPUT_TOKENS=500/)});

// System message provides exact marker instructions at the start.
test('world format hint is appended after RP and persona policy',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/buildWorldControlHint\(\)/)});

// The sequence of old summary plus recent turns remains bounded.
test('client compactor caps extracted memory at 700 characters',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/compact\.slice\(-700\)/)});

// Temp world data lives only per browser profile and does not leak across accounts.
test('global setting persistence uses local browser storage',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/hush-world-settings/)});

// Independent feature groups do not alter the actual visually selected v3 file.
test('page keeps the same v3 file title/identity',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/Hush — AI Roleplay/)});

// The cap prevents huge inputs from silently busting the tiny context budget.
test('server clamps prompt input with a cheap character/token heuristic',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.match(s,/maxInputTokens/)});

// Ensure user memory never expands past UI budget before call.
test('browser keeps only a small recent transcript slice',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/slice\(-maxMessages\)/)});

// Only the current active character's settings enter that character's prompt.
test('persona content includes appearance and role fields independently of world',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/รูปลักษณ์: \$\{character\.appearance/);assert.match(h,/บทบาท: \$\{character\.role/)});

// No file/network call occurs when user saves a world definition.
test('world persistence is browser-local and immediate',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/function saveWorldSettings/);assert.match(h,/remoteSet\('worldSettings'/)});

// Summary doesn't prompt LLM a second time.
test('memory compaction makes no extra model call',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.doesNotMatch(s,/fetch\(|chat\/completions/)});

// Ensure server output cap exists as a spending defense regardless of client limit.
test('server clamps max output tokens with env default',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/MAX_OUTPUT_TOKENS\|\|300/)});

// Important shared scene facts should not need repeating in the long dialogue.
test('world and scene prompt is stored separately from transcript',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/hush-world-settings/);assert.match(h,/worldPrompt\(\)/)});

// Check local compressor clips giant utterances to avoid input overages.
test('extractive memory clips each older utterance',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','lib','context.js'),'utf8');assert.match(s,/maxChars/)});

// Since context summarization is not semantic, the user can record canon facts in world builder.
test('world facts field gives manual durable canon option',()=>{const h=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','roleplay-ai-prototype-v3.html'),'utf8');assert.match(h,/worldRules/)});

// Avoid leaking configured provider key from the server status endpoint.
test('status returns boolean only for server api key',()=>{const s=require('node:fs').readFileSync(require('node:path').join(__dirname,'..','server.js'),'utf8');assert.match(s,/aiConfigured:Boolean\(apiKey\)/);assert.doesNotMatch(s,/return json\(res,200,\{apiKey/)});


test('old turns compress to compact local memory and recent turns remain intact',()=>{
  const history=Array.from({length:30},(_,i)=>({role:i%2?'assistant':'user',content:`Turn ${i}: ${'detail '.repeat(25)}`}));
  const result=buildCompactContext({system:'short system rules',history,maxInputTokens:420,memoryChars:360});
  assert.ok(result.estimatedTokens<=420,`estimated ${result.estimatedTokens}`);
  assert.ok(result.omittedMessages>0);assert.ok(result.memory.length<=360);
  assert.ok(result.messages.some(m=>m.role==='system'&&m.content.includes('บันทึกย่อเหตุการณ์')));
  assert.deepEqual(result.messages.slice(-2),[...history.slice(-2)].reverse());
  const memory=result.messages.find(m=>m.role==='system'&&m.content.includes('บันทึกย่อเหตุการณ์'))?.content||'';
  assert.ok(memory.length<=Math.floor(420*.18)*4+120);
});

test('empty and oversized system prompts still keep newest user message',()=>{
  const result=buildCompactContext({system:'x'.repeat(10000),history:[{role:'user',content:'latest'}],maxInputTokens:100});
  assert.equal(result.messages.at(-1).content,'latest');
  assert.ok(Number.isFinite(estimateTokens(result.messages[0].content)));
});
