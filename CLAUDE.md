# CLAUDE.md

Guidance for working in this repository. Read this before making changes.

## What this is

**Pitch Deck** — an AI-powered cinematic pitch deck builder. It turns a one-line idea,
logline, treatment, or full script into a producer-ready 10–15 slide deck for film &
series creators (Telugu-first, expanding pan-India). The flow: adaptive AI intake
conversation → extract/generate narrative + market content → generate cinematic visuals
via diffusion models → user customization → AI structural review → export to PDF / PPTX /
shareable web link.

Monorepo with two apps: `backend/` (FastAPI) and `frontend/` (Next.js), plus
`docker-compose.yml` for local infra and `nginx/` as the reverse proxy.

**Design doctrine:** how decks must look and read (per-film Visual Identity Pack, shot/location
variety, readability, deck pacing, the product flow) lives in `docs/DESIGN_BIBLE.md`. Read it
before touching the AI agents (`backend/app/ai/agents/*`) or slide templates
(`frontend/src/components/slides/*`), and keep those in sync with it.

## Architecture at a glance

```
frontend (Next.js 16 / React 19)  ──HTTP──▶  backend (FastAPI, async)
                                                  │
                          ┌───────────────────────┼────────────────────────┐
                          ▼                        ▼                         ▼
                  Postgres 16 + pgvector      Redis (broker/cache)     S3 / MinIO
                  (decks/slides as JSONB)          │                  (assets, exports)
                                                   ▼
                                          Celery workers
                                  (image gen, exports, review)
                                                   │
                                                   ▼
                              AI agent pipeline (app/ai/agents/*)
                              LLM: Anthropic / OpenAI (provider-agnostic)
                              Images: FLUX/SDXL via fal.ai / Replicate / Google
```

Authoritative deep-dive docs live in `README.md` and `ARCHITECTURE.md` at the repo root.
Keep those in sync when architecture changes.

## Backend (`backend/`)

Python 3.11+, FastAPI (async), SQLAlchemy 2.0 (async runtime, sync for migrations),
Pydantic v2, Celery + Redis, boto3 (S3/MinIO).

Layout under `backend/app/`:
- `main.py` — FastAPI app; mounts routers under `settings.api_v1_prefix` (`/api/v1`).
- `routers/` — HTTP endpoints: `health`, `projects`, `interview`, `decks`, `generate`,
  `jobs`, `assets`, `templates`. `deps.py` holds shared dependencies.
- `schemas/` — Pydantic request/response models (`base`, `deck`, `design`, `intake`,
  `project`, `slide`, `user`).
- `models/` — SQLAlchemy ORM models (`user`, `project`, `deck`, `slide`, `asset`).
  Deck/slide content is stored as **JSONB**, not normalized columns.
- `services/` — business logic (`project_service`, `deck_service`, `generation_service`).
  Routers should stay thin and call services.
- `ai/` — the AI layer:
  - `agents/` — the multi-agent pipeline (see below).
  - `llm.py` — provider-agnostic LLM client (Anthropic / OpenAI), driven by
    `LLM_PROVIDER=auto`.
  - `images.py` — diffusion image generation (fal / replicate / google / none).
  - `ingest.py` — script/treatment parsing (docx, pdf).
  - `tmdb.py` — film metadata lookups. `registers.py`, `templates.py` — style registers.
- `workers/` — Celery: `celery_app.py` (the `celery_app` instance), `tasks.py`,
  `dispatch.py`.
- `core/` — `config.py` (pydantic-settings, reads `.env`), `db.py`, `cache.py`,
  `storage.py`, `rate_limit.py`, `logging.py`.
- `alembic/` — migrations. Uses `settings.sync_database_url` (sync engine), while the app
  runtime uses the async `database_url`.

### AI agent pipeline (order)

`intake → story_analysis → design → outline → content → image_prompt (+ images) → layout → review`

(In code, `design` runs BEFORE `outline`/`content`, and `layout` is applied when slides are
persisted — not as a separate later stage. See `run_full_deck` in `services/generation_service.py`.)

Files present: `intake_interview.py`, `intake_extract.py`, `story_analysis.py`,
`outline.py`, `content.py`, `design.py`, `design_candidates.py`, `image_prompt.py`,
`layout.py`, `slide_edit.py`, and `quality_review.py` (the `review` step — a structural
QA pass stored on `Deck.quality_review`). (`agents/README.md` may use older/idealized
names; trust the actual files on disk.)

## Frontend (`frontend/`)

Next.js **16** (App Router, RSC) / React **19** / TypeScript, Tailwind, shadcn/ui +
Radix, Zustand (editor/UI state) + TanStack Query (server state), Tiptap (slide text),
dnd-kit (reordering), React Hook Form + Zod.

> ⚠️ **This is NOT the Next.js in your training data.** `frontend/AGENTS.md` warns that
> Next 16 has breaking changes. Read the relevant guide in `node_modules/next/dist/docs/`
> before writing frontend code, and heed deprecation notices.

