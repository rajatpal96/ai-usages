# AgentPulse & AgentMeter: Complete Run & Deployment Guide

This guide covers everything you need to **run locally**, **deploy to production (Vercel, Docker, Cloud)**, and **connect AI coding agents** (Claude Code, GitHub Copilot, Gemini/Antigravity, Codex, Grok).

---

## 🏛️ Architecture Overview

AgentPulse separates telemetry collection from metric queries:

- **Telemetry Plane**: Coding Agents ➔ Local Collector (SQLite queue) ➔ HTTPS ➔ Ingestion API (`:4001`) ➔ MongoDB.
- **Worker Plane**: Background Worker reads new events with checkpoints and updates `usage_hourly`, `usage_daily`, `sessions`, and `budgets`.
- **Query Plane**: Standalone Web Dashboard (`agent-pulse-ui`) and Zero-DB MCP Clients query the Usage & Analytics REST API (`:4000`).

```
DEVELOPER MACHINE                                  CENTRAL BACKEND (ai-usages)
┌───────────────────────────────┐                  ┌─────────────────────────────────────┐
│ AI Coding Agents (Claude, etc)│                  │ Ingestion Service (Port 4001)       │
│               │               │                  │ Usage & Analytics API (Port 4000)   │
│               ▼               │                  │ Background Rollup Worker            │
│ Local Collector (SQLite Queue)│───(HTTPS Batch)─▶│ MongoDB Database                    │
│               │               │                  └──────────────────┬──────────────────┘
│               ▼               │                                     │ REST (:4000)
│ Zero-DB MCP Server Client     │◀──(HTTP Queries)────────────────────┤
└───────────────────────────────┘                                     ▼
                                                   ┌─────────────────────────────────────┐
                                                   │ Standalone UI (agent-pulse-ui :3000)│
                                                   └─────────────────────────────────────┘
```

---

## ⚡ 1. Local Development (Fastest Zero-Dependency Mode)

*Zero external dependencies required — automatically engages in-memory database and streaming fallbacks if local MongoDB is not running.*

### Terminal 1: Start Central Backend
```bash
cd /Users/batu/Downloads/ai-usages
npm start
```
Starts:
- 📊 **Usage & Analytics API**: `http://localhost:4000`
- ⚡ **Ingestion Service & LLM Proxy**: `http://localhost:4001`
- ⚙️ **Background Rollup Worker**: Active

### Terminal 2: Start Standalone UI Dashboard
```bash
cd /Users/batu/Downloads/agent-pulse-ui
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### Terminal 3: Connect Coding Agents
```bash
# Connect Claude Code (automatically installs telemetry hooks)
npx @rajatpal96/agentpulse connect claude

# Connect GitHub Copilot
npx @rajatpal96/agentpulse connect copilot

# Connect Antigravity / Gemini
npx @rajatpal96/agentpulse connect antigravity

# Run health diagnostics
npx @rajatpal96/agentpulse doctor
```

---

## 🧪 2. Automated Test Suite

Run the comprehensive test suite verifying all 8 platform layers:
```bash
cd /Users/batu/Downloads/ai-usages
npm test
```
Validates:
1. MongoDB Fleet Seeding
2. Dynamic Pricing Engine (Anthropic, OpenAI, Google, xAI)
3. 5 Agent Telemetry Adapters
4. Local Collector SQLite WAL Queue & Batch Ingestion
5. Enterprise Identity Layer SSO (Google, GitHub, Microsoft, SAML 2.0)
6. RBAC Authorization Layer Guards
7. Zero-DB Lightweight HTTP MCP Server
8. Real-time Event Streaming

---

## 🚀 3. Production Deployment

### A. Deploy UI Dashboard (`agent-pulse-ui`) ➔ **Vercel**

1. Push `/Users/batu/Downloads/agent-pulse-ui` to your GitHub repo.
2. In [Vercel Dashboard](https://vercel.com) ➔ **Add New Project** ➔ Select `agent-pulse-ui`.
3. Add Environment Variables:
   ```env
   NEXT_PUBLIC_API_BASE_URL=https://api.yourcompany.com
   NEXT_PUBLIC_INGEST_BASE_URL=https://ingest.yourcompany.com
   ```
4. Click **Deploy**. Vercel will build and serve it globally with edge CDN.

---

### B. Deploy Backend Services (`ai-usages`) ➔ **Docker / VM / Cloud**

#### Option 1: Docker Compose (Single VM, AWS EC2, DigitalOcean, or Hetzner)
```bash
cd /Users/batu/Downloads/ai-usages
docker compose -f infrastructure/docker/docker-compose.yml up -d --build
```
Includes:
- MongoDB container (`:27017`)
- Ingestion API container (`:4001`)
- Usage & Analytics API container (`:4000`)
- Background Worker container
- Dashboard container (`:3000`)

To stop:
```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

