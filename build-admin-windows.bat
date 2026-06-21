@echo off
echo ========================================
echo  TeachingBoard — ADMIN Windows Build
echo ========================================

echo [1/3] Preparing web assets...
node tools/prepare-admin.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/3] Building Windows app...
set CSC_IDENTITY_AUTO_DISCOVERY=false
set WIN_CSC_LINK=
set WIN_CSC_KEY_PASSWORD=
npx electron-builder --win --publish=never
if errorlevel 1 ( echo ERROR: electron-builder failed & pause & exit /b 1 )

echo [3/3] Done!
echo.
echo ========================================
echo  Windows app ready!
echo ========================================
echo  App ID   : com.teachingboard.admin
echo  App Name : TB Admin
echo  Output   : dist-electron\
echo.
explorer dist-electron
pause
