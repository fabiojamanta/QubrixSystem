@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\activate.bat" (
  echo [ERRO] Ambiente virtual nao encontrado em backend\.venv
  pause
  exit /b 1
)

call .venv\Scripts\activate.bat
python seed_demo.py %*
pause
