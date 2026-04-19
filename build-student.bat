@echo off
echo ========================================
echo  TeachingBoard — STUDENT APK Build
echo ========================================

echo [1/4] Preparing web assets...
node tools/prepare-student.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/4] Switching to student config...
copy /Y capacitor.config.ts capacitor.config.ts.bak >/dev/null
copy /Y capacitor-student.config.ts capacitor.config.ts >/dev/null

echo [3/4] Capacitor sync...
npx cap sync android
if errorlevel 1 (
  copy /Y capacitor.config.ts.bak capacitor.config.ts >/dev/null
  echo ERROR: cap sync failed & pause & exit /b 1
)

echo [4/4] Restoring config + opening Android Studio...
copy /Y capacitor.config.ts.bak capacitor.config.ts >/dev/null

echo.
echo ✅ Sync done! Android Studio opening...
echo    Build ^> Build APK(s)  →  app-debug.apk
echo    Rename to: TeachingBoard-Student.apk
echo.
npx cap open android
pause
