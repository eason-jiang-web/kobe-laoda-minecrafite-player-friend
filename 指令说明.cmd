@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Laoda - command sheet

set "BUN=%USERPROFILE%\.bun\bin\bun.exe"
if not exist "%BUN%" set "BUN=bun"

"%BUN%" run apps/mc-bot/scripts/cheatsheet.ts

echo.
pause >nul
