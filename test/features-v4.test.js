'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createServer } = require('../server');
const { readFrontendBundle } = require('./helpers');

const html = readFrontendBundle();

async function withCustomServer(options, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hushrp-v4-'));
  const app = createServer({ dataDir: dir, apiKey: '', ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    await fn(base, dir);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('LAN runtime mode defaults allowClientKeys to true in server status', async () => {
  await withCustomServer({ runtimeMode: 'lan' }, async base => {
    const res = await fetch(`${base}/api/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.runtimeMode, 'lan');
    assert.equal(data.allowClientKeys, true);
  });
});

test('lanOnly flag defaults allowClientKeys to true', async () => {
  await withCustomServer({ lanOnly: true }, async base => {
    const res = await fetch(`${base}/api/status`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.allowClientKeys, true);
  });
});

test('persists userProfiles and activeProfileId in settings API with sanitization', async () => {
  await withCustomServer({}, async base => {
    const profiles = [
      { id: 'p1', name: 'Althea', role: 'จอมเวทพเนจร', appearance: 'ผ้าคลุมสีน้ำเงิน', bio: 'เงียบขรึมและช่างสังเกต', coverUrl: '', avatarUrl: '' },
      { id: 'p2', name: 'Kael', role: 'อัศวินพเนจร', appearance: 'เกราะเงินมีรอยขีดข่วน', bio: 'รักความยุติธรรม', coverUrl: '', avatarUrl: '' }
    ];
    const putRes = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userProfiles: profiles, activeProfileId: 'p2' })
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${base}/api/settings`);
    assert.equal(getRes.status, 200);
    const settings = await getRes.json();
    assert.equal(settings.activeProfileId, 'p2');
    assert.equal(Array.isArray(settings.userProfiles), true);
    assert.equal(settings.userProfiles.length, 2);
    assert.equal(settings.userProfiles[0].name, 'Althea');
    assert.equal(settings.userProfiles[1].role, 'อัศวินพเนจร');
  });
});

test('HTML contains conversation list view, back button, and inbox elements', () => {
  assert.match(html, /id="chatListView"/);
  assert.match(html, /id="chatRoomView"/);
  assert.match(html, /id="conversationCards"/);
  assert.match(html, /onclick="showChatList\(\)"/);
  assert.match(html, /sortChatList\('recent'\)/);
  assert.match(html, /sortChatList\('count'\)/);
});

test('HTML contains user persona modal and topbar profile trigger', () => {
  assert.match(html, /id="userProfileModal"/);
  assert.match(html, /id="userName"/);
  assert.match(html, /id="userRole"/);
  assert.match(html, /id="userAppearance"/);
  assert.match(html, /id="userBio"/);
  assert.match(html, /id="profilePills"/);
  assert.match(html, /id="topbarProfile"/);
  assert.match(html, /openUserProfileModal\(\)/);
});

test('HTML contains composer toolbar with dialogue and action quick-format buttons', () => {
  assert.match(html, /class="composer-toolbar"/);
  assert.match(html, /onclick="insertFormat\('speech'\)"/);
  assert.match(html, /onclick="insertFormat\('action'\)"/);
  assert.match(html, /insertFormat\('speech'\)[^>]*><span>“ ”<\/span>\s*บทพูด/);
  assert.match(html, /insertFormat\('action'\)[^>]*><span>\* \*<\/span>\s*การกระทำ/);
});

test('CSS contains mobile viewport containment and GPU-accelerated typing indicator styles', () => {
  assert.match(html, /overscroll-behavior-y:\s*contain/);
  assert.match(html, /100dvh/);
  assert.match(html, /\.typing-bubble/);
  assert.match(html, /\.typing-dots/);
  assert.match(html, /\.typing-dot/);
  assert.match(html, /@keyframes typing-pulse/);
  assert.match(html, /\.rp-speech/);
  assert.match(html, /\.rp-action/);
});

test('renderRoleplayText visually distinguishes quotes as rp-speech and asterisks as rp-action while hiding markers', () => {
  const context = {
    document: {
      getElementById: () => ({ value: '', addEventListener() {} }),
      querySelectorAll: () => [],
      addEventListener: () => {}
    },
    localStorage: { getItem: () => null, setItem() {} },
    window: { addEventListener: () => {} }
  };
  vm.createContext(context);
  vm.runInContext(`
    function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
    function renderRoleplayText(text){if(!text)return '';const escaped=safe(text);let formatted=escaped.replace(/(?:“|&quot;)([\\s\\S]*?)(?:”|&quot;)/g,'<span class="rp-speech">$1</span>');formatted=formatted.replace(/\\*([^*\\r\\n]+?)\\*/g,'<em class="rp-action">$1</em>');return formatted.replace(/\\n/g,'<br>')}
  `, context);

  const testCases = [
    {
      input: '"สวัสดีเจ้ามนุษย์"',
      expected: '<span class="rp-speech">สวัสดีเจ้ามนุษย์</span>'
    },
    {
      input: '“ราตรีนี้ยังอีกยาวไกล”',
      expected: '<span class="rp-speech">ราตรีนี้ยังอีกยาวไกล</span>'
    },
    {
      input: '*หันมองด้วยสายตาเย็นชา*',
      expected: '<em class="rp-action">หันมองด้วยสายตาเย็นชา</em>'
    },
    {
      input: '*ก้าวเท้าเข้ามาใกล้* "เจ้าต้องการอะไร?" *รินน้ำชาใส่ถ้วย*',
      expected: '<em class="rp-action">ก้าวเท้าเข้ามาใกล้</em> <span class="rp-speech">เจ้าต้องการอะไร?</span> <em class="rp-action">รินน้ำชาใส่ถ้วย</em>'
    }
  ];

  for (const tc of testCases) {
    const result = context.renderRoleplayText(tc.input);
    assert.equal(result, tc.expected);
    assert.ok(!result.includes('&quot;'));
    assert.ok(!result.includes('*'));
  }
});

test('userPersonaPrompt formats player identity and instructions for system prompt injection', () => {
  const profiles = [
    { id: 'p1', name: 'เรย์นาร์ด', role: 'นักสืบเวทมนตร์', appearance: 'ดวงตาสีอำพัน สวมโค้ตสีเข้ม', bio: 'ชอบดื่มกาแฟดำ ไม่ชอบความวุ่นวาย', avatarUrl: '', coverUrl: '' }
  ];
  const context = {
    userProfiles: profiles,
    activeProfileId: 'p1',
    getActiveUserProfile: () => profiles[0]
  };
  vm.createContext(context);
  vm.runInContext(`
    function userPersonaPrompt(){const p=getActiveUserProfile();if(!p||!p.name)return '';return ['[ข้อมูลผู้เล่น / Persona ของผู้ใช้]','ชื่อผู้เล่น: '+p.name,p.role&&'บทบาท/ฉายา: '+p.role,p.appearance&&'รูปลักษณ์: '+p.appearance,p.bio&&'ประวัติ/ลักษณะเฉพาะตัว: '+p.bio,'กติกา: ให้เรียกผู้เล่นตามชื่อและรับรู้บทบาทนี้เสมอ และห้ามบรรยายความคิดหรือการกระทำแทนผู้เล่น'].filter(Boolean).join('\\n')}
  `, context);

  const prompt = context.userPersonaPrompt();
  assert.match(prompt, /\[ข้อมูลผู้เล่น \/ Persona ของผู้ใช้\]/);
  assert.match(prompt, /ชื่อผู้เล่น: เรย์นาร์ด/);
  assert.match(prompt, /บทบาท\/ฉายา: นักสืบเวทมนตร์/);
  assert.match(prompt, /รูปลักษณ์: ดวงตาสีอำพัน สวมโค้ตสีเข้ม/);
  assert.match(prompt, /ห้ามบรรยายความคิดหรือการกระทำแทนผู้เล่น/);
});

test('persists favorites in settings API and sanitizes invalid entries', async () => {
  await withCustomServer({}, async base => {
    const putRes = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ favorites: ['เอเลน่า', 'เรย์นาร์ด', 123, '<script>alert(1)</script>'] })
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${base}/api/settings`);
    assert.equal(getRes.status, 200);
    const settings = await getRes.json();
    assert.equal(Array.isArray(settings.favorites), true);
    assert.equal(settings.favorites.includes('เอเลน่า'), true);
    assert.equal(settings.favorites.includes('เรย์นาร์ด'), true);
    // Should filter out non-strings
    assert.equal(settings.favorites.includes(123), false);
  });
});

test('HTML contains favorites view and mini recent chat list elements', () => {
  assert.match(html, /id="view-favorites"/);
  assert.match(html, /id="favoriteCards"/);
  assert.match(html, /id="recentMiniList"/);
  assert.match(html, /id="mobileRecentMiniList"/);
  assert.match(html, /showView\('favorites'\)/);
  assert.match(html, /mobileNavigate\('favorites'\)/);
});

test('chat persistence API handles GET, PUT, and DELETE in local mode', async () => {
  await withCustomServer({}, async base => {
    // 1. GET initial chats
    const getRes1 = await fetch(`${base}/api/chats`);
    assert.equal(getRes1.status, 200);
    const chats1 = await getRes1.json();
    assert.deepEqual(chats1, {});

    // 2. PUT a chat session
    const messages = [
      { role: 'user', content: 'สวัสดีเอเลน่า', timestamp: Date.now() },
      { role: 'assistant', content: 'สวัสดีค่ะท่านนักเดินทาง', timestamp: Date.now() + 100 }
    ];
    const putRes = await fetch(`${base}/api/chats/Elena`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    assert.equal(putRes.status, 200);
    const putBody = await putRes.json();
    assert.equal(putBody.ok, true);
    assert.equal(putBody.saved, 2);

    // 3. GET chats to verify persistence
    const getRes2 = await fetch(`${base}/api/chats`);
    assert.equal(getRes2.status, 200);
    const chats2 = await getRes2.json();
    assert.ok(chats2.Elena);
    assert.equal(chats2.Elena.messages.length, 2);
    assert.equal(chats2.Elena.messages[0].content, 'สวัสดีเอเลน่า');
    assert.equal(chats2.Elena.messages[1].content, 'สวัสดีค่ะท่านนักเดินทาง');

    // 4. DELETE chat session
    const delRes = await fetch(`${base}/api/chats/Elena`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    // 5. GET chats after deletion
    const getRes3 = await fetch(`${base}/api/chats`);
    assert.equal(getRes3.status, 200);
    const chats3 = await getRes3.json();
    assert.equal(chats3.Elena, undefined);
  });
});

test('chat persistence in VPS mode isolates sessions via x-session-id', async () => {
  await withCustomServer({ runtimeMode: 'vps' }, async (base, dir) => {
    const sessionA = 'sess_alice_12345';
    const sessionB = 'sess_bob_67890';

    // Alice saves chat with Elena
    const putAlice = await fetch(`${base}/api/chats/Elena`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-session-id': sessionA },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'สวัสดีจาก Alice' }] })
    });
    assert.equal(putAlice.status, 200);

    // Bob saves chat with Elena
    const putBob = await fetch(`${base}/api/chats/Elena`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-session-id': sessionB },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'สวัสดีจาก Bob' }] })
    });
    assert.equal(putBob.status, 200);

    // Alice fetches chats - should only see Alice's message
    const getAlice = await fetch(`${base}/api/chats`, {
      headers: { 'x-session-id': sessionA }
    });
    const aliceData = await getAlice.json();
    assert.equal(aliceData.Elena.messages[0].content, 'สวัสดีจาก Alice');

    // Bob fetches chats - should only see Bob's message
    const getBob = await fetch(`${base}/api/chats`, {
      headers: { 'x-session-id': sessionB }
    });
    const bobData = await getBob.json();
    assert.equal(bobData.Elena.messages[0].content, 'สวัสดีจาก Bob');

    // Verify files on disk: separate session files created in sessions directory
    const sessionsDir = path.join(dir, 'sessions');
    assert.ok(fs.existsSync(path.join(sessionsDir, `chats_${sessionA}.json`)));
    assert.ok(fs.existsSync(path.join(sessionsDir, `chats_${sessionB}.json`)));
  });
});

test('DELETE /api/characters/:id cleans up character chat session from local chats', async () => {
  await withCustomServer({}, async base => {
    const charRes = await fetch(`${base}/api/characters`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'TempChar', role: 'Tester' })
    });
    assert.equal(charRes.status, 201);
    const charData = await charRes.json();

    await fetch(`${base}/api/chats/TempChar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] })
    });

    const getRes1 = await fetch(`${base}/api/chats`);
    const chats1 = await getRes1.json();
    assert.ok(chats1.TempChar);

    const delCharRes = await fetch(`${base}/api/characters/${charData.id}`, { method: 'DELETE' });
    assert.equal(delCharRes.status, 200);

    const getRes2 = await fetch(`${base}/api/chats`);
    const chats2 = await getRes2.json();
    assert.equal(chats2.TempChar, undefined);
  });
});

