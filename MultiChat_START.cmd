@echo off
setlocal
chcp 65001 >nul
title MultiChat for OBS v1.0.0 Stable
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\MultiChat-Console-Launcher.ps1"
set "MC_EXIT=%ERRORLEVEL%"
if not "%MC_EXIT%"=="0" (
    echo.
    echo O MultiChat foi encerrado com erro. Consulte as mensagens acima.
    echo Para diagnostico detalhado, execute MultiChat_DEBUG.cmd.
    echo.
    pause
)
exit /b %MC_EXIT%
