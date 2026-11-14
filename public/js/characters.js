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
    return `<article class="character-card" data-name="${safe(c.name)}" onclick="startCharacter(this.dataset.name)"><div class="${artClass}" style="${artStyle}"><span class="art-tag">${c.adult ? safe(t('tag_adult', 'ผู้ใหญ่ 18+')) : safe(t('tag_fictional', 'บทบาทสมมติ'))}</span></div><div class="card-body"><div class="card-title-row"><div class="card-title">${safe(c.name)}</div><button class="heart liked" aria-label="${safe(t('fav_aria_remove', 'นำออกจากรายการโปรด'))}" data-name="${safe(c.name)}" onclick="event.stopPropagation();toggleFavorite(this.dataset.name)">♥</button></div><div class="card-desc">${safe(lc.role)} — ${safe(lc.desc)}</div><div class="tag-row">${(c.genre || []).slice(0, 2).map(g => `<span class="tag">${safe(formatGenreLabel(g))}</span>`).join('')}</div><div class="card-footer"><span class="creator"><i class="creator-dot">✦</i>${creatorName}</span><span>${safe(t('card_start_story', 'เริ่มเรื่อง ↗'))}</span></div></div></article>`;
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
    return `<article class="character-card" data-name="${safe(c.name)}" onclick="startCharacter(this.dataset.name)"><div class="${artClass}" style="${artStyle}"><span class="art-tag">${c.adult ? safe(t('tag_adult', 'ผู้ใหญ่ 18+')) : safe(t('tag_fictional', 'บทบาทสมมติ'))}</span></div><div class="card-body"><div class="card-title-row"><div class="card-title">${safe(c.name)}</div><button class="heart ${isFav ? 'liked' : ''}" aria-label="${isFav ? safe(t('fav_aria_remove', 'นำออกจากรายการโปรด')) : safe(t('fav_aria_add', 'เพิ่มในรายการโปรด'))}" data-name="${safe(c.name)}" onclick="event.stopPropagation();toggleFavorite(this.dataset.name)">${isFav ? '♥' : '♡'}</button></div><div class="card-desc">${safe(lc.role)} — ${safe(lc.desc)}</div><div class="tag-row">${(c.genre || []).slice(0, 2).map(g => `<span class="tag">${safe(formatGenreLabel(g))}</span>`).join('')}</div><div class="card-footer"><span class="creator"><i class="creator-dot">✦</i>${creatorName}</span><span>${safe(t('card_start_story', 'เริ่มเรื่อง ↗'))}</span></div></div></article>`;
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
    return `<article class="character-card" style="position:relative" data-name="${charName}" onclick="startCharacter(this.dataset.name)"><div class="${artClass}" style="${artStyle}"><span class="art-tag">${c.adult ? safe(t('tag_adult', 'ผู้ใหญ่ 18+')) : safe(t('tag_fictional', 'บทบาทสมมติ'))}</span><div class="card-action-group"><button class="icon-button card-action-btn" title="${safe(t('edit_char_title', 'แก้ไขตัวละคร'))}" data-id="${charId}" data-name="${charName}" onclick="event.stopPropagation();editCharacter(this.dataset.id,this.dataset.name)">✎</button><button class="icon-button card-action-btn del" title="${safe(t('del_char_title', 'ลบตัวละคร'))}" data-id="${charId}" data-name="${charName}" onclick="event.stopPropagation();deleteCharacter(this.dataset.id,this.dataset.name)">✕</button></div></div><div class="card-body"><div class="card-title-row"><div class="card-title">${charName}</div><button class="heart ${isFav ? 'liked' : ''}" aria-label="${isFav ? safe(t('fav_aria_remove', 'นำออกจากรายการโปรด')) : safe(t('fav_aria_add', 'เพิ่มในรายการโปรด'))}" data-name="${charName}" onclick="event.stopPropagation();toggleFavorite(this.dataset.name)">${isFav ? '♥' : '♡'}</button></div><div class="card-desc">${safe(lc.role)} — ${safe(lc.desc)}</div><div class="card-footer"><span class="creator"><i class="creator-dot">✦</i>${creatorName}</span><span>${safe(t('card_start_story', 'เริ่มเรื่อง ↗'))}</span></div></div></article>`;
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
