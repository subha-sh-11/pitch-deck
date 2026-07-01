# Architecture Flow

A quick request-to-render flow for people getting the stack running. For the full
file-by-file walkthrough see [ARCHITECTURE.md](./ARCHITECTURE.md); for setup see
[SETUP.md](./SETUP.md).

```
Browser (Next.js 16 / React 19)
   │  HTTP  →  NEXT_PUBLIC_API_BASE_URL (default http://localhost:8000/api/v1)
   ▼
FastAPI backend (async)  ── app/routers/* → services/* → ai/agents/*
   │
   ├─▶ Postgres 16 + pgvector      decks/slides stored as JSONB
   ├─▶ Redis                       cache + Celery broker
   ├─▶ floci (S3 emulator :4566)   generated images & exports  [MinIO :9000 = alt]
   └─▶ Celery worker               image gen · exports · review
                                   (CELERY_EAGER=true runs these inline in dev)
```

## Generation pipeline (AI agents)

```
intake → story_analysis → design → outline → content
       → image_prompt (+ images) → layout → review
```

`design` runs before `outline`/`content`, and `layout` is applied as slides are persisted.
See `run_full_deck` in `backend/app/services/generation_service.py`.

## Graceful degradation

Every external dependency has a fallback, so the whole stack runs with **zero keys**:

| Dependency | Missing → |
|---|---|
| LLM keys (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) | template-driven copy (`AI_OFFLINE`) |
| `IMAGE_PROVIDER=none` / no image key | palette-driven SVG placeholders |
| S3 (floci / MinIO) unreachable | local disk (`_assets/`), then inline data URIs |
| Celery worker | inline execution (`CELERY_EAGER=true`) |
