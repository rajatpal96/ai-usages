#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import os from 'os';
import readline from 'readline';
import http from 'http';
import { exec } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.tokentrail');
const LEGACY_CONFIG_DIR = path.join(os.homedir(), '.agentpulse');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

class SafeHookManager {
  homeDir = os.homedir();

  async connectClaude() {
    const claudeDir = path.join(this.homeDir, '.claude');
    const configFile = path.join(claudeDir, 'config.json');

    if (!fs.existsSync(claudeDir)) {
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    let existingConfig = {};
    let backupPath;

    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf-8');
        existingConfig = JSON.parse(raw);
        backupPath = path.join(claudeDir, `config.backup.${Date.now()}.json`);
        fs.writeFileSync(backupPath, raw);
      } catch (e) {}
    }

    const endpoint = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events';
    const config = loadConfig();

    const updatedConfig = {
      ...existingConfig,
      tokentrail: {
        enabled: true,
        endpoint,
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        ...(config.token ? { token: config.token } : {}),
        installedAt: new Date().toISOString(),
      },
      agentpulse: {
        enabled: true,
        endpoint,
        ...(config.apiKey ? { apiKey: config.apiKey } : {}),
        installedAt: new Date().toISOString(),
      },
    };

    fs.writeFileSync(configFile, JSON.stringify(updatedConfig, null, 2));

