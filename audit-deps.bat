@echo off
setlocal
cd /d "%~dp0"

echo === Sistema Marcelo - Auditoria de dependencias ===
echo.

echo [Backend] pip audit...
cd backend
call .venv\Scripts\activate.bat
pip install pip-audit -q 2>nul
pip-audit -r requirements.txt
set BACKEND_ERR=%ERRORLEVEL%
cd ..

echo.
echo [Frontend] npm audit...
cd frontend
call npm audit --audit-level=moderate
set FRONTEND_ERR=%ERRORLEVEL%
cd ..

echo.
if %BACKEND_ERR% NEQ 0 (
  echo Backend: vulnerabilidades encontradas.
) else (
  echo Backend: OK.
)
if %FRONTEND_ERR% NEQ 0 (
  echo Frontend: vulnerabilidades encontradas.
) else (
  echo Frontend: OK.
)
pause
