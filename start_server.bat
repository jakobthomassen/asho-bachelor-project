@echo off
cd /d "%~dp0\backend"
python -m uvicorn app.main:app --reload --reload-dir app
pause