test('persists activeLocale and customLocales in settings API with sanitization', async () => {
  await withCustomServer({}, async base => {
    // 1. Valid activeLocale and customLocales
    const putRes = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activeLocale: 'zh',
        customLocales: {
          ja: {
            name: '日本語',
            dict: { nav_discover: '発見', nav_chat: 'チャット' }
          }
        }
      })
    });
    assert.equal(putRes.status, 200);

    const getRes = await fetch(`${base}/api/settings`);
    assert.equal(getRes.status, 200);
    const settings = await getRes.json();
    assert.equal(settings.activeLocale, 'zh');
    assert.ok(settings.customLocales && settings.customLocales.ja);
    assert.equal(settings.customLocales.ja.name, '日本語');
    assert.equal(settings.customLocales.ja.dict.nav_discover, '発見');

    // 2. Sanitization: invalid activeLocale should fallback or sanitize
    const badPut = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activeLocale: 'invalid_locale_with_special_characters_!@#$%^&*()',
        customLocales: 'not-an-object'
      })
    });
    assert.equal(badPut.status, 200);

    const getResBad = await fetch(`${base}/api/settings`);
    const badSettings = await getResBad.json();
    assert.equal(badSettings.activeLocale, 'th');
    assert.deepEqual(badSettings.customLocales, {});
  });
});

test('HTML contains multi-language support (en, zh, th) and custom language editor', () => {
  assert.match(html, /id="langToggleBtn"/);
  assert.match(html, /id="settingsLangSelect"/);
  assert.match(html, /openLanguageModal\(\)/);
  assert.match(html, /openCustomLanguageModal\(\)/);
  assert.match(html, /id="languageModal"/);
  assert.match(html, /id="languageModalList"/);
  assert.match(html, /id="customLanguageModal"/);
  assert.match(html, /id="customLangCode"/);
  assert.match(html, /id="customLangName"/);
  assert.match(html, /id="customLangJson"/);
  assert.match(html, /const I18N\s*=/);
  assert.match(html, /SAMPLE_JA_LOCALE\s*=/);
  assert.match(html, /copyLanguageTemplate\(\)/);
  assert.match(html, /loadCustomLanguageSample\('ja'\)/);
  assert.match(html, /saveCustomLanguage\(\)/);
  assert.match(html, /deleteCustomLanguage\(\)/);
  assert.match(html, /activeLocale:\s*'hush-locale'/);
  assert.match(html, /customLocales:\s*'hush-custom-locales'/);
});

test('I18N dictionaries have complete 100% key coverage for th, en, zh, and SAMPLE_JA_LOCALE', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const lf of ['th.js', 'en.js', 'zh.js', 'ja.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', lf), 'utf8');
    vm.runInContext(src, ctx);
  }
  const I18N = ctx.window.I18N;
  const SAMPLE_JA = ctx.window.SAMPLE_JA_LOCALE;
  assert.ok(I18N, 'I18N object defined');
  assert.ok(SAMPLE_JA, 'SAMPLE_JA_LOCALE defined');

  const htmlKeys = new Set();
  for (const m of html.matchAll(/data-i18n(?:-[a-z]+)?="([^"]+)"/g)) {
    htmlKeys.add(m[1]);
  }
  assert.ok(htmlKeys.size > 150, 'Expect extensive HTML i18n keys');

  for (const lang of ['th', 'en', 'zh']) {
    assert.ok(I18N[lang], `I18N.${lang} exists`);
    for (const key of htmlKeys) {
      assert.ok(I18N[lang][key] !== undefined, `Key "${key}" should be defined in I18N.${lang}`);
    }
  }

  assert.ok(SAMPLE_JA.dict, 'SAMPLE_JA_LOCALE.dict exists');
  for (const key of htmlKeys) {
    assert.ok(SAMPLE_JA.dict[key] !== undefined, `Key "${key}" should be defined in SAMPLE_JA_LOCALE.dict`);
  }
});

