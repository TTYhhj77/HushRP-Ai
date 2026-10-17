# HushRP

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-262%20passing-success.svg)](test/)

HushRP is a self-hostable AI roleplay web application built on pure Node.js with no runtime npm dependencies. It is designed for maximum privacy and portability: there is no database daemon, no build step, and no bundler. The entire frontend is delivered as a single HTML file. All persistent state is stored as atomic JSON files on the host filesystem.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Deployment Modes](#deployment-modes)
- [Configuration](#configuration)
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

The interface supports Thai, English, and Chinese with 100% coverage of all UI strings. Languages switch dynamically without a page reload. A Custom Language Creator allows users to extend the interface to any language by uploading a JSON dictionary file. A Japanese sample dictionary is included as a reference.

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
roleplay-ai-prototype-v3.html   # Single-file frontend (HTML + CSS + JS, no build step)
test/
  app.test.js                   # Server, API proxy, and launcher tests
  context.test.js               # Context optimizer and token budget tests
  features-v4.test.js           # i18n, personas, favorites, and chat persistence tests
  mobile-menu-smoke.test.js     # Accessibility and navigation drawer tests
data/
  characters.json               # Character database
  settings.json                 # User settings and cached model lists
  chats.json                    # Local conversation history
  uploads/                      # Character artwork
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

## Testing

The test suite uses the Node.js built-in test runner. No additional test framework is required.

```sh
node --test
```

Current status: **262 tests passing, 0 failing**.

| Test file | Coverage area |
|---|---|
| `test/app.test.js` | HTTP server, AI proxy routes, Windows/Linux launchers |
| `test/context.test.js` | Context optimizer, extractive compressor, token heuristics |
| `test/features-v4.test.js` | i18n switching, persona injection, favorites, chat persistence |
| `test/mobile-menu-smoke.test.js` | Navigation drawer, accessibility attributes |

---

## Other Languages

- [ภาษาไทย (Thai)](README_th.md)
- [中文 (Chinese)](README_zh.md)

---

## License

HushRP is released under the [MIT License](LICENSE).