Layout under `frontend/src/`:
- `app/` — routes. Project flow lives at `app/projects/[id]/`: `intake`, `setup/*`
  (`identity`, `pitch`, `body`), `outline`, `content`, `design`, `templates`, `preview`,
  `editor`, `review`, `export`, `story-analysis`, `questions`. Plus `dashboard/` and
  `projects/new/`.
- `features/` — feature modules (the real screens): `setup/` (intake wizard + new chat
  intake), `preview/`, `editor/`, `templates/`, `landing/`, `dashboard/`, `project-new/`.
- `components/` — shared/presentational: `editor/` (DeckEditor, SlideCanvas, toolbars,
  PresentationMode…), `slides/` (`SlideRenderer` + ~14 templates under
  `slides/templates/`), `layout/`, `ui/` (Button, Card, Input, Badge…).
- `lib/` — `api/` (typed clients: `client`, `projects`, `deck`, `generation`,
  `templates`, `intake`), `build-slides`, `regenerate-slide`, `routes`, `workflow`,
  `slide-appearance`.
- `types/` — shared TS types (`deck`, `slide`, `design`, `project`, `setup`, `template`,
  `workflow`).
- `styles/` — feature CSS (`cinematic`, `landing`, `preview-*`, `templates-page`…).

## Local development

Infra (Postgres+pgvector, Redis, floci S3 emulator) via Docker; backend and frontend run
on host. See `SETUP.md` for the full team walkthrough.

```bash
# 1. Infra — floci is the default S3 (:4566); minio (:9000/:9001) is an alt, don't run both
docker compose up -d postgres redis floci   # postgres :5432, redis :6379, floci :4566

# 2. Backend
cp backend/.env.example backend/.env  # PowerShell: Copy-Item backend/.env.example backend/.env
cd backend
python -m venv .venv && .venv\Scripts\activate     # Windows (use source .venv/bin/activate on *nix)
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000          # API at http://localhost:8000

# Celery worker (separate shell) — module is app.workers.celery_app
celery -A app.workers.celery_app:celery_app worker -l info
# Dev shortcut: set CELERY_EAGER=true in .env to run tasks inline without a worker.

# 3. Frontend
cd frontend
npm install
npm run dev                            # http://localhost:3000
```

Frontend scripts: `dev`, `build`, `start`, `lint` (eslint). There is currently no backend
test suite or lint config checked in — confirm before assuming one exists.

## Configuration

Backend config is `backend/app/core/config.py` (pydantic-settings, reads `backend/.env`;
keys are case-insensitive). See `backend/.env.example` for the full list. Notable keys:

- `DATABASE_URL` (async, `postgresql+asyncpg://…`), `DATABASE_URL_SYNC` (optional; alembic
  derives a sync URL otherwise), `REDIS_URL`.
- `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` (blank → fall back to `REDIS_URL`),
  `CELERY_EAGER`.
- `S3_ENDPOINT` / `S3_BUCKET` / `S3_KEY` / `S3_SECRET` / `S3_REGION` (floci defaults:
  `http://localhost:4566`, creds `test`/`test`; MinIO alt: `:9000`, `minioadmin`).
- `LLM_PROVIDER` (`auto|anthropic|openai`), `ANTHROPIC_API_KEY`,
  `ANTHROPIC_DEFAULT_MODEL` (`claude-sonnet-4-6`), `OPENAI_API_KEY`, `OPENAI_DEFAULT_MODEL`.
- `IMAGE_PROVIDER` (`auto|fal|replicate|google|none` — `none` produces palette-driven SVG
  placeholders), `FAL_KEY`, `REPLICATE_API_TOKEN`, `GOOGLE_API_KEY`.
- `AI_OFFLINE=true` to avoid live AI calls; `TMDB_API_KEY`; `NEXTAUTH_SECRET`.

Never commit real secrets. `.env` is local-only.

## Conventions & gotchas

- Keep routers thin; put logic in `services/`. Validate with Pydantic schemas, not raw dicts.
- Deck/slide content is JSONB — changes to slide shape are schema-level (Pydantic/TS types),
  not necessarily DB migrations. Keep `frontend/src/types/*` in sync with backend schemas.
- Two DB engines: async at runtime, sync for Alembic. Don't mix them.
- AI providers are optional and provider-agnostic — code paths must degrade gracefully when
  keys are absent (`IMAGE_PROVIDER=none`, `AI_OFFLINE=true`).
- Frontend slide templates and the backend outline/content agents are coupled: a new slide
  type needs a template in `components/slides/templates/` (+ registry in `index.ts`) and
  corresponding content/layout agent support.

## Current repo state (as of this writing)

- Active branch: `feat/editor-page-design`, with a large set of uncommitted changes across
  backend and frontend.
- In-progress, untracked feature — **conversational chat intake**:
  `backend/app/ai/agents/intake_interview.py`, `backend/app/routers/interview.py`,
  `frontend/src/features/setup/ChatIntake.tsx`, `IntakeStudio.tsx`,
  `frontend/src/features/setup/intake/`, `frontend/src/lib/api/intake.ts`.
  Treat this as work in progress when touching the intake flow.
