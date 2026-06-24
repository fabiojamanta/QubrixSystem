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

rem ============================================================
rem Escolha do banco de dados:
rem   start-backend.bat          -> pergunta qual banco usar
rem   start-backend.bat local    -> banco local (SQLite)
rem   start-backend.bat render   -> banco publicado no Render
rem ============================================================

set "DB_MODE=%~1"
if /i "%DB_MODE%"=="local" goto use_local
if /i "%DB_MODE%"=="render" goto use_render

echo.
echo Qual banco de dados deseja usar?
echo   [1] Local  ^(SQLite - qubrix.db^)
echo   [2] Render ^(PostgreSQL publicado^)
echo.
choice /c 12 /n /m "Escolha 1 ou 2: "
if errorlevel 2 goto use_render
goto use_local

:use_render
if not exist ".env.render" (
  echo [ERRO] Arquivo backend\.env.render nao encontrado.
  echo Copie backend\.env.render.example para backend\.env.render e configure a DATABASE_URL.
  pause
  exit /b 1
)
for /f "usebackq eol=# tokens=* delims=" %%a in (".env.render") do set "%%a"
echo "%DATABASE_URL%" | findstr /c:"COLE_AQUI" >nul
if not errorlevel 1 (
  echo [ERRO] Configure a DATABASE_URL em backend\.env.render
  echo Copie a "External Database URL" no painel do Render ^(banco qubrix-db^).
  pause
  exit /b 1
)
echo.
echo *** ATENCAO: usando o banco PUBLICADO no Render ^(dados de producao^)! ***
goto run

:use_local
echo.
echo Usando o banco LOCAL ^(SQLite^).
goto run

:run
echo.
echo QuBrix - Backend
echo API:          http://localhost:8001
echo Documentacao: http://localhost:8001/docs
echo.
echo Pressione Ctrl+C para encerrar.
echo.

uvicorn app.main:app --reload --port 8001
