@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 构建 TIAWebTwin.exe
echo ==============================================
echo   构建 Windows 绿色免安装 EXE（Win11 24H2 兼容）
echo   产物：dist\TIAWebTwin\TIAWebTwin.exe
echo   将 dist\TIAWebTwin 文件夹发给用户即可双击运行
echo ==============================================
echo.

set "PY="
where py >nul 2>nul
if not errorlevel 1 set "PY=py -3"
if not defined PY (
  where python >nul 2>nul
  if not errorlevel 1 set "PY=python"
)
if not defined PY (
  echo 未找到 Python。构建机需要 Python 3.10+。
  pause
  exit /b 1
)

if not exist ".build-venv\Scripts\python.exe" (
  %PY% -m venv .build-venv
  if errorlevel 1 goto fail
)
".build-venv\Scripts\python.exe" -m pip install -r requirements.txt pyinstaller -i http://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com
if errorlevel 1 goto fail
".build-venv\Scripts\python.exe" -m PyInstaller --noconfirm --clean tia_twin.spec
if errorlevel 1 goto fail

echo.
echo ==============================================
echo 构建完成：dist\TIAWebTwin\TIAWebTwin.exe
echo 把 dist\TIAWebTwin 文件夹发给最终用户，双击运行即可！
echo ==============================================
pause
exit /b 0

:fail
echo.
echo 构建失败，请查看上面的错误信息。
pause
exit /b 1
