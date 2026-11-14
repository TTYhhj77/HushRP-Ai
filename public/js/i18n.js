const I18N = window.I18N || {};
const SAMPLE_JA_LOCALE = window.SAMPLE_JA_LOCALE || { name: '日本語', dict: {} };
let currentLocale = 'th';
let customLocales = {};

function getAvailableLocales(){
  const builtIn = [
    { code: 'th', name: 'ไทย (Thai)', flag: '🇹🇭' },
    { code: 'en', name: 'English (US)', flag: '🇺🇸' },
    { code: 'zh', name: '中文 (Simplified Chinese)', flag: '🇨🇳' },
    { code: 'ja', name: '日本語 (Japanese)', flag: '🇯🇵' }
  ];
  const custom = Object.entries(customLocales)
    .filter(([code]) => !['th', 'en', 'zh', 'ja'].includes(code))
    .map(([code, loc]) => ({
      code,
      name: (loc && loc.name) || code,
      flag: '🌐',
      isCustom: true
    }));
  return [...builtIn, ...custom];
}

function getActiveLocaleDict(){
  if(customLocales[currentLocale] && customLocales[currentLocale].dict){
    return { ...(I18N.en || {}), ...(I18N.th || {}), ...customLocales[currentLocale].dict };
  }
  if(currentLocale === 'ja' && SAMPLE_JA_LOCALE && SAMPLE_JA_LOCALE.dict){
    return SAMPLE_JA_LOCALE.dict;
  }
  return I18N[currentLocale] || I18N.th;
}

function t(key, fallback){
  const custom = customLocales[currentLocale]?.dict;
  if(custom && custom[key] !== undefined) return custom[key];
  const cur = currentLocale === 'ja' ? (I18N.ja || SAMPLE_JA_LOCALE?.dict) : I18N[currentLocale];
  if(cur && cur[key] !== undefined) return cur[key];
  if(I18N.en && I18N.en[key] !== undefined) return I18N.en[key];
  if(I18N.th && I18N.th[key] !== undefined) return I18N.th[key];
  return fallback !== undefined ? fallback : key;
}

function sanitizeI18nHtml(raw){
  if(!raw || typeof raw !== 'string') return '';
  if(typeof DOMParser !== 'undefined'){
    try{
      const parser = new DOMParser();
      const doc = parser.parseFromString('<body>' + raw + '</body>', 'text/html');
      const allowedTags = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'SPAN', 'SMALL']);
      function clean(node){
        const children = Array.from(node.childNodes);
        for(const child of children){
          if(child.nodeType === 3) continue;
          if(child.nodeType === 1){
            if(!allowedTags.has(child.tagName)){
              const textNode = doc.createTextNode(child.textContent || '');
              node.replaceChild(textNode, child);
            } else {
              const attrs = Array.from(child.attributes);
              for(const a of attrs){
                const n = a.name.toLowerCase();
                if(n.startsWith('on') || n === 'src' || n === 'href' || n === 'action' || n === 'formaction' || n === 'style'){
                  child.removeAttribute(a.name);
                }
              }
              clean(child);
            }
          } else {
            node.removeChild(child);
          }
        }
      }
      clean(doc.body);
      return doc.body.innerHTML;
    }catch(e){}
  }
  let s = String(raw).replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  s = s.replace(/\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  s = s.replace(/<\/?(?!b\b|strong\b|i\b|em\b|br\b|span\b|small\b)[a-z0-9_-]+[^>]*>/gi, '');
  return s;
}

