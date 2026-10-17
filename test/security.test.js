const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../server');

async function withSecServer(options, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hushrp-sec-'));
  const app = createServer({ dataDir: dir, apiKey: '', ...options });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    await fn(base, dir, app);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('Authentication: rejects unauthorized requests when authToken is configured', async () => {
  await withSecServer({ authToken: 'super-secret-token-123' }, async (base) => {
    // 1. Unauthenticated request to /api/characters DELETE should fail with 401
    const r1 = await fetch(base + '/api/characters/nonexistent', { method: 'DELETE' });
    assert.equal(r1.status, 401);
    const body1 = await r1.json();
    assert.match(body1.error, /Unauthorized/i);

    // 2. Request with invalid bearer token fails with 401
    const r2 = await fetch(base + '/api/characters/nonexistent', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer wrong-token' }
    });
    assert.equal(r2.status, 401);

    // 3. Request with valid Authorization: Bearer succeeds (or 404 if char not found, but passes auth!)
    const r3 = await fetch(base + '/api/characters/nonexistent', {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer super-secret-token-123' }
    });
    assert.equal(r3.status, 404); // 404 means auth passed!

    // 4. Request with valid x-hush-token header succeeds
    const r4 = await fetch(base + '/api/characters/nonexistent', {
      method: 'DELETE',
      headers: { 'x-hush-token': 'super-secret-token-123' }
    });
    assert.equal(r4.status, 404); // passed auth
  });
});

test('Session Fallback: VPS mode requires x-session-id and does not fallback to shared file', async () => {
  await withSecServer({ runtimeMode: 'vps' }, async (base) => {
    // Without x-session-id, GET /api/chats must return 400 Bad Request in VPS mode
    const r1 = await fetch(base + '/api/chats');
    assert.equal(r1.status, 400);
    const d1 = await r1.json();
    assert.match(d1.error, /Valid x-session-id header is required/i);

    // PUT /api/chats without x-session-id also fails with 400
    const r2 = await fetch(base + '/api/chats/Mira', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ history: [] })
    });
    assert.equal(r2.status, 400);
  });
});

test('Session Isolation: session token binding prevents cross-session hijacking', async () => {
  await withSecServer({ runtimeMode: 'vps' }, async (base) => {
    // 1. Create a secure session via POST /api/sessions
    const sRes = await fetch(base + '/api/sessions', { method: 'POST' });
    assert.equal(sRes.status, 201);
    const sessionData = await sRes.json();
    assert.ok(sessionData.sessionId);
    assert.ok(sessionData.sessionToken);

    const sid = sessionData.sessionId;
    const token = sessionData.sessionToken;

    // 2. Put chat into this session with valid token
    const putRes = await fetch(base + '/api/chats/Mira', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-session-id': sid,
        'x-session-token': token
      },
      body: JSON.stringify({ history: [{ role: 'user', content: 'Secret session data' }], lastUpdated: Date.now() })
    });
    assert.equal(putRes.status, 200);

    // 3. Attacker tries to read session without token -> 403 Forbidden
    const attack1 = await fetch(base + '/api/chats', {
      headers: { 'x-session-id': sid }
    });
    assert.equal(attack1.status, 403);
    const attack1Body = await attack1.json();
    assert.match(attack1Body.error, /Session token required/i);

    // 4. Attacker tries with wrong token -> 403 Forbidden
    const attack2 = await fetch(base + '/api/chats', {
      headers: {
        'x-session-id': sid,
        'x-session-token': 'wrong-token-value'
      }
    });
    assert.equal(attack2.status, 403);
    const attack2Body = await attack2.json();
    assert.match(attack2Body.error, /Invalid session token/i);

    // 5. Legitimate owner with correct token reads data successfully
    const legit = await fetch(base + '/api/chats', {
      headers: {
        'x-session-id': sid,
        'x-session-token': token
      }
    });
    assert.equal(legit.status, 200);
    const chats = await legit.json();
    assert.ok(chats.Mira);
    assert.equal(chats.Mira.history[0].content, 'Secret session data');
  });
});

