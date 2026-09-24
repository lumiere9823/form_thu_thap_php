@echo off
title Khoi Chay Landing Page Thu Thap Du Lieu
echo =======================================================
echo    DANG KHOI CHAY HE THONG LANDING PAGE THU THAP DU LIEU
echo =======================================================
echo.
echo May chu dang chay tai: http://127.0.0.1:8088
echo.
echo Trang Landing Page:     http://127.0.0.1:8088
echo Trang Quan tri Webhook: http://127.0.0.1:8088/admin.php
echo =======================================================
echo.

start "" "http://127.0.0.1:8088"

where php >nul 2>nul
if %errorlevel% equ 0 (
    php -S 127.0.0.1:8088 router.php
) else (
    echo LOI: Khong tim thay PHP trong PATH.
    echo Hay cai PHP 8.1 tro len va chay lai.
)

pause
