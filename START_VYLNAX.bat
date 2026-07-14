@echo off
setlocal
cd /d "%~dp0" || exit /b 1

echo =============================================
echo VYLNAX PRO - automatsko lokalno pokretanje
echo =============================================

if not exist "%~dp0backend\server.py" (
  echo [GRESKA] Nedostaje backend\server.py
  pause
  exit /b 1
)
if not exist "%~dp0frontend\package.json" (
  echo [GRESKA] Nedostaje frontend\package.json
  pause
  exit /b 1
)

set "VYLNAX_IP=127.0.0.1"
for /f "usebackq delims=" %%I in (`powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0GET_LAN_IP.ps1"`) do set "VYLNAX_IP=%%I"

> "%~dp0frontend\.env" echo EXPO_PUBLIC_BACKEND_URL=http://%VYLNAX_IP%:8001
>> "%~dp0frontend\.env" echo EXPO_USE_FAST_RESOLVER=1

set "REACT_NATIVE_PACKAGER_HOSTNAME=%VYLNAX_IP%"

echo Laptop IP: %VYLNAX_IP%
echo Backend test na telefonu: http://%VYLNAX_IP%:8001/api/health
echo.

start "VYLNAX BACKEND" cmd.exe /k call "%~dp0START_BACKEND.bat"
timeout /t 4 /nobreak >nul
start "VYLNAX FRONTEND" cmd.exe /k call "%~dp0START_FRONTEND.bat"

echo.
echo Otvorena su dva prozora: BACKEND i FRONTEND.
echo Skeniraj QR kod iz FRONTEND prozora kroz Expo Go.
echo Ovaj prozor mozes zatvoriti.
timeout /t 6 /nobreak >nul
endlocal
