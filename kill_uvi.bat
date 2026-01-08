@echo off
taskkill /F /IM uvicorn.exe >nul 2>&1
taskkill /F /IM python.exe /FI "WINDOWTITLE eq *uvicorn*"
echo All uvicorn instances terminated.
pause