test('SSRF Protection: rejects private IP, loopback, and invalid custom hostnames', async () => {
  await withSecServer({}, async (base) => {
    // 1. Attempt to add loopback IP via custom host
    const r1 = await fetch(base + '/api/custom-hosts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: '127.0.0.1' })
    });
    assert.equal(r1.status, 400);

    // 2. Attempt to add internal domain
    const r2 = await fetch(base + '/api/custom-hosts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'metadata.google.internal' })
    });
    assert.equal(r2.status, 400);

    // 3. Attempt to add private RFC1918 IP
    const r3 = await fetch(base + '/api/custom-hosts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: '192.168.1.1' })
    });
    assert.equal(r3.status, 400);

    // 4. Valid external HTTPS FQDN is accepted
    const r4 = await fetch(base + '/api/custom-hosts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ host: 'api.trusted-ai-service.com' })
    });
    assert.equal(r4.status, 200);
    const d4 = await r4.json();
    assert.ok(d4.hosts.includes('api.trusted-ai-service.com'));
  });
});

test('Upload Hardening: rejects spoofed MIME image with invalid magic bytes', async () => {
  await withSecServer({}, async (base) => {
    // Fake PNG: declared as PNG data URL, but content is raw text
    const fakeDataUrl = 'data:image/png;base64,' + Buffer.from('<script>alert(1)</script>').toString('base64');
    const r = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'SpoofedImageChar',
        role: 'Test',
        appearance: '',
        desc: '',
        genre: [],
        adult: false,
        greeting: 'hello',
        imageDataUrl: fakeDataUrl
      })
    });
    assert.equal(r.status, 400);
    const body = await r.json();
    assert.match(body.error, /invalid magic bytes/i);
  });
});

test('Upload Hardening: accepts valid PNG magic bytes and serves with nosniff and sandbox CSP', async () => {
  await withSecServer({}, async (base) => {
    // Valid 1x1 PNG
    const validPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const r1 = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'ValidPngChar',
        role: 'Test',
        appearance: '',
        desc: '',
        genre: [],
        adult: false,
        greeting: 'hello',
        imageDataUrl: validPng
      })
    });
    assert.equal(r1.status, 201);
    const char = await r1.json();
    assert.ok(char.imageUrl);

    // Fetch the uploaded image and verify security headers
    const imgRes = await fetch(base + char.imageUrl);
    assert.equal(imgRes.status, 200);
    assert.equal(imgRes.headers.get('x-content-type-options'), 'nosniff');
    assert.match(imgRes.headers.get('content-security-policy') || '', /sandbox/);
  });
});

test('Prototype Pollution: rejects __proto__ or constructor in character name', async () => {
  await withSecServer({}, async (base) => {
    const r1 = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '__proto__',
        role: 'Attacker',
        desc: 'Testing',
        greeting: 'hi'
      })
    });
    assert.equal(r1.status, 400);
    const b1 = await r1.json();
    assert.match(b1.error, /Invalid character name/i);

    const r2 = await fetch(base + '/api/characters', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'constructor',
        role: 'Attacker',
        desc: 'Testing',
        greeting: 'hi'
      })
    });
    assert.equal(r2.status, 400);
  });
});

test('Security Headers: serves root page with CSP, nosniff, and frameguard', async () => {
  await withSecServer({}, async (base) => {
    const r = await fetch(base + '/');
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.ok(r.headers.get('content-security-policy'));
  });
});

test('Rate Limiting: blocks requests exceeding configured RPM', async () => {
  await withSecServer({ rateLimitRpm: 5 }, async (base) => {
    // Send 5 requests rapidly
    for (let i = 0; i < 5; i++) {
      const r = await fetch(base + '/api/characters');
      assert.equal(r.status, 200);
    }
    // 6th request should hit rate limit
    const rBlocked = await fetch(base + '/api/characters');
    assert.equal(rBlocked.status, 429);
    const body = await rBlocked.json();
    assert.match(body.error, /Too many requests/i);
  });
});
