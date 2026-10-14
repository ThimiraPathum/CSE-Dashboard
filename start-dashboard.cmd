@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-dashboard.ps1" %*
set "dashboard_exit=%errorlevel%"
if not "%dashboard_exit%"=="0" pause
exit /b %dashboard_exit%
