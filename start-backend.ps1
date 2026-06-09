# Starts the FastAPI backend on http://localhost:8000
# Run from anywhere:  .\start-backend.ps1
$ErrorActionPreference = "Stop"
$backend = Join-Path $PSScriptRoot "backend"
Set-Location $backend
& "$backend\.venv\Scripts\python.exe" -m uvicorn app.main:app --reload --port 8000
