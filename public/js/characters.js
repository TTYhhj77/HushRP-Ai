let pendingImageData = '';
let pendingCoverData = '';
const CHARACTER_DRAFT_KEY = 'hush-character-draft';

const GENRE_I18N_MAP = {
  'แฟนตาซี': 'filter_fantasy',
  'โรแมนซ์': 'filter_romance',
  'ลึกลับ': 'filter_mystery',
  'ไซไฟ': 'filter_scifi',
  'ชีวิตประจำวัน': 'filter_daily',
  'ผู้ใหญ่ 18+': 'filter_adult',
  'ผจญภัย': 'filter_adventure',
  'สยองขวัญ': 'filter_horror',
  'slow burn': 'filter_slowburn'
};

function formatGenreLabel(g) {
  const s = String(g || '').trim();
  if (!s) return s;
  if (s.includes('/')) {
    return s.split('/').map(part => formatGenreLabel(part.trim())).join(' / ');
  }
  const key = GENRE_I18N_MAP[s] || GENRE_I18N_MAP[s.toLowerCase()];
  return key ? t(key, s) : s;
}

function readImageData(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
      return reject(new Error(tr('file_type_error', 'เลือกไฟล์ PNG, JPG หรือ WebP')));
    }
    if (file.size > 3 * 1024 * 1024) {
      return reject(new Error(tr('file_size_error', 'ไฟล์ภาพใหญ่เกิน 3 MB')));
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext('2d', { alpha: false }).drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(tr('file_read_error', 'อ่านไฟล์ภาพไม่ได้')));
    };
    img.src = url;
  });
}

async function previewCharacterImage(input) {
  try {
    const f = input.files && input.files[0];
    if (!f) return;
    pendingImageData = await readImageData(f);
    const p = document.getElementById('imagePreview');
    if (p) {
      p.hidden = false;
      if (p.style) p.style.backgroundImage = `url("${pendingImageData}")`;
    }
  } catch (e) {
    pendingImageData = '';
    if (input) input.value = '';
    showToast(e.message || t('image_pick_failed', 'เลือกภาพไม่สำเร็จ'));
  }
}

async function previewCoverImage(input) {
  try {
    const f = input.files && input.files[0];
    if (!f) return;
    pendingCoverData = await readImageData(f);
    const p = document.getElementById('coverPreview');
    if (p) {
      p.hidden = false;
      if (p.style) p.style.backgroundImage = `url("${pendingCoverData}")`;
    }
    const art = document.querySelector('.preview-art');
    if (art && art.style) {
      art.style.backgroundImage = `url("${pendingCoverData}")`;
      art.style.backgroundSize = 'cover';
      art.style.backgroundPosition = 'center';
    }
  } catch (e) {
    pendingCoverData = '';
    if (input) input.value = '';
    showToast(e.message || t('image_pick_failed', 'เลือกภาพหน้าปกไม่สำเร็จ'));
  }
}

function clearCoverImage() {
  pendingCoverData = '';
  const inp = document.getElementById('charCoverImage');
  if (inp) inp.value = '';
  const p = document.getElementById('coverPreview');
  if (p) p.hidden = true;
  const art = document.querySelector('.preview-art');
  if (art && art.style) art.style.backgroundImage = '';
}

function clearBackgroundImage() {
  pendingImageData = '';
  const inp = document.getElementById('characterImage');
  if (inp) inp.value = '';
  const p = document.getElementById('imagePreview');
  if (p) p.hidden = true;
}

async function loadSavedCharacters() {
  try {
    const r = await fetch('/api/characters');
    if (!r.ok) return;
    const saved = await r.json();
    for (const c of saved) {
      const i = characters.findIndex(x => (c.id && x.id === c.id) || x.name === c.name);
      const item = {
        ...c,
        creator: 'คุณ',
        art: c.art || 'art5',
        avatar: c.avatar || (c.name || '?')[0].toUpperCase()
      };
      if (i >= 0) characters[i] = { ...characters[i], ...item };
      else characters.push(item);
    }
    renderCards();
    renderMyCards();
    renderFavoriteCards();
  } catch (e) {}
  finally {
    charactersLoaded = true;
  }
}

function waitCharactersReady() {
  return charactersLoaded ? Promise.resolve() : loadSavedCharacters();
}

