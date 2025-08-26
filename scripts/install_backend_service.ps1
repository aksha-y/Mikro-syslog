param(
  [string]$ServiceName = "SyslogPortalBackend",
  [string]$BackendPath = "c:\Users\admin\Desktop\syslog\backend",
  [string]$NodeExe = "node",
  [string]$NssmExe = "C:\Program Files\nssm\win64\nssm.exe"
)

# Ensure NSSM exists
if (!(Test-Path $NssmExe)) {
  Write-Error "NSSM not found at $NssmExe. Install NSSM (https://nssm.cc/) and adjust the path."
  exit 1
}

# Ensure dependencies installed
Set-Location $BackendPath
if (!(Test-Path package.json)) { Write-Error "backend package.json not found"; exit 1 }
if (!(Test-Path node_modules)) { npm install }

# Ensure Prisma is migrated
npx prisma generate
npx prisma migrate deploy

# Build frontend and copy into backend/public if exists
$buildScript = "c:\Users\admin\Desktop\syslog\scripts\build_frontend_and_copy.ps1"
if (Test-Path $buildScript) {
  & $buildScript
}

# Create service
& $NssmExe install $ServiceName $NodeExe "src/index.js"
& $NssmExe set $ServiceName AppDirectory $BackendPath
& $NssmExe set $ServiceName AppStopMethodSkip 6
& $NssmExe set $ServiceName Start SERVICE_AUTO_START

# Environment variables (edit as needed)
& $NssmExe set $ServiceName AppEnvironmentExtra "PORT=4000" "JWT_SECRET=change_me" "DATABASE_URL=postgresql://syslog:syslog@localhost:5432/syslog_portal?schema=public" "SYSLOG_HOST=0.0.0.0" "SYSLOG_PORT=514" "CORS_ORIGIN=*"

# Open UDP 514 on Windows Firewall (requires admin)
Try {
  New-NetFirewallRule -DisplayName "Syslog UDP 514" -Direction Inbound -Protocol UDP -LocalPort 514 -Action Allow -Profile Any -ErrorAction Stop | Out-Null
} Catch {}

# Start service
& $NssmExe start $ServiceName
Write-Host "Service $ServiceName installed and started."