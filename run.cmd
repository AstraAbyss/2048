@echo off
setlocal
set "ROOT=%~dp0"
set "GAME2048_DATA_DIR=%ROOT%.runtime\data"
set "APP=%ROOT%src-tauri\target\release\game2048.exe"

if not exist "%APP%" (
  echo Build not found:
  echo   %APP%
  echo.
  echo Run "npm run tauri build" first.
  pause
  exit /b 1
)

if not exist "%GAME2048_DATA_DIR%" mkdir "%GAME2048_DATA_DIR%"
start "" "%APP%"
endlocal
