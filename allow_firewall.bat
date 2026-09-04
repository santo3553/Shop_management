@echo off
title Allow Biplob Shop Through Windows Firewall
color 0A

:: Check for Administrator rights and self-elevate
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [NOTICE] Requesting Administrator privileges to configure Windows Firewall...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

echo ================================================================
echo    CONFIGURING WINDOWS FIREWALL FOR BIPLOB SHOP (PORT 3000)
echo ================================================================
echo.

:: Remove any conflicting rule and add allow rule for Port 3000
netsh advfirewall firewall delete rule name="Biplob Shop POS Port 3000" >nul 2>&1
netsh advfirewall firewall add rule name="Biplob Shop POS Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any

:: Set Ethernet to Private profile so Windows allows local traffic
powershell -Command "Set-NetConnectionProfile -InterfaceAlias 'Ethernet' -NetworkCategory Private -ErrorAction SilentlyContinue"

echo.
echo ================================================================
echo  [SUCCESS] Port 3000 is now ALLOWED through Windows Firewall!
echo  [SUCCESS] Network profile set to Private.
echo ================================================================
echo.
echo You can now open http://192.168.0.103:3000 on your phone!
echo.
pause
