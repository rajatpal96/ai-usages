import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { createScopedLogger } from '../../../packages/logger/src/index.js';
import { formatCurrency, formatNumber } from '../../../packages/common/src/index.js';

const log = createScopedLogger('mcp-server');

// Centralized TokenTrail API Endpoint (Defaults to central backend)
const API_BASE_URL = process.env.TOKENTRAIL_API_URL || process.env.AGENTMETER_API_URL || process.env.API_BASE_URL || 'https://api.tokentrail.xyz';
const INGEST_BASE_URL = process.env.TOKENTRAIL_INGEST_URL || process.env.AGENTMETER_INGEST_URL || process.env.INGEST_BASE_URL || 'https://api.tokentrail.xyz';
const API_KEY = process.env.TOKENTRAIL_API_KEY || process.env.AGENTMETER_API_KEY || process.env.API_KEY || '';
const MCP_ACCESS_TOKEN = process.env.MCP_ACCESS_TOKEN || '';
const DEFAULT_ORG_ID = process.env.TOKENTRAIL_ORG_ID || process.env.DEFAULT_ORG_ID || 'org_default';

/**
 * Helper to call the Central AgentMeter REST API
 */
async function callCentralApi(path: string, options: RequestInit = {}): Promise<any> {
  const token = (options as any).token || MCP_ACCESS_TOKEN || API_KEY;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AgentMeter Central API Error (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Built-in Auto-Telemetry Reporter: Pushes agent invocation telemetry to Central Ingestion
 */
async function reportTelemetry(event: Record<string, any>): Promise<void> {
  try {
    await fetch(`${INGEST_BASE_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(MCP_ACCESS_TOKEN || API_KEY ? { Authorization: `Bearer ${MCP_ACCESS_TOKEN || API_KEY}` } : {}),
      },
      body: JSON.stringify({
        organizationId: DEFAULT_ORG_ID,
        timestamp: new Date().toISOString(),
        ...event,
      }),
    });
  } catch (err: any) {
    // Fail silently without disrupting tool execution
    log.warn({ err: err.message }, 'Failed to stream background telemetry event');
  }
}

const TOOLS: Tool[] = [
  {
    name: 'usage_today',
    description: "Get today's total AI agent token consumption, request count, and estimated cost across the organization.",
    inputSchema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization identifier (optional)' },
      },
    },
  },
  {
    name: 'usage_this_week',
    description: "Get this week's AI agent token consumption, cost breakdown, and top agents.",
    inputSchema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization identifier (optional)' },
      },
    },
  },
  {
    name: 'usage_this_month',
    description: "Get this month's AI agent token metrics and cost summary.",
    inputSchema: {
      type: 'object',
      properties: {
        organizationId: { type: 'string', description: 'Organization identifier (optional)' },
      },
    },
  },
  {
    name: 'usage_current_session',
    description: 'Get real-time token consumption, latency, and cost for a specific active coding session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to inspect' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'usage_by_agent',
    description: 'Break down AI consumption across agents (Claude Code, GitHub Copilot, Gemini/Antigravity, Codex, Grok).',
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Time range (default 30d)' },
      },
    },
  },
  {
    name: 'usage_by_model',
    description: 'Break down AI consumption and cost by model (Claude 3.7 Sonnet, GPT-4o, Gemini 2.5 Pro, etc.).',
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Time range (default 30d)' },
      },
    },
  },
  {
    name: 'usage_by_project',
    description: 'Break down AI spend and token usage by repository or project name.',
    inputSchema: {
      type: 'object',
      properties: {
        range: { type: 'string', enum: ['24h', '7d', '30d'], description: 'Time range (default 30d)' },
      },
    },
  },
  {
    name: 'cost_today',
    description: "Get today's total estimated spend in USD across all AI coding assistants.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cost_this_month',
    description: "Get this month's estimated USD spend vs budget allocation.",
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'budget_status',
    description: 'Check organization monthly budget limit, current spend, and remaining allocation percentage.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'top_expensive_sessions',
    description: 'List the most expensive AI coding sessions with agent names, token counts, and USD cost.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max sessions to return (default 5)' },
      },
    },
  },
  {
    name: 'track_usage_event',
    description: 'Directly record a token consumption or execution event from Antigravity/IDE into central AgentMeter.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string', description: 'Agent identifier (e.g. gemini-antigravity, claude-code)' },
        model: { type: 'string', description: 'Model name (e.g. gemini-2.5-pro, claude-3-7-sonnet)' },
        promptTokens: { type: 'number', description: 'Number of prompt tokens' },
        completionTokens: { type: 'number', description: 'Number of completion tokens' },
        sessionId: { type: 'string', description: 'Session identifier' },
        projectId: { type: 'string', description: 'Repository / Project identifier' },
      },
      required: ['agent', 'model', 'promptTokens', 'completionTokens'],
    },
  },
];

export function createMcpServer() {
  const server = new Server(
    {
      name: 'agentmeter-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: TOOLS };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params;
    const startTime = Date.now();

    try {
      let resultText = '';

      switch (name) {
        case 'usage_today': {
          const overview = await callCentralApi('/v1/analytics/overview?range=24h');
          resultText = JSON.stringify(
            {
              period: 'Today (Past 24 Hours)',
              totalRequests: overview.totalRequests,
              totalTokens: overview.totalTokens,
              totalTokensFormatted: formatNumber(overview.totalTokens),
              totalCostUsd: formatCurrency(overview.totalCostUsd),
              activeAgents: overview.activeAgentsCount,
            },
            null,
            2
          );
          break;
        }

        case 'usage_this_week': {
          const overview = await callCentralApi('/v1/analytics/overview?range=7d');
          resultText = JSON.stringify(
            {
              period: 'This Week (Past 7 Days)',
              totalRequests: overview.totalRequests,
              totalTokens: overview.totalTokens,
              totalCostUsd: formatCurrency(overview.totalCostUsd),
              usageByAgent: overview.usageByAgent,
            },
            null,
            2
          );
          break;
        }

        case 'usage_this_month': {
          const overview = await callCentralApi('/v1/analytics/overview?range=30d');
          resultText = JSON.stringify(
            {
              period: 'This Month (Past 30 Days)',
              totalRequests: overview.totalRequests,
              totalTokens: overview.totalTokens,
              totalCostUsd: formatCurrency(overview.totalCostUsd),
              topAgents: overview.usageByAgent?.slice(0, 3),
              topProjects: overview.costByProject?.slice(0, 3),
            },
            null,
            2
          );
          break;
        }

        case 'usage_current_session': {
          const sessionId = (args as any).sessionId;
          const detail = await callCentralApi(`/v1/sessions/${sessionId}`);
          resultText = JSON.stringify(detail, null, 2);
          break;
        }

        case 'usage_by_agent': {
          const range = (args as any).range || '30d';
          const data = await callCentralApi(`/v1/analytics/usage/by-agent?range=${range}`);
          resultText = JSON.stringify(data, null, 2);
          break;
        }

        case 'usage_by_model': {
          const range = (args as any).range || '30d';
          const data = await callCentralApi(`/v1/analytics/usage/by-model?range=${range}`);
          resultText = JSON.stringify(data, null, 2);
          break;
        }

        case 'usage_by_project': {
          const range = (args as any).range || '30d';
          const data = await callCentralApi(`/v1/analytics/usage/by-project?range=${range}`);
          resultText = JSON.stringify(data, null, 2);
          break;
        }

        case 'cost_today': {
          const overview = await callCentralApi('/v1/analytics/overview?range=24h');
          resultText = `Today's estimated AI spend is ${formatCurrency(overview.totalCostUsd)} across ${overview.totalRequests} requests.`;
          break;
        }

        case 'cost_this_month': {
          const [overview, budget] = await Promise.all([
            callCentralApi('/v1/analytics/overview?range=30d'),
            callCentralApi('/v1/budgets').catch(() => null),
          ]);
          resultText = JSON.stringify(
            {
              currentSpendUsd: formatCurrency(overview.totalCostUsd),
              monthlyBudgetLimit: budget ? formatCurrency(budget.monthlyLimitUsd) : '$1,000.00',
              percentUsed: budget ? `${((overview.totalCostUsd / budget.monthlyLimitUsd) * 100).toFixed(1)}%` : 'N/A',
            },
            null,
            2
          );
          break;
        }

        case 'budget_status': {
          const budget = await callCentralApi('/v1/budgets');
          const percent = ((budget.currentSpendUsd / budget.monthlyLimitUsd) * 100).toFixed(1);
          resultText = JSON.stringify(
            {
              monthlyLimit: formatCurrency(budget.monthlyLimitUsd),
              currentSpend: formatCurrency(budget.currentSpendUsd),
              remainingBudget: formatCurrency(Math.max(0, budget.monthlyLimitUsd - budget.currentSpendUsd)),
              percentUsed: `${percent}%`,
              alertThreshold: `${budget.alertThresholdPercent}%`,
              status: Number(percent) >= budget.alertThresholdPercent ? 'WARNING' : 'HEALTHY',
            },
            null,
            2
          );
          break;
        }

        case 'top_expensive_sessions': {
          const limit = (args as any).limit || 5;
          const data = await callCentralApi(`/v1/sessions?limit=${limit}`);
          resultText = JSON.stringify(data.sessions || [], null, 2);
          break;
        }

        case 'track_usage_event': {
          await reportTelemetry(args as any);
          resultText = 'Usage event recorded successfully into AgentMeter central observability pipeline.';
          break;
        }

        default:
          throw new Error(`Unknown MCP tool: ${name}`);
      }

      // Auto-track the MCP tool call telemetry in the background
      reportTelemetry({
        agent: 'mcp-client',
        model: 'mcp-tool-call',
        metadata: {
          toolName: name,
          executionLatencyMs: Date.now() - startTime,
        },
      });

      return {
        content: [{ type: 'text', text: resultText }],
      };
    } catch (err: any) {
      log.error({ err: err.message, toolName: name }, 'MCP tool execution error');
      return {
        isError: true,
        content: [{ type: 'text', text: `AgentMeter MCP Error: ${err.message}` }],
      };
    }
  });

  return server;
}

export async function runMcpStdio() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log.info({ apiBaseUrl: API_BASE_URL }, '🔌 AgentMeter Zero-DB Lightweight MCP Client connected via stdio');
}

if (process.argv[1] && process.argv[1].includes('apps/mcp-server')) {
  runMcpStdio();
}
