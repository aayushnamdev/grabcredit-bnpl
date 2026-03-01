@echo off
REM GrabCredit BNPL — one-command demo setup (Windows)
REM Usage: scripts\demo.bat

setlocal EnableDelayedExpansion

echo.
echo   GrabCredit BNPL — Demo Setup (Windows)
echo   ----------------------------------------

REM ── 1. Node.js check ──────────────────────────────────────────────────────
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo   [ERROR] Node.js not found. Install Node.js 18+ from https://nodejs.org
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo   [OK] Node.js %NODE_VERSION%

REM ── 2. Check for .env.local ───────────────────────────────────────────────
if not exist "web-app\.env.local" (
    if exist ".env.example" (
        copy ".env.example" "web-app\.env.local" >nul
        echo   [INFO] Created web-app\.env.local from .env.example
        echo   [WARN] Edit web-app\.env.local and add your ANTHROPIC_API_KEY
    ) else (
        echo   [WARN] web-app\.env.local not found — Claude narratives will be disabled
    )
) else (
    echo   [OK] web-app\.env.local found
)

REM ── 3. Build MCP server ───────────────────────────────────────────────────
echo.
echo   Installing MCP server dependencies...
cd mcp-server
call npm install --silent
if %errorlevel% neq 0 ( echo   [ERROR] npm install failed in mcp-server & exit /b 1 )

echo   Building MCP server...
call npm run build
if %errorlevel% neq 0 ( echo   [ERROR] Build failed & exit /b 1 )
echo   [OK] MCP server compiled to dist\
cd ..

REM ── 4. Install web-app ────────────────────────────────────────────────────
echo.
echo   Installing web-app dependencies...
cd web-app
call npm install --silent
if %errorlevel% neq 0 ( echo   [ERROR] npm install failed in web-app & exit /b 1 )
echo   [OK] Web app dependencies installed

REM ── 5. Launch ─────────────────────────────────────────────────────────────
echo.
echo   Everything ready — starting web app...
echo   Open: http://localhost:3000
echo   Press Ctrl+C to stop
echo.

call npm run dev
