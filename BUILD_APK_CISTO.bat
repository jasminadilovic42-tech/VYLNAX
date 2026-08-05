@echo off
setlocal
cd /d "%~dp0frontend"
echo.
echo [1/4] Cista instalacija paketa preko npm...
call npm ci
if errorlevel 1 goto :fail

echo.
echo [2/4] Lokalna provjera Expo konfiguracije...
call npx expo config --type public > expo-config-check.txt
if errorlevel 1 goto :fail

echo.
echo [3/4] Expo Doctor provjera...
call npx expo-doctor@latest
if errorlevel 1 echo UPOZORENJE: Expo Doctor je prijavio stavke za pregled, ali nastavljamo.

echo.
echo [4/4] Pokretanje Android APK builda...
call npx eas-cli@latest build --platform android --profile preview --clear-cache
if errorlevel 1 goto :fail
exit /b 0

:fail
echo.
echo BUILD JE ZAUSTAVLJEN PRIJE SLANJA ILI JE PRIJAVIO GRESKU.
echo Posalji fotografiju posljednjih crvenih redova.
pause
exit /b 1
