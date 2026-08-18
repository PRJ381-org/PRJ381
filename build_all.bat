@echo off
:: 1. Define your paths
set UE5_PATH="C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\RunUAT.bat"
set PROJECT_PATH="%~dp0PRJ381.uproject"
set OUTPUT_DIR="%~dp0Builds"

echo ========================================================
echo Packaging Windows Desktop Executable
echo ========================================================
call %UE5_PATH% BuildCookRun -project=%PROJECT_PATH% -noP4 -platform=Win64 -clientconfig=Shipping -cook -allmaps -build -stage -pak -archive -archivedirectory="%OUTPUT_DIR%\Desktop"

echo ========================================================
echo Packaging Android Mobile APK
echo ========================================================
call %UE5_PATH% BuildCookRun -project=%PROJECT_PATH% -noP4 -platform=Android -cookflavor=ASTC -clientconfig=Shipping -cook -allmaps -build -stage -pak -package -archive -archivedirectory="%OUTPUT_DIR%\Mobile"

echo ========================================================
echo Packaging Meta Quest 3 VR APK
echo ========================================================
call %UE5_PATH% BuildCookRun -project=%PROJECT_PATH% -noP4 -platform=Android -cookflavor=ASTC -clientconfig=Shipping -cook -allmaps -build -stage -pak -package -archive -archivedirectory="%OUTPUT_DIR%\Quest3"

echo ========================================================
echo All Builds Completed Successfully!
echo ========================================================
pause