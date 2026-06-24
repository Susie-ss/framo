@echo off
title Axure Plugin Build (Windows)
echo.
echo [Axure Sync Plugin - Build Windows Installer]
echo.

cd /d "%~dp0"

:: Clean manifest
if exist "manifest.json" (
    echo [1/4] Deleting manifest cache...
    del /q "manifest.json" >nul 2>&1
)

:: Check deps
if not exist "node_modules\" (
    echo [2/4] Installing dependencies...
    call npm install
) else (
    echo [2/4] Dependencies OK
)

:: Clean old build
if exist "dist\win\" (
    echo [Clean] Removing old Windows build...
    rmdir /s /q "dist\win" 2>nul
)

:: Build
echo [3/4] Building (may take 3-5 min)...
set ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
call npx electron-builder --win --x64 --config.directories.output="dist/win"

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FAIL] Build error!
    pause
    exit /b 1
)

:: Clean debug files
echo.
echo [4/4] Build complete!
echo [Clean] Removing debug files...
del /q "dist\win\builder-debug.yml" 2>nul
del /q "dist\win\builder-effective-config.yaml" 2>nul

echo.
echo Output: dist\win\
dir "dist\win\*.exe" 2>nul
dir "dist\win\*.zip" 2>nul
echo.
echo   AxureSyncService Setup 1.0.0.exe  - Installer (double-click to install)
echo   win-unpacked\                      - Portable (copy anywhere to run)
echo   AxureSyncService-1.0.0-win.zip     - Portable zip archive
echo.
pause
