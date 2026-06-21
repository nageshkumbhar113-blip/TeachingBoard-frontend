@echo off
:: ============================================================
::  TB Admin — Windows Installer
::  Run as Administrator
:: ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Please right-click and select "Run as administrator"
  pause
  exit /b 1
)

set INSTALL_DIR=%ProgramFiles%\TB Admin
set APP_EXE=%INSTALL_DIR%\TB Admin.exe
set SOURCE=%~dp0win-unpacked

if not exist "%SOURCE%\TB Admin.exe" (
  echo ERROR: win-unpacked folder not found next to this script.
  echo Make sure install-tb-admin.bat is in the same folder as win-unpacked\
  pause
  exit /b 1
)

echo.
echo ========================================
echo  Installing TB Admin 2.0.0...
echo ========================================

echo [1/4] Copying files to Program Files...
if exist "%INSTALL_DIR%" rmdir /S /Q "%INSTALL_DIR%"
xcopy "%SOURCE%\*" "%INSTALL_DIR%\" /E /I /Y /Q
if errorlevel 1 ( echo ERROR: Copy failed & pause & exit /b 1 )

echo [2/4] Creating Desktop shortcut...
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%PUBLIC%\Desktop\TB Admin.lnk'); $s.TargetPath='%APP_EXE%'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.Description='TeachingBoard Admin'; $s.Save()"

echo [3/4] Creating Start Menu shortcut...
if not exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\TeachingBoard" mkdir "%ProgramData%\Microsoft\Windows\Start Menu\Programs\TeachingBoard"
powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%ProgramData%\Microsoft\Windows\Start Menu\Programs\TeachingBoard\TB Admin.lnk'); $s.TargetPath='%APP_EXE%'; $s.WorkingDirectory='%INSTALL_DIR%'; $s.Save()"

echo [4/4] Registering in Apps and Features...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "DisplayName"     /t REG_SZ /d "TB Admin" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "DisplayVersion"  /t REG_SZ /d "2.0.0" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "Publisher"       /t REG_SZ /d "TeachingBoard" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "InstallLocation" /t REG_SZ /d "%INSTALL_DIR%" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "DisplayIcon"     /t REG_SZ /d "%APP_EXE%" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "UninstallString" /t REG_SZ /d "\"%INSTALL_DIR%\uninstall-tb-admin.bat\"" /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "NoModify"        /t REG_DWORD /d 1 /f >nul
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /v "NoRepair"        /t REG_DWORD /d 1 /f >nul

echo Copying uninstaller...
copy /Y "%~dp0uninstall-tb-admin.bat" "%INSTALL_DIR%\uninstall-tb-admin.bat" >nul

echo.
echo ========================================
echo  TB Admin installed successfully!
echo ========================================
echo  Location : %INSTALL_DIR%
echo  Shortcut : Desktop + Start Menu
echo  Uninstall: Apps and Features > TB Admin
echo.
pause
