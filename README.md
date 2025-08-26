# Mikro-syslog

A full-stack system for receiving, storing, and managing MikroTik syslog data with identity discovery tools.

## Features
- **Syslog ingestion**: Backend service to receive and parse logs
- **Device discovery**: Fetch RouterOS identity via API/REST/WebFig/SSH
- **Web UI**: React/Vite frontend to browse logs and devices
- **SQLite/Prisma**: Simple persistence for development

## Project Structure
```
.
├── backend/              # Node.js Express API and services
│   ├── src/              # Source code
│   ├── prisma/           # Prisma schema and migrations
│   ├── public/           # Static assets (served by backend)
│   └── .env.example      # Backend environment template
├── frontend/             # React (Vite) app
│   ├── src/
│   ├── public/
│   └── package.json
├── scripts/              # Helper scripts
└── docker-compose.yml    # Optional Docker configuration
```

## Prerequisites
- Node.js 18+
- Git
- (Optional) Docker

## Backend Setup
1. Copy environment template and configure:
   ```powershell
   Copy-Item "backend/.env.example" "backend/.env"
   # Edit backend/.env and set MT_USER, MT_PASS, MT_API_PORT, JWT_SECRET, etc.
   ```
2. Install dependencies and run:
   ```powershell
   Set-Location backend
   npm install
   npx prisma migrate deploy
   npm run dev
   ```

## Frontend Setup
```powershell
Set-Location frontend
npm install
npm run dev
```

## Push to GitHub
Use the helper script to push the project (prompts for a GitHub token with repo scope):
```powershell
powershell -ExecutionPolicy Bypass -File "scripts/push_to_github.ps1" -RepoUrl "https://github.com/aksha-y/Mikro-syslog.git" -Branch main -UseToken
```

## Notes
- The `.gitignore` excludes secrets (`.env`), `node_modules`, build artifacts, and Prisma dev database.
- If the remote repo already has commits, fetch/rebase before pushing.
- For production, configure a proper database and secure credentials.