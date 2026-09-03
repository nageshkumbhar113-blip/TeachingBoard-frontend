@echo off
echo ========================================
echo  TeachingBoard — ADMIN APK Build
echo ========================================

:: ── Version — update BOTH values for every release ──────────────────────────
set VERSION=7.4.23
set VERSION_CODE=120
:: ─────────────────────────────────────────────────────────────────────────────

:: [PRE] Stale .bak cleanup
if exist capacitor.config.ts.bak (
  echo [PRE] WARNING: stale .bak सापडला — cleanup...
  del capacitor.config.ts.bak >nul 2>&1
)

echo [1/7] Patching version %VERSION% (code %VERSION_CODE%)...
node tools/patch-version.mjs %VERSION% %VERSION_CODE%
if errorlevel 1 ( echo ERROR: version patch failed & pause & exit /b 1 )

echo [2/7] Preparing web assets...
node tools/prepare-admin.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [3/7] Switching config → ADMIN...
copy /Y capacitor-admin.config.ts capacitor.config.ts >nul 2>&1

echo [4/7] Patching applicationId → com.teachingboard.admin ...
node tools/patch-appid.mjs com.teachingboard.admin
if errorlevel 1 (
  echo ERROR: applicationId patch failed — restoring config
  copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1
  pause & exit /b 1
)

echo [5/7] Setting Admin icon (red) + app name...
copy /Y icons-admin\ic_launcher_background.xml android\app\src\main\res\values\ic_launcher_background.xml >nul 2>&1
copy /Y icons-admin\strings.xml android\app\src\main\res\values\strings.xml >nul 2>&1

echo [6/7] Capacitor sync...
call npx cap sync android
if errorlevel 1 (
  echo ERROR: cap sync failed — restoring config
  copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1
  pause & exit /b 1
)

echo [7/7] Building APK via Gradle (clean + assembleRelease)...
pushd android
:: Android Studio auto-generates gradle-daemon-jvm.properties pinning vendor=jetbrains,
:: which breaks CLI builds (no JBR on PATH). Remove it so Gradle uses JAVA_HOME (Temurin 21).
if exist gradle\gradle-daemon-jvm.properties del gradle\gradle-daemon-jvm.properties >nul 2>&1
call gradlew.bat clean
if errorlevel 1 ( popd & echo ERROR: Gradle clean failed & copy /Y ..\capacitor-student.config.ts ..\capacitor.config.ts >nul 2>&1 & pause & exit /b 1 )
call gradlew.bat assembleRelease
set BUILD_ERR=%errorlevel%
popd
if %BUILD_ERR% neq 0 (
  echo ERROR: Gradle build failed — खालील errors बघा
  copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1
  pause & exit /b 1
)

:: APK rename + move to release folder
if not exist android\app\release\ mkdir android\app\release\
if not exist "android\app\build\outputs\apk\release\app-release.apk" (
  echo ERROR: built APK not found ^(android\app\build\outputs\apk\release\app-release.apk^) — Gradle output missing
  copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1
  pause & exit /b 1
)
copy /Y "android\app\build\outputs\apk\release\app-release.apk" "android\app\release\admin%VERSION%.apk" >nul
if not exist "android\app\release\admin%VERSION%.apk" (
  echo ERROR: APK copy/rename failed
  copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1
  pause & exit /b 1
)

:: ALWAYS restore student config
copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1

:: Verify — applicationId confirm करा
echo.
echo  Verifying APK applicationId...
"C:\Users\A\AppData\Local\Android\Sdk\build-tools\37.0.0\aapt.exe" dump badging "android\app\release\admin%VERSION%.apk" 2>nul | findstr "^package:"

echo.
echo ========================================
echo  Admin APK ready!
echo ========================================
echo  App ID   : com.teachingboard.admin
echo  App Name : TB Admin
echo  Icon     : Red (#B71C1C)
echo  Version  : %VERSION% (code %VERSION_CODE%)
echo  APK      : android\app\release\admin%VERSION%.apk
echo.
pause
