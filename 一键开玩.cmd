@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Laoda - one click

rem Delegates to the menu's option 1 so "open everything" lives in ONE place
rem (scripts/menu.ps1 -> Start-Play) and this file stays ASCII-only.
powershell -NoExit -File "%~dp0scripts\menu.ps1" -Choose 1
