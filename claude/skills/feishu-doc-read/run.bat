@echo off
setlocal

:: Feishu Doc Read Skill Entry Script (Windows Batch)

:: ==================== Configuration ====================
set "SCRIPT_DIR=%~dp0"
:: Remove trailing backslash
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

:: ==================== Dependency Check ====================
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js not found. Please install Node.js first.
    exit /b 1
)

:: ==================== Dependency Install ====================
if not exist "%SCRIPT_DIR%\node_modules" (
    echo First run, installing dependencies...
    pushd "%SCRIPT_DIR%"
    call npm install --silent
    if %ERRORLEVEL% neq 0 (
        echo Dependency install failed. Please run manually: cd "%SCRIPT_DIR%" && npm install
        popd
        exit /b 1
    )
    echo Dependencies installed.
    popd
)

:: ==================== Argument Check ====================
if "%~1"=="" (
    echo Usage: %~nx0 [--no-save] [--with-images] ^<Feishu_URL^>
    echo.
    echo Options:
    echo   --no-save      Do not save file, only output Markdown
    echo   --with-images  Include images (requires multimodal model support)
    echo.
    echo Example:
    echo   %~nx0 "https://xxx.feishu.cn/wiki/xxx"
    exit /b 1
)

:: ==================== Run ====================
if not exist "%USERPROFILE%\.feishu\credentials.json" (
    echo Info: First time use detected. Browser will open for Feishu authentication...
    echo Please confirm authorization in the browser window.
    echo.
)

node "%SCRIPT_DIR%\skill.js" %*

endlocal
