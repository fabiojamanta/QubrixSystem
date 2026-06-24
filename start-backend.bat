@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\activate.bat" (
  echo [ERRO] Ambiente virtual nao encontrado em backend\.venv
  echo Crie e instale uma vez: python -m venv .venv ^& pip install -r requirements.txt
  pause
  exit /b 1
)

call .venv\Scripts\activate.bat

echo.
echo Sistema Marcelo - Backend
echo API:          http://localhost:8001
echo Documentacao: http://localhost:8001/docs
echo.
echo Pressione Ctrl+C para encerrar.
echo.

uvicorn app.main:app --reload --port 8001