### C. Deploy Backend to AWS EC2 (Step-by-Step)

#### 1. Launch EC2 Instance
- **AMI**: Ubuntu 22.04 LTS (x86_64)
- **Instance Type**: `t3.small` (2 GB RAM) or `t3.medium`
- **Security Group**: Allow SSH (22), HTTP (80), HTTPS (443).

#### 2. SSH into EC2 & Install Node.js + PM2
```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP

# Install Node.js 20 LTS & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt update && sudo apt install -y nodejs git build-essential nginx certbot python3-certbot-nginx
sudo npm install -g pm2
```

#### 3. Clone Repository & Build
```bash
git clone https://github.com/your-org/ai-usages.git
cd ai-usages
npm install
npm run build
```

#### 4. Configure Production Environment
Create `.env`:
```bash
cat > .env << 'EOF'
NODE_ENV=production
API_PORT=4000
INGESTION_PORT=4001
DEFAULT_ORG_ID=org_default
JWT_SECRET=your-secure-32-char-secret-key-here
MONGODB_URI=mongodb+srv://username:password@cluster0.yourcompany.mongodb.net/agentmeter?retryWrites=true&w=majority
EOF
```

#### 5. Start Backend Services with PM2 (Auto-Restart on Reboot)
```bash
# Start API, Ingestion, and Worker
pm2 start npx --name "agentpulse-api" -- tsx apps/api/src/index.ts
pm2 start npx --name "agentpulse-ingestion" -- tsx apps/ingestion/src/index.ts
pm2 start npx --name "agentpulse-worker" -- tsx apps/worker/src/index.ts

# Configure startup on system boot
pm2 save
pm2 startup
```

#### 6. Configure NGINX Reverse Proxy & Free SSL
```bash
sudo tee /etc/nginx/sites-available/agentpulse << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location /v1/analytics/ { proxy_pass http://localhost:4000/v1/analytics/; }
    location /v1/auth/      { proxy_pass http://localhost:4000/v1/auth/; }
    location /v1/oauth/     { proxy_pass http://localhost:4000/v1/oauth/; }
    location /v1/events     { proxy_pass http://localhost:4001/v1/events; }
    location /health        { proxy_pass http://localhost:4000/health; }
}
EOF

sudo ln -s /etc/nginx/sites-available/agentpulse /etc/nginx/sites-enabled/
sudo systemctl restart nginx

# Enable Free HTTPS Certificate
sudo certbot --nginx -d api.yourdomain.com
```

#### Option 2: Render / Railway / Fly.io (Managed Cloud PaaS)
1. **Database**: Create a free **MongoDB Atlas** database cluster and copy the connection URI (`mongodb+srv://...`).
2. **Service 1 - Usage API**:
   - Build Command: `npm install && npm run build`
   - Start Command: `npx tsx apps/api/src/index.ts`
   - Environment Variables: `MONGODB_URI`, `PORT=4000`, `JWT_SECRET`
3. **Service 2 - Ingestion API**:
   - Start Command: `npx tsx apps/ingestion/src/index.ts`
   - Environment Variables: `MONGODB_URI`, `PORT=4001`
4. **Service 3 - Background Worker**:
   - Start Command: `npx tsx apps/worker/src/index.ts`
   - Environment Variables: `MONGODB_URI`

---

## 🔌 4. Team Integration (Zero Local DB for Developers)

Any developer on your team can connect their IDE and AI assistants in 2 steps:

### 1. Install Global CLI
```bash
npm install -g @rajatpal96/agentpulse
```

### 2. Login & Connect
```bash
agentpulse login
agentpulse connect claude
agentpulse connect copilot
```

### 3. Add MCP Server to IDE (Cursor, Claude Desktop, Antigravity)
Add this entry to `claude_desktop_config.json` or `~/.gemini/config/mcp_config.json`:

```json
{
  "mcpServers": {
    "agentmeter": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/apps/mcp-server/src/index.ts"],
      "env": {
        "AGENTMETER_API_URL": "https://api.yourcompany.com",
        "AGENTMETER_INGEST_URL": "https://ingest.yourcompany.com",
        "DEFAULT_ORG_ID": "org_default"
      }
    }
  }
}
```

Now, developers can ask their AI assistant:
- *"How much did our team spend on tokens today?"*
- *"Show me my most expensive coding sessions."*
- *"Are we within our monthly budget limit?"*

And all metrics from the entire team will stream live into your centralized dashboard!
