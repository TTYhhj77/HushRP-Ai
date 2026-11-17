# HushRP

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-287%20passing-success.svg)](test/)

HushRP is a self-hostable AI roleplay web application built on pure Node.js with no runtime npm dependencies. It is designed for maximum privacy and portability: there is no database daemon, no build step, and no bundler. The frontend is served as clean modular static files (`public/`) directly by the built-in Node.js server. All persistent state is stored as atomic JSON files on the host filesystem.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Deployment Modes](#deployment-modes)
- [Configuration](#configuration)
- [Reverse Proxy Examples](#reverse-proxy-examples)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [AI Provider Support](#ai-provider-support)
- [API Key Modes](#api-key-modes)
- [Security](#security)
- [Testing](#testing)
- [Other Languages](#other-languages)
- [License](#license)

---

## Features

### Zero Dependencies

HushRP uses only Node.js built-in modules (`http`, `fs`, `crypto`, `path`, `os`). There are no runtime npm packages, no bundler, and no build pipeline. Deployment requires nothing beyond a Node.js 20+ runtime.

### Multi-Language Interface (i18n)

The interface supports **Thai (`th`), English (`en`), Chinese (`zh`), and Japanese (`ja`)** with 100% coverage of all UI strings, built-in character cards, and genre tags. Languages switch dynamically without a page reload, and a Custom Language Creator allows users to add any additional language via JSON dictionary.

### Multi-Theme UI & Web Audio SFX

Includes 5 selectable color themes (`obsidian`, `sakura`, `emerald`, `ocean`, and `parchment`), GPU-accelerated animations with `prefers-reduced-motion` support, mobile virtual keyboard viewport adaptation, and synthesized Web Audio UI sound effects.

### Stealth AI Auto-Memory & Full Character Reset

Instead of relying solely on basic string trimming, the active roleplay AI automatically records concise semantic long-term memories (names, promises, relationships, key plot events) inline inside hidden `<memory>...</memory>` tags during normal replies without extra API round trips. Users can inspect, edit, add, consolidate with AI, or perform a full character reset (`resetCharacterAll`) that wipes both long-term AI memory and chat history across RAM, `localStorage`, and server persistence.

### Web UI API Setup, Connection Tester & Ollama Support

Provider selection (`OpenAI`, `OpenRouter`, `Ollama`, or Custom OpenAI-compatible endpoints), server API keys, model discovery, and live latency/connection testing (`/api/test-connection`) can be configured directly inside the Web UI, including automatic `/v1/models` and `/api/tags` discovery for local and LAN Ollama instances.

### Character Studio

Characters are created and managed through an in-application editor. Each character record includes: name, role, appearance description, system prompt, first message, genre tags, adult content flag, cover image, and background image. Characters can be created, edited, and deleted without leaving the application.

### Player Personas and Profiles

Users may define multiple named personas, each with a name, role, appearance, biography, avatar, and cover image. The active persona is injected into the AI system prompt, personalizing responses without manual prompt editing.

### World Builder

A shared world definition — comprising world name, lore, and immutable facts — is injected into every system prompt. This provides consistent narrative context across all characters and sessions.

### Context Optimizer

An extractive history compressor trims conversation history to stay within a configurable token budget. No AI call is required for summarization; trimming is performed locally using a string-length heuristic.

### Token Budgeting

Separate controls govern the context window (input token limit) and maximum reply length (output token limit). Both settings persist across browser sessions.

### Chat Persistence

In local mode, conversation history is saved to both `localStorage` and a server-side file. In VPS mode, history is stored per-session, keyed by the `x-session-id` request header, providing session isolation between users.

### Story Export

A full conversation may be exported as a Markdown file or copied to the clipboard directly from the interface.

### Favorites

Any character may be starred. Favorites are persisted in `localStorage` and synchronized to the server. No user account is required.

### Composer Toolbar

Quick-format buttons allow users to wrap text in speech (`" "`) or action (`* *`) markers without manual typing. Roleplay text is rendered distinctly: quoted speech appears highlighted, and text enclosed in asterisks is rendered as narrative italic.

### Sound Effects

Ambient and event sounds are generated at runtime using the Web Audio API synthesizer. No audio files are loaded or distributed.

### Custom Endpoint and Proxy Manager

Custom OpenAI-compatible proxy hostnames can be registered directly from the UI without editing configuration files. SSRF protection enforces HTTPS-only hostnames. This feature is available in local and LAN modes only.

---

## Requirements

- Node.js 20 or later
- A valid API key for at least one supported AI provider, or a locally running Ollama instance

---

## Installation

### Windows

```cmd
start.cmd
```

`start.cmd` presents an interactive menu for configuration and startup.

### Linux / macOS

```sh
chmod +x install-linux.sh start-linux.sh
./install-linux.sh
./start-linux.sh
```

Alternatively, if Node.js is already installed:

```sh
npm start
```

### Docker

```sh
docker compose up -d
```

Conversation and character data are persisted in the `./data` volume on the host.

> **Backup**: back up the `./data` directory directly. For example:
> ```sh
> tar -czf hushrp-backup-$(date +%F).tar.gz data/ .env
> ```

---

## Deployment Modes

HushRP supports three deployment modes, selected via the `RUNTIME_MODE` environment variable.

### Local

- Binds to `127.0.0.1:3000` (loopback only).
- Accessible only from the machine running the server.
- Maximum privacy. Browser API key entry is available.

### LAN / Wi-Fi

- Binds to the host's LAN interface.
- Accessible from devices on the same private network (mobile, tablet).
- LAN Guard automatically rejects all requests originating from non-RFC 1918 IP addresses.
- Browser API key entry is available.

### VPS / Cloud

- Intended for deployment behind a reverse proxy (Nginx, Caddy) with HTTPS termination.
- Browser API key entry is disabled automatically.
- Per-session chat isolation is enforced via `x-session-id`.

---

## Configuration

Copy `.env.example` to `.env` and adjust values as required.

```env
PORT=3000
HOST=127.0.0.1
LAN_ONLY=false
RUNTIME_MODE=local
AI_API_KEY=your_key_here
MAX_INPUT_TOKENS=1800
MEMORY_SUMMARY_CHARS=900
MAX_OUTPUT_TOKENS=500
CUSTOM_ENDPOINT_HOSTS=
ALLOW_CLIENT_API_KEYS=false
CLIENT_KEY_HOSTS=api.openai.com,openrouter.ai
```

| Variable | Description |
|---|---|
| `PORT` | TCP port the server listens on. |
| `HOST` | Bind address. Use `127.0.0.1` for local, `0.0.0.0` for LAN/VPS. |
| `LAN_ONLY` | When `true`, activates LAN Guard to block non-private IPs. |
| `RUNTIME_MODE` | `local`, `lan`, or `vps`. Controls feature availability. |
| `AI_API_KEY` | Server-side API key. Never transmitted to the browser. |
| `MAX_INPUT_TOKENS` | Context window token budget (input). |
| `MEMORY_SUMMARY_CHARS` | Character threshold used by the extractive compressor. |
| `MAX_OUTPUT_TOKENS` | Maximum reply length in tokens. |
| `CUSTOM_ENDPOINT_HOSTS` | Comma-separated list of additional allowed proxy hostnames. |
| `ALLOW_CLIENT_API_KEYS` | Enables browser-supplied API keys in local/LAN modes. |
| `CLIENT_KEY_HOSTS` | Allowed hostnames when browser keys are enabled. |

---

## Project Structure

```
server.js                       # HTTP server, AI proxy, security, file persistence
lib/
  context.js                    # Context bounding, extractive compressor, token heuristics
public/
  index.html                    # Main web UI markup
  css/styles.css                # Multi-theme responsive styles
  js/*.js                       # Modular frontend logic (API, chat, memory, state, settings, i18n)
  locales/{th,en,zh,ja}.js      # Built-in 4-language dictionaries
test/
  app.test.js                   # Server, AI proxy, and launcher tests
  context.test.js               # Context optimizer and token budget tests
  features-v4.test.js           # i18n, themes, Stealth AI Auto-Memory, personas, favorites, persistence
  mobile-menu-smoke.test.js     # Accessibility and navigation drawer tests
  security.test.js              # Auth, SSRF, session isolation, upload & header hardening tests
  helpers.js                    # Shared frontend test helpers
data/
  characters.json               # Runtime character database (auto-created, gitignored)
  settings.json                 # Runtime settings & keys (auto-created, gitignored)
  chats.json                    # Runtime chat & AI memory store (auto-created, gitignored)
  uploads/                      # Uploaded character artwork (gitignored except .gitkeep)
Dockerfile
compose.yaml
start.cmd                       # Windows interactive launcher
start-linux.sh                  # Linux / macOS launcher
install-linux.sh                # Linux dependency installer
.env.example                    # Configuration template
LICENSE                         # MIT License
```

---

## AI Provider Support

HushRP supports any provider that exposes an OpenAI-compatible chat completions API.

| Provider | Notes |
|---|---|
| OpenAI | `api.openai.com` — default endpoint |
| OpenRouter | Access to multiple models through a single key |
| Ollama | Local inference, no API key required |
| Custom endpoints | Add hostnames via the UI; SSRF protection enforced |

---

## API Key Modes

### Server Key

The API key is stored in `.env` on the server and is never transmitted to the browser. This is the recommended mode for all deployments.

### Browser Key

The API key is entered in the browser and held in memory only. It is cleared when the tab is closed. This mode is available in local and LAN deployments only and must be explicitly enabled via `ALLOW_CLIENT_API_KEYS=true`.

---

## Security

| Measure | Description |
|---|---|
| LAN Guard | Rejects all requests from non-RFC 1918 addresses when `LAN_ONLY=true`. |
| SSRF protection | Custom endpoint hostnames are validated; only HTTPS-scheme domains are accepted. |
| Secure HTTP headers | `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` are set on all responses. |
| Rate limiting | In-memory per-IP rate limiting on API proxy routes. |
| Atomic writes | All JSON persistence uses a temp-file swap (`safeWriteJson`) to prevent data corruption on crash. |
| Repository hygiene | `.gitignore` excludes `.env`, `data/`, and `uploads/` to prevent accidental credential or data commits. |

---

## Reverse Proxy Examples

> These examples are provided for convenience when deploying HushRP behind a reverse proxy with HTTPS termination. Adjust hostnames, certificates, and paths to match your environment.

### `compose.yaml` snippet

```yaml
services:
  hushrp:
    build: .
    container_name: hushrp
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # bind only to localhost; reverse proxy exposes externally
    env_file:
      - .env
    volumes:
      - ./data:/app/data
```

### Nginx

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name hushrp.example.com;

    ssl_certificate     /etc/letsencrypt/live/hushrp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/hushrp.example.com/privkey.pem;

    client_max_body_size 10m;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;   # allow longer timeouts for streaming replies
    }
}
```

### Caddy

```caddyfile
hushrp.example.com {
    reverse_proxy 127.0.0.1:3000 {
        transport http {
            read_timeout 300s
        }
    }
}
```

> When using a reverse proxy, set `RUNTIME_MODE=vps` in `.env` and ensure `LAN_ONLY=false`.

---

## Troubleshooting

| Symptom | Likely cause | Check / fix |
|---|---|---|
| `EADDRINUSE` | Port already in use | Change `PORT`, or locate the process with `lsof -i :3000` / `netstat -ano | findstr :3000` |
| `.env` changes not taking effect | Not restarted / wrong path | `.env` must be in the same directory as the start command; restart after editing |
| Ollama connection fails | Service not running or wrong port | Verify `ollama serve` is running (default `http://127.0.0.1:11434`), and run `ollama pull <model>` |
| LAN mobile cannot connect | `HOST` not set to `0.0.0.0` or firewall blocking | Check `.env` and system firewall; when `LAN_ONLY=true` the connecting IP must be in an RFC 1918 private range |
| Reverse proxy returns 502 | Proxy cannot reach backend / backend not listening | Confirm the backend is running and `proxy_pass` address matches `PORT` |
| Streaming replies truncated | Reverse proxy timeout too short | Increase `proxy_read_timeout` / `read_timeout` |
| Browser API key option greyed out | VPS mode or `ALLOW_CLIENT_API_KEYS=false` | Switch to `local` or `lan` mode and set `ALLOW_CLIENT_API_KEYS=true` |
| Custom endpoint rejected | Not HTTPS or not in `CUSTOM_ENDPOINT_HOSTS` | Use an HTTPS domain, or add it to the allowlist |
| Context truncated too early | `MAX_INPUT_TOKENS` too small | Increase to match model capability; adjust `MEMORY_SUMMARY_CHARS` as needed |

---

## Testing

The test suite uses the Node.js built-in test runner. No additional test framework is required.

```sh
node --test
```

Current status: **287 tests passing, 0 failing** (plus 2 environment-conditional skips on Windows when `bash` / Docker Compose are absent).

| Test file | Coverage area |
|---|---|
| `test/app.test.js` | HTTP server, AI proxy routes, connection check, Windows/Linux launchers |
| `test/context.test.js` | Context optimizer, extractive compressor, token heuristics |
| `test/features-v4.test.js` | i18n, themes, Stealth AI Auto-Memory, personas, favorites, chat persistence |
| `test/mobile-menu-smoke.test.js` | Navigation drawer, accessibility attributes |
| `test/security.test.js` | Auth token checks, SSRF protection, session isolation, upload & header hardening |

---

## Other Languages

- [Linux installation guide](README-LINUX.md)
- [ภาษาไทย (Thai)](README_th.md)
- [中文 (Chinese)](README_zh.md)

---

## License

HushRP is released under the [MIT License](LICENSE).
