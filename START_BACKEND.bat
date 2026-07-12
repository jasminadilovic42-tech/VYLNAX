@echo off
setlocal
cd /d "%~dp0backend" || (
  echo [GRESKA] Backend folder nije pronadjen: %~dp0backend
  pause
  exit /b 1
)

echo =============================================
echo VYLNAX BACKEND - http://0.0.0.0:8001
echo =============================================

powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Uri http://127.0.0.1:8001/api/health -TimeoutSec 2; if($r.ok){exit 0}else{exit 1} } catch { exit 1 }" >nul 2>nul
if not errorlevel 1 (
  echo Backend vec radi na portu 8001.
  echo Ovaj prozor mozes ostaviti otvoren ili zatvoriti.
  pause
  exit /b 0
)

set "PY_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  where py >nul 2>nul
  if errorlevel 1 (
    echo [GRESKA] Python nije instaliran ili nije u PATH-u.
    echo Instaliraj Python 3 i ukljuci opciju Add Python to PATH.
    pause
    exit /b 1
  )
  set "PY_CMD=py -3"
)

%PY_CMD% -c "import fastapi, uvicorn, dotenv, httpx, pydantic" >nul 2>nul
if errorlevel 1 (
  echo Instaliram backend pakete. Ovo se radi samo prvi put...
  %PY_CMD% -m pip install -r requirements_local.txt
  if errorlevel 1 (
    echo [GRESKA] Instalacija backend paketa nije uspjela.
    pause
    exit /b 1
  )
)

%PY_CMD% -m uvicorn server:app --host 0.0.0.0 --port 8001
if errorlevel 1 (
  echo.
  echo [GRESKA] Backend se nije mogao pokrenuti.
  pause
)
endlocal
