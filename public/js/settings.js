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
      return;
    }
    for (const m of list) {
      const o = document.createElement('option');
      o.value = m;
      o.textContent = m;
      o.selected = m === current;
      sel.appendChild(o);
    }
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

// ── Multi-Theme System ────────────────────────────────────────────────────────
const THEMES = [
  { id: 'obsidian', metaColor: '#12110f', icon: '◐' },
  { id: 'sakura', metaColor: '#17111a', icon: '✿' },
  { id: 'emerald', metaColor: '#0e1613', icon: '✦' },
  { id: 'ocean', metaColor: '#0d131c', icon: '〰' },
  { id: 'parchment', metaColor: '#f4efe6', icon: '☀' }
];
let activeTheme = 'obsidian';

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

  if (typeof document !== 'undefined' && document.documentElement) {
    if (activeTheme === 'obsidian') {
      document.documentElement.removeAttribute?.('data-theme');
    } else {
      document.documentElement.setAttribute?.('data-theme', activeTheme);
    }
  }
  const metaTheme = typeof document !== 'undefined' ? document.querySelector?.('meta[name="theme-color"]') : null;
  if (metaTheme?.setAttribute) {
    metaTheme.setAttribute('content', chosen.metaColor);
  }
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
  const idx = THEMES.findIndex(x => x.id === activeTheme);
  const next = THEMES[(idx + 1) % THEMES.length];
  applyTheme(next.id, { quiet: false });
}

function loadTheme() {
  let saved = 'obsidian';
  try {
    saved = localStorage.getItem(CACHE_KEYS.activeTheme) || 'obsidian';
  } catch {}
  applyTheme(saved, { quiet: true });
}
