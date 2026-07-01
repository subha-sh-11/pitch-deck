# Architecture Flow — Pitch Deck (AI Cinematic Pitch Deck Builder)

End-to-end architecture and data-flow reference for the **Pitch Deck** platform: turn an
idea / logline / treatment / full script into a producer-ready cinematic pitch deck, then
edit and export it.

> **Diagrams** are written in [Mermaid](https://mermaid.js.org). They render natively on
> GitHub. To use them in **Confluence**, see [Pasting into Confluence](#pasting-into-confluence)
> at the bottom.

---

## 1. System Context

```mermaid
flowchart LR
    User([Director / Creator])

    subgraph FE["Frontend — Next.js 16 / React 19 (TypeScript, Tailwind)"]
      Studio["Intake Studio\n(chat + brief + slide workshop)"]
      Editor["Deck Editor\n(PPT-style editing)"]
    end

    subgraph BE["Backend — FastAPI (async)"]
      API["REST API /api/v1/*"]
      AGENTS["AI Agent Pipeline"]
      JOBS["Generation Jobs\n(Celery or inline)"]
    end

    subgraph DATA["Data & Storage"]
      PG[("PostgreSQL 16\ndecks/slides as JSONB")]
      REDIS[("Redis\ncache / broker — optional")]
      S3[("S3 / MinIO\n+ local fallback")]
    end

    subgraph AI["External AI / Data"]
      LLM["LLM\nOpenAI / Anthropic"]
      IMG["Vertex AI Imagen / Gemini\n(fal · replicate fallback)"]
      TMDB["TMDB\ncomparable-film posters"]
    end

    User --> FE
    FE -- "HTTP (camelCase JSON)" --> API
    API --> AGENTS --> LLM
    AGENTS --> IMG
    AGENTS --> TMDB
    API --> JOBS
    API --> PG
    API --> REDIS
    API --> S3
    JOBS --> AGENTS
```

**Principle:** the frontend is a typed client of the backend; the backend serializes
**camelCase** JSON that matches `frontend/src/types/*`. Deck/slide content is stored as
**JSONB**, not normalized columns — slide-shape changes are schema-level (Pydantic + TS),
not DB migrations.

---

## 2. End-to-End Build Flow (happy path)

```mermaid
flowchart TD
    A["Create project\n(title, type, purpose, genre, language)"] --> B{How to start?}

    B -->|Describe / chat| C["Adaptive intake conversation\n(intake_interview agent)"]
    B -->|Upload full script| D["Ingest + extract\n(ingest → intake_extract)"]
    B -->|Reference .pptx| E["Parse reference deck\n(pptx_ref)"]

    C --> F["Design brief\n(20-field IntakeFormData)"]
    D --> F
    E --> F

    F --> G["Build deck → prepare_deck\nstory_analysis · design · outline"]
    G --> H["Slide shells (empty, typed)"]

    H --> I["Slide Workshop:\ngenerate each slide\n(content + layout + image)"]
    I --> J["Review / regenerate / 3 image options\nedit text · swap image · approve"]
    J --> K["Assemble deck"]
    K --> L["Deck Editor\n(inline edit, present, export)"]
    L --> M["Export — PDF / PPTX / web link"]
```

---

## 3. AI Agent Pipeline (multi-agent orchestration)

Each agent is provider-agnostic and degrades to a deterministic fallback when no AI key is
configured (`AI_OFFLINE=true` or missing keys).

```mermaid
flowchart LR
    subgraph Intake
      II["intake_interview\nCONFIRM → CLARIFY → SUGGEST"]
      IX["intake_extract\nscript → 20-field intake"]
    end
    SA["story_analysis\ntheme / emotional core"]
    DZ["design\ngenre → palette · fonts · register"]
    OL["outline\ntemplate → slide sequence"]
    CT["content\nper-slide copy (grounded in intake)"]
    LY["layout\ntemplate + layout type"]
    IP["image_prompt\ngenre/tone/region → diffusion prompt"]
    SE["slide_edit\nnatural-language deck edits"]

    II --> SA
    IX --> SA
    SA --> DZ --> OL --> CT --> LY
    CT --> IP
    DZ --> IP
    LY --> SE
```

| Agent | File | Output |
|---|---|---|
| `intake_interview` | `ai/agents/intake_interview.py` | next question + running brief |
| `intake_extract` | `ai/agents/intake_extract.py` | `IntakeFormData` from script text |
| `story_analysis` | `ai/agents/story_analysis.py` | theme, emotional core, positioning |
| `design` | `ai/agents/design.py` | `DesignDirection` (palette, fonts, mood) via `registers.py` |
| `outline` | `ai/agents/outline.py` + `ai/templates.py` | ordered slide outline for a template |
| `content` | `ai/agents/content.py` | `SlideContent` (heading/body/items/comps…) |
| `layout` | `ai/agents/layout.py` | template + layout type per slide |
| `image_prompt` | `ai/agents/image_prompt.py` | rights-safe, region-aware diffusion prompt |
| `slide_edit` | `ai/agents/slide_edit.py` | structured deck-edit actions |

All LLM calls flow through **`ai/llm.py` → `complete_json()`** (provider selection, prompt
caching, JSON extraction, deterministic fallback).

---

## 4. Chat Intake Flow

```mermaid
sequenceDiagram
    participant U as Director
    participant CP as ChatPanel (useInterview)
    participant API as POST /interview
    participant IA as intake_interview agent
    participant LLM as LLM (llm.py)

    U->>CP: describe film / drop script / images
    CP->>API: { history, pillars, brief }
    API->>IA: run turn
    IA->>LLM: complete_json(system, prompt)
    LLM-->>IA: { brief, sections, message, ask }
    IA-->>API: turn result
    API-->>CP: question + updated brief (right panel)
    U->>CP: answer chips / free text (loops)
    U->>CP: "Build deck"
    CP->>API: finalizeInterview + completeStep
    Note over CP: navigate to templates → Slide Workshop
```

Two shortcuts bypass the chat: **Upload full script** (`/intake/extract`) auto-fills the
whole brief; **Reference deck** (`/references/pptx`) seeds look + structure.

---

## 5. Slide Workshop — Generation Flow

```mermaid
sequenceDiagram
    participant W as Slide Workshop (frontend)
    participant API as /generate/*
    participant GS as generation_service
    participant AG as content / layout / image_prompt
    participant IMG as images.py (Vertex)
    participant DB as Postgres + Assets

    W->>API: POST /generate/{project}/deck/prepare
    API->>GS: prepare_deck (story+design+outline)
    GS->>DB: persist empty typed slide shells
    API-->>W: slide shells

    loop per slide (or "Generate all")
      W->>API: POST /generate/slides/{id}/regenerate
      API->>GS: regenerate_slide
      GS->>AG: content + layout
      GS->>IMG: image (image_prompt → diffusion)
      IMG->>DB: store asset → URL
      GS->>DB: update slide.content
      API-->>W: updated slide
    end

    W->>API: POST /generate/slides/{id}/image-variants
    API-->>W: 3 image options (gallery → pick one)

    W->>API: POST /projects/{id}/deck/assemble
    API-->>W: deck ready → Editor
```

---

## 6. Image Generation Pipeline

```mermaid
flowchart TD
    P["build_prompt()\ngenre · tone · region · palette"] --> R{"_resolve_image_provider()"}
    R -->|IMAGE_PROVIDER=vertex\n+ ADC creds| V["Vertex AI\nImagen :predict / Gemini :generateContent"]
    R -->|fal_key| F["fal.ai (FLUX)"]
    R -->|replicate_token| RP["Replicate"]
    R -->|google_api_key| G["Gemini API :predict"]
    R -->|none / quota 429| PL["Palette-driven\nSVG placeholder"]

    V -->|429 / 503| Retry["retry w/ backoff (4s,8s,16s)"] --> V
    V --> ST["store_asset()\nS3 / MinIO → local file → data URI"]
    F --> ST
    RP --> ST
    G --> ST
    ST --> URL["GET /api/v1/assets/{id}"]
    PL --> URL
```

- **Auth:** Vertex uses Application Default Credentials (`gcloud auth application-default
  login`) or `VERTEX_CREDENTIALS_PATH`; quota project sent via `x-goog-user-project`.
- **Resilience:** any provider failure (incl. safety filter / quota) falls back to a
  deterministic placeholder; regeneration **keeps the existing image** instead of clobbering.
- Scanned PDFs with no text layer are OCR'd (`ai/ocr.py`) before extraction.

---

## 7. Async Job Model

```mermaid
flowchart LR
    EP["/generate/* endpoint"] --> CJ["create GenerationJob (queued)"]
    CJ --> DSP{"dispatch()"}
    DSP -->|Redis worker| CEL["Celery task"]
    DSP -->|CELERY_EAGER / no broker| INL["inline in-request"]
    CEL --> RUN["generation_service.*"]
    INL --> RUN
    RUN --> UPD["job.status / progress / result"]
    FE["frontend pollJob()"] --> JOBS["GET /jobs/{id}"] --> UPD
```

Long work (full-deck generation, per-slide regen, image variants) runs as a tracked
`GenerationJob`; the frontend polls `GET /jobs/{id}`. With no Redis, work runs inline
(`CELERY_EAGER=true`) — same code path.

---

## 8. Request / Middleware Flow

```mermaid
flowchart TD
    REQ[HTTP Request] --> CORS["CORS middleware\n(allow frontend origin)"]
    CORS --> LOG["log_requests middleware\n(method · path · status · ms)"]
    LOG --> RL["rate_limit dep\n(ai_generate / image_generate)"]
    RL --> DEP["deps: get_owned_project / get_current_owner"]
    DEP --> RT["Router (thin)"]
    RT --> SVC["Service layer\n(project / deck / generation)"]
    SVC --> ORM["SQLAlchemy (async runtime)"]
    ORM --> DB[("PostgreSQL")]
    SVC --> RESP[Response — camelCase JSON]
```

Routers stay thin; business logic lives in `services/`. Pydantic `CamelModel` enforces the
camelCase contract shared with the frontend types.

---

## 9. Data Model

```mermaid
erDiagram
    USER ||--o{ PROJECT : owns
    PROJECT ||--o| DECK : has
    DECK ||--o{ SLIDE : contains
    PROJECT ||--o{ ASSET : owns
    SLIDE ||--o{ ASSET : "binds (slide_id)"
    PROJECT ||--o{ GENERATION_JOB : tracks

    USER {
        uuid id PK
        string email UK
        string name
    }
    PROJECT {
        uuid id PK
        uuid owner_id FK
        string title
        string project_type
        string pitch_purpose
        string story_stage
        json genres
        json tone
        string status
        json intake_form "JSONB — 20-field brief"
        text script_text "full uploaded script"
        json story_analysis "JSONB"
    }
    DECK {
        uuid id PK
        uuid project_id FK
        string template_id
        int slide_count
        string status
        json design_direction "JSONB — palette/fonts/mood"
    }
    SLIDE {
        uuid id PK
        uuid deck_id FK
        int slide_number
        string slide_type
        string title
        string purpose
        json content "JSONB — copy + imageUrl/candidates + edits"
        json layout "JSONB"
        string status
        json meta "JSONB — prompts, etc."
    }
    ASSET {
        uuid id PK
        uuid project_id FK
        uuid slide_id "nullable"
        string kind
        string storage_key
        string mime
        json generation_meta "JSONB"
    }
    GENERATION_JOB {
        uuid id PK
        uuid project_id FK
        uuid deck_id
        uuid slide_id
        string job_type
        string status
        int progress
        json result "JSONB"
    }
```

---

## 10. API Surface (mounted under `/api/v1`)

| Router | Key endpoints | Purpose |
|---|---|---|
| `health` | `GET /health` | liveness |
| `projects` | `POST/GET /projects`, `PUT /{id}/intake`, `POST /{id}/intake/extract`, `POST /{id}/references/pptx`, `POST /{id}/assets/upload-image`, `DELETE /{id}` | projects, intake, uploads |
| `interview` | `POST /interview`, finalize | adaptive chat intake |
| `decks` | `GET /projects/{id}/deck`, `PATCH /slides/{id}` | read deck, edit slide |
| `generate` | `POST /{id}/deck`, `/deck/prepare`, `/deck/assemble`, `/slides/{id}/regenerate`, `/image`, `/regenerate-image`, `/image-variants` | generation |
| `jobs` | `GET /jobs/{id}` | poll async jobs |
| `assets` | `GET /assets/{id}` | serve generated/uploaded images |
| `templates` | `GET /templates` | deck templates |

---

## 11. Key Design Decisions

1. **Provider-agnostic AI** — all LLM/image calls route through `ai/llm.py` and `ai/images.py`; the app runs fully offline with deterministic fallbacks (no vendor lock-in).
2. **JSONB content** — decks/slides stored as flexible JSONB; slide-shape evolves via Pydantic/TS types, not migrations.
3. **camelCase contract** — backend mirrors the frontend TS types; one source of truth for the API shape.
4. **Two DB engines** — async at runtime, sync for Alembic migrations (never mixed).
5. **Inline-or-worker generation** — same code runs under Celery (Redis present) or inline (`CELERY_EAGER`), so local dev needs no broker.
6. **Resilient images** — quota/safety failures fall back to placeholders and never clobber a good image; Vertex retries 429 with backoff.
7. **Keyless cloud auth** — Vertex via Application Default Credentials (no secret key files committed).
8. **Stub auth today** — a dev owner stands in for real auth (`deps.get_current_owner`); JWT/RBAC is the planned next layer.

---

## Pasting into Confluence

**Option A — HTML Viewer & Porter (Recommended — Perfect Formatting):**
1. Open the [view_architecture.html](file:///c:/Users/pc/Desktop/PD/view_architecture.html) file in your browser.
2. Click **"Copy for Confluence"** at the top right (this copies the fully rendered rich text with placeholder slots for diagrams).
3. Paste directly into your Confluence page. Spacing, tables, headers, and styles will render perfectly.
4. Download the **PNG** or **SVG** version of each diagram from the viewer and drag-and-drop them into the corresponding placeholder sections in Confluence.

**Option B — Markdown Importer:**
1. In a Confluence page: **••• (top-right) → Insert → Markup** (Note: this option may be hidden or unavailable in some Confluence Cloud instances).
2. Set type to **Markdown**, paste this file's contents.

**Option C — Live Mermaid Diagrams (Confluence Macro):**
1. Install the **"Mermaid Diagrams for Confluence"** macro from the Atlassian Marketplace.
2. On your page, type `/mermaid`, insert the macro, and paste the code from each ` ```mermaid ` block (without the fences).
3. Copy/paste the surrounding text/tables normally using Option A.

---

_Generated to mirror the actual codebase (`backend/app/*`, `frontend/src/*`). Keep in sync
when the agent pipeline, routers, or data model change._
