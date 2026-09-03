@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\MultiChat-Stop.ps1"
echo MultiChat encerrado.
timeout /t 2 /nobreak >nul
