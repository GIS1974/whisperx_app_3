@echo off
echo Starting RepeatAfter.Me Development Servers...
echo.

echo Starting Django backend server...
start "Django Backend" cmd /k "cd /d %~dp0 && python manage.py runserver"

echo Waiting for Django to start...
timeout /t 3 /nobreak > nul

echo Starting React frontend server...
start "React Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo Development servers are starting...
echo Backend: http://localhost:8000
echo Frontend: http://localhost:3000
echo.
echo Press any key to exit...
pause > nul
