@echo off
TITLE Spotter - Weather-Aware Truck Routing Launcher
COLOR 0A

echo ======================================================================
echo           SPOTTER - WEATHER-AWARE TRUCK ROUTING LAUNCHER
echo ======================================================================
echo.

cd /d "%~dp0"

echo [1/3] Starting Django Backend server on http://localhost:8000...
start "Spotter Backend (Django - Port 8000)" cmd /k "cd backend && python manage.py runserver 0.0.0.0:8000"

echo [2/3] Starting React Frontend server on http://localhost:3000...
start "Spotter Frontend (React - Port 3000)" cmd /k "cd frontend && npm start"

echo [3/3] Waiting for servers to initialize...
timeout /t 5 /nobreak >nul

echo.
echo Launching Spotter in your default web browser...
start http://localhost:3000

echo.
echo ======================================================================
echo Spotter services are running!
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:8000/api/
echo - Health:   http://localhost:8000/api/health/
echo ======================================================================
echo Keep the backend and frontend terminal windows open while testing.
echo Press any key to close this launcher script.
pause >nul