const SHARE_CHAR_PREFIX = 'HUSHCHAR-V1:';
const SHARE_ICON_SVG = '<svg class="ui-icon" style="width:14px;height:14px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
let activeShareCharacter = null;

function buildCardShareButtonHtml(charName) {
  return `<button type="button" class="card-share-top-btn" title="${safe(t('share_char_btn', 'แชร์ตัวละคร'))}" aria-label="${safe(t('share_char_btn', 'แชร์ตัวละคร'))}" data-name="${charName}" onclick="event.stopPropagation();openShareCharacterModal(this.dataset.name)">${SHARE_ICON_SVG}</button>`;
}

function renderFavoriteCards(){
  const root = document.getElementById('favoriteCards');
  const empty = document.getElementById('favoriteCardsEmpty');
  if (!root) return;
  const favs = characters.filter(c => favoriteCharacters.has(c.name));
  if (!favs.length) {
    root.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;
  root.innerHTML = favs.map(c => {
    const lc = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(c) : c;
    const artStyle = c.avatarUrl ? `background-image:url('${safe(c.avatarUrl)}');background-size:cover;background-position:center` : '';
    const artClass = `card-art ${c.art || ''}${c.avatarUrl ? ' has-cover' : ''}`;
    const creatorName = c.creator === 'คุณ' ? safe(t('persona_default_name', 'คุณ')) : safe(c.creator);
    const charName = safe(c.name);
    return `<article class="character-card" data-name="${charName}" onclick="startCharacter(this.dataset.name)"><div class="${artClass}" style="${artStyle}"><span class="art-tag">${c.adult ? safe(t('tag_adult', 'ผู้ใหญ่ 18+')) : safe(t('tag_fictional', 'บทบาทสมมติ'))}</span>${buildCardShareButtonHtml(charName)}</div><div class="card-body"><div class="card-title-row"><div class="card-title">${charName}</div><button class="heart liked" aria-label="${safe(t('fav_aria_remove', 'นำออกจากรายการโปรด'))}" data-name="${charName}" onclick="event.stopPropagation();toggleFavorite(this.dataset.name)">♥</button></div><div class="card-desc">${safe(lc.role)} — ${safe(lc.desc)}</div><div class="tag-row">${(c.genre || []).slice(0, 2).map(g => `<span class="tag">${safe(formatGenreLabel(g))}</span>`).join('')}</div><div class="card-footer"><span class="creator"><i class="creator-dot">✦</i>${creatorName}</span><span>${safe(t('card_start_story', 'เริ่มเรื่อง ↗'))}</span></div></div></article>`;
  }).join('');
}

function renderCards(){
  const q = (document.getElementById('searchInput')?.value || '').trim().toLowerCase();
  const data = characters.filter(c => {
    const lc = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(c) : c;
    const genreSearch = (c.genre || []).map(g => g + ' ' + formatGenreLabel(g)).join(' ');
    const matchFilter = currentFilter === 'ทั้งหมด' || (c.genre || []).includes(currentFilter) || (currentFilter === 'ผู้ใหญ่ 18+' && c.adult);
    const matchSearch = !q || (c.name + ' ' + c.role + ' ' + lc.role + ' ' + c.desc + ' ' + lc.desc + ' ' + genreSearch).toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });
  const root = document.getElementById('cards');
  if (!root) return;
  if (!data.length) {
    root.innerHTML = '<div class="empty-note">' + safe(t('cards_empty', 'ไม่พบตัวละครที่ตรงกับคำค้น')) + '</div>';
    return;
  }
  root.innerHTML = data.map(c => {
    const lc = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(c) : c;
    const isFav = isFavorite(c.name);
    const artStyle = c.avatarUrl ? `background-image:url('${safe(c.avatarUrl)}');background-size:cover;background-position:center` : '';
    const artClass = `card-art ${c.art || ''}${c.avatarUrl ? ' has-cover' : ''}`;
    const creatorName = c.creator === 'คุณ' ? safe(t('persona_default_name', 'คุณ')) : safe(c.creator);
    const charName = safe(c.name);
    return `<article class="character-card" data-name="${charName}" onclick="startCharacter(this.dataset.name)"><div class="${artClass}" style="${artStyle}"><span class="art-tag">${c.adult ? safe(t('tag_adult', 'ผู้ใหญ่ 18+')) : safe(t('tag_fictional', 'บทบาทสมมติ'))}</span>${buildCardShareButtonHtml(charName)}</div><div class="card-body"><div class="card-title-row"><div class="card-title">${charName}</div><button class="heart ${isFav ? 'liked' : ''}" aria-label="${isFav ? safe(t('fav_aria_remove', 'นำออกจากรายการโปรด')) : safe(t('fav_aria_add', 'เพิ่มในรายการโปรด'))}" data-name="${charName}" onclick="event.stopPropagation();toggleFavorite(this.dataset.name)">${isFav ? '♥' : '♡'}</button></div><div class="card-desc">${safe(lc.role)} — ${safe(lc.desc)}</div><div class="tag-row">${(c.genre || []).slice(0, 2).map(g => `<span class="tag">${safe(formatGenreLabel(g))}</span>`).join('')}</div><div class="card-footer"><span class="creator"><i class="creator-dot">✦</i>${creatorName}</span><span>${safe(t('card_start_story', 'เริ่มเรื่อง ↗'))}</span></div></div></article>`;
  }).join('');
}

function renderMyCards(){
  const root = document.getElementById('myCards');
  const empty = document.getElementById('myCardsEmpty');
  if (!root) return;
  const mine = characters.filter(c => c.creator === 'คุณ');
  root.innerHTML = mine.map(c => {
    const lc = typeof getLocalizedCharacter === 'function' ? getLocalizedCharacter(c) : c;
    const isFav = isFavorite(c.name);
    const artStyle = c.avatarUrl ? `background-image:url('${safe(c.avatarUrl)}');background-size:cover;background-position:center` : '';
    const artClass = `card-art ${c.art || ''}${c.avatarUrl ? ' has-cover' : ''}`;
    const creatorName = safe(t('persona_default_name', 'คุณ'));
    const charId = safe(c.id || c.name);
    const charName = safe(c.name);
    return `<article class="character-card" style="position:relative" data-name="${charName}" onclick="startCharacter(this.dataset.name)"><div class="${artClass}" style="${artStyle}"><span class="art-tag">${c.adult ? safe(t('tag_adult', 'ผู้ใหญ่ 18+')) : safe(t('tag_fictional', 'บทบาทสมมติ'))}</span><div class="card-action-group"><button type="button" class="icon-button card-action-btn" title="${safe(t('share_char_btn', 'แชร์ตัวละคร'))}" data-id="${charId}" data-name="${charName}" onclick="event.stopPropagation();openShareCharacterModal(this.dataset.name)">${SHARE_ICON_SVG}</button><button class="icon-button card-action-btn" title="${safe(t('edit_char_title', 'แก้ไขตัวละคร'))}" data-id="${charId}" data-name="${charName}" onclick="event.stopPropagation();editCharacter(this.dataset.id,this.dataset.name)">✎</button><button class="icon-button card-action-btn del" title="${safe(t('del_char_title', 'ลบตัวละคร'))}" data-id="${charId}" data-name="${charName}" onclick="event.stopPropagation();deleteCharacter(this.dataset.id,this.dataset.name)">✕</button></div></div><div class="card-body"><div class="card-title-row"><div class="card-title">${charName}</div><button class="heart ${isFav ? 'liked' : ''}" aria-label="${isFav ? safe(t('fav_aria_remove', 'นำออกจากรายการโปรด')) : safe(t('fav_aria_add', 'เพิ่มในรายการโปรด'))}" data-name="${charName}" onclick="event.stopPropagation();toggleFavorite(this.dataset.name)">${isFav ? '♥' : '♡'}</button></div><div class="card-desc">${safe(lc.role)} — ${safe(lc.desc)}</div><div class="card-footer"><span class="creator"><i class="creator-dot">✦</i>${creatorName}</span><span>${safe(t('card_start_story', 'เริ่มเรื่อง ↗'))}</span></div></div></article>`;
  }).join('');
  if (empty) empty.hidden = mine.length > 0;
}

function setFilter(el) {
  currentFilter = el.dataset.filter;
  document.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === el));
  renderCards();
}

