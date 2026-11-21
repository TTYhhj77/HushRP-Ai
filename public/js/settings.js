let keyMode = 'server';
let clientKeyAllowed = false;
let sessionApiKey = '';

function readProviderSettings() {
  try {
    const o = JSON.parse(localStorage.getItem(CACHE_KEYS.providerSettings) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function getModelCache() {
  try {
    const o = JSON.parse(localStorage.getItem(CACHE_KEYS.modelCache) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

function syncPresetButtons(selectedProvider) {
  const bar = document.getElementById('providerPresetBar');
  if (!bar || typeof bar.querySelectorAll !== 'function') return;
  bar.querySelectorAll('.provider-preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === selectedProvider);
  });
}

function selectProviderPreset(providerLabel) {
  const sel = document.getElementById('providerSelect');
  if (!sel) return;
  sel.value = providerLabel;
  providerChanged();
  clearConnectionTestBox();
}

function renderModelChoices() {
  const provider = document.getElementById('providerSelect')?.value || 'OpenAI';
  const list = (getModelCache()[provider] || []).slice();
  const current = String(document.getElementById('modelSelect')?.value || '').trim();
  if (current && list.indexOf(current) < 0) list.unshift(current);

  const pickerLabel = document.getElementById('chatModelPickerLabel');
  if (pickerLabel) {
    pickerLabel.textContent = current || (typeof t === 'function' ? t('model_picker_btn_empty', 'เลือกโมเดล AI') : 'เลือกโมเดล AI');
  }
  const pickerBtn = document.getElementById('chatModelPickerBtn');
  if (pickerBtn && pickerBtn.classList) {
    pickerBtn.classList.toggle('has-model', Boolean(current));
  }

  const dl = document.getElementById('modelOptions');
  if (dl && dl.appendChild) {
    while (dl.firstChild) dl.removeChild(dl.firstChild);
    for (const m of list) {
      const o = document.createElement('option');
      o.value = m;
      dl.appendChild(o);
    }
  }

  const sel = document.getElementById('chatModelSelect');
  if (sel && sel.appendChild) {
    while (sel.firstChild) sel.removeChild(sel.firstChild);
    if (!list.length) {
      const o = document.createElement('option');
      o.value = '';
      o.textContent = t('msg_no_models', 'ดึงโมเดลในตั้งค่าก่อน');
      sel.appendChild(o);
    } else {
      for (const m of list) {
        const o = document.createElement('option');
        o.value = m;
        o.textContent = m;
        o.selected = m === current;
        sel.appendChild(o);
      }
    }
  }

  const modal = document.getElementById('modelPickerModal');
  if (modal && modal.classList && modal.classList.contains('show')) {
    renderModelPickerList(document.getElementById('modelSearchInput')?.value || '');
  }
}

const PINNED_MODELS_KEY = 'hush-pinned-models';
let activeModelVendorFilter = 'all';

function getPinnedModels() {
  try {
    const arr = JSON.parse(localStorage.getItem(PINNED_MODELS_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function savePinnedModels(list) {
  try {
    localStorage.setItem(PINNED_MODELS_KEY, JSON.stringify(list));
  } catch {}
}

function isModelPinned(modelId) {
  return getPinnedModels().includes(String(modelId || '').trim());
}

function togglePinModel(modelId, ev) {
  if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  const clean = String(modelId || '').trim();
  if (!clean) return;
  const list = getPinnedModels();
  const idx = list.indexOf(clean);
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift(clean);
  savePinnedModels(list);
  if (typeof playSfx === 'function') playSfx('tap');
  renderModelPickerList(document.getElementById('modelSearchInput')?.value || '');
}

function setModelVendorFilter(vendor) {
  activeModelVendorFilter = String(vendor || 'all');
  if (typeof playSfx === 'function') playSfx('tap');
  renderModelPickerList(document.getElementById('modelSearchInput')?.value || '');
}

function switchProviderInModal(providerKey) {
  const sel = document.getElementById('providerSelect');
  if (sel && providerKey) sel.value = providerKey;
  activeModelVendorFilter = 'all';
  if (typeof providerChanged === 'function') providerChanged();
  if (typeof playSfx === 'function') playSfx('tap');
  renderModelPickerList(document.getElementById('modelSearchInput')?.value || '');
}

const VENDOR_PREFIX_MAP = {
  openai: 'OpenAI',
  anthropic: 'Claude',
  google: 'Gemini',
  'meta-llama': 'Llama',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  mistralai: 'Mistral',
  'x-ai': 'Grok',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
  microsoft: 'Phi',
  '01-ai': 'Yi',
  nvidia: 'Nvidia'
};

function extractModelVendorTag(modelId, provider = '') {
  const m = String(modelId || '').trim();
  if (!m) return '';
  const low = m.toLowerCase();
  if (low.startsWith('hf.co/')) return 'HF';
  if (m.includes('/')) {
    const prefix = low.split('/')[0];
    return VENDOR_PREFIX_MAP[prefix] || m.split('/')[0].slice(0, 12);
  }
  if (/^(gpt-|o1|o3|o4|chatgpt-)/i.test(low)) return 'OpenAI';
  if (low.includes('claude')) return 'Claude';
  if (low.includes('gemini')) return 'Gemini';
  if (low.includes('gemma')) return 'Gemma';
  if (low.includes('deepseek')) return 'DeepSeek';
  if (low.includes('llama')) return 'Llama';
  if (low.includes('qwen')) return 'Qwen';
  if (low.includes('mistral') || low.includes('mixtral')) return 'Mistral';
  if (low.includes('command-r') || low.includes('cohere')) return 'Cohere';
  if (low.includes('sonar') || low.includes('perplexity')) return 'Perplexity';
  if (/^phi-?\d|phi\b/.test(low)) return 'Phi';
  if (/^yi-/.test(low)) return 'Yi';
  if (low.includes('nemotron')) return 'Nvidia';
  if (m.includes(':')) return m.split(':')[1].slice(0, 10);
  if (provider === 'Ollama (local)') return 'Local';
  return '';
}

function formatModelDisplayName(modelId) {
  const m = String(modelId || '').trim();
  if (!m) return '';
  if (m.includes('/')) {
    const rest = m.split('/').slice(1).join('/');
    if (rest) return rest;
  }
  return m;
}

let modelSearchDebounceTimer = null;

function scheduleModelPickerSearch(val) {
  clearTimeout(modelSearchDebounceTimer);
  const clearBtn = document.getElementById('modelSearchClearBtn');
  if (clearBtn) clearBtn.hidden = !String(val || '').trim();
  modelSearchDebounceTimer = setTimeout(() => renderModelPickerList(val), 75);
}

function clearModelSearch() {
  clearTimeout(modelSearchDebounceTimer);
  const inp = document.getElementById('modelSearchInput');
  if (inp) {
    inp.value = '';
    inp.focus?.();
  }
  if (typeof playSfx === 'function') playSfx('tap');
  renderModelPickerList('');
}

function renderModelPickerList(query = '') {
  const provider = document.getElementById('providerSelect')?.value || 'OpenAI';
  const current = String(document.getElementById('modelSelect')?.value || '').trim();
  const list = (getModelCache()[provider] || []).slice();
  if (current && list.indexOf(current) < 0) list.unshift(current);

  const pinnedSet = new Set(getPinnedModels());

  const clearBtn = document.getElementById('modelSearchClearBtn');
  if (clearBtn) clearBtn.hidden = !String(query || '').trim();

  const tabsEl = document.getElementById('modelPickerProviderTabs');
  if (tabsEl && typeof tabsEl.querySelectorAll === 'function') {
    tabsEl.querySelectorAll('.model-provider-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.provider === provider);
    });
  }

  const bannerEl = document.getElementById('modelPickerCurrentBanner');
  const currentNameEl = document.getElementById('modelPickerCurrentName');
  if (bannerEl) bannerEl.hidden = !current;
  if (currentNameEl) currentNameEl.textContent = current ? `${provider} · ${current}` : '';

  const provBadge = document.getElementById('modelPickerProviderBadge');
  if (provBadge) provBadge.textContent = provider;

  const vendorCounts = new Map();
  for (const m of list) {
    const v = extractModelVendorTag(m, provider);
    if (v) vendorCounts.set(v, (vendorCounts.get(v) || 0) + 1);
  }
  const vendors = Array.from(vendorCounts.keys());
  if (activeModelVendorFilter !== 'all' && activeModelVendorFilter !== '__fav__' && !vendorCounts.has(activeModelVendorFilter)) {
    activeModelVendorFilter = 'all';
  }

  const chipsEl = document.getElementById('modelPickerVendorChips');
  if (chipsEl) {
    const favCount = list.filter(m => pinnedSet.has(m)).length;
    const allLabel = safe(typeof t === 'function' ? t('model_filter_all', 'ทั้งหมด') : 'ทั้งหมด');
    const favLabel = safe(typeof t === 'function' ? t('model_filter_fav', 'ติดดาว') : 'ติดดาว');
    const chips = [
      `<button type="button" class="model-vendor-chip${activeModelVendorFilter === 'all' ? ' active' : ''}" data-vendor="all" onclick="setModelVendorFilter('all')">${allLabel} <span class="chip-count">${list.length}</span></button>`,
      `<button type="button" class="model-vendor-chip${activeModelVendorFilter === '__fav__' ? ' active' : ''}" data-vendor="__fav__" onclick="setModelVendorFilter('__fav__')">★ ${favLabel} <span class="chip-count">${favCount}</span></button>`
    ];
    for (const v of vendors) {
      const escV = safe(v);
      const cnt = vendorCounts.get(v) || 0;
      chips.push(`<button type="button" class="model-vendor-chip${activeModelVendorFilter === v ? ' active' : ''}" data-vendor="${escV}" onclick="setModelVendorFilter(this.dataset.vendor)">${escV} <span class="chip-count">${cnt}</span></button>`);
    }
    chipsEl.innerHTML = chips.join('');
  }

  const q = String(query || '').trim().toLowerCase();
  let filtered = list.filter(m => {
    if (activeModelVendorFilter === '__fav__' && !pinnedSet.has(m)) return false;
    if (activeModelVendorFilter !== 'all' && activeModelVendorFilter !== '__fav__' && extractModelVendorTag(m, provider) !== activeModelVendorFilter) return false;
    return !q || m.toLowerCase().includes(q);
  });

  filtered.sort((a, b) => {
    const ap = pinnedSet.has(a) ? 0 : 1;
    const bp = pinnedSet.has(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const aa = a === current ? 0 : 1;
    const ba = b === current ? 0 : 1;
    return aa - ba;
  });

  const countBadge = document.getElementById('modelPickerCountBadge');
  if (countBadge) {
    countBadge.textContent = (typeof t === 'function' ? t('model_picker_count', '{n} โมเดล') : '{n} models').replace('{n}', String(filtered.length));
  }

  const container = document.getElementById('modelPickerList');
  if (!container) return;
  if (!list.length) {
    container.innerHTML = `<div class="empty-note">${safe(t('model_picker_empty', 'ยังไม่มีรายการโมเดล กด “ดึงรายการล่าสุด” หรือพิมพ์ชื่อโมเดลด้านบน'))}</div>`;
    return;
  }
  if (!filtered.length) {
    container.innerHTML = `<div class="empty-note">${safe(t('model_picker_no_match', 'ไม่พบโมเดลที่ตรงกับคำค้น — กดปุ่ม “ใช้ชื่อที่พิมพ์” เพื่อใช้ชื่อนี้ได้ทันที'))}</div>`;
    return;
  }
  const activeBadgeText = safe(typeof t === 'function' ? t('model_active_badge', 'ใช้อยู่') : 'ใช้อยู่');
  const pinTitle = safe(typeof t === 'function' ? t('model_pin_title', 'ปักหมุด / ติดดาวโมเดล') : 'ปักหมุด / ติดดาวโมเดล');
  container.innerHTML = filtered.map(m => {
    const active = m === current;
    const pinned = pinnedSet.has(m);
    const vendor = extractModelVendorTag(m, provider);
    const displayName = formatModelDisplayName(m);
    const esc = safe(m);
    const escTitle = safe(displayName);
    return `<div class="model-option-card${active ? ' active' : ''}" data-model="${esc}"><button type="button" class="model-option-select-btn" data-model="${esc}" onclick="selectModelFromPicker(this.dataset.model)">${vendor ? `<span class="model-vendor-tag">${safe(vendor)}</span>` : ''}<span class="model-option-copy"><span class="model-option-title">${escTitle}</span><span class="model-option-sub">${esc}</span></span></button><div class="model-option-actions">${active ? `<span class="model-active-pill">✓ ${activeBadgeText}</span>` : ''}<button type="button" class="model-option-pin${pinned ? ' pinned' : ''}" title="${pinTitle}" aria-label="${pinTitle}" data-model="${esc}" onclick="togglePinModel(this.dataset.model, event)">${pinned ? '★' : '☆'}</button></div></div>`;
  }).join('');
}

function openModelPickerModal() {
  const searchEl = document.getElementById('modelSearchInput');
  if (searchEl) searchEl.value = '';
  activeModelVendorFilter = 'all';
  renderModelPickerList('');
  const modal = document.getElementById('modelPickerModal');
  if (modal && modal.classList) modal.classList.add('show');
  if (typeof playSfx === 'function') playSfx('modalOpen');
  if (searchEl && !(typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth <= 700)) {
    searchEl.focus?.();
  }
}

function closeModelPickerModal() {
  const modal = document.getElementById('modelPickerModal');
  if (modal && modal.classList) {
    if (modal.classList.contains('show') && typeof playSfx === 'function') playSfx('modalClose');
    modal.classList.remove('show');
  }
}

function selectModelFromPicker(modelId) {
  const clean = String(modelId || '').trim().slice(0, 150);
  if (!clean) return;
  const ms = document.getElementById('modelSelect');
  if (ms) ms.value = clean;
  const cs = document.getElementById('chatModelSelect');
  if (cs) cs.value = clean;
  saveProviderSettings();
  renderModelChoices();
  closeModelPickerModal();
  if (typeof playSfx === 'function') playSfx('tap');
  showToast(t('toast_model_selected', 'เลือกใช้โมเดล {model} แล้ว').replace('{model}', clean));
}

function useSearchAsManualModel() {
  const val = String(document.getElementById('modelSearchInput')?.value || '').trim();
  if (!val) {
    if (typeof playSfx === 'function') playSfx('error');
    showToast(t('model_id_required', 'ใส่ model ID ก่อน'));
    return;
  }
  selectModelFromPicker(val);
}

async function refreshModelsInPicker() {
  const btn = document.getElementById('modelPickerRefreshBtn');
  if (btn) btn.disabled = true;
  try {
    await loadModels();
    renderModelPickerList(document.getElementById('modelSearchInput')?.value || '');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function chatModelChanged(value) {
  const ms = document.getElementById('modelSelect');
  if (ms) ms.value = value;
  saveProviderSettings();
  renderModelChoices();
}

function saveProviderSettings() {
  const provider = document.getElementById('providerSelect')?.value || 'OpenAI';
  const url = (document.getElementById('baseUrl')?.value || '').trim().slice(0, 300);
  const model = (document.getElementById('modelSelect')?.value || '').trim().slice(0, 150);
  const prev = readProviderSettings();
  remoteSet('providerSettings', {
    provider,
    baseUrl: url,
    model,
    customBaseUrl: provider === 'OpenAI compatible / Custom' ? url : (prev.customBaseUrl || ''),
    keyMode
  });
}

function loadProviderSettings() {
  const s = readProviderSettings();
  const provEl = document.getElementById('providerSelect');
  const urlEl = document.getElementById('baseUrl');
  const modelEl = document.getElementById('modelSelect');
  if (s.provider && provEl) provEl.value = s.provider;
  if (s.baseUrl && urlEl) urlEl.value = s.baseUrl;
  if (s.model && modelEl) modelEl.value = s.model;
  setKeyMode(s.keyMode || 'server', true);
  syncPresetButtons(provEl?.value || 'OpenAI');
  renderModelChoices();
}

function providerChanged() {
  const provEl = document.getElementById('providerSelect');
  const provider = provEl ? provEl.value : 'OpenAI';
  const prev = readProviderSettings();
  const cached = getModelCache()[provider];
  const modelEl = document.getElementById('modelSelect');
  const urlEl = document.getElementById('baseUrl');
  if (modelEl) modelEl.value = Array.isArray(cached) && cached.length ? cached[0] : '';
  if (urlEl) urlEl.value = PROVIDER_DEFAULTS[provider] || prev.customBaseUrl || '';
  syncPresetButtons(provider);
  saveProviderSettings();
  renderModelChoices();
  updateProviderStatus();
  if (provider === 'Ollama (local)' && (!Array.isArray(cached) || !cached.length) && typeof fetch === 'function') {
    loadModels().catch(() => {});
  }
}

function useManualModel() {
  const v = (document.getElementById('modelSelect')?.value || '').trim();
  if (!v) {
    showToast(t('model_id_required', 'ใส่ model ID ก่อน'));
    return;
  }
  saveProviderSettings();
  renderModelChoices();
  showToast(t('manual_model_used', 'ใช้โมเดล {model}').replace('{model}', v));
}

function replyLengthHint() {
  const b = Number(localStorage.getItem('hush-output-budget') || 300);
  return t('reply_length_hint', 'ตอบให้กระชับ จบประโยคเสมอภายในงบประมาณประมาณ {n} token ห้ามทิ้งประโยคค้างกลางคัน').replace('{n}', b);
}

function setKeyMode(mode, quiet = false) {
  keyMode = mode === 'browser' && clientKeyAllowed ? 'browser' : 'server';
  const k = document.getElementById('clientApiKey');
  if (k) {
    k.disabled = !clientKeyAllowed;
    k.readOnly = keyMode !== 'browser';
    if (keyMode === 'browser') {
      k.placeholder = t('placeholder_browser_key', 'ใส่ API key สำหรับเซสชันนี้');
    } else {
      k.value = '';
      k.placeholder = clientKeyAllowed
        ? t('placeholder_browser_or_server', 'คลิกเพื่อใส่ Browser key หรือใช้ Server key')
        : t('placeholder_server_key_only', 'ใช้การตั้งค่า server key');
    }
  }
  if (keyMode !== 'browser') sessionApiKey = '';
  const bw = document.getElementById('browserWarning');
  const vw = document.getElementById('vpsWarning');
  const km = document.getElementById('keyMode');
  if (bw) bw.hidden = keyMode !== 'browser';
  if (vw) vw.hidden = keyMode !== 'server';
  if (km) km.value = keyMode;
  if (!quiet) saveProviderSettings();
}

async function saveServerKeyFromUi() {
  const inp = document.getElementById('serverApiKeyInput');
  const key = inp ? inp.value.trim() : '';
  if (!key) {
    showToast(t('toast_server_key_empty', 'กรุณาใส่ API key ก่อนบันทึก'));
    if (inp) inp.focus();
    return;
  }
  const btn = document.getElementById('saveServerKeyBtn');
  if (btn) btn.disabled = true;
  try {
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
      body: JSON.stringify({ serverApiKey: key })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      showToast(d.error || t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
      return;
    }
    if (inp) inp.value = '';
    setKeyMode('server', false);
    await updateProviderStatus();
    showToast(t('toast_server_key_saved', 'บันทึก Server API key แล้ว ({masked})').replace('{masked}', d.serverKeyMasked || d.serverApiKey || '••••'));
  } catch {
    showToast(t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function clearServerKeyFromUi() {
  try {
    const r = await fetch('/api/settings', {
      method: 'PUT',
      headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
      body: JSON.stringify({ serverApiKey: '' })
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      showToast(d.error || t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
      return;
    }
    const inp = document.getElementById('serverApiKeyInput');
    if (inp) inp.value = '';
    await updateProviderStatus();
    showToast(t('toast_server_key_cleared', 'ล้าง Server API key ที่บันทึกไว้แล้ว'));
  } catch {
    showToast(t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  }
}

async function updateProviderStatus() {
  const el = document.getElementById('providerStatus');
  if (!el) return;
  try {
    const r = await fetch('/api/status');
    const s = await r.json();
    clientKeyAllowed = !!s.allowClientKeys;
    const isVps = s.runtimeMode === 'vps';
    const mode = document.getElementById('keyMode');
    const browserOption = mode && mode.querySelector ? mode.querySelector('[value="browser"]') : null;
    if (browserOption) browserOption.disabled=isVps||!clientKeyAllowed;

    if (isVps || !clientKeyAllowed) {
      setKeyMode('server', true);
    } else {
      const prev = readProviderSettings();
      if (!s.aiConfigured || prev.keyMode === 'browser') setKeyMode('browser', true);
      else setKeyMode(prev.keyMode || 'server', true);
    }

    const canEditServerKey = !isVps || !!s.authRequired;
    const skInput = document.getElementById('serverApiKeyInput');
    const skSave = document.getElementById('saveServerKeyBtn');
    const skClear = document.getElementById('clearServerKeyBtn');
    if (skInput) {
      skInput.disabled = !canEditServerKey;
      if (!canEditServerKey) skInput.placeholder = t('status_vps_no_admin_key', 'โหมด VPS ต้องใส่ Server Access Token เพื่อแก้ Server key หรือตั้งใน .env');
    }
    if (skSave) skSave.disabled = !canEditServerKey;
    if (skClear) skClear.disabled = !canEditServerKey;

    if (s.aiConfigured) {
      el.textContent = s.serverKeyMasked
        ? t('status_server_configured_masked', '● ตั้งค่า server key แล้ว ({masked})').replace('{masked}', s.serverKeyMasked)
        : t('status_server_configured', '● ตั้งค่า server key แล้ว');
    } else if (clientKeyAllowed) {
      el.textContent = t('status_browser_ready', '● ไม่มี server key · พร้อมใช้งาน Browser key บน local/LAN');
    } else {
      el.textContent = t('status_no_key', '● ยังไม่ได้ตั้งค่า API key');
    }
    if (el.style) el.style.color = s.aiConfigured ? 'var(--green)' : 'var(--muted)';

    const chp = document.getElementById('customHostPanel');
    if (chp) {
      if (chp.style) chp.style.display = isVps ? 'none' : 'block';
      if (!isVps) loadCustomHostList();
    }
  } catch {
    el.textContent = t('status_no_backend', 'ไม่พบ backend');
  }
}

// ── Custom Endpoint Allowlist (local/LAN) ─────────────────────────────────────
async function loadCustomHostList() {
  try {
    const r = await fetch('/api/custom-hosts', { headers: getSessionHeaders() });
    if (!r.ok) return;
    const d = await r.json();
    renderCustomHostList(d.hosts || []);
  } catch {}
}

function renderCustomHostList(hosts) {
  const ul = document.getElementById('customHostList');
  if (!ul) return;
  if (!hosts.length) {
    ul.innerHTML = `<p style="font-size:12px;color:var(--muted);margin:0">${safe(t('custom_host_empty', 'ยังไม่มี custom host · เพิ่มด้านบน'))}</p>`;
    return;
  }
  ul.innerHTML = hosts.map(h =>
    `<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--panel-2,rgba(255,255,255,.04));border-radius:6px;font-size:13px"><code style="font-family:var(--mono,monospace)">${safe(h)}</code><button class="icon-button" style="color:var(--pink);font-size:12px;padding:2px 7px" data-host="${safe(h)}" onclick="removeCustomHost(this.dataset.host)" title="${safe(t('btn_delete', 'ลบ'))}">✕</button></div>`
  ).join('');
}

async function addCustomHost() {
  const inp = document.getElementById('customHostInput');
  if (!inp) return;
  const raw = inp.value.trim();
  if (!raw) {
    showToast(t('host_add_required', 'ใส่ hostname ก่อน'));
    return;
  }
  try {
    const r = await fetch('/api/custom-hosts', {
      method: 'POST',
      headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
      body: JSON.stringify({ host: raw })
    });
    const d = await r.json();
    if (!r.ok) {
      showToast(d.error || t('host_add_failed', 'เพิ่ม host ไม่ได้'));
      return;
    }
    renderCustomHostList(d.hosts || []);
    inp.value = '';
    showToast(t('toast_host_added', 'เพิ่ม host สำเร็จ: ') + raw);
  } catch {
    showToast(t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  }
}

async function removeCustomHost(host) {
  try {
    const r = await fetch('/api/custom-hosts', {
      method: 'DELETE',
      headers: Object.assign({ 'content-type': 'application/json' }, getSessionHeaders()),
      body: JSON.stringify({ host })
    });
    const d = await r.json();
    if (!r.ok) {
      showToast(d.error || t('host_del_failed', 'ลบ host ไม่ได้'));
      return;
    }
    renderCustomHostList(d.hosts || []);
    showToast(t('toast_host_deleted', 'ลบ host แล้ว: ') + host);
  } catch {
    showToast(t('server_connect_failed', 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));
  }
}

// ── Model Discovery & Connection Testing ──────────────────────────────────────
async function loadModels() {
  const selected = document.getElementById('providerSelect')?.value || 'OpenAI';
  const provider = PROVIDER_MAP[selected];
  const baseUrl = normalizeBaseUrl(document.getElementById('baseUrl')?.value.trim() || (provider === 'ollama' ? 'http://localhost:11434/v1' : ''));
  const fetchBtn = document.querySelector('#view-settings [onclick="loadModels()"]');

  if (provider !== 'ollama' && keyMode === 'browser' && (!clientKeyAllowed || !sessionApiKey)) {
    if (typeof playSfx === 'function') playSfx('error');
    showToast(t('toast_enter_browser_key_before_fetch', 'ใส่ Browser API key ก่อนดึงโมเดล'));
    return;
  }
  if (fetchBtn) {
    fetchBtn.disabled = true;
    fetchBtn.textContent = t('btn_fetching', 'กำลังดึง…');
  }
  try {
    const payload = { provider, baseUrl };
    if (keyMode === 'browser' && provider !== 'ollama') payload.apiKey = sessionApiKey;
    const { r, data } = await postWithAutoHost('/api/models', payload);
    if (!r.ok) {
      if (data && data.host && !data.canAddDynamic) {
        showToast(t('host_not_allowed_vps', 'Host {host} ไม่ได้รับอนุญาต — เพิ่ม hostname ใน CUSTOM_ENDPOINT_HOSTS บน server (VPS mode)').replace('{host}', data.host));
        return;
      }
      throw new Error(data.error || t('fetch_models_fail', 'ดึงโมเดลไม่สำเร็จ'));
    }
    const models = (data.models || []).filter(x => typeof x === 'string' && x).slice(0, 300);
    const cache = getModelCache();
    cache[selected] = models;
    remoteSet('modelCache', cache);
    if (!models.length) {
      showToast(t('no_models_found', 'ไม่พบโมเดล'));
      return;
    }
    const s = document.getElementById('modelSelect');
    if (s && !models.includes(s.value.trim())) s.value = models[0];
    saveProviderSettings();
    renderModelChoices();
    showToast(t('toast_models_loaded', 'โหลดโมเดล {n} รายการ').replace('{n}', models.length));
  } catch (e) {
    showToast(e.message);
  } finally {
    if (fetchBtn) {
      fetchBtn.disabled = false;
      fetchBtn.textContent = t('settings_fetch_models', 'ดึงโมเดล');
    }
  }
}

function clearConnectionTestBox() {
  const box = document.getElementById('connectionTestStatus');
  if (box) {
    box.hidden = true;
    box.className = 'conn-test-box';
    box.textContent = '';
  }
}

async function testAiConnection() {
  const box = document.getElementById('connectionTestStatus');
  const btn = document.getElementById('testConnectionBtn');
  const selected = document.getElementById('providerSelect')?.value || 'OpenAI';
  const provider = PROVIDER_MAP[selected];
  const rawUrl = document.getElementById('baseUrl')?.value.trim() || '';
  const baseUrl = normalizeBaseUrl(rawUrl || (provider === 'ollama' ? 'http://localhost:11434/v1' : ''));
  const model = document.getElementById('modelSelect')?.value.trim() || '';

  if (provider !== 'ollama' && keyMode === 'browser' && (!clientKeyAllowed || !sessionApiKey)) {
    const errMsg = t('conn_test_fail', '✗ เชื่อมต่อไม่สำเร็จ: {error}').replace('{error}', t('err_enter_browser_key_first', 'ใส่ Browser API key ก่อน'));
    if (box) { box.hidden = false; box.className = 'conn-test-box err'; box.textContent = errMsg; }
    if (typeof playSfx === 'function') playSfx('error');
    showToast(errMsg);
    return;
  }

  if (box) {
    box.hidden = false;
    box.className = 'conn-test-box pending';
    box.textContent = t('settings_testing_conn', 'กำลังทดสอบการเชื่อมต่อ…');
  }
  if (btn) btn.disabled = true;

  try {
    const payload = { provider, baseUrl, model };
    if (keyMode === 'browser' && provider !== 'ollama') payload.apiKey = sessionApiKey;
    const { r, data } = await postWithAutoHost('/api/test-connection', payload);
    if (!r.ok || !data.ok) {
      const errText = data.error || t('fetch_models_fail', 'เชื่อมต่อไม่สำเร็จ');
      const msg = t('conn_test_fail', '✗ เชื่อมต่อไม่สำเร็จ: {error}').replace('{error}', errText);
      if (box) { box.className = 'conn-test-box err'; box.textContent = msg; }
      if (typeof playSfx === 'function') playSfx('error');
      return;
    }

    if (Array.isArray(data.models) && data.models.length) {
      const cache = getModelCache();
      cache[selected] = data.models.slice(0, 300);
      remoteSet('modelCache', cache);
      const ms = document.getElementById('modelSelect');
      if (ms && !ms.value.trim()) {
        ms.value = data.models[0];
        saveProviderSettings();
      }
      renderModelChoices();
    }

    const msg = data.mode === 'chat'
      ? t('conn_test_ok_chat', '✓ เชื่อมต่อและตอบกลับจาก {model} สำเร็จ ({latency} ms)')
          .replace('{model}', data.model || model)
          .replace('{latency}', data.latencyMs || 0)
      : t('conn_test_ok_models', '✓ เชื่อมต่อสำเร็จ ({latency} ms) · พบ {n} โมเดล')
          .replace('{latency}', data.latencyMs || 0)
          .replace('{n}', data.modelCount ?? (data.models || []).length);

    if (box) { box.className = 'conn-test-box ok'; box.textContent = msg; }
    if (typeof playSfx === 'function') playSfx('success');
  } catch (e) {
    const msg = t('conn_test_fail', '✗ เชื่อมต่อไม่สำเร็จ: {error}').replace('{error}', e.message || 'Network error');
    if (box) { box.className = 'conn-test-box err'; box.textContent = msg; }
  } finally {
    if (btn) btn.disabled = false;
  }
}

function saveGlobalPrompt() {
  try {
    remoteSet('globalPrompt', document.getElementById('globalPrompt')?.value || '');
  } catch (e) {
    showToast(t('toast_cannot_save_in_mode', 'บันทึกไม่ได้ในโหมดนี้'));
  }
}

function resetGlobalPrompt() {
  const gp = document.getElementById('globalPrompt');
  if (gp) gp.value = t('default_global_prompt', DEFAULT_GLOBAL_PROMPT);
  saveGlobalPrompt();
  showToast(t('prompt_reset_done', 'คืนค่าพรอมต์หลักแล้ว'));
}

// ── Multi-Theme System & Custom Theme Studio ──────────────────────────────────
const THEMES = [
  { id: 'obsidian', metaColor: '#12110f', icon: '◐' },
  { id: 'sakura', metaColor: '#17111a', icon: '✿' },
  { id: 'emerald', metaColor: '#0e1613', icon: '✦' },
  { id: 'ocean', metaColor: '#0d131c', icon: '〰' },
  { id: 'parchment', metaColor: '#f4efe6', icon: '☀' },
  { id: 'custom', metaColor: '#12110f', icon: '🎨' }
];
const DEFAULT_CUSTOM_THEME = {
  accent: '#d6aa76',
  bg: '#12110f',
  panel: '#1a1815',
  text: '#f3eee5',
  bgOpacity: 32,
  bgImage: ''
};
const CUSTOM_THEME_CSS_VARS = [
  '--bg', '--bg-glow-1', '--bg-glow-2', '--panel', '--panel2', '--panel-elev',
  '--card-bg', '--modal-bg', '--topbar-bg', '--sidebar-bg', '--drawer-bg',
  '--input-bg', '--input-focus-bg', '--bubble-bg', '--bubble-user-bg', '--bubble-user-line',
  '--compose-box-bg', '--compose-box-focus-bg', '--tool-chip-bg', '--chat-scrim',
  '--line', '--line-strong', '--text', '--soft', '--muted', '--speech-color',
  '--accent', '--accent-hover', '--accent-soft', '--accent-border', '--accent-ink',
  '--chip-active-bg', '--chip-active-text', '--tag-bg'
];
let activeTheme = 'obsidian';
let pendingCustomThemeBg = '';

function normalizeHexColor(val, fallback) {
  return /^#[0-9a-fA-F]{6}$/.test(String(val || '')) ? String(val).toLowerCase() : fallback;
}

function hexToRgb(hex) {
  const clean = normalizeHexColor(hex, '#12110f').slice(1);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  };
}

function rgbaHex(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHex(hexA, hexB, ratio = 0.5) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  const mix = (x, y) => Math.round(x + (y - x) * ratio);
  return `#${[mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b)].map(v => v.toString(16).padStart(2, '0')).join('')}`;
}

function isLightHex(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.56;
}

function getCustomThemeConfig() {
  try {
    const raw = localStorage.getItem(CACHE_KEYS.customTheme);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        const op = Number(parsed.bgOpacity);
        return {
          accent: normalizeHexColor(parsed.accent, DEFAULT_CUSTOM_THEME.accent),
          bg: normalizeHexColor(parsed.bg, DEFAULT_CUSTOM_THEME.bg),
          panel: normalizeHexColor(parsed.panel, DEFAULT_CUSTOM_THEME.panel),
          text: normalizeHexColor(parsed.text, DEFAULT_CUSTOM_THEME.text),
          bgOpacity: Number.isFinite(op) ? Math.max(0, Math.min(85, Math.round(op))) : DEFAULT_CUSTOM_THEME.bgOpacity,
          bgImage: typeof parsed.bgImage === 'string' && /^data:image\/(png|jpeg|webp);base64,/.test(parsed.bgImage) ? parsed.bgImage : ''
        };
      }
    }
  } catch {}
  return { ...DEFAULT_CUSTOM_THEME };
}

function applyCustomThemeCssVars(cfg) {
  const rootStyle = typeof document !== 'undefined' && document.documentElement ? document.documentElement.style : null;
  const c = {
    accent: normalizeHexColor(cfg?.accent, DEFAULT_CUSTOM_THEME.accent),
    bg: normalizeHexColor(cfg?.bg, DEFAULT_CUSTOM_THEME.bg),
    panel: normalizeHexColor(cfg?.panel, DEFAULT_CUSTOM_THEME.panel),
    text: normalizeHexColor(cfg?.text, DEFAULT_CUSTOM_THEME.text),
    bgOpacity: Math.max(0, Math.min(85, Math.round(Number(cfg?.bgOpacity ?? DEFAULT_CUSTOM_THEME.bgOpacity)))),
    bgImage: String(cfg?.bgImage || '')
  };
  const light = isLightHex(c.bg);
  if (rootStyle && typeof rootStyle.setProperty === 'function') {
    const vars = {
      '--bg': c.bg,
      '--bg-glow-1': rgbaHex(c.accent, 0.16),
      '--bg-glow-2': rgbaHex(c.accent, 0.08),
      '--panel': rgbaHex(c.panel, c.bgImage ? 0.86 : 1),
      '--panel2': rgbaHex(mixHex(c.panel, c.text, 0.07), c.bgImage ? 0.88 : 1),
      '--panel-elev': mixHex(c.panel, c.text, 0.13),
      '--card-bg': rgbaHex(c.panel, c.bgImage ? 0.86 : 1),
      '--modal-bg': mixHex(c.panel, c.bg, 0.12),
      '--topbar-bg': rgbaHex(c.bg, 0.88),
      '--sidebar-bg': `linear-gradient(180deg, ${rgbaHex(c.panel, 0.9)}, ${rgbaHex(c.bg, 0.94)})`,
      '--drawer-bg': c.panel,
      '--input-bg': mixHex(c.bg, c.panel, 0.45),
      '--input-focus-bg': c.panel,
      '--bubble-bg': rgbaHex(c.panel, 0.78),
      '--bubble-user-bg': rgbaHex(mixHex(c.panel, c.accent, 0.18), 0.82),
      '--bubble-user-line': rgbaHex(c.accent, 0.4),
      '--compose-box-bg': rgbaHex(c.panel, 0.62),
      '--compose-box-focus-bg': rgbaHex(c.panel, 0.82),
      '--tool-chip-bg': rgbaHex(c.panel, 0.72),
      '--chat-scrim': c.bg,
      '--line': mixHex(c.panel, c.text, 0.15),
      '--line-strong': mixHex(c.panel, c.text, 0.3),
      '--text': c.text,
      '--soft': mixHex(c.text, c.bg, 0.22),
      '--muted': mixHex(c.text, c.bg, 0.46),
      '--speech-color': light ? '#14110f' : '#fffaf2',
      '--accent': c.accent,
      '--accent-hover': mixHex(c.accent, light ? '#000000' : '#ffffff', 0.18),
      '--accent-soft': rgbaHex(c.accent, 0.15),
      '--accent-border': rgbaHex(c.accent, 0.44),
      '--accent-ink': isLightHex(c.accent) ? '#181410' : '#ffffff',
      '--chip-active-bg': mixHex(c.panel, c.accent, 0.22),
      '--chip-active-text': light ? mixHex(c.accent, '#000000', 0.24) : mixHex(c.accent, '#ffffff', 0.45),
      '--tag-bg': rgbaHex(c.bg, 0.84)
    };
    for (const [k, v] of Object.entries(vars)) rootStyle.setProperty(k, v);
  }
  const bgLayer = typeof document !== 'undefined' ? document.getElementById('appCustomBg') : null;
  if (bgLayer && bgLayer.style) {
    if (c.bgImage) {
      bgLayer.style.backgroundImage = `url("${c.bgImage}")`;
      bgLayer.style.opacity = String(c.bgOpacity / 100);
    } else {
      bgLayer.style.backgroundImage = '';
      bgLayer.style.opacity = '0';
    }
  }
}

function clearCustomThemeCssVars() {
  const rootStyle = typeof document !== 'undefined' && document.documentElement ? document.documentElement.style : null;
  if (rootStyle && typeof rootStyle.removeProperty === 'function') {
    for (const k of CUSTOM_THEME_CSS_VARS) rootStyle.removeProperty(k);
  }
  const bgLayer = typeof document !== 'undefined' ? document.getElementById('appCustomBg') : null;
  if (bgLayer && bgLayer.style) {
    bgLayer.style.backgroundImage = '';
    bgLayer.style.opacity = '0';
  }
}

function syncCustomThemeInputs(cfg) {
  const c = cfg || getCustomThemeConfig();
  pendingCustomThemeBg = c.bgImage || '';
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  setVal('customThemeAccent', c.accent);
  setVal('customThemeBg', c.bg);
  setVal('customThemePanel', c.panel);
  setVal('customThemeText', c.text);
  setVal('customThemeBgOpacity', String(c.bgOpacity));
  const opValEl = document.getElementById('customThemeBgOpacityVal');
  if (opValEl) opValEl.textContent = `${c.bgOpacity}%`;
  const prev = document.getElementById('customThemeBgPreview');
  if (prev) {
    prev.hidden = !pendingCustomThemeBg;
    if (prev.style) prev.style.backgroundImage = pendingCustomThemeBg ? `url("${pendingCustomThemeBg}")` : '';
  }
  const swatch = document.getElementById('customThemeCardSwatch');
  if (swatch && swatch.style) {
    swatch.style.background = `linear-gradient(135deg, ${c.bg} 55%, ${c.accent} 55%)`;
  }
}

function readCustomThemeDraft() {
  const prev = getCustomThemeConfig();
  return {
    accent: normalizeHexColor(document.getElementById('customThemeAccent')?.value, prev.accent),
    bg: normalizeHexColor(document.getElementById('customThemeBg')?.value, prev.bg),
    panel: normalizeHexColor(document.getElementById('customThemePanel')?.value, prev.panel),
    text: normalizeHexColor(document.getElementById('customThemeText')?.value, prev.text),
    bgOpacity: Math.max(0, Math.min(85, Math.round(Number(document.getElementById('customThemeBgOpacity')?.value ?? prev.bgOpacity)))),
    bgImage: pendingCustomThemeBg
  };
}

function updateCustomThemeDraft() {
  const draft = readCustomThemeDraft();
  const opValEl = document.getElementById('customThemeBgOpacityVal');
  if (opValEl) opValEl.textContent = `${draft.bgOpacity}%`;
  const swatch = document.getElementById('customThemeCardSwatch');
  if (swatch && swatch.style) {
    swatch.style.background = `linear-gradient(135deg, ${draft.bg} 55%, ${draft.accent} 55%)`;
  }
  activeTheme = 'custom';
  document.documentElement?.setAttribute?.('data-theme', 'custom');
  applyCustomThemeCssVars(draft);
  if (typeof syncAndroidStatusBar === 'function') syncAndroidStatusBar(draft.bg);
  renderThemeSelector();
}

async function previewCustomThemeBg(input) {
  try {
    const f = input?.files && input.files[0];
    if (!f || typeof readImageData !== 'function') return;
    pendingCustomThemeBg = await readImageData(f);
    const prev = document.getElementById('customThemeBgPreview');
    if (prev) {
      prev.hidden = false;
      if (prev.style) prev.style.backgroundImage = `url("${pendingCustomThemeBg}")`;
    }
    updateCustomThemeDraft();
  } catch (e) {
    pendingCustomThemeBg = '';
    if (input) input.value = '';
    showToast(e?.message || t('image_pick_failed', 'เลือกภาพไม่สำเร็จ'));
  }
}

function clearCustomThemeBg() {
  pendingCustomThemeBg = '';
  const inp = document.getElementById('customThemeBgInput');
  if (inp) inp.value = '';
  const prev = document.getElementById('customThemeBgPreview');
  if (prev) {
    prev.hidden = true;
    if (prev.style) prev.style.backgroundImage = '';
  }
  if (activeTheme === 'custom') updateCustomThemeDraft();
}

function saveCustomTheme() {
  const cfg = readCustomThemeDraft();
  try { localStorage.setItem(CACHE_KEYS.customTheme, JSON.stringify(cfg)); } catch {}
  if (typeof remoteSet === 'function') remoteSet('customTheme', cfg);
  applyTheme('custom', { quiet: true });
  try { localStorage.setItem(CACHE_KEYS.activeTheme, 'custom'); } catch {}
  if (typeof remoteSet === 'function') remoteSet('activeTheme', 'custom');
  if (typeof playSfx === 'function') playSfx('theme');
  showToast(t('toast_custom_theme_saved', 'บันทึกและเปิดใช้ธีมของคุณแล้ว'));
}

function resetCustomTheme() {
  const resetCfg = { ...DEFAULT_CUSTOM_THEME };
  pendingCustomThemeBg = '';
  const inp = document.getElementById('customThemeBgInput');
  if (inp) inp.value = '';
  if (typeof remoteSet === 'function') remoteSet('customTheme', {});
  try { localStorage.removeItem(CACHE_KEYS.customTheme); } catch {}
  syncCustomThemeInputs(resetCfg);
  if (activeTheme === 'custom') applyCustomThemeCssVars(resetCfg);
  if (typeof playSfx === 'function') playSfx('tap');
  showToast(t('toast_custom_theme_reset', 'รีเซ็ตธีมกำหนดเองกลับเป็นค่าเริ่มต้นแล้ว'));
}

function renderThemeSelector() {
  for (const containerId of ['themeGrid', 'mobileThemeDots']) {
    const root = document.getElementById(containerId);
    if (!root || typeof root.querySelectorAll !== 'function') continue;
    root.querySelectorAll('[data-theme-id]').forEach(btn => {
      const isCur = btn.getAttribute('data-theme-id') === activeTheme;
      btn.classList?.toggle('active', isCur);
      btn.setAttribute?.('aria-pressed', String(isCur));
    });
  }
  const topBtn = document.getElementById('themeToggleBtn');
  const curTheme = THEMES.find(x => x.id === activeTheme) || THEMES[0];
  if (topBtn && curTheme) {
    if (topBtn.dataset) topBtn.dataset.theme = curTheme.id;
    const baseLabel = typeof t === 'function' ? t('btn_theme', 'เปลี่ยนธีมสี / Theme') : 'Theme';
    const themeName = typeof t === 'function' ? t('theme_' + curTheme.id, curTheme.id) : curTheme.id;
    topBtn.title = `${baseLabel}: ${themeName}`;
    if (!topBtn.querySelector || !topBtn.querySelector('svg')) {
      topBtn.textContent = curTheme.icon;
    }
  }
}

function applyTheme(themeId, options = {}) {
  const quiet = !!options.quiet;
  const chosen = THEMES.find(x => x.id === themeId) || THEMES[0];
  activeTheme = chosen.id;

  let metaColor = chosen.metaColor;
  if (activeTheme === 'custom') {
    const cfg = getCustomThemeConfig();
    metaColor = cfg.bg;
    document.documentElement?.setAttribute?.('data-theme', 'custom');
    applyCustomThemeCssVars(cfg);
    syncCustomThemeInputs(cfg);
  } else {
    clearCustomThemeCssVars();
    if (typeof document !== 'undefined' && document.documentElement) {
      if (activeTheme === 'obsidian') {
        document.documentElement.removeAttribute?.('data-theme');
      } else {
        document.documentElement.setAttribute?.('data-theme', activeTheme);
      }
    }
  }
  const metaTheme = typeof document !== 'undefined' ? document.querySelector?.('meta[name="theme-color"]') : null;
  if (metaTheme?.setAttribute) {
    metaTheme.setAttribute('content', metaColor);
  }
  if (typeof syncAndroidStatusBar === 'function') syncAndroidStatusBar(metaColor);
  renderThemeSelector();

  if (!quiet) {
    try { localStorage.setItem(CACHE_KEYS.activeTheme, activeTheme); } catch {}
    if (typeof remoteSet === 'function') remoteSet('activeTheme', activeTheme);
    if (typeof playSfx === 'function') playSfx('theme');
    const themeTitle = typeof t === 'function' ? t('theme_' + activeTheme, activeTheme) : activeTheme;
    showToast((typeof t === 'function' ? t('toast_theme_changed', 'เปลี่ยนธีมเป็น {theme} แล้ว') : 'Changed theme to {theme}').replace('{theme}', themeTitle));
  }
}

function cycleTheme() {
  let hasCustom = false;
  try {
    const raw = localStorage.getItem(CACHE_KEYS.customTheme);
    hasCustom = Boolean(raw && raw !== '{}');
  } catch {}
  const list = hasCustom ? THEMES : THEMES.filter(x => x.id !== 'custom');
  const idx = list.findIndex(x => x.id === activeTheme);
  const next = list[(idx + 1) % list.length];
  applyTheme(next.id, { quiet: false });
}

function loadTheme() {
  syncCustomThemeInputs();
  let saved = 'obsidian';
  try {
    saved = localStorage.getItem(CACHE_KEYS.activeTheme) || 'obsidian';
  } catch {}
  applyTheme(saved, { quiet: true });
}