test('Character cards and conversation items dynamically localize adult tag, fictional tag, start CTA, and conversation status', () => {
  const renderCardsMatch = html.match(/function renderCards\(\)\{[\s\S]*?\n\}/);
  assert.ok(renderCardsMatch, 'renderCards found');
  assert.match(renderCardsMatch[0], /t\(['"]tag_adult['"]/);
  assert.match(renderCardsMatch[0], /t\(['"]tag_fictional['"]/);
  assert.match(renderCardsMatch[0], /t\(['"]card_start_story['"]/);
  assert.doesNotMatch(renderCardsMatch[0], /<span>เริ่มเรื่อง ↗<\/span>/);

  const renderFavCardsMatch = html.match(/function renderFavoriteCards\(\)\{[\s\S]*?\n\}/);
  assert.ok(renderFavCardsMatch, 'renderFavoriteCards found');
  assert.match(renderFavCardsMatch[0], /t\(['"]tag_adult['"]/);
  assert.match(renderFavCardsMatch[0], /t\(['"]tag_fictional['"]/);
  assert.match(renderFavCardsMatch[0], /t\(['"]card_start_story['"]/);
  assert.doesNotMatch(renderFavCardsMatch[0], /<span>เริ่มเรื่อง ↗<\/span>/);

  const renderMyCardsMatch = html.match(/function renderMyCards\(\)\{[\s\S]*?\n\}/);
  assert.ok(renderMyCardsMatch, 'renderMyCards found');
  assert.match(renderMyCardsMatch[0], /t\(['"]tag_fictional['"]/);
  assert.match(renderMyCardsMatch[0], /t\(['"]card_start_story['"]/);
  assert.doesNotMatch(renderMyCardsMatch[0], /<span>เริ่มเรื่อง ↗<\/span>/);

  const renderChatListMatch = html.match(/function renderChatList\(\)\{[\s\S]*?\n\}/);
  assert.ok(renderChatListMatch, 'renderChatList found');
  assert.match(renderChatListMatch[0], /t\(['"]count_messages['"]/);
  assert.match(renderChatListMatch[0], /t\(['"]chat_not_started['"]/);
  assert.match(renderChatListMatch[0], /t\(['"]chat_del_btn['"]/);
  assert.match(renderChatListMatch[0], /t\(['"]chat_inbox_empty['"]/);
  assert.doesNotMatch(renderChatListMatch[0], /countText=e\.count\?`\$\{e\.count\}/);
});

// ── Dynamic custom-host allowlist tests ─────────────────────────────────────

test('GET /api/custom-hosts returns empty list initially in local mode', async () => {
  await withCustomServer({ runtimeMode: 'local' }, async base => {
    const r = await fetch(`${base}/api/custom-hosts`);
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.deepEqual(d.hosts, []);
  });
});

test('POST /api/custom-hosts adds a valid hostname and GET returns it', async () => {
  await withCustomServer({ runtimeMode: 'local' }, async base => {
    const r = await fetch(`${base}/api/custom-hosts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'api.myproxy.example.com' })
    });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(d.ok);
    assert.ok(d.hosts.includes('api.myproxy.example.com'));
    const r2 = await fetch(`${base}/api/custom-hosts`);
    const d2 = await r2.json();
    assert.ok(d2.hosts.includes('api.myproxy.example.com'));
  });
});

test('POST /api/custom-hosts accepts full URL and extracts hostname', async () => {
  await withCustomServer({ runtimeMode: 'lan' }, async base => {
    const r = await fetch(`${base}/api/custom-hosts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'https://api.myproxy.example.com/v1' })
    });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(d.hosts.includes('api.myproxy.example.com'));
  });
});

test('DELETE /api/custom-hosts removes a hostname', async () => {
  await withCustomServer({ runtimeMode: 'local' }, async base => {
    await fetch(`${base}/api/custom-hosts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'api.test.example.com' }) });
    const r = await fetch(`${base}/api/custom-hosts`, { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'api.test.example.com' }) });
    assert.equal(r.status, 200);
    const d = await r.json();
    assert.ok(!d.hosts.includes('api.test.example.com'));
  });
});

test('/api/custom-hosts is blocked (403) in VPS mode', async () => {
  await withCustomServer({ runtimeMode: 'vps' }, async base => {
    const r1 = await fetch(`${base}/api/custom-hosts`);
    assert.equal(r1.status, 403);
    const r2 = await fetch(`${base}/api/custom-hosts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ host: 'api.evil.com' }) });
    assert.equal(r2.status, 403);
  });
});

test('POST /api/custom-hosts rejects IP addresses', async () => {
  await withCustomServer({ runtimeMode: 'local' }, async base => {
    const r = await fetch(`${base}/api/custom-hosts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: '192.168.1.100' })
    });
    assert.equal(r.status, 400);
  });
});

test('POST /api/custom-hosts rejects localhost', async () => {
  await withCustomServer({ runtimeMode: 'local' }, async base => {
    const r = await fetch(`${base}/api/custom-hosts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'localhost' })
    });
    assert.equal(r.status, 400);
  });
});

test('POST /api/custom-hosts rejects HTTP (non-HTTPS) hostnames', async () => {
  await withCustomServer({ runtimeMode: 'local' }, async base => {
    const r = await fetch(`${base}/api/custom-hosts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'http://api.example.com/v1' })
    });
    assert.equal(r.status, 400);
  });
});

test('dynamic custom host allows /api/models in local mode after being added', async () => {
  await withCustomServer({
    runtimeMode: 'local', apiKey: 'test-key',
    providerAdapters: { 'openai-compatible': { listModels: async () => ['dyn-model'] } }
  }, async base => {
    // First request should fail (host not on any allowlist)
    const r1 = await fetch(`${base}/api/models`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai-compatible', baseUrl: 'https://api.dynamic-proxy.example.com/v1' })
    });
    assert.equal(r1.status, 400);
    const d1 = await r1.json();
    assert.match(d1.error, /allow-list/i);
    assert.equal(d1.canAddDynamic, true);  // local mode tells browser it can add

    // Add the host
    await fetch(`${base}/api/custom-hosts`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'api.dynamic-proxy.example.com' })
    });

    // Second request should now succeed
    const r2 = await fetch(`${base}/api/models`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai-compatible', baseUrl: 'https://api.dynamic-proxy.example.com/v1' })
    });
    assert.equal(r2.status, 200);
    const d2 = await r2.json();
    assert.deepEqual(d2.models, ['dyn-model']);
  });
});

test('dynamic host from settings is ignored in VPS mode (server allow-list still required)', async () => {
  // In this test we manually write dynamicCustomHosts to settings.json
  // then verify VPS mode still rejects the host
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hushrp-vps-dynhost-'));
  const settingsFile = path.join(dir, 'settings.json');
  fs.mkdirSync(path.join(dir, 'uploads'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'sessions'), { recursive: true });
  fs.writeFileSync(settingsFile, JSON.stringify({ dynamicCustomHosts: ['api.sneaky.example.com'] }), 'utf8');
  const app = createServer({
    dataDir: dir, apiKey: 'test-key', runtimeMode: 'vps',
    providerAdapters: { 'openai-compatible': { listModels: async () => ['bad'] } }
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const r = await fetch(`${base}/api/models`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openai-compatible', baseUrl: 'https://api.sneaky.example.com/v1' })
    });
    assert.equal(r.status, 400);
    const d = await r.json();
    assert.match(d.error, /allow-list/i);
    // VPS mode must NOT advertise canAddDynamic
    assert.notEqual(d.canAddDynamic, true);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('HTML includes custom host allowlist panel with correct elements', () => {
  assert.match(html, /id="customHostPanel"/);
  assert.match(html, /id="customHostInput"/);
  assert.match(html, /id="customHostList"/);
  assert.match(html, /addCustomHost\(\)/);
  assert.match(html, /removeCustomHost\(/);
  assert.match(html, /loadCustomHostList\(\)/);
  // Panel must mention local/LAN restriction and server does not allow / allowlist guidance
  assert.match(html, /server does not allow|server allow-list|allowlist|ไม่อนุญาต host/i);
});

test('persists and sanitizes activeTheme across all supported themes in settings API', async () => {
  await withCustomServer({}, async base => {
    for (const theme of ['sakura', 'emerald', 'ocean', 'parchment', 'obsidian']) {
      const putRes = await fetch(`${base}/api/settings`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ activeTheme: theme })
      });
      assert.equal(putRes.status, 200);
      const getRes = await fetch(`${base}/api/settings`);
      assert.equal(getRes.status, 200);
      const settings = await getRes.json();
      assert.equal(settings.activeTheme, theme);
    }

    const badPut = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ activeTheme: 'invalid-neon-theme' })
    });
    assert.equal(badPut.status, 200);
    const badGet = await fetch(`${base}/api/settings`);
    const badSettings = await badGet.json();
    assert.equal(badSettings.activeTheme, 'obsidian');
  });
});

test('UI bundle includes multi-theme CSS variables, theme/sound controls, mobile drawer quick prefs, and reduced-motion rules', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');
  for (const themeId of ['sakura', 'emerald', 'ocean', 'parchment']) {
    assert.match(css, new RegExp(`\\[data-theme="${themeId}"\\]`));
  }
  assert.match(css, /@media\s*\(\s*prefers-reduced-motion:\s*reduce\s*\)/);
  assert.doesNotMatch(css, /padding-inline:10px 8px 10px 50px/);
  assert.match(css, /\.conv-cards\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /\.conv-card\s*\{[^}]*min-width:\s*0[^}]*overflow:\s*hidden/);
  assert.match(css, /\.chat-compose\s*\{[^}]*background:\s*transparent/);
  assert.match(css, /\.compose-box\s*\{[^}]*background:\s*var\(--compose-box-bg\)[^}]*backdrop-filter:\s*blur/);
  assert.match(css, /body\.keyboard-open\s*\.sidebar/);
  assert.match(css, /body\.keyboard-open\s*\.chat-layout\s*\{\s*height:\s*var\(--vvh/);

  assert.match(html, /id="themeToggleBtn"/);
  assert.match(html, /id="appearancePanel"/);
  assert.match(html, /id="themeGrid"/);
  assert.match(html, /class="mobile-drawer-prefs"/);
  assert.match(html, /id="settingsSoundToggle"/);
  assert.match(html, /previewSound\(\)/);
  assert.match(html, /cycleTheme\(\)/);
  assert.doesNotMatch(html, /color:#ccc9be/);
});

test('All I18N dictionaries (th, en, zh, SAMPLE_JA_LOCALE) maintain full 100% key parity across every defined key', () => {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const lf of ['th.js', 'en.js', 'zh.js', 'ja.js']) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'locales', lf), 'utf8');
    vm.runInContext(src, ctx);
  }
  const I18N = ctx.window.I18N;
  const jaDict = ctx.window.SAMPLE_JA_LOCALE.dict;
  const allKeys = new Set([
    ...Object.keys(I18N.th),
    ...Object.keys(I18N.en),
    ...Object.keys(I18N.zh),
    ...Object.keys(jaDict)
  ]);
  for (const key of allKeys) {
    assert.ok(typeof I18N.th[key] === 'string' && I18N.th[key].length > 0, `Missing th key: ${key}`);
    assert.ok(typeof I18N.en[key] === 'string' && I18N.en[key].length > 0, `Missing en key: ${key}`);
    assert.ok(typeof I18N.zh[key] === 'string' && I18N.zh[key].length > 0, `Missing zh key: ${key}`);
    assert.ok(typeof jaDict[key] === 'string' && jaDict[key].length > 0, `Missing ja key: ${key}`);
  }
});

test('Frontend VM executes multi-theme switching, character/genre localization, and Web Audio SFX cleanly', () => {
  const storage = new Map();
  const elements = new Map();
  function createMockEl(id = '', tag = 'div') {
    const classes = new Set();
    const attrs = {};
    return {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      checked: false,
      scrollTop: 0,
      scrollHeight: 0,
      style: {},
      dataset: {},
      children: [],
      options: [],
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, force) => {
          const next = force === undefined ? !classes.has(n) : !!force;
          if (next) classes.add(n); else classes.delete(n);
          return next;
        },
        contains: n => classes.has(n)
      },
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: k => (k in attrs ? attrs[k] : null),
      removeAttribute: k => { delete attrs[k]; },
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild(child) { this.children.push(child); return child; },
      addEventListener: () => {},
      focus: () => {}
    };
  }
  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const rootAttrs = {};
  const rootStyleVars = {};
  const visualViewport = { height: 844, addEventListener: () => {} };
  let createdOscillators = 0;
  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.destination = {};
    }
    resume() { return Promise.resolve(); }
    createOscillator() {
      createdOscillators += 1;
      return {
        type: 'sine',
        frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {}
      };
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {}
      };
    }
  }

  const ctx = {
    console,
    Math,
    Date,
    JSON,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    Intl,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    },
    AudioContext: MockAudioContext,
    innerWidth: 390,
    innerHeight: 844,
    visualViewport,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: {
        style: { setProperty: (k, v) => { rootStyleVars[k] = String(v); } },
        setAttribute: (k, v) => { rootAttrs[k] = String(v); },
        getAttribute: k => (k in rootAttrs ? rootAttrs[k] : null),
        removeAttribute: k => { delete rootAttrs[k]; }
      },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  const files = [
    'locales/th.js',
    'locales/en.js',
    'locales/zh.js',
    'locales/ja.js',
    'js/i18n.js',
    'js/state.js',
    'js/api.js',
    'js/characters.js',
    'js/chat.js',
    'js/settings.js'
  ];
  for (const rel of files) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
    vm.runInContext(src, ctx, { filename: rel });
  }

  // 1. Built-in character and compound genre localization + preservation of user edits
  ctx.switchLocale('en');
  const defaultChars = vm.runInContext('characters', ctx);
  const mira = defaultChars.find(c => c.name === 'Mira');
  const locMiraEn = ctx.getLocalizedCharacter(mira);
  assert.equal(locMiraEn.name, 'Mira');
  assert.notEqual(locMiraEn.role, mira.role);
  assert.match(locMiraEn.greeting, /Rain|station|map/i);

  const editedHost = { ...defaultChars.find(c => c.name === 'The Host'), role: 'Custom Keeper' };
  const locEdited = ctx.getLocalizedCharacter(editedHost);
  assert.equal(locEdited.role, 'Custom Keeper');

  const locGenreEn = ctx.formatGenreLabel('แฟนตาซี / slow burn / ผจญภัย');
  assert.equal(locGenreEn, 'Fantasy / Slow Burn / Adventure');

  ctx.switchLocale('ja');
  const locMiraJa = ctx.getLocalizedCharacter(mira);
  assert.notEqual(locMiraJa.desc, locMiraEn.desc);
  assert.match(ctx.formatGenreLabel('แฟนตาซี / สยองขวัญ'), /ファンタジー.*ホラー/);

  // 2. Theme switching and persistence
  ctx.applyTheme('parchment');
  assert.equal(rootAttrs['data-theme'], 'parchment');
  assert.equal(storage.get('hush-theme'), 'parchment');
  ctx.cycleTheme();
  assert.equal(rootAttrs['data-theme'], undefined); // cycled back to obsidian (default)
  assert.equal(storage.get('hush-theme'), 'obsidian');

  // 3. Sound effects generate audio nodes when soundEnabled=true across all SFX kinds
  for (const kind of ['tap', 'nav', 'send', 'receive', 'favorite', 'theme', 'modalOpen', 'modalClose', 'toggle', 'delete', 'error']) {
    const before = createdOscillators;
    ctx.playSfx(kind);
    assert.ok(createdOscillators > before, `playSfx('${kind}') should synthesize oscillator tones`);
  }
  const beforePreview = createdOscillators;
  ctx.previewSound();
  assert.ok(createdOscillators > beforePreview, 'previewSound should play chime sequence');

  // 4. Chat backdrop avatar fallback and mobile keyboard viewport adaptation
  ctx.setChatBackground({ avatarUrl: '/uploads/cover.png' });
  const bgEl = makeEl('chatBackground');
  assert.match(bgEl.style.backgroundImage, /\/uploads\/cover\.png/);
  assert.equal(bgEl.style.opacity, '.38');

  visualViewport.height = 480;
  ctx.syncMobileChatViewport();
  assert.equal(rootStyleVars['--vvh'], '480px');
  assert.equal(ctx.document.body.classList.contains('keyboard-open'), true);

  const msgInput = makeEl('messageInput');
  msgInput.scrollHeight = 140;
  ctx.autoResizeChatInput(msgInput);
  assert.equal(msgInput.style.height, '84px');

  visualViewport.height = 844;
  ctx.syncMobileChatViewport();
  assert.equal(rootStyleVars['--vvh'], '844px');
  assert.equal(ctx.document.body.classList.contains('keyboard-open'), false);
});

test('server /api/chats/:name persists aiMemory and DELETE wipes both history and aiMemory', async () => {
  await withCustomServer({}, async base => {
    const putRes = await fetch(`${base}/api/chats/Mira`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        history: [
          { role: 'user', content: 'สวัสดีมิระ' },
          { role: 'assistant', content: 'สวัสดีค่ะ' }
        ],
        aiMemory: ['  ชอบชาเขียว  ', '', '   ', 'นัดเจอกันตอนเย็นที่สถานี']
      })
    });
    assert.equal(putRes.status, 200);
    const putData = await putRes.json();
    assert.equal(putData.ok, true);
    assert.equal(putData.memoryCount, 2);

    const getRes = await fetch(`${base}/api/chats`);
    assert.equal(getRes.status, 200);
    const allChats = await getRes.json();
    assert.equal(allChats.Mira.history.length, 2);
    assert.deepEqual(allChats.Mira.aiMemory, ['ชอบชาเขียว', 'นัดเจอกันตอนเย็นที่สถานี']);

    const delRes = await fetch(`${base}/api/chats/Mira`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);

    const afterDel = await fetch(`${base}/api/chats`).then(r => r.json());
    assert.equal(afterDel.Mira, undefined);
  });
});

