@echo off
setlocal
echo Stopping Industrial Twin Gateway & Web Server...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'tia_gateway\.py|run_twin\.py' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
echo Stopped.
timeout /t 1 /nobreak >nul
