@echo off
setlocal
set "SRC=%~dp0"
if "%SRC:~-1%"=="\" set "SRC=%SRC:~0,-1%"

set "TARGETS=%USERPROFILE%\.gemini\config\skills\industrial-twin-skill;%USERPROFILE%\.agents\skills\industrial-twin-skill;%USERPROFILE%\.claude\skills\industrial-twin-skill"

echo ============================================================
echo   Industrial Twin Skill - One-Click Installer (Windows)
echo ============================================================
echo.

for %%T in ("%TARGETS:;=" "%") do (
  echo [Install] %%~T
  if not exist "%%~T" mkdir "%%~T" >nul 2>&1
  copy /Y "%SRC%\SKILL.md" "%%~T\SKILL.md" >nul
  robocopy "%SRC%\references" "%%~T\references" /E /NFL /NDL /NJH /NJS /NC /NS /NP >nul
  robocopy "%SRC%\scripts" "%%~T\scripts" /E /NFL /NDL /NJH /NJS /NC /NS /NP >nul
  robocopy "%SRC%\assets" "%%~T\assets" /E /NFL /NDL /NJH /NJS /NC /NS /NP >nul
)

echo.
echo [OK] Installed to Antigravity, Agents, and Claude Code global skills.
echo      Restart or start a new conversation in your AI IDE to use it.
echo.
pause