test('stealth AI auto-memory extracts tags, avoids duplicate extractive prompt blocks, consolidates, and resetCharacterAll wipes all state', async () => {
  const storage = new Map();
  const elements = new Map();
  const fetchCalls = [];
  function createMockEl(id = '', tag = 'div') {
    const classes = new Set();
    const attrs = {};
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      hidden: false,
      checked: false,
      scrollTop: 0,
      scrollHeight: 0,
      offsetWidth: 100,
      style: {},
      dataset: {},
      children: [],
      options: [],
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, force) => {
          const next = force === undefined ? !classes.has(n) : !!force;
          if (next) classes.add(n); else classes.delete(n);
          return next;
        },
        contains: n => classes.has(n)
      },
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: k => (k in attrs ? attrs[k] : null),
      removeAttribute: k => { delete attrs[k]; },
      querySelector: sel => (sel === '.bubble' ? createMockEl('', 'div') : null),
      querySelectorAll: () => [],
      appendChild(child) {
        this.children.push(child);
        if (child && child.innerHTML) this.innerHTML += child.innerHTML;
        return child;
      },
      addEventListener: () => {},
      focus: () => {}
    };
    return el;
  }
  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const ctx = {
    console,
    Math,
    Date,
    JSON,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    Intl,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    confirm: () => true,
    showView: () => {},
    fetch: async (url, init = {}) => {
      fetchCalls.push({ url: String(url), method: init.method || 'GET', body: init.body || '' });
      if (String(url).includes('/api/chat')) {
        return {
          ok: true,
          json: async () => ({ text: '- ผู้ใช้ชอบโกโก้ร้อนและนัดพบกันที่สถานีเก่า' })
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: {
        style: { setProperty: () => {} },
        setAttribute: () => {},
        getAttribute: () => null,
        removeAttribute: () => {}
      },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js',
    'locales/en.js',
    'locales/zh.js',
    'locales/ja.js',
    'js/i18n.js',
    'js/state.js',
    'js/api.js',
    'js/characters.js',
    'js/chat.js',
    'js/settings.js'
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
    vm.runInContext(src, ctx, { filename: rel });
  }

  ctx.switchLocale('th');
  ctx.openChat('Mira');
  const mira = vm.runInContext('characters', ctx).find(c => c.name === 'Mira');

  // 1. Stealth tag extraction (closed + truncated unclosed)
  const closed = ctx.extractStealthMemory('สวัสดี *ยิ้ม* <memory>- ชอบดื่มโกโก้ร้อน\n- แพ้ดอกซากุระ</memory>');
  assert.equal(closed.visibleText, 'สวัสดี *ยิ้ม*');
  assert.deepEqual(closed.extracted, ['ชอบดื่มโกโก้ร้อน', 'แพ้ดอกซากุระ']);

  const truncated = ctx.extractStealthMemory('ซ่อนไว้ตรงนี้นะ <memory>- ซ่อนกุญแจไว้ใต้หมอน');
  assert.equal(truncated.visibleText, 'ซ่อนไว้ตรงนี้นะ');
  assert.deepEqual(truncated.extracted, ['ซ่อนกุญแจไว้ใต้หมอน']);

  // 2. Auto-record strips tag and deduplicates into sessionChatStores[name].aiMemory
  const cleanReply = ctx.autoRecordTurnMemory(
    'Mira',
    'ฉันชอบโกโก้ร้อนนะ',
    '*ยิ้มอ่อนโยน*\n<memory>- ชอบโกโก้ร้อน\n- ชอบโกโก้ร้อน\n- เคยพบกันที่สถานี</memory>'
  );
  assert.equal(cleanReply, '*ยิ้มอ่อนโยน*');
  const memList = ctx.getCharacterMemoryList('Mira');
  assert.deepEqual(Array.from(memList), ['ชอบโกโก้ร้อน', 'เคยพบกันที่สถานี']);
  assert.equal(makeEl('chatMemoryBadge').hidden, true);
  assert.equal(makeEl('chatMemoryBtn').classList.contains('has-memory'), true);
  assert.match(makeEl('infoMemoryBadge').textContent, /2/);
  assert.match(makeEl('infoMemoryList').innerHTML, /ชอบโกโก้ร้อน/);

  ctx.openMemoryModal();
  assert.equal(makeEl('memoryModal').classList.contains('show'), true);
  assert.match(makeEl('memoryModalList').innerHTML, /ชอบโกโก้ร้อน/);
  ctx.closeMemoryModal();
  assert.equal(makeEl('memoryModal').classList.contains('show'), false);

  // 3. Prompt builder injects AI Auto-Memory & stealth rule without duplicating extractive block
  ctx.setConversationMemory('Mira', 'legacy local extractive summary');
  const msgsWithAiMem = ctx.buildChatMessages(mira, [{ role: 'user', content: 'จำได้ไหม' }]);
  assert.match(msgsWithAiMem[0].content, /\[ความจำระยะยาวถาวร\]/);
  assert.match(msgsWithAiMem[0].content, /ชอบโกโก้ร้อน/);
  assert.match(msgsWithAiMem[0].content, /\[Stealth Auto-Memory\]/);
  assert.equal(msgsWithAiMem.some(m => /local extractive/.test(m.content)), false);

  // 4. Consolidation re-distills memory using active AI
  makeEl('providerSelect').value = 'OpenAI';
  makeEl('baseUrl').value = 'https://api.openai.com/v1';
  makeEl('modelSelect').value = 'gpt-4o-mini';
  await ctx.consolidateCharacterMemoryNow();
  assert.deepEqual(Array.from(ctx.getCharacterMemoryList('Mira')), ['ผู้ใช้ชอบโกโก้ร้อนและนัดพบกันที่สถานีเก่า']);

  // 5. Full reset wipes activeChatHistory, sessionConversationMemory, sessionChatStores, server store & restores greeting
  ctx.window.activeChatHistory = [
    { role: 'user', content: 'สวัสดี' },
    { role: 'assistant', content: 'สวัสดีค่ะ' }
  ];
  const resetResult = ctx.resetCharacterAll('Mira');
  assert.equal(resetResult, true);
  assert.equal(ctx.window.activeChatHistory.length, 0);
  assert.equal(ctx.getConversationMemory('Mira'), '');
  assert.equal(vm.runInContext("sessionChatStores['Mira']", ctx), undefined);
  assert.equal(makeEl('chatMemoryBadge').hidden, true);
  assert.equal(makeEl('toast').textContent.includes('{name}'), false);
  assert.match(makeEl('toast').textContent, /Mira/);
  assert.match(makeEl('messages').innerHTML, /Mira/);
  assert.ok(fetchCalls.some(c => c.method === 'DELETE' && c.url.includes('/api/chats/Mira')));

  // When aiMemory is empty, local extractive fallback remains available
  ctx.setConversationMemory('Mira', 'fallback extractive snippet');
  const msgsFallback = ctx.buildChatMessages(mira, [{ role: 'user', content: 'ต่อเลย' }]);
  assert.ok(msgsFallback.some(m => /local extractive/.test(m.content) && /fallback extractive snippet/.test(m.content)));
});

test('v1.0.2: UI SVG icons, message editing (in-place & regenerate), continueStory, and ambient soundscape controls', async () => {
  assert.match(html, /class="ui-icon"/);
  assert.match(html, /id="continueStoryBtn"/);
  assert.match(html, /id="ambientChatBtn"/);
  assert.match(html, /id="ambientSelect"/);
  assert.match(html, /id="ambientVolume"/);
  assert.match(html, /id="editMessageModal"/);
  assert.match(html, /id="editMessageTextarea"/);
  assert.match(html, /class="head-actions"[\s\S]*openMemoryModal/);

  const storage = new Map();
  const elements = new Map();
  let apiTurnCounter = 0;
  const sentPayloads = [];
  let oscCount = 0;
  let filterCount = 0;

  class MockAudioContext {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 44100;
      this.destination = {};
    }
    resume() { return Promise.resolve(); }
    createOscillator() {
      oscCount += 1;
      return {
        type: 'sine',
        frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {},
        stop() {},
        disconnect() {}
      };
    }
    createGain() {
      return {
        gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} },
        connect() {},
        disconnect() {}
      };
    }
    createBiquadFilter() {
      filterCount += 1;
      return {
        type: 'lowpass',
        frequency: { value: 1000, setValueAtTime() {} },
        Q: { value: 1, setValueAtTime() {} },
        connect() {},
        disconnect() {}
      };
    }
    createBuffer(ch, len) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      return { buffer: null, loop: false, connect() {}, start() {}, stop() {}, disconnect() {} };
    }
  }

  function createMockEl(id = '', tag = 'div') {
    const classes = new Set();
    const attrs = {};
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      hidden: false,
      checked: false,
      scrollTop: 0,
      scrollHeight: 0,
      offsetWidth: 100,
      style: {},
      dataset: {},
      children: [],
      options: [],
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, force) => {
          const next = force === undefined ? !classes.has(n) : !!force;
          if (next) classes.add(n); else classes.delete(n);
          return next;
        },
        contains: n => classes.has(n)
      },
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: k => (k in attrs ? attrs[k] : null),
      removeAttribute: k => { delete attrs[k]; },
      querySelector: sel => (sel === '.bubble' ? createMockEl('', 'div') : null),
      querySelectorAll: () => [],
      appendChild(child) {
        this.children.push(child);
        if (child && child.innerHTML) this.innerHTML += child.innerHTML;
        return child;
      },
      remove() {},
      replaceWith(next) { return next; },
      addEventListener: () => {},
      focus: () => {}
    };
    return el;
  }
  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const ctx = {
    console,
    Math,
    Date,
    JSON,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    Intl,
    Float32Array,
    encodeURIComponent,
    decodeURIComponent,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    confirm: () => true,
    showView: () => {},
    AudioContext: MockAudioContext,
    fetch: async (url, init = {}) => {
      if (String(url).endsWith('/api/chat')) {
        apiTurnCounter += 1;
        const parsed = JSON.parse(init.body || '{}');
        sentPayloads.push(parsed);
        return {
          ok: true,
          json: async () => ({ text: `คำตอบใหม่รอบที่ ${apiTurnCounter} จาก AI` })
        };
      }
      if (String(url).endsWith('/api/characters') && init.method === 'POST') {
        const parsed = JSON.parse(init.body || '{}');
        return {
          ok: true,
          json: async () => ({ id: 'shared-char-1', ...parsed })
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: {
        style: { setProperty: () => {} },
        setAttribute: () => {},
        getAttribute: () => null,
        removeAttribute: () => {}
      },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: sel => (sel === '.send' ? makeEl('sendBtn') : null),
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js',
    'locales/en.js',
    'locales/zh.js',
    'locales/ja.js',
    'js/i18n.js',
    'js/state.js',
    'js/api.js',
    'js/characters.js',
    'js/chat.js',
    'js/settings.js'
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
    vm.runInContext(src, ctx, { filename: rel });
  }

  ctx.switchLocale('th');
  ctx.openChat('Mira');
  makeEl('providerSelect').value = 'OpenAI';
  makeEl('baseUrl').value = 'https://api.openai.com/v1';
  makeEl('modelSelect').value = 'gpt-4o-mini';

  // Seed conversation with 4 messages so we test in-place editing and branching regeneration
  ctx.window.activeChatHistory = [
    { role: 'user', content: 'สวัสดี Mira' },
    { role: 'assistant', content: 'สวัสดีค่ะ มีอะไรให้ช่วยไหม?' },
    { role: 'user', content: 'ไปสถานีกันเถอะ' },
    { role: 'assistant', content: 'ตกลง ไปกันเลยค่ะ' }
  ];
  ctx.renderChatMessages();

  // 1. Edit message in-place without dropping subsequent history
  ctx.openEditMessageModal(1);
  assert.equal(makeEl('editMessageModal').classList.contains('show'), true);
  assert.equal(makeEl('editMsgSaveRegenBtn').hidden, true);
  makeEl('editMessageTextarea').value = 'สวัสดีค่ะ เดินทางไกลมาเหนื่อยไหม?';
  const savedInPlace = await ctx.saveEditedMessage(false);
  assert.equal(savedInPlace, true);
  assert.equal(makeEl('editMessageModal').classList.contains('show'), false);
  assert.equal(ctx.window.activeChatHistory.length, 4);
  assert.equal(ctx.window.activeChatHistory[1].content, 'สวัสดีค่ะ เดินทางไกลมาเหนื่อยไหม?');

  // 2. Edit an earlier user message with Save & Regenerate -> truncates later turns and generates fresh AI reply
  ctx.openEditMessageModal(0);
  assert.equal(makeEl('editMsgSaveRegenBtn').hidden, false);
  makeEl('editMessageTextarea').value = 'ขอทักทายใหม่แบบเป็นกันเองนะ Mira';
  const savedAndRegen = await ctx.saveEditedMessage(true);
  assert.equal(savedAndRegen, true);
  assert.equal(ctx.window.activeChatHistory.length, 2);
  assert.equal(ctx.window.activeChatHistory[0].content, 'ขอทักทายใหม่แบบเป็นกันเองนะ Mira');
  assert.equal(ctx.window.activeChatHistory[1].role, 'assistant');
  assert.match(ctx.window.activeChatHistory[1].content, /คำตอบใหม่รอบที่ 1/);

  // 3. Continue Story button appends AI turn without inserting fake user messages into activeChatHistory
  await ctx.continueStory();
  assert.equal(ctx.window.activeChatHistory.length, 3);
  assert.equal(ctx.window.activeChatHistory[2].role, 'assistant');
  assert.match(ctx.window.activeChatHistory[2].content, /คำตอบใหม่รอบที่ 2/);
  const lastApiMessages = sentPayloads[sentPayloads.length - 1].messages;
  assert.equal(lastApiMessages[lastApiMessages.length - 1].role, 'user');
  assert.match(lastApiMessages[lastApiMessages.length - 1].content, /ดำเนินเนื้อเรื่อง/);

  // 4. Filtered SFX + Ambient soundscape scenes & volume control
  assert.ok(filterCount > 0, 'playTone should route through lowpass filter when supported');
  ctx.setAmbientVolume(60);
  assert.equal(makeEl('ambientVolumeValue').textContent, '60%');
  assert.equal(storage.get('hush-ambient-volume'), '60');

  ctx.setAmbientScene('rain');
  assert.equal(storage.get('hush-ambient-scene'), 'rain');
  assert.equal(makeEl('ambientSelect').value, 'rain');
  assert.equal(makeEl('ambientChatLabel').textContent, 'สายฝน');
  assert.equal(makeEl('ambientChatBtn').classList.contains('active'), true);
  assert.ok(oscCount > 0);

  ctx.cycleAmbientScene();
  assert.equal(storage.get('hush-ambient-scene'), 'fireplace');
  assert.equal(makeEl('ambientChatLabel').textContent, 'กองไฟ');

  ctx.setAmbientScene('off');
  assert.equal(storage.get('hush-ambient-scene'), 'off');
  assert.equal(makeEl('ambientChatBtn').classList.contains('active'), false);
});

test('v1.0.3: hidden brain counter badge, framed searchable model picker, and character share/import workflow', async () => {
  assert.match(html, /id="chatModelPickerBtn"/);
  assert.match(html, /id="chatModelPickerLabel"/);
  assert.match(html, /id="modelPickerModal"/);
  assert.match(html, /id="modelSearchInput"/);
  assert.match(html, /id="shareCharacterModal"/);
  assert.match(html, /id="importCharacterModal"/);
  assert.match(html, /\.memory-count-pill\s*\{\s*display:\s*none\s*!important/);

  const storage = new Map();
  const elements = new Map();
  function createMockEl(id = '', tag = 'div') {
    const classes = new Set();
    const attrs = {};
    return {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      disabled: false,
      hidden: false,
      checked: false,
      style: {},
      dataset: {},
      children: [],
      options: [],
      classList: {
        add: (...names) => names.forEach(n => classes.add(n)),
        remove: (...names) => names.forEach(n => classes.delete(n)),
        toggle: (n, force) => {
          const next = force === undefined ? !classes.has(n) : !!force;
          if (next) classes.add(n); else classes.delete(n);
          return next;
        },
        contains: n => classes.has(n)
      },
      setAttribute: (k, v) => { attrs[k] = String(v); },
      getAttribute: k => (k in attrs ? attrs[k] : null),
      removeAttribute: k => { delete attrs[k]; },
      querySelector: () => null,
      querySelectorAll: () => [],
      appendChild(child) { this.children.push(child); return child; },
      remove() {},
      addEventListener: () => {},
      focus: () => {},
      select: () => {},
      click: () => {}
    };
  }
  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const ctx = {
    console,
    Math,
    Date,
    JSON,
    Array,
    Object,
    Set,
    Map,
    RegExp,
    Error,
    Promise,
    Intl,
    encodeURIComponent,
    decodeURIComponent,
    escape,
    unescape,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    showView: () => {},
    fetch: async (url, init = {}) => {
      if (String(url).endsWith('/api/characters') && init.method === 'POST') {
        const parsed = JSON.parse(init.body || '{}');
        return { ok: true, json: async () => ({ id: 'imported-1', ...parsed }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: {
        style: { setProperty: () => {} },
        setAttribute: () => {},
        getAttribute: () => null,
        removeAttribute: () => {}
      },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js',
    'locales/en.js',
    'locales/zh.js',
    'locales/ja.js',
    'js/i18n.js',
    'js/state.js',
    'js/api.js',
    'js/characters.js',
    'js/chat.js',
    'js/settings.js'
  ]) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8');
    vm.runInContext(src, ctx, { filename: rel });
  }

  ctx.switchLocale('th');
  ctx.setCharacterMemoryList('Mira', ['จำชื่ออากิระได้'], false);
  assert.equal(makeEl('chatMemoryBadge').hidden, true);
  assert.equal(makeEl('chatMemoryBadge').textContent, '');

  // 1. Searchable framed Model Picker
  makeEl('providerSelect').value = 'OpenRouter';
  storage.set('hush-model-cache', JSON.stringify({
    OpenRouter: ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4.6', 'google/gemini-2.5-flash']
  }));
  ctx.openModelPickerModal();
  assert.equal(makeEl('modelPickerModal').classList.contains('show'), true);
  assert.match(makeEl('modelPickerList').innerHTML, /claude-sonnet-4\.6/);
  ctx.renderModelPickerList('claude');
  assert.match(makeEl('modelPickerList').innerHTML, /claude-sonnet-4\.6/);
  assert.doesNotMatch(makeEl('modelPickerList').innerHTML, /gpt-4o-mini/);
  assert.match(makeEl('modelPickerCountBadge').textContent, /1/);
  ctx.selectModelFromPicker('anthropic/claude-sonnet-4.6');
  assert.equal(makeEl('modelSelect').value, 'anthropic/claude-sonnet-4.6');
  assert.equal(makeEl('chatModelPickerLabel').textContent, 'anthropic/claude-sonnet-4.6');
  assert.equal(makeEl('chatModelPickerBtn').classList.contains('has-model'), true);
  assert.equal(makeEl('modelPickerModal').classList.contains('show'), false);

  // 2. Character share code & import round-trip (including Thai Unicode)
  ctx.openShareCharacterModal('Mira');
  assert.equal(makeEl('shareCharacterModal').classList.contains('show'), true);
  const exportedCode = makeEl('shareCharacterCodeBox').value;
  assert.match(exportedCode, /^HUSHCHAR-V1:/);
  ctx.closeShareCharacterModal();

  const customSharedCode = ctx.encodeCharacterShareCode({
    name: 'โซระ',
    role: 'นักวาดแผนที่ดวงดาว',
    desc: 'เดินทางผ่านหอคอยเมฆา',
    genre: ['แฟนตาซี'],
    adult: false,
    systemPrompt: 'พูดจาอ่อนโยน',
    greeting: 'สวัสดีใต้แสงดาว'
  });
  const decoded = ctx.parseSharedCharacterPayload(customSharedCode);
  assert.equal(decoded.name, 'โซระ');
  assert.equal(decoded.role, 'นักวาดแผนที่ดวงดาว');

  ctx.openImportCharacterModal();
  assert.equal(makeEl('importCharacterModal').classList.contains('show'), true);
  makeEl('importCharacterTextInput').value = customSharedCode;
  const okImport = await ctx.confirmImportCharacter();
  assert.equal(okImport, true);
  assert.equal(makeEl('importCharacterModal').classList.contains('show'), false);
  const charsAfter = vm.runInContext('characters', ctx);
  assert.ok(charsAfter.some(c => c.name === 'โซระ' && c.role === 'นักวาดแผนที่ดวงดาว'));
});

test('Model picker pinning/vendor/provider switch, Studio cover art themes & fixed cut-out CSS, and chill ambient scenes', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');

  // Fixed bitten/cut-out cover art rules
  assert.doesNotMatch(css, /\.card-art:after\s*\{[^}]*background:\s*var\(--card-bg\)/);
  assert.doesNotMatch(css, /\.preview-art:after\s*\{[^}]*background:\s*var\(--panel\)/);
  assert.match(html, /id="modelPickerProviderTabs"/);
  assert.match(html, /id="modelPickerVendorChips"/);
  assert.match(html, /id="charArtPicker"/);
  assert.match(html, /id="previewCardArt"/);
  assert.match(html, /id="previewGreetingText"/);
  for (const scene of ['ocean', 'lofi', 'celestial', 'forest']) {
    assert.match(html, new RegExp(`<option value="${scene}"`));
  }

  const elements = new Map();
  const storage = new Map();
  let synthCalls = 0;

  class MockAudioContext {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; }
    resume() { return Promise.resolve(); }
    createOscillator() {
      synthCalls += 1;
      return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {}, disconnect() {} };
    }
    createGain() {
      return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: { value: 1000, setValueAtTime() {} }, Q: { value: 1, setValueAtTime() {} }, connect() {}, disconnect() {} };
    }
    createBuffer(ch, len) { return { getChannelData: () => new Float32Array(len) }; }
    createBufferSource() {
      synthCalls += 1;
      return { buffer: null, loop: false, connect() {}, start() {}, stop() {}, disconnect() {} };
    }
  }

  function createMockEl(id = '', tag = 'div') {
    const classSet = new Set();
    const attrs = {};
    const children = [];
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      disabled: false,
      checked: false,
      options: [{ textContent: 'แฟนตาซี', value: 'แฟนตาซี' }],
      selectedIndex: 0,
      dataset: {},
      style: { setProperty() {} },
      classList: {
        add(...names) { names.forEach(n => classSet.add(n)); },
        remove(...names) { names.forEach(n => classSet.delete(n)); },
        toggle(n, force) {
          if (typeof force === 'boolean') { if (force) classSet.add(n); else classSet.delete(n); return force; }
          if (classSet.has(n)) { classSet.delete(n); return false; }
          classSet.add(n); return true;
        },
        contains: n => classSet.has(n)
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute: k => attrs[k] ?? null,
      appendChild(child) { children.push(child); return child; },
      removeChild(child) { const idx = children.indexOf(child); if (idx >= 0) children.splice(idx, 1); },
      get firstChild() { return children[0] || null; },
      querySelectorAll: () => [],
      addEventListener() {},
      focus() {}
    };
    let cls = '';
    Object.defineProperty(el, 'className', {
      get: () => cls,
      set: v => {
        cls = String(v || '');
        classSet.clear();
        cls.split(/\s+/).filter(Boolean).forEach(n => classSet.add(n));
      }
    });
    return el;
  }

  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const ctx = {
    console, Math, Date, JSON, Array, Object, Set, Map, RegExp, Error, Promise, Intl,
    encodeURIComponent, decodeURIComponent, escape, unescape, setTimeout, clearTimeout,
    requestAnimationFrame: fn => fn(),
    AudioContext: MockAudioContext,
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    showView: () => {},
    fetch: async (url, init = {}) => {
      if (String(url).endsWith('/api/characters') && init.method === 'POST') {
        const parsed = JSON.parse(init.body || '{}');
        return { ok: true, json: async () => ({ id: 'studio-char-1', ...parsed }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: { style: { setProperty: () => {} }, setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {} },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js', 'locales/en.js', 'locales/zh.js', 'locales/ja.js',
    'js/i18n.js', 'js/state.js', 'js/api.js', 'js/characters.js', 'js/chat.js', 'js/settings.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8'), ctx, { filename: rel });
  }

  ctx.switchLocale('th');

  // 1. Model Picker pinning, vendor chips, and provider switch
  makeEl('providerSelect').value = 'OpenRouter';
  storage.set('hush-model-cache', JSON.stringify({
    OpenRouter: ['openai/gpt-4o-mini', 'anthropic/claude-sonnet-4.6', 'deepseek/deepseek-r1'],
    'Ollama (local)': ['qwen2.5:7b', 'llama3.2:latest']
  }));
  ctx.openModelPickerModal();
  ctx.togglePinModel('deepseek/deepseek-r1');
  assert.deepEqual(JSON.parse(storage.get('hush-pinned-models')), ['deepseek/deepseek-r1']);
  assert.match(makeEl('modelPickerVendorChips').innerHTML, /__fav__/);
  ctx.setModelVendorFilter('__fav__');
  assert.match(makeEl('modelPickerList').innerHTML, /deepseek-r1/);
  assert.doesNotMatch(makeEl('modelPickerList').innerHTML, /claude-sonnet-4\.6/);
  ctx.setModelVendorFilter('Claude');
  assert.match(makeEl('modelPickerList').innerHTML, /claude-sonnet-4\.6/);
  assert.doesNotMatch(makeEl('modelPickerList').innerHTML, /deepseek-r1/);
  ctx.switchProviderInModal('Ollama (local)');
  assert.equal(makeEl('providerSelect').value, 'Ollama (local)');
  assert.equal(makeEl('modelPickerProviderBadge').textContent, 'Ollama (local)');
  assert.match(makeEl('modelPickerList').innerHTML, /qwen2\.5:7b/);

  // 2. Character Studio art selection & live greeting preview
  ctx.selectCharacterArt('art4');
  assert.match(makeEl('previewCardArt').className, /art4/);
  makeEl('charName').value = 'อาเรีย';
  makeEl('greeting').value = 'ยินดีต้อนรับสู่หอสมุดราตรี';
  ctx.updatePreview();
  assert.equal(makeEl('previewAvatarBadge').textContent, 'อ');
  assert.equal(makeEl('previewGreetingText').textContent, 'ยินดีต้อนรับสู่หอสมุดราตรี');
  await ctx.saveCharacter();
  const savedChars = vm.runInContext('characters', ctx);
  const created = savedChars.find(c => c.name === 'อาเรีย');
  assert.equal(created.art, 'art4');

  // 3. New chill/dreamy Ambient scenes
  for (const [scene, expectedLabel] of [
    ['ocean', 'คลื่นทะเล'],
    ['lofi', 'โลไฟ'],
    ['celestial', 'ดาราจักร'],
    ['forest', 'ป่าสน']
  ]) {
    const before = synthCalls;
    ctx.setAmbientScene(scene);
    assert.equal(storage.get('hush-ambient-scene'), scene);
    assert.equal(makeEl('ambientSelect').value, scene);
    assert.equal(makeEl('ambientChatLabel').textContent, expectedLabel);
    assert.ok(synthCalls > before, `Expected Web Audio nodes synthesized for ${scene}`);
  }
});

test('v1.1.0: wrapped scrollable model vendor chips (>8 categories), search clear, discover sort, copy message, auto-resize composer, avatar themes, and Escape key cleanup', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');
  const stateJs = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'state.js'), 'utf8');

  // CSS fixes: vendor chips wrap & scroll vertically with visible scrollbar, plus .avatar.art1..art6
  const vendorChipsCssMatch = css.match(/\.model-picker-vendor-chips\s*\{[^}]+\}/);
  assert.ok(vendorChipsCssMatch, '.model-picker-vendor-chips rule exists');
  assert.match(vendorChipsCssMatch[0], /flex-wrap:\s*wrap/);
  assert.match(vendorChipsCssMatch[0], /overflow-y:\s*auto/);
  assert.doesNotMatch(vendorChipsCssMatch[0], /scrollbar-width:\s*none/);
  for (let i = 1; i <= 6; i++) {
    assert.match(css, new RegExp(`\\.avatar\\.art${i}\\s*\\{`));
  }
  assert.match(stateJs, /name:'Mira'[^}]*art:'art1'/);
  assert.match(html, /id="modelSearchClearBtn"/);
  assert.match(html, /id="discoverSortBtn"/);
  assert.match(html, /oninput="autoResizeComposer\(this\)"/);

  const elements = new Map();
  const storage = new Map();
  const docListeners = new Map();
  const copiedTexts = [];

  function createMockEl(id = '', tag = 'div') {
    const classSet = new Set();
    const attrs = {};
    const children = [];
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      disabled: false,
      scrollHeight: 92,
      options: [{ textContent: 'แฟนตาซี', value: 'แฟนตาซี' }],
      selectedIndex: 0,
      dataset: {},
      style: { height: '', setProperty() {} },
      classList: {
        add(...names) { names.forEach(n => classSet.add(n)); },
        remove(...names) { names.forEach(n => classSet.delete(n)); },
        toggle(n, force) {
          if (typeof force === 'boolean') { if (force) classSet.add(n); else classSet.delete(n); return force; }
          if (classSet.has(n)) { classSet.delete(n); return false; }
          classSet.add(n); return true;
        },
        contains: n => classSet.has(n)
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute: k => attrs[k] ?? null,
      appendChild(child) { children.push(child); return child; },
      removeChild(child) { const idx = children.indexOf(child); if (idx >= 0) children.splice(idx, 1); },
      get firstChild() { return children[0] || null; },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      focus() {}
    };
    return el;
  }

  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const ctx = {
    console, Math, Date, JSON, Array, Object, Set, Map, RegExp, Error, Promise, Intl,
    encodeURIComponent, decodeURIComponent, escape, unescape, setTimeout, clearTimeout,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: {
      language: 'th-TH',
      clipboard: {
        writeText: async txt => { copiedTexts.push(txt); }
      }
    },
    showView: () => {},
    fetch: async (url, init = {}) => {
      if (String(url).endsWith('/api/characters') && init.method === 'POST') {
        const parsed = JSON.parse(init.body || '{}');
        return { ok: true, json: async () => ({ id: 'import-v11', ...parsed }) };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: { style: { setProperty: () => {} }, setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {} },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(type, fn) {
        if (!docListeners.has(type)) docListeners.set(type, []);
        docListeners.get(type).push(fn);
      }
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js', 'locales/en.js', 'locales/zh.js', 'locales/ja.js',
    'js/i18n.js', 'js/state.js', 'js/api.js', 'js/characters.js', 'js/chat.js', 'js/settings.js', 'js/app.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8'), ctx, { filename: rel });
  }

  ctx.switchLocale('th');

  // 1. Over 8 vendor categories all appear with per-vendor counts & clear search button toggles cleanly
  makeEl('providerSelect').value = 'OpenRouter';
  storage.set('hush-model-cache', JSON.stringify({
    OpenRouter: [
      'openai/gpt-4o',
      'anthropic/claude-sonnet-4.6',
      'google/gemini-2.5-flash',
      'deepseek/deepseek-r1',
      'meta-llama/llama-3.3-70b',
      'qwen/qwen-2.5-72b',
      'mistralai/mistral-large',
      'x-ai/grok-3',
      'cohere/command-r-plus',
      'perplexity/sonar-pro',
      'microsoft/phi-4'
    ]
  }));
  ctx.openModelPickerModal();
  const chipsHtml = makeEl('modelPickerVendorChips').innerHTML;
  for (const vendor of ['OpenAI', 'Claude', 'Gemini', 'DeepSeek', 'Llama', 'Qwen', 'Mistral', 'Grok', 'Cohere', 'Perplexity', 'Phi']) {
    assert.ok(chipsHtml.includes(`data-vendor="${vendor}"`), `Expected vendor chip for ${vendor}`);
  }
  assert.match(chipsHtml, /<span class="chip-count">11<\/span>/);
  assert.equal(makeEl('modelSearchClearBtn').hidden, true);

  makeEl('modelSearchInput').value = 'phi-4';
  ctx.renderModelPickerList('phi-4');
  assert.equal(makeEl('modelSearchClearBtn').hidden, false);
  ctx.clearModelSearch();
  assert.equal(makeEl('modelSearchInput').value, '');
  assert.equal(makeEl('modelSearchClearBtn').hidden, true);

  // 2. Discover sort cycles Featured -> Favorites -> My Characters -> Featured
  ctx.toggleFavorite('Elias');
  ctx.cycleDiscoverSort();
  assert.match(makeEl('discoverSortBtn').textContent, /รายการโปรด/);
  assert.match(makeEl('cards').innerHTML.indexOf('data-name="Elias"') < makeEl('cards').innerHTML.indexOf('data-name="Mira"') ? 'ok' : 'bad', /^ok$/);
  ctx.cycleDiscoverSort();
  assert.match(makeEl('discoverSortBtn').textContent, /ตัวละครของฉัน/);
  ctx.cycleDiscoverSort();
  assert.match(makeEl('discoverSortBtn').textContent, /แนะนำ/);

  // 3. Message copy & auto-expanding composer textarea
  ctx.activeChatHistory = [{ role: 'assistant', content: 'สวัสดีใต้แสงจันทร์' }];
  ctx.copyMessageAtIndex(0);
  await new Promise(r => setTimeout(r, 10));
  assert.deepEqual(copiedTexts, ['สวัสดีใต้แสงจันทร์']);
  assert.match(ctx.renderMessageActionsHtml('assistant', 0, true), /copyMessageAtIndex\(0\)/);

  const msgInp = makeEl('messageInput');
  msgInp.scrollHeight = 96;
  ctx.autoResizeComposer(msgInp);
  assert.equal(msgInp.style.height, '96px');
  msgInp.scrollHeight = 400;
  ctx.autoResizeComposer(msgInp);
  assert.equal(msgInp.style.height, '125px');

  // 4. Import character art persistence
  const shareCode = ctx.encodeCharacterShareCode({ name: 'ลูน่า', role: 'นักดูดาว', art: 'art6' });
  makeEl('importCharacterTextInput').value = shareCode;
  await ctx.confirmImportCharacter();
  assert.equal(JSON.parse(storage.get('hush-char-arts'))['ลูน่า'], 'art6');

  // 5. Escape closes modals like languageModal & charInfoModal
  makeEl('languageModal').classList.add('show');
  makeEl('charInfoModal').classList.add('show');
  for (const fn of docListeners.get('keydown') || []) fn({ key: 'Escape' });
  assert.equal(makeEl('languageModal').classList.contains('show'), false);
  assert.equal(makeEl('charInfoModal').classList.contains('show'), false);
});