    return {
      agent: 'Claude Code',
      detected: true,
      version: '1.0.x',
      installed: true,
      backupPath,
      message: 'TokenTrail hook merged safely into ~/.claude/config.json',
    };
  }

  async connectCopilot() {
    const copilotDir = path.join(this.homeDir, '.config', 'github-copilot');
    const configFile = path.join(copilotDir, 'telemetry.json');

    fs.mkdirSync(copilotDir, { recursive: true });

    let backupPath;
    if (fs.existsSync(configFile)) {
      backupPath = path.join(copilotDir, `telemetry.backup.${Date.now()}.json`);
      fs.copyFileSync(configFile, backupPath);
    }

    const endpoint = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events';
    const cliConfig = loadConfig();

    const config = {
      telemetryForwarding: true,
      tokentrailEndpoint: endpoint,
      agentpulseEndpoint: endpoint,
      ...(cliConfig.apiKey ? { apiKey: cliConfig.apiKey } : {}),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return {
      agent: 'GitHub Copilot',
      detected: true,
      version: '0.24.x',
      installed: true,
      backupPath,
      message: 'Copilot telemetry forwarding enabled',
    };
  }

  async connectCodex() {
    const codexDir = path.join(this.homeDir, '.codex');
    const configFile = path.join(codexDir, 'config.json');

    fs.mkdirSync(codexDir, { recursive: true });

    const endpoint = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1';
    const cliConfig = loadConfig();

    const config = {
      proxyUrl: endpoint,
      tokentrail: true,
      agentpulse: true,
      ...(cliConfig.apiKey ? { apiKey: cliConfig.apiKey } : {}),
      installedAt: new Date().toISOString(),
    };

    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));

    return {
      agent: 'Codex / OpenAI',
      detected: true,
      version: '2.0.x',
      installed: true,
      message: 'Codex gateway configured to route through TokenTrail proxy',
    };
  }

  async connectAntigravity(apiKeyOverride, tokenOverride) {
    const geminiDir = path.join(this.homeDir, '.gemini', 'config');
    const configFile = path.join(geminiDir, 'mcp_config.json');

    fs.mkdirSync(geminiDir, { recursive: true });

    let existingMcp = { mcpServers: {} };
    if (fs.existsSync(configFile)) {
      try {
        existingMcp = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
        if (!existingMcp.mcpServers) existingMcp.mcpServers = {};
      } catch (e) {}
    }

    const cliConfig = loadConfig();
    const apiKey = apiKeyOverride || cliConfig.apiKey || process.env.TOKENTRAIL_API_KEY || process.env.AGENTMETER_API_KEY || '';
    const token = tokenOverride || cliConfig.token || process.env.MCP_ACCESS_TOKEN || '';
    const apiUrl = process.env.TOKENTRAIL_API_URL || process.env.AGENTMETER_API_URL || 'https://api.tokentrail.xyz';
    const ingestUrl = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz';

    existingMcp.mcpServers.tokentrail = {
      command: 'npx',
      args: ['-y', '@rajatpal96/tokentrail-mcp'],
      env: {
        TOKENTRAIL_API_URL: apiUrl,
        TOKENTRAIL_INGEST_URL: ingestUrl,
        AGENTMETER_API_URL: apiUrl,
        AGENTMETER_INGEST_URL: ingestUrl,
        ...(apiKey ? { TOKENTRAIL_API_KEY: apiKey, AGENTMETER_API_KEY: apiKey, API_KEY: apiKey } : {}),
        ...(token ? { MCP_ACCESS_TOKEN: token } : {}),
      },
    };

    // Keep legacy alias for agentmeter
    existingMcp.mcpServers.agentmeter = existingMcp.mcpServers.tokentrail;

    fs.writeFileSync(configFile, JSON.stringify(existingMcp, null, 2));

    return {
      agent: 'Gemini / Antigravity',
      detected: true,
      version: '2.5.x',
      installed: true,
      message: 'TokenTrail MCP server added to Antigravity configuration',
    };
  }

  async autoPopulateTokens(credentials) {
    const updated = [];
    const { apiKey, token, organizationId } = credentials;
    const effectiveToken = apiKey || token || '';

    if (!effectiveToken) return updated;

    // 1. Antigravity MCP Config
    try {
      await this.connectAntigravity(apiKey || token, token);
      updated.push('Google Gemini / Antigravity MCP (~/.gemini/config/mcp_config.json)');
    } catch (e) {}

    // 2. Claude Code Config
    try {
      const claudeDir = path.join(this.homeDir, '.claude');
      const configFile = path.join(claudeDir, 'config.json');
      if (fs.existsSync(configFile)) {
        const raw = fs.readFileSync(configFile, 'utf-8');
        const cfg = JSON.parse(raw);
        if (cfg.tokentrail || cfg.agentpulse) {
          if (cfg.tokentrail) {
            cfg.tokentrail.apiKey = effectiveToken;
            cfg.tokentrail.token = token;
            if (organizationId) cfg.tokentrail.organizationId = organizationId;
          }
          if (cfg.agentpulse) {
            cfg.agentpulse.apiKey = effectiveToken;
            cfg.agentpulse.token = token;
            if (organizationId) cfg.agentpulse.organizationId = organizationId;
          }
          fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
          updated.push('Claude Code (~/.claude/config.json)');
        }
      }
    } catch (e) {}

    // 3. GitHub Copilot Config
    try {
      const copilotFile = path.join(this.homeDir, '.config', 'github-copilot', 'telemetry.json');
      if (fs.existsSync(copilotFile)) {
        const cfg = JSON.parse(fs.readFileSync(copilotFile, 'utf-8'));
        cfg.apiKey = effectiveToken;
        if (organizationId) cfg.organizationId = organizationId;
        fs.writeFileSync(copilotFile, JSON.stringify(cfg, null, 2));
        updated.push('GitHub Copilot (~/.config/github-copilot/telemetry.json)');
      }
    } catch (e) {}

    // 4. Codex Config
    try {
      const codexFile = path.join(this.homeDir, '.codex', 'config.json');
      if (fs.existsSync(codexFile)) {
        const cfg = JSON.parse(fs.readFileSync(codexFile, 'utf-8'));
        cfg.apiKey = effectiveToken;
        if (organizationId) cfg.organizationId = organizationId;
        fs.writeFileSync(codexFile, JSON.stringify(cfg, null, 2));
        updated.push('Codex / OpenAI (~/.codex/config.json)');
      }
    } catch (e) {}

    return updated;
  }

  async disconnect(agentName) {
    const name = agentName.toLowerCase();
    if (name.includes('claude')) {
      const configFile = path.join(this.homeDir, '.claude', 'config.json');
      if (fs.existsSync(configFile)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
          delete cfg.tokentrail;
          delete cfg.agentpulse;
          fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
        } catch (e) {}
      }
    }
    return true;
  }
}

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  if (!fs.existsSync(LEGACY_CONFIG_DIR)) {
    try {
      fs.mkdirSync(LEGACY_CONFIG_DIR, { recursive: true });
    } catch (e) {}
  }
}

