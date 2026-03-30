# SOP RAG App

> An enterprise-grade **Retrieval-Augmented Generation** platform for Standard Operating Procedures. Upload documents, train a knowledge base, and chat with your SOPs using state-of-the-art AI — all self-hosted.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
  - [Option A — Docker Compose](#option-a--docker-compose-recommended)
  - [Option B — Manual Ubuntu Setup](#option-b--manual-ubuntu-setup)
- [Configuration Reference](#configuration-reference)
- [API Overview](#api-overview)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

---

## Overview

SOP RAG App lets teams upload documents (PDF, DOCX, TXT, CSV) and immediately query them through a conversational AI interface. Documents are chunked, embedded via OpenRouter, and stored as vectors in PostgreSQL using the `pgvector` extension. At query time the system retrieves the most semantically relevant chunks and feeds them as context to an LLM — grounding every answer in your actual documents.

**Key capabilities**

- Upload and manage knowledge base files per project or globally
- Streaming AI responses via Server-Sent Events (SSE)
- Multi-project workspace with per-project prompt customization
- Persistent conversation history
- JWT-authenticated admin UI
- Fully self-hosted — no third-party vector DB required

---

## Architecture

```
┌─────────────────────┐        ┌──────────────────────────────────────┐
│  Vue 3 Frontend     │        │  NestJS Backend                      │
│  (webpack-dev-srv)  │◄──────►│                                      │
│  :8080              │  REST  │  ┌────────────┐  ┌────────────────┐  │
└─────────────────────┘  / SSE │  │  RAG       │  │  Auth / JWT    │  │
                               │  │  Service   │  │  Guard         │  │
                               │  └─────┬──────┘  └────────────────┘  │
                               │        │                              │
                               │  ┌─────▼──────────────────────────┐  │
                               │  │  PostgreSQL 16 + pgvector       │  │
                               │  │                                 │  │
                               │  │  projects  │  bots              │  │
                               │  │  project_files                  │  │
                               │  │  document_chunks (vector 1536)  │  │
                               │  │  conversations                  │  │
                               │  │  users                          │  │
                               │  └─────────────────────────────────┘  │
                               └──────────────────────────────────────┘
                                              │
                               ┌──────────────▼──────────────┐
                               │  OpenRouter API              │
                               │  text-embedding-3-small      │
                               │  gpt-4o (streaming)          │
                               └─────────────────────────────┘
```

**RAG pipeline**

```
Upload → Extract text → Chunk (500 words, 50 overlap)
      → Embed (text-embedding-3-small) → Store vector(1536) in pgvector

Query  → Embed query → ivfflat cosine search (top-5 chunks)
      → Build context prompt → Stream gpt-4o response via SSE
```

---

## Tech Stack

### Backend

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 LTS |
| Framework | NestJS | 11 |
| Language | TypeScript | 5.8 |
| ORM | Sequelize + sequelize-typescript | 6 |
| Database | PostgreSQL | 16 |
| Vector search | pgvector | latest |
| AI SDK | openai (OpenRouter-compatible) | 5 |
| Auth | Passport.js + JWT | — |
| File parsing | pdf-parse, mammoth | — |
| PDF export | wkhtmltopdf | — |
| Validation | class-validator, class-transformer | — |

### Frontend

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Vue 3 (Composition / Options API) | 3.2 |
| Build tool | Vue CLI / webpack-dev-server | 5 |
| State | Vuex | 4 |
| Router | Vue Router | 4 |
| HTTP | Axios | 1 |
| i18n | i18next + i18next-vue | — |
| Icons | FontAwesome 6 | — |
| Notifications | vue-toast-notification | — |
| Styles | SCSS | — |

### Infrastructure

| Component | Technology |
|-----------|-----------|
| Container | Docker + Docker Compose |
| Database image | `pgvector/pgvector:pg16` |
| Process manager (optional) | PM2 |

---

## Prerequisites

**Docker path** (recommended)
- Docker Engine ≥ 24
- Docker Compose v2 (`docker compose` subcommand)

**Manual path**
- Ubuntu 22.04 / 24.04
- Node.js 20 LTS
- PostgreSQL 16 with the `postgresql-16-pgvector` package
- `wkhtmltopdf` system binary

**Both paths**
- An [OpenRouter](https://openrouter.ai) API key with credits for:
  - `openai/text-embedding-3-small`
  - `openai/gpt-4o`

---

## Getting Started

### Option A — Docker Compose (recommended)

```bash
# 1. Clone the repository
git clone <repo-url>
cd SOP-RAG-app

# 2. Configure the backend
cp ai-bots-admin-main/.env.example ai-bots-admin-main/.env
```

Edit `ai-bots-admin-main/.env` — at minimum set:

```dotenv
OPENROUTER_API_KEY=sk-or-...        # your OpenRouter key
JWT_SECRET=a-long-random-string     # change this
# DB_HOST is automatically overridden to "db" by docker-compose.yml
```

```bash
# 3. Configure the frontend
cp MackFAQ-front-main/.env.example MackFAQ-front-main/.env
```

Edit `MackFAQ-front-main/.env`:

```dotenv
VUE_APP_API_HOST=http://localhost:3000   # backend URL as seen from the browser
VUE_APP_API_BOT_ID=                      # leave blank for now (see note below)
VUE_APP_TITLE=SOP RAG App
```

```bash
# 4. Build and start all services
docker compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend API | http://localhost:3000 |
| PostgreSQL | localhost:5432 (internal only) |

> **First-run note — VUE_APP_API_BOT_ID**
>
> After the stack is running, log in to the admin UI, navigate to **Bots**, and create a bot. Copy its UUID, paste it into `MackFAQ-front-main/.env` as `VUE_APP_API_BOT_ID`, then rebuild the frontend:
>
> ```bash
> docker compose up --build frontend
> ```

**Stopping and data persistence**

```bash
docker compose down          # stop containers, keep volumes
docker compose down -v       # stop + delete all data volumes
```

---

### Option B — Manual Ubuntu Setup

#### 1. System packages

```bash
sudo apt update
sudo apt install -y curl git build-essential wkhtmltopdf \
    postgresql-16 postgresql-16-pgvector

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

node --version   # should print v20.x.x
```

#### 2. PostgreSQL

```bash
sudo systemctl enable --now postgresql

sudo -u postgres psql <<SQL
CREATE DATABASE "ai-admin";
ALTER USER postgres WITH PASSWORD 'postgres';
SQL
```

> The `vector` extension is enabled automatically by the backend on first startup.

#### 3. Backend

```bash
cd ai-bots-admin-main

# Environment
cp .env.example .env
nano .env   # set OPENROUTER_API_KEY, JWT_SECRET, DB_HOST=localhost

# Install and build
npm install
npm run build

# Runtime directories
mkdir -p storage conversations conversations-metadata

# Start
node dist/main
# → NestJS listening on port 3000
```

**Persistent process with PM2**

```bash
npm install -g pm2
pm2 start dist/main.js --name sop-backend
pm2 save
pm2 startup   # follow the printed command to enable on boot
```

#### 4. Frontend

```bash
cd ../MackFAQ-front-main

cp .env.example .env
nano .env
# VUE_APP_API_HOST=http://<server-ip>:3000
# VUE_APP_API_BOT_ID=<uuid-from-bot-create>

npm install
npm run serve
# → webpack-dev-server on 0.0.0.0:8080
```

Open `http://<server-ip>:8080` in your browser.

---

## Configuration Reference

### Backend — `ai-bots-admin-main/.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DB_USER` | yes | `postgres` | PostgreSQL username |
| `DB_PASSWORD` | yes | `postgres` | PostgreSQL password |
| `DB_DATABASE` | yes | `ai-admin` | Database name |
| `DB_HOST` | yes | `localhost` | DB host (`db` when using Docker Compose) |
| `DB_PORT` | yes | `5432` | DB port |
| `DB_DIALECT` | yes | `postgres` | Always `postgres` |
| `JWT_SECRET` | yes | — | Secret for signing JWT tokens — **must be changed** |
| `JWT_EXPIRY` | no | `3600s` | JWT token TTL |
| `PUBLIC_FILES_STORAGE` | yes | `storage/` | Path for uploaded file storage |
| `CONVERSATIONS_FOLDER_PATH` | yes | `conversations/` | Path for conversation JSON files |
| `CONVERSATIONS_METADATA_FOLDER_PATH` | yes | `conversations-metadata/` | Path for conversation metadata |
| `OPENROUTER_API_KEY` | yes | — | OpenRouter API key (get at openrouter.ai/keys) |
| `PORT` | no | `3000` | Backend HTTP port |

### Frontend — `MackFAQ-front-main/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `VUE_APP_API_HOST` | yes | Backend URL **as seen from the browser** (e.g. `http://192.168.1.10:3000`) |
| `VUE_APP_API_BOT_ID` | yes | UUID of the bot record — create via admin UI after first run |
| `VUE_APP_TITLE` | no | Browser tab / page title |
| `VUE_APP_FAVICON` | no | Path to favicon file |
| `VUE_APP_BACKGROUND_VIDEO` | no | Path to background video asset |

> **Important:** `VUE_APP_API_HOST` must be the address the **browser** uses to reach the backend — not the Docker internal hostname. On a remote server use `http://<public-ip>:3000`.

---

## API Overview

All endpoints are served by the NestJS backend at port `3000`. JWT Bearer token required unless noted.

### Authentication — `/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/auth/login` | Public | Login, returns JWT |
| `POST` | `/auth/register` | Public | Register new user |

### Chat / RAG — `/api`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/complete` | Bot key | Stream SSE tokens for a prompt (RAG) |
| `GET` | `/api/conversation-history` | Public | Get messages for a conversation |
| `GET` | `/api/list-of-conversations` | JWT | List all conversations |
| `POST` | `/api/upload-file` | JWT | Upload file and ingest into vector store |
| `POST` | `/api/train-files` | JWT | Trigger embedding for uploaded files |
| `POST` | `/api/clear-memory` | Public | Delete a conversation |
| `GET` | `/api/bot-prompt` | JWT | Get bot configuration |

### Knowledge Base — `/openai-knowledge`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/openai-knowledge/upload/:projectId` | JWT | Upload file to project knowledge base |
| `POST` | `/openai-knowledge/upload/general` | JWT | Upload file to global knowledge base |
| `GET` | `/openai-knowledge/files/:projectId` | Public | List files for a project |
| `POST` | `/openai-knowledge/train/:projectId` | JWT | Embed all uploaded files for a project |
| `DELETE` | `/openai-knowledge/file/:projectId/:fileId` | Public | Delete a file |
| `POST` | `/openai-knowledge/retry-train/:projectId` | Public | Retry failed embeddings |

### Projects — `/projects`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/projects` | JWT | List all projects for user |
| `POST` | `/projects` | JWT | Create project |
| `PUT` | `/projects/:id` | JWT | Update project |
| `DELETE` | `/projects/:id` | JWT | Delete project |

### Bots — `/bots`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/bots` | JWT | List bots |
| `POST` | `/bots` | JWT | Create bot |
| `PUT` | `/bots/:id` | JWT | Update bot configuration |
| `DELETE` | `/bots/:id` | JWT | Delete bot |

---

## Database Schema

All tables are auto-created via `sequelize.sync({ alter: true })` on startup. The `vector` column is added via raw SQL post-sync.

```
users
├── id          UUID PK
├── email       STRING
└── password    STRING (bcrypt)

bots
├── id                     UUID PK
├── user_id                UUID → users
├── prompt_prefix          STRING(3024)
├── greeting_message_text  STRING
├── model_name             STRING
└── ...config fields

projects
├── id            UUID PK
├── user_id       UUID → users
├── name          STRING
├── prompt_prefix STRING(3024)
└── public_link   STRING (indexed)

project_files
├── id          UUID PK
├── project_id  UUID (nullable → global)
├── user_id     UUID → users
├── filename    STRING
├── file_type   STRING
├── status      ENUM(uploaded|processing|completed|failed)
└── shared      BOOLEAN

document_chunks
├── id           UUID PK
├── file_id      UUID → project_files
├── project_id   UUID (nullable)
├── user_id      UUID → users
├── chunk_text   TEXT
├── chunk_index  INTEGER
└── embedding    vector(1536)  ← pgvector column, ivfflat cosine index

conversations  (JSON file-backed via filesystem)
```

---

## Project Structure

```
SOP-RAG-app/
├── docker-compose.yml
├── README.md
│
├── ai-bots-admin-main/          # NestJS backend
│   ├── Dockerfile
│   ├── .env.example
│   ├── src/
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   ├── api/                 # Chat / streaming / file upload
│   │   ├── auth/                # JWT + Passport
│   │   ├── bots/                # Bot CRUD
│   │   ├── conversations/       # Conversation persistence
│   │   ├── database/            # Sequelize setup + pgvector init
│   │   ├── identity/            # User identity helpers
│   │   ├── messages/            # Message models
│   │   ├── openai-knowledge/    # File upload, train, retry
│   │   ├── projects/            # Project CRUD + management
│   │   ├── rag/                 # Embedding, chunking, vector search, streaming
│   │   └── users/               # User CRUD
│   ├── storage/                 # Uploaded file storage (gitignored)
│   ├── conversations/           # Conversation JSON files (gitignored)
│   └── conversations-metadata/  # Metadata (gitignored)
│
└── MackFAQ-front-main/          # Vue 3 frontend
    ├── Dockerfile
    ├── .env.example
    ├── vue.config.js
    └── src/
        ├── views/               # Auth, Chat, Projects, Train, ChatsHistory
        ├── components/          # Nav, QAEditor, Modals, Conversations
        ├── store/               # Vuex store
        ├── router/              # Vue Router
        └── axios.js             # Configured Axios instance
```

---

## Troubleshooting

**HMR websocket fails in browser / `Invalid Host header`**

The `vue.config.js` is already patched with `allowedHosts: 'all'` and `webSocketURL: 'auto://0.0.0.0:0/ws'`. Ensure port `8080` is reachable from your browser. If behind a proxy, configure it to forward the `Upgrade` header.

---

**`CREATE EXTENSION vector` fails on startup**

The pgvector extension is not installed in your Postgres instance.

- **Ubuntu manual:** `sudo apt install -y postgresql-16-pgvector` then restart postgres.
- **Docker:** Use the `pgvector/pgvector:pg16` image (already set in `docker-compose.yml`).

---

**`ERROR: relation "document_chunks" does not exist`**

The backend runs `sequelize.sync({ alter: true })` on startup — tables are created in order. This error should not persist past the first successful boot. If it does, check that Postgres is healthy before the backend starts (`depends_on: db: condition: service_healthy` handles this in Docker Compose).

---

**OpenRouter 401 or embedding model errors**

1. Verify `OPENROUTER_API_KEY` is set in `ai-bots-admin-main/.env`.
2. Confirm your account has credits for `openai/text-embedding-3-small` and `openai/gpt-4o` at [openrouter.ai](https://openrouter.ai).

---

**`wkhtmltopdf: command not found`**

- **Ubuntu:** `sudo apt install -y wkhtmltopdf`
- **Docker:** Already installed in `ai-bots-admin-main/Dockerfile`.

---

**Frontend can't reach the backend**

`VUE_APP_API_HOST` is baked into the Vue build at **compile time** (webpack env injection). It must be the URL your **browser** can reach — not an internal Docker hostname like `backend`. For a remote server use `http://<public-ip>:3000`. After changing `.env`, rebuild the frontend container.

---

**Port conflicts**

| Port | Owner | How to change |
|------|-------|---------------|
| 8080 | Frontend | `devServer.port` in `vue.config.js` + `ports` in `docker-compose.yml` |
| 3000 | Backend | `PORT` in `.env` + `ports` in `docker-compose.yml` |
| 5432 | PostgreSQL | `DB_PORT` in `.env` + `ports` in `docker-compose.yml` |

---

## Contributing

1. Fork the repository and create a feature branch from `main`.
2. Follow the existing code style (Prettier + ESLint config is included).
3. Open a pull request with a clear description of what changed and why.

For bugs, open an issue with reproduction steps, Node/OS version, and relevant logs.
