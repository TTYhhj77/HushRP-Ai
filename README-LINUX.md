# คู่มือการติดตั้ง HushRP บน Linux

> เอกสารนี้มุ่งเน้นการติดตั้งบน Linux / macOS เป็นหลัก หากต้องการข้อมูลทั่วไป โหมดการใช้งาน และรายละเอียดอื่นๆ โปรดดูที่ [README.md](README.md) หลัก

> **หมายเหตุสำคัญ**: browser API key ปิดเป็นค่าเริ่มต้น; โหมด VPS บังคับปิดเสมอ

เครื่องส่วนตัว/เครือข่าย LAN อาจเปิด `ALLOW_CLIENT_API_KEYS=true` ใน `.env` ให้ผู้ใช้กรอกคีย์ในแท็บเองได้ คีย์ส่งผ่าน Hush backend และอยู่ในหน่วยความจำของแท็บ แต่ไม่บันทึกลง storage; การใช้ key ใน browser ยังเสี่ยงกว่า server-key ให้ใช้เฉพาะเครือข่ายส่วนตัวที่เชื่อถือได้และ provider ที่กำหนดใน `CLIENT_KEY_HOSTS`. Launcher ตั้ง `RUNTIME_MODE=vps` สำหรับโหมด VPS และ server จะบังคับปิด browser-key เสมอ.

เครื่องส่วนตัว/เครือข่าย LAN อาจเปิด `ALLOW_CLIENT_API_KEYS=true` ใน `.env` ให้ผู้ใช้กรอกคีย์ในแท็บเองได้ คีย์ส่งผ่าน Hush backend และอยู่ในหน่วยความจำของแท็บ แต่ไม่บันทึกลง storage; การใช้ key ใน browser ยังเสี่ยงกว่า server-key ให้ใช้เฉพาะเครือข่ายส่วนตัวที่เชื่อถือได้และ provider ที่กำหนดใน `CLIENT_KEY_HOSTS`. Launcher ตั้ง `RUNTIME_MODE=vps` สำหรับโหมด VPS และ server จะบังคับปิด browser-key เสมอ.

การดึงรายชื่อโมเดลจาก OpenAI-compatible API ใช้รายการ `/models` ของ provider; สำหรับ custom endpoint ต้องกำหนด host ไว้ใน `CUSTOM_ENDPOINT_HOSTS`. หาก API ใช้ schema เฉพาะหรือไม่เปิด models endpoint ให้กรอก model ID เอง. Ollama ใช้ `/api/models` บนเครื่อง Hush.

รองรับ Linux ที่มี Node.js 20+ หรือ Docker Engine + Compose plugin (เช่น Ubuntu/Debian)

## วิธีง่ายสุด: Docker Compose

คัดลอกโฟลเดอร์โปรเจกต์ไปยังเครื่อง Linux แล้วรัน:

คัดลอกโฟลเดอร์โปรเจกต์ไปยังเครื่อง Linux แล้วรัน:

```bash
cd HushRP
cp .env.example .env
chmod 600 .env
nano .env                 # ตั้ง AI_API_KEY ถ้าจะใช้แชตจริง
# ค่าเริ่มต้นเปิดเฉพาะ 127.0.0.1:3000; ไม่เปิดพอร์ตสู่ public
docker compose up -d --build
docker compose logs -f
```

หยุด: `docker compose down`. ข้อมูลตัวละครและรูปเก็บใน `./data` และคงอยู่เมื่อ container restart

> **สำรองข้อมูล**: จัดเก็บ `./data` และ `.env` เป็นระยะ ตัวอย่าง:
> ```bash
> tar -czf hushrp-backup-$(date +%F).tar.gz data/ .env
> ```

### สำหรับบ้าน / Wi-Fi ภายในเท่านั้น

แก้ `.env` ให้มี `BIND_ADDRESS=0.0.0.0` และ `LAN_ONLY=true`, เปิด firewall เฉพาะวง private, จากนั้น `docker compose up -d`. ไม่ต้องตั้ง router port-forwarding และห้ามเปิดบริการนี้ผ่าน public IP โดยตรง

## วิธีติดตั้งแบบไม่ใช้ Docker

```bash
cd HushRP
chmod +x install-linux.sh
./install-linux.sh
```

เมนูมี local-only, LAN ในเครือข่ายบ้าน, VPS หลัง HTTPS proxy, แก้ `.env`, และรันทดสอบ ตัวช่วยสร้าง `.env` และ data folder ให้เอง หาก Node.js ยังไม่มี ให้ติดตั้ง **Node.js 20+** ก่อน; Ubuntu/Debian บางรุ่นมีแพ็กเกจ Node เก่า ให้ใช้ Node.js LTS จากแหล่งทางการหรือ NodeSource แล้วตรวจ `node --version`.

## VPS / public website

เลือกเมนู VPS หรือใช้ Docker โดยคง bind address เป็น `127.0.0.1`; วาง **Caddy** หรือ **Nginx** ที่มี HTTPS ด้านหน้า ใช้โดเมนถ้ามี ไม่เช่นนั้นต้องตั้งใบรับรอง IP และระบบต่ออายุอัตโนมัติที่รองรับ **ห้ามเปิด Node HTTP port สู่ public โดยตรง**

### ตัวอย่าง reverse proxy

- ดูตัวอย่าง Nginx / Caddy / compose.yaml ได้ที่ [README.md](README.md#reverse-proxy-examples)
- ใช้โดเมน + HTTPS อย่าลืมตั้ง `RUNTIME_MODE=vps` และตรวจสอบ `LAN_ONLY=false`

### ก่อนเปิดให้คนอื่นใช้

- เพิ่มการป้องกันเข้าถึง (AUTH_TOKEN) และแยกข้อมูลรายผู้ใช้ถ้าจำเป็น
- ตั้ง rate limiting, สำรอง `data/` เป็นระยะ
- ตรวจสอบ logging / monitoring และข้อกำหนด AI provider
- แอปปัจจุบันเป็น single-process JSON storage สำหรับใช้ส่วนตัวหรือกลุ่มเล็กเท่านั้น
