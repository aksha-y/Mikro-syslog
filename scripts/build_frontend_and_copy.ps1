# Build frontend with Vite and copy to backend for static serving
param(
  [string]$FrontendPath = "c:\Users\admin\Desktop\syslog\frontend",
  [string]$BackendPath = "c:\Users\admin\Desktop\syslog\backend"
)

Write-Host "Building frontend..."
Set-Location $FrontendPath
if (!(Test-Path package.json)) { throw "Frontend package.json not found at $FrontendPath" }
if (!(Test-Path node_modules)) { npm install }
npm run build

$dist = Join-Path $FrontendPath 'dist'
$target = Join-Path $BackendPath 'public'

Write-Host "Copying build to $target"
if (!(Test-Path $target)) { New-Item -ItemType Directory -Path $target | Out-Null }
# Clean target
Get-ChildItem -Path $target -Recurse -Force | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
# Copy files
Copy-Item -Path (Join-Path $dist '*') -Destination $target -Recurse -Force

Write-Host "Done. Backend will serve static files from $target"