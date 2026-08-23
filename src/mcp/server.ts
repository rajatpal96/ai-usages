import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MetricsService } from '../services/metricsService.js';

export function createMCPServer() {
  const server = new Server(
    {
      name: 'ai-agent-metrics-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Define available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'get_organization_metrics',
          description: 'Get organization-wide AI agent usage metrics, total token consumption, estimated USD costs, active developer count, and team & agent breakdowns.',
          inputSchema: {
            type: 'object',
            properties: {
              organizationName: {
                type: 'string',
                description: 'Optional organization name or ID to filter by.'
              }
            }
          }
        },
        {
          name: 'get_team_metrics',
          description: 'Get AI agent usage metrics grouped by team, including member counts, token breakdown, and budget spending.',
          inputSchema: {
            type: 'object',
            properties: {
              teamName: {
                type: 'string',
                description: 'Optional team name or ID to filter by (e.g. "Engineering", "Frontend", "DevOps").'
              }
            }
          }
        },
        {
          name: 'get_member_metrics',
          description: 'Get member-wise (individual developer) AI agent usage metrics, model distribution, request counts, and cost.',
          inputSchema: {
            type: 'object',
            properties: {
              username: {
                type: 'string',
                description: 'Optional username or email of the developer (e.g. "alex@company.com" or "johndoe").'
              }
            }
          }
        },
        {
          name: 'get_budget_alerts',
          description: 'Check budget alerts for teams approaching or exceeding their monthly AI spending allocation.',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'ingest_usage_event',
          description: 'Record an AI usage event for any agent (Claude, Copilot, Cursor, Windsurf, Custom MCP agent).',
          inputSchema: {
            type: 'object',
            properties: {
              username: { type: 'string', description: 'Developer username or email.' },
              organizationName: { type: 'string', description: 'Organization name.' },
              teamName: { type: 'string', description: 'Team name.' },
              agentName: { type: 'string', description: 'Agent identifier (e.g. "claude_code", "copilot", "cursor", "custom_mcp").' },
              captureMethod: { type: 'string', enum: ['proxy', 'log_watcher', 'mcp_sniffer'], description: 'How the metric was captured.' },
              model: { type: 'string', description: 'LLM model name (e.g. "claude-3-5-sonnet", "gpt-4o", "gemini-1.5-pro").' },
              promptTokens: { type: 'number', description: 'Number of input/prompt tokens.' },
              completionTokens: { type: 'number', description: 'Number of output/completion tokens.' }
            },
            required: ['username', 'agentName', 'model', 'promptTokens', 'completionTokens']
          }
        }
      ]
    };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'get_organization_metrics') {
        const orgName = (args as any)?.organizationName;
        const metrics = await MetricsService.getOrganizationMetrics(orgName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(metrics, null, 2)
            }
          ]
        };
      }

      if (name === 'get_team_metrics') {
        const teamName = (args as any)?.teamName;
        const metrics = await MetricsService.getTeamMetrics(teamName);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(metrics, null, 2)
            }
          ]
        };
      }

      if (name === 'get_member_metrics') {
        const username = (args as any)?.username;
        const metrics = await MetricsService.getMemberMetrics(username);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(metrics, null, 2)
            }
          ]
        };
      }

      if (name === 'get_budget_alerts') {
        const alerts = await MetricsService.getBudgetAlerts();
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(alerts, null, 2)
            }
          ]
        };
      }

      if (name === 'ingest_usage_event') {
        const params = args as any;
        const result = await MetricsService.recordUsage({
          username: params.username,
          organizationName: params.organizationName,
          teamName: params.teamName,
          agentName: params.agentName,
          captureMethod: params.captureMethod || 'proxy',
          model: params.model,
          promptTokens: Number(params.promptTokens),
          completionTokens: Number(params.completionTokens)
        });

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Usage recorded successfully',
                usageId: result._id,
                estimatedCostUSD: result.estimatedCost
              }, null, 2)
            }
          ]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (error: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error executing tool '${name}': ${error.message}`
          }
        ]
      };
    }
  });

  return server;
}

export async function startMCPServerStdio() {
  const server = createMCPServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[MCP] AI Agent Metrics MCP Server running on stdio');
}
