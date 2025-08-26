param(
  [string]$RepoUrl = "https://github.com/aksha-y/Mikro-syslog.git",
  [string]$Branch = "main",
  [string]$UserName = "",     # Optional: git user.name
  [string]$Email = "",        # Optional: git user.email
  [switch]$UseToken,           # If set, prompts for a GitHub token to use for push
  [string]$Token               # Optional: provide PAT non-interactively
)

$ErrorActionPreference = 'Stop'

function Ensure-Command($name) {
  try { & $name --version | Out-Null } catch { throw "'$name' is not installed or not in PATH." }
}

try {
  Write-Host "Switching to project directory..."
  Set-Location "c:\Users\admin\Desktop\syslog"

  Write-Host "Checking git installation..."
  Ensure-Command git

  # Initialize repo if needed
  if (-not (Test-Path ".git")) {
    Write-Host "Initializing git repository..."
    git init | Out-Null
  } else {
    Write-Host "Git repository already initialized."
  }

  # Configure identity if provided
  if ($UserName) { git config user.name $UserName }
  if ($Email) { git config user.email $Email }

  # Ensure target branch
  $currentBranch = (git branch --show-current) 2>$null
  if (-not $currentBranch) {
    Write-Host "Creating branch '$Branch'..."
    git checkout -b $Branch | Out-Null
  } elseif ($currentBranch -ne $Branch) {
    Write-Host "Renaming/switching to '$Branch'..."
    git branch -M $Branch | Out-Null
  } else {
    Write-Host "On branch '$Branch'"
  }

  # Avoid committing secrets and build artifacts without changing repo files
  $excludeDir = ".git\info"
  $excludePath = Join-Path $excludeDir "exclude"
  if (-not (Test-Path $excludeDir)) { New-Item -ItemType Directory -Path $excludeDir -Force | Out-Null }
  $excludeContent = @"
backend/.env
backend/.env.*
backend/logs/
backend/prisma/dev.db
frontend/node_modules/
backend/node_modules/
frontend/dist/
.DS_Store
Thumbs.db
"@
  Write-Host "Updating .git/info/exclude to skip secrets and artifacts..."
  if (-not (Test-Path $excludePath)) {
    Set-Content -Path $excludePath -Value $excludeContent -Encoding UTF8
  } else {
    # Append only lines not already present
    $existing = Get-Content -Path $excludePath -ErrorAction SilentlyContinue
    ($excludeContent -split "`r?`n") | ForEach-Object {
      if ($_ -and ($existing -notcontains $_)) { Add-Content -Path $excludePath -Value $_ }
    }
  }

  # Stage and commit changes if any
  Write-Host "Staging files..."
  git add .
  $status = (git status --porcelain)
  if (-not $status) {
    Write-Host "No changes to commit."
  } else {
    Write-Host "Committing..."
    git commit -m "Project upload" | Out-Null
  }

  # Configure remote
  Write-Host "Configuring remote 'origin' -> $RepoUrl"
  $remotes = (git remote) 2>$null
  if ($remotes -contains "origin") {
    git remote set-url origin $RepoUrl | Out-Null
  } else {
    git remote add origin $RepoUrl | Out-Null
  }

  # Optional: use token for push
  $urlResetNeeded = $false
  if ($UseToken -or $Token) {
    Write-Host "A GitHub Personal Access Token will be used for this push. It won't be saved."
    $plainToken = $Token
    if (-not $plainToken) {
      $secToken = Read-Host "Enter GitHub Personal Access Token (repo scope)" -AsSecureString
      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secToken)
      $plainToken = [Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)
    }
    # Use GitHub recommended pattern for PATs
    $ghUser = if ($Token) { "x-access-token" } elseif ($UserName) { $UserName } else { Read-Host "Enter GitHub username" }
    $urlWithCreds = $RepoUrl -replace '^https://', ("https://{0}:{1}@" -f $ghUser, $plainToken)
    git remote set-url origin $urlWithCreds | Out-Null
    $urlResetNeeded = $true
  }

  # Attempt push
  Write-Host "Pushing to '$Branch'..."
  git push -u origin $Branch
  if (-not $?) {
    throw "Git push failed. Check token permissions or remote access."
  }

  # Reset remote URL if token was injected
  if ($urlResetNeeded) {
    git remote set-url origin $RepoUrl | Out-Null
  }

  Write-Host "Done. Repository pushed to $RepoUrl" -ForegroundColor Green
}
catch {
  Write-Error $_
  exit 1
}