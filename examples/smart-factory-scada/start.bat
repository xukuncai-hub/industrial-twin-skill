@echo off
setlocal
cd /d "%~dp0"

netstat -ano | findstr /R ":8765 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:8000"
  exit /b 0
)

if not exist "%~dp0runtime\python.exe" (
  if exist "%~dp0..\..\assets\runtime\portable-runtime.zip" (
    echo Extracting portable runtime...
    powershell -NoProfile -Command "Expand-Archive -Path '%~dp0..\..\assets\runtime\portable-runtime.zip' -DestinationPath '%~dp0runtime' -Force"
  )
)

if exist "%~dp0runtime\python.exe" (
  set "PY=%~dp0runtime\python.exe"
  goto launch
)

set "PY=python"

:launch
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PY%' -ArgumentList '..\..\scripts\run_twin.py --no-browser' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
set /a _tries=0
:wait_http
netstat -ano | findstr /R ":8000 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:8000"
  exit /b 0
)
set /a _tries+=1
if %_tries% GEQ 20 (
  start "" "http://127.0.0.1:8000"
  exit /b 0
)
timeout /t 1 /nobreak >nul
goto wait_http