test('v1.1.1: non-overlapping mobile menu toggle in topbar + bottom bar, Custom Theme Studio persistence & CSS vars, and openDiscoverSearch fix', async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'styles.css'), 'utf8');

  // 1. Mobile menu toggle sits inside topbar-left (not fixed floating overlay) & bottom nav has mobileBottomMenuBtn
  assert.match(html, /<header class="topbar"><div class="topbar-left"><button class="icon-button mobile-menu-toggle" id="mobileMenuToggle"/);
  assert.match(html, /id="mobileBottomMenuBtn"/);
  assert.match(html, /id="appCustomBg"/);
  assert.match(html, /id="customThemeBuilder"/);
  assert.match(css, /\.mobile-menu-toggle\{[^}]*position:relative;top:auto;left:auto/);
  assert.doesNotMatch(css, /\.mobile-menu-toggle\{[^}]*position:fixed/);

  // 2. Backend persists activeTheme: 'custom' and sanitizes customTheme payload
  await withCustomServer({}, async base => {
    const sampleImg = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const putRes = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        activeTheme: 'custom',
        customTheme: {
          accent: '#FF66AA',
          bg: '#0E0D14',
          panel: '#181622',
          text: '#F7F2FA',
          bgOpacity: 48,
          bgImage: sampleImg
        }
      })
    });
    assert.equal(putRes.status, 200);
    const got = await (await fetch(`${base}/api/settings`)).json();
    assert.equal(got.activeTheme, 'custom');
    assert.equal(got.customTheme.accent, '#ff66aa');
    assert.equal(got.customTheme.bgOpacity, 48);
    assert.equal(got.customTheme.bgImage, sampleImg);

    // Rejects invalid CSS/URL injection in customTheme
    const badRes = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        customTheme: {
          accent: 'javascript:alert(1)',
          bgOpacity: 999,
          bgImage: 'https://evil.example/x.png'
        }
      })
    });
    assert.equal(badRes.status, 200);
    const badGot = await (await fetch(`${base}/api/settings`)).json();
    assert.equal(badGot.customTheme.accent, '#d6aa76');
    assert.equal(badGot.customTheme.bgOpacity, 85);
    assert.equal(badGot.customTheme.bgImage, '');
  });

  // 3. Frontend VM executes Custom Theme Studio, resetCustomTheme, and openDiscoverSearch cleanly
  const elements = new Map();
  const storage = new Map();
  const rootVars = {};
  const removedVars = [];
  const rootAttrs = {};
  let activeView = 'chat';
  let searchFocused = 0;

  function createMockEl(id = '', tag = 'div') {
    const classSet = new Set();
    const attrs = {};
    const el = {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      disabled: false,
      dataset: {},
      style: { backgroundImage: '', opacity: '', background: '', setProperty() {} },
      classList: {
        add(...names) { names.forEach(n => classSet.add(n)); },
        remove(...names) { names.forEach(n => classSet.delete(n)); },
        toggle(n, force) {
          if (typeof force === 'boolean') { if (force) classSet.add(n); else classSet.delete(n); return force; }
          if (classSet.has(n)) { classSet.delete(n); return false; }
          classSet.add(n); return true;
        },
        contains: n => classSet.has(n)
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute: k => attrs[k] ?? null,
      scrollIntoView() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      focus() { if (id === 'searchInput') searchFocused += 1; }
    };
    return el;
  }

  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const ctx = {
    console, Math, Date, JSON, Array, Object, Set, Map, RegExp, Error, Promise, Intl,
    encodeURIComponent, decodeURIComponent, escape, unescape, setTimeout, clearTimeout,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    fetch: async () => ({ ok: true, json: async () => ({}) }),
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: {
        style: {
          setProperty: (k, v) => { rootVars[k] = String(v); },
          removeProperty: k => { delete rootVars[k]; removedVars.push(k); }
        },
        setAttribute: (k, v) => { rootAttrs[k] = String(v); },
        getAttribute: k => rootAttrs[k] ?? null,
        removeAttribute: k => { delete rootAttrs[k]; }
      },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js', 'locales/en.js', 'locales/zh.js', 'locales/ja.js',
    'js/i18n.js', 'js/state.js', 'js/api.js', 'js/characters.js', 'js/chat.js', 'js/settings.js', 'js/app.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'public', rel), 'utf8'), ctx, { filename: rel });
  }
  ctx.showView = name => { activeView = name; };

  // Custom theme draft, save, clear, reset
  makeEl('customThemeAccent').value = '#ff77aa';
  makeEl('customThemeBg').value = '#101018';
  makeEl('customThemePanel').value = '#1a1a28';
  makeEl('customThemeText').value = '#f5f0ff';
  makeEl('customThemeBgOpacity').value = '45';
  ctx.updateCustomThemeDraft();
  assert.equal(rootAttrs['data-theme'], 'custom');
  assert.equal(rootVars['--accent'], '#ff77aa');
  assert.equal(makeEl('customThemeBgOpacityVal').textContent, '45%');

  ctx.saveCustomTheme();
  assert.equal(storage.get('hush-theme'), 'custom');
  assert.equal(JSON.parse(storage.get('hush-custom-theme')).accent, '#ff77aa');

  // Switching back to obsidian removes inline custom CSS variables cleanly
  ctx.applyTheme('obsidian');
  assert.equal(rootAttrs['data-theme'], undefined);
  assert.ok(removedVars.includes('--accent'));

  ctx.resetCustomTheme();
  assert.equal(storage.get('hush-custom-theme'), undefined);
  assert.equal(makeEl('customThemeAccent').value, '#d6aa76');

  // Topbar search bug fix: switches to discover before focusing searchInput
  ctx.openDiscoverSearch();
  assert.equal(activeView, 'discover');
  assert.equal(searchFocused, 1);

  // Mobile toggle syncs both topbar toggle and bottom nav button
  ctx.toggleMobileMenu(true);
  assert.equal(makeEl('mobileMenuToggle').getAttribute('aria-expanded'), 'true');
  assert.equal(makeEl('mobileBottomMenuBtn').classList.contains('active'), true);
});

