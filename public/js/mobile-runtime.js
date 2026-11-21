// ── Mobile Standalone APK Runtime & Native Android Bridge ─────────────────────
const MOBILE_MODE_KEY = 'hush-mobile-mode';
const REMOTE_SERVER_URL_KEY = 'hush-remote-server-url';
const DEVICE_API_KEY_STORAGE = 'hush-device-api-key';
const APK_SETTINGS_KEY = 'hush-apk-settings';
const APK_CHARACTERS_KEY = 'hush-apk-characters';
const APK_CUSTOM_HOSTS_KEY = 'hush-apk-custom-hosts';

const nativeHttpPending = new Map();
let nativeHttpSeq = 0;

function isNativeAndroidApp() {
  try {
    return Boolean(
      (typeof window !== 'undefined' && window.HushAndroid) ||
      (typeof window !== 'undefined' && window.location && window.location.hostname === 'appassets.androidplatform.net')
    );
  } catch {
    return false;
  }
}

function getMobileConnectionMode() {
  try {
    const mode = localStorage.getItem(MOBILE_MODE_KEY);
    return mode === 'server' ? 'server' : 'standalone';
  } catch {
    return 'standalone';
  }
}

function getRemoteServerUrl() {
  try {
    const raw = String(localStorage.getItem(REMOTE_SERVER_URL_KEY) || '').trim();
    if (!raw) return '';
    const u = new URL(raw.includes('://') ? raw : `http://${raw}`);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function maskDeviceKey(k) {
  const s = String(k || '').trim();
  if (!s) return '';
  return s.length > 8 ? s.slice(0, 3) + '••••' + s.slice(-4) : '••••';
}

function getDeviceApiKey() {
  try { return String(localStorage.getItem(DEVICE_API_KEY_STORAGE) || '').trim(); } catch { return ''; }
}

function setDeviceApiKey(val) {
  const clean = String(val || '').trim().slice(0, 500);
  try {
    if (clean) localStorage.setItem(DEVICE_API_KEY_STORAGE, clean);
    else localStorage.removeItem(DEVICE_API_KEY_STORAGE);
  } catch {}
  return clean;
}

if (typeof window !== 'undefined') {
  window.__hushNativeHttpCallback = function (reqId, payloadJson) {
    const entry = nativeHttpPending.get(reqId);
    if (!entry) return;
    nativeHttpPending.delete(reqId);
    try {
      const parsed = typeof payloadJson === 'string' ? JSON.parse(payloadJson) : (payloadJson || {});
      entry.resolve(parsed);
    } catch {
      entry.resolve({ ok: false, status: 0, text: '', error: 'Invalid bridge response' });
    }
  };
}

function nativeHttpRequest({ url, method = 'GET', headers = {}, body = undefined, timeoutMs = 60000, signal = null }) {
  if (typeof window !== 'undefined' && window.HushAndroid && typeof window.HushAndroid.httpRequestAsync === 'function') {
    return new Promise((resolve, reject) => {
      if (signal && signal.aborted) {
        const err = new Error('Request aborted');
        err.name = 'AbortError';
        return reject(err);
      }
      const reqId = `req_${++nativeHttpSeq}_${Date.now()}`;
      const onAbort = () => {
        if (nativeHttpPending.has(reqId)) {
          nativeHttpPending.delete(reqId);
          try { window.HushAndroid.cancelHttpRequest?.(reqId); } catch {}
          const err = new Error('Request aborted');
          err.name = 'AbortError';
          reject(err);
        }
      };
      if (signal && typeof signal.addEventListener === 'function') {
        signal.addEventListener('abort', onAbort, { once: true });
      }
      nativeHttpPending.set(reqId, {
        resolve: res => {
          if (signal && typeof signal.removeEventListener === 'function') signal.removeEventListener('abort', onAbort);
          if (res && res.aborted) {
            const err = new Error('Request aborted');
            err.name = 'AbortError';
            return reject(err);
          }
          if (res && res.error && !res.status) {
            const err = new Error(res.error);
            if (/timeout/i.test(res.error)) err.name = 'TimeoutError';
            return reject(err);
          }
          resolve({
            ok: Boolean(res && res.status >= 200 && res.status < 300),
            status: Number(res && res.status) || 0,
            text: async () => String((res && res.text) || ''),
            json: async () => JSON.parse(String((res && res.text) || '{}'))
          });
        }
      });
      try {
        window.HushAndroid.httpRequestAsync(reqId, JSON.stringify({
          url: String(url || ''),
          method: String(method || 'GET').toUpperCase(),
          headers: headers || {},
          body: body !== undefined ? String(body) : null,
          timeoutMs: Number(timeoutMs) || 60000
        }));
      } catch (e) {
        nativeHttpPending.delete(reqId);
        reject(e);
      }
    });
  }
  const init = { method, headers, body };
  if (signal) init.signal = signal;
  return originalBrowserFetch(url, init);
}

function syncAndroidStatusBar(hexColor) {
  try {
    if (typeof window === 'undefined' || !window.HushAndroid || typeof window.HushAndroid.setStatusBarColor !== 'function') return;
    const hex = /^#[0-9a-fA-F]{6}$/.test(String(hexColor || '')) ? String(hexColor) : '#12110f';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const isLight = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.56;
    window.HushAndroid.setStatusBarColor(hex, isLight);
  } catch {}
}

function saveFileNativeOrBrowser(filename, mimeType, content) {
  if (typeof window !== 'undefined' && window.HushAndroid && typeof window.HushAndroid.saveTextFile === 'function') {
    try {
      const ok = window.HushAndroid.saveTextFile(String(filename), String(mimeType || 'text/plain'), String(content || ''));
      if (ok) return true;
    } catch {}
  }
  if (typeof Blob === 'function' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const blob = new Blob([content], { type: mimeType || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return true;
  }
  return false;
}

function makeMockJsonResponse(status, data) {
  const str = JSON.stringify(data);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(str),
    text: async () => str
  };
}

function apkReadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function apkWriteJson(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function apkStripThinking(text) {
  return String(text || '')
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>/gi, '')
    .replace(/<think\b[^>]*>[\s\S]*$/gi, '')
    .trim();
}

function apkTrimSentence(text) {
  const s = String(text || '').replace(/\s+$/, '');
  const m = s.match(/^[\s\S]*[.!?…。！？」”)\]\*]/);
  return m && m[0].length >= Math.floor(s.length * 0.4) ? m[0] : s;
}

function apkNormalizeBase(raw) {
  const u = new URL(String(raw || ''));
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/\/+$/, '').replace(/\/(chat\/completions|models|api\/tags)$/, '');
  return u;
}

