@echo off
rem Starts the ANUMATI API on http://127.0.0.1:8000 (docs at /docs). Creates and seeds anumati.db on first run.
cd /d "%~dp0"
.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 %*
