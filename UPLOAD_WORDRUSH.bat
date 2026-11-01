@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
if not exist "tools\upload_materials.py" (
 echo ERROR: Run this BAT from the cloned kasb_uz folder.
 pause
 exit /b 1
)
set "PACK=%~1"
if "%PACK%"=="" set "PACK=%~dp0WORDRUSH_IELTS_Materials_Complete.zip"
python tools\upload_materials.py "%PACK%"
if errorlevel 1 (
 echo Upload stopped. Check errors above and your GitHub sign-in.
 pause
 exit /b 1
)
echo All materials uploaded successfully.
pause