async function apkDiscoverModels(body, signal) {
  const provider = body.provider || 'openai';
  const rawBase = body.baseUrl || (provider === 'ollama' ? 'http://localhost:11434/v1' : provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
  let base;
  try { base = apkNormalizeBase(rawBase); } catch { return { status: 400, error: 'Invalid provider base URL' }; }
  const effectiveKey = provider === 'ollama' ? '' : (String(body.apiKey || '').trim() || getDeviceApiKey());
  if (provider !== 'ollama' && !effectiveKey) return { status: 503, error: 'Please set your API key in Settings first' };

  if (provider === 'ollama') {
    const basePath = base.pathname.replace(/\/+$/, '');
    const candidates = basePath.endsWith('/v1')
      ? [`${base.origin}${basePath}/models`, `${base.origin}/api/tags`]
      : [`${base.origin}/api/tags`, `${base.origin}${basePath}/v1/models`];
    for (const ep of candidates) {
      try {
        const r = await nativeHttpRequest({ url: ep, method: 'GET', timeoutMs: 15000, signal });
        if (!r.ok) continue;
        const d = await r.json().catch(() => ({}));
        const list = [
          ...(Array.isArray(d.data) ? d.data.map(m => m && m.id) : []),
          ...(Array.isArray(d.models) ? d.models.map(m => m && (m.name || m.id)) : [])
        ].filter(x => typeof x === 'string' && x);
        if (list.length) return { ok: true, models: [...new Set(list)] };
      } catch (e) {
        if (e && e.name === 'AbortError') throw e;
      }
    }
    return { status: 502, error: 'Could not reach Ollama at ' + base.origin };
  }

  const endpoint = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/models'
    : base.toString().replace(/\/$/, '') + '/models';
  const headers = { 'content-type': 'application/json' };
  if (effectiveKey) headers.authorization = 'Bearer ' + effectiveKey;
  try {
    const r = await nativeHttpRequest({ url: endpoint, method: 'GET', headers, timeoutMs: 20000, signal });
    if (!r.ok) return { status: 502, error: `Provider model list failed (${r.status})` };
    const data = await r.json().catch(() => ({}));
    return { ok: true, models: Array.isArray(data.data) ? data.data.map(m => m && m.id).filter(Boolean) : [] };
  } catch (e) {
    if (e && e.name === 'AbortError') throw e;
    return { status: 502, error: 'Could not reach provider model list endpoint' };
  }
}

async function handleStandaloneApiRequest(pathname, method, body, signal) {
  if (pathname === '/api/status' && method === 'GET') {
    const key = getDeviceApiKey();
    return makeMockJsonResponse(200, {
      aiConfigured: Boolean(key),
      serverKeyMasked: maskDeviceKey(key),
      allowClientKeys: true,
      runtimeMode: 'apk-standalone',
      authRequired: false
    });
  }

  if (pathname === '/api/settings') {
    const cur = apkReadJson(APK_SETTINGS_KEY, {});
    if (method === 'GET') {
      const key = getDeviceApiKey();
      return makeMockJsonResponse(200, { ...cur, serverKeyMasked: maskDeviceKey(key) });
    }
    if (method === 'PUT') {
      const next = { ...cur };
      for (const [k, v] of Object.entries(body || {})) {
        if (k === 'serverApiKey') {
          setDeviceApiKey(v);
        } else {
          next[k] = v;
        }
      }
      apkWriteJson(APK_SETTINGS_KEY, next);
      const key = getDeviceApiKey();
      return makeMockJsonResponse(200, { ...next, serverKeyMasked: maskDeviceKey(key) });
    }
  }

  if (pathname === '/api/custom-hosts') {
    const hosts = apkReadJson(APK_CUSTOM_HOSTS_KEY, []);
    if (method === 'GET') return makeMockJsonResponse(200, { hosts });
    if (method === 'POST') {
      const h = String(body?.host || '').trim();
      if (h && !hosts.includes(h)) hosts.push(h);
      apkWriteJson(APK_CUSTOM_HOSTS_KEY, hosts);
      return makeMockJsonResponse(200, { ok: true, hosts });
    }
    if (method === 'DELETE') {
      const next = hosts.filter(x => x !== String(body?.host || '').trim());
      apkWriteJson(APK_CUSTOM_HOSTS_KEY, next);
      return makeMockJsonResponse(200, { ok: true, hosts: next });
    }
  }

  if (pathname === '/api/characters' || pathname.startsWith('/api/characters/')) {
    const all = apkReadJson(APK_CHARACTERS_KEY, []);
    if (method === 'GET') return makeMockJsonResponse(200, all);
    if (method === 'DELETE') {
      const id = decodeURIComponent(pathname.slice('/api/characters/'.length)).trim();
      const next = all.filter(x => x.id !== id && x.name !== id);
      apkWriteJson(APK_CHARACTERS_KEY, next);
      return makeMockJsonResponse(200, { ok: true });
    }
    if (method === 'POST' || method === 'PUT') {
      const targetId = method === 'PUT' ? decodeURIComponent(pathname.slice('/api/characters/'.length)).trim() : (body?.id || `apk_${Date.now()}`);
      const existingIdx = all.findIndex(x => x.id === targetId || (body?.name && x.name === body.name));
      const prev = existingIdx >= 0 ? all[existingIdx] : {};
      const saved = {
        id: prev.id || targetId,
        name: String(body?.name || '').trim().slice(0, 80),
        role: String(body?.role || '').slice(0, 300),
        appearance: String(body?.appearance || '').slice(0, 1000),
        desc: String(body?.desc || '').slice(0, 1500),
        genre: Array.isArray(body?.genre) ? body.genre.slice(0, 10) : ['แฟนตาซี'],
        adult: body?.adult === true,
        systemPrompt: String(body?.systemPrompt || '').slice(0, 10000),
        greeting: String(body?.greeting || '').slice(0, 3000),
        art: String(body?.art || prev.art || 'art2'),
        imageUrl: body?.imageDataUrl || body?.imageUrl || prev.imageUrl || '',
        avatarUrl: body?.avatarDataUrl || body?.avatarUrl || prev.avatarUrl || '',
        updatedAt: new Date().toISOString()
      };
      if (!saved.name) return makeMockJsonResponse(400, { error: 'Character name is required' });
      if (existingIdx >= 0) all[existingIdx] = saved;
      else all.unshift(saved);
      apkWriteJson(APK_CHARACTERS_KEY, all);
      return makeMockJsonResponse(method === 'POST' ? 201 : 200, saved);
    }
  }

  if (pathname === '/api/chats' || pathname.startsWith('/api/chats/')) {
    const stores = apkReadJson('hush-chat-stores', {});
    if (method === 'GET') return makeMockJsonResponse(200, stores);
    const charName = decodeURIComponent(pathname.slice('/api/chats/'.length)).trim();
    if (method === 'PUT') {
      stores[charName] = {
        history: Array.isArray(body?.history) ? body.history.slice(-100) : [],
        aiMemory: Array.isArray(body?.aiMemory) ? body.aiMemory.slice(-20) : [],
        lastUpdated: Number(body?.lastUpdated) || Date.now()
      };
      apkWriteJson('hush-chat-stores', stores);
      return makeMockJsonResponse(200, { ok: true, name: charName });
    }
    if (method === 'DELETE') {
      delete stores[charName];
      apkWriteJson('hush-chat-stores', stores);
      return makeMockJsonResponse(200, { ok: true, name: charName });
    }
  }

  if (pathname === '/api/models' && method === 'POST') {
    const d = await apkDiscoverModels(body || {}, signal);
    if (!d.ok) return makeMockJsonResponse(d.status || 502, { error: d.error });
    return makeMockJsonResponse(200, { models: d.models });
  }

  if (pathname === '/api/test-connection' && method === 'POST') {
    const started = Date.now();
    const d = await apkDiscoverModels(body || {}, signal);
    if (!d.ok) return makeMockJsonResponse(d.status || 502, { ok: false, error: d.error });
    return makeMockJsonResponse(200, {
      ok: true,
      mode: 'models',
      latencyMs: Date.now() - started,
      models: d.models,
      modelCount: d.models.length,
      model: body?.model || d.models[0] || ''
    });
  }

  if (pathname === '/api/chat' && method === 'POST') {
    const provider = body?.provider || 'openai';
    const rawBase = body?.baseUrl || (provider === 'ollama' ? 'http://localhost:11434/v1' : provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : 'https://api.openai.com/v1');
    let base;
    try { base = apkNormalizeBase(rawBase); } catch { return makeMockJsonResponse(400, { error: 'Invalid provider base URL' }); }
    const effectiveKey = provider === 'ollama' ? '' : (String(body?.apiKey || '').trim() || getDeviceApiKey());
    if (provider !== 'ollama' && !effectiveKey) return makeMockJsonResponse(503, { error: 'Please set your API key in Settings first' });
    const model = String(body?.model || '').trim();
    if (!model) return makeMockJsonResponse(400, { error: 'Model is required' });

    const maxTokens = Math.max(64, Math.min(1200, Number(body?.maxTokens || 300)));
    const maxInputTokens = Math.max(400, Math.min(8000, Number(body?.maxInputTokens || 1200)));
    const temperature = Math.max(0, Math.min(2, Number(body?.temperature ?? 0.8)));
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const basePath = base.pathname.replace(/\/+$/, '');
    const endpoint = provider === 'ollama'
      ? (basePath.endsWith('/v1') ? `${base.origin}${basePath}/chat/completions` : `${base.origin}${basePath}/v1/chat/completions`)
      : `${base.toString().replace(/\/$/, '')}/chat/completions`;
    const headers = { 'content-type': 'application/json' };
    if (effectiveKey) headers.authorization = 'Bearer ' + effectiveKey;
    const ollamaNumCtx = Math.min(8192, Math.max(2048, maxInputTokens * 2));
    const payload = provider === 'ollama'
      ? { model, messages, temperature, max_tokens: maxTokens, stream: false, think: false, reasoning_effort: 'none', options: { num_ctx: ollamaNumCtx, num_predict: maxTokens, temperature } }
      : { model, messages, temperature, max_tokens: maxTokens };

    const timeoutMs = provider === 'ollama' ? 180000 : 60000;
    let upstream = await nativeHttpRequest({ url: endpoint, method: 'POST', headers, body: JSON.stringify(payload), timeoutMs, signal });
    if (provider === 'ollama' && upstream.status === 404) {
      upstream = await nativeHttpRequest({
        url: `${base.origin}/api/chat`,
        method: 'POST',
        headers,
        body: JSON.stringify({ model, messages, stream: false, think: false, options: { num_ctx: ollamaNumCtx, num_predict: maxTokens, temperature } }),
        timeoutMs,
        signal
      });
    }
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return makeMockJsonResponse(502, { error: `Provider request failed (${upstream.status})` });
    const choice = data && data.choices && data.choices[0];
    const rawMsg = (choice && choice.message) || (data && data.message) || null;
    let raw = rawMsg && typeof rawMsg.content === 'string' ? rawMsg.content : null;
    if (typeof raw !== 'string') return makeMockJsonResponse(502, { error: 'Provider response format was not recognized' });
    if (provider === 'ollama' || /<think\b/i.test(raw)) raw = apkStripThinking(raw);
    if (!raw.trim()) return makeMockJsonResponse(502, { error: 'Model returned an empty response' });
    const finishReason = (choice && choice.finish_reason) || (data && data.done_reason) || '';
    return makeMockJsonResponse(200, { text: finishReason === 'length' ? apkTrimSentence(raw) : raw });
  }

  return makeMockJsonResponse(404, { error: 'Not found' });
}

const originalBrowserFetch = typeof fetch === 'function' ? fetch.bind(typeof window !== 'undefined' ? window : globalThis) : null;

function installMobileFetchBridge() {
  if (typeof window === 'undefined' || !isNativeAndroidApp()) return;
  if (window.__hushMobileFetchInstalled) return;
  window.__hushMobileFetchInstalled = true;

  window.fetch = async function (input, init = {}) {
    const urlStr = typeof input === 'string' ? input : (input && input.url ? String(input.url) : '');
    if (urlStr.startsWith('/api/')) {
      const mode = getMobileConnectionMode();
      const remoteBase = getRemoteServerUrl();
      if (mode === 'server' && remoteBase) {
        return nativeHttpRequest({
          url: remoteBase + urlStr,
          method: init.method || 'GET',
          headers: init.headers || {},
          body: init.body,
          timeoutMs: urlStr === '/api/chat' ? 120000 : 20000,
          signal: init.signal || null
        });
      }
      let parsedBody = {};
      if (typeof init.body === 'string' && init.body) {
        try { parsedBody = JSON.parse(init.body); } catch { parsedBody = {}; }
      }
      return handleStandaloneApiRequest(urlStr, String(init.method || 'GET').toUpperCase(), parsedBody, init.signal || null);
    }
    return originalBrowserFetch(input, init);
  };
}

function syncMobileConnectionPanelUi() {
  if (typeof document === 'undefined') return;
  const panel = document.getElementById('mobileAppPanel');
  if (panel) panel.hidden = !isNativeAndroidApp();
  const modeSel = document.getElementById('mobileConnectionMode');
  const urlRow = document.getElementById('mobileServerUrlRow');
  const urlInp = document.getElementById('mobileServerUrlInput');
  const mode = getMobileConnectionMode();
  if (modeSel) modeSel.value = mode;
  if (urlRow) urlRow.hidden = mode !== 'server';
  if (urlInp) urlInp.value = getRemoteServerUrl();
}

function saveMobileConnectionSettings() {
  const mode = document.getElementById('mobileConnectionMode')?.value === 'server' ? 'server' : 'standalone';
  const rawUrl = String(document.getElementById('mobileServerUrlInput')?.value || '').trim();
  if (mode === 'server') {
    if (!rawUrl) {
      showToast(t('mobile_server_url_required', 'กรุณาใส่ URL เซิร์ฟเวอร์ HushRP ก่อน'));
      return;
    }
    try {
      const u = new URL(rawUrl.includes('://') ? rawUrl : `http://${rawUrl}`);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('bad protocol');
      localStorage.setItem(REMOTE_SERVER_URL_KEY, u.origin + u.pathname.replace(/\/+$/, ''));
    } catch {
      showToast(t('mobile_server_url_invalid', 'รูปแบบ URL เซิร์ฟเวอร์ไม่ถูกต้อง'));
      return;
    }
  }
  try { localStorage.setItem(MOBILE_MODE_KEY, mode); } catch {}
  syncMobileConnectionPanelUi();
  if (typeof updateProviderStatus === 'function') updateProviderStatus();
  if (typeof loadSavedCharacters === 'function') loadSavedCharacters();
  if (typeof syncChatStoresWithServer === 'function') syncChatStoresWithServer();
  if (typeof playSfx === 'function') playSfx('tap');
  showToast(mode === 'server'
    ? t('toast_mobile_mode_server', 'สลับเป็นโหมดเชื่อมต่อเซิร์ฟเวอร์ HushRP แล้ว')
    : t('toast_mobile_mode_standalone', 'สลับเป็นโหมดใช้งานเดี่ยวบนมือถือ (Standalone) แล้ว'));
}

if (typeof window !== 'undefined') {
  window.handleAndroidBackPress = function () {
    if (typeof document === 'undefined') return false;
    const modals = [
      ['adultModal', () => typeof closeAdult === 'function' && closeAdult(false)],
      ['chatMenuModal', () => typeof closeChatMenu === 'function' && closeChatMenu()],
      ['charInfoModal', () => typeof closeCharInfo === 'function' && closeCharInfo()],
      ['userProfileModal', () => typeof closeUserProfileModal === 'function' && closeUserProfileModal()],
      ['languageModal', () => typeof closeLanguageModal === 'function' && closeLanguageModal()],
      ['customLanguageModal', () => typeof closeCustomLanguageModal === 'function' && closeCustomLanguageModal()],
      ['memoryModal', () => typeof closeMemoryModal === 'function' && closeMemoryModal()],
      ['editMessageModal', () => typeof closeEditMessageModal === 'function' && closeEditMessageModal()],
      ['modelPickerModal', () => typeof closeModelPickerModal === 'function' && closeModelPickerModal()],
      ['shareCharacterModal', () => typeof closeShareCharacterModal === 'function' && closeShareCharacterModal()],
      ['importCharacterModal', () => typeof closeImportCharacterModal === 'function' && closeImportCharacterModal()]
    ];
    for (const [id, fn] of modals) {
      const el = document.getElementById(id);
      if (el && el.classList && (el.classList.contains('show') || el.classList.contains('open'))) {
        fn();
        return true;
      }
    }
    if (document.body?.classList?.contains('mobile-menu-open')) {
      if (typeof closeMobileMenu === 'function') closeMobileMenu();
      return true;
    }
    const chatView = document.getElementById('view-chat');
    if (chatView && chatView.classList?.contains('active')) {
      const rv = document.getElementById('chatRoomView');
      if (rv && rv.style && rv.style.display !== 'none' && typeof showChatList === 'function') {
        showChatList();
        return true;
      }
    }
    const discoverView = document.getElementById('view-discover');
    if (discoverView && !discoverView.classList?.contains('active') && typeof showView === 'function') {
      showView('discover');
      return true;
    }
    return false;
  };
}

installMobileFetchBridge();