async function startCharacter(name) {
  let c = characters.find(x => x.name === name);
  if (!c) {
    await waitCharactersReady();
    c = characters.find(x => x.name === name);
  }
  if (!c) return;
  if (c.adult) {
    pendingAdult = name;
    const chk = document.getElementById('ageCheck');
    if (chk) chk.checked = false;
    const m = document.getElementById('adultModal');
    if (m) m.classList.add('show');
    if (typeof playSfx === 'function') playSfx('modalOpen');
    return;
  }
  openChat(name);
}

function closeAdult(go) {
  const m = document.getElementById('adultModal');
  if (m) m.classList.remove('show');
  if (!go) {
    pendingAdult = null;
    if (typeof playSfx === 'function') playSfx('modalClose');
  }
}

function confirmAdult() {
  if (!document.getElementById('ageCheck')?.checked) {
    showToast(t('toast_confirm_age', 'โปรดยืนยันอายุก่อน'));
    return;
  }
  const n = pendingAdult;
  closeAdult(true);
  pendingAdult = null;
  if (n) openChat(n);
}

async function deleteCharacter(id, name) {
  if (typeof confirm === 'function' && !confirm(t('confirm_del_char', 'ต้องการลบตัวละคร "{name}" หรือไม่?').replace('{name}', name))) return;
  try {
    const r = await fetch('/api/characters/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: getSessionHeaders()
    });
    if (!r.ok) throw new Error(t('del_char_failed', 'ลบไม่สำเร็จ'));
    const idx = characters.findIndex(x => x.id === id || x.name === id || x.name === name);
    if (idx >= 0) characters.splice(idx, 1);
    deleteChatSession(name);
    favoriteCharacters.delete(name);
    saveFavorites();
    renderCards();
    renderMyCards();
    renderFavoriteCards();
    if (typeof playSfx === 'function') playSfx('delete');
    showToast(t('toast_char_deleted', 'ลบตัวละคร "{name}" แล้ว').replace('{name}', name));
  } catch (e) {
    if (typeof playSfx === 'function') playSfx('error');
    showToast(e.message || t('del_char_generic', 'ลบตัวละครไม่สำเร็จ'));
  }
}

