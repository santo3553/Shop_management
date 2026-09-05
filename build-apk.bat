@echo off
title Biplob Shop - Build Android APK
echo ===================================================
echo   BIPLOB SHOP - COMPILING ANDROID APK
echo ===================================================
echo.
set "ANDROID_HOME=C:\Users\santo\AppData\Local\Android\Sdk"
set "ANDROID_SDK_ROOT=C:\Users\santo\AppData\Local\Android\Sdk"
echo [1/3] Syncing latest web assets...
call npx cap sync android
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Capacitor sync failed!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/3] Building native Android Debug APK...
cd android
call gradlew.bat assembleDebug
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Gradle build failed!
    cd ..
    pause
    exit /b %ERRORLEVEL%
)
cd ..

echo.
echo [3/3] Copying APK to root directory...
copy /Y "android\app\build\outputs\apk\debug\app-debug.apk" "Biplob-Shop-POS.apk"

echo.
echo ===================================================
echo   BUILD SUCCESSFUL!
echo   APK File: Biplob-Shop-POS.apk
echo   Install this APK directly on any Android phone.
echo ===================================================
pause
