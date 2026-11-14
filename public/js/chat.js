function buildWorldControlHint() {
  return t(
    'world_control_hint',
    'รูปแบบ roleplay: ข้อความใน “…” เป็นบทพูด; ข้อความระหว่าง *...* คือการกระทำ สีหน้า หรือความคิด ไม่ใช่เสียงพูด; narrative บรรยายฉากและการเคลื่อนไหวตามบริบท ห้ามแปลง *...* เป็นบทพูด ห้ามบรรยายการกระทำ/ความคิดแทนผู้ใช้'
  );
}

function buildSystemPrompt(character) {
  const global = document.getElementById('globalPrompt')?.value.trim() || DEFAULT_GLOBAL_PROMPT;
  const sheet = character ? [
    `ชื่อ: ${character.name || 'ไม่ระบุ'}`,
    `บทบาท: ${character.role || 'ไม่ระบุ'}`,
    `รูปลักษณ์: ${character.appearance || 'ไม่ระบุ'}`,
    `บุคลิก/คำอธิบาย: ${character.desc || 'ไม่ระบุ'}`,
    `แนวเรื่อง: ${(character.genre || []).join(', ') || 'ไม่ระบุ'}`,
    `สถานะอายุ: ${character.adult ? 'ผู้ใหญ่ 18+' : 'ไม่ได้ระบุว่าเป็นผู้ใหญ่ — ห้ามเนื้อหาทางเพศ'}`,
    character.greeting ? `ข้อความทักทาย/ฉากเปิดเรื่องของคุณ: ${character.greeting}` : '',
    character.systemPrompt ? `วิธีพูดและรายละเอียดเพิ่มเติม:\n${character.systemPrompt}` : ''
  ].filter(Boolean).join('\n') : '';

  return [
    `[พรอมต์หลัก — กติกา RP]\n${global}`,
    worldPrompt() && `[โลก/ฉาก]\n${worldPrompt()}`,
    sheet && `[ชีตตัวละคร — ข้อมูลและบุคลิก]\n${sheet}`,
    userPersonaPrompt(),
    typeof buildAutoMemorySystemBlock === 'function' ? buildAutoMemorySystemBlock(character) : '',
    buildWorldControlHint(),
    typeof replyLengthHint === 'function' ? replyLengthHint() : ''
  ].filter(Boolean).join('\n\n');
}

function buildChatMessages(character,history){
  const recent=compressHistory(history,12);
  const charName = character && character.name;
  const aiMem = typeof getCharacterMemoryList === 'function' ? getCharacterMemoryList(charName) : [];
  const memory = aiMem.length ? '' : getConversationMemory(charName);
  const messages=[{role:'system',content:buildSystemPrompt(character)}];
  if(memory)messages.push({role:'system',content:`[ความจำย่อจากช่วงก่อน — local extractive, อาจไม่ครบ]\n${memory}`});
  return [...messages,...recent];
}

const sessionConversationMemory={};
function setConversationMemory(characterName, value) {
  sessionConversationMemory[characterName] = String(value || '').slice(-900);
}
function getConversationMemory(characterName) {
  return sessionConversationMemory[characterName] || '';
}
function estimateClientTokens(s){return Math.ceil(String(s||'').length/4)}
function trimToSentence(text, max) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const m = head.match(/^[\s\S]*[.!?…。！？”」)]/);
  return m ? m[0] : t;
}

function compressHistory(history,maxMessages=12){
  const all = history || [];
  const cut = Math.max(0, all.length - maxMessages);
  const older = all.slice(0, cut);
  if (older.length) {
    const speakerLabel = m => {
      const u = t('speaker_user', 'ผู้ใช้'), c = t('speaker_character', 'ตัวละคร');
      return m.role === 'assistant' ? c + ':' : u + ':';
    };
    const compact = older.slice(-8).map(m => speakerLabel(m) + ' ' + trimToSentence(m.content, 90)).join('\n');
    setConversationMemory(currentCharacter, compact.slice(-700));
  }
  const limit = Number(localStorage.getItem('hush-context-budget') || 1200);
  const recent = all.slice(-maxMessages);
  const out = [];
  let used = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const m = recent[i];
    const content = m.role === 'assistant' ? trimToSentence(m.content,700) : String(m.content || '').replace(/\s+/g, ' ').trim();
    if (!content) continue;
    const cost = estimateClientTokens(content) + 4;
    if (out.length && used + cost > limit) break;
    out.unshift({role:m.role,content});
    used += cost;
  }
  return out;
}

// ── Sound Effects ─────────────────────────────────────────────────────────────
let audioCtx = null;
let soundOn = localStorage.getItem('hush-sound') !== 'off';

function syncSoundButtons() {
  const label = soundOn ? t('btn_sound_on', 'ปิดเสียงเอฟเฟกต์') : t('btn_sound_off', 'เปิดเสียงเอฟเฟกต์');
  for (const id of ['soundToggle', 'soundToggleChat', 'drawerSoundBtn', 'settingsSoundToggle']) {
    const b = document.getElementById(id);
    if (!b) continue;
    b.classList.toggle('sound-off', !soundOn);
    b.classList.toggle('sound-toggle-active', soundOn);
    b.title = label;
    b.setAttribute('aria-label', label);
    b.setAttribute('aria-pressed', String(soundOn));
  }
  const statusSpan = document.getElementById('settingsSoundLabel');
  if (statusSpan) {
    statusSpan.textContent = soundOn ? t('sound_status_on', 'เปิดเสียงอยู่') : t('sound_status_off', 'ปิดเสียงอยู่');
  }
}

function toggleSound(setTo) {
  const next = typeof setTo === 'boolean' ? setTo : !soundOn;
  const changed = next !== soundOn;
  soundOn = next;
  try { localStorage.setItem('hush-sound', soundOn ? 'on' : 'off'); } catch {}
  syncSoundButtons();
  if (changed && soundOn) playSfx('toggle');
}

function initSoundButton() {
  syncSoundButtons();
}

function playTone(ctx, opts) {
  try {
    const startAt = ctx.currentTime + (opts.delay || 0);
    const dur = opts.duration || 0.08;
    const attack = Math.min(opts.attack || 0.008, dur * 0.4);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, startAt);
    if (opts.freqEnd && opts.freqEnd !== opts.freq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, opts.freqEnd), startAt + dur);
    }
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.linearRampToValueAtTime(opts.gainPeak || 0.032, startAt + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + dur + 0.015);
  } catch {}
}

function playSfx(kind = 'tap') {
  if (!soundOn) return;
  try {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx || new Ctor();
    if (audioCtx.state === 'suspended' && typeof audioCtx.resume === 'function') {
      audioCtx.resume().catch(() => {});
    }
    if (typeof audioCtx.createOscillator !== 'function' || typeof audioCtx.createGain !== 'function') return;

    if (kind === 'send') {
      playTone(audioCtx, { freq: 523.25, duration: 0.09, gainPeak: 0.028, delay: 0 });
      playTone(audioCtx, { freq: 659.25, duration: 0.11, gainPeak: 0.026, delay: 0.04 });
      playTone(audioCtx, { freq: 783.99, duration: 0.14, gainPeak: 0.022, delay: 0.08 });
    } else if (kind === 'receive' || kind === 'success') {
      playTone(audioCtx, { freq: 587.33, duration: 0.14, gainPeak: 0.028, delay: 0 });
      playTone(audioCtx, { freq: 880, duration: 0.22, gainPeak: 0.026, delay: 0.065 });
    } else if (kind === 'nav') {
      playTone(audioCtx, { freq: 392, duration: 0.07, gainPeak: 0.02, delay: 0 });
      playTone(audioCtx, { freq: 587.33, duration: 0.1, gainPeak: 0.022, delay: 0.03 });
    } else if (kind === 'favorite') {
      playTone(audioCtx, { freq: 739.99, duration: 0.09, gainPeak: 0.026, delay: 0 });
      playTone(audioCtx, { freq: 987.77, duration: 0.16, gainPeak: 0.025, delay: 0.045 });
    } else if (kind === 'theme') {
      playTone(audioCtx, { freq: 293.66, duration: 0.18, gainPeak: 0.02, delay: 0 });
      playTone(audioCtx, { freq: 440, duration: 0.2, gainPeak: 0.022, delay: 0.035 });
      playTone(audioCtx, { freq: 659.25, duration: 0.24, gainPeak: 0.02, delay: 0.075 });
    } else if (kind === 'modalOpen') {
      playTone(audioCtx, { freq: 340, freqEnd: 520, duration: 0.095, gainPeak: 0.024 });
    } else if (kind === 'modalClose') {
      playTone(audioCtx, { freq: 480, freqEnd: 310, duration: 0.085, gainPeak: 0.022 });
    } else if (kind === 'toggle') {
      playTone(audioCtx, { freq: 580, freqEnd: 740, type: 'triangle', duration: 0.06, gainPeak: 0.024 });
    } else if (kind === 'delete' || kind === 'error') {
      playTone(audioCtx, { freq: 240, freqEnd: 175, type: 'triangle', duration: 0.11, gainPeak: 0.028, delay: 0 });
      playTone(audioCtx, { freq: 185, freqEnd: 135, type: 'triangle', duration: 0.13, gainPeak: 0.022, delay: 0.075 });
    } else {
      playTone(audioCtx, { freq: 510, freqEnd: 370, type: 'triangle', duration: 0.048, gainPeak: 0.02 });
    }
  } catch (e) {}
}

function previewSound() {
  if (!soundOn) toggleSound(true);
  playSfx('send');
  setTimeout(() => playSfx('receive'), 260);
}

const SPECIALIZED_SFX_SELECTOR = '.send,.heart,.theme-card,.theme-dot-btn,#themeToggleBtn,#soundToggle,#soundToggleChat,#drawerSoundBtn,#settingsSoundToggle,[data-view],[data-mobile-view]';
document.addEventListener('click', e => {
  if (!e.target || !e.target.closest) return;
  if (e.target.closest(SPECIALIZED_SFX_SELECTOR)) return;
  if (e.target.closest('button,.chip,.nav-item,.character-card,.mini-character,.lang-card,.profile-pill,.mobile-drawer-link')) {
    playSfx('tap');
  }
}, { passive: true });

// ── Chat UI & Room State ──────────────────────────────────────────────────────
function setChatBackground(character) {
  const bg = document.getElementById('chatBackground');
  if (!bg || !bg.style) return;
  const src = character && (character.imageUrl || character.avatarUrl);
  if (src) {
    bg.style.backgroundImage = `url("${src}")`;
    bg.style.opacity = '.38';
  } else {
    bg.style.backgroundImage = '';
    bg.style.opacity = '.18';
  }
}

function renderChatInfo(character) {
  const rawC = character || (typeof characters !== 'undefined' ? (characters.find(x => x.name === currentCharacter) || characters[0]) : null);
  const c = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(rawC) : rawC;
  if (!c) return;
  const av = document.getElementById('infoAvatar');
  if (av) {
    const src = c.avatarUrl || c.imageUrl || '';
    av.className = 'avatar ' + (c.art || 'a2');
    av.textContent = src ? '' : (c.avatar || (c.name ? c.name[0].toUpperCase() : '✦'));
    if (av.style) {
      av.style.backgroundImage = src ? `url(${JSON.stringify(src)})` : '';
      av.style.backgroundSize = src ? 'cover' : '';
      av.style.backgroundPosition = src ? 'center' : '';
    }
  }
  const nameEl = document.getElementById('infoName');
  if (nameEl) nameEl.textContent = c.name || '';
  const capEl = document.getElementById('infoCaption');
  if (capEl) capEl.textContent = c.role || '';
  const storyEl = document.getElementById('infoStory');
  if (storyEl) {
    const story = String(c.story || c.desc || c.greeting || '—').replace(/\*([^*\r\n]+?)\*/g, '$1').trim();
    storyEl.textContent = story || '—';
  }
  const genresEl = document.getElementById('infoGenres');
  if (genresEl) {
    const genres = Array.isArray(c.genre) ? c.genre.filter(g => typeof g === 'string' && g.trim()) : [];
    genresEl.innerHTML = genres.length
      ? genres.map(g => `<span class="chat-tag">${safe(typeof formatGenreLabel === 'function' ? formatGenreLabel(g) : g)}</span>`).join('')
      : '<span class="chat-tag">—</span>';
  }
  const guideEl = document.getElementById('infoGuidelines');
  if (guideEl) {
    guideEl.textContent = c.adult
      ? t('mira_guidelines_text', 'ตัวละครสมมติที่เป็นผู้ใหญ่ทั้งคู่ · ทุกฉากใกล้ชิดต้องเกิดจากความยินยอมของทุกฝ่าย · หยุดหรือเปลี่ยนฉากได้ทุกเมื่อ')
      : t('guidelines_non_adult', 'ตัวละครสมมติ · เนื้อหาทางเพศไม่เปิดใช้สำหรับตัวละครนี้ · หยุดหรือเปลี่ยนฉากได้ทุกเมื่อ');
  }
}

function getCharacterAvatarHtml(c) {
  return c.avatarUrl
    ? `<div class="msg-avatar" style="background-image:url('${safe(c.avatarUrl)}');background-size:cover"></div>`
    : `<div class="msg-avatar">${safe(c.avatar || (c.name ? c.name[0] : '✦') || '✦')}</div>`;
}

function getUserAvatarHtml() {
  const userP = getActiveUserProfile();
  return userP.avatarUrl
    ? `<div class="msg-avatar" style="background-image:url('${safe(userP.avatarUrl)}');background-size:cover"></div>`
    : `<div class="msg-avatar">${safe((userP.name || 'คุณ')[0].toUpperCase())}</div>`;
}

function renderChatMessages() {
  const msgs = document.getElementById('messages');
  const rawC = window.activeRoleplayCharacter || (typeof characters !== 'undefined' ? (characters.find(x => x.name === currentCharacter) || characters[0]) : null);
  const c = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(rawC) : rawC;
  if (!msgs || !c) return;
  const history = window.activeChatHistory || [];
  const cAv = getCharacterAvatarHtml(c);
  const uAv = getUserAvatarHtml();
  const divider = history.length
    ? safe(t('chat_history_divider', 'ประวัติบทสนทนาที่บันทึกไว้'))
    : safe(t('chat_start_divider', 'เริ่มต้นบทสนทนาใหม่'));

  let html = `<div class="day-divider">${divider}</div><div class="message">${cAv}<div><div class="bubble">${renderRoleplayText(c.greeting)}</div><div class="msg-time">${safe(t('time_start', 'เริ่มต้น'))}</div></div></div>`;
  for (const m of history) {
    if (m.role === 'user') {
      html += `<div class="message user">${uAv}<div><div class="bubble">${renderRoleplayText(m.content)}</div><div class="msg-time">${safe(t('time_now', 'ตอนนี้'))} · <button class="text-link" style="font-size:10px;cursor:pointer" onclick="editLastUserMessage()">${safe(t('btn_edit', '✎ แก้ไข'))}</button></div></div></div>`;
    } else {
      html += `<div class="message">${cAv}<div><div class="bubble">${renderRoleplayText(m.content)}</div><div class="msg-time">${safe(t('time_now', 'ตอนนี้'))} · <button class="text-link" style="font-size:10px;cursor:pointer" onclick="regenerateReply()">${safe(t('btn_retry', '↺ ลองใหม่'))}</button></div></div></div>`;
    }
  }
  msgs.innerHTML = html;
  msgs.scrollTop = msgs.scrollHeight;
}

async function openChat(name, forceReset = false) {
  let c = characters.find(x => x.name === name);
  if (!c) {
    await waitCharactersReady();
    c = characters.find(x => x.name === name);
  }
  if (!c) return;

  if (currentCharacter && currentCharacter !== name && document.getElementById('messages')) {
    saveCharacterChatStore(currentCharacter, window.activeChatHistory || []);
  }

  currentCharacter = name;
  window.activeRoleplayCharacter = c;
  setChatBackground(c);
  loadTokenBudget();
  saveWorldSettings();
  if (typeof updateProviderStatus === 'function') updateProviderStatus();
  if (typeof renderModelChoices === 'function') renderModelChoices();

  const nameEl = document.getElementById('chatName');
  if (nameEl) nameEl.textContent = c.name;
  renderChatInfo(c);

  const chatAv = document.getElementById('chatAvatar');
  const bubAv = document.getElementById('bubbleAvatar');
  if (c.avatarUrl) {
    if (chatAv) {
      chatAv.textContent = '';
      if (chatAv.style) { chatAv.style.backgroundImage = `url("${safe(c.avatarUrl)}")`; chatAv.style.backgroundSize = 'cover'; }
    }
    if (bubAv) {
      bubAv.textContent = '';
      if (bubAv.style) { bubAv.style.backgroundImage = `url("${safe(c.avatarUrl)}")`; bubAv.style.backgroundSize = 'cover'; }
    }
  } else {
    const ch = c.avatar || (c.name ? c.name[0].toUpperCase() : '?');
    if (chatAv) {
      chatAv.textContent = ch;
      if (chatAv.style) chatAv.style.backgroundImage = '';
      chatAv.className = 'avatar ' + (c.art || '');
    }
    if (bubAv) {
      bubAv.textContent = ch;
      if (bubAv.style) { bubAv.style.backgroundImage = ''; bubAv.style.background = c.adult ? '#493c3e' : ''; }
    }
  }

  if (!forceReset && sessionChatStores[name]) {
    window.activeChatHistory = (sessionChatStores[name].history || []).slice();
  } else {
    window.activeChatHistory = [];
    sessionChatStores[name] = {
      history: [],
      aiMemory: forceReset ? [] : getCharacterMemoryList(name),
      lastUpdated: Date.now()
    };
    persistChatSession(name);
  }

  renderChatMessages();
  renderCharacterMemoryUi(name);
  const msgs = document.getElementById('messages');
  if (msgs) {
    msgs.classList.remove('switching');
    void msgs.offsetWidth;
    msgs.classList.add('switching');
  }

  const lv = document.getElementById('chatListView');
  const rv = document.getElementById('chatRoomView');
  if (lv && lv.style) lv.style.display = 'none';
  if (rv && rv.style) rv.style.display = 'grid';
  showView('chat');
  const msgInput = document.getElementById('messageInput');
  if (msgInput) {
    msgInput.value = '';
    if (msgInput.style) msgInput.style.height = '';
    if (!(typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 700)) {
      msgInput.focus?.();
    }
  }
  syncMobileChatViewport();
}

function appendErrorBubble(msgs, message) {
  const row = document.createElement('div');
  row.className = 'message error-message';
  row.innerHTML = `<div class="msg-avatar">!</div><div><div class="bubble"></div><div class="msg-time">${safe(t('time_now', 'ตอนนี้'))} · <button class="text-link" style="font-size:10px;cursor:pointer" onclick="regenerateReply()">${safe(t('btn_retry', '↺ ลองใหม่'))}</button></div></div>`;
  row.querySelector('.bubble').textContent = message || t('ai_chat_failed', 'คุยกับ AI ไม่สำเร็จ');
  msgs.appendChild(row);
}

async function sendMessage() {
  const input = document.getElementById('messageInput');
  const text = input ? input.value.trim() : '';
  if (!text) return;
  playSfx('send');

  const msgs = document.getElementById('messages');
  const history = window.activeChatHistory || (window.activeChatHistory = []);
  const userMessage={role:'user',content:text};
  history.push(userMessage);

  // Remove any stale trailing error bubble before sending new user turn
  const staleErr = msgs?.querySelector('.message.error-message:last-child');
  if (staleErr) staleErr.remove();

  const uAvHtml = getUserAvatarHtml();
  const el = document.createElement('div');
  el.className = 'message user';
  el.innerHTML = `${uAvHtml}<div><div class="bubble"></div><div class="msg-time">${safe(t('time_now', 'ตอนนี้'))} · <button class="text-link" style="font-size:10px;cursor:pointer" onclick="editLastUserMessage()">${safe(t('btn_edit', '✎ แก้ไข'))}</button></div></div>`;
  el.querySelector('.bubble').innerHTML = renderRoleplayText(text);
  msgs.appendChild(el);
  input.value = '';
  if (input.style) input.style.height = '';
  input.disabled = true;
  const send = document.querySelector('.send');
  if (send) send.disabled = true;
  msgs.scrollTop = msgs.scrollHeight;

  const c = window.activeRoleplayCharacter || {};
  const cAvHtml = getCharacterAvatarHtml(c);
  const wait = document.createElement('div');
  wait.className = 'message typing-message';
  wait.innerHTML = `${cAvHtml}<div><div class="bubble typing-bubble"><span class="typing-label">${safe(t('chat_typing_label', 'กำลังเขียนเรื่องต่อ'))}</span><span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div></div>`;
  msgs.appendChild(wait);

  window.isGeneratingReply = true;
  try {
    const payload=buildChatMessages(window.activeRoleplayCharacter,history.slice(-24));
    const answer=await apiChat(payload);
    const lastUserMsg = [...history].reverse().find(m => m && m.role === 'user');
    const cleanAnswer = autoRecordTurnMemory(currentCharacter, lastUserMsg ? lastUserMsg.content : '', answer);
    history.push({ role: 'assistant', content: cleanAnswer });
    const row = createAssistantReplyElement(cAvHtml, cleanAnswer);
    wait.replaceWith(row);
    playSfx('receive');
  } catch (e) {
    wait.remove();
    playSfx('error');
    appendErrorBubble(msgs, e.message);
  } finally {
    window.isGeneratingReply = false;
    if (input) input.disabled = false;
    if (send) send.disabled = false;
    if (input && !(typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 700)) input.focus?.();
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
    saveCharacterChatStore(currentCharacter, history);
    syncMobileChatViewport();
  }
}

async function regenerateReply() {
  const history = window.activeChatHistory || [];
  if (!history.length) {
    showToast(t('retry_no_messages', 'ยังไม่มีข้อความให้ลองใหม่'));
    return;
  }
  const msgs = document.getElementById('messages');
  const lastRow = msgs?.querySelector('.message:last-child');
  if (lastRow && lastRow.classList.contains('error-message')) {
    lastRow.remove();
  } else if (history[history.length - 1].role === 'assistant') {
    history.pop();
    if (lastRow && !lastRow.classList.contains('user')) lastRow.remove();
  }

  const c = window.activeRoleplayCharacter || {};
  const cAvHtml = getCharacterAvatarHtml(c);
  const wait = document.createElement('div');
  wait.className = 'message typing-message';
  wait.innerHTML = `${cAvHtml}<div><div class="bubble typing-bubble"><span class="typing-label">${safe(t('chat_typing_label', 'กำลังเขียนเรื่องต่อ'))}</span><span class="typing-dots"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></span></div></div>`;
  msgs.appendChild(wait);

  window.isGeneratingReply = true;
  try {
    const payload=buildChatMessages(window.activeRoleplayCharacter,history.slice(-24));
    const answer=await apiChat(payload);
    const lastUserMsg = [...history].reverse().find(m => m && m.role === 'user');
    const cleanAnswer = autoRecordTurnMemory(currentCharacter, lastUserMsg ? lastUserMsg.content : '', answer);
    history.push({ role: 'assistant', content: cleanAnswer });
    wait.replaceWith(createAssistantReplyElement(cAvHtml, cleanAnswer));
    playSfx('receive');
  } catch (e) {
    wait.remove();
    playSfx('error');
    appendErrorBubble(msgs, e.message);
    showToast(e.message || t('ai_chat_failed', 'คุยกับ AI ไม่สำเร็จ'));
  } finally {
    window.isGeneratingReply = false;
    msgs.scrollTop = msgs.scrollHeight;
    saveCharacterChatStore(currentCharacter, history);
  }
}

function editLastUserMessage() {
  const history = window.activeChatHistory || [];
  if (!history.length) return;
  const msgs = document.getElementById('messages');
  while (msgs?.querySelector('.message:last-child.error-message')) {
    msgs.querySelector('.message:last-child.error-message').remove();
  }
  if (history[history.length - 1].role === 'assistant') {
    history.pop();
    const lastRow = msgs?.querySelector('.message:last-child');
    if (lastRow && !lastRow.classList.contains('user')) lastRow.remove();
  }
  if (history.length && history[history.length - 1].role === 'user') {
    const lastUser = history.pop();
    const lastRow = msgs?.querySelector('.message:last-child');
    if (lastRow && lastRow.classList.contains('user')) lastRow.remove();
    const input = document.getElementById('messageInput');
    if (input) {
      input.value = lastUser.content;
      input.focus();
    }
    saveCharacterChatStore(currentCharacter, history);
  }
}

function openChatMenu() {
  const el = document.getElementById('chatMenuModal');
  if (el) el.classList.add('show');
  playSfx('modalOpen');
}
function closeChatMenu() {
  const el = document.getElementById('chatMenuModal');
  if (el) el.classList.remove('show');
  playSfx('modalClose');
}

function refreshCharInfoModal() {
  const rawC = window.activeRoleplayCharacter;
  const c = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(rawC) : rawC;
  if (!c) return false;
  const titleEl = document.getElementById('charInfoTitle');
  const s = document.getElementById('charInfoSubtitle');
  const r = document.getElementById('charInfoRole');
  const a = document.getElementById('charInfoAppearance');
  const d = document.getElementById('charInfoDesc');
  if (titleEl) titleEl.textContent = c.name || t('info_modal_default_title', 'ข้อมูลตัวละคร');
  if (s) s.textContent = c.role || '';
  if (r) r.textContent = c.role || '-';
  if (a) a.textContent = c.appearance || t('info_unspecified', 'ไม่ระบุ');
  if (d) d.textContent = c.desc || '-';
  return true;
}

function openCharInfo() {
  const c = window.activeRoleplayCharacter;
  if (!c) {
    showToast(t('char_info_not_found', 'ไม่พบข้อมูลตัวละคร'));
    return;
  }
  refreshCharInfoModal();
  const el = document.getElementById('charInfoModal');
  if (el) el.classList.add('show');
  playSfx('modalOpen');
}

function closeCharInfo() {
  const el = document.getElementById('charInfoModal');
  if (el) el.classList.remove('show');
  playSfx('modalClose');
}

function exportChatMarkdown() {
  const c = window.activeRoleplayCharacter || { name: currentCharacter };
  const history = window.activeChatHistory || [];
  if (!history.length) {
    showToast(t('chat_empty_export', 'ยังไม่มีบทสนทนาให้บันทึก'));
    return;
  }
  const userName = getActiveUserProfile().name || t('speaker_user', 'คุณ');
  let md = `# Roleplay: ${c.name}\n**Date:** ${new Date().toLocaleString()}\n\n---\n\n`;
  for (const m of history) {
    const speaker = m.role === 'assistant' ? c.name : userName;
    md += `### ${speaker}\n${m.content}\n\n`;
  }
  if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roleplay-${c.name}-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast(t('export_md_done', 'บันทึกเรื่องราวเป็นไฟล์ Markdown แล้ว'));
  }
}

function copyChatText() {
  const c = window.activeRoleplayCharacter || { name: currentCharacter };
  const history = window.activeChatHistory || [];
  if (!history.length) {
    showToast(t('chat_empty_copy', 'ยังไม่มีบทสนทนา'));
    return;
  }
  const userName = getActiveUserProfile().name || t('speaker_user', 'คุณ');
  let text = `[Roleplay: ${c.name}]\n\n`;
  for (const m of history) {
    const speaker = m.role === 'assistant' ? c.name : userName;
    text += `${speaker}: ${m.content}\n\n`;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text)
      .then(() => showToast(t('copied_chat', 'คัดลอกบทสนทนาแล้ว')))
      .catch(() => showToast(t('toast_copy_failed', 'คัดลอกไม่สำเร็จ')));
  } else {
    showToast(t('copy_clipboard_unsupported', 'เบราว์เซอร์ไม่รองรับคลิปบอร์ด'));
  }
}

const AI_MEMORY_MAX_ITEMS = 18;
const AI_MEMORY_ITEM_MAX_CHARS = 220;
const MEMORY_SIGNAL_RE = /(?:จำไว้|ชื่อ(?:ฉัน|ผม|เรา|จริง|เล่น)|เรียก(?:ฉัน|ผม|เรา)ว่า|สัญญา|ความลับ|ข้อตกลง|มอบให้|แพ้|กลัว|เกลียด|เป็นแฟน|แต่งงาน|อาศัยอยู่|my name is|call me|remember|promise|secret|allergic|live in)/i;

function normalizeMemoryKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/^[-•*\d.)\s]+/, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();
}

function sanitizeMemoryItems(items) {
  const deduped = new Map();
  for (const raw of Array.isArray(items) ? items : []) {
    const clean = String(raw || '')
      .replace(/\s+/g, ' ')
      .replace(/^[-•*\d.)\s]+/, '')
      .trim()
      .slice(0, AI_MEMORY_ITEM_MAX_CHARS);
    if (!clean) continue;
    const key = normalizeMemoryKey(clean);
    if (!key) continue;
    if (deduped.has(key)) deduped.delete(key);
    deduped.set(key, clean);
  }
  const out = Array.from(deduped.values());
  return out.length > AI_MEMORY_MAX_ITEMS ? out.slice(-AI_MEMORY_MAX_ITEMS) : out;
}

function getCharacterMemoryList(charName) {
  const key = charName || currentCharacter;
  if (!key || typeof sessionChatStores === 'undefined') return [];
  const store = sessionChatStores[key];
  if (!store || !Array.isArray(store.aiMemory)) return [];
  return sanitizeMemoryItems(store.aiMemory);
}

function setCharacterMemoryList(charName, items, persist = true) {
  const key = charName || currentCharacter;
  if (!key) return [];
  const clean = sanitizeMemoryItems(items);
  if (!sessionChatStores[key]) {
    sessionChatStores[key] = {
      history: key === currentCharacter ? (window.activeChatHistory || []).slice() : [],
      aiMemory: clean,
      lastUpdated: Date.now()
    };
  } else {
    sessionChatStores[key].aiMemory = clean;
    sessionChatStores[key].lastUpdated = Date.now();
  }
  if (persist && typeof persistChatSession === 'function') {
    persistChatSession(key);
  }
  if (typeof renderChatList === 'function') renderChatList();
  renderCharacterMemoryUi(key);
  return clean;
}

function saveCharacterChatStore(charName, history) {
  if (!charName) return;
  sessionChatStores[charName] = {
    history: (history || []).slice(),
    aiMemory: getCharacterMemoryList(charName),
    lastUpdated: Date.now()
  };
  if (typeof persistChatSession === 'function') persistChatSession(charName);
  if (typeof renderChatList === 'function') renderChatList();
}

function createAssistantReplyElement(avatarHtml, text) {
  const row = document.createElement('div');
  row.className = 'message';
  row.innerHTML = `${avatarHtml}<div><div class="bubble"></div><div class="msg-time">${safe(t('time_now', 'ตอนนี้'))} · <button class="text-link" style="font-size:10px;cursor:pointer" onclick="regenerateReply()">${safe(t('btn_retry', '↺ ลองใหม่'))}</button></div></div>`;
  row.querySelector('.bubble').innerHTML = renderRoleplayText(text);
  return row;
}

function buildAutoMemorySystemBlock(character) {
  const charName = character && character.name;
  const list = getCharacterMemoryList(charName);
  const parts = [];
  if (list.length) {
    parts.push(`[ความจำระยะยาวถาวร]\n${list.map(item => `- ${item}`).join('\n')}`);
  }
  parts.push(
    `[Stealth Auto-Memory]\nหากฉากนี้มีความจริงใหม่สำคัญ (ชื่อ/ความสัมพันธ์/คำสัญญา/เหตุการณ์/สถานที่/สิ่งของ) ให้แนบท้ายสุดของคำตอบหลังเนื้อเรื่องจบว่า <memory>- สรุปสั้นที่สุดไม่เกิน 15 คำ</memory> (ห้ามซ้ำกับความจำที่มีอยู่ ถ้าไม่มีเรื่องสำคัญไม่ต้องใส่ <memory>)`
  );
  return parts.join('\n\n');
}

function parseMemoryBullets(rawBlock) {
  return String(rawBlock || '')
    .split(/\r?\n|(?:\s*[;•]\s*)/)
    .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
    .filter(line => line.length >= 2);
}

function extractStealthMemory(rawText) {
  const source = String(rawText || '');
  const extracted = [];

  let visible = source.replace(/<memory\b[^>]*>([\s\S]*?)<\/memory>/gi, (_, inner) => {
    extracted.push(...parseMemoryBullets(inner));
    return '';
  });

  visible = visible.replace(/<memory\b[^>]*>([\s\S]*)$/gi, (_, inner) => {
    extracted.push(...parseMemoryBullets(inner));
    return '';
  });

  visible = visible.replace(/\[MEMORY\]([\s\S]*?)\[\/MEMORY\]/gi, (_, inner) => {
    extracted.push(...parseMemoryBullets(inner));
    return '';
  });

  visible = visible.replace(/^\s*\[MEMORY:\s*([^\]]+)\]\s*$/gim, (_, inner) => {
    extracted.push(...parseMemoryBullets(inner));
    return '';
  });

  return {
    visibleText: visible.replace(/\n{3,}/g, '\n\n').trim(),
    extracted: sanitizeMemoryItems(extracted)
  };
}

function synthesizeCompactTurnMemory(userText, assistantVisibleText) {
  const u = String(userText || '').replace(/\s+/g, ' ').trim();
  const a = String(assistantVisibleText || '').replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
  if (u && MEMORY_SIGNAL_RE.test(u)) {
    return [u.slice(0, 140)];
  }
  if (a && MEMORY_SIGNAL_RE.test(a) && a.length >= 16) {
    const sentence = a.split(/[.!?\n]/).map(s => s.trim()).find(s => s.length >= 10 && MEMORY_SIGNAL_RE.test(s));
    if (sentence) return [sentence.slice(0, 140)];
  }
  return [];
}