function syncCreateViewModeUi() {
  const titleEl = document.getElementById('createViewTitle');
  const submitEl = document.querySelector('.create-actions .primary');
  if (editingCharacterId) {
    if (titleEl) titleEl.textContent = t('create_edit_title', 'แก้ไขตัวละคร');
    if (submitEl) submitEl.textContent = t('create_edit_submit_btn', 'บันทึกการแก้ไข');
  } else {
    if (titleEl) titleEl.textContent = t('create_title', 'สร้างตัวละครของคุณ');
    if (submitEl) submitEl.textContent = t('create_submit_btn', 'สร้างตัวละคร');
  }
}

function updatePreview() {
  const nameVal = document.getElementById('charName')?.value || '';
  const roleVal = document.getElementById('charRole')?.value || '';
  const genreSel = document.getElementById('charGenre');
  const genreLabel = genreSel && genreSel.options && genreSel.selectedIndex >= 0
    ? genreSel.options[genreSel.selectedIndex].textContent
    : (genreSel?.value || '');

  const pn = document.getElementById('previewName');
  const pr = document.getElementById('previewRole');
  const pg = document.getElementById('previewGenre');
  if (pn) pn.textContent = nameVal || t('preview_default_name', 'ชื่อตัวละคร');
  if (pr) pr.textContent = roleVal || t('preview_default_role', 'บทบาทของตัวละคร');
  if (pg) pg.textContent = genreLabel;
}

function resetCharacterForm() {
  editingCharacterId = null;
  editingCharacterOriginalName = '';
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('charName', '');
  setVal('charRole', '');
  setVal('charAppearance', '');
  setVal('charDesc', '');
  setVal('charPrompt', '');
  setVal('greeting', '');
  const gSel = document.getElementById('charGenre');
  if (gSel && gSel.options && gSel.options.length) gSel.value = gSel.options[0].value;
  const adultSw = document.getElementById('adultSwitch');
  if (adultSw) {
    adultSw.classList.remove('on');
    adultSw.setAttribute('aria-checked', 'false');
  }
  const pubSw = document.getElementById('publishSwitch');
  if (pubSw) {
    pubSw.classList.remove('on');
    pubSw.setAttribute('aria-checked', 'false');
  }
  clearCoverImage();
  clearBackgroundImage();
  syncCreateViewModeUi();
  updatePreview();
}