function tr(key, fallback){
  // translate a runtime string that may already be translated via t(); avoids double lookups
  const v = t(key, fallback !== undefined ? fallback : key);
  return v === key ? (fallback !== undefined ? fallback : key) : v;
}
function localizeStaticFallbacks(){
  // update statically-rendered elements whose Thai markup doubles as an i18n fallback
  document.querySelectorAll('[data-i18n-fallback]').forEach(el => {
    const k = el.getAttribute('data-i18n-fallback');
    const dict = getActiveLocaleDict();
    if(dict[k] !== undefined){
      if(String(dict[k]).includes('<')) el.innerHTML = sanitizeI18nHtml(dict[k]);
      else el.textContent = dict[k];
    }
  });
}
function applyLocale(code, quiet=false){
  currentLocale = code;
  if(document.documentElement) document.documentElement.lang = code;
  try{ localStorage.setItem('hush-locale', code); }catch{}
  if(!quiet && typeof remoteSet==='function') remoteSet('activeLocale', code);
  const dict = getActiveLocaleDict();

  document.querySelectorAll('[data-i18n]').forEach(el => {
    const k = el.getAttribute('data-i18n');
    if(dict[k] !== undefined){
      if(dict[k].includes('<')) el.innerHTML = sanitizeI18nHtml(dict[k]);
      else el.textContent = dict[k];
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const k = el.getAttribute('data-i18n-placeholder');
    if(dict[k] !== undefined) el.placeholder = dict[k];
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const k = el.getAttribute('data-i18n-title');
    if(dict[k] !== undefined) el.title = dict[k];
  });

  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const k = el.getAttribute('data-i18n-aria-label');
    if(dict[k] !== undefined) el.setAttribute('aria-label', dict[k]);
  });

  localizeStaticFallbacks();
  updateLanguageDropdowns();
  const gpEl = document.getElementById('globalPrompt');
  if(gpEl){
    let hasCustomPrompt = false;
    try{ hasCustomPrompt = localStorage.getItem('hush-global-prompt') !== null; }catch{}
    const builtInPrompts = new Set([
      I18N.th?.default_global_prompt,
      I18N.en?.default_global_prompt,
      I18N.zh?.default_global_prompt,
      SAMPLE_JA_LOCALE?.dict?.default_global_prompt,
      gpEl.defaultValue
    ].filter(Boolean));
    if(!hasCustomPrompt || builtInPrompts.has(gpEl.value)){
      const localizedPrompt = dict.default_global_prompt;
      if(localizedPrompt) gpEl.value = localizedPrompt;
    }
  }
  if(typeof renderCards === 'function') renderCards();
  if(typeof renderFavoriteCards === 'function') renderFavoriteCards();
  if(typeof renderMyCards === 'function') renderMyCards();
  if(typeof renderChatList === 'function') renderChatList();
  if(typeof renderChatInfo === 'function') renderChatInfo(window.activeRoleplayCharacter || (typeof characters !== 'undefined' ? (characters.find(c => c.name === currentCharacter) || characters[0]) : null));
  if(typeof updateRecentMiniList === 'function') updateRecentMiniList();
  if(typeof updateProviderStatus === 'function') updateProviderStatus();
  if(typeof renderModelChoices === 'function') renderModelChoices();
  if(typeof updateTopbarProfile === 'function') updateTopbarProfile();
  if(typeof syncCreateViewModeUi === 'function') syncCreateViewModeUi();
  if(typeof updatePreview === 'function') updatePreview();
  if(typeof renderProfilePills === 'function' && document.getElementById('userProfileModal')?.classList?.contains('show')) renderProfilePills();
  if(typeof syncSoundButtons === 'function') syncSoundButtons();
  else if(typeof toggleSound === 'function') toggleSound(soundOn);
  if(typeof renderThemeSelector === 'function') renderThemeSelector();
  if(typeof renderChatMessages === 'function' && typeof currentCharacter !== 'undefined' && currentCharacter && !window.isGeneratingReply) renderChatMessages();
  if(typeof refreshCharInfoModal === 'function') refreshCharInfoModal();
  if(typeof renderCharacterMemoryUi === 'function') renderCharacterMemoryUi();
}

function switchLocale(code){
  applyLocale(code);
  if(typeof playSfx === 'function') playSfx('toggle');
  showToast(t('toast_lang_switched', 'เปลี่ยนภาษาเรียบร้อยแล้ว'));
}

function loadLocales(){
  try{
    const cachedLoc = localStorage.getItem('hush-locale');
    if(cachedLoc) currentLocale = cachedLoc;
    const cachedCustom = localStorage.getItem('hush-custom-locales');
    if(cachedCustom) customLocales = JSON.parse(cachedCustom);
  }catch{}
  applyLocale(currentLocale, true);
}

function updateLanguageDropdowns(){
  const sel = document.getElementById('settingsLangSelect');
  if(!sel) return;
  const list = getAvailableLocales();
  sel.innerHTML = list.map(l => `<option value="${safe(l.code)}"${l.code===currentLocale?' selected':''}>${safe(l.flag)} ${safe(l.name)}</option>`).join('');
}

function openLanguageModal(){
  renderLanguageModalList();
  const m = document.getElementById('languageModal');
  if(m) m.classList.add('show');
  if(typeof playSfx === 'function') playSfx('modalOpen');
}

function closeLanguageModal(quiet){
  const m = document.getElementById('languageModal');
  if(m) m.classList.remove('show');
  if(!quiet && typeof playSfx === 'function') playSfx('modalClose');
}

function renderLanguageModalList(){
  const root = document.getElementById('languageModalList');
  if(!root) return;
  const list = getAvailableLocales();
  root.innerHTML = list.map(l => {
    const isActive = l.code === currentLocale;
    return `<div class="lang-card ${isActive?'active':''}" data-locale-code="${safe(l.code)}" onclick="switchLocale(this.dataset.localeCode);closeLanguageModal(true)"><div class="lang-card-title"><span>${safe(l.flag)}</span><span>${safe(l.name)}</span></div><span class="lang-card-code">${safe(l.code.toUpperCase())}</span></div>`;
  }).join('');
}

