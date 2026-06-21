@echo off
:: ============================================================
::  TB Admin — Uninstaller
::  Run as Administrator
:: ============================================================

net session >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Please right-click and select "Run as administrator"
  pause
  exit /b 1
)

echo.
echo ========================================
echo  Uninstalling TB Admin...
echo ========================================

set INSTALL_DIR=%ProgramFiles%\TB Admin

echo Removing files...
if exist "%INSTALL_DIR%" (
  cd /d "%~dp0"
  rmdir /S /Q "%INSTALL_DIR%"
)

echo Removing Desktop shortcut...
if exist "%PUBLIC%\Desktop\TB Admin.lnk" del /F /Q "%PUBLIC%\Desktop\TB Admin.lnk"

echo Removing Start Menu shortcut...
if exist "%ProgramData%\Microsoft\Windows\Start Menu\Programs\TeachingBoard\TB Admin.lnk" (
  del /F /Q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\TeachingBoard\TB Admin.lnk"
  rmdir /Q "%ProgramData%\Microsoft\Windows\Start Menu\Programs\TeachingBoard" 2>nul
)

echo Removing from Apps and Features...
reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TBAdmin" /f >nul 2>&1

echo.
echo ========================================
echo  TB Admin uninstalled successfully!
echo ========================================
echo.
pause