test('v1.2.0: gzip/ETag/304 & PWA assets, Stop Generating AbortController, mobile perf CSS, Android APK project, and standalone APK runtime', async () => {
  // 1. Android APK project files & GitHub Actions workflow exist and are properly configured
  const rootDir = path.join(__dirname, '..');
  const gradleApp = fs.readFileSync(path.join(rootDir, 'android', 'app', 'build.gradle'), 'utf8');
  const manifestXml = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
  const mainActivity = fs.readFileSync(path.join(rootDir, 'android', 'app', 'src', 'main', 'java', 'com', 'hushrp', 'app', 'MainActivity.java'), 'utf8');
  const ciWorkflow = fs.readFileSync(path.join(rootDir, '.github', 'workflows', 'build-android-apk.yml'), 'utf8');
  const css = fs.readFileSync(path.join(rootDir, 'public', 'css', 'styles.css'), 'utf8');

  assert.match(gradleApp, /applicationId 'com\.hushrp\.app'/);
  assert.match(gradleApp, /syncWebAssets/);
  assert.match(manifestXml, /android:windowSoftInputMode="adjustResize"/);
  assert.match(mainActivity, /HushAndroidBridge/);
  assert.match(mainActivity, /httpRequestAsync/);
  assert.match(mainActivity, /onShowFileChooser/);
  assert.match(mainActivity, /handleAndroidBackPress/);
  assert.match(ciWorkflow, /assembleRelease/);
  assert.match(css, /content-visibility:\s*auto/);
  assert.match(css, /body:before\{animation:none;will-change:auto\}/);

  // 2. Server serves gzipped assets with ETag + 304 Not Modified and PWA manifest/SW/icon
  await withCustomServer({}, async base => {
    const cssRes = await fetch(`${base}/css/styles.css`, { headers: { 'accept-encoding': 'gzip' } });
    assert.equal(cssRes.status, 200);
    const etag = cssRes.headers.get('etag');
    assert.ok(etag, 'Expected ETag header on static asset');

    const notMod = await fetch(`${base}/css/styles.css`, { headers: { 'if-none-match': etag } });
    assert.equal(notMod.status, 304);

    const manifestRes = await fetch(`${base}/manifest.json`);
    assert.equal(manifestRes.status, 200);
    const manifestJson = await manifestRes.json();
    assert.equal(manifestJson.short_name, 'HushRP');

    const swRes = await fetch(`${base}/sw.js`);
    assert.equal(swRes.status, 200);
    assert.match(await swRes.text(), /HUSH_CACHE/);

    const iconRes = await fetch(`${base}/icon.svg`);
    assert.equal(iconRes.status, 200);
    assert.match(iconRes.headers.get('content-type') || '', /image\/svg\+xml/);
  });

  // 3. Standalone Android APK runtime bridge + Stop Generating + Android Back Press
  const elements = new Map();
  const storage = new Map();
  const nativeHttpCalls = [];
  const statusBarCalls = [];
  let savedFiles = [];

  function createMockEl(id = '', tag = 'div') {
    const classSet = new Set();
    const attrs = {};
    return {
      id,
      tagName: tag.toUpperCase(),
      value: '',
      textContent: '',
      innerHTML: '',
      hidden: false,
      disabled: false,
      dataset: {},
      style: { display: '', height: '', backgroundImage: '', opacity: '', setProperty() {} },
      classList: {
        add(...names) { names.forEach(n => classSet.add(n)); },
        remove(...names) { names.forEach(n => classSet.delete(n)); },
        toggle(n, force) {
          if (typeof force === 'boolean') { if (force) classSet.add(n); else classSet.delete(n); return force; }
          if (classSet.has(n)) { classSet.delete(n); return false; }
          classSet.add(n); return true;
        },
        contains: n => classSet.has(n)
      },
      setAttribute(k, v) { attrs[k] = String(v); },
      getAttribute: k => attrs[k] ?? null,
      appendChild() {},
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      focus() {}
    };
  }
  function makeEl(id) {
    if (!elements.has(id)) elements.set(id, createMockEl(id));
    return elements.get(id);
  }

  const sendBtn = createMockEl('sendBtn', 'button');
  const ctx = {
    console, Math, Date, JSON, Array, Object, Set, Map, RegExp, Error, Promise, Intl, URL, AbortController,
    encodeURIComponent, decodeURIComponent, escape, unescape, setTimeout, clearTimeout,
    requestAnimationFrame: fn => fn(),
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    navigator: { language: 'th-TH' },
    location: { protocol: 'https:', hostname: 'appassets.androidplatform.net' },
    HushAndroid: {
      setStatusBarColor(hex, isLight) { statusBarCalls.push({ hex, isLight }); },
      saveTextFile(name, mime, content) { savedFiles.push({ name, mime, content }); return true; },
      cancelHttpRequest() {},
      httpRequestAsync(reqId, optsJson) {
        const opts = JSON.parse(optsJson);
        nativeHttpCalls.push(opts);
        if (opts.url.includes('/models')) {
          ctx.__hushNativeHttpCallback(reqId, JSON.stringify({
            ok: true, status: 200,
            text: JSON.stringify({ data: [{ id: 'gpt-4o-mini' }, { id: 'anthropic/claude-sonnet-4.6' }] })
          }));
        } else if (opts.url.includes('/chat/completions')) {
          ctx.__hushNativeHttpCallback(reqId, JSON.stringify({
            ok: true, status: 200,
            text: JSON.stringify({ choices: [{ message: { content: '<think>plan</think>สวัสดีจาก APK!' }, finish_reason: 'stop' }] })
          }));
        } else {
          ctx.__hushNativeHttpCallback(reqId, JSON.stringify({ ok: true, status: 200, text: '{}' }));
        }
      }
    },
    fetch: async () => { throw new Error('Should not hit browser fetch for /api/ in APK standalone mode'); },
    localStorage: {
      getItem: k => (storage.has(k) ? storage.get(k) : null),
      setItem: (k, v) => { storage.set(k, String(v)); },
      removeItem: k => { storage.delete(k); }
    },
    sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    innerWidth: 390,
    innerHeight: 844,
    addEventListener: () => {},
    document: {
      activeElement: null,
      documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, getAttribute: () => null, removeAttribute() {} },
      body: createMockEl('body', 'body'),
      createElement: tag => createMockEl('', tag),
      createTextNode: txt => ({ textContent: String(txt) }),
      getElementById: id => makeEl(id),
      querySelector: sel => (sel === '.send' ? sendBtn : null),
      querySelectorAll: () => [],
      addEventListener: () => {}
    }
  };
  ctx.window = ctx;
  ctx.self = ctx;
  vm.createContext(ctx);

  for (const rel of [
    'locales/th.js', 'locales/en.js', 'locales/zh.js', 'locales/ja.js',
    'js/i18n.js', 'js/state.js', 'js/mobile-runtime.js', 'js/api.js', 'js/characters.js', 'js/chat.js', 'js/settings.js', 'js/app.js'
  ]) {
    vm.runInContext(fs.readFileSync(path.join(rootDir, 'public', rel), 'utf8'), ctx, { filename: rel });
  }

  // APK Standalone /api/status, /api/settings (device key), /api/models, /api/chat
  assert.equal(ctx.isNativeAndroidApp(), true);
  assert.equal(makeEl('mobileAppPanel').hidden, false);

  const putKeyRes = await ctx.fetch('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({ serverApiKey: 'sk-apk-device-secret-9999' })
  });
  assert.equal(putKeyRes.status, 200);
  const statusJson = await (await ctx.fetch('/api/status')).json();
  assert.equal(statusJson.runtimeMode, 'apk-standalone');
  assert.equal(statusJson.aiConfigured, true);
  assert.match(statusJson.serverKeyMasked, /sk-••••9999/);

  const modelsRes = await ctx.fetch('/api/models', {
    method: 'POST',
    body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.openai.com/v1' })
  });
  assert.equal(modelsRes.status, 200);
  assert.deepEqual((await modelsRes.json()).models, ['gpt-4o-mini', 'anthropic/claude-sonnet-4.6']);

  const chatRes = await ctx.fetch('/api/chat', {
    method: 'POST',
    body: JSON.stringify({ provider: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'hi' }] })
  });
  assert.equal(chatRes.status, 200);
  assert.equal((await chatRes.json()).text, 'สวัสดีจาก APK!');
  assert.ok(nativeHttpCalls.length >= 2);

  // Stop Generating button & AbortController
  ctx.setComposerBusy(true);
  assert.equal(makeEl('stopGenBtn').hidden, false);
  assert.equal(sendBtn.hidden, true);
  const sig = ctx.beginTurnAbortController();
  assert.equal(sig.aborted, false);
  assert.equal(ctx.stopGeneratingReply(), true);
  assert.equal(sig.aborted, true);
  ctx.setComposerBusy(false);
  assert.equal(makeEl('stopGenBtn').hidden, true);
  assert.equal(sendBtn.hidden, false);

  // Android Status Bar sync & Back button handling
  ctx.applyTheme('sakura');
  assert.ok(statusBarCalls.some(c => c.hex === '#17111a' && c.isLight === false));
  makeEl('modelPickerModal').classList.add('show');
  assert.equal(ctx.handleAndroidBackPress(), true);
  assert.equal(makeEl('modelPickerModal').classList.contains('show'), false);

  // Native export file bridge
  assert.equal(ctx.saveFileNativeOrBrowser('story.md', 'text/markdown', '# Hi'), true);
  assert.equal(savedFiles.length, 1);
  assert.equal(savedFiles[0].name, 'story.md');
});