function openCustomLanguageModal(codeToEdit){
  const m = document.getElementById('customLanguageModal');
  const codeInp = document.getElementById('customLangCode');
  const nameInp = document.getElementById('customLangName');
  const jsonInp = document.getElementById('customLangJson');
  const delBtn = document.getElementById('deleteCustomLangBtn');
  
  if(codeToEdit && customLocales[codeToEdit]){
    codeInp.value = codeToEdit;
    codeInp.readOnly = true;
    nameInp.value = customLocales[codeToEdit].name || '';
    jsonInp.value = JSON.stringify(customLocales[codeToEdit].dict || {}, null, 2);
    if(delBtn) delBtn.style.display = 'block';
  } else {
    codeInp.value = '';
    codeInp.readOnly = false;
    nameInp.value = '';
    jsonInp.value = JSON.stringify(buildFullTranslationTemplate(), null, 2);
    if(delBtn) delBtn.style.display = 'none';
  }
  if(m) m.classList.add('show');
  if(typeof playSfx === 'function') playSfx('modalOpen');
}

function closeCustomLanguageModal(quiet){
  const m = document.getElementById('customLanguageModal');
  if(m) m.classList.remove('show');
  if(!quiet && typeof playSfx === 'function') playSfx('modalClose');
}

function loadCustomLanguageSample(sampleKey){
  if(sampleKey === 'ja'){
    document.getElementById('customLangCode').value = 'ja';
    document.getElementById('customLangName').value = SAMPLE_JA_LOCALE.name;
    const jaDict = { ...buildFullTranslationTemplate(), ...SAMPLE_JA_LOCALE.dict };
    document.getElementById('customLangJson').value = JSON.stringify(jaDict, null, 2);
    showToast(t('toast_sample_loaded', 'โหลดตัวอย่างภาษาญี่ปุ่นเรียบร้อยแล้ว'));
  }
}

function buildFullTranslationTemplate(){
  // always export every key currently used by the UI so custom languages stay complete
  return { ...I18N.en };
}

function copyLanguageTemplate(){
  const json = JSON.stringify(buildFullTranslationTemplate(), null, 2);
  if(navigator && navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(json).then(() => showToast(t('toast_copied_template', 'คัดลอกแม่แบบ JSON สำเร็จ'))).catch(() => showToast(t('toast_copy_failed', 'คัดลอกไม่สำเร็จ')));
  } else {
    showToast(t('toast_copy_failed', 'คัดลอกไม่สำเร็จ'));
  }
}

function saveCustomLanguage(){
  const code = (document.getElementById('customLangCode').value || '').trim().toLowerCase();
  const name = (document.getElementById('customLangName').value || '').trim();
  const rawJson = (document.getElementById('customLangJson').value || '').trim();
  
  if(!/^[a-z0-9_-]{2,10}$/.test(code)){
    showToast(t('toast_lang_code_invalid','รหัสภาษาต้องเป็นตัวอักษร 2-10 ตัว (เช่น ja, es, fr)'));
    return;
  }
  if(!name){
    showToast(t('toast_lang_name_required','กรุณาระบุชื่อภาษาที่แสดง'));
    return;
  }
  let dict = {};
  try{
    dict = JSON.parse(rawJson);
    if(!dict || typeof dict !== 'object' || Array.isArray(dict)) throw new Error();
  }catch(e){
    showToast(t('toast_lang_json_invalid','ข้อมูล JSON ไม่ถูกต้อง กรุณาตรวจสอบไวยากรณ์'));
    return;
  }
  
  customLocales[code] = { name, dict };
  try{
    localStorage.setItem('hush-custom-locales', JSON.stringify(customLocales));
  }catch{}
  if(typeof remoteSet==='function') remoteSet('customLocales', customLocales);
  closeCustomLanguageModal();
  switchLocale(code);
  showToast(t('toast_lang_saved', 'บันทึกภาษาเรียบร้อยแล้ว'));
}

function deleteCustomLanguage(){
  const code = (document.getElementById('customLangCode').value || '').trim().toLowerCase();
  if(!code || !customLocales[code]) return;
  const langName = customLocales[code].name || code;
  if(typeof confirm === 'function' && !confirm(t('confirm_del_lang', 'ต้องการลบภาษา "{name}" หรือไม่?').replace('{name}', langName))) return;
  
  delete customLocales[code];
  try{
    localStorage.setItem('hush-custom-locales', JSON.stringify(customLocales));
  }catch{}
  if(typeof remoteSet==='function') remoteSet('customLocales', customLocales);
  if(currentLocale === code){
    switchLocale('th');
  } else {
    updateLanguageDropdowns();
  }
  closeCustomLanguageModal();
  showToast(t('toast_lang_deleted', 'ลบภาษาเรียบร้อยแล้ว'));
}
