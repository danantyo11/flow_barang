@echo off
title FlowRequest Pro - Aplikasi Windows
cd /d "%~dp0"
echo =========================================================
echo   FlowRequest Pro - Aplikasi Permohonan & Otorisasi Barang
echo   Tampilan Windows Desktop Fluent UI
echo =========================================================
echo Sedang menyiapkan dan membuka aplikasi desktop...

:: Cek apakah server sudah aktif
netstat -ano | findstr :3300 >nul
if %ERRORLEVEL% equ 0 (
    echo Server aktif di port 3300. Membuka jendela aplikasi...
    start "" "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --app=http://localhost:3300 --window-size=1366,860
    exit
)

:: Jika belum aktif, luncurkan desktop launcher
start "" node desktop-launcher.js
exit
