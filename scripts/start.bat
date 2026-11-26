@echo off
setlocal
cd /d "%~dp0"

netstat -ano | findstr /R ":8765 .*LISTENING" >nul 2>nul
if not errorlevel 1 (
  start "" "http://127.0.0.1:8000"
  exit /b 0
)

if not exist "%~dp0runtime\python.exe" (
  if exist "%~dp0..\assets\runtime\portable-runtime.zip" (
    echo Extracting portable runtime...
    powershell -NoProfile -Command "Expand-Archive -Path '%~dp0..\assets\runtime\portable-runtime.zip' -DestinationPath '%~dp0runtime' -Force"
  )
)

if exist "%~dp0runtime\python.exe" (
  set "PY=%~dp0runtime\python.exe"
  goto launch
)

set "PY="
for /f "delims=" %%I in ('where python 2^>nul') do (
  echo %%I | findstr /i /v "WindowsApps" >nul
  if not errorlevel 1 if not defined PY set "PY=%%I"
)
if not defined PY (
  where py >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  echo [ERROR] Python not found. Please place portable runtime in .\runtime\
  pause
  exit /b 1
)

:launch
powershell -NoProfile -WindowStyle Hidden -Command "Start-Process -FilePath '%PY%' -ArgumentList 'run_twin.py --no-browser' -WorkingDirectory '%~dp0' -WindowStyle Hidden"
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
