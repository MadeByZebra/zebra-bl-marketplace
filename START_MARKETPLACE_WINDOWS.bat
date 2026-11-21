@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or later is required. Install from https://nodejs.org/
  pause
  exit /b 1
)
if not exist .env (
  copy .env.example .env >nul
  echo Created .env; Stripe payments remain locked until you configure it.
)
if not exist node_modules (
  echo Installing project dependencies...
  call npm install
  if errorlevel 1 (
    echo Installation failed. Check your internet connection and npm installation.
    pause
    exit /b 1
  )
)
echo Starting BL Scripts Marketplace on http://localhost:3000
start "BL Scripts Browser" cmd /c "timeout /t 4 /nobreak >nul & start http://localhost:3000"
call npm start
pause
