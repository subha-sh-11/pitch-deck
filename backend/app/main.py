"""FastAPI application entrypoint."""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import get_logger, setup_logging
from app.routers import (
    assets,
    decks,
    generate,
    health,
    interview,
    jobs,
    projects,
    templates,
)

setup_logging()
_req_log = get_logger("request")
_err_log = get_logger("error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_logger("app").info("Pitch Deck API starting — provider checks below")
    yield


app = FastAPI(
    title="Pitch Deck API",
    version="0.1.0",
    description="AI-powered cinematic pitch deck builder.",
    lifespan=lifespan,
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    dur_ms = (time.perf_counter() - start) * 1000
    _req_log.info(
        "%s %s -> %s (%.0f ms)",
        request.method,
        request.url.path,
        response.status_code,
        dur_ms,
    )
    return response


@app.exception_handler(Exception)
async def log_unhandled_errors(request: Request, exc: Exception):
    """Any error a route did NOT handle lands here. Log WHY it failed — the exception type, its
    message, and a full traceback — next to the access logs, so a failure shows its cause instead
    of a bare 500. Then return a clean JSON error to the caller (never a blank crash).

    Note: expected 4xx responses (HTTPException like 404/403, validation errors) are handled by
    FastAPI's own handlers and never reach here, so this only fires for real, unforeseen errors.
    """
    _err_log.exception(
        "%s %s -> 500 %s: %s",
        request.method, request.url.path, type(exc).__name__, exc,
    )
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(projects.router, prefix=settings.api_v1_prefix)
app.include_router(interview.router, prefix=settings.api_v1_prefix)
app.include_router(decks.router, prefix=settings.api_v1_prefix)
app.include_router(generate.router, prefix=settings.api_v1_prefix)
app.include_router(jobs.router, prefix=settings.api_v1_prefix)
app.include_router(assets.router, prefix=settings.api_v1_prefix)
app.include_router(templates.router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "pitch-deck-api", "docs": "/docs"}
