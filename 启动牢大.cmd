@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Laoda

set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not exist "%BUN%" (
  where bun >nul 2>nul
  if errorlevel 1 (
    echo.
    echo   [X] bun not found. Open a NEW terminal first, or check:
    echo       C:\Users\%USERNAME%\.bun\bin\bun.exe
    echo.
    pause
    exit /b 1
  )
  set "BUN=bun"
)

rem Prepares op while the world is NOT loaded (the server only reads ops.json on load),
rem then starts the bot. Both print their own Chinese text -- keep this file ASCII only,
rem because cmd.exe mangles multi-byte characters in batch files.
"%BUN%" run apps/mc-bot/scripts/op-bot.ts --auto

"%BUN%" run bot

echo.
pause >nul
