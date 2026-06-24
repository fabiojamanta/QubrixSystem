@echo off
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\activate.bat" (
  echo [ERRO] Ambiente virtual nao encontrado em backend\.venv
  pause
  exit /b 1
)

call .venv\Scripts\activate.bat

rem ============================================================
rem   seed-demo.bat           -> banco local (SQLite)
rem   seed-demo.bat render    -> banco publicado no Render
rem   seed-demo.bat --force   -> repopula (apaga dados operacionais)
rem ============================================================

set "DB_MODE=%~1"
if /i "%DB_MODE%"=="render" (
  if not exist ".env.render" (
    echo [ERRO] Arquivo backend\.env.render nao encontrado.
    echo Copie backend\.env.render.example para backend\.env.render
    pause
    exit /b 1
  )
  for /f "usebackq eol=# tokens=* delims=" %%a in (".env.render") do set "%%a"
  echo "%DATABASE_URL%" | findstr /c:"COLE_AQUI" >nul
  if not errorlevel 1 (
    echo [ERRO] Configure a DATABASE_URL em backend\.env.render
    pause
    exit /b 1
  )
  echo.
  echo *** Populando banco PUBLICADO no Render ***
  echo.
  shift
)

python seed_demo.py %*
pause
