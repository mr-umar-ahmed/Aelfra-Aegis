@echo off
title Aelfra Aegis Demo Control Panel

:MENU
cls
echo ========================================
echo        AELFRA AEGIS CONTROL PANEL
echo ========================================
echo.
echo 1. Start All Services (Dashboard, Listener, Daemon)
echo 2. Run Attack: Credential Theft
echo 3. Run Attack: Reverse Shell
echo 4. Run Attack: Cryptominer
echo 5. Stop All Services
echo 6. Exit
echo.
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto START_SERVICES
if "%choice%"=="2" goto RUN_CRED
if "%choice%"=="3" goto RUN_SHELL
if "%choice%"=="4" goto RUN_MINER
if "%choice%"=="5" goto STOP_SERVICES
if "%choice%"=="6" goto EOF

:START_SERVICES
echo.
echo Stopping any old services first...
wsl -d Ubuntu -e bash -c "sudo pkill -f 'python3 ebpf/daemon.py'; pkill -f 'python3 simulator/listener.py'; pkill -f 'npm run dev'; pkill -f node" >nul 2>&1

echo Starting C2 Listener...
start /b wsl -d Ubuntu --cd ~/projects/Aelfra-Aegis -e bash -c "python3 simulator/listener.py"

echo Starting Next.js Dashboard...
start /b wsl -d Ubuntu --cd ~/projects/Aelfra-Aegis -e bash -c "cd dashboard && npm run dev"

echo Starting eBPF Daemon (A new window will open for sudo)...
start "Aegis eBPF Daemon" wsl -d Ubuntu --cd ~/projects/Aelfra-Aegis -e bash -c "sudo python3 ebpf/daemon.py"

echo.
echo Waiting 5 seconds for services to initialize...
timeout /t 5 >nul

echo Opening browser...
start http://localhost:3000
goto MENU

:RUN_CRED
echo.
echo Launching Credential Theft Attack...
wsl -d Ubuntu --cd ~/projects/Aelfra-Aegis -e bash simulator/run-attack.sh cred-theft
echo.
pause
goto MENU

:RUN_SHELL
echo.
echo Launching Reverse Shell Attack...
wsl -d Ubuntu --cd ~/projects/Aelfra-Aegis -e bash simulator/run-attack.sh reverse-shell
echo.
pause
goto MENU

:RUN_MINER
echo.
echo Launching Cryptominer Attack...
wsl -d Ubuntu --cd ~/projects/Aelfra-Aegis -e bash simulator/run-attack.sh cryptominer
echo.
pause
goto MENU

:STOP_SERVICES
echo.
echo Stopping all WSL processes...
wsl -d Ubuntu -e bash -c "sudo pkill -f 'python3 ebpf/daemon.py'; pkill -f 'python3 simulator/listener.py'; pkill -f 'npm run dev'; pkill -f node"
echo Services stopped successfully.
pause
goto MENU

:EOF
exit
