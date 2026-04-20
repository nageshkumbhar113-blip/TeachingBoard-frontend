@echo off
echo ========================================
echo  TeachingBoard — STUDENT APK Build
echo ========================================

echo [1/5] Preparing web assets...
node tools/prepare-student.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/5] Switching Capacitor config...
copy /Y capacitor.config.ts capacitor.config.ts.bak >/dev/null
copy /Y capacitor-student.config.ts capacitor.config.ts >/dev/null

echo [3/5] Patching applicationId → com.teachingboard.student ...
powershell -Command "(gc android\app\build.gradle) -replace 'applicationId \"com.teachingboard\.[^\"]+\"','applicationId \"com.teachingboard.student\"' | sc android\app\build.gradle"
powershell -Command "(gc android\app\build.gradle) -replace 'namespace \"com.teachingboard\.[^\"]+\"','namespace \"com.teachingboard.student\"' | sc android\app\build.gradle"

echo [4/5] Capacitor sync...
npx cap sync android
if errorlevel 1 (
  echo ERROR: cap sync failed
  copy /Y capacitor.config.ts.bak capacitor.config.ts >/dev/null
  pause & exit /b 1
)

echo [5/5] Restoring configs...
copy /Y capacitor.config.ts.bak capacitor.config.ts >/dev/null
del capacitor.config.ts.bak >/dev/null 2>&1

echo.
echo ========================================
echo  ✅ Student APK ready to build!
echo ========================================
echo  App ID   : com.teachingboard.student
echo  App Name : TB Student
echo  Version  : 1.0.0
echo.
echo  Android Studio opening...
echo  → Build ^> Build Bundle(s)/APK(s) ^> Build APK(s)
echo    (debug)   app/build/outputs/apk/debug/app-debug.apk
echo  → Build ^> Generate Signed Bundle/APK
echo    (release) app/build/outputs/apk/release/app-release.apk
echo.
npx cap open android
pause
