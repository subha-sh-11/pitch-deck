"""FastAPI application entrypoint."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import health


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup / shutdown hooks (engine warmup, cache, etc.) go here.
    yield


app = FastAPI(
    title="Pitch Deck API",
    version="0.1.0",
    description="AI-powered cinematic pitch deck builder.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "pitch-deck-api", "docs": "/docs"}
