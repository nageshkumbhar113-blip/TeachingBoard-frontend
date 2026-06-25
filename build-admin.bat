@echo off
echo ========================================
echo  TeachingBoard — ADMIN APK Build
echo ========================================

:: ── Version — update BOTH values for every release ──────────────────────────
set VERSION=5.0.0
set VERSION_CODE=50
:: ─────────────────────────────────────────────────────────────────────────────

echo [0/6] Patching version %VERSION% (code %VERSION_CODE%)...
powershell -Command "(Get-Content 'env.js') -replace 'APP_VERSION = ''[^'']+''','APP_VERSION = ''%VERSION%''' | Set-Content 'env.js'"
powershell -Command "(Get-Content 'android\app\build.gradle') -replace 'versionCode \d+','versionCode %VERSION_CODE%' | Set-Content 'android\app\build.gradle'"
powershell -Command "(Get-Content 'android\app\build.gradle') -replace 'versionName \""[^\""]+\""','versionName \"%VERSION%\"' | Set-Content 'android\app\build.gradle'"

echo [1/6] Preparing web assets...
node tools/prepare-admin.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/6] Switching Capacitor config...
copy /Y capacitor.config.ts capacitor.config.ts.bak >nul 2>&1
copy /Y capacitor-admin.config.ts capacitor.config.ts >nul 2>&1

echo [3/6] Patching applicationId → com.teachingboard.admin ...
powershell -Command "(Get-Content android\app\build.gradle) -replace 'applicationId \""com\.teachingboard\.[^\""]+\""','applicationId \"com.teachingboard.admin\"' | Set-Content android\app\build.gradle"

echo [4/6] Setting Admin icon (red) and app name...
copy /Y icons-admin\ic_launcher_background.xml android\app\src\main\res\values\ic_launcher_background.xml >nul 2>&1
copy /Y icons-admin\strings.xml android\app\src\main\res\values\strings.xml >nul 2>&1

echo [5/6] Capacitor sync...
npx cap sync android
if errorlevel 1 (
  echo ERROR: cap sync failed
  copy /Y capacitor.config.ts.bak capacitor.config.ts >nul 2>&1
  del capacitor.config.ts.bak >nul 2>&1
  pause & exit /b 1
)

echo [6/6] Restoring configs...
copy /Y capacitor.config.ts.bak capacitor.config.ts >nul 2>&1
del capacitor.config.ts.bak >nul 2>&1

echo.
echo ========================================
echo  ✅ Admin APK ready to build!
echo ========================================
echo  App ID      : com.teachingboard.admin
echo  App Name    : TB Admin
echo  Icon        : Red (#B71C1C)
echo  Version     : %VERSION%  (code %VERSION_CODE%)
echo  SW Version  : v41
echo.
echo  Android Studio opening...
echo  → Build ^> Generate Signed Bundle/APK ^> APK ^> Release
echo    Output: android\app\release\app-release.apk
echo.
npx cap open android
pause
