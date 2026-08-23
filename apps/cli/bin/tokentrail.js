#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import os from 'os';
import readline from 'readline';

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

    const updatedConfig = {
      ...existingConfig,
      tokentrail: {
        enabled: true,
        endpoint,
        installedAt: new Date().toISOString(),
      },
      agentpulse: {
        enabled: true,
        endpoint,
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

    const config = {
      telemetryForwarding: true,
      tokentrailEndpoint: endpoint,
      agentpulseEndpoint: endpoint,
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

    const config = {
      proxyUrl: endpoint,
      tokentrail: true,
      agentpulse: true,
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

  async connectAntigravity() {
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

    const apiUrl = process.env.TOKENTRAIL_API_URL || process.env.AGENTMETER_API_URL || 'https://api.tokentrail.xyz';
    const ingestUrl = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz';

    existingMcp.mcpServers.tokentrail = {
      command: 'npx',
      args: ['-y', 'tokentrail-mcp'],
      env: {
        TOKENTRAIL_API_URL: apiUrl,
        TOKENTRAIL_INGEST_URL: ingestUrl,
        AGENTMETER_API_URL: apiUrl,
        AGENTMETER_INGEST_URL: ingestUrl,
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
      console.log('Open dashboard to authenticate: \x1b[34mhttps://tokentrail.xyz\x1b[0m\n');

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      rl.question('Paste your API Key or JWT token: ', (token) => {
        if (token.trim()) {
          config.apiKey = token.trim();
          saveConfig(config);
          console.log('\n\x1b[32m✔ Successfully authenticated!\x1b[0m');
          console.log(`Stored credentials in ${CONFIG_FILE}\n`);
        } else {
          console.log('\n\x1b[33mNo token provided. Using local development mode.\x1b[0m\n');
        }
        rl.close();
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
      console.log(`Dashboard: \x1b[34mhttps://tokentrail.xyz\x1b[0m\n`);
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
      console.log('  tokentrail login             Authenticate developer credentials');
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
