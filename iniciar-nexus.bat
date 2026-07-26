@echo off
title Nexus RPG - Servidor Local
echo ============================================
echo   NEXUS RPG - iniciando servidor local...
echo   Quando aparecer "Compiled successfully",
echo   abra:  http://localhost:3000
echo   Para PARAR: feche esta janela (ou Ctrl+C)
echo ============================================
cd /d "%~dp0"
set BROWSER=none
set NODE_OPTIONS=--max-old-space-size=6144
call npm start
pause
