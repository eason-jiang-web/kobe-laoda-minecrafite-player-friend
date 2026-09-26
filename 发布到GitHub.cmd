@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Publish Laoda to GitHub
powershell -NoExit -File "%~dp0scripts\publish.ps1" %*
