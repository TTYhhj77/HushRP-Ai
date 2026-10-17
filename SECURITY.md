# Security Policy for HushRP-Ai

HushRP-Ai is an open-source, self-hosted AI roleplay interface designed for individual users, friends, and small communities. This document outlines our security model, supported environments, best practices, and vulnerability reporting procedures.

---

## 1. Threat Model & Deployment Modes

HushRP-Ai supports three operational profiles, each with distinct security guarantees:

### A. Local Single-User Mode (`RUNTIME_MODE=local`, default)
- **Target Audience:** Personal use running on desktop/laptop.
- **Network Scope:** Bound to loopback (`127.0.0.1` / `localhost`).
- **Authentication:** By default, loopback requests are automatically permitted for frictionless zero-config local play. If `AUTH_TOKEN` is specified in `.env`, authentication is strictly enforced even on loopback.
- **Endpoints:** Allows local Ollama (`http://localhost:11434/v1`) and dynamic custom HTTPS endpoints via the in-app allowlist.

### B. Home LAN Mode (`LAN_ONLY=true`)
- **Target Audience:** Sharing with devices on the same home Wi-Fi or private local network.
- **Network Scope:** Only accepts connections from RFC 1918 private IPv4 ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`) and loopback.
- **Protection:** All public internet IP addresses are immediately rejected with `403 Forbidden`.

### C. VPS / Public Hosting Mode (`RUNTIME_MODE=vps`)
- **Target Audience:** Remote access or hosting for small friend groups behind a reverse proxy (e.g., Caddy, Nginx, Cloudflare Tunnel).
- **Mandatory Requirements:**
  - `AI_API_KEY` must stay on the server.
  - Browser-side API keys (`ALLOW_CLIENT_API_KEYS`) are **hard-disabled**.
  - `AUTH_TOKEN` should be configured to protect all system endpoints.
  - HTTPS must be terminated at the reverse proxy.
  - Session IDs (`x-session-id`) are strictly required; missing or malformed IDs receive `400 Bad Request` (no fallback to shared anonymous chat stores).

---

## 2. Core Security Controls

HushRP-Ai maintains a **zero runtime npm dependency** footprint, relying exclusively on Node.js 20+ built-ins (`crypto`, `http`, `fs`, `path`) to eliminate supply chain vulnerabilities.

### Session Isolation & Anti-Hijacking
- **Cryptographic Tokens:** Sessions are bound to a high-entropy secret token generated via `crypto.randomBytes(24)` / `crypto.getRandomValues()`.
- **Server Verification:** Tokens are stored as SHA-256 hashes (`sessions_meta.json`). Any request specifying an existing session ID without the corresponding `x-session-token` receives `403 Forbidden`.
- **Timing-Safe Comparison:** All token and password checks use `crypto.timingSafeEqual` to eliminate timing side-channel attacks.

### SSRF (Server-Side Request Forgery) Defense
- **Private IP Rejection:** The `/api/models` and `/api/chat` proxy endpoints reject any target host resolving to private, loopback, or link-local domains (`.local`, `.internal`, `.localhost`, `.lan`) as well as IPv4/IPv6 literals.
- **Redirect Hijacking Protection:** Upstream `fetch` calls specify `redirect: 'error'` so that AI endpoints cannot be used as an open proxy to pivot to internal network metadata services.
- **Protocol Enforcement:** All remote custom endpoints must use HTTPS. Plain HTTP is exclusively permitted for localhost Ollama.

### Upload & File Inclusion Hardening
- **Magic Byte Validation:** Image uploads (`/api/characters`) check actual binary signatures:
  - PNG: `89 50 4E 47 0D 0A 1A 0A`
  - JPEG: `FF D8 FF`
  - WebP: `RIFF` ... `WEBP`
- **MIME & Extension Lockdown:** Uploaded files are served with `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; sandbox`.
- **Path Traversal Guards:** File names are restricted using `path.basename` and regex bounds to prevent directory escape.

### XSS & Injection Mitigation
- **DOM Sanitization:** All dynamic locale text rendered with HTML tags is filtered through `sanitizeI18nHtml()`, stripping `<script>`, `<iframe>`, `<img>`, `<svg>`, and inline `on*` event handlers.
- **Safe DOM Binding:** Dynamic elements use DOM `dataset` attributes (`this.dataset.name`) rather than inline JavaScript string interpolation, preventing syntax breakouts and character name payload injections.
- **Strict Headers:** The frontend is served with strict `Content-Security-Policy`, `X-Frame-Options: SAMEORIGIN`, and `Referrer-Policy: strict-origin-when-cross-origin`.

### Prototype Pollution & Payload Limits
- Character names and input fields undergo prototype pollution filtering (rejecting `__proto__`, `constructor`, `prototype`).
- JSON payload sizes are bounded (1 MB for standard API requests, 8 MB for character image uploads).
- Per-IP rate limiting (`RATE_LIMIT_RPM`, default 60 requests/minute) protects against brute force and resource exhaustion.

---

## 3. Best Practices for Deployment

1. **Keep Secrets Out of Client Code:** Never enter your primary master API key into shared browsers. Set `AI_API_KEY` on the server in `.env`.
2. **Use HTTPS on Public Networks:** When accessing over the internet, always place HushRP-Ai behind a TLS-terminating reverse proxy.
3. **Configure AUTH_TOKEN:** Set a strong random token for `AUTH_TOKEN` in `.env` whenever the server is reachable outside localhost.
4. **Regular Backups:** Keep backups of `characters.json` and the `sessions/` directory.

---

## 4. Reporting a Vulnerability

If you discover a security vulnerability in HushRP-Ai:

1. **Do not open a public issue.**
2. Send a report via email or open a private GitHub Security Advisory on the repository:
   https://github.com/TTYhhj77/HushRP-Ai/security/advisories
3. Include details of the vulnerability, reproduction steps, and impact.
4. We aim to acknowledge reports within 48 hours and provide a patch promptly.
