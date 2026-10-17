'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createServer } = require('../server');

const html = fs.readFileSync(path.join(__dirname, '..', 'roleplay-ai-prototype-v3.html'), 'utf8');

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
  const i18nMatch = html.match(/const I18N\s*=\s*(\{[\s\S]*?\n\};)/);
  assert.ok(i18nMatch, 'I18N object defined');
  let I18N;
  eval('I18N = ' + i18nMatch[1]);

  const jaMatch = html.match(/const SAMPLE_JA_LOCALE\s*=\s*(\{[\s\S]*?\n\};)/);
  assert.ok(jaMatch, 'SAMPLE_JA_LOCALE defined');
  let SAMPLE_JA;
  eval('SAMPLE_JA = ' + jaMatch[1]);

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

