# SOP RAG App

A RAG (Retrieval-Augmented Generation) platform for Standard Operating Procedures, powered by OpenRouter, PostgreSQL + pgvector, NestJS, and Vue 3.

| Component | Tech | Port |
|-----------|------|------|
| Frontend | Vue 3 (webpack-dev-server) | 8080 |
| Backend | NestJS | 3000 |
| Database | PostgreSQL 16 + pgvector | 5432 |
| AI | OpenRouter (OpenAI-compatible) | — |

---

## Option A — Docker Compose (recommended)

### Prerequisites

- Docker Engine ≥ 24
- Docker Compose v2 (`docker compose` command)

### Steps

```bash
# 1. Clone
git clone <repo-url>
cd SOP-RAG-app

# 2. Backend env
cp ai-bots-admin-main/.env.example ai-bots-admin-main/.env
# Edit ai-bots-admin-main/.env — set OPENROUTER_API_KEY and a strong JWT_SECRET
# Leave DB_HOST=localhost; docker-compose.yml overrides it to "db" at runtime

# 3. Frontend env
cp MackFAQ-front-main/.env.example MackFAQ-front-main/.env
# VUE_APP_API_HOST=http://localhost:3000  (leave as-is for local Docker)
# VUE_APP_API_BOT_ID — fill in after first run (see note below)

# 4. Start everything
docker compose up --build
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:3000

> **VUE_APP_API_BOT_ID** — on first run, log in to the admin UI, create a bot, copy its UUID, paste it into `MackFAQ-front-main/.env`, then `docker compose up --build frontend`.

---

## Option B — Manual Ubuntu setup (no Docker)

Tested on Ubuntu 22.04 / 24.04.

### 1. System packages

```bash
sudo apt update
sudo apt install -y curl git build-essential wkhtmltopdf \
    postgresql-16 postgresql-16-pgvector

# Node.js 20 via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. PostgreSQL

```bash
sudo systemctl start postgresql
sudo systemctl enable postgresql

sudo -u postgres psql <<'SQL'
CREATE DATABASE "ai-admin";
-- postgres superuser already exists; set password if needed:
ALTER USER postgres WITH PASSWORD 'postgres';
SQL
```

> pgvector extension is created automatically by the backend on first start (`CREATE EXTENSION IF NOT EXISTS vector`).

### 3. Backend

```bash
cd ai-bots-admin-main

cp .env.example .env
# Edit .env:
#   DB_HOST=localhost
#   OPENROUTER_API_KEY=<your-key>
#   JWT_SECRET=<random-string>

npm install
npm run build
mkdir -p storage conversations conversations-metadata
node dist/main
# Backend is now running on port 3000
```

For a persistent process:
```bash
npm install -g pm2
pm2 start dist/main.js --name sop-backend
pm2 save && pm2 startup
```

### 4. Frontend

```bash
cd ../MackFAQ-front-main

cp .env.example .env
# Edit .env:
#   VUE_APP_API_HOST=http://<server-ip>:3000
#   VUE_APP_API_BOT_ID=<bot-uuid-from-db>

npm install
npm run serve
# Dev server on 0.0.0.0:8080
```

Open `http://<server-ip>:8080` in your browser.

---

## Environment variables reference

### Backend (`ai-bots-admin-main/.env`)

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_USER` | Postgres user | `postgres` |
| `DB_PASSWORD` | Postgres password | `postgres` |
| `DB_DATABASE` | Database name | `ai-admin` |
| `DB_HOST` | Postgres host | `localhost` |
| `DB_PORT` | Postgres port | `5432` |
| `DB_DIALECT` | Always `postgres` | `postgres` |
| `JWT_SECRET` | Secret for signing JWTs | **must change** |
| `JWT_EXPIRY` | Token TTL | `3600s` |
| `PUBLIC_FILES_STORAGE` | Upload storage path | `storage/` |
| `CONVERSATIONS_FOLDER_PATH` | Conversations path | `conversations/` |
| `CONVERSATIONS_METADATA_FOLDER_PATH` | Metadata path | `conversations-metadata/` |
| `OPENROUTER_API_KEY` | OpenRouter API key | **required** |
| `PORT` | Backend listen port | `3000` |

### Frontend (`MackFAQ-front-main/.env`)

| Variable | Description |
|----------|-------------|
| `VUE_APP_API_HOST` | Backend URL as seen **from the browser** |
| `VUE_APP_API_BOT_ID` | UUID of the bot record in the database |
| `VUE_APP_TITLE` | Page title |

---

## Ports that must be open

| Port | Service |
|------|---------|
| 8080 | Vue frontend |
| 3000 | NestJS backend |
| 5432 | PostgreSQL (internal only — do not expose publicly) |

---

## Troubleshooting

**HMR websocket fails / `Invalid Host header`**
- `vue.config.js` already sets `allowedHosts: 'all'` and `webSocketURL: 'auto://...'`.
- Ensure port 8080 is reachable from your browser.

**`relation "document_chunks" does not exist`**
- The backend runs `sequelize.sync({ alter: true })` on startup which creates all tables. Wait for the `🚀 Starting NestJS application...` log, then the DB init queries run immediately after.

**`CREATE EXTENSION vector` fails**
- Ubuntu: confirm `postgresql-16-pgvector` is installed: `dpkg -l | grep pgvector`
- Docker: the `pgvector/pgvector:pg16` image includes the extension automatically.

**`wkhtmltopdf` not found**
- Ubuntu: `sudo apt install -y wkhtmltopdf`
- Docker: already installed in the backend `Dockerfile`.

**OpenRouter 401 / model errors**
- Verify `OPENROUTER_API_KEY` in `ai-bots-admin-main/.env`.
- The key must have credits for `openai/text-embedding-3-small` and `openai/gpt-4o`.
