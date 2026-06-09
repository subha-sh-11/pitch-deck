# Pitch Deck — Architecture & Code Walkthrough

A complete, file-by-file walkthrough of the codebase, produced from a full read of every
source file in `backend/` and `frontend/`. This is the engineering companion to `README.md`
(which describes the aspirational stack); this document describes **what the code actually does today**.

---

## 1. What the application is

**Pitch Deck** turns a film/TV idea — a logline, a treatment, or a full uploaded script —
into a **producer-ready cinematic pitch deck of ~14–16 slides**. It is aimed at directors,
screenwriters, and creators (Telugu-first, pan-India framing).

The user supplies their story through a guided wizard (or by uploading a script that the AI
parses). A multi-agent pipeline then generates the narrative copy, an art-directed visual
design, and cinematic imagery, assembles an editable deck, and hands it to a Pitch.com-style
editor for refinement and (planned) export to PDF / PPTX / share link.

A defining trait of the code is **graceful degradation**: every AI step has a deterministic
fallback, so the whole pipeline runs end-to-end with **zero external API keys** (producing
SVG placeholder art and template-driven copy). Keys simply upgrade quality.

---

## 2. Tech stack (as actually built)

**Backend** — Python 3.11 / FastAPI (async). SQLAlchemy 2.0 + Postgres (pgvector image) with
heavy use of JSONB. Celery + Redis for background jobs (with inline fallback). boto3 → S3/MinIO
for assets, with local-disk and data-URI fallbacks. Pydantic v2 schemas. Alembic migrations.

**AI** — provider-agnostic. Text LLM via Anthropic (`claude-sonnet-4-6`) or OpenAI (`gpt-4o`),
auto-selected by which key is present. Images via fal.ai (FLUX schnell), Replicate, or Google
Imagen — else a deterministic SVG placeholder. Optional TMDB lookups for real comparable-film
posters. Script ingestion via pdfplumber / python-docx / FDX XML.

**Frontend** — Next.js (App Router) + React + TypeScript, Tailwind v4. Note: `package.json`
currently lists only `next`, `react`, `react-dom` — the richer libraries named in the README
(Zustand, TanStack Query, Tiptap, dnd-kit, shadcn) are **not** installed. State is handled with
React Context + `sessionStorage`; data fetching is a hand-rolled `fetch` wrapper.

**Infra** — Nginx reverse proxy (path routing, SSE passthrough, rate limiting); Docker Compose
for Postgres + Redis + MinIO in dev.

---

## 3. High-level data flow

```
Create project ──▶ Setup wizard (intake)  ──▶ Template select ──▶ Preview/generate ──▶ Editor ──▶ (Export)
     │                    │                          │                    │                 │
 POST /projects   PUT /projects/:id/intake   GET /templates      POST /generate/:id/deck   PATCH /slides/:id
                  POST .../intake/extract     recommend-template  GET /jobs/:id (poll)
                                                                  GET /projects/:id/deck
```

The backend `status` field on a project tracks a 9-phase pipeline:
`intake → questions → story_analysis → outline → content → design → editor → review → export → completed`.

---

## 4. Backend

### 4.1 Entry point & config

- **`app/main.py`** — FastAPI app factory. Adds a request-timing middleware, permissive CORS
  (origins from settings), and mounts seven routers under `/api/v1`: `health, projects, decks,
  generate, jobs, assets, templates`. Root `/` returns a service banner.
- **`app/core/config.py`** — Pydantic `Settings` loaded from `.env`. Central switchboard for
  everything: DB URLs (async `asyncpg` + derived sync `psycopg2`), Redis, Celery (incl.
  `celery_eager` to run tasks inline in dev), S3/MinIO creds, and the provider-agnostic AI
  config: `llm_provider` (`auto|anthropic|openai|none`), `image_provider`
  (`auto|fal|replicate|google|none`), per-provider keys/models, `tmdb_api_key`, and a global
  `ai_offline` kill-switch that forces deterministic fallbacks.

### 4.2 Core infrastructure (`app/core/`)

