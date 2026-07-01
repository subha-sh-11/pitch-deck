# Team Setup — Pitch Deck (local development)

Get the whole stack running locally in ~10 minutes. Everything (DB, cache, object storage)
runs in Docker; the backend and frontend run on your host.

> Architecture overview: see [ARCHITECTURE_FLOW.md](./ARCHITECTURE_FLOW.md).

---

## 0. Prerequisites

Install these first:

| Tool | Version | Link |
|---|---|---|
| **Docker Desktop** | latest | https://www.docker.com/products/docker-desktop/ |
| **Node.js** | 20+ | https://nodejs.org |
| **Python** | 3.11+ | https://www.python.org/downloads/ |
| **Git** | latest | https://git-scm.com |

Verify:
```bash
docker --version && docker compose version
node --version && npm --version
python --version
```

---

## 1. Clone & configure        

```bash
git clone <REPO_URL> PD
cd PD

# Backend config: copy the template, then edit if needed
cp backend/.env.example backend/.env

# Frontend config is optional (defaults to the local backend)
cp frontend/.env.local.example frontend/.env.local   # optional
```

> **Windows PowerShell:** use `Copy-Item backend/.env.example backend/.env` instead of `cp`.

Open `backend/.env` and set what you need:
- AI keys are **optional** — leave blank to run with offline/placeholder fallbacks. Add
  `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` for real text, and set `IMAGE_PROVIDER=fal` +
  `FAL_KEY` (or `vertex`) for real images.

---

## 2. Start infrastructure (Docker)

You have two choices for the **database**:

- **A — Local per-person DB** (default): each teammate runs their own Postgres in Docker.
  Simple, isolated, no shared state.
- **B — Shared cloud DB** (team): everyone points at one cloud Postgres, so all of you see
  the same projects/decks. See [Shared cloud database](#-shared-cloud-database-team) below.

```bash
# Option A — local Postgres (:5432), Redis (:6379), Floci S3 emulator (:4566)
docker compose up -d postgres redis floci

# Option B — using a cloud DB? skip postgres, just bring up the rest:
docker compose up -d redis floci

# Check they're healthy
docker compose ps
```

> `minio` also exists in compose as an alternative S3 — you don't need it; `floci` is the
> default S3 endpoint in `.env`. Don't run both.

---

## 🌐 Shared cloud database (team)

Want the whole team on the **same data**? Point every machine at one cloud Postgres instead
of the local Docker one.

1. **Provision Postgres with the `pgvector` extension** — the app needs it. Managed options
   that support it: **Neon**, **Supabase**, **Railway**, **AWS RDS**. After creating the DB,
   enable the extension once: `CREATE EXTENSION IF NOT EXISTS vector;`
2. **Everyone sets the SAME connection URLs** in their `backend/.env` (share the string
   privately — a password manager, **never** the repo):
   ```env
   DATABASE_URL=postgresql+asyncpg://USER:PASS@HOST:5432/DBNAME
   DATABASE_URL_SYNC=postgresql+psycopg2://USER:PASS@HOST:5432/DBNAME?sslmode=require
   ```
   Most cloud Postgres **requires SSL** — keep `?sslmode=require` on the sync URL. If asyncpg
   complains about SSL, add `?ssl=require` to `DATABASE_URL` too.
3. **One person runs the migrations once** (the schema is shared — the rest skip this):
   ```bash
   cd backend && alembic upgrade head
   ```
4. **Skip the local Postgres container** — use `docker compose up -d redis floci` (Option B above).

> ⚠️ **Images are still per-machine.** The DB is shared, but generated images are stored in
> each person's **local** Floci/MinIO and served from *their* `localhost:8000`. So you'll all
> see each other's projects and text, but an image generated on one laptop **won't load on
> another**. For fully shared decks, also use a **shared object store** (real AWS S3, or one
> shared MinIO) — set the same `S3_ENDPOINT` / `S3_KEY` / `S3_SECRET` / `S3_BUCKET` for
> everyone, and a `PUBLIC_BASE_URL` all machines can reach.

---

## 3. Backend (FastAPI)

```bash
cd backend
python -m venv .venv

# Activate the venv:
#   macOS/Linux:  source .venv/bin/activate 
#   Windows PS:   .venv\Scripts\Activate.ps1
#   Windows bash: source .venv/Scripts/activate

pip install -r requirements.txt

# Run DB migrations (creates tables incl. the auth columns)
alembic upgrade head

# Start the API
uvicorn app.main:app --reload --port 8000
```

API is now at **http://localhost:8000** · docs at **http://localhost:8000/docs**

> **Celery:** not needed for local dev — `CELERY_EAGER=true` runs generation jobs inline.
> If you want a real worker (needs Redis): `celery -A app.workers.celery_app:celery_app worker -l info`

---

## 4. Frontend (Next.js)

In a **new terminal**:
```bash
cd frontend
npm install
npm run dev
```

App is now at **http://localhost:3000**

---

## Daily use

```bash
# Start
docker compose up -d postgres redis floci
# (then run uvicorn + npm run dev in their folders)

# Stop infra
docker compose stop

# Full reset (wipes DB + storage volumes!)
docker compose down -v
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `connection refused :5432` | Postgres container isn't up → `docker compose up -d postgres` |
| `column ... does not exist` | Run `alembic upgrade head` in `backend/` |
| Images show as plain SVG placeholders | `IMAGE_PROVIDER=none` or no key → set `IMAGE_PROVIDER=fal` + `FAL_KEY` (or `vertex`) |
| Changed `.env` but nothing changed | Restart `uvicorn` — env is read at startup |
| `aws s3 ls` to inspect Floci | `AWS_ENDPOINT_URL=http://localhost:4566 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws s3 ls` |

---

## Security notes (please read)

- **Never commit `backend/.env`** — it holds real secrets. Only `*.env.example` are committed.
- The Floci container is **not** given Docker socket access (S3 only) — safe by default.
