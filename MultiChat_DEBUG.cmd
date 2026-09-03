@echo off
setlocal
chcp 65001 >nul
title MultiChat for OBS v1.0.0 Stable - DEBUG
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\MultiChat-Console-Launcher.ps1" -DebugMode
set "MC_EXIT=%ERRORLEVEL%"
echo.
echo Codigo de saida: %MC_EXIT%
pause
exit /b %MC_EXIT%
