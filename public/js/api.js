const PROVIDER_MAP = {
  'OpenAI': 'openai',
  'OpenRouter': 'openrouter',
  'Ollama (local)': 'ollama',
  'OpenAI compatible / Custom': 'openai-compatible'
};

const PROVIDER_DEFAULTS = {
  'OpenAI': 'https://api.openai.com/v1',
  'OpenRouter': 'https://openrouter.ai/api/v1',
  'Ollama (local)': 'http://localhost:11434/v1'
};

function normalizeBaseUrl(raw) {
  const v = String(raw || '').trim();
  let u;
  try { u = new URL(v); } catch { return v; }
  u.search = '';
  u.hash = '';
  u.pathname = u.pathname.replace(/\/+$/, '').replace(/\/(chat\/completions|models|api\/tags)$/, '');
  return u.toString().replace(/\/$/, '');
}

async function postWithAutoHost(endpoint, payload) {
  const headers = Object.assign({ 'content-type': 'application/json' }, getSessionHeaders());
  let r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
  let data = {};
  try { data = await r.json(); } catch { data = {}; }

  if (!r.ok && data && data.host && data.canAddDynamic) {
    const ar = await fetch('/api/custom-hosts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ host: data.host })
    });
    const ad = await ar.json().catch(() => ({}));
    if (ar.ok) {
      if (typeof loadCustomHostList === 'function') loadCustomHostList();
      showToast(t('host_auto_added', 'เพิ่ม host “{host}” เข้าระบบอัตโนมัติแล้ว').replace('{host}', data.host));
      r = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload) });
      try { data = await r.json(); } catch { data = {}; }
    } else if (ad.error) {
      data = ad;
    }
  }
  return { r, data };
}

async function apiChat(messages) {
  const selected = document.getElementById('providerSelect')?.value || 'OpenAI';
  const provider = PROVIDER_MAP[selected];
  const rawBase = document.getElementById('baseUrl')?.value.trim() || '';
  const baseUrl = normalizeBaseUrl(rawBase || (provider === 'ollama' ? 'http://localhost:11434/v1' : ''));
  let model = document.getElementById('modelSelect')?.value.trim() || document.getElementById('chatModelSelect')?.value.trim() || '';
  if (!model && typeof getModelCache === 'function') {
    const cached = getModelCache()[selected];
    if (Array.isArray(cached) && cached.length) model = cached[0];
  }
  if (!provider || !model) throw new Error(t('model_id_required', 'เลือกผู้ให้บริการและโมเดลก่อน'));

  const payload = {
    provider,
    baseUrl,
    model,
    messages,
    maxInputTokens: Math.max(400, Math.min(8000, Number(localStorage.getItem('hush-context-budget') || 1200))),
    maxTokens: Math.max(64, Math.min(1200, Number(localStorage.getItem('hush-output-budget') || 300)))
  };

  if (keyMode === 'browser' && provider !== 'ollama') {
    if (!clientKeyAllowed) throw Error(t('err_server_disables_browser_key', 'Server ปิด browser API key'));
    if (!sessionApiKey) throw Error(t('err_enter_tab_api_key', 'ใส่ API key สำหรับแท็บนี้ก่อน'));
    payload.apiKey=sessionApiKey;
  }

  const { r, data } = await postWithAutoHost('/api/chat', payload);
  if (!r.ok) {
    if (data && data.host && !data.canAddDynamic) {
      throw new Error(t('host_not_allowed_vps', 'Host {host} ไม่ได้รับอนุญาต — เพิ่ม hostname ใน CUSTOM_ENDPOINT_HOSTS บน server (VPS mode)').replace('{host}', data.host));
    }
    throw new Error(data.error || t('ai_chat_failed', 'เรียก AI ไม่สำเร็จ'));
  }
  return data.text;
}