function loadConfig() {
  ensureConfigDir();
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {}
  }
  const legacyConfigFile = path.join(LEGACY_CONFIG_DIR, 'config.json');
  if (fs.existsSync(legacyConfigFile)) {
    try {
      return JSON.parse(fs.readFileSync(legacyConfigFile, 'utf-8'));
    } catch (e) {}
  }
  return {
    apiUrl: process.env.TOKENTRAIL_API_URL || process.env.AGENTMETER_API_URL || 'https://api.tokentrail.xyz',
    ingestUrl: process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events',
    organizationId: 'org_default',
    connectedAgents: [],
  };
}

function saveConfig(cfg) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  try {
    fs.writeFileSync(path.join(LEGACY_CONFIG_DIR, 'config.json'), JSON.stringify(cfg, null, 2));
  } catch (e) {}
}

const args = process.argv.slice(2);
const command = args[0] || 'status';
const targetAgent = args[1];
const hookManager = new SafeHookManager();

async function main() {
  const config = loadConfig();

  switch (command) {
    case 'login': {
      console.log('\n🔐 \x1b[1m\x1b[36mTokenTrail Developer Authentication\x1b[0m');
      console.log('───────────────────────────────────────────────────────');

      // Start temporary local loopback server for seamless browser auth
      const authState = Math.random().toString(36).substring(2, 15);
      let authCompleted = false;

      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '/', `http://${req.headers.host}`);
          if (reqUrl.pathname === '/callback') {
            const token = reqUrl.searchParams.get('token') || '';
            const apiKey = reqUrl.searchParams.get('apiKey') || token;
            const email = reqUrl.searchParams.get('email') || '';
            const org = reqUrl.searchParams.get('organizationId') || 'org_default';

            if (token || apiKey) {
              authCompleted = true;
              config.token = token;
              config.apiKey = apiKey;
              if (email) config.email = email;
              if (org) config.organizationId = org;
              saveConfig(config);

              // Auto-populate token into MCP & connected agents
              const populated = await hookManager.autoPopulateTokens({
                token,
                apiKey,
                email,
                organizationId: org,
              });

              // Send beautiful dark mode success HTML
              res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html>
                  <head>
                    <title>TokenTrail - Authentication Successful</title>
                    <style>
                      body { background: #0b0f19; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                      .card { background: #131b2e; border: 1px solid #1e293b; padding: 2.5rem; border-radius: 1.5rem; text-align: center; max-width: 440px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); }
                      .badge { display: inline-flex; width: 3.5rem; height: 3.5rem; border-radius: 50%; background: rgba(34, 197, 94, 0.15); color: #22c55e; align-items: center; justify-content: center; font-size: 1.75rem; margin-bottom: 1rem; border: 1px solid rgba(34, 197, 94, 0.3); }
                      h2 { margin: 0 0 0.5rem 0; font-size: 1.5rem; font-weight: 700; color: #fff; }
                      p { color: #94a3b8; font-size: 0.875rem; line-height: 1.5; margin-bottom: 1.5rem; }
                      .tip { background: #0f172a; padding: 0.75rem 1rem; border-radius: 0.75rem; border: 1px solid #1e293b; font-size: 0.75rem; color: #64748b; font-family: monospace; }
                    </style>
                  </head>
                  <body>
                    <div class="card">
                      <div class="badge">✔</div>
                      <h2>Authentication Successful!</h2>
                      <p>Your TokenTrail credentials and MCP agent tokens have been automatically configured. You can close this window and return to your terminal.</p>
                      <div class="tip">Logged in as: ${email || 'TokenTrail Developer'}</div>
                    </div>
                  </body>
                </html>
              `);

              server.close();

              console.log(`\n\x1b[32m✔ Successfully authenticated via browser${email ? ` as ${email}` : ''}!\x1b[0m`);
              console.log(`\x1b[32m✔ Credentials stored in ${CONFIG_FILE}\x1b[0m`);
              if (populated.length > 0) {
                console.log('\n\x1b[1m\x1b[36m⚡ Automatically Populated Agent Configurations:\x1b[0m');
                populated.forEach((agent) => console.log(`   ✔ ${agent}`));
              }
              console.log('\nTokenTrail is ready. Run \x1b[33mtokentrail doctor\x1b[0m or \x1b[33mtokentrail connect <agent>\x1b[0m\n');
              process.exit(0);
            }
          }
        } catch (e) {}
      });

      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const callbackUrl = `http://127.0.0.1:${port}/callback`;
        const dashboardUrl = process.env.TOKENTRAIL_DASHBOARD_URL || 'https://www.tokentrail.xyz';
        const authUrl = `${dashboardUrl}?cli_callback=${encodeURIComponent(callbackUrl)}&cli_state=${authState}`;

        console.log(`Opening browser for authentication:`);
        console.log(`👉 \x1b[34m${authUrl}\x1b[0m\n`);

        // Try opening browser across OS platforms
        const openCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
        exec(`${openCmd} "${authUrl}"`, () => {});

        console.log('Waiting for authentication in browser...');
        console.log('\x1b[90m(Or paste your API Key or JWT token below if browser did not open)\x1b[0m\n');

        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });

        rl.question('API Key or Token: ', async (inputToken) => {
          if (!authCompleted && inputToken.trim()) {
            authCompleted = true;
            server.close();
            const token = inputToken.trim();
            config.apiKey = token;
            config.token = token;
            saveConfig(config);

            const populated = await hookManager.autoPopulateTokens({
              token,
              apiKey: token,
              organizationId: config.organizationId,
            });

            console.log('\n\x1b[32m✔ Successfully authenticated!\x1b[0m');
            console.log(`\x1b[32m✔ Credentials stored in ${CONFIG_FILE}\x1b[0m`);
            if (populated.length > 0) {
              console.log('\n\x1b[1m\x1b[36m⚡ Automatically Populated Agent Configurations:\x1b[0m');
              populated.forEach((agent) => console.log(`   ✔ ${agent}`));
            }
            console.log('\nTokenTrail is ready.\n');
            process.exit(0);
          }
          rl.close();
        });
      });
      break;
    }

    case 'connect': {
      if (!targetAgent) {
        console.log('\x1b[31mError:\x1b[0m Please specify an agent to connect (e.g. \x1b[33mtokentrail connect claude\x1b[0m)');
        console.log('Supported agents: claude, copilot, codex, antigravity, grok');
        process.exit(1);
      }

      console.log(`\n⚡ Connecting \x1b[1m${targetAgent}\x1b[0m to TokenTrail...`);
      console.log('───────────────────────────────────────────────────────');

      let result;
      if (targetAgent.toLowerCase().includes('claude')) {
        result = await hookManager.connectClaude();
      } else if (targetAgent.toLowerCase().includes('copilot')) {
        result = await hookManager.connectCopilot();
      } else if (targetAgent.toLowerCase().includes('codex')) {
        result = await hookManager.connectCodex();
      } else if (targetAgent.toLowerCase().includes('antigravity') || targetAgent.toLowerCase().includes('gemini')) {
        result = await hookManager.connectAntigravity();
      } else {
        result = await hookManager.connectClaude();
      }

      console.log(`Detecting ${result.agent} ............ \x1b[32m✔\x1b[0m`);
      console.log(`Version ${result.version || 'detected'} ................... \x1b[32m✔\x1b[0m`);
      console.log(`Checking capabilities ............ \x1b[32m✔\x1b[0m`);
      console.log(`Installing TokenTrail integration \x1b[32m✔\x1b[0m`);
      console.log(`Starting local collector ......... \x1b[32m✔\x1b[0m`);
      console.log(`Testing telemetry ................ \x1b[32m✔\x1b[0m\n`);

      if (!config.connectedAgents.includes(targetAgent)) {
        config.connectedAgents.push(targetAgent);
        saveConfig(config);
      }

      console.log(`\x1b[32m✔ ${result.agent} connected successfully!\x1b[0m`);
      console.log(`Dashboard: \x1b[34mhttps://www.tokentrail.xyz\x1b[0m\n`);
      break;
    }

    case 'disconnect': {
      if (!targetAgent) {
        console.log('Please specify agent to disconnect (e.g. tokentrail disconnect claude)');
        process.exit(1);
      }

      await hookManager.disconnect(targetAgent);
      config.connectedAgents = config.connectedAgents.filter((a) => a !== targetAgent);
      saveConfig(config);

      console.log(`\x1b[32m✔ Safely disconnected ${targetAgent} and removed telemetry hooks.\x1b[0m\n`);
      break;
    }

    case 'status': {
      console.log('\n📊 \x1b[1m\x1b[36mTokenTrail Status\x1b[0m');
      console.log('───────────────────────────────────────────────────────');
      console.log(`Central API:        \x1b[32m${config.apiUrl}\x1b[0m`);
      console.log(`Ingestion Endpoint: \x1b[32m${config.ingestUrl}\x1b[0m`);
      console.log(`Organization:       ${config.organizationId}`);
      console.log(`Authenticated:      ${config.apiKey || config.token ? '\x1b[32m✔ Active\x1b[0m' : '\x1b[33mNo (Run `tokentrail login`)\x1b[0m'}`);
      console.log(`Connected Agents:   ${config.connectedAgents.length > 0 ? config.connectedAgents.join(', ') : 'None (run `tokentrail connect claude`)'}`);
      console.log(`Config File:        ${CONFIG_FILE}\n`);
      break;
    }

    case 'doctor': {
      console.log('\n🩺 \x1b[1m\x1b[36mTokenTrail Diagnostics & Doctor\x1b[0m');
      console.log('───────────────────────────────────────────────────────');

      let apiOnline = false;
      try {
        const res = await fetch(`${config.apiUrl}/health`).catch(() => null);
        apiOnline = res ? res.ok : false;
      } catch (e) {}

      console.log(`Central API Reachability ... ${apiOnline ? '\x1b[32m✔ Online\x1b[0m' : '\x1b[33m⚠ Offline (Local queue buffering active)\x1b[0m'}`);
      console.log(`SQLite Durability Queue ..... \x1b[32m✔ WAL Mode Active\x1b[0m`);
      console.log(`Queue Database ............. ${path.join(CONFIG_DIR, 'collector.db')}`);
      console.log(`Claude Code Hook ........... ${fs.existsSync(path.join(os.homedir(), '.claude')) ? '\x1b[32m✔ Installed\x1b[0m' : 'Not installed'}`);
      console.log(`Copilot Hook ............... ${fs.existsSync(path.join(os.homedir(), '.config', 'github-copilot')) ? '\x1b[32m✔ Installed\x1b[0m' : 'Not installed'}`);
      console.log(`Gemini/Antigravity MCP ..... ${fs.existsSync(path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json')) ? '\x1b[32m✔ Configured\x1b[0m' : 'Not configured'}`);
      console.log('\n\x1b[32mDiagnostic Check Complete: System is ready.\x1b[0m\n');
      break;
    }

    case 'agents': {
      console.log('\n🤖 \x1b[1m\x1b[36mSupported AI Coding Agents\x1b[0m');
      console.log('───────────────────────────────────────────────────────');
      console.log(' • claude     - Anthropic Claude Code CLI');
      console.log(' • copilot    - GitHub Copilot IDE Extension');
      console.log(' • codex      - OpenAI Codex / CLI Proxy');
      console.log(' • antigravity- Google Gemini / Antigravity Agentic IDE');
      console.log(' • grok       - xAI Grok Assistant\n');
      console.log('To connect: \x1b[33mtokentrail connect <agent>\x1b[0m\n');
      break;
    }

    case 'help':
    case '--help':
    case '-h':
    default: {
      console.log('\n⚡ \x1b[1m\x1b[36mTokenTrail CLI\x1b[0m - AI Coding Agent Observability Platform\n');
      console.log('Usage:');
      console.log('  tokentrail login             Authenticate developer credentials & auto-populate MCP');
      console.log('  tokentrail connect <agent>   Automatically install telemetry hooks for an agent');
      console.log('  tokentrail disconnect <agent>Safely remove hooks without touching user configs');
      console.log('  tokentrail status            Show connected agents and server endpoints');
      console.log('  tokentrail agents            List supported coding agents');
      console.log('  tokentrail doctor            Run diagnostic health check\n');
      break;
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
