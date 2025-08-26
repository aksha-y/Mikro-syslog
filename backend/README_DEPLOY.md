# Deployment (Windows host, public IP)

## Option A: Local install (recommended on Windows)

1. Install PostgreSQL 16 locally and create DB:
   - DB name: `syslog_portal`
   - User: `syslog`, Password: `syslog`
2. Configure environment:
   - Copy `backend/.env.example` to `backend/.env`
   - Set `DATABASE_URL=postgresql://syslog:syslog@localhost:5432/syslog_portal?schema=public`
   - Set `JWT_SECRET` to a strong value
3. Install dependencies and init schema:
   - PowerShell:
     - Set-Location "c:\Users\admin\Desktop\syslog\backend"; npm install
     - npx prisma generate
     - npx prisma migrate dev --name init
4. Run backend:
   - npm run dev
5. Run frontend:
   - Set-Location "c:\Users\admin\Desktop\syslog\frontend"; npm install; npm run dev
6. Configure firewall to allow UDP 514 inbound to Node.js process.
7. In the UI Settings tab, set your WAN IP and verify devices send syslog to `WAN_IP:514`.

Note: On Windows, running on UDP port 514 may require elevated privileges. If blocked, set `SYSLOG_PORT=5514` in Settings and reconfigure your devices.

## Option B: Docker Compose (development)

1. Install Docker Desktop for Windows
2. PowerShell:
   - Set-Location "c:\Users\admin\Desktop\syslog"; docker compose up -d
3. Backend on: http://localhost:4000; UDP 514 exposed; DB persisted in volume.
4. For production, use a proper reverse proxy and secure secrets.

## Production notes
- Use a strong `JWT_SECRET`.
- Configure SMTP/Twilio env vars to enable alerts.
- Consider running backend as a Windows service (NSSM) so it auto-starts.
- Scale by running multiple backend instances and using a shared DB and Socket.IO adapter (Redis) if needed.