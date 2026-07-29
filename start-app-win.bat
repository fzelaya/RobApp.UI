@echo off
setlocal enabledelayedexpansion

:: start-app-win.bat - starts the Strategy Report Extractor web app on Windows.
:: Works from cmd.exe, PowerShell, or by double-clicking in Explorer.
::
:: Usage:
::   start-app-win.bat            starts on the default port (3000)
::   start-app-win.bat 8080       starts on port 8080
::   (or: set PORT=8080  then run start-app-win.bat)

:: --- Resolve the project root regardless of where this is run from ---
cd /d "%~dp0"

echo ==^> Checking prerequisites...

where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: Node.js is not installed or not on your PATH.
    echo Download it from: https://nodejs.org/en/download
    echo ^(npm is bundled with the Node.js installer, so installing Node also installs npm.^)
    echo.
    pause
    exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
    echo.
    echo ERROR: npm is not installed or not on your PATH.
    echo npm is bundled with Node.js -- reinstall Node from: https://nodejs.org/en/download
    echo See also: https://www.npmjs.com/
    echo.
    pause
    exit /b 1
)

for /f "delims=" %%v in ('node --version') do set NODE_VERSION=%%v
for /f "delims=" %%v in ('npm --version') do set NPM_VERSION=%%v
echo ==^> Using Node.js %NODE_VERSION%, npm %NPM_VERSION%

:: --- Install dependencies if needed ---
if not exist "node_modules" (
    echo ==^> Installing dependencies ^(first run^)...
    call npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed. See the output above.
        pause
        exit /b 1
    )
) else (
    echo ==^> Dependencies already installed ^(node_modules found^).
)

:: --- Build TypeScript ---
echo ==^> Building...
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Build failed. See the output above.
    pause
    exit /b 1
)

:: --- Ensure the shared data directory exists ---
if not exist "data" mkdir "data"

:: --- Determine port: command-line arg > existing PORT env var > default 3000 ---
if not "%~1"=="" (
    set PORT=%~1
) else (
    if "%PORT%"=="" set PORT=3000
)

echo ==^> Starting server on http://localhost:%PORT% ...
echo Press Ctrl+C to stop.
echo.

call npm run serve
if errorlevel 1 (
    echo.
    echo ERROR: The server exited with an error. See the output above.
    pause
    exit /b 1
)

endlocal
