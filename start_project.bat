@echo off
echo ========================================================
echo        Starting AI Resume Screener (Demo Mode)
echo ========================================================
echo.

:: Check if .env exists
if not exist .env (
    echo [WARNING] No .env file found! Copying .env.example to .env...
    copy .env.example .env
    echo Please make sure to add your GOOGLE_API_KEY in .env
    echo.
)

echo [1/2] Launching Backend Server on http://127.0.0.1:5000 ...
start "Resume Screener - Backend" cmd /k "python backend\app.py"

echo [2/2] Launching Frontend Development Server on http://localhost:5173 ...
start "Resume Screener - Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================================
echo  Both services launched in separate windows!
echo  - Frontend: http://localhost:5173
echo  - Backend:  http://127.0.0.1:5000
echo ========================================================
echo.
pause
