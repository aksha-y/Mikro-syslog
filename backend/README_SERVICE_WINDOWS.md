# Run backend as a Windows service (NSSM)

## Prerequisites
- Install NSSM (Non-Sucking Service Manager): https://nssm.cc/
  - Typically installs at `C:\\Program Files\\nssm\\win64\\nssm.exe`
- Install Node.js 20+
- PostgreSQL running and reachable

## One-time installation
1. Open PowerShell as Administrator
2. Run:
   - Set-Location "c:\\Users\\admin\\Desktop\\syslog"
   - powershell -ExecutionPolicy Bypass -File .\\scripts\\install_backend_service.ps1 -ServiceName "SyslogPortalBackend"

This will:
- Install Node deps
- Run Prisma migrations
- Build the frontend and copy to backend/public
- Install the service via NSSM and start it
- Open Windows Firewall inbound UDP 514

## Managing the service
- Start: `nssm start SyslogPortalBackend`
- Stop: `nssm stop SyslogPortalBackend`
- Remove: `nssm remove SyslogPortalBackend confirm`

## Changing environment variables later
Use NSSM GUI:
- `nssm edit SyslogPortalBackend`
Update `AppEnvironmentExtra` values and restart the service.

## Notes
- If port 514 cannot bind without admin, either run the service as Local System or change `SYSLOG_PORT` to `5514` and adjust your devices.
- Frontend is served statically at the same port as backend (`/`).
- Settings (WAN IP, syslog host/port) can be updated in the UI. Restart service for UDP changes.