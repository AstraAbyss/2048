@echo off
setlocal
set "ROOT=%~dp0"
set "APP=%ROOT%src-tauri\target\release\game2048.exe"

if not exist "%APP%" (
  echo Build not found:
  echo   %APP%
  echo.
  echo Run "npm run tauri build" first.
  pause
  exit /b 1
)

start "" "%APP%"
endlocal
