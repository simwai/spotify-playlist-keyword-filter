@title NordVPN Connect by simwai
@echo off
if not "%1"=="am_admin" (powershell start -verb runas '%0' am_admin & exit /b)
cd "C:\Program Files (x86)\NordVPN"
nordvpn -d 
nordvpn -c -g "United States"
exit