const characters = [
  {name:'Mira',role:'นักเดินทางผู้ตามหาเส้นทางที่หายไป',desc:'คืนที่แผนที่ขยับตัวเอง คุณกับเธออาจเป็นคนเดียวที่เห็นมัน',genre:['แฟนตาซี','ผจญภัย'],art:'art1',avatar:'M',creator:'moonlit',greeting:'ฝนปลายฤดูพร่างพรมลงบนหลังคาสถานีเก่า Mira ยืนกอดแผนที่ที่เปียกชื้น ก่อนหันมาสบตาคุณ\n\n“คุณก็มาตามหาเส้นทางที่หายไปเหมือนกันเหรอ?”'},
  {name:'Elias',role:'คนแปลกหน้าที่ร้านหนังสือหลังเที่ยงคืน',desc:'เขาจำตอนจบของหนังสือทุกเล่มได้ ยกเว้นเรื่องของตัวเอง',genre:['ลึกลับ','โรแมนซ์'],art:'art4',avatar:'E',creator:'paperghost',greeting:'เสียงกระดิ่งเหนือประตูดังขึ้น ร้านหนังสือเงียบงัน Elias เงยหน้าจากหน้ากระดาษ “มาช้าไปหนึ่งบทนะ”'},
  {name:'Sora',role:'นักบินที่ติดอยู่บนสถานีวงโคจร',desc:'สัญญาณขาดหาย โลกข้างล่างเงียบไป และเหลือเพียงคุณสองคน',genre:['ไซไฟ','slow burn'],art:'art2',avatar:'S',creator:'orbiting',greeting:'ไฟฉุกเฉินกะพริบเป็นจังหวะ Sora เคาะแผงควบคุมที่ดับสนิท “บอกทีว่านายมีแผนสำรอง”'},
  {name:'Arden',role:'ผู้พิทักษ์ป่าต้องมนตร์',desc:'เจ้าของคำสาปเก่าแก่ที่ไม่ไว้ใจมนุษย์ แต่จำชื่อคุณได้',genre:['แฟนตาซี','โรแมนซ์'],art:'art3',avatar:'A',creator:'mossandmoon',greeting:'ใบไม้ไหวทั้งที่ไม่มีลม เงาร่างหนึ่งก้าวออกจากแนวไม้ “ป่านี้ไม่ชอบคนแปลกหน้า แล้วเจ้ามาทำอะไรที่นี่?”'},
  {name:'June',role:'เพื่อนบ้านคนใหม่ในเมืองริมทะเล',desc:'วันธรรมดา ๆ ที่อาจกลายเป็นความทรงจำโปรดของคุณ',genre:['ชีวิตประจำวัน','โรแมนซ์'],art:'art5',avatar:'J',creator:'seaglass',greeting:'กลิ่นกาแฟลอยมาจากระเบียงข้าง ๆ June โบกมือทัก “เพิ่งย้ายมาใช่ไหม? ถ้าว่าง ฉันพาไปร้านโปรดได้นะ”'},
  {name:'The Host',role:'เจ้าของโรงแรมที่ไม่มีอยู่บนแผนที่',desc:'กฎข้อแรก: อย่าเปิดประตูห้อง 9 หลังเที่ยงคืน',genre:['ลึกลับ','สยองขวัญ'],art:'art6',avatar:'H',creator:'nightindex',greeting:'“ยินดีต้อนรับ” เจ้าของโรงแรมยื่นกุญแจทองเหลืองให้คุณ “มีห้องเดียวที่ยังว่างอยู่…ห้อง 9”'},
  {name:'Val',role:'นักดาบผู้ท้าทายคุณในสนามประลอง',desc:'คู่แข่งคนเดิม เดิมพันครั้งนี้ไม่ใช่แค่ชัยชนะ',genre:['ผู้ใหญ่ 18+','แฟนตาซี'],art:'art4',avatar:'V',creator:'redvelvet',adult:true,greeting:'Val ถอดถุงมือวางลงบนโต๊ะ แล้วสบตาคุณ “กติกาเดิมไหม? หรือคืนนี้อยากเปลี่ยนเกม”'},
  {name:'Noah',role:'เชฟกะดึกที่จำออเดอร์ของคุณได้',desc:'ร้านใกล้ปิดแล้ว แต่เขายังเก็บขนมชิ้นสุดท้ายไว้ให้',genre:['ผู้ใหญ่ 18+','ชีวิตประจำวัน'],art:'art3',avatar:'N',creator:'saffron',adult:true,greeting:'“นึกว่าจะไม่มาแล้ว” Noah วางชาร้อนลงตรงหน้า “วันนี้เหนื่อยไหม?”'}
];

const BUILTIN_CHAR_SLUGS = {
  'Mira': 'mira',
  'Elias': 'elias',
  'Sora': 'sora',
  'Arden': 'arden',
  'June': 'june',
  'The Host': 'thehost',
  'Val': 'val',
  'Noah': 'noah'
};

