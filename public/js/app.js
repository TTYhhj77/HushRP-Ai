function showView(name) {
  let switched = false;
  document.querySelectorAll('.view').forEach(v => {
    const isTarget = v.id === 'view-' + name;
    if (isTarget && !v.classList.contains('active')) switched = true;
    v.classList.toggle('active', isTarget);
  });
  document.querySelectorAll('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === name));
  document.querySelectorAll('.mobile-drawer-link[data-mobile-view]').forEach(x => x.classList.toggle('active', x.dataset.mobileView === name));
  if (switched && typeof playSfx === 'function') playSfx('nav');
}

function openDiscoverSearch() {
  showView('discover');
  const inp = document.getElementById('searchInput');
  if (inp) {
    inp.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    inp.focus?.();
  }
}

function toggleMobileMenu(force) {
  const opened = force ?? !document.body.classList.contains('mobile-menu-open');
  const button = document.getElementById('mobileMenuToggle');
  const bottomBtn = document.getElementById('mobileBottomMenuBtn');
  const drawer = document.getElementById('mobileNavDrawer');
  const overlay = document.getElementById('mobileNavOverlay');
  document.body.classList.toggle('mobile-menu-open', opened);
  if (button) {
    button.setAttribute('aria-expanded', String(opened));
    button.setAttribute('aria-label', opened ? t('drawer_close_label', 'ปิดเมนู') : t('drawer_open_label', 'เปิดเมนู'));
  }
  if (bottomBtn) {
    bottomBtn.classList?.toggle('active', opened);
    bottomBtn.setAttribute?.('aria-expanded', String(opened));
  }
  if (drawer) drawer.inert = !opened;
  if (overlay) overlay.setAttribute('aria-hidden', String(!opened));
  if (opened) drawer?.querySelector?.('button')?.focus?.();
  else button?.focus?.();
}

function closeMobileMenu() {
  if (document.body.classList.contains('mobile-menu-open')) toggleMobileMenu(false);
}

function mobileNavigate(name) {
  closeMobileMenu();
  if (name === 'create' && typeof openCreateView === 'function') {
    openCreateView();
  } else {
    showView(name);
  }
  document.querySelectorAll('.mobile-drawer-link[data-mobile-view]').forEach(x => {
    x.classList.toggle('active', x.dataset.mobileView === name);
  });
}

document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  closeMobileMenu();
  const modalClosers = [
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
  for (const [id, closeFn] of modalClosers) {
    const el = document.getElementById(id);
    if (el && el.classList && (el.classList.contains('show') || el.classList.contains('open'))) {
      closeFn();
    }
  }
});

// ── Settings Event Wiring ─────────────────────────────────────────────────────
const clientKeyEl = document.getElementById('clientApiKey');
if (clientKeyEl) {
  clientKeyEl.addEventListener('input', e => { sessionApiKey = e.target.value; });
  clientKeyEl.addEventListener('click', () => {
    if (clientKeyAllowed && keyMode !== 'browser') {
      setKeyMode('browser');
      clientKeyEl.focus();
    }
  });
  clientKeyEl.addEventListener('focus', () => {
    if (clientKeyAllowed && keyMode !== 'browser') {
      setKeyMode('browser');
    }
  });
}

document.getElementById('serverApiKeyInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveServerKeyFromUi();
  }
});

document.getElementById('providerSelect')?.addEventListener('change', providerChanged);

document.getElementById('baseUrl')?.addEventListener('change', () => {
  const el = document.getElementById('baseUrl');
  const sel = document.getElementById('providerSelect');
  if (el && sel && sel.value === 'OpenAI compatible / Custom') {
    const v = normalizeBaseUrl(el.value);
    if (v.indexOf('http://') === 0) {
      showToast(t('toast_custom_https_required', 'Custom API ต้องใช้ HTTPS'));
      return;
    }
    el.value = v;
  }
  saveProviderSettings();
});

document.getElementById('modelSelect')?.addEventListener('change', () => {
  saveProviderSettings();
  renderModelChoices();
});

const topSettingsButton = document.getElementById('topSettingsBtn') || document.querySelector?.('.top-right [title="ตั้งค่า API"]');
if (topSettingsButton && topSettingsButton.addEventListener) topSettingsButton.addEventListener('click', updateProviderStatus);

window.addEventListener?.('beforeunload', () => {
  sessionApiKey='';
  const k = document.getElementById('clientApiKey');
  if (k) k.value = '';
});

// ── Initial Bootstrap ─────────────────────────────────────────────────────────
try {
  const storedGlobalPrompt = localStorage.getItem('hush-global-prompt');
  const gp = document.getElementById('globalPrompt');
  if (storedGlobalPrompt !== null && gp) gp.value = storedGlobalPrompt;
} catch (e) {}

loadWorldSettings();
loadTokenBudget();
loadProviderSettings();
if (typeof loadTheme === 'function') loadTheme();
updateProviderStatus();
loadRemoteSettings();

const closeOnBg = (id, fn) => {
  const el = document.getElementById(id);
  if (el && el.addEventListener) {
    el.addEventListener('click', e => {
      if (e.target === e.currentTarget) fn();
    });
  }
};
closeOnBg('adultModal', () => closeAdult(false));
closeOnBg('chatMenuModal', closeChatMenu);
closeOnBg('charInfoModal', closeCharInfo);
closeOnBg('userProfileModal', closeUserProfileModal);
closeOnBg('languageModal', closeLanguageModal);
closeOnBg('customLanguageModal', closeCustomLanguageModal);
closeOnBg('memoryModal', closeMemoryModal);
closeOnBg('editMessageModal', closeEditMessageModal);
closeOnBg('modelPickerModal', closeModelPickerModal);
closeOnBg('shareCharacterModal', closeShareCharacterModal);
closeOnBg('importCharacterModal', closeImportCharacterModal);

document.addEventListener('DOMContentLoaded', () => {
  initSoundButton();
  loadSavedCharacters();
  setChatBackground(null);
});

loadLocales();
loadFavorites();
loadUserProfiles();
loadChatStoresFromStorage();
if (typeof renderCharacterMemoryUi === 'function') renderCharacterMemoryUi();
if (typeof syncAmbientUi === 'function') syncAmbientUi();
syncChatStoresWithServer();
renderCards();
