#!/usr/bin/env bash

# Set directory to script folder
cd "$(dirname "$0")"

echo "================================================================"
echo "   BIPLOB SHOP - MOBILE RETAIL POS AND INVENTORY SYSTEM"
echo "================================================================"
echo ""

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo "[AUTO-SETUP] Node.js is not found on your Mac."
    echo "[AUTO-SETUP] Downloading official Node.js (LTS) installer..."
    curl -o "/tmp/node_installer.pkg" "https://nodejs.org/dist/v22.14.0/node-v22.14.0.pkg"
    
    if [ -f "/tmp/node_installer.pkg" ]; then
        echo "[AUTO-SETUP] Opening installer package. Please complete the installation."
        open -W "/tmp/node_installer.pkg"
    else
        echo "[ERROR] Download failed. Please install Node.js from https://nodejs.org/"
        read -p "Press Enter to exit..."
        exit 1
    fi
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "[SETUP] Installing project dependencies for first run..."
    npm install --no-optional
    if [ $? -ne 0 ]; then
        echo "[ERROR] npm install failed."
        read -p "Press Enter to exit..."
        exit 1
    fi
    echo "[SETUP] Dependencies installed successfully!"
    echo ""
fi

# Open browser in background
(sleep 2 && (open "http://localhost:3000" 2>/dev/null || xdg-open "http://localhost:3000" 2>/dev/null)) &

# Start Express server
echo "[INFO] Starting Biplob Shop Server on port 3000..."
node server.js
