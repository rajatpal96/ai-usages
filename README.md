# TokenTrail (formerly AgentMeter)

TokenTrail is an AI agent usage and observability platform for Claude Code, GitHub Copilot, Cursor, Windsurf, Gemini/Antigravity, Codex, Grok, and custom MCP agents. It collects usage telemetry, calculates model costs, exposes analytics APIs, provides MCP tools, and includes an enterprise identity and OAuth layer.

## Services & Production Endpoints

- **Web Dashboard**: `https://tokentrail.xyz` (Local: `http://localhost:3000`)
- **Usage & Analytics API**: `https://api.tokentrail.xyz` (Local: `http://localhost:4000`)
- **Ingestion API & LLM Proxy**: `https://api.tokentrail.xyz/v1/events` (Local: `http://localhost:4001`)
- **MCP Server**: `tokentrail-mcp` (`npm run mcp`)
- **Kafka Broker**: `localhost:9092`

## Developer CLI: Automatic Agent Onboarding

Install the published CLI globally:

```bash
npm install -g tokentrail
```

Or run instantly with `npx`:

```bash
npx tokentrail login
npx tokentrail connect claude
npx tokentrail connect copilot
npx tokentrail connect antigravity
npx tokentrail doctor
```

### Publishing CLI to Node.js Package Registry (npm)

To publish the CLI and MCP packages to npm:

```bash
# 1. Publish TokenTrail CLI
npm run publish:cli

# 2. Publish TokenTrail MCP Server
npm run publish:mcp
```

In a second terminal, run the standalone dashboard:

```bash
cd /Users/batu/Downloads/agent-pulse-ui
npm install
npm run dev
```

Open `http://localhost:3000`.

## Local Run: Full Docker Infrastructure

Use this when you want MongoDB, Redis, Kafka, Zookeeper, the API, ingestion service, worker, and dashboard containers running together.

```bash
cd /Users/batu/Downloads/ai-usages
npm install
docker compose -f infrastructure/docker/docker-compose.yml up --build
```

Then open:

- Dashboard: `http://localhost:3000`
- API health: `http://localhost:4000/health`
- Ingestion health: `http://localhost:4001/health`

Stop the stack with:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down
```

To remove persisted MongoDB and Redis volumes too:

```bash
docker compose -f infrastructure/docker/docker-compose.yml down -v
```

## Local Run: Backend With Local Docker Infra Only

Use this when you want MongoDB/Kafka in Docker but want Node services running in your terminal.

```bash
cd /Users/batu/Downloads/ai-usages
docker compose -f infrastructure/docker/docker-compose.yml up -d mongodb redis zookeeper kafka
npm install
MONGODB_URI=mongodb://localhost:27017/agentmeter KAFKA_BROKERS=localhost:9092 npm run dev
```

In another terminal:

```bash
cd /Users/batu/Downloads/agent-pulse-ui
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000 NEXT_PUBLIC_INGEST_BASE_URL=http://localhost:4001 npm run dev
```

## Useful Commands

```bash
# Seed realistic demo telemetry
npm run seed

# Run the full local verification script
npm run test

# Simulate AI agent usage events
npm run simulate

# Run the MCP server over stdio
npm run mcp

# Run only the dashboard from the monorepo copy
npm run dashboard
```

## Environment Variables

The defaults are development-friendly. Override only what you need.

```bash
NODE_ENV=development
API_PORT=4000
INGESTION_PORT=4001
DASHBOARD_PORT=3000
MONGODB_URI=mongodb://localhost:27017/agentmeter
REDIS_URL=redis://localhost:6379
KAFKA_BROKERS=localhost:9092
JWT_SECRET=agentmeter-dev-secret-key-32-chars-long!
DEFAULT_ORG_ID=org_default
PRIVACY_LEVEL=1
ENABLE_MEMORY_DB_FALLBACK=true
LOG_LEVEL=info
```

## Verify The Identity And OAuth Layer

Start the backend with `npm run dev`, then run:

```bash
curl -s http://localhost:4000/health

curl -s -X POST http://localhost:4000/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin@acme.com","password":"dev","organizationId":"org_default"}'

curl -s -X POST http://localhost:4000/v1/oauth/token \
  -H 'content-type: application/json' \
  -d '{"client_id":"cursor-local","scope":"mcp:read mcp:usage mcp:cost","organizationId":"org_default"}'
```

Use the returned `access_token` as a Bearer token for protected API or MCP requests.

## Verify Ingestion And Streaming

Start the backend, then post a usage event:

```bash
curl -s -X POST http://localhost:4001/v1/events \
  -H 'content-type: application/json' \
  -H 'x-organization-id: org_default' \
  -d '{
    "userId": "alex.dev@acme.com",
    "projectId": "agent-pulse-ui",
    "sessionId": "local-session-001",
    "agentName": "codex",
    "provider": "openai",
    "model": "gpt-5",
    "promptTokens": 4200,
    "completionTokens": 1100,
    "requestLatencyMs": 350
  }'
```

Then check analytics:

```bash
curl -s 'http://localhost:4000/v1/analytics/overview?range=30d'
```

If Kafka is running, events are published to `agentmeter.usage-events`. If Kafka is offline, the local in-memory fallback is used automatically.

## Zero-DB Lightweight MCP Configuration

Developers **do NOT need a local MongoDB or local collector running** to use the MCP server. The MCP server communicates directly with the centralized AgentMeter Backend over HTTP.

To connect Antigravity, Cursor, or Claude Desktop to AgentMeter:

```json
{
  "mcpServers": {
    "agentmeter": {
      "command": "npx",
      "args": ["-y", "tsx", "/Users/batu/Downloads/ai-usages/apps/mcp-server/src/index.ts"],
      "env": {
        "AGENTMETER_API_URL": "http://localhost:4000",
        "AGENTMETER_INGEST_URL": "http://localhost:4001",
        "DEFAULT_ORG_ID": "org_default"
      }
    }
  }
}
```

When deployed in production, simply point `AGENTMETER_API_URL` to your hosted cloud backend:

```json
{
  "mcpServers": {
    "agentmeter": {
      "command": "npx",
      "args": ["-y", "tsx", "/path/to/mcp-server/index.ts"],
      "env": {
        "AGENTMETER_API_URL": "https://api.agentmeter.yourcompany.com",
        "AGENTMETER_API_KEY": "am_live_your_org_api_key"
      }
    }
  }
}
```

## Dashboard Repo

The standalone dashboard is in:

```bash
/Users/batu/Downloads/agent-pulse-ui
```

Run it with:

```bash
cd /Users/batu/Downloads/agent-pulse-ui
npm install
npm run dev
```

The dashboard proxies `/api/v1/*` to the backend API and `/ingest/v1/*` to the ingestion service.