function autoRecordTurnMemory(charName, userText, rawAnswer) {
  const { visibleText, extracted } = extractStealthMemory(rawAnswer);
  const candidates = extracted.length
    ? extracted
    : synthesizeCompactTurnMemory(userText, visibleText);

  if (charName && candidates.length) {
    const existing = getCharacterMemoryList(charName);
    const merged = sanitizeMemoryItems([...existing, ...candidates]);
    const changed = merged.length !== existing.length || merged.some((item, idx) => item !== existing[idx]);
    if (changed) {
      setCharacterMemoryList(charName, merged, true);
    }
  }
  return visibleText || String(rawAnswer || '').replace(/<\/?memory[^>]*>/gi, '').trim();
}

function renderMemoryCountLabel(count) {
  const tpl = t('memory_count_badge', '{n} รายการ');
  if (/\{n\}|\{count\}/.test(tpl)) {
    return tpl.replace(/\{n\}|\{count\}/g, String(count));
  }
  return String(count);
}

function renderCharacterMemoryUi(charName) {
  if (typeof document === 'undefined') return;
  const target = charName || currentCharacter || 'Mira';
  if (currentCharacter && target !== currentCharacter) return;
  const items = getCharacterMemoryList(target);

  const headBadge = document.getElementById('chatMemoryBadge');
  if (headBadge) {
    headBadge.textContent = String(items.length);
    headBadge.hidden = items.length === 0;
  }

  const headBtn = document.getElementById('chatMemoryBtn');
  if (headBtn && headBtn.classList) {
    headBtn.classList.toggle('has-memory', items.length > 0);
  }

  const infoBadge = document.getElementById('infoMemoryBadge');
  if (infoBadge) {
    infoBadge.textContent = items.length ? renderMemoryCountLabel(items.length) : t('memory_auto_badge', '● AUTO');
  }

  const emptyHint = safe(t('memory_empty_hint', 'AI จะแอบบันทึกความจำสำคัญให้อัตโนมัติระหว่างคุย'));
  const infoList = document.getElementById('infoMemoryList');
  if (infoList) {
    infoList.innerHTML = items.length
      ? items.map(item => `<div class="info-memory-item">• ${safe(item)}</div>`).join('')
      : `<div class="info-memory-empty">${emptyHint}</div>`;
  }

  const modalList = document.getElementById('memoryModalList');
  if (modalList) {
    modalList.innerHTML = items.length
      ? items.map((item, idx) => `<div class="memory-modal-item"><span>• ${safe(item)}</span><button type="button" class="memory-item-del" onclick="removeCharacterMemoryItem(${idx})" aria-label="Remove">×</button></div>`).join('')
      : `<div class="info-memory-empty">${emptyHint}</div>`;
  }
}

function openMemoryModal() {
  if (typeof closeChatMenu === 'function') closeChatMenu();
  renderCharacterMemoryUi(currentCharacter);
  const modal = document.getElementById('memoryModal');
  if (modal && modal.classList) modal.classList.add('open');
  playSfx('modalOpen');
}

function closeMemoryModal() {
  const modal = document.getElementById('memoryModal');
  if (modal && modal.classList) {
    if (modal.classList.contains('open')) playSfx('modalClose');
    modal.classList.remove('open');
  }
}

function addCustomMemoryItem() {
  const input = document.getElementById('customMemoryInput');
  const val = String(input?.value || '').trim();
  if (!val || !currentCharacter) return;
  const updated = setCharacterMemoryList(currentCharacter, [...getCharacterMemoryList(currentCharacter), val], true);
  if (input) input.value = '';
  if (updated.length) {
    playSfx('tap');
    showToast(t('toast_memory_added', 'เพิ่มความจำแล้ว'));
  }
}

function removeCharacterMemoryItem(index) {
  if (!currentCharacter) return;
  const list = getCharacterMemoryList(currentCharacter);
  if (index < 0 || index >= list.length) return;
  const next = list.filter((_, i) => i !== index);
  setCharacterMemoryList(currentCharacter, next, true);
  playSfx('delete');
  showToast(t('toast_memory_removed', 'ลบความจำรายการนี้แล้ว'));
}

async function consolidateCharacterMemoryNow() {
  const charName = currentCharacter;
  if (!charName) return;
  const existing = getCharacterMemoryList(charName);
  const history = Array.isArray(window.activeChatHistory) ? window.activeChatHistory : [];
  if (!existing.length && !history.length) return;

  const btn = document.getElementById('consolidateMemoryBtn');
  const prevLabel = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = t('memory_consolidating', 'กำลังให้ AI ย่อยความจำ...');
  }

  try {
    const recentSnippet = history
      .slice(-16)
      .map(m => `${m.role === 'user' ? 'User' : charName}: ${String(m.content || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`)
      .join('\n');

    const messages = [
      {
        role: 'system',
        content: 'คุณคือตัวช่วยจัดการความจำบทบาทสมมติ สรุปข้อเท็จจริงสำคัญที่ควรจำระยะยาวเท่านั้น (ชื่อ ความสัมพันธ์ สัญญา เหตุการณ์สำคัญ สิ่งของ) ให้สั้น กระชับ ไม่ซ้ำซ้อน ตอบเป็นรายการขึ้นต้นด้วย "- " ไม่เกิน 10 ข้อ ภาษาเดียวกับเนื้อเรื่อง ไม่ต้องเกริ่นนำ'
      },
      {
        role: 'user',
        content: [
          `ตัวละคร: ${charName}`,
          existing.length ? `ความจำเดิม:\n${existing.map(x => `- ${x}`).join('\n')}` : '',
          recentSnippet ? `บทสนทนาล่าสุด:\n${recentSnippet}` : ''
        ].filter(Boolean).join('\n\n')
      }
    ];

    const raw = await apiChat(messages);
    const { visibleText, extracted } = extractStealthMemory(raw);
    const parsed = extracted.length ? extracted : sanitizeMemoryItems(parseMemoryBullets(visibleText));
    if (parsed.length) {
      setCharacterMemoryList(charName, parsed, true);
      playSfx('receive');
      showToast(t('toast_memory_consolidated', 'AI ย่อยและจัดระเบียบความจำแล้ว'));
    }
  } catch (e) {
    playSfx('error');
    showToast(e?.message || t('ai_chat_failed', 'คุยกับ AI ไม่สำเร็จ'));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = prevLabel;
    }
  }
}

function resetCharacterAll(charName) {
  const target = charName || currentCharacter;
  if (!target) return false;
  const confirmTpl = t('confirm_reset_all', 'ต้องการรีเซ็ตความจำ AI และประวัติแชตทั้งหมดของ {name} หรือไม่?');
  const confirmMsg = confirmTpl.includes('{name}') ? confirmTpl.replace(/\{name\}/g, target) : confirmTpl;
  if (typeof confirm === 'function' && !confirm(confirmMsg)) return false;

  if (typeof sessionConversationMemory !== 'undefined') delete sessionConversationMemory[target];
  if (typeof deleteChatSession === 'function') {
    deleteChatSession(target);
  } else {
    if (typeof sessionChatStores !== 'undefined') delete sessionChatStores[target];
    if (typeof saveChatStoresToLocalStorage === 'function') saveChatStoresToLocalStorage();
    const usesServer = typeof runtimeMode === 'undefined' || runtimeMode !== 'browser';
    if (usesServer && typeof fetch === 'function') {
      fetch('/api/chats/' + encodeURIComponent(target), { method: 'DELETE' }).catch(() => {});
    }
  }

  if (target === currentCharacter && typeof window !== 'undefined') {
    window.activeChatHistory = [];
    if (typeof renderChatMessages === 'function') renderChatMessages();
    if (typeof document !== 'undefined') {
      const msgs = document.getElementById('messages');
      if (msgs && msgs.classList && typeof msgs.classList.add === 'function') {
        msgs.classList.remove('switching');
        void msgs.offsetWidth;
        msgs.classList.add('switching');
      }
    }
    renderCharacterMemoryUi(target);
  }

  if (typeof renderChatList === 'function') renderChatList();
  playSfx('delete');
  const doneTpl = t('toast_reset_all_done', 'รีเซ็ตความจำและแชตทั้งหมดแล้ว');
  showToast(doneTpl.includes('{name}') ? doneTpl.replace(/\{name\}/g, target) : doneTpl);
  return true;
}

function restartChat() {
  return resetCharacterAll(currentCharacter);
}

let mobileViewportInitialized = false;

function autoResizeChatInput(el) {
  if (!el || !el.style) return;
  const maxH = typeof document !== 'undefined' && document.body?.classList?.contains?.('keyboard-open') ? 84 : 125;
  el.style.height = 'auto';
  el.style.height = Math.min(Math.max(el.scrollHeight || 42, 42), maxH) + 'px';
}

function syncMobileChatViewport() {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  const vvh = vv && vv.height ? Math.round(vv.height) : (typeof window !== 'undefined' ? window.innerHeight : 0);
  if (vvh && typeof document !== 'undefined') {
    document.documentElement?.style?.setProperty?.('--vvh', vvh + 'px');
  }
  const isMobileWidth = typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 700;
  const input = typeof document !== 'undefined' ? document.getElementById('messageInput') : null;
  const focusedInput = !!(input && typeof document !== 'undefined' && document.activeElement === input);
  const shrunk = !!(vv && typeof window !== 'undefined' && typeof window.innerHeight === 'number' && vv.height < window.innerHeight - 100);
  const isKeyboardOpen = !!(isMobileWidth && (focusedInput || shrunk));
  if (typeof document !== 'undefined') {
    document.body?.classList?.toggle?.('keyboard-open', isKeyboardOpen);
  }
  if (isKeyboardOpen || focusedInput) {
    const scrollMsgs = () => {
      const msgs = typeof document !== 'undefined' ? document.getElementById('messages') : null;
      if (msgs) msgs.scrollTop = msgs.scrollHeight;
    };
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(scrollMsgs);
    else scrollMsgs();
  }
  if (input && input.value) autoResizeChatInput(input);
}

function initMobileChatViewport() {
  if (mobileViewportInitialized) return;
  mobileViewportInitialized = true;
  if (typeof window !== 'undefined') {
    window.visualViewport?.addEventListener?.('resize', syncMobileChatViewport);
    window.visualViewport?.addEventListener?.('scroll', syncMobileChatViewport);
    window.addEventListener?.('resize', syncMobileChatViewport);
  }
  const input = typeof document !== 'undefined' ? document.getElementById('messageInput') : null;
  if (input && input.addEventListener) {
    input.addEventListener('input', () => {
      autoResizeChatInput(input);
      if (document.body?.classList?.contains?.('keyboard-open')) {
        const msgs = document.getElementById('messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
      }
    });
    input.addEventListener('focus', () => {
      syncMobileChatViewport();
      setTimeout(syncMobileChatViewport, 60);
    });
    input.addEventListener('blur', () => {
      setTimeout(syncMobileChatViewport, 120);
    });
  }
  syncMobileChatViewport();
}

if (typeof document !== 'undefined') {
  initMobileChatViewport();
}
