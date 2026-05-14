@echo off
setlocal
cd /d "%~dp0"

echo.
echo ===== AyuSetu Public Launcher (ngrok) =====
echo.

rem Use %cd% after cd /d to avoid trailing-backslash argument parsing issues.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-ayusetu.ps1" -RootPath "%cd%"
if errorlevel 1 (
  echo.
  echo Launcher failed. See error above.
  pause
  exit /b 1
)

pause
