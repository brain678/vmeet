@echo off
REM Change directory to your backend folder
cd /d "C:\Users\HP\Desktop\backups\7\Vmeetnew\backend"

REM Start backend server in a new window
start "Backend" cmd /k "uvicorn main:app --reload"

REM Wait a few seconds to ensure backend starts
ping 127.0.0.1 -n 6 > nul

REM Start ngrok in a new window with your reserved domain
start "ngrok" cmd /k "ngrok http --domain=cool-snapper-hip.ngrok-free.app 8000"

REM Optional: exit this script window
exit
