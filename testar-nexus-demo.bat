@echo off
title Nexus RPG - AMBIENTE DE TESTE (modo demo, sem login)
echo ==================================================
echo   NEXUS RPG - AMBIENTE DE TESTE
echo.
echo   Sobe o servidor local JA no modo demo:
echo   sem login, sem banco, com dados ficticios.
echo.
echo   Quando aparecer "Compiled successfully", abra:
echo     http://localhost:3000/?demo=1
echo.
echo   Para voltar ao app normal (com login):
echo     http://localhost:3000/?demo=0
echo.
echo   Para PARAR: feche esta janela (ou Ctrl+C)
echo ==================================================
cd /d "%~dp0"
set BROWSER=none
set NODE_OPTIONS=--max-old-space-size=6144
call npm start
pause
