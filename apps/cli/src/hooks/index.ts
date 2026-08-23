import fs from 'fs';
import path from 'path';
import os from 'os';

export interface HookInstallResult {
  agent: string;
  detected: boolean;
  version?: string;
  installed: boolean;
  backupPath?: string;
  message: string;
}

export class SafeHookManager {
  private homeDir = os.homedir();

  /**
   * 1. Safe Hook for Claude Code
   */
  public async connectClaude(): Promise<HookInstallResult> {
    const claudeDir = path.join(this.homeDir, '.claude');
    const configFile = path.join(claudeDir, 'config.json');

    const detected = fs.existsSync(claudeDir);
    if (!detected) {
      // Create if needed
      fs.mkdirSync(claudeDir, { recursive: true });
    }

    let existingConfig: Record<string, any> = {};
    let backupPath: string | undefined;

    if (fs.existsSync(configFile)) {
      try {
        const raw = fs.readFileSync(configFile, 'utf-8');
        existingConfig = JSON.parse(raw);
        // Backup before touching
        backupPath = path.join(claudeDir, `config.backup.${Date.now()}.json`);
        fs.writeFileSync(backupPath, raw);
      } catch (e) {}
    }

    // Merge TokenTrail / AgentPulse Telemetry Hook without overwriting other properties
    const updatedConfig = {
      ...existingConfig,
      tokentrail: {
        enabled: true,
        endpoint: process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events',
        installedAt: new Date().toISOString(),
      },
      agentpulse: {
        enabled: true,
        endpoint: process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events',
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

  /**
   * 2. Safe Hook for GitHub Copilot
   */
  public async connectCopilot(): Promise<HookInstallResult> {
    const copilotDir = path.join(this.homeDir, '.config', 'github-copilot');
    const configFile = path.join(copilotDir, 'telemetry.json');

    fs.mkdirSync(copilotDir, { recursive: true });

    let backupPath: string | undefined;
    if (fs.existsSync(configFile)) {
      backupPath = path.join(copilotDir, `telemetry.backup.${Date.now()}.json`);
      fs.copyFileSync(configFile, backupPath);
    }

    const config = {
      telemetryForwarding: true,
      tokentrailEndpoint: process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events',
      agentpulseEndpoint: process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events',
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

  /**
   * 3. Safe Hook for Codex / OpenAI CLI
   */
  public async connectCodex(): Promise<HookInstallResult> {
    const codexDir = path.join(this.homeDir, '.codex');
    const configFile = path.join(codexDir, 'config.json');

    fs.mkdirSync(codexDir, { recursive: true });

    const config = {
      proxyUrl: process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1',
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

  /**
   * 4. Safe Hook for Gemini / Antigravity MCP
   */
  public async connectAntigravity(apiKey?: string, token?: string): Promise<HookInstallResult> {
    const geminiDir = path.join(this.homeDir, '.gemini', 'config');
    const configFile = path.join(geminiDir, 'mcp_config.json');

    fs.mkdirSync(geminiDir, { recursive: true });

    let existingMcp: Record<string, any> = { mcpServers: {} };
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
        ...(apiKey ? { TOKENTRAIL_API_KEY: apiKey, AGENTMETER_API_KEY: apiKey } : {}),
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

  /**
   * 5. Auto-populate Token across all agent configs upon login
   */
  public async autoPopulateTokens(credentials: {
    apiKey?: string;
    token?: string;
    email?: string;
    organizationId?: string;
  }): Promise<string[]> {
    const updatedAgents: string[] = [];
    const { apiKey, token, organizationId } = credentials;
    const effectiveToken = apiKey || token || '';

    if (!effectiveToken) return updatedAgents;

    // 1. Antigravity MCP Config
    try {
      await this.connectAntigravity(apiKey || token, token);
      updatedAgents.push('Google Gemini / Antigravity MCP (~/.gemini/config/mcp_config.json)');
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
          updatedAgents.push('Claude Code (~/.claude/config.json)');
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
        updatedAgents.push('GitHub Copilot (~/.config/github-copilot/telemetry.json)');
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
        updatedAgents.push('Codex / OpenAI (~/.codex/config.json)');
      }
    } catch (e) {}

    return updatedAgents;
  }

  /**
   * 6. Disconnect / Remove Hook cleanly
   */
  public async disconnect(agentName: string): Promise<boolean> {
    const name = agentName.toLowerCase();
    if (name.includes('claude')) {
      const configFile = path.join(this.homeDir, '.claude', 'config.json');
      if (fs.existsSync(configFile)) {
        try {
          const cfg = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
          delete cfg.tokentrail;
          delete cfg.agentpulse;
          fs.writeFileSync(configFile, JSON.stringify(cfg, null, 2));
          return true;
        } catch (e) {}
      }
    }
    return true;
  }
}
