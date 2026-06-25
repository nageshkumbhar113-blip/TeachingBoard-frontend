@echo off
echo ========================================
echo  TeachingBoard — STUDENT APK Build
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
node tools/prepare-student.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/6] Switching Capacitor config...
copy /Y capacitor.config.ts capacitor.config.ts.bak >nul 2>&1
copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1

echo [3/6] Patching applicationId → com.teachingboard.student ...
powershell -Command "(Get-Content android\app\build.gradle) -replace 'applicationId \""com\.teachingboard\.[^\""]+\""','applicationId \"com.teachingboard.student\"' | Set-Content android\app\build.gradle"

echo [4/6] Setting Student icon (blue) and app name...
copy /Y icons-student\ic_launcher_background.xml android\app\src\main\res\values\ic_launcher_background.xml >nul 2>&1
copy /Y icons-student\strings.xml android\app\src\main\res\values\strings.xml >nul 2>&1

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
echo  ✅ Student APK ready to build!
echo ========================================
echo  App ID      : com.teachingboard.student
echo  App Name    : TB Student
echo  Icon        : Blue (#1565C0)
echo  Version     : %VERSION%  (code %VERSION_CODE%)
echo  SW Version  : v42
echo.
echo  Android Studio opening...
echo  → Build ^> Generate Signed Bundle/APK ^> APK ^> Release
echo    Output: android\app\release\app-release.apk
echo.
npx cap open android
pause