function saveCharacterDraft() {
  try {
    const draft = {
      name: document.getElementById('charName')?.value || '',
      role: document.getElementById('charRole')?.value || '',
      genre: document.getElementById('charGenre')?.value || 'แฟนตาซี',
      appearance: document.getElementById('charAppearance')?.value || '',
      desc: document.getElementById('charDesc')?.value || '',
      systemPrompt: document.getElementById('charPrompt')?.value || '',
      greeting: document.getElementById('greeting')?.value || '',
      adult: !!document.getElementById('adultSwitch')?.classList.contains('on')
    };
    localStorage.setItem(CHARACTER_DRAFT_KEY, JSON.stringify(draft));
    showToast(t('toast_draft_saved', 'บันทึกร่างไว้ในเครื่อง'));
  } catch {}
}

function loadCharacterDraft() {
  try {
    const raw = localStorage.getItem(CHARACTER_DRAFT_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object') return false;
    const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
    setVal('charName', d.name);
    setVal('charRole', d.role);
    setVal('charAppearance', d.appearance);
    setVal('charDesc', d.desc);
    setVal('charPrompt', d.systemPrompt);
    setVal('greeting', d.greeting);
    const gSel = document.getElementById('charGenre');
    if (gSel && d.genre) gSel.value = d.genre;
    const adultSw = document.getElementById('adultSwitch');
    if (adultSw) {
      adultSw.classList.toggle('on', !!d.adult);
      adultSw.setAttribute('aria-checked', String(!!d.adult));
    }
    updatePreview();
    return true;
  } catch {
    return false;
  }
}

function clearCharacterDraft() {
  try { localStorage.removeItem(CHARACTER_DRAFT_KEY); } catch {}
}

function openCreateView() {
  resetCharacterForm();
  if (loadCharacterDraft()) {
    showToast(t('toast_draft_loaded', 'โหลดแบบร่างตัวละครที่บันทึกไว้แล้ว'));
  }
  showView('create');
}

function editCharacter(id, name) {
  const c = characters.find(x => (id && x.id === id) || x.name === name);
  if (!c) return;
  resetCharacterForm();
  editingCharacterId = c.id || c.name;
  editingCharacterOriginalName = c.name || '';
  const setVal = (elId, v) => { const el = document.getElementById(elId); if (el) el.value = v || ''; };
  setVal('charName', c.name);
  setVal('charRole', c.role);
  setVal('charAppearance', c.appearance);
  setVal('charDesc', c.desc);
  setVal('charPrompt', c.systemPrompt);
  setVal('greeting', c.greeting);
  const gSel = document.getElementById('charGenre');
  if (gSel && Array.isArray(c.genre) && c.genre[0]) gSel.value = c.genre[0];
  const adultSw = document.getElementById('adultSwitch');
  if (adultSw) {
    adultSw.classList.toggle('on', !!c.adult);
    adultSw.setAttribute('aria-checked', String(!!c.adult));
  }
  if (c.avatarUrl) {
    const p = document.getElementById('coverPreview');
    if (p) {
      p.hidden = false;
      if (p.style) p.style.backgroundImage = `url("${c.avatarUrl}")`;
    }
    const art = document.querySelector('.preview-art');
    if (art && art.style) {
      art.style.backgroundImage = `url("${c.avatarUrl}")`;
      art.style.backgroundSize = 'cover';
      art.style.backgroundPosition = 'center';
    }
  }
  if (c.imageUrl) {
    const p = document.getElementById('imagePreview');
    if (p) {
      p.hidden = false;
      if (p.style) p.style.backgroundImage = `url("${c.imageUrl}")`;
    }
  }
  syncCreateViewModeUi();
  updatePreview();
  showView('create');
}

function readCharacterForm() {
  const name = document.getElementById('charName')?.value.trim() || '';
  const existing = characters.find(x => (editingCharacterId && x.id === editingCharacterId) || x.name === name) || {};
  const genreVal = document.getElementById('charGenre')?.value || 'แฟนตาซี';
  const isAdult = !!document.getElementById('adultSwitch')?.classList.contains('on') || genreVal === 'ผู้ใหญ่ 18+';
  return {
    id: editingCharacterId || undefined,
    name,
    role: document.getElementById('charRole')?.value.trim() || '',
    appearance: document.getElementById('charAppearance')?.value.trim() || '',
    desc: document.getElementById('charDesc')?.value.trim() || '',
    genre: [genreVal],
    adult: isAdult,
    systemPrompt: document.getElementById('charPrompt')?.value.trim() || '',
    greeting: document.getElementById('greeting')?.value.trim() || '',
    imageDataUrl: pendingImageData,
    imageUrl: existing.imageUrl || '',
    avatarDataUrl: pendingCoverData,
    avatarUrl: existing.avatarUrl || ''
  };
}

async function saveCharacter() {
  const isEdit = Boolean(editingCharacterId);
  const c = readCharacterForm();
  if (!c.name) {
    showToast(t('save_char_name_required', 'ใส่ชื่อตัวละครก่อน'));
    document.getElementById('charName')?.focus();
    return;
  }
  c.role = c.role || t('default_new_char_role', 'ตัวละครใหม่');
  c.desc = c.desc || t('default_new_char_desc', 'ตัวละครที่คุณสร้างเอง');
  c.art = 'art5';
  c.avatar = c.name[0].toUpperCase();
  c.creator = 'คุณ';
  c.greeting = c.greeting || t('default_greeting', 'สวัสดี ยินดีที่ได้พบกัน');

  const button = document.querySelector('.create-actions .primary');
  if (button) {
    button.disabled = true;
    button.textContent = t('saving_btn', 'กำลังบันทึก…');
  }

  try {
    const endpoint = isEdit ? '/api/characters/' + encodeURIComponent(editingCharacterId) : '/api/characters';
    const method = isEdit ? 'PUT' : 'POST';
    const response = await fetch(endpoint, {
      method,
      headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
      body: JSON.stringify(c)
    });
    const saved = await response.json();
    if (!response.ok) throw new Error(saved.error || t('char_save_failed', 'บันทึกตัวละครไม่สำเร็จ'));

    const idx = characters.findIndex(x =>
      (saved.id && x.id === saved.id) ||
      (isEdit && x.name === editingCharacterOriginalName) ||
      x.name === saved.name
    );
    const entry = { ...saved, art: 'art5', creator: 'คุณ', avatar: c.avatar };
    if (idx >= 0) characters[idx] = { ...characters[idx], ...entry };
    else characters.unshift(entry);

    if (isEdit && editingCharacterOriginalName && editingCharacterOriginalName !== saved.name) {
      if (sessionChatStores[editingCharacterOriginalName]) {
        sessionChatStores[saved.name] = sessionChatStores[editingCharacterOriginalName];
        deleteChatSession(editingCharacterOriginalName);
        persistChatSession(saved.name);
      }
      if (favoriteCharacters.has(editingCharacterOriginalName)) {
        favoriteCharacters.delete(editingCharacterOriginalName);
        favoriteCharacters.add(saved.name);
        saveFavorites();
      }
    }

    if (!isEdit) clearCharacterDraft();
    resetCharacterForm();
    renderCards();
    renderMyCards();
    renderFavoriteCards();
    if (typeof playSfx === 'function') playSfx('success');
    showToast(isEdit ? t('char_updated', 'บันทึกการแก้ไขตัวละครแล้ว') : t('char_created', 'สร้างตัวละครและบันทึกแล้ว'));
    showView('discover');
  } catch (e) {
    if (typeof playSfx === 'function') playSfx('error');
    showToast(e.message || t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  } finally {
    if (button) button.disabled = false;
    syncCreateViewModeUi();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('charRole')?.addEventListener('input', updatePreview);
  document.getElementById('charGenre')?.addEventListener('change', updatePreview);
});

// ── Character Sharing & Import ────────────────────────────────────────────────
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function utf8ToBase64(str) {
  const bytes = unescape(encodeURIComponent(String(str || '')));
  if (typeof btoa === 'function') return btoa(bytes);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes.charCodeAt(i);
    const b = i + 1 < bytes.length ? bytes.charCodeAt(i + 1) : 0;
    const c = i + 2 < bytes.length ? bytes.charCodeAt(i + 2) : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64_CHARS[(n >> 18) & 63] + B64_CHARS[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64_CHARS[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64_CHARS[n & 63] : '=';
  }
  return out;
}

function base64ToUtf8(b64) {
  const clean = String(b64 || '').replace(/\s+/g, '');
  let bytes = '';
  if (typeof atob === 'function') {
    bytes = atob(clean);
  } else {
    const pad = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
    const stripped = clean.replace(/=+$/, '');
    const arr = [];
    for (let i = 0; i < stripped.length; i += 4) {
      const c1 = B64_CHARS.indexOf(stripped[i]);
      const c2 = B64_CHARS.indexOf(stripped[i + 1]);
      const c3 = i + 2 < stripped.length ? B64_CHARS.indexOf(stripped[i + 2]) : 0;
      const c4 = i + 3 < stripped.length ? B64_CHARS.indexOf(stripped[i + 3]) : 0;
      if (c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0) throw new Error('Invalid base64');
      const n = (c1 << 18) | (c2 << 12) | (c3 << 6) | c4;
      arr.push((n >> 16) & 255);
      if (i + 2 < stripped.length) arr.push((n >> 8) & 255);
      if (i + 3 < stripped.length) arr.push(n & 255);
    }
    if (pad && arr.length) {}
    bytes = arr.map(code => String.fromCharCode(code)).join('');
  }
  const pct = Array.from(bytes, ch => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  return decodeURIComponent(pct);
}

function buildPortableCharacterObject(c) {
  if (!c || typeof c !== 'object') return null;
  const name = String(c.name || '').trim().slice(0, 80);
  if (!name) return null;
  return {
    schema: 'hushrp-character-v1',
    name,
    role: String(c.role || '').slice(0, 300),
    appearance: String(c.appearance || '').slice(0, 1000),
    desc: String(c.desc || '').slice(0, 1500),
    genre: Array.isArray(c.genre) ? c.genre.filter(x => typeof x === 'string' && x.trim()).slice(0, 10) : ['แฟนตาซี'],
    adult: c.adult === true,
    systemPrompt: String(c.systemPrompt || '').slice(0, 10000),
    greeting: String(c.greeting || '').slice(0, 3000),
    art: String(c.art || 'art5')
  };
}

function encodeCharacterShareCode(c) {
  const portable = buildPortableCharacterObject(c);
  if (!portable) return '';
  return SHARE_CHAR_PREFIX + utf8ToBase64(JSON.stringify(portable));
}

function parseSharedCharacterPayload(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    const jsonText = text.startsWith(SHARE_CHAR_PREFIX)
      ? base64ToUtf8(text.slice(SHARE_CHAR_PREFIX.length).trim())
      : text;
    const obj = JSON.parse(jsonText);
    return buildPortableCharacterObject(obj);
  } catch {
    return null;
  }
}

function openShareCharacterModal(idOrName) {
  const key = idOrName || (window.activeRoleplayCharacter && window.activeRoleplayCharacter.name) || (typeof currentCharacter !== 'undefined' ? currentCharacter : '');
  const found = (typeof characters !== 'undefined' && Array.isArray(characters)
    ? characters.find(x => (key && x.id === key) || x.name === key)
    : null) || (window.activeRoleplayCharacter && window.activeRoleplayCharacter.name === key ? window.activeRoleplayCharacter : null);
  if (!found) return;

  activeShareCharacter = buildPortableCharacterObject(found);
  const summaryEl = document.getElementById('shareCharacterSummary');
  if (summaryEl) {
    const av = safe(found.avatar || found.name?.[0]?.toUpperCase() || '✦');
    const avStyle = found.avatarUrl ? `background-image:url('${safe(found.avatarUrl)}');background-size:cover;background-position:center` : '';
    summaryEl.innerHTML = `<span class="avatar ${safe(found.art || 'art5')}" style="${avStyle}">${found.avatarUrl ? '' : av}</span><div class="share-char-meta"><strong>${safe(found.name)}</strong><small>${safe(found.role || '')}</small></div>`;
  }
  const box = document.getElementById('shareCharacterCodeBox');
  if (box) box.value = encodeCharacterShareCode(activeShareCharacter);

  const modal = document.getElementById('shareCharacterModal');
  if (modal && modal.classList) modal.classList.add('show');
  if (typeof playSfx === 'function') playSfx('modalOpen');
}

function closeShareCharacterModal() {
  const modal = document.getElementById('shareCharacterModal');
  if (modal && modal.classList) {
    if (modal.classList.contains('show') && typeof playSfx === 'function') playSfx('modalClose');
    modal.classList.remove('show');
  }
}

function copyCharacterShareCode() {
  const box = document.getElementById('shareCharacterCodeBox');
  const code = String(box ? box.value : (activeShareCharacter ? encodeCharacterShareCode(activeShareCharacter) : '')).trim();
  if (!code) return;
  const charName = activeShareCharacter?.name || '';
  const doneMsg = t('toast_char_code_copied', 'คัดลอกโค้ดแชร์ของ "{name}" แล้ว').replace('{name}', charName);
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(code)
      .then(() => { if (typeof playSfx === 'function') playSfx('tap'); showToast(doneMsg); })
      .catch(() => showToast(t('toast_copy_failed', 'คัดลอกไม่สำเร็จ')));
    return;
  }
  if (box && typeof box.select === 'function' && typeof document !== 'undefined' && typeof document.execCommand === 'function') {
    box.select();
    try { document.execCommand('copy'); } catch {}
  }
  if (typeof playSfx === 'function') playSfx('tap');
  showToast(doneMsg);
}

function downloadSharedCharacter() {
  if (!activeShareCharacter) return;
  const json = JSON.stringify(activeShareCharacter, null, 2);
  const safeName = activeShareCharacter.name.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'character';
  if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.hushchar.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  if (typeof playSfx === 'function') playSfx('success');
  showToast(t('toast_char_file_downloaded', 'ดาวน์โหลดไฟล์ตัวละคร "{name}" แล้ว').replace('{name}', activeShareCharacter.name));
}

function openImportCharacterModal() {
  const fileEl = document.getElementById('importCharacterFileInput');
  if (fileEl) fileEl.value = '';
  const textEl = document.getElementById('importCharacterTextInput');
  if (textEl) {
    textEl.value = '';
    textEl.focus?.();
  }
  const modal = document.getElementById('importCharacterModal');
  if (modal && modal.classList) modal.classList.add('show');
  if (typeof playSfx === 'function') playSfx('modalOpen');
}

function closeImportCharacterModal() {
  const modal = document.getElementById('importCharacterModal');
  if (modal && modal.classList) {
    if (modal.classList.contains('show') && typeof playSfx === 'function') playSfx('modalClose');
    modal.classList.remove('show');
  }
}

async function handleImportCharacterFile(input) {
  const file = input?.files && input.files[0];
  if (!file) return;
  try {
    const text = typeof file.text === 'function' ? await file.text() : '';
    const box = document.getElementById('importCharacterTextInput');
    if (box) box.value = text;
  } catch {
    showToast(t('toast_char_import_invalid', 'ไฟล์หรือโค้ดตัวละครไม่ถูกต้อง'));
  }
}

async function confirmImportCharacter() {
  const box = document.getElementById('importCharacterTextInput');
  const parsed = parseSharedCharacterPayload(box ? box.value : '');
  if (!parsed) {
    if (typeof playSfx === 'function') playSfx('error');
    showToast(t('toast_char_import_invalid', 'ไฟล์หรือโค้ดตัวละครไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง'));
    return false;
  }

  const btn = document.getElementById('importCharConfirmBtn');
  if (btn) btn.disabled = true;
  try {
    const response = await fetch('/api/characters', {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
      body: JSON.stringify(parsed)
    });
    const saved = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(saved.error || t('char_save_failed', 'บันทึกตัวละครไม่สำเร็จ'));

    const entry = {
      ...parsed,
      ...saved,
      art: saved.art || parsed.art || 'art5',
      creator: 'คุณ',
      avatar: saved.avatar || (saved.name || parsed.name)[0].toUpperCase()
    };
    const idx = characters.findIndex(x => (entry.id && x.id === entry.id) || x.name === entry.name);
    if (idx >= 0) characters[idx] = { ...characters[idx], ...entry };
    else characters.unshift(entry);

    renderCards();
    renderMyCards();
    renderFavoriteCards();
    closeImportCharacterModal();
    if (typeof playSfx === 'function') playSfx('success');
    showToast(t('toast_char_imported', 'นำเข้าตัวละคร "{name}" เรียบร้อยแล้ว').replace('{name}', entry.name));
    if (typeof showView === 'function') {
      showView('mine');
      renderMyCards();
    }
    return true;
  } catch (e) {
    if (typeof playSfx === 'function') playSfx('error');
    showToast(e?.message || t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
    return false;
  } finally {
    if (btn) btn.disabled = false;
  }
}
