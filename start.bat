@echo off
title Biplob Shop - POS and Inventory Management
color 0A

:: Always run from the script directory
cd /d "%~dp0"

echo ================================================================
echo    BIPLOB SHOP - MOBILE RETAIL POS AND INVENTORY SYSTEM
echo ================================================================
echo.

:: Add default and local Node installation paths to session PATH
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm;%LOCALAPPDATA%\Programs\node;%~dp0bin"

:: Auto-configure Windows Firewall for Port 3000 if running with Admin privileges
netsh advfirewall firewall add rule name="Biplob Shop POS Port 3000" dir=in action=allow protocol=TCP localport=3000 profile=any >nul 2>&1
powershell -NoProfile -Command "Set-NetConnectionProfile -InterfaceAlias 'Ethernet' -NetworkCategory Private -ErrorAction SilentlyContinue" >nul 2>&1

:: Step 1: Check if Node.js is installed
where node >nul 2>&1
if %errorlevel% neq 0 goto :install_node

:: Step 2: Check if installed Node is at least version 18
node -e "process.exit(parseInt(process.versions.node) >= 18 ? 0 : 1)" >nul 2>&1
if %errorlevel% neq 0 goto :install_node

goto :node_ready

:install_node
echo.
echo ================================================================
echo  [AUTO-SETUP] Node.js is missing or needs an update.
echo  [AUTO-SETUP] Automatically downloading official Node.js LTS...
echo ================================================================
echo.

set "NODE_MSI=%TEMP%\nodejs_installer.msi"

echo [1/2] Downloading Node.js v22 LTS from nodejs.org...
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://nodejs.org/dist/v22.14.0/node-v22.14.0-x64.msi', '%NODE_MSI%')"

if not exist "%NODE_MSI%" goto :download_failed

echo [2/2] Installing Node.js - please click Yes if Windows asks for permission...
msiexec /i "%NODE_MSI%" /passive

:: Refresh PATH in current window
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm"

where node >nul 2>&1
if %errorlevel% equ 0 goto :node_installed

echo.
echo [INFO] Running installer in interactive mode...
start /wait msiexec /i "%NODE_MSI%"
set "PATH=%PATH%;C:\Program Files\nodejs;C:\Program Files (x86)\nodejs;%APPDATA%\npm"

where node >nul 2>&1
if %errorlevel% equ 0 goto :node_installed

goto :install_failed

:node_installed
echo [SETUP] Node.js installed and configured successfully!
echo.
goto :node_ready

:download_failed
color 0C
echo [ERROR] Download failed. Please check your internet connection.
echo You can also manually download and install Node.js from https://nodejs.org/
pause
exit /b 1

:install_failed
color 0C
echo [ERROR] Node.js installation did not complete.
echo Please download and install Node.js manually from https://nodejs.org/
pause
exit /b 1

:node_ready
:: Step 3: Check if dependencies are installed
if exist "node_modules\" goto :run_app

echo [SETUP] Installing project dependencies for first run...
call npm install --no-optional
if %errorlevel% neq 0 goto :npm_failed
echo [SETUP] Dependencies installed successfully.
echo.

:run_app
:: Automatically free Port 3000 if an old background instance is holding it
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING" 2^>nul') do (
    echo [INFO] Freeing Port 3000 from previous background process...
    taskkill /f /pid %%a >nul 2>&1
)

:: Open browser automatically after 2 seconds
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 2; Start-Process 'http://localhost:3000'"

echo [INFO] Starting Biplob Shop Server on port 3000...
echo [INFO] You can minimize this window. Press Ctrl+C to stop the server.
echo.
node server.js
goto :end

:npm_failed
color 0C
echo [ERROR] Dependency installation failed. Please check internet connection.
pause
exit /b 1

:end
pause
