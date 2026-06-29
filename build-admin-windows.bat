@echo off
:: Auto-elevate to Administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo Requesting Administrator access...
  powershell -Command "Start-Process '%~f0' -Verb RunAs"
  exit /b
)

cd /d "%~dp0"

:: ── Version — build-student.bat / build-admin.bat शी sync ठेवा ──────────────
set VERSION=5.0.1
:: ─────────────────────────────────────────────────────────────────────────────

echo ========================================
echo  TeachingBoard — ADMIN Windows Build
echo ========================================

echo [1/4] Preparing web assets...
node tools/prepare-admin.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/4] Building Windows app...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set WIN_CSC_KEY_PASSWORD=
npx electron-builder --win --publish=never
if errorlevel 1 ( echo ERROR: electron-builder failed & pause & exit /b 1 )

echo [3/4] Copying install scripts...
copy /Y install-tb-admin.bat   dist-electron\install-tb-admin.bat   >nul
copy /Y uninstall-tb-admin.bat dist-electron\uninstall-tb-admin.bat >nul

echo [4/4] Done!
echo.
echo ========================================
echo  ✅ Admin Windows app ready!
echo ========================================
echo  Output folder : dist-electron\
echo  Version       : %VERSION%
echo.
echo  Dusrya PC var install karayla:
echo  1. dist-electron\ folder copy kara
echo  2. install-tb-admin.bat Right-click - Run as Administrator
echo.
explorer dist-electron
pause
