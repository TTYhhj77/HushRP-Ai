# HushRP

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-262%20passing-success.svg)](test/)

HushRP คือเว็บแอปพลิเคชัน AI roleplay แบบ self-hostable ที่สร้างขึ้นบน Node.js ล้วน โดยไม่มี runtime npm dependency เลย ออกแบบมาเพื่อความเป็นส่วนตัวและความพอร์ตเทเบิลสูงสุด: ไม่มี database daemon ไม่มี build step และไม่มี bundler frontend ทั้งหมดถูกส่งเป็นไฟล์ HTML ไฟล์เดียว สถานะที่ต้องบันทึกทั้งหมดจัดเก็บเป็นไฟล์ JSON แบบ atomic บนไฟล์ซิสเต็มของโฮสต์

---

## สารบัญ

- [คุณสมบัติ](#คุณสมบัติ)
- [ความต้องการของระบบ](#ความต้องการของระบบ)
- [การติดตั้ง](#การติดตั้ง)
- [โหมดการติดตั้งใช้งาน](#โหมดการติดตั้งใช้งาน)
- [การตั้งค่า](#การตั้งค่า)
- [โครงสร้างโปรเจกต์](#โครงสร้างโปรเจกต์)
- [ผู้ให้บริการ AI ที่รองรับ](#ผู้ให้บริการ-ai-ที่รองรับ)
- [โหมด API Key](#โหมด-api-key)
- [ความปลอดภัย](#ความปลอดภัย)
- [การทดสอบ](#การทดสอบ)
- [ภาษาต่างๆ](#ภาษาต่างๆ)
- [สัญญาอนุญาต](#สัญญาอนุญาต)

---

## คุณสมบัติ

### Zero Dependencies

HushRP ใช้เฉพาะ Node.js built-in module (`http`, `fs`, `crypto`, `path`, `os`) เท่านั้น ไม่มี runtime npm package ไม่มี bundler และไม่มี build pipeline การติดตั้งใช้งานต้องการเพียง runtime Node.js 20+ เท่านั้น

### อินเทอร์เฟซหลายภาษา (i18n)

อินเทอร์เฟซรองรับภาษาไทย อังกฤษ และจีน ครอบคลุมข้อความ UI ทั้งหมด 100% สลับภาษาได้แบบไดนามิกโดยไม่ต้องโหลดหน้าใหม่ มี Custom Language Creator ให้ผู้ใช้อัปโหลดไฟล์ JSON dictionary เพื่อขยายอินเทอร์เฟซเป็นภาษาใดก็ได้ โปรเจกต์มี dictionary ตัวอย่างภาษาญี่ปุ่นแนบมาให้เป็น reference

### Character Studio

สร้างและจัดการตัวละครผ่าน editor ภายในแอป แต่ละ record ของตัวละครประกอบด้วย: ชื่อ, บทบาท, คำอธิบายรูปลักษณ์, system prompt, ข้อความเปิดเรื่อง (first message), แท็กประเภท, สถานะเนื้อหาสำหรับผู้ใหญ่, ภาพปก และภาพพื้นหลัง สามารถสร้าง แก้ไข และลบตัวละครได้ทั้งหมดภายในแอปโดยไม่ต้องออกนอกหน้าเว็บ

### Persona ผู้เล่นและหลายโปรไฟล์

ผู้ใช้สามารถกำหนด persona ที่ตั้งชื่อไว้ได้หลายตัว แต่ละตัวมี: ชื่อ, บทบาท, รูปลักษณ์, ประวัติ, avatar และภาพปก persona ที่ active อยู่จะถูก inject เข้าไปใน AI system prompt โดยอัตโนมัติ ทำให้การตอบกลับเป็น personalized โดยไม่ต้องแก้ prompt เอง

### World Builder

คำนิยามโลกร่วม (shared world definition) ประกอบด้วย ชื่อโลก, lore และ immutable facts จะถูก inject เข้าไปใน system prompt ทุกครั้ง ทำให้บริบทการเล่าเรื่องสอดคล้องกันในทุกตัวละครและทุกเซสชัน

### Context Optimizer

extractive history compressor จะตัดประวัติบทสนทนาให้อยู่ใน token budget ที่ตั้งค่าได้ ไม่ต้องเรียก AI เพื่อ summarize — การตัดทำในเครื่องด้วย heuristic จากความยาวสตริง

### Token Budgeting

แยกการควบคุมหน้าต่าง context (input token limit) และความยาวตอบกลับสูงสุด (output token limit) ออกจากกัน ทั้งสองค่าจะถูกบันทึกไว้ข้าม browser session

### การบันทึกบทสนทนา

ในโหมด local ประวัติบทสนทนาบันทึกลงทั้ง `localStorage` และไฟล์ฝั่งเซิร์ฟเวอร์ ในโหมด VPS ประวัติถูกจัดเก็บแยกตาม session โดยอิงจาก header `x-session-id` ทำให้แต่ละผู้ใช้แยกจากกัน

### การส่งออกเรื่องราว

บทสนทนาทั้งหมดสามารถ export เป็นไฟล์ Markdown หรือคัดลอกไปยัง clipboard ได้โดยตรงจากอินเทอร์เฟซ

### รายการโปรด (Favorites)

ตัวละครใดก็ได้สามารถติดดาวได้ ข้อมูล favorites ถูกบันทึกใน `localStorage` และ sync ไปยังเซิร์ฟเวอร์ ไม่ต้องมีบัญชีผู้ใช้

### Composer Toolbar

ปุ่มจัดรูปแบบลัดช่วยให้ผู้ใช้ห่อข้อความด้วย marker คำพูด (`" "`) หรือการกระทำ (`* *`) ได้โดยไม่ต้องพิมพ์เอง ข้อความ roleplay ถูก render ต่างกันอย่างชัดเจน: คำพูดในเครื่องหมายคำพูดจะถูก highlight และข้อความในเครื่องหมายดอกจันจะ render เป็นตัวเอียงแบบ narrative

### เอฟเฟกต์เสียง

เสียง ambiente และเสียงเหตุการณ์ถูก synthesize ตอน runtime ด้วย Web Audio API synthesizer ไม่มีการโหลดหรือแจกจ่ายไฟล์เสียงใดๆ

### Custom Endpoint และ Proxy Manager

สามารถลงทะเบียน hostname ของ proxy ที่รองรับ OpenAI-compatible ได้โดยตรงจาก UI โดยไม่ต้องแก้ไฟล์ config การป้องกัน SSRF บังคับให้ใช้เฉพาะ hostname แบบ HTTPS ฟีเจอร์นี้ใช้ได้เฉพาะโหมด local และ LAN เท่านั้น

---

## ความต้องการของระบบ

- Node.js 20 ขึ้นไป
- API key ที่ถูกต้องสำหรับผู้ให้บริการ AI ที่รองรับอย่างน้อยหนึ่งราย หรือ Ollama ที่รันอยู่ในเครื่อง

---

## การติดตั้ง

### Windows

```cmd
start.cmd
```

`start.cmd` จะแสดง interactive menu สำหรับตั้งค่าและเริ่มต้นระบบ

### Linux / macOS

```sh
chmod +x install-linux.sh start-linux.sh
./install-linux.sh
./start-linux.sh
```

หรือถ้าติดตั้ง Node.js ไว้แล้ว:

```sh
npm start
```

### Docker

```sh
docker compose up -d
```

ข้อมูลบทสนทนาและตัวละครจะถูกบันทึกไว้ใน volume `./data` บนโฮสต์

---

## โหมดการติดตั้งใช้งาน

HushRP รองรับสามโหมด เลือกได้ผ่านตัวแปรสภาพแวดล้อม `RUNTIME_MODE`

### Local

- bind ที่ `127.0.0.1:3000` (loopback เท่านั้น)
- เข้าถึงได้เฉพาะจากเครื่องที่รันเซิร์ฟเวอร์
- ความเป็นส่วนตัวสูงสุด รองรับการป้อน API key ผ่านเบราว์เซอร์

### LAN / Wi-Fi

- bind ที่อินเทอร์เฟซ LAN ของโฮสต์
- เข้าถึงได้จากอุปกรณ์ในเครือข่ายส่วนตัวเดียวกัน (มือถือ, แท็บเล็ต)
- LAN Guard จะปฏิเสธคำขอทั้งหมดที่มาจาก IP ที่ไม่ใช่ RFC 1918 โดยอัตโนมัติ
- รองรับการป้อน API key ผ่านเบราว์เซอร์

### VPS / Cloud

- เหมาะสำหรับติดตั้งไว้หลัง reverse proxy (Nginx, Caddy) ที่ทำ HTTPS termination
- การป้อน API key ผ่านเบราว์เซอร์ถูกปิดโดยอัตโนมัติ
- บังคับใช้การแยกบทสนทนาตาม session ผ่าน `x-session-id`

---

## การตั้งค่า

คัดลอก `.env.example` เป็น `.env` และปรับค่าตามต้องการ

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

| ตัวแปร | คำอธิบาย |
|---|---|
| `PORT` | พอร์ต TCP ที่เซิร์ฟเวอร์ listen |
| `HOST` | ที่อยู่ bind ใช้ `127.0.0.1` สำหรับ local, `0.0.0.0` สำหรับ LAN/VPS |
| `LAN_ONLY` | เมื่อเป็น `true` จะเปิด LAN Guard เพื่อบล็อก IP ที่ไม่ใช่ private |
| `RUNTIME_MODE` | `local`, `lan` หรือ `vps` ควบคุมการเปิดใช้ฟีเจอร์ |
| `AI_API_KEY` | API key ฝั่งเซิร์ฟเวอร์ ไม่ถูกส่งไปยังเบราว์เซอร์ |
| `MAX_INPUT_TOKENS` | token budget ของ context window (ฝั่ง input) |
| `MEMORY_SUMMARY_CHARS` | ค่า threshold ระดับตัวอักษรที่ใช้โดย extractive compressor |
| `MAX_OUTPUT_TOKENS` | ความยาวตอบกลับสูงสุดในหน่วย token |
| `CUSTOM_ENDPOINT_HOSTS` | รายชื่อ hostname ของ proxy ที่อนุญาตเพิ่มเติม (คั่นด้วยจุลภาค) |
| `ALLOW_CLIENT_API_KEYS` | เปิดใช้ API key ที่ผู้ใช้ป้อนผ่านเบราว์เซอร์ในโหมด local/LAN |
| `CLIENT_KEY_HOSTS` | รายชื่อ hostname ที่อนุญาตเมื่อเปิดใช้ browser key |

---

## โครงสร้างโปรเจกต์

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

## ผู้ให้บริการ AI ที่รองรับ

HushRP รองรับผู้ให้บริการทุกรายที่เปิด OpenAI-compatible chat completions API

| ผู้ให้บริการ | หมายเหตุ |
|---|---|
| OpenAI | `api.openai.com` — endpoint เริ่มต้น |
| OpenRouter | เข้าถึงหลายโมเดลผ่าน key เดียว |
| Ollama | inference ในเครื่อง ไม่ต้องใช้ API key |
| Custom endpoint | เพิ่ม hostname ผ่าน UI; บังคับใช้ SSRF protection |

---

## โหมด API Key

### Server Key

API key ถูกเก็บไว้ใน `.env` บนเซิร์ฟเวอร์ และไม่ถูกส่งไปยังเบราว์เซอร์ นี่คือโหมดที่แนะนำสำหรับทุก deployment

### Browser Key

API key ถูกป้อนในเบราว์เซอร์และเก็บไว้ใน memory เท่านั้น จะถูกล้างเมื่อปิดแท็บ โหมดนี้ใช้ได้เฉพาะ deployment แบบ local และ LAN และต้องเปิดใช้อย่างชัดเจนผ่าน `ALLOW_CLIENT_API_KEYS=true`

---

## ความปลอดภัย

| มาตรการ | คำอธิบาย |
|---|---|
| LAN Guard | ปฏิเสธคำขอทั้งหมดจากที่อยู่ที่ไม่ใช่ RFC 1918 เมื่อ `LAN_ONLY=true` |
| SSRF protection | hostname ของ custom endpoint ถูกตรวจสอบ; รับเฉพาะโดเมนแบบ HTTPS เท่านั้น |
| Secure HTTP headers | ตั้งค่า `X-Frame-Options`, `X-Content-Type-Options` และ `Referrer-Policy` ให้ทุก response |
| Rate limiting | จำกัดอัตราคำขอแบบ per-IP ใน memory บน API proxy route |
| Atomic writes | การบันทึก JSON ทั้งหมดใช้ temp-file swap (`safeWriteJson`) เพื่อป้องกันข้อมูลเสียหายเมื่อ crash |
| Repository hygiene | `.gitignore` ตัด `.env`, `data/` และ `uploads/` ออก เพื่อป้องกันการ commit credential หรือข้อมูลโดยไม่ตั้งใจ |

---

## การทดสอบ

ชุดทดสอบใช้ built-in test runner ของ Node.js ไม่ต้องใช้ framework เพิ่มเติม

```sh
node --test
```

สถานะปัจจุบัน: **262 ผ่าน, 0 ล้มเหลว**

| ไฟล์ทดสอบ | ขอบเขตที่ครอบคลุม |
|---|---|
| `test/app.test.js` | HTTP server, AI proxy route, launcher Windows/Linux |
| `test/context.test.js` | Context optimizer, extractive compressor, token heuristic |
| `test/features-v4.test.js` | การสลับ i18n, การ inject persona, favorites, การบันทึกบทสนทนา |
| `test/mobile-menu-smoke.test.js` | Navigation drawer, accessibility attribute |

---

## ภาษาต่างๆ

- [English](README.md)
- [中文 (Chinese)](README_zh.md)

---

## สัญญาอนุญาต

HushRP เผยแพร่ภายใต้ [MIT License](LICENSE)