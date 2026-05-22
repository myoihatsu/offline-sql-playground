@echo off
:: start_def_browser.bat — Launch with default browser (Windows)

set PORT=8765
set DIR=%~dp0

:: Detect Python (python3 or python)
set PY=python3
where %PY% >nul 2>&1
if %errorlevel% neq 0 set PY=python

:: Check if port is in use
netstat -ano | findstr ":%PORT% " | findstr "LISTENING" >nul 2>&1
if %errorlevel% equ 0 (
    echo -^> Port %PORT% already in use, opening browser...
    start http://localhost:%PORT%/index.html
) else (
    echo -^> Starting server on :%PORT% ...
    start /B %PY% -m http.server %PORT% --directory "%DIR%" >nul 2>&1
    timeout /t 1 /nobreak >nul
    echo -^> Opening browser...
    start http://localhost:%PORT%/index.html
    echo -^> Shutting down server...
    for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%PORT% " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
    echo -^> Done.
)
