@echo off
setlocal
cd /d "%~dp0frontend" || (
  echo [GRESKA] Frontend folder nije pronadjen: %~dp0frontend
  pause
  exit /b 1
)

echo =============================================
echo VYLNAX FRONTEND - Expo LAN port 8083
echo =============================================

where node >nul 2>nul
if errorlevel 1 (
  echo [GRESKA] Node.js nije instaliran ili nije u PATH-u.
  echo Instaliraj Node.js LTS.
  pause
  exit /b 1
)

if not exist "node_modules\expo\package.json" (
  echo Instaliram frontend pakete. Ovo se radi samo prvi put...
  call npm install --legacy-peer-deps
  if errorlevel 1 (
    echo [GRESKA] Instalacija frontend paketa nije uspjela.
    pause
    exit /b 1
  )
)

call npx expo start --lan --clear --port 8083
if errorlevel 1 (
  echo.
  echo [GRESKA] Expo se nije mogao pokrenuti.
  pause
)
endlocal
