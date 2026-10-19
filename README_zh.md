# HushRP

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-blue.svg)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-262%20passing-success.svg)](test/)

HushRP 是一款可自托管的 AI 角色扮演 Web 应用，完全基于纯 Node.js 构建，运行时零 npm 依赖。它面向最高级别的隐私与可移植性设计：无数据库守护进程、无构建步骤、无打包器。整个前端以单个 HTML 文件交付。所有持久化状态均以原子性 JSON 文件形式存储在主机文件系统上。

---

## 目录

- [核心特性](#核心特性)
- [环境要求](#环境要求)
- [安装](#安装)
- [部署模式](#部署模式)
- [配置](#配置)
- [项目结构](#项目结构)
- [AI 提供商支持](#ai-提供商支持)
- [API 密钥模式](#api-密钥模式)
- [安全机制](#安全机制)
- [反向代理示例](#反向代理示例)
- [Troubleshooting](#troubleshooting)
- [测试](#测试)
- [其他语言](#其他语言)
- [许可证](#许可证)

---

## 核心特性

### 零依赖

HushRP 仅使用 Node.js 内置模块（`http`、`fs`、`crypto`、`path`、`os`）。无任何运行时 npm 包、无打包器、无构建流水线。部署所需环境仅为一个 Node.js 20+ 运行时。

### 多语言界面 (i18n)

界面支持**泰语、英语、中文**，覆盖全部 UI 字符串（100%）。语言切换动态生效，无需刷新页面。**自定义语言创建器**允许用户上传 JSON 字典文件，将界面扩展至任意语言。项目内附一份日语示例字典作为参考。

### 角色工作室 (Character Studio)

通过应用内编辑器创建与管理角色。每条角色记录包含：姓名、角色定位、外貌描述、系统提示词、开场消息、类型标签、成人内容标记、封面图、背景图。所有角色操作（创建、编辑、删除）均在应用内完成。

### 玩家 Persona 与多配置文件

用户可定义多个命名 Persona，每个包含：姓名、角色定位、外貌、背景故事、头像、封面图。当前激活的 Persona 会自动注入 AI 系统提示词，无需手动编辑提示词即可个性化回复。

### 世界构建器 (World Builder)

共享世界定义由**世界名称、传说 (lore)、不可变事实 (immutable facts)** 三部分组成，会自动注入每次系统提示词。这保证所有角色与会话共享一致的叙事背景。

### 上下文优化器

提取式历史压缩器将对话历史裁剪至可配置的 token 预算范围内。压缩无需 AI 调用；裁剪使用基于字符串长度的启发式规则在本地完成。

### Token 预算

**输入上下文窗口（input token limit）** 与 **最大回复长度（output token limit）** 分别独立控制。两项设置均跨浏览器会话持久化。

### 对话持久化

- **本地模式**：对话历史同时保存至 `localStorage` 与服务器端文件。
- **VPS 模式**：历史按 `x-session-id` 请求头分会话存储，实现用户间会话隔离。

### 故事导出

完整对话可导出为 Markdown 文件，或直接从界面复制到剪贴板。

### 收藏

任意角色可加星标。收藏数据持久化于 `localStorage` 并同步至服务器。无需用户账号。

### 编辑器工具栏 (Composer Toolbar)

快捷格式化按钮允许一键将选中文字包裹为**对话**（`" "`）或**动作**（`* *`），无需手动输入标记。角色扮演文本以差异化方式渲染：引号内对话高亮显示，星号内文本渲染为叙事斜体。

### 音效

环境音与事件音效在运行时由 **Web Audio API 合成器**生成。不加载也不分发任何音频文件。

### 自定义端点与代理管理器

自定义 OpenAI 兼容代理主机名可直接在 UI 中注册，无需修改配置文件。SSRF 防护强制仅允许 HTTPS 主机名。**此功能仅在本地与局域网模式下可用**。

---

## 环境要求

- Node.js 20 或更高版本
- 至少一个受支持 AI 提供商的有效 API 密钥，或本地运行的 Ollama 实例

---

## 安装

### Windows

```cmd
start.cmd
```

`start.cmd` 会呈现一个**交互式菜单**，用于配置与启动。

### Linux / macOS

```sh
chmod +x install-linux.sh start-linux.sh
./install-linux.sh
./start-linux.sh
```

或者，如果已安装 Node.js：

```sh
npm start
```

### Docker

```sh
docker compose up -d
```

对话与角色数据持久化于主机上的 `./data` 卷中。

---

## 部署模式

HushRP 支持三种部署模式，通过 `RUNTIME_MODE` 环境变量选择。

### 本地 (Local)

- 绑定至 `127.0.0.1:3000`（仅回环）。
- 仅可从运行服务器的本机访问。
- 隐私最高。支持浏览器端 API 密钥输入。

### 局域网 / Wi-Fi (LAN)

- 绑定至主机的局域网接口。
- 可从同一私有网络内的设备访问（手机、平板）。
- **LAN Guard 自动拒绝来自非 RFC 1918 地址的所有请求**。
- 支持浏览器端 API 密钥输入。

### VPS / 云端

- 部署于反向代理（Nginx、Caddy）之后，由反向代理完成 HTTPS 终止。
- 浏览器端 API 密钥输入自动禁用。
- 通过 `x-session-id` 强制实施按会话的聊天隔离。

---

## 配置

将 `.env.example` 复制为 `.env`，按需调整：

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

| 变量 | 说明 |
|------|------|
| `PORT` | 服务监听 TCP 端口 |
| `HOST` | 绑定地址。本地用 `127.0.0.1`；局域网/VPS 用 `0.0.0.0` |
| `LAN_ONLY` | 为 `true` 时启用 LAN Guard 拦截非私有 IP |
| `RUNTIME_MODE` | `local`、`lan` 或 `vps`，控制功能可用性 |
| `AI_API_KEY` | 服务器端 API 密钥，永不传送至浏览器 |
| `MAX_INPUT_TOKENS` | 上下文窗口 token 预算（输入侧） |
| `MEMORY_SUMMARY_CHARS` | 提取式压缩器使用的字符阈值 |
| `MAX_OUTPUT_TOKENS` | 回复最大 token 数 |
| `CUSTOM_ENDPOINT_HOSTS` | 允许的额外代理主机名列表（逗号分隔） |
| `ALLOW_CLIENT_API_KEYS` | 在本地/局域网模式下启用浏览器端密钥 |
| `CLIENT_KEY_HOSTS` | 启用浏览器端密钥时允许的主机名 |

> **数据备份**：直接打包 `./data` 目录即可：
>
> ```sh
> tar -czf hushrp-backup-$(date +%F).tar.gz data/ .env
> ```

---

## 项目结构

```
server.js                       # HTTP 服务、AI 代理、安全、文件持久化
lib/
  context.js                    # 上下文边界、提取式压缩、token 启发式
roleplay-ai-prototype-v3.html   # 单文件前端（HTML + CSS + JS，无构建步骤）
test/
  app.test.js                   # 服务、API 代理与启动器测试
  context.test.js               # 上下文优化器与 token 预算测试
  features-v4.test.js           # i18n、Persona、收藏与聊天持久化测试
  mobile-menu-smoke.test.js     # 可访问性与导航抽屉测试
data/
  characters.json               # 角色数据库
  settings.json                 # 用户设置与模型列表缓存
  chats.json                    # 本地对话历史
  uploads/                      # 角色美术资源
Dockerfile
compose.yaml
start.cmd                       # Windows 交互式启动器
start-linux.sh                  # Linux / macOS 启动器
install-linux.sh                # Linux 依赖安装器
.env.example                    # 配置模板
LICENSE                         # MIT 许可证
```

---

## AI 提供商支持

HushRP 支持任何暴露 **OpenAI 兼容 chat completions API** 的提供商。

| 提供商 | 说明 |
|--------|------|
| OpenAI | `api.openai.com` — 默认端点 |
| OpenRouter | 通过单一密钥访问多家模型 |
| Ollama | 本地推理，无需 API 密钥 |
| 自定义端点 | 通过 UI 添加主机名；强制执行 SSRF 防护 |

---

## API 密钥模式

### 服务器密钥

API 密钥存储于服务器端 `.env` 中，永不传送至浏览器。这是所有部署模式下推荐的方案。

### 浏览器密钥

API 密钥在浏览器中输入，仅保存在内存中。关闭标签页时即清除。此模式**仅在本地与局域网部署下可用**，且必须通过 `ALLOW_CLIENT_API_KEYS=true` 显式启用。

---

## 安全机制

| 机制 | 说明 |
|------|------|
| LAN Guard | `LAN_ONLY=true` 时，拒绝所有非 RFC 1918 地址的请求 |
| SSRF 防护 | 自定义端点主机名校验；仅接受 HTTPS 协议的域名 |
| 安全 HTTP 响应头 | 所有响应设置 `X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy` |
| 速率限制 | API 代理路由上的内存级按 IP 速率限制 |
| 原子写入 | 所有 JSON 持久化均使用临时文件替换（`safeWriteJson`），防止崩溃导致的数据损坏 |
| 仓库卫生 | `.gitignore` 排除 `.env`、`data/`、`uploads/`，防止凭据或数据被意外提交 |

> 若发现安全漏洞，请勿公开提交 Issue，请通过维护者邮箱私下报告。

---

## 反向代理示例

> 以下示例供需要在反向代理之后部署 HushRP 并完成 HTTPS 终止的用户参考，请根据实际环境调整主机名、证书和路径。

### `compose.yaml` 片段

```yaml
services:
  hushrp:
    build: .
    container_name: hushrp
    restart: unless-stopped
    ports:
      - "127.0.0.1:3000:3000"   # 仅绑定本机，由反代对外
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
        proxy_read_timeout 300s;   # 流式回复需要更长超时
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

> 使用反向代理时，请在 `.env` 中设置 `RUNTIME_MODE=vps`，并确保 `LAN_ONLY=false`。

---

## 故障排查 (Troubleshooting)

> 以下常见问题及解决方法供参考。

| 症状 | 可能原因 | 排查/解决 |
|------|----------|-----------|
| `EADDRINUSE` | 端口被占用 | 修改 `PORT`，或用 `lsof -i :3000` / `netstat -ano \| findstr :3000` 定位占用进程 |
| `.env` 不生效 | 修改后未重启 / 路径不对 | `.env` 必须位于启动命令所在目录；修改后重启服务 |
| Ollama 连接失败 | 服务未启动或端口不对 | 确认 `ollama serve` 在运行（默认 `http://127.0.0.1:11434`），且已 `ollama pull <model>` |
| 手机通过局域网打不开 | `HOST` 未设为 `0.0.0.0` 或防火墙拦截 | 检查 `.env` 与系统防火墙；确认 `LAN_ONLY=true` 时所用 IP 属于 RFC 1918 私有网段 |
| 反代返回 502 | 反代连不到后端 / 后端未监听 | 确认后端已启动、`proxy_pass` 地址与 `PORT` 一致 |
| 流式回复被截断 | 反代超时过短 | 加大 `proxy_read_timeout` / `read_timeout` |
| 浏览器端密钥选项灰掉 | 处于 VPS 模式或 `ALLOW_CLIENT_API_KEYS=false` | 切换为 `local` 或 `lan` 模式，并设 `ALLOW_CLIENT_API_KEYS=true` |
| 自定义端点被拒 | 非 HTTPS / 未在 `CUSTOM_ENDPOINT_HOSTS` | 使用 HTTPS 域名，或加入白名单 |
| 上下文被过早截断 | `MAX_INPUT_TOKENS` 太小 | 按模型能力上调（`MEMORY_SUMMARY_CHARS` 可配合调整） |

---

## 测试

测试套件使用 Node.js 内置测试运行器，无需额外测试框架：

```sh
node --test
```

当前状态：**262 通过，0 失败**。

| 测试文件 | 覆盖范围 |
|----------|----------|
| `test/app.test.js` | HTTP 服务、AI 代理路由、Windows/Linux 启动器 |
| `test/context.test.js` | 上下文优化器、提取式压缩器、token 启发式 |
| `test/features-v4.test.js` | i18n 切换、Persona 注入、收藏、聊天持久化 |
| `test/mobile-menu-smoke.test.js` | 导航抽屉、可访问性属性 |

---

## 其他语言

- [English](README.md)
- [ภาษาไทย (Thai)](README_th.md)

---

## 许可证

HushRP 以 [MIT 许可证](LICENSE) 发布。