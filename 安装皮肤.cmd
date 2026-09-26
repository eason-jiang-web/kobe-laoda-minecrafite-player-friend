@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Laoda - skin

echo.
echo   Installing the catgirl skin into CustomSkinLoader...
echo.
powershell -NoExit -File "%~dp0scripts\install-skin.ps1" %*
