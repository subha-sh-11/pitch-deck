"""AI agents: each turns project/intake context into a structured, frontend-shaped output.

Every agent pairs a deterministic fallback (so the pipeline runs with zero external calls)
with an optional LLM refinement when a provider is configured.
"""
