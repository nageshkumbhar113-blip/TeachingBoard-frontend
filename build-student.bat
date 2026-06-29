@echo off
echo ========================================
echo  TeachingBoard — STUDENT APK Build
echo ========================================

:: ── Version — update BOTH values for every release ──────────────────────────
set VERSION=5.0.1
set VERSION_CODE=51
:: ─────────────────────────────────────────────────────────────────────────────

:: [PRE] Stale .bak cleanup — previous build interrupt झाला असेल तर
if exist capacitor.config.ts.bak (
  echo [PRE] WARNING: stale capacitor.config.ts.bak सापडला — cleanup करतो...
  del capacitor.config.ts.bak >nul 2>&1
)

:: [PRE] Restore student config — default state ensure करा
echo [PRE] Student config restore (capacitor-student.config.ts → capacitor.config.ts)...
copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1

echo [0/6] Patching version %VERSION% (code %VERSION_CODE%)...
node -e "const fs=require('fs');let t=fs.readFileSync('env.js','utf8');t=t.replace(/APP_VERSION\s*=\s*'[^']+'/,\"APP_VERSION = '%VERSION%'\");fs.writeFileSync('env.js',t,'utf8');console.log('  env.js patched');"
if errorlevel 1 ( echo ERROR: env.js patch failed & pause & exit /b 1 )

node -e "const fs=require('fs');let t=fs.readFileSync('android/app/build.gradle','utf8');t=t.replace(/versionCode \d+/,'versionCode %VERSION_CODE%').replace(/versionName \"[^\"]+\"/,'versionName \"%VERSION%\"');fs.writeFileSync('android/app/build.gradle',t,'utf8');console.log('  build.gradle patched');"
if errorlevel 1 ( echo ERROR: build.gradle patch failed & pause & exit /b 1 )

echo [1/6] Preparing web assets...
node tools/prepare-student.mjs
if errorlevel 1 ( echo ERROR: prepare failed & pause & exit /b 1 )

echo [2/6] Verifying Capacitor config = STUDENT...
node -e "const fs=require('fs');const t=fs.readFileSync('capacitor.config.ts','utf8');if(!t.includes('com.teachingboard.student')){process.stderr.write('ERROR: capacitor.config.ts student config नाही!\n');process.exit(1);}console.log('  OK — com.teachingboard.student');"
if errorlevel 1 ( echo ERROR: config verify failed & pause & exit /b 1 )

echo [3/6] Patching applicationId → com.teachingboard.student ...
node -e "const fs=require('fs');let t=fs.readFileSync('android/app/build.gradle','utf8');t=t.replace(/applicationId \"com\.teachingboard\.[^\"]+\"/,'applicationId \"com.teachingboard.student\"');fs.writeFileSync('android/app/build.gradle',t,'utf8');console.log('  applicationId patched');"
if errorlevel 1 ( echo ERROR: applicationId patch failed & pause & exit /b 1 )

echo [4/6] Setting Student icon (blue) and app name...
copy /Y icons-student\ic_launcher_background.xml android\app\src\main\res\values\ic_launcher_background.xml >nul 2>&1
copy /Y icons-student\strings.xml android\app\src\main\res\values\strings.xml >nul 2>&1

echo [5/6] Capacitor sync...
npx cap sync android
if errorlevel 1 (
  echo ERROR: cap sync failed
  pause & exit /b 1
)

echo [6/6] Final restore — capacitor.config.ts = student (safe default)...
copy /Y capacitor-student.config.ts capacitor.config.ts >nul 2>&1

echo.
echo ========================================
echo  Student APK ready to build!
echo ========================================
echo  App ID      : com.teachingboard.student
echo  App Name    : TB Student
echo  Icon        : Blue (#1565C0)
echo  Version     : %VERSION%  (code %VERSION_CODE%)
echo  SW Version  : v43
  Config      : capacitor.config.ts = STUDENT (verified)
echo.
echo  Android Studio opening...
echo  Build ^> Generate Signed Bundle/APK ^> APK ^> Release
echo    Output: android\app\release\app-release.apk
echo.
npx cap open android
pause
