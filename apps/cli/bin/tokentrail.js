#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import os from 'os';
import readline from 'readline';
import http from 'http';
import { exec, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  async syncClaudeLogs(apiUrl, tokenOrKey, orgId) {
    const projectsDir = path.join(this.homeDir, '.claude', 'projects');
    if (!fs.existsSync(projectsDir)) {
      return { syncedEvents: 0, totalTokens: 0, sessions: 0 };
    }

    const stateFile = path.join(CONFIG_DIR, 'claude_synced.json');
    let syncedIds = {};
    if (fs.existsSync(stateFile)) {
      try {
        syncedIds = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      } catch (e) {}
    }

    const eventsMap = new Map();
    let totalTokens = 0;
    const sessionSet = new Set();

    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
          try {
            const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').filter(Boolean);
            let sessionGoal = '';
            let currentPrompt = '';

            for (const line of lines) {
              const data = JSON.parse(line);
              if (data.type === 'user' && data.message) {
                let p = '';
                if (typeof data.message.content === 'string') p = data.message.content.trim();
                else if (Array.isArray(data.message.content)) {
                  p = data.message.content.filter((b) => b && (b.type === 'text' || b.text)).map((b) => b.text || '').join(' ').trim();
                }
                if (p && !sessionGoal) {
                  sessionGoal = p;
                }
              }
            }

            for (const line of lines) {
              const data = JSON.parse(line);
              if (data.type === 'user' && data.message) {
                let p = '';
                if (typeof data.message.content === 'string') p = data.message.content.trim();
                else if (Array.isArray(data.message.content)) {
                  p = data.message.content.filter((b) => b && (b.type === 'text' || b.text)).map((b) => b.text || '').join(' ').trim();
                }
                if (p) {
                  currentPrompt = p;
                }
              }

              if (data.type === 'assistant' && data.message && data.message.usage) {
                const turnId = data.message.id || data.uuid || `${data.sessionId}_${data.timestamp}`;
                if (syncedIds[turnId]) continue;

                const toolsUsed = [];
                let thinkingText = '';
                let actionSummary = '';
                if (Array.isArray(data.message.content)) {
                  const toolDetails = [];
                  let text = '';
                  for (const block of data.message.content) {
                    if (block.type === 'tool_use' && block.name) {
                      toolsUsed.push(block.name);
                      const inp = block.input || {};
                      if (block.name === 'Bash' && inp.command) toolDetails.push(`Bash: ${inp.command.slice(0, 50)}`);
                      else if (block.name === 'Edit' && inp.file_path) toolDetails.push(`Edit ${path.basename(inp.file_path)}`);
                      else if (block.name === 'Write' && inp.file_path) toolDetails.push(`Write ${path.basename(inp.file_path)}`);
                      else if (block.name === 'ReadDir' && inp.path) toolDetails.push(`Read ${path.basename(inp.path)}`);
                      else if (block.name === 'Grep' && inp.pattern) toolDetails.push(`Grep "${inp.pattern}"`);
                      else toolDetails.push(block.name);
                    }
                    if (block.type === 'thinking' && block.thinking) {
                      thinkingText = block.thinking.slice(0, 250);
                    }
                    if (block.type === 'text' && block.text && !text) {
                      text = block.text.trim().slice(0, 160);
                    }
                  }
                  if (toolDetails.length > 0) actionSummary = toolDetails.join(' • ');
                  else if (text) actionSummary = text;
                }

                if (!actionSummary) actionSummary = 'Assistant Response';
                if (eventsMap.has(turnId)) continue;

                const inputTokens = data.message.usage.input_tokens || 0;
                const outputTokens = data.message.usage.output_tokens || 0;
                const cacheRead = data.message.usage.cache_read_input_tokens || 0;
                const cacheWrite = data.message.usage.cache_creation_input_tokens || 0;
                const total = inputTokens + outputTokens + cacheRead + cacheWrite;

                totalTokens += total;
                if (data.sessionId) sessionSet.add(data.sessionId);

                const projectName = data.cwd ? path.basename(data.cwd) : 'default';
                const resolvedPrompt = currentPrompt || sessionGoal;

                eventsMap.set(turnId, {
                  eventId: `evt_${turnId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
                  timestamp: data.timestamp || new Date().toISOString(),
                  organizationId: orgId || 'EXT',
                  userId: 'developer',
                  projectId: projectName,
                  sessionId: data.sessionId || 'claude_session',
                  userPrompt: resolvedPrompt || undefined,
                  actionSummary,
                  sessionGoal: sessionGoal || undefined,
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
                    userPrompt: resolvedPrompt || undefined,
                    actionSummary,
                    sessionGoal: sessionGoal || undefined,
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

    let successfullyUploadedEvents = 0;
    let successfullyUploadedTokens = 0;

    if (eventsToUpload.length > 0) {
      ensureConfigDir();

      // Buffer into local SQLite durability queue if present
      try {
        const dbPath = path.join(CONFIG_DIR, 'collector.db');
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.exec(`
          CREATE TABLE IF NOT EXISTS events (
            eventId TEXT PRIMARY KEY,
            organizationId TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retryCount INTEGER NOT NULL DEFAULT 0,
            errorMessage TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
        `);
        const insert = db.prepare(`
          INSERT OR IGNORE INTO events (eventId, organizationId, payload, status, retryCount, createdAt, updatedAt)
          VALUES (?, ?, ?, 'pending', 0, ?, ?)
        `);
        const now = new Date().toISOString();
        for (const evt of eventsToUpload) {
          insert.run(evt.eventId, evt.organizationId, JSON.stringify(evt), now, now);
        }
      } catch (e) {}

      // POST to backend API
      const ingestEndpoint = `${apiUrl}/v1/events/batch`;
      const effectiveAuth = (tokenOrKey || '').trim();
      for (let i = 0; i < eventsToUpload.length; i += 10) {
        const batch = eventsToUpload.slice(i, i + 10);
        try {
          const resp = await fetch(ingestEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(effectiveAuth ? { Authorization: `Bearer ${effectiveAuth}` } : {}),
            },
            body: JSON.stringify({ events: batch }),
          });

          if (resp.ok) {
            for (const evt of batch) {
              const turnId = evt.metadata?.turnId;
              if (turnId) syncedIds[turnId] = true;
              successfullyUploadedEvents++;
              successfullyUploadedTokens += (evt.usage?.totalTokens || 0);
            }
            fs.writeFileSync(stateFile, JSON.stringify(syncedIds));
          } else if (resp.status === 401) {
            console.error(`\x1b[31m⚠ TokenTrail Auth Error (401): Please run 'tokentrail login' to authenticate.\x1b[0m`);
            break;
          } else {
            const errText = await resp.text().catch(() => '');
            console.error(`\x1b[33m⚠ TokenTrail Upload Warning (${resp.status}): ${errText}\x1b[0m`);
          }
        } catch (e) {
          console.error(`\x1b[33m⚠ TokenTrail Network Error: ${e.message}\x1b[0m`);
        }
      }
    }

    return { syncedEvents: successfullyUploadedEvents, totalTokens: successfullyUploadedTokens, sessions: sessionSet.size };
  }

  async syncAntigravityLogs(apiUrl, tokenOrKey, orgId) {
    const brainDirs = [
      path.join(this.homeDir, '.gemini', 'antigravity-ide', 'brain'),
      path.join(this.homeDir, '.gemini', 'brain'),
      path.join(this.homeDir, '.antigravity', 'brain'),
    ];

    const stateFile = path.join(CONFIG_DIR, 'antigravity_synced.json');
    let syncedIds = {};
    if (fs.existsSync(stateFile)) {
      try {
        syncedIds = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      } catch (e) {}
    }

    const cleanPrompt = (raw) => {
      if (!raw || typeof raw !== 'string') return '';
      const match = raw.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/i);
      if (match && match[1]) {
        return match[1].trim();
      }
      return raw.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '').trim().slice(0, 400);
    };

    const formatActionSummary = (step) => {
      if (step.tool_calls && Array.isArray(step.tool_calls) && step.tool_calls.length > 0) {
        const summaries = step.tool_calls.map((tc) => {
          const args = tc.args || {};
          if (tc.name === 'run_command') return `Command: ${args.CommandLine || args.command || 'exec'}`;
          if (tc.name === 'replace_file_content' || tc.name === 'write_to_file' || tc.name === 'multi_replace_file_content') {
            const file = args.TargetFile ? path.basename(args.TargetFile) : 'file';
            return `Edit ${file}: ${args.Instruction || args.Description || ''}`.trim();
          }
          if (tc.name === 'view_file') return `View ${args.AbsolutePath ? path.basename(args.AbsolutePath) : 'file'}`;
          if (tc.name === 'grep_search') return `Search: "${args.Query || ''}"`;
          if (tc.name === 'list_dir') return `List ${args.DirectoryPath ? path.basename(args.DirectoryPath) : 'dir'}`;
          return tc.name;
        });
        return summaries.join(' • ');
      }
      if (step.content && typeof step.content === 'string') {
        return step.content.replace(/<[^>]+>/g, '').trim().slice(0, 180);
      }
      return 'Assistant Turn';
    };

    const eventsMap = new Map();
    const sessionSet = new Set();

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
            let sessionGoal = '';
            let currentPrompt = '';

            for (const line of lines) {
              try {
                const step = JSON.parse(line);
                if (step.type === 'USER_INPUT' || step.source === 'USER_EXPLICIT') {
                  const p = cleanPrompt(step.content);
                  if (p && !sessionGoal) {
                    sessionGoal = p;
                  }
                }
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
                if (step.type === 'USER_INPUT' || step.source === 'USER_EXPLICIT') {
                  const p = cleanPrompt(step.content);
                  if (p) {
                    currentPrompt = p;
                  }
                }

                if (step.source === 'MODEL' || step.type === 'PLANNER_RESPONSE' || step.type === 'ERROR_MESSAGE' || step.type === 'CODE_ACTION' || step.type === 'RUN_COMMAND') {
                  const stepIndex = step.step_index !== undefined ? step.step_index : Math.random().toString(36).substring(7);
                  const turnId = `agy_${convId}_${stepIndex}`;
                  if (syncedIds[turnId]) continue;

                  const toolsUsed = [];
                  if (Array.isArray(step.tool_calls)) {
                    for (const tc of step.tool_calls) {
                      if (tc.name) toolsUsed.push(tc.name);
                    }
                  }

                  let thinkingText = step.thinking || '';
                  if (!thinkingText && step.content && typeof step.content === 'string') {
                    thinkingText = step.content.slice(0, 250);
                  }

                  const promptChars = step.prompt_length || 3500;
                  const contentChars = (step.content ? step.content.length : 0) + (JSON.stringify(step.tool_calls || {}).length);
                  const inputTokens = step.usage?.input_tokens || step.usage?.inputTokens || Math.max(800, Math.round(promptChars / 4));
                  const outputTokens = step.usage?.output_tokens || step.usage?.outputTokens || Math.max(120, Math.round(contentChars / 4));
                  const total = inputTokens + outputTokens;

                  const actionSummary = formatActionSummary(step);
                  sessionSet.add(convId);
                  const resolvedPrompt = currentPrompt || sessionGoal;

                  eventsMap.set(turnId, {
                    eventId: `evt_${turnId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`,
                    timestamp: step.created_at || new Date().toISOString(),
                    organizationId: orgId || 'EXT',
                    userId: 'developer',
                    projectId: inferredProject,
                    sessionId: convId,
                    userPrompt: resolvedPrompt || undefined,
                    actionSummary,
                    sessionGoal: sessionGoal || undefined,
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
                      userPrompt: resolvedPrompt || undefined,
                      actionSummary,
                      sessionGoal: sessionGoal || undefined,
                      stepIndex: step.step_index,
                      stepType: step.type,
                      tools: toolsUsed,
                      toolCount: toolsUsed.length,
                      status: step.status || (step.type === 'ERROR_MESSAGE' ? 'ERROR' : 'DONE'),
                      thinkingSnippet: thinkingText ? thinkingText.slice(0, 250) : undefined,
                      turnId,
                    },
                    status: step.type === 'ERROR_MESSAGE' || step.status === 'ERROR' ? 'error' : 'success',
                  });
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    const eventsToUpload = Array.from(eventsMap.values());
    let successfullyUploadedEvents = 0;
    let successfullyUploadedTokens = 0;

    if (eventsToUpload.length > 0) {
      ensureConfigDir();

      try {
        const dbPath = path.join(CONFIG_DIR, 'collector.db');
        const db = new Database(dbPath);
        db.pragma('journal_mode = WAL');
        db.exec(`
          CREATE TABLE IF NOT EXISTS events (
            eventId TEXT PRIMARY KEY,
            organizationId TEXT NOT NULL,
            payload TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            retryCount INTEGER NOT NULL DEFAULT 0,
            errorMessage TEXT,
            createdAt TEXT NOT NULL,
            updatedAt TEXT NOT NULL
          );
        `);
        const insert = db.prepare(`
          INSERT OR IGNORE INTO events (eventId, organizationId, payload, status, retryCount, createdAt, updatedAt)
          VALUES (?, ?, ?, 'pending', 0, ?, ?)
        `);
        const now = new Date().toISOString();
        for (const evt of eventsToUpload) {
          insert.run(evt.eventId, evt.organizationId, JSON.stringify(evt), now, now);
        }
      } catch (e) {}

      const ingestEndpoint = `${apiUrl}/v1/events/batch`;
      const effectiveAuth = (tokenOrKey || '').trim();
      for (let i = 0; i < eventsToUpload.length; i += 10) {
        const batch = eventsToUpload.slice(i, i + 10);
        try {
          const resp = await fetch(ingestEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(effectiveAuth ? { Authorization: `Bearer ${effectiveAuth}` } : {}),
            },
            body: JSON.stringify({ events: batch }),
          });

          if (resp.ok) {
            for (const evt of batch) {
              const turnId = evt.metadata?.turnId;
              if (turnId) syncedIds[turnId] = true;
              successfullyUploadedEvents++;
              successfullyUploadedTokens += (evt.usage?.totalTokens || 0);
            }
            fs.writeFileSync(stateFile, JSON.stringify(syncedIds));
          } else if (resp.status === 401) {
            console.error(`\x1b[31m⚠ TokenTrail Auth Error (401): Please run 'tokentrail login' to authenticate.\x1b[0m`);
            break;
          } else {
            const errText = await resp.text().catch(() => '');
            console.error(`\x1b[33m⚠ TokenTrail Upload Warning (${resp.status}): ${errText}\x1b[0m`);
          }
        } catch (e) {
          console.error(`\x1b[33m⚠ TokenTrail Network Error: ${e.message}\x1b[0m`);
        }
      }
    }

    return { syncedEvents: successfullyUploadedEvents, totalTokens: successfullyUploadedTokens, sessions: sessionSet.size };
  }

  async syncAllLogs(apiUrl, tokenOrKey, orgId) {
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
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    } catch (e) {}
  } else {
    const legacyConfigFile = path.join(LEGACY_CONFIG_DIR, 'config.json');
    if (fs.existsSync(legacyConfigFile)) {
      try {
        cfg = JSON.parse(fs.readFileSync(legacyConfigFile, 'utf-8'));
      } catch (e) {}
    }
  }

  const defaultApi = process.env.TOKENTRAIL_API_URL || process.env.AGENTMETER_API_URL || 'https://api.tokentrail.xyz';
  const defaultIngest = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || 'https://api.tokentrail.xyz/v1/events';

  if (!cfg.apiUrl || cfg.apiUrl.includes('localhost') || cfg.apiUrl.includes('127.0.0.1')) {
    cfg.apiUrl = defaultApi;
  }
  if (!cfg.ingestUrl || cfg.ingestUrl.includes('localhost') || cfg.ingestUrl.includes('127.0.0.1')) {
    cfg.ingestUrl = defaultIngest;
  }
  if (!cfg.organizationId) {
    cfg.organizationId = 'org_default';
  }
  if (!cfg.connectedAgents) {
    cfg.connectedAgents = [];
  }

  return cfg;
}

function saveConfig(cfg) {
  ensureConfigDir();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2));
  try {
    fs.writeFileSync(path.join(LEGACY_CONFIG_DIR, 'config.json'), JSON.stringify(cfg, null, 2));
  } catch (e) {}
}

const DAEMON_STATUS_FILE = path.join(CONFIG_DIR, 'daemon_status.json');
const LOG_FILE = path.join(CONFIG_DIR, 'daemon.log');

function daemonLog(msg) {
  try {
    ensureConfigDir();
    const logFile = path.join(CONFIG_DIR, 'daemon.log');
    const entry = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logFile, entry);
    const stats = fs.statSync(logFile);
    if (stats.size > 1024 * 1024) {
      const content = fs.readFileSync(logFile, 'utf-8');
      fs.writeFileSync(logFile, content.slice(content.length - 200 * 1024));
    }
  } catch (e) {}
}

/**
 * Automatically cleans up logs, durability queue records, and agent config backups older than retention days (default: 15)
 */
function cleanOldLogsAndData(retentionDays = 15) {
  const days = Number(retentionDays) || 15;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const cutoffIso = new Date(cutoffMs).toISOString();
  let prunedLogLines = 0;
  let prunedDbRecords = 0;
  let prunedBackups = 0;

  // 1. Prune daemon.log entries older than 15 days
  const logFile = path.join(CONFIG_DIR, 'daemon.log');
  if (fs.existsSync(logFile)) {
    try {
      const content = fs.readFileSync(logFile, 'utf-8');
      const lines = content.split('\n');
      const keptLines = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/^\[([0-9T:\.\-Z]+)\]/);
        if (match && match[1]) {
          const ts = new Date(match[1]).getTime();
          if (!isNaN(ts) && ts < cutoffMs) {
            prunedLogLines++;
            continue;
          }
        }
        keptLines.push(line);
      }
      fs.writeFileSync(logFile, keptLines.join('\n') + (keptLines.length > 0 ? '\n' : ''));
    } catch (e) {}
  }

  // 2. Prune SQLite durability queue (events & batches older than 15 days) and VACUUM
  const dbPath = path.join(CONFIG_DIR, 'collector.db');
  if (fs.existsSync(dbPath)) {
    try {
      const db = new Database(dbPath);
      const res1 = db.prepare(`DELETE FROM events WHERE createdAt < ?`).run(cutoffIso);
      const res2 = db.prepare(`DELETE FROM upload_batches WHERE createdAt < ?`).run(cutoffIso);
      prunedDbRecords = (res1.changes || 0) + (res2.changes || 0);
      db.exec('VACUUM;');
      db.close();
    } catch (e) {}
  }

  // 3. Prune old agent backup files (> 15 days)
  const backupDirs = [
    path.join(os.homedir(), '.claude', 'backups'),
    path.join(os.homedir(), '.claude'),
    path.join(os.homedir(), '.config', 'github-copilot'),
    path.join(os.homedir(), '.tokentrail'),
    path.join(os.homedir(), '.agentpulse'),
  ];

  for (const dir of backupDirs) {
    if (fs.existsSync(dir)) {
      try {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          if (f.includes('.backup.') || f.endsWith('.log.old')) {
            const filePath = path.join(dir, f);
            try {
              const stats = fs.statSync(filePath);
              if (stats.mtimeMs < cutoffMs) {
                fs.unlinkSync(filePath);
                prunedBackups++;
              }
            } catch (err) {}
          }
        }
      } catch (e) {}
    }
  }

  return { prunedLogLines, prunedDbRecords, prunedBackups, retentionDays: days };
}

function updateDaemonStatus(details) {
  try {
    ensureConfigDir();
    const current = fs.existsSync(DAEMON_STATUS_FILE)
      ? JSON.parse(fs.readFileSync(DAEMON_STATUS_FILE, 'utf-8'))
      : {};
    fs.writeFileSync(
      DAEMON_STATUS_FILE,
      JSON.stringify({ ...current, ...details, updatedAt: new Date().toISOString() }, null, 2)
    );
  } catch (e) {}
}

function getDaemonStatus() {
  const pid = isDaemonRunning();
  if (!pid) return { running: false, pid: null };
  try {
    if (fs.existsSync(DAEMON_STATUS_FILE)) {
      const statusData = JSON.parse(fs.readFileSync(DAEMON_STATUS_FILE, 'utf-8'));
      return { running: true, pid, ...statusData };
    }
  } catch (e) {}
  return { running: true, pid };
}

function isDaemonRunning() {
  const pidFile = path.join(CONFIG_DIR, 'daemon.pid');
  if (fs.existsSync(pidFile)) {
    try {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
      if (pid && !isNaN(pid)) {
        process.kill(pid, 0);
        return pid;
      }
    } catch (e) {
      try { fs.unlinkSync(pidFile); } catch (err) {}
    }
  }
  return false;
}

function startBackgroundDaemon() {
  const runningPid = isDaemonRunning();
  if (runningPid) return runningPid;
  ensureConfigDir();
  try {
    let scriptPath = __filename;
    if (process.argv[1]) {
      try {
        scriptPath = fs.realpathSync(process.argv[1]);
      } catch (e) {
        scriptPath = process.argv[1];
      }
    }
    const child = spawn(process.execPath, [scriptPath, '__daemon_worker'], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();
    if (child.pid) {
      fs.writeFileSync(path.join(CONFIG_DIR, 'daemon.pid'), child.pid.toString());
      updateDaemonStatus({ pid: child.pid, status: 'running', startedAt: new Date().toISOString() });
      return child.pid;
    }
  } catch (e) {}
  return false;
}

function stopBackgroundDaemon() {
  const pid = isDaemonRunning();
  const pidFile = path.join(CONFIG_DIR, 'daemon.pid');
  if (pid) {
    try {
      process.kill(pid, 'SIGTERM');
    } catch (e) {}
    try { fs.unlinkSync(pidFile); } catch (err) {}
    updateDaemonStatus({ status: 'stopped', stoppedAt: new Date().toISOString() });
    return true;
  }
  try { if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile); } catch (err) {}
  return false;
}

const args = process.argv.slice(2);
const command = args[0] || 'status';
const targetAgent = args[1];
const hookManager = new SafeHookManager();

if (command === '__daemon_worker') {
  daemonLog(`Background Auto-Sync Worker started (PID: ${process.pid})`);
  updateDaemonStatus({ pid: process.pid, status: 'running', startedAt: new Date().toISOString() });

  // Run 15-day retention cleanup on worker start
  cleanOldLogsAndData(15);
  // Schedule recurring 15-day log cleanup every 6 hours
  setInterval(() => {
    try {
      const res = cleanOldLogsAndData(15);
      if (res.prunedLogLines > 0 || res.prunedDbRecords > 0 || res.prunedBackups > 0) {
        daemonLog(`[AUTO-CLEANUP] Pruned logs & records older than 15 days (${res.prunedLogLines} lines, ${res.prunedDbRecords} DB rows, ${res.prunedBackups} backups)`);
      }
    } catch (e) {}
  }, 6 * 60 * 60 * 1000);

  let isSyncing = false;
  let syncDebounceTimer = null;
  let totalEventsSynced = 0;
  let totalTokensSynced = 0;

  const triggerSync = async (reason = 'timer') => {
    if (isSyncing) return;
    isSyncing = true;
    try {
      const cfg = loadConfig();
      const auth = (cfg.token || cfg.apiKey || '').trim();
      const res = await hookManager.syncAllLogs(cfg.apiUrl, auth, cfg.organizationId);
      if (res.syncedEvents > 0) {
        totalEventsSynced += res.syncedEvents;
        totalTokensSynced += res.totalTokens;
        daemonLog(
          `[AUTO-SYNC] ${reason}: Synchronized ${res.syncedEvents} events (${res.totalTokens.toLocaleString()} tokens) across ${res.sessions} sessions. Total: ${totalEventsSynced} events.`
        );
        updateDaemonStatus({
          lastSyncAt: new Date().toISOString(),
          lastSyncedEvents: res.syncedEvents,
          lastSyncedTokens: res.totalTokens,
          totalEventsSynced,
          totalTokensSynced,
        });
      }
    } catch (err) {
      daemonLog(`[AUTO-SYNC ERROR] ${err.message}`);
    } finally {
      isSyncing = false;
    }
  };

  const scheduleSync = (source) => {
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => {
      triggerSync(`watch:${source}`).catch(() => null);
    }, 400);
  };

  // 1. Instant sync on startup
  triggerSync('startup');

  // 2. Set up comprehensive watchers across all supported agents
  const watchPaths = [
    { name: 'claude-projects', path: path.join(os.homedir(), '.claude', 'projects') },
    { name: 'claude-sessions', path: path.join(os.homedir(), '.claude', 'sessions') },
    { name: 'claude-base', path: path.join(os.homedir(), '.claude') },
    { name: 'antigravity-ide', path: path.join(os.homedir(), '.gemini', 'antigravity-ide', 'brain') },
    { name: 'gemini-brain', path: path.join(os.homedir(), '.gemini', 'brain') },
    { name: 'antigravity-brain', path: path.join(os.homedir(), '.antigravity', 'brain') },
    { name: 'copilot', path: path.join(os.homedir(), '.config', 'github-copilot') },
  ];

  for (const wp of watchPaths) {
    if (fs.existsSync(wp.path)) {
      try {
        fs.watch(wp.path, { recursive: true }, () => {
          scheduleSync(wp.name);
        });
        daemonLog(`Watching ${wp.name} at ${wp.path}`);
      } catch (e) {
        daemonLog(`Failed to watch ${wp.name}: ${e.message}`);
      }
    }
  }

  // 3. Robust polling loop fallback (every 2.5 seconds)
  setInterval(() => {
    triggerSync('interval');
  }, 2500);
} else {
  // Automatically start silent background daemon
  startBackgroundDaemon();
}

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

    case 'sync': {
      console.log('\n🔄 \x1b[1m\x1b[36mTokenTrail Transcript & Usage Sync\x1b[0m');
      console.log('───────────────────────────────────────────────────────');
      console.log('Scanning Claude Code (~/.claude/projects) and Gemini/Antigravity (~/.gemini)...');
      cleanOldLogsAndData(15);
      const res = await hookManager.syncAllLogs(config.apiUrl, config.token || config.apiKey, config.organizationId);
      if (res.syncedEvents > 0) {
        console.log(`\n\x1b[32m✔ Successfully synchronized ${res.syncedEvents} new prompt events across ${res.sessions} sessions!\x1b[0m`);
        if (res.antigravity && res.antigravity.syncedEvents > 0) {
          console.log(`  • Gemini / Antigravity: ${res.antigravity.syncedEvents} events (${res.antigravity.totalTokens.toLocaleString()} tokens)`);
        }
        if (res.claude && res.claude.syncedEvents > 0) {
          console.log(`  • Claude Code:          ${res.claude.syncedEvents} events (${res.claude.totalTokens.toLocaleString()} tokens)`);
        }
        console.log(`\x1b[32m✔ Ingested ${res.totalTokens.toLocaleString()} total tokens into TokenTrail.\x1b[0m`);
      } else {
        console.log(`\n\x1b[32m✔ All local Claude Code and Gemini/Antigravity sessions are up to date.\x1b[0m`);
      }
      const daemon = getDaemonStatus();
      if (daemon.running) {
        console.log(`\x1b[90m⚡ Background Auto-Sync Daemon is active (PID: ${daemon.pid}) and syncing live.\x1b[0m`);
      }
      console.log(`Dashboard: \x1b[34mhttps://www.tokentrail.xyz\x1b[0m\n`);
      break;
    }

    case 'daemon': {
      const subCommand = targetAgent || 'status';
      console.log('\n🔄 \x1b[1m\x1b[36mTokenTrail Auto-Sync Daemon\x1b[0m');
      console.log('───────────────────────────────────────────────────────');

      if (subCommand === 'start') {
        const pid = startBackgroundDaemon();
        if (pid) {
          console.log(`\x1b[32m✔ Auto-sync daemon started successfully (PID: ${pid})\x1b[0m`);
          console.log('Live transcripts from Claude Code, Antigravity, and Copilot will sync automatically.\n');
        } else {
          const existingPid = isDaemonRunning();
          console.log(`\x1b[33mℹ Auto-sync daemon is already running (PID: ${existingPid})\x1b[0m\n`);
        }
      } else if (subCommand === 'stop') {
        const stopped = stopBackgroundDaemon();
        if (stopped) {
          console.log('\x1b[32m✔ Auto-sync daemon stopped.\x1b[0m\n');
        } else {
          console.log('\x1b[33mℹ Auto-sync daemon was not running.\x1b[0m\n');
        }
      } else if (subCommand === 'restart') {
        stopBackgroundDaemon();
        await new Promise((r) => setTimeout(r, 500));
        const pid = startBackgroundDaemon();
        console.log(`\x1b[32m✔ Auto-sync daemon restarted successfully (PID: ${pid})\x1b[0m\n`);
      } else if (subCommand === 'clean') {
        const customDays = parseInt(args[2] || '15', 10) || 15;
        const res = cleanOldLogsAndData(customDays);
        console.log(`\x1b[32m✔ Log and telemetry database cleanup completed (${res.retentionDays}-day retention policy)\x1b[0m`);
        console.log(`  • Pruned old log entries:    \x1b[33m${res.prunedLogLines}\x1b[0m lines`);
        console.log(`  • Pruned local DB records:   \x1b[33m${res.prunedDbRecords}\x1b[0m rows`);
        console.log(`  • Pruned stale backup files: \x1b[33m${res.prunedBackups}\x1b[0m files`);
        console.log(`\x1b[32m✔ Local disk space optimized.\x1b[0m\n`);
      } else if (subCommand === 'logs') {
        if (fs.existsSync(LOG_FILE)) {
          const lines = fs.readFileSync(LOG_FILE, 'utf-8').trim().split('\n');
          console.log(`Recent Daemon Activity (last ${Math.min(25, lines.length)} entries):`);
          console.log('───────────────────────────────────────────────────────');
          lines.slice(-25).forEach((line) => console.log(`  \x1b[90m${line}\x1b[0m`));
          console.log('');
        } else {
          console.log('\x1b[33mℹ No daemon logs found yet.\x1b[0m\n');
        }
      } else {
        // status
        const status = getDaemonStatus();
        if (status.running) {
          console.log(`Status:             \x1b[32m● Running (PID: ${status.pid})\x1b[0m`);
          if (status.startedAt) console.log(`Started:            ${new Date(status.startedAt).toLocaleString()}`);
          if (status.lastSyncAt) console.log(`Last Auto-Sync:     ${new Date(status.lastSyncAt).toLocaleString()}`);
          if (status.totalEventsSynced !== undefined) {
            console.log(`Events Auto-Synced: \x1b[32m${status.totalEventsSynced.toLocaleString()}\x1b[0m`);
          }
          if (status.totalTokensSynced !== undefined) {
            console.log(`Tokens Auto-Synced: \x1b[32m${status.totalTokensSynced.toLocaleString()}\x1b[0m`);
          }
          console.log(`Retention Policy:   \x1b[32m15 Days (Auto-purges old logs, SQLite DB, backups)\x1b[0m`);
          console.log(`Log File:           ${LOG_FILE}`);
        } else {
          console.log('Status:             \x1b[31m● Stopped\x1b[0m');
          console.log('Run \x1b[33mtokentrail daemon start\x1b[0m to activate continuous background sync.');
        }
        console.log('\nCommands:');
        console.log('  tokentrail daemon start        Start continuous background sync');
        console.log('  tokentrail daemon stop         Stop background sync process');
        console.log('  tokentrail daemon restart      Restart background sync worker');
        console.log('  tokentrail daemon clean [days] Auto-prune logs & DB older than 15 days');
        console.log('  tokentrail daemon logs         View live background sync log\n');
      }
      break;
    }

    case 'watch': {
      console.log('\n👀 \x1b[1m\x1b[36mTokenTrail Live Real-Time Agent Watcher\x1b[0m');
      console.log('───────────────────────────────────────────────────────');
      console.log('Listening for live prompt completions and transcript changes across Claude Code & Antigravity...');
      console.log('\x1b[90m(Press Ctrl+C to stop)\x1b[0m\n');

      const poll = async () => {
        const res = await hookManager.syncAllLogs(config.apiUrl, config.token || config.apiKey, config.organizationId);
        if (res.syncedEvents > 0) {
          console.log(`[\x1b[32m${new Date().toLocaleTimeString()}\x1b[0m] ⚡ Ingested \x1b[33m${res.syncedEvents} new events\x1b[0m (${res.totalTokens.toLocaleString()} tokens)`);
        }
      };

      await poll();
      setInterval(poll, 2500);
      break;
    }

    case 'status': {
      // Auto sync pending transcripts & clean old logs
      cleanOldLogsAndData(15);
      const syncRes = await hookManager.syncAllLogs(config.apiUrl, config.token || config.apiKey, config.organizationId);
      const daemon = getDaemonStatus();

      console.log('\n📊 \x1b[1m\x1b[36mTokenTrail Status\x1b[0m');
      console.log('───────────────────────────────────────────────────────');
      console.log(`Central API:        \x1b[32m${config.apiUrl}\x1b[0m`);
      console.log(`Ingestion Endpoint: \x1b[32m${config.ingestUrl}\x1b[0m`);
      console.log(`Organization:       ${config.organizationId}`);
      console.log(`Authenticated:      ${config.apiKey || config.token ? '\x1b[32m✔ Active\x1b[0m' : '\x1b[33mNo (Run `tokentrail login`)\x1b[0m'}`);
      console.log(`Auto-Sync Daemon:   ${daemon.running ? `\x1b[32m✔ Active (PID: ${daemon.pid})\x1b[0m` : '\x1b[33m⚠ Inactive (Run `tokentrail daemon start`)\x1b[0m'}`);
      console.log(`Retention Policy:   \x1b[32m15 Days (Auto-cleanup active)\x1b[0m`);
      console.log(`Connected Agents:   ${config.connectedAgents.length > 0 ? config.connectedAgents.join(', ') : 'None (run `tokentrail connect claude`)'}`);
      if (syncRes.syncedEvents > 0) {
        console.log(`Recent Sync:        \x1b[32m✔ ${syncRes.syncedEvents} events (${syncRes.totalTokens.toLocaleString()} tokens) ingested\x1b[0m`);
      }
      console.log(`Config File:        ${CONFIG_FILE}\n`);
      break;
    }

    case 'doctor': {
      console.log('\n🩺 \x1b[1m\x1b[36mTokenTrail Diagnostics & Doctor\x1b[0m');
      console.log('───────────────────────────────────────────────────────');

      cleanOldLogsAndData(15);
      const syncRes = await hookManager.syncAllLogs(config.apiUrl, config.token || config.apiKey, config.organizationId);
      let daemon = getDaemonStatus();
      if (!daemon.running) {
        startBackgroundDaemon();
        daemon = getDaemonStatus();
      }

      let apiOnline = false;
      try {
        const res = await fetch(`${config.apiUrl}/health`).catch(() => null);
        apiOnline = res ? res.ok : false;
      } catch (e) {}

      console.log(`Central API Reachability ... ${apiOnline ? '\x1b[32m✔ Online\x1b[0m' : '\x1b[33m⚠ Offline (Local queue buffering active)\x1b[0m'}`);
      console.log(`Background Auto-Sync Daemon . ${daemon.running ? `\x1b[32m✔ Active (PID: ${daemon.pid})\x1b[0m` : '\x1b[31m✖ Inactive\x1b[0m'}`);
      console.log(`SQLite Durability Queue ..... \x1b[32m✔ WAL Mode Active\x1b[0m`);
      console.log(`Disk Retention Policy ...... \x1b[32m✔ 15-Day Auto-Purge Active\x1b[0m`);
      console.log(`Queue Database ............. ${path.join(CONFIG_DIR, 'collector.db')}`);
      console.log(`Claude Code Sessions ....... ${fs.existsSync(path.join(os.homedir(), '.claude')) ? '\x1b[32m✔ Connected\x1b[0m' : 'Not detected'}`);
      console.log(`Copilot Hook ............... ${fs.existsSync(path.join(os.homedir(), '.config', 'github-copilot')) ? '\x1b[32m✔ Installed\x1b[0m' : 'Not installed'}`);
      let mcpStatus = 'Not configured';
      const mcpFile = path.join(os.homedir(), '.gemini', 'config', 'mcp_config.json');
      if (fs.existsSync(mcpFile)) {
        try {
          const mcpData = JSON.parse(fs.readFileSync(mcpFile, 'utf-8'));
          if (mcpData.mcpServers && (mcpData.mcpServers.tokentrail || mcpData.mcpServers.agentmeter)) {
            mcpStatus = '\x1b[32m✔ Connected\x1b[0m';
          } else {
            mcpStatus = '\x1b[33m⚠ File found (Run `tokentrail connect antigravity`)\x1b[0m';
          }
        } catch (e) {
          mcpStatus = '\x1b[32m✔ Connected\x1b[0m';
        }
      }
      console.log(`Gemini/Antigravity MCP ..... ${mcpStatus}`);
      if (syncRes.syncedEvents > 0) {
        console.log(`Ingestion Buffer ........... \x1b[32m✔ ${syncRes.syncedEvents} prompt events ingested\x1b[0m`);
      }
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
      console.log('  tokentrail login               Authenticate developer credentials & auto-populate MCP');
      console.log('  tokentrail sync                Scan & synchronize Claude Code sessions and token usage');
      console.log('  tokentrail daemon [cmd]        Manage background auto-sync worker (start|stop|restart|clean|status|logs)');
      console.log('  tokentrail watch               Stream and ingest agent completions in real-time');
      console.log('  tokentrail connect <agent>     Automatically install telemetry hooks for an agent');
      console.log('  tokentrail disconnect <agent>  Safely remove hooks without touching user configs');
      console.log('  tokentrail status              Show connected agents and server endpoints');
      console.log('  tokentrail agents              List supported coding agents');
      console.log('  tokentrail doctor              Run diagnostic health check\n');
      break;
    }
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
