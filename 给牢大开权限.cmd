@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Laoda - grant op

set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not exist "%BUN%" set "BUN=bun"

"%BUN%" run apps/mc-bot/scripts/op-bot.ts %*

echo.
pause >nul