function getLocalizedCharacter(c) {
  if (!c) return c;
  const slug = BUILTIN_CHAR_SLUGS[c.name];
  if (!slug || typeof t !== 'function') return c;
  const thDict = (typeof I18N !== 'undefined' && I18N.th) ? I18N.th : {};
  const defRole = thDict['char_' + slug + '_role'];
  const defDesc = thDict['char_' + slug + '_desc'];
  const defGreeting = thDict['char_' + slug + '_greeting'];
  return {
    ...c,
    role: (!c.role || c.role === defRole) ? t('char_' + slug + '_role', c.role) : c.role,
    desc: (!c.desc || c.desc === defDesc) ? t('char_' + slug + '_desc', c.desc) : c.desc,
    greeting: (!c.greeting || c.greeting === defGreeting) ? t('char_' + slug + '_greeting', c.greeting) : c.greeting
  };
}

let currentFilter = 'ทั้งหมด';
let currentCharacter = 'Mira';
let pendingAdult = null;
let chatCount = 2;
let charactersLoaded = false;
let editingCharacterId = null;
let editingCharacterOriginalName = '';
const sessionChatStores = {};

const DEFAULT_GLOBAL_PROMPT = 'คุณคือคู่สนทนาใน roleplay สร้างเรื่องอย่างมีชีวิตชีวา คงความต่อเนื่องของโลกและเหตุการณ์ การจัดรูปแบบ: ข้อความในเครื่องหมายคำพูดคือบทพูด; ข้อความ *...* คือการกระทำ สีหน้า หรือความคิด ไม่ใช่เสียงพูด; บรรยายที่ไม่คร่อมเครื่องหมายเป็น narrative ตามบริบท ห้ามสลับความคิดเป็นบทพูดโดยพลการ อย่าบรรยายการกระทำหรือความคิดแทนผู้ใช้; แยกเสียงผู้บรรยายออกจากตัวละครได้ชัดเจน สามารถเล่นธีมผู้ใหญ่ได้เมื่อผู้ใช้ร้องขอ เฉพาะตัวละครผู้ใหญ่ที่ยินยอมพร้อมใจทุกฝ่าย เคารพขอบเขตและคำขอหยุด ห้ามเนื้อหาทางเพศเกี่ยวกับผู้เยาว์ การบังคับ หรือการแสวงหาประโยชน์ ปฏิบัติตามนโยบาย provider เสมอ';

let currentWorldSettings = {};
function saveWorldSettings(){currentWorldSettings={name:document.getElementById('worldName').value.trim(),description:document.getElementById('worldDescription').value.trim(),rules:document.getElementById('worldRules').value.trim()};remoteSet('worldSettings',currentWorldSettings)}
function worldPrompt(){const w=currentWorldSettings;return [w.name&&`โลก/ฉาก: ${w.name}`,w.description&&`คำอธิบายโลก: ${w.description}`,w.rules&&`กติกาโลก: ${w.rules}`].filter(Boolean).join('\n')}

function loadWorldSettings() {
  try {
    currentWorldSettings = JSON.parse(localStorage.getItem('hush-world-settings') || '{}');
  } catch {
    currentWorldSettings = {};
  }
  for (const [k, id] of [['name', 'worldName'], ['description', 'worldDescription'], ['rules', 'worldRules']]) {
    const el = document.getElementById(id);
    if (el) el.value = currentWorldSettings[k] || '';
  }
}

function setBudgetPreset(ctx, reply) {
  const e = document.getElementById('tokenBudget');
  const o = document.getElementById('maxReplyTokens');
  if (e) e.value = ctx;
  if (o) o.value = reply;
  saveTokenBudget();
}

function saveTokenBudget(){const e=document.getElementById('tokenBudget'),o=document.getElementById('maxReplyTokens');const n=Math.max(400,Math.min(8000,Number(e.value)||1200)),out=Math.max(64,Math.min(1200,Number(o.value)||300));e.value=n;o.value=out;remoteSet('tokenBudget',n);remoteSet('replyBudget',out);showToast(t('toast_budget_saved', 'บันทึกงบประมาณ token แล้ว'))}

function loadTokenBudget() {
  const e = document.getElementById('tokenBudget');
  if (e) e.value = localStorage.getItem('hush-context-budget') || '1200';
  const o = document.getElementById('maxReplyTokens');
  if (o) o.value = localStorage.getItem('hush-output-budget') || '300';
}

function safe(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderRoleplayText(text) {
  if (!text) return '';
  const escaped = safe(text);
  let formatted = escaped.replace(/(?:“|&quot;)([\s\S]*?)(?:”|&quot;)/g, '<span class="rp-speech">$1</span>');
  formatted = formatted.replace(/\*([^*\r\n]+?)\*/g, '<em class="rp-action">$1</em>');
  return formatted.replace(/\n/g, '<br>');
}

function insertFormat(type) {
  const input = document.getElementById('messageInput');
  if (!input) return;
  input.focus();
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  const val = input.value;
  const selected = val.substring(start, end);
  let prefix = '', suffix = '';
  if (type === 'speech') { prefix = '“'; suffix = '”'; }
  else if (type === 'action') { prefix = '*'; suffix = '*'; }
  if (selected.length > 0) {
    input.value = val.substring(0, start) + prefix + selected + suffix + val.substring(end);
    input.selectionStart = start + prefix.length;
    input.selectionEnd = end + prefix.length;
  } else {
    input.value = val.substring(0, start) + prefix + suffix + val.substring(end);
    const newPos = start + prefix.length;
    input.selectionStart = newPos;
    input.selectionEnd = newPos;
  }
  if (typeof playSfx === 'function') playSfx('tap');
}

// ── User Personas ─────────────────────────────────────────────────────────────
let userProfiles = [], activeProfileId = 'default', pendingUserCover = '', pendingUserAvatar = '';

function defaultUserProfile() {
  return {id:'default', name: typeof t==='function' ? t('persona_default_name', 'คุณ') : 'คุณ', role: typeof t==='function' ? t('persona_default_role', 'นักเดินทาง') : 'นักเดินทาง', appearance:'', bio:'', avatarUrl:'', coverUrl:''};
}

function loadUserProfiles() {
  try {
    const raw = localStorage.getItem('hush-user-profiles');
    userProfiles = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(userProfiles) || !userProfiles.length) userProfiles = [defaultUserProfile()];
  } catch {
    userProfiles = [defaultUserProfile()];
  }
  activeProfileId = localStorage.getItem('hush-active-profile-id') || userProfiles[0].id;
  if (!userProfiles.some(p => p.id === activeProfileId)) activeProfileId = userProfiles[0].id;
  updateTopbarProfile();
}

function saveUserProfilesToStorage() {
  try {
    localStorage.setItem('hush-user-profiles', JSON.stringify(userProfiles));
    localStorage.setItem('hush-active-profile-id', activeProfileId);
    remoteSet('userProfiles', userProfiles);
    remoteSet('activeProfileId', activeProfileId);
  } catch {}
  updateTopbarProfile();
}

function getActiveUserProfile() {
  const found = userProfiles.find(p => p.id === activeProfileId) || userProfiles[0] || defaultUserProfile();
  if (found && found.id === 'default' && typeof t === 'function') {
    const defNames = ['คุณ', 'You', '你', 'あなた'];
    const defRoles = ['นักเดินทาง', 'Traveler', '旅人'];
    return {
      ...found,
      name: defNames.includes(found.name) ? t('persona_default_name', 'คุณ') : found.name,
      role: defRoles.includes(found.role) ? t('persona_default_role', 'นักเดินทาง') : found.role
    };
  }
  return found;
}

function updateTopbarProfile() {
  const top = document.getElementById('topbarProfile');
  if (!top) return;
  const p = getActiveUserProfile();
  if (p.avatarUrl) {
    top.textContent = '';
    if (top.style) {
      top.style.backgroundImage = `url("${p.avatarUrl}")`;
      top.style.backgroundSize = 'cover';
    }
  } else {
    top.textContent = (p.name || 'คุณ')[0].toUpperCase();
    if (top.style) top.style.backgroundImage = '';
  }
}

function openUserProfileModal() {
  loadUserProfiles();
  renderProfilePills();
  populateProfileForm(getActiveUserProfile());
  const m = document.getElementById('userProfileModal');
  if (m) m.classList.add('show');
}

function closeUserProfileModal() {
  const m = document.getElementById('userProfileModal');
  if (m) m.classList.remove('show');
}

function renderProfilePills() {
  const pills = document.getElementById('profilePills');
  if (!pills) return;
  const unnamed = t('persona_unnamed', 'ไม่ระบุชื่อ');
  const pillNew = t('persona_pill_new', '＋ สร้าง Persona ใหม่');
  pills.innerHTML = userProfiles.map(p => {
    const active = p.id === activeProfileId ? 'active' : '';
    const displayName = (p.id === 'default' && ['คุณ', 'You', '你', 'あなた'].includes(p.name)) ? t('persona_default_name', 'คุณ') : (p.name || unnamed);
    return `<button type="button" class="profile-pill ${active}" data-id="${safe(p.id)}" onclick="selectUserProfile(this.dataset.id)">${safe(displayName)}</button>`;
  }).join('') + `<button type="button" class="profile-pill" style="border-style:dashed;color:var(--accent)" onclick="createNewUserProfile()">${pillNew}</button>`;
  const delBtn = document.getElementById('deleteProfileBtn');
  if (delBtn && delBtn.style) delBtn.style.display = userProfiles.length > 1 ? 'inline-block' : 'none';
}

function selectUserProfile(id) {
  activeProfileId = id;
  saveUserProfilesToStorage();
  renderProfilePills();
  populateProfileForm(getActiveUserProfile());
}

function createNewUserProfile() {
  const newId = 'p_' + Date.now();
  const newProfile = {id: newId, name: t('default_new_char_name', 'ตัวละครใหม่'), role:'', appearance:'', bio:'', avatarUrl:'', coverUrl:''};
  userProfiles.push(newProfile);
  activeProfileId = newId;
  saveUserProfilesToStorage();
  renderProfilePills();
  populateProfileForm(newProfile);
  showToast(t('persona_created', 'สร้าง Persona ใหม่แล้ว'));
}

function populateProfileForm(p) {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
  setVal('userName', p.name);
  setVal('userRole', p.role);
  setVal('userAppearance', p.appearance);
  setVal('userBio', p.bio);
  pendingUserCover = p.coverUrl || '';
  pendingUserAvatar = p.avatarUrl || '';
  const cp = document.getElementById('userCoverPreview');
  if (cp) {
    cp.hidden = !pendingUserCover;
    if (pendingUserCover && cp.style) cp.style.backgroundImage = `url("${pendingUserCover}")`;
  }
  const ap = document.getElementById('userAvatarPreview');
  if (ap) {
    ap.hidden = !pendingUserAvatar;
    if (pendingUserAvatar && ap.style) ap.style.backgroundImage = `url("${pendingUserAvatar}")`;
  }
}

async function previewUserCover(input) {
  try {
    const f = input.files && input.files[0];
    if (!f) return;
    pendingUserCover = await readImageData(f);
    const p = document.getElementById('userCoverPreview');
    if (p) {
      p.hidden = false;
      if (p.style) p.style.backgroundImage = `url("${pendingUserCover}")`;
    }
  } catch (e) {
    pendingUserCover = '';
    if (input) input.value = '';
    showToast(e.message || t('image_pick_failed', 'เลือกภาพไม่สำเร็จ'));
  }
}

function clearUserCover() {
  pendingUserCover = '';
  const i = document.getElementById('userCoverInput');
  if (i) i.value = '';
  const p = document.getElementById('userCoverPreview');
  if (p) p.hidden = true;
}

async function previewUserAvatar(input) {
  try {
    const f = input.files && input.files[0];
    if (!f) return;
    pendingUserAvatar = await readImageData(f);
    const p = document.getElementById('userAvatarPreview');
    if (p) {
      p.hidden = false;
      if (p.style) p.style.backgroundImage = `url("${pendingUserAvatar}")`;
    }
  } catch (e) {
    pendingUserAvatar = '';
    if (input) input.value = '';
    showToast(e.message || t('image_pick_failed', 'เลือกภาพไม่สำเร็จ'));
  }
}

function clearUserAvatar() {
  pendingUserAvatar = '';
  const i = document.getElementById('userAvatarInput');
  if (i) i.value = '';
  const p = document.getElementById('userAvatarPreview');
  if (p) p.hidden = true;
}

function saveActiveProfile() {
  const nameEl = document.getElementById('userName');
  const name = nameEl ? nameEl.value.trim() : '';
  if (!name) {
    showToast(t('persona_name_required', 'กรุณาระบุชื่อ Persona ของคุณ'));
    if (nameEl) nameEl.focus();
    return;
  }
  const p = getActiveUserProfile();
  p.name = name;
  p.role = document.getElementById('userRole')?.value.trim() || '';
  p.appearance = document.getElementById('userAppearance')?.value.trim() || '';
  p.bio = document.getElementById('userBio')?.value.trim() || '';
  p.coverUrl = pendingUserCover;
  p.avatarUrl = pendingUserAvatar;
  saveUserProfilesToStorage();
  renderProfilePills();
  closeUserProfileModal();
  if (typeof renderChatMessages === 'function' && currentCharacter && !window.isGeneratingReply) renderChatMessages();
  showToast(t('persona_saved', 'บันทึก Persona "{name}" แล้ว').replace('{name}', p.name));
}

function deleteActiveProfile() {
  if (userProfiles.length <= 1) {
    showToast(t('persona_min_one', 'ต้องมี Persona อย่างน้อย 1 รายการ'));
    return;
  }
  if (typeof confirm === 'function' && !confirm(t('confirm_del_persona', 'ต้องการลบ Persona นี้หรือไม่?'))) return;
  const idx = userProfiles.findIndex(p => p.id === activeProfileId);
  if (idx >= 0) userProfiles.splice(idx, 1);
  activeProfileId = userProfiles[0].id;
  saveUserProfilesToStorage();
  renderProfilePills();
  populateProfileForm(getActiveUserProfile());
  showToast(t('persona_deleted', 'ลบ Persona แล้ว'));
}

function userPersonaPrompt() {
  const p = getActiveUserProfile();
  if (!p || !p.name) return '';
  return [
    `[ข้อมูลผู้เล่น / Persona ของผู้ใช้]`,
    `ชื่อผู้เล่น: ${p.name}`,
    p.role && `บทบาท/ฉายา: ${p.role}`,
    p.appearance && `รูปลักษณ์: ${p.appearance}`,
    p.bio && `ประวัติ/ลักษณะเฉพาะตัว: ${p.bio}`,
    `กติกา: ให้เรียกผู้เล่นตามชื่อและรับรู้บทบาทนี้เสมอ และห้ามบรรยายความคิดหรือการกระทำแทนผู้เล่น`
  ].filter(Boolean).join('\n');
}

// ── Session & Storage Sync ────────────────────────────────────────────────────
let chatListSort = 'recent';

function generateSecureRandomString(byteLen) {
  try {
    if (window.crypto && crypto.getRandomValues) {
      const b = new Uint8Array(byteLen);
      crypto.getRandomValues(b);
      return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {}
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).padEnd(byteLen * 2, '0').slice(0, byteLen * 2);
}

function getClientSessionId() {
  try {
    let id = localStorage.getItem('hush-client-session-id');
    if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
      id = 'hush_' + generateSecureRandomString(12);
      localStorage.setItem('hush-client-session-id', id);
    }
    return id;
  } catch (e) {
    return 'default';
  }
}

function getClientSessionToken() {
  try {
    let tok = localStorage.getItem('hush-client-session-token');
    if (!tok || !/^[a-zA-Z0-9_-]{16,128}$/.test(tok)) {
      tok = generateSecureRandomString(24);
      localStorage.setItem('hush-client-session-token', tok);
    }
    return tok;
  } catch (e) {
    return '';
  }
}

function getAuthToken() {
  try { return localStorage.getItem('hush-auth-token') || ''; } catch (e) { return ''; }
}

function getSessionHeaders() {
  const h = { 'x-session-id': getClientSessionId() };
  const tok = getClientSessionToken();
  if (tok) h['x-session-token'] = tok;
  const a = getAuthToken();
  if (a) h['Authorization'] = 'Bearer ' + a;
  return h;
}

function loadChatStoresFromStorage() {
  try {
    const raw = localStorage.getItem('hush-chat-stores');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (v && (Array.isArray(v.history) || Array.isArray(v.aiMemory))) {
            const hist = Array.isArray(v.history) ? v.history : [];
            const mem = Array.isArray(v.aiMemory) ? v.aiMemory.map(x => String(x || '').trim().slice(0, 280)).filter(Boolean).slice(-20) : [];
            sessionChatStores[k] = { history: hist, aiMemory: mem, lastUpdated: Number(v.lastUpdated) || Date.now() };
          }
        }
      }
    }
  } catch (e) {}
  updateRecentMiniList();
}

async function syncChatStoresWithServer() {
  try {
    const r = await fetch('/api/chats', { headers: getSessionHeaders() });
    if (r.ok) {
      const serverChats = await r.json();
      if (serverChats && typeof serverChats === 'object') {
        let changed = false;
        for (const [name, data] of Object.entries(serverChats)) {
          if (!data || (!Array.isArray(data.history) && !Array.isArray(data.aiMemory))) continue;
          const local = sessionChatStores[name];
          const hist = Array.isArray(data.history) ? data.history : (local?.history || []);
          const mem = Array.isArray(data.aiMemory)
            ? data.aiMemory.map(x => String(x || '').trim().slice(0, 280)).filter(Boolean).slice(-20)
            : (Array.isArray(local?.aiMemory) ? local.aiMemory : []);
          if (!local || (data.lastUpdated && (!local.lastUpdated || data.lastUpdated >= local.lastUpdated))) {
            sessionChatStores[name] = { history: hist, aiMemory: mem, lastUpdated: data.lastUpdated || Date.now() };
            changed = true;
          }
        }
        if (changed) {
          saveChatStoresToLocalStorage();
          renderChatList();
          updateRecentMiniList();
          if (typeof renderCharacterMemoryUi === 'function') renderCharacterMemoryUi(currentCharacter);
        }
      }
    }
  } catch (e) {}
}

function saveChatStoresToLocalStorage() {
  try {
    const clean = {};
    for (const [k, v] of Object.entries(sessionChatStores)) {
      if (v && (Array.isArray(v.history) || Array.isArray(v.aiMemory))) {
        const mem = Array.isArray(v.aiMemory) ? v.aiMemory.slice(-20) : [];
        clean[k] = { history: (v.history || []).slice(-100), aiMemory: mem, lastUpdated: v.lastUpdated || Date.now() };
      }
    }
    localStorage.setItem('hush-chat-stores', JSON.stringify(clean));
  } catch (e) {}
}

function persistChatSession(name) {
  saveChatStoresToLocalStorage();
  updateRecentMiniList();
  const s = sessionChatStores[name];
  if (!s) return;
  fetch('/api/chats/' + encodeURIComponent(name), {
    method: 'PUT',
    headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
    body: JSON.stringify({
      history: s.history || [],
      aiMemory: Array.isArray(s.aiMemory) ? s.aiMemory.slice(-20) : [],
      lastUpdated: s.lastUpdated || Date.now()
    })
  }).catch(() => {});
}

function deleteChatSession(name) {
  delete sessionChatStores[name];
  saveChatStoresToLocalStorage();
  updateRecentMiniList();
  fetch('/api/chats/' + encodeURIComponent(name), { method: 'DELETE', headers: getSessionHeaders() }).catch(() => {});
}

function updateRecentMiniList() {
  const entries = Object.entries(sessionChatStores)
    .filter(([, d]) => d && Array.isArray(d.history) && d.history.length > 0)
    .sort((a, b) => (b[1].lastUpdated || 0) - (a[1].lastUpdated || 0));
  const countEl = document.getElementById('navChatCount');
  if (countEl) countEl.textContent = entries.length;
  const top = entries.slice(0, 4);
  const charMap = new Map();
  for (const c of characters) charMap.set(c.name, c);

  const sidebarEl = document.getElementById('recentMiniList');
  const miraLoc = getLocalizedCharacter(charMap.get('Mira') || { name: 'Mira', role: t('persona_default_role', 'นักเดินทาง'), avatar: 'M', art: 'a2' });
  const eliasLoc = getLocalizedCharacter(charMap.get('Elias') || { name: 'Elias', role: t('recent_fallback_role', 'ตัวละคร'), avatar: 'E', art: 'a3' });
  const miraShortRole = String(miraLoc.role || '').split(/[ ·,]/)[0] || t('persona_default_role', 'นักเดินทาง');
  const eliasShortRole = String(eliasLoc.role || '').split(/[ ·,]/)[0] || t('recent_fallback_role', 'ตัวละคร');
  if (sidebarEl) {
    if (!top.length) {
      sidebarEl.innerHTML = `<div class="mini-character" onclick="openChat('Mira')"><span class="avatar a2">M</span><span>Mira · ${safe(miraShortRole)}</span></div><div class="mini-character" onclick="openChat('Elias')"><span class="avatar a3">E</span><span>Elias · ${safe(eliasShortRole)}</span></div>`;
    } else {
      sidebarEl.innerHTML = top.map(([n]) => {
        const c = getLocalizedCharacter(charMap.get(n) || { name: n, role: t('recent_fallback_role', 'ตัวละคร'), avatar: n[0] || '✦', art: 'a2' });
        const avStyle = c.avatarUrl ? `background-image:url('${safe(c.avatarUrl)}');background-size:cover` : '';
        const avContent = c.avatarUrl ? '' : safe(c.avatar || c.name[0] || '✦');
        return `<div class="mini-character" data-name="${safe(c.name)}" onclick="openChat(this.dataset.name)"><span class="avatar ${safe(c.art || 'a2')}" style="${avStyle}">${avContent}</span><span>${safe(c.name)} · ${safe(c.role || '')}</span></div>`;
      }).join('');
    }
  }

  const mobileEl = document.getElementById('mobileRecentMiniList');
  if (mobileEl) {
    if (!top.length) {
      mobileEl.innerHTML = `<button class="mobile-drawer-link" onclick="closeMobileMenu();openChat('Mira')"><span class="avatar a2">M</span>Mira · ${safe(miraShortRole)}</button><button class="mobile-drawer-link" onclick="closeMobileMenu();openChat('Elias')"><span class="avatar a3">E</span>Elias · ${safe(eliasShortRole)}</button>`;
    } else {
      mobileEl.innerHTML = top.map(([n]) => {
        const c = getLocalizedCharacter(charMap.get(n) || { name: n, role: t('recent_fallback_role', 'ตัวละคร'), avatar: n[0] || '✦', art: 'a2' });
        const avStyle = c.avatarUrl ? `background-image:url('${safe(c.avatarUrl)}');background-size:cover` : '';
        const avContent = c.avatarUrl ? '' : safe(c.avatar || c.name[0] || '✦');
        return `<button class="mobile-drawer-link" data-name="${safe(c.name)}" onclick="closeMobileMenu();openChat(this.dataset.name)"><span class="avatar ${safe(c.art || 'a2')}" style="${avStyle}">${avContent}</span>${safe(c.name)} · ${safe(c.role || '')}</button>`;
      }).join('');
    }
  }
}

function showChatList() {
  showView('chat');
  const lv = document.getElementById('chatListView');
  const rv = document.getElementById('chatRoomView');
  if (lv && lv.style) lv.style.display = 'block';
  if (rv && rv.style) rv.style.display = 'none';
  renderChatList();
}

function sortChatList(criteria) {
  chatListSort = criteria;
  const bRecent = document.getElementById('sortRecentBtn');
  const bCount = document.getElementById('sortCountBtn');
  if (bRecent) bRecent.classList.toggle('active', criteria === 'recent');
  if (bCount) bCount.classList.toggle('active', criteria === 'count');
  renderChatList();
}

function renderChatList(){
  const container = document.getElementById('conversationCards');
  if (!container) return;
  if (Object.keys(sessionChatStores).length === 0 && currentCharacter && Array.isArray(window.activeChatHistory) && window.activeChatHistory.length > 0) {
    sessionChatStores[currentCharacter] = {
      history: window.activeChatHistory.slice(),
      aiMemory: [],
      lastUpdated: Date.now()
    };
  }
  const charMap = new Map();
  for (const c of characters) charMap.set(c.name, c);
  const entries = Object.entries(sessionChatStores).map(([name, data]) => {
    const rawChar = charMap.get(name) || { name, role: t('recent_fallback_role', 'ตัวละคร'), avatar: name[0] || '✦' };
    const char = getLocalizedCharacter(rawChar);
    const hist = data.history || [];
    const memCount = Array.isArray(data.aiMemory) ? data.aiMemory.length : 0;
    const lastMsg = hist.length ? hist[hist.length - 1].content : (char.greeting || t('chat_start_divider', 'เริ่มต้นบทสนทนาใหม่'));
    return { name, char, lastMsg, count: hist.length, memCount, lastUpdated: data.lastUpdated || 0 };
  });
  if (chatListSort === 'count') {
    entries.sort((a, b) => b.count - a.count || b.lastUpdated - a.lastUpdated);
  } else {
    entries.sort((a, b) => b.lastUpdated - a.lastUpdated || b.count - a.count);
  }
  if (!entries.length) {
    container.innerHTML = '<div class="empty-note">' + safe(t('chat_inbox_empty', 'ยังไม่มีประวัติบทสนทนา เลือกตัวละครจากหน้า "ค้นพบ" เพื่อเริ่มคุย')) + '</div>';
    return;
  }
  container.innerHTML = entries.map(e => {
    const c = e.char;
    const avStyle = c.avatarUrl ? `background-image:url('${safe(c.avatarUrl)}');background-size:cover` : '';
    const avContent = c.avatarUrl ? '' : safe(c.avatar || c.name[0] || '✦');
    const snippet = safe(e.lastMsg).replace(/\n/g, ' ');
    const countText = e.count ? safe(t('count_messages', '{n} ข้อความ').replace('{n}', e.count)) : safe(t('chat_not_started', 'ยังไม่เริ่มคุย'));
    const memBadge = e.memCount ? `<span class="conv-badge mem-badge">${safe(t('memory_count_badge', '🧠 {n} ความจำ').replace('{n}', e.memCount))}</span>` : '';
    const timeText = e.lastUpdated
      ? new Date(e.lastUpdated).toLocaleTimeString(currentLocale === 'th' ? 'th-TH' : currentLocale === 'zh' ? 'zh-CN' : currentLocale === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      : safe(t('time_today', 'วันนี้'));
    return `<div class="conv-card" data-name="${safe(e.name)}" onclick="openChat(this.dataset.name)"><div class="avatar ${safe(c.art || '')}" style="${avStyle}">${avContent}</div><div class="conv-main"><div class="conv-header"><div class="conv-name">${safe(c.name)} <span style="font-size:11px;color:var(--muted)">· ${safe(c.role || '')}</span></div><div class="conv-time">${timeText}</div></div><div class="conv-snippet">${snippet}</div><div class="conv-meta"><span class="conv-badge">${countText}</span>${memBadge}<button class="conv-del" title="${safe(t('chat_del_title', 'รีเซ็ตบทสนทนานี้'))}" data-name="${safe(e.name)}" onclick="event.stopPropagation();resetSingleChat(this.dataset.name)">${safe(t('chat_del_btn', 'ล้างแชต'))}</button></div></div></div>`;
  }).join('');
}

function resetSingleChat(name) {
  if (typeof resetCharacterAll === 'function') {
    resetCharacterAll(name);
    return;
  }
  if (typeof confirm === 'function' && !confirm(t('confirm_reset_all', 'ต้องการล้างความจำและประวัติแชททั้งหมดกับ "{name}" หรือไม่?').replace('{name}', name))) return;
  deleteChatSession(name);
  if (currentCharacter === name) window.activeChatHistory = [];
  renderChatList();
  showToast(t('toast_reset_all_done', 'รีเซ็ตความจำและประวัติแชทของ "{name}" ทั้งหมดแล้ว').replace('{name}', name));
}

// ── Favorites ─────────────────────────────────────────────────────────────────
let favoriteCharacters = new Set();

function loadFavorites() {
  try {
    const raw = localStorage.getItem('hush-favorites');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) favoriteCharacters = new Set(arr);
    }
  } catch (e) {}
  updateFavoriteBadges();
}

function saveFavorites() {
  try {
    const arr = [...favoriteCharacters];
    localStorage.setItem('hush-favorites', JSON.stringify(arr));
    remoteSet('favorites', arr);
  } catch (e) {}
  updateFavoriteBadges();
}

function isFavorite(name) { return favoriteCharacters.has(name); }

function toggleFavorite(name) {
  if (favoriteCharacters.has(name)) {
    favoriteCharacters.delete(name);
    showToast(t('toast_fav_removed', 'นำ "{name}" ออกจากรายการโปรดแล้ว').replace('{name}', name));
  } else {
    favoriteCharacters.add(name);
    showToast(t('toast_fav_added', 'เพิ่ม "{name}" ในรายการโปรดแล้ว').replace('{name}', name));
  }
  saveFavorites();
  if (typeof renderCards === 'function') renderCards();
  if (typeof renderMyCards === 'function') renderMyCards();
  if (typeof renderFavoriteCards === 'function') renderFavoriteCards();
  if (typeof playSfx === 'function') playSfx('favorite');
}

function updateFavoriteBadges() {
  const count = favoriteCharacters.size;
  const b = document.getElementById('navFavCount');
  if (b) {
    b.textContent = count;
    if (b.style) b.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// ── Remote Settings Cache ─────────────────────────────────────────────────────
const CACHE_KEYS = {
  globalPrompt: 'hush-global-prompt',
  tokenBudget: 'hush-context-budget',
  replyBudget: 'hush-output-budget',
  worldSettings: 'hush-world-settings',
  providerSettings: 'hush-provider-settings',
  modelCache: 'hush-model-cache',
  userProfiles: 'hush-user-profiles',
  activeProfileId: 'hush-active-profile-id',
  favorites: 'hush-favorites',
  activeLocale: 'hush-locale',
  customLocales: 'hush-custom-locales',
  activeTheme: 'hush-theme'
};

function cacheSet(name, value) {
  try {
    localStorage.setItem(CACHE_KEYS[name], typeof value === 'object' ? JSON.stringify(value) : String(value));
  } catch {}
}

function remoteSet(name, value) {
  cacheSet(name, value);
  fetch('/api/settings', {
    method: 'PUT',
    headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
    body: JSON.stringify({ [name]: value })
  }).catch(() => {});
}

function parseCached(raw) {
  try { return JSON.parse(raw); } catch { return raw; }
}

async function loadRemoteSettings() {
  try {
    const r = await fetch('/api/settings', { headers: getSessionHeaders() });
    if (r.ok) {
      const s = await r.json();
      for (const name of Object.keys(CACHE_KEYS)) {
        if (s[name] !== undefined && s[name] !== null) {
          cacheSet(name, s[name]);
        } else {
          const raw = localStorage.getItem(CACHE_KEYS[name]);
          if (raw !== null) {
            fetch('/api/settings', {
              method: 'PUT',
              headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
              body: JSON.stringify({ [name]: parseCached(raw) })
            }).catch(() => {});
          }
        }
      }
      if (Array.isArray(s.favorites)) {
        favoriteCharacters = new Set(s.favorites);
        cacheSet('favorites', s.favorites);
        updateFavoriteBadges();
      }
    }
  } catch {}
  applyStoredSettings();
}

function saveAuthToken(val) {
  try {
    if (val.trim()) {
      localStorage.setItem('hush-auth-token', val.trim());
      showToast(t('toast_auth_token_saved', 'บันทึก Server Access Token แล้ว'));
    } else {
      localStorage.removeItem('hush-auth-token');
      showToast(t('toast_auth_token_cleared', 'ลบ Server Access Token แล้ว'));
    }
  } catch {}
  if (typeof updateProviderStatus === 'function') updateProviderStatus();
}

function loadAuthToken() {
  const el = document.getElementById('serverAuthToken');
  if (el) el.value = getAuthToken();
}

function applyStoredSettings() {
  const g = localStorage.getItem(CACHE_KEYS.globalPrompt);
  const gpEl = document.getElementById('globalPrompt');
  if (g !== null && gpEl) gpEl.value = g;
  loadTokenBudget();
  loadWorldSettings();
  if (typeof loadProviderSettings === 'function') loadProviderSettings();
  if (typeof loadTheme === 'function') loadTheme();
  loadUserProfiles();
  loadFavorites();
  if (typeof loadLocales === 'function') loadLocales();
  loadAuthToken();
  if (typeof renderCards === 'function') renderCards();
  if (typeof renderMyCards === 'function') renderMyCards();
  if (typeof renderFavoriteCards === 'function') renderFavoriteCards();
}

let toastTimer;
function showToast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
