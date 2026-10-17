'use strict';

const DEFAULT_CONTEXT_TOKENS=1800;
const DEFAULT_MEMORY_CHARS=900;
function estimateTokens(text){return Math.ceil(String(text||'').length/4)}
function compactLine(message,maxChars=240){
  const role=message.role==='assistant'?'ตัวละคร':'ผู้ใช้';
  const text=String(message.content||'').replace(/\s+/g,' ').trim();
  if(!text)return '';
  const clipped=text.length>maxChars?text.slice(0,maxChars-1).trimEnd()+'…':text;
  return `${role}: ${clipped}`;
}
function compressOldMessages(messages,maxChars=DEFAULT_MEMORY_CHARS){
  const lines=[];let used=0;
  for(let i=messages.length-1;i>=0;i--){
    const line=compactLine(messages[i]);if(!line)continue;
    if(line.length>maxChars){lines.unshift(line.slice(0,Math.max(0,maxChars-1)).trimEnd()+'…');break;}
    const cost=line.length+(lines.length?1:0);if(used+cost>maxChars)continue;
    lines.unshift(line);used+=cost;
  }
  return lines.join('\n');
}
function buildCompactContext({system='',history=[],memory='',maxInputTokens=DEFAULT_CONTEXT_TOKENS,memoryChars=DEFAULT_MEMORY_CHARS}={}){
  const safeSystem=String(system||'').trim();
  const oldMessages=history.slice(0,Math.max(0,history.length-1));
  let compactMemory=String(memory||'').trim();
  let recent=history.slice();
  let reserve=Math.min(estimateTokens(safeSystem),Math.floor(maxInputTokens*.65));
  let memoryBudget=Math.min(estimateTokens(compactMemory),Math.floor(maxInputTokens*.18));
  let remaining=Math.max(0,maxInputTokens-reserve-memoryBudget);
  const kept=[];
  for(let i=recent.length-1;i>=0;i--){
    const message=recent[i];const cost=estimateTokens(message.content)+4;
    if(estimateTokens(kept.map(x=>x.content).join('\n'))+cost>remaining)break;
    kept.unshift(message);
  }
  const keptCount=kept.length;
  if(keptCount<history.length){
    const older=history.slice(0,history.length-keptCount);
    const generated=compressOldMessages(older,memoryChars);
    compactMemory=[compactMemory,generated].filter(Boolean).join('\n').slice(-memoryChars);
    memoryBudget=Math.min(estimateTokens(compactMemory),Math.floor(maxInputTokens*.25));
    remaining=Math.max(0,maxInputTokens-reserve-memoryBudget);
    recent=[];
    for(let i=history.length-1;i>=0;i--){const m=history[i],cost=estimateTokens(m.content)+4;if(estimateTokens(recent.map(x=>x.content).join('\n'))+cost>remaining)break;recent.unshift(m)}
  }else recent=kept;
  if(recent.length===1&&recent[0].role==='user'&&estimateTokens(recent[0].content)>maxInputTokens/2){recent=[{...recent[0],content:recent[0].content.slice(-maxInputTokens*2)}]}
  const messages=[{role:'system',content:safeSystem.slice(0,Math.max(0,maxInputTokens*2))}];
  let systemCost=estimateTokens(messages[0].content)+4;
  if(compactMemory){
    const maxMemoryTokens=Math.max(0,Math.floor(maxInputTokens*.18));
    const maxMemoryChars=maxMemoryTokens*4;
    compactMemory=compactMemory.slice(-maxMemoryChars);
    if(compactMemory){const memoMessage={role:'system',content:`บันทึกย่อเหตุการณ์ก่อนหน้า (สรุปแบบย่อ อาจไม่ครบทุกถ้อยคำ):\n${compactMemory}`};messages.push(memoMessage);systemCost+=estimateTokens(memoMessage.content)+4;}
  }
  let budget=Math.max(0,maxInputTokens-systemCost),finalMessages=[];
  for(let i=recent.length-1;i>=0;i--){const m=recent[i],cost=estimateTokens(m.content)+4;if(cost>budget)continue;finalMessages.unshift(m);budget-=cost}
    let lastUserIndex=-1;
    for(let i=history.length-1;i>=0;i--)if(history[i].role==='user'){lastUserIndex=i;break;}
    if(lastUserIndex>=0){
      const latestUser=history[lastUserIndex];
      const promptBudget=Math.max(0,(maxInputTokens-systemCost)*4);
      const content=String(latestUser.content||'').slice(-promptBudget);
      if(promptBudget>0){finalMessages=finalMessages.filter(message=>message!==latestUser);finalMessages.push({...latestUser,content});}
    }
    messages.push(...finalMessages);
  return {messages,memory:compactMemory,estimatedTokens:messages.reduce((n,m)=>n+estimateTokens(m.content)+4,0),omittedMessages:Math.max(0,history.length-finalMessages.length)};
}
module.exports={estimateTokens,compactLine,compressOldMessages,buildCompactContext,DEFAULT_CONTEXT_TOKENS,DEFAULT_MEMORY_CHARS};