- **`db.py`** — Two engines. An **async** engine + `get_db()` dependency for FastAPI routes,
  and a **sync** engine + `session_scope()` context manager for Celery workers (async engines
  can't drive background threads). This async/sync split recurs throughout.
- **`cache.py`** — Redis cache-aside, **fail-open** (no Redis → no-op). `cache_key()` builds
  deterministic SHA256 keys; `cached_call()` wraps a function with a default 1-day TTL. Used to
  memoize identical LLM calls.
- **`storage.py`** — Object storage abstraction. `store_asset()` tries S3/MinIO, falls back to
  local disk (`_assets/`), then to a base64 data URI. `presigned_url()` for serving. Resilient
  at every layer (2s/5s timeouts).
- **`rate_limit.py`** — Redis fixed-window per-IP limiter, fail-open. Pre-built limiters:
  `ai_generate_limit` (20/min), `image_generate_limit` (10/min).
- **`logging.py`** — Namespaced (`pitchdeck.*`) structured logging, UTF-8 forced on Windows.

### 4.3 Data model (`app/models/`)

UUID PKs (`gen_random_uuid()`), `TimestampMixin` (created/updated), JSONB for flexible content.

| Table | Key columns | Notes |
|---|---|---|
| **users** | email (unique), name, role | role: director/collaborator/producer |
| **projects** | owner_id→users, title, project_type, pitch_purpose, story_stage, genres[], tone[], language, production_status, **status**, `intake_form` (JSONB), `script_summary` (JSONB), `story_analysis` (JSONB) | the hub object; status drives the 9-phase workflow |
| **decks** | project_id→projects, template_id, slide_count, status, `design_direction` (JSONB), `quality_review` (JSONB) | one deck per project (regenerated on each full run) |
| **slides** | deck_id→decks, slide_number, **slide_type** (16 types), title, purpose, `content` (JSONB), `layout` (JSONB), status, ai_rationale, image_asset_id→assets | content/layout are polymorphic by slide_type |
| **assets** | project_id, slide_id, kind, storage_key, mime, w/h, `generation_meta` (JSONB) | generated images; key = `generated/{project}/{kind}/{uuid}.{ext}` |
| **generation_jobs** | project_id, deck_id, slide_id, job_type, status, progress 0–100, `params`/`result` (JSONB), error, finished_at | polled by the frontend for progress |

Migrations: a single Alembic baseline (`alembic/versions/0001_baseline.py`) creates all of the
above; `env.py` uses the sync engine and `Base.metadata` with type/default comparison on.

### 4.4 Schemas (`app/schemas/`)

All inherit `CamelModel` (base.py) — serialize to **camelCase** for the API, accept either case
in, `from_attributes=True` for ORM conversion. This is the contract that matches the frontend's
TS types exactly. Notable shapes: `IntakeFormData` (flat 20-field intake), `DesignDirection`
(palette/typography/visual language), `StoryAnalysis` (8 fields), `SlideContent` (polymorphic:
heading/body/bullets/items/characters/comps/moodBlocks/imageUrl), `QualityReview`.

### 4.5 Routers (`app/routers/`)

- **`deps.py`** — `get_current_owner()` is a **stub auth** returning a dev user (JWT TODO);
  `get_owned_project()` fetches-or-404s.
- **`health.py`** — `/health` (liveness), `/health/ready` (checks DB).
- **`projects.py`** — full CRUD plus `PUT /{id}/intake` (save form),
  `POST /{id}/intake/extract` (upload script ≤15 MB → parse → auto-fill intake),
  `GET /{id}/recommend-template`.
- **`decks.py`** — `GET /projects/{id}/deck` (deck + slides), `PATCH /slides/{id}` (edit a slide;
  merges content to preserve baked image URLs).
- **`generate.py`** (rate-limited) — `POST /{id}/deck` (full generation), `POST /{id}/design`
  (re-do design), `POST /slides/{id}/regenerate` (single slide). Each creates a `GenerationJob`
  and dispatches it; responds with the job + a `mode` (`queued|background|inline`).
- **`jobs.py`** — `GET /{id}` job-status polling.
- **`assets.py`** — `GET /{id}` serves an image: redirect to a presigned S3 URL when available,
  else local bytes, with `Cache-Control: max-age=86400`.
- **`templates.py`** — `GET /` lists deck templates with their slide outlines.

### 4.6 Services (`app/services/`)

- **`project_service.py`** — async CRUD + `save_intake()`; lazily creates the dev owner.
- **`deck_service.py`** — async reads + ORM→API serialization (strips the internal `_register`
  hint from design output).
- **`generation_service.py`** — **the orchestrator** (sync, self-contained via `session_scope()`
  so Celery and inline calls behave identically). `run_full_deck()`:
  1. story analysis agent → 2. design direction agent → 3. pick template + build outline →
  4. drop any existing deck → 5. **content for all slides in parallel** (ThreadPoolExecutor,
  6 workers — LLM only) → 6. **images in parallel** (diffusion only) → 7. persist slides + assets
  sequentially (single session, avoids races) → 8. set project `status=editor`, deck `status=ready`.
  Job progress is updated throughout (2 → 8 → 14 → 45 → …). Also `run_design()` and
  `regenerate_slide()`.

### 4.7 Workers (`app/workers/`)

- **`celery_app.py`** — Celery configured off Redis; `task_always_eager` honors `celery_eager`.
- **`dispatch.py`** — smart routing with graceful degradation: try **Celery** → fall back to
  FastAPI **BackgroundTasks** → fall back to **inline threadpool**. Returns the chosen mode.
- **`tasks.py`** — thin `@celery_app.task` wrappers around the three `generation_service` entries.

### 4.8 AI layer (`app/ai/`)

The heart of the product. Two principles everywhere: **provider-agnostic** (vendor SDKs are
lazy-imported, never leaked into callers) and **deterministic fallback** (offline-safe).

- **`llm.py`** — `resolve_provider()` auto-picks Anthropic > OpenAI by configured key.
  `complete_json()` is the single entry every agent uses: checks the Redis cache, calls the
  provider (Anthropic is prefilled with `{` to force a JSON object; OpenAI uses
  `response_format=json_object`), extracts JSON robustly (strips code fences, balanced-brace
  regex), and on **any** failure returns the caller's `fallback()`.
- **`images.py`** — `generate_image()` resolves fal/replicate/google/placeholder, maps aspect
  ratios to dimensions, and on any error returns `_placeholder()`: a deterministic gradient-+-noise
  SVG seeded from the prompt hash and the design palette.
- **`ingest.py`** — `extract_text()` parses PDF/DOCX/FDX/TXT (lazy imports), normalizes whitespace,
  caps at 40k chars, and never raises (returns "" on failure).
- **`registers.py`** — five curated **cinematic style registers** (`restrained_cinematic`,
  `editorial_warm`, `high_contrast_genre`, `playful_bright`, `pulp_stylized`), each a full design
  prior (palette, typography, visual language, font, tags). `select_register()` scores genre+tone
  keywords; `design_direction_fallback()` builds a complete DesignDirection without an LLM.
- **`templates.py`** — a 16-slide `CANONICAL_OUTLINE` and four named templates
  (`investor-thriller`, `ott-streaming`, `festival-directors`, `series-bible-lite`) that select
  subsets. `recommend_template()` scores tags against genre/tone.
- **`tmdb.py`** — optional `poster_for(title)` → real poster URL (cached 1 week); returns `None`
  without a key so the UI falls back to a styled card.

**Agents (`app/ai/agents/`)** — each pairs a deterministic fallback with optional LLM refinement:

| Agent | Output | Behavior |
|---|---|---|
| `intake_extract.py` | 20-field IntakeFormData | EXTRACT fields lifted faithfully, SYNTHESIZE fields inferred; never fabricates. Offline fallback = title + truncated synopsis only. |
| `story_analysis.py` | StoryAnalysis (8 fields) | Distills theme/emotional core/genre DNA/commercial angle, grounded in intake. |
| `design.py` | DesignDirection | Starts from the matched register (strong prior); LLM refines language only; fonts set deterministically. |
| `content.py` | SlideContent per slide | Copy grounded strictly in intake; backfills missing primary fields from fallback; attaches TMDB posters for `show_cross`, real palette for `visual_aesthetic`. |
| `image_prompt.py` | diffusion prompt | Pure function; composes framing+subject+style+palette; `_safe()` strips peril/minor/violence terms that trip safety filters. No LLM. |
| `layout.py` | SlideLayout | Pure lookup: slide_type → layoutType. No LLM. |

---

## 5. Frontend

### 5.1 Routing & the user journey (`src/app/`)

Next.js App Router. The real workflow is a **stage-gated wizard**; many older route names
(`intake`, `questions`, `story-analysis`, `outline`, `content`, `design`, `review`, `export`)
are now **redirect stubs** pointing at the current flow:

1. **Landing** `/` → `MarketingShell` + `LandingPage` (hero, feature grid, auto-cycling deck preview).
2. **Create** `/projects/new` → `ProjectForm` → `POST /projects` → redirect to setup.
3. **Setup wizard** `/projects/[id]/setup/{identity,body,pitch}` — three sequential steps
   (identity: title/logline + optional script upload; body: synopsis/world/characters;
   pitch: USP/comps/audience). Each step gate calls `saveIntake()`; later steps guard on earlier
   completion.
4. **Templates** `/projects/[id]/templates` — `listTemplates()` + `recommendTemplate()`, pick a structure.
5. **Preview** `/projects/[id]/preview` — calls `generateDeck()` once, polls the job behind a
   `GeneratingOverlay`, then lets the user review/edit/regenerate slide **content** before approving.
6. **Editor** `/projects/[id]/editor` — the full WYSIWYG editor (guarded on `contentApproved`).

### 5.2 State (`src/features/setup/SetupWizardContext.tsx`)

A single React Context backs the whole setup→edit experience. It persists a working copy to
`sessionStorage` (per project), hydrates intake from the backend, lazily loads the deck when the
project status implies one exists, and exposes the mutation surface: `updateForm`, `completeStep`,
`initDraftSlides` (triggers generation), `updateDraftSlide`, insert/move/delete slide,
`regenerateDraftSlide`, `regenerateAllDraftSlides`, plus generation progress/error tracking.
Slides whose id starts with `local-` are client-only; others are persisted via the API.

### 5.3 API client (`src/lib/api/`)

A hand-rolled wrapper. `client.ts` exposes `apiFetch<T>()` and an `ApiError` (carries HTTP
status; 204 → undefined; network error → status 0). Base URL from `NEXT_PUBLIC_API_BASE_URL`
(default `http://localhost:8000/api/v1`). Modules map 1:1 to backend routers: `projects.ts`,
`deck.ts`, `generation.ts` (incl. `pollJob()` which polls until succeeded/failed),
`templates.ts`. Types in `src/types/` mirror the backend camelCase schemas exactly.

### 5.4 Slide rendering system (`src/components/slides/`)

- **`SlideRenderer.tsx`** dispatches `slide_type` → a template component and injects CSS variables
  (`--slide-accent`, `--slide-text`, `--slide-font-display`) computed from the AI palette and the
  per-slide `appearance` (style variant, accent color, background). `SlideFrame` provides the
  dark base + noise texture + optional full-bleed image.
- **`templates/`** — 13 art-directed components: `CoverSlide`, `LoglineSlide`, `GenreBlendSlide`,
  `SynopsisSlide`, `StoryWorldSlide`, `CharacterSlide`, `USPGridSlide`, `ShowCrossSlide`
  (TMDB posters), `VisualAestheticSlide` (mood-color grid), `TargetAudienceSlide`,
  `MarketPotentialSlide`, `ContactSlide`, and `GenericSlide` (fallback for budget/team/vision).

### 5.5 Editor (`src/components/editor/` + `features/editor/`)

`DeckEditor` orchestrates a Pitch.com-style chrome: `PitchTopBar` (title, insert menu, share,
present, mock collaborators), `SlideNavigator` (thumbnails + "Add slide"), `SlideCanvas` (zoomable
16:9 stage with a floating `SlideContextBar` for style/color/background), `PitchRightRail` (Design,
Transitions, Comments, Speaker Notes, Review, Profile flyouts + zoom), `AiAssistantFab`,
`ShareDialog`, and a real `PresentationMode` (fullscreen, keyboard nav, auto-hiding chrome,
speaker notes). Appearance options live in `lib/slide-appearance.ts`.

### 5.6 Supporting lib & styles

`lib/build-slides.ts` hydrates default slide content from intake; `lib/workflow.ts` computes step
status/progress; `lib/routes.ts` centralizes URLs. `styles/` is plain CSS (cinematic dark theme
with neon cyan/lime accents, glassmorphism, landing animations) — no component library.

---

## 6. Cross-cutting design principles (observed in the code)

1. **Offline-first AI.** Every agent and the image generator degrade to deterministic output, so
   the app runs with no keys at all (`ai_offline`, SVG placeholders, register/template fallbacks).
2. **Provider-agnostic.** Vendor SDKs are lazy-imported behind `llm.py` / `images.py`; callers
   never know which provider answered.
3. **Async API, sync workers.** FastAPI routes use async SQLAlchemy; generation runs sync under
   `session_scope()` so Celery/inline are interchangeable.
4. **Graceful degradation at the edges.** Cache, rate-limit, storage, and task dispatch all
   fail open rather than blocking the request.
5. **Parallel compute, serial writes.** Content and images generate concurrently; DB writes happen
   on one thread to avoid transaction races.
6. **JSONB everywhere flexible.** Intake, design, content, and layout are JSONB so the schema can
   evolve without migrations, and the camelCase Pydantic/TS contract stays in lockstep.

---

## 7. Notable gaps / aspirational vs. actual

- **Auth is a stub** (`deps.get_current_owner` returns a dev user); README mentions Auth.js/Clerk.
- **Export isn't implemented** in code yet — the `/export` route redirects to the editor;
  README describes Playwright (PDF) + python-pptx (PPTX) + share links.
- **`quality_review`** has a model column and schema but no agent producing it (the editor computes
  a lightweight readiness % client-side).
- **Frontend dependencies** in `package.json` are minimal (next/react only); the README's
  Zustand/TanStack/Tiptap/dnd-kit/shadcn stack is not installed — state/data/DnD are hand-rolled.
- **pgvector / RAG comps retrieval** is present as infrastructure intent (pgvector image, README)
  but not wired into the agents yet.

---

*Generated from a full file-by-file read of the repository.*
