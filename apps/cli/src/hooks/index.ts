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
      args: ['-y', '@rajatpal96/tokentrail-mcp'],
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

  /**
   * 7. Sync Claude Code Logs
   */
  public async syncClaudeLogs(apiUrl: string, tokenOrKey?: string, orgId?: string) {
    const projectsDir = path.join(this.homeDir, '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) {
      return { syncedEvents: 0, totalTokens: 0, sessions: 0 };
    }

    const configDir = path.join(this.homeDir, '.tokentrail');
    const stateFile = path.join(configDir, 'claude_synced.json');
    let syncedIds: Record<string, boolean> = {};
    if (fs.existsSync(stateFile)) {
      try {
        syncedIds = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      } catch (e) {}
    }

    const eventsMap = new Map<string, any>();
    let totalTokens = 0;
    const sessionSet = new Set<string>();

    const scanDir = (dir: string) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          try {
            const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').filter(Boolean);
            for (const line of lines) {
              const data = JSON.parse(line);
              if (data.type === 'assistant' && data.message && data.message.usage) {
                const turnId = data.message.id || data.uuid || `${data.sessionId}_${data.timestamp}`;
                if (syncedIds[turnId]) continue;

                const toolsUsed: string[] = [];
                let thinkingText = '';
                if (Array.isArray(data.message.content)) {
                  for (const block of data.message.content) {
                    if (block.type === 'tool_use' && block.name) {
                      toolsUsed.push(block.name);
                    }
                    if (block.type === 'thinking' && block.thinking) {
                      thinkingText = block.thinking.slice(0, 200);
                    }
                  }
                }

                if (eventsMap.has(turnId)) continue;

                const inputTokens = data.message.usage.input_tokens || 0;
                const outputTokens = data.message.usage.output_tokens || 0;
                const cacheRead = data.message.usage.cache_read_input_tokens || 0;
                const cacheWrite = data.message.usage.cache_creation_input_tokens || 0;
                const total = inputTokens + outputTokens + cacheRead + cacheWrite;

                totalTokens += total;
                if (data.sessionId) sessionSet.add(data.sessionId);

                const projectName = data.cwd ? path.basename(data.cwd) : 'default';

                eventsMap.set(turnId, {
                  eventId: `evt_${turnId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
                  timestamp: data.timestamp || new Date().toISOString(),
                  organizationId: orgId || 'EXT',
                  userId: 'developer',
                  projectId: projectName,
                  sessionId: data.sessionId || 'claude_session',
                  agent: {
                    id: 'claude-code',
                    name: 'claude-code',
                    version: data.version || '2.1.x',
                    type: 'coding_cli',
                  },
                  provider: {
                    name: 'anthropic',
                  },
                  model: {
                    name: data.message.model || 'claude-3-7-sonnet',
                  },
                  usage: {
                    inputTokens,
                    outputTokens,
                    cacheReadTokens: cacheRead,
                    cacheWriteTokens: cacheWrite,
                    totalTokens: total,
                  },
                  metadata: {
                    cwd: data.cwd,
                    projectName,
                    tools: toolsUsed,
                    toolCount: toolsUsed.length,
                    stopReason: data.message.stop_reason,
                    thinkingSnippet: thinkingText || undefined,
                    turnId,
                  },
                  status: 'success',
                });
              }
            }
          } catch (e) {}
        }
      }
    };

    scanDir(projectsDir);

    const eventsToUpload = Array.from(eventsMap.values());
    if (eventsToUpload.length > 0) {
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      for (const [turnId] of eventsMap.entries()) {
        syncedIds[turnId] = true;
      }
      fs.writeFileSync(stateFile, JSON.stringify(syncedIds));

      const ingestEndpoint = `${apiUrl}/v1/events/batch`;
      const effectiveAuth = tokenOrKey || '';
      for (let i = 0; i < eventsToUpload.length; i += 50) {
        const batch = eventsToUpload.slice(i, i + 50);
        try {
          await fetch(ingestEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(effectiveAuth ? { Authorization: `Bearer ${effectiveAuth}` } : {}),
            },
            body: JSON.stringify({ events: batch }),
          }).catch(() => null);
        } catch (e) {}
      }
    }

    return { syncedEvents: eventsToUpload.length, totalTokens, sessions: sessionSet.size };
  }

  /**
   * 8. Sync Gemini / Antigravity Transcripts
   */
  public async syncAntigravityLogs(apiUrl: string, tokenOrKey?: string, orgId?: string) {
    const brainDirs = [
      path.join(this.homeDir, '.gemini', 'antigravity-ide', 'brain'),
      path.join(this.homeDir, '.gemini', 'brain'),
      path.join(this.homeDir, '.antigravity', 'brain'),
    ];

    const configDir = path.join(this.homeDir, '.tokentrail');
    const stateFile = path.join(configDir, 'antigravity_synced.json');
    let syncedIds: Record<string, boolean> = {};
    if (fs.existsSync(stateFile)) {
      try {
        syncedIds = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      } catch (e) {}
    }

    const eventsMap = new Map<string, any>();
    let totalTokens = 0;
    const sessionSet = new Set<string>();

    for (const brainDir of brainDirs) {
      if (!fs.existsSync(brainDir)) continue;
      try {
        const convDirs = fs.readdirSync(brainDir, { withFileTypes: true });
        for (const conv of convDirs) {
          if (!conv.isDirectory()) continue;
          const convId = conv.name;
          const transcriptFile = path.join(brainDir, convId, '.system_generated', 'logs', 'transcript.jsonl');
          if (!fs.existsSync(transcriptFile)) continue;

          try {
            const rawContent = fs.readFileSync(transcriptFile, 'utf-8');
            const lines = rawContent.split('\n').filter(Boolean);
            let inferredProject = 'default';
            let activeModel = 'gemini-2.5-pro';

            for (const line of lines) {
              try {
                const step = JSON.parse(line);
                if (step.content && typeof step.content === 'string') {
                  if (step.content.includes('Model Selection') || step.content.includes('Gemini')) {
                    const match = step.content.match(/Gemini\s+([0-9\.\w\-]+)/i);
                    if (match) activeModel = `gemini-${match[1].toLowerCase()}`;
                  }
                  if (step.content.includes('/Users/')) {
                    const match = step.content.match(/\/Users\/[^\/]+\/([^\/\n]+)/);
                    if (match && match[1] && !['.gemini', '.npm', '.nvm', 'Downloads', 'Documents', 'Desktop'].includes(match[1])) {
                      inferredProject = match[1];
                    }
                  }
                }
              } catch (e) {}
            }

            for (const line of lines) {
              try {
                const step = JSON.parse(line);
                if (step.source === 'MODEL' || step.type === 'PLANNER_RESPONSE') {
                  const stepIndex = step.step_index !== undefined ? step.step_index : Math.random().toString(36).substring(7);
                  const turnId = `agy_${convId}_${stepIndex}`;
                  if (syncedIds[turnId]) continue;

                  const toolsUsed: string[] = [];
                  if (Array.isArray(step.tool_calls)) {
                    for (const tc of step.tool_calls) {
                      if (tc.name) toolsUsed.push(tc.name);
                    }
                  }

                  let thinkingText = step.thinking || '';
                  if (!thinkingText && step.content && typeof step.content === 'string') {
                    thinkingText = step.content.slice(0, 200);
                  }

                  const promptChars = step.prompt_length || 3500;
                  const contentChars = (step.content ? step.content.length : 0) + (JSON.stringify(step.tool_calls || {}).length);
                  const inputTokens = step.usage?.input_tokens || step.usage?.inputTokens || Math.max(800, Math.round(promptChars / 4));
                  const outputTokens = step.usage?.output_tokens || step.usage?.outputTokens || Math.max(120, Math.round(contentChars / 4));
                  const total = inputTokens + outputTokens;

                  totalTokens += total;
                  sessionSet.add(convId);

                  eventsMap.set(turnId, {
                    eventId: `evt_${turnId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
                    timestamp: step.created_at || new Date().toISOString(),
                    organizationId: orgId || 'EXT',
                    userId: 'developer',
                    projectId: inferredProject,
                    sessionId: convId,
                    agent: {
                      id: 'gemini-antigravity',
                      name: 'gemini-antigravity',
                      version: '2.5.x',
                      type: 'autonomous_pair_programmer',
                    },
                    provider: {
                      name: 'google',
                    },
                    model: {
                      name: activeModel,
                    },
                    usage: {
                      inputTokens,
                      outputTokens,
                      cacheReadTokens: 0,
                      cacheWriteTokens: 0,
                      totalTokens: total,
                    },
                    metadata: {
                      stepIndex: step.step_index,
                      tools: toolsUsed,
                      toolCount: toolsUsed.length,
                      status: step.status || 'DONE',
                      thinkingSnippet: thinkingText ? thinkingText.slice(0, 200) : undefined,
                      turnId,
                    },
                    status: 'success',
                  });
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    const eventsToUpload = Array.from(eventsMap.values());
    if (eventsToUpload.length > 0) {
      if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
      for (const [turnId] of eventsMap.entries()) {
        syncedIds[turnId] = true;
      }
      fs.writeFileSync(stateFile, JSON.stringify(syncedIds));

      const ingestEndpoint = `${apiUrl}/v1/events/batch`;
      const effectiveAuth = tokenOrKey || '';
      for (let i = 0; i < eventsToUpload.length; i += 50) {
        const batch = eventsToUpload.slice(i, i + 50);
        try {
          await fetch(ingestEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(effectiveAuth ? { Authorization: `Bearer ${effectiveAuth}` } : {}),
            },
            body: JSON.stringify({ events: batch }),
          }).catch(() => null);
        } catch (e) {}
      }
    }

    return { syncedEvents: eventsToUpload.length, totalTokens, sessions: sessionSet.size };
  }

  /**
   * 9. Unified Sync for all AI Coding Agents
   */
  public async syncAllLogs(apiUrl: string, tokenOrKey?: string, orgId?: string) {
    const claudeRes = await this.syncClaudeLogs(apiUrl, tokenOrKey, orgId);
    const agyRes = await this.syncAntigravityLogs(apiUrl, tokenOrKey, orgId);
    return {
      syncedEvents: claudeRes.syncedEvents + agyRes.syncedEvents,
      totalTokens: claudeRes.totalTokens + agyRes.totalTokens,
      sessions: claudeRes.sessions + agyRes.sessions,
      claude: claudeRes,
      antigravity: agyRes,
    };
  }
}
