import {
  UsageEventModel,
  Session,
  McpToolCall,
  BudgetModel,
  AlertRuleModel,
  AlertHistory,
  Pricing,
  ApiKey,
  Project,
  Agent,
  IUsageEvent,
} from './index.js';
import { parseTimeRange } from '../../common/src/index.js';

export interface OverviewMetrics {
  totalRequests: number;
  totalTokens: number;
  totalCostUsd: number;
  activeAgentsCount: number;
  activeProjectsCount: number;
  activeUsersCount: number;
  tokenTrend: { date: string; inputTokens: number; outputTokens: number; cacheTokens: number; cost: number }[];
  usageByAgent: { agentName: string; totalTokens: number; totalCostUsd: number; requestCount: number; percentage: number }[];
  costByProject: { projectId: string; projectName?: string; totalCostUsd: number; totalTokens: number; budgetUsd?: number }[];
  recentSessions: any[];
}

export class AnalyticsService {
  /**
   * GET /v1/analytics/overview
   */
  async getOverview(organizationId: string, rangeStr: string = '30d'): Promise<OverviewMetrics> {
    const { start, end } = parseTimeRange(rangeStr);

    const matchStage = {
      organizationId,
      timestamp: { $gte: start, $lte: end },
    };

    // 1. Overall Aggregations
    const [overallSummary] = await UsageEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          inputTokens: { $sum: '$usage.inputTokens' },
          outputTokens: { $sum: '$usage.outputTokens' },
          cacheReadTokens: { $sum: '$usage.cacheReadTokens' },
          cacheWriteTokens: { $sum: '$usage.cacheWriteTokens' },
          totalCostUsd: { $sum: '$cost.total' },
          agents: { $addToSet: '$agent.name' },
          projects: { $addToSet: '$projectId' },
          users: { $addToSet: '$userId' },
        },
      },
    ]);

    // 2. Token & Cost Trend (group by day)
    const trendAgg = await UsageEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          inputTokens: { $sum: '$usage.inputTokens' },
          outputTokens: { $sum: '$usage.outputTokens' },
          cacheTokens: { $sum: { $add: ['$usage.cacheReadTokens', '$usage.cacheWriteTokens'] } },
          cost: { $sum: '$cost.total' },
          requests: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const tokenTrend = trendAgg.map((item) => ({
      date: item._id,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      cacheTokens: item.cacheTokens,
      cost: Number(item.cost.toFixed(4)),
      requests: item.requests,
    }));

    // 3. Usage by Agent
    const agentAgg = await UsageEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$agent.name',
          totalTokens: { $sum: '$usage.totalTokens' },
          totalCostUsd: { $sum: '$cost.total' },
          requestCount: { $sum: 1 },
        },
      },
      { $sort: { totalCostUsd: -1 } },
    ]);

    const totalCostAll = overallSummary?.totalCostUsd || 1;
    const usageByAgent = agentAgg.map((item) => ({
      agentName: item._id,
      totalTokens: item.totalTokens,
      totalCostUsd: Number(item.totalCostUsd.toFixed(4)),
      requestCount: item.requestCount,
      percentage: Number(((item.totalCostUsd / totalCostAll) * 100).toFixed(1)),
    }));

    // 4. Cost by Project
    const projectAgg = await UsageEventModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $ifNull: ['$projectId', 'default-repo'] },
          totalCostUsd: { $sum: '$cost.total' },
          totalTokens: { $sum: '$usage.totalTokens' },
          requestCount: { $sum: 1 },
        },
      },
      { $sort: { totalCostUsd: -1 } },
    ]);

    const costByProject = projectAgg.map((item) => ({
      projectId: item._id,
      projectName: item._id,
      totalCostUsd: Number(item.totalCostUsd.toFixed(4)),
      totalTokens: item.totalTokens,
      requestCount: item.requestCount,
      budgetUsd: 250, // default budget reference
    }));

    // 5. Recent Sessions
    const recentSessions = await Session.find({ organizationId })
      .sort({ startTime: -1 })
      .limit(6)
      .lean();

    return {
      totalRequests: overallSummary?.totalRequests || 0,
      totalTokens: overallSummary?.totalTokens || 0,
      totalCostUsd: Number((overallSummary?.totalCostUsd || 0).toFixed(4)),
      activeAgentsCount: overallSummary?.agents?.length || 0,
      activeProjectsCount: overallSummary?.projects?.filter(Boolean).length || 1,
      activeUsersCount: overallSummary?.users?.filter(Boolean).length || 1,
      tokenTrend,
      usageByAgent,
      costByProject,
      recentSessions,
    };
  }

  /**
   * GET /v1/analytics/usage/trend?range=30d
   */
  async getUsageTrend(organizationId: string, rangeStr: string = '30d') {
    const { start, end } = parseTimeRange(rangeStr);

    return UsageEventModel.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          inputTokens: { $sum: '$usage.inputTokens' },
          outputTokens: { $sum: '$usage.outputTokens' },
          cacheReadTokens: { $sum: '$usage.cacheReadTokens' },
          cacheWriteTokens: { $sum: '$usage.cacheWriteTokens' },
          reasoningTokens: { $sum: '$usage.reasoningTokens' },
          totalCostUsd: { $sum: '$cost.total' },
        },
      },
      { $sort: { _id: 1 } },
    ]);
  }

  /**
   * GET /v1/analytics/usage/by-agent
   */
  async getUsageByAgent(organizationId: string, rangeStr: string = '30d') {
    const { start, end } = parseTimeRange(rangeStr);

    return UsageEventModel.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: '$agent.name',
          version: { $last: '$agent.version' },
          agentType: { $last: '$agent.type' },
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          inputTokens: { $sum: '$usage.inputTokens' },
          outputTokens: { $sum: '$usage.outputTokens' },
          cacheReadTokens: { $sum: '$usage.cacheReadTokens' },
          cacheWriteTokens: { $sum: '$usage.cacheWriteTokens' },
          totalCostUsd: { $sum: '$cost.total' },
          avgLatencyMs: { $avg: '$performance.latencyMs' },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
          },
          models: { $addToSet: '$model.name' },
          projects: { $addToSet: '$projectId' },
        },
      },
      { $sort: { totalCostUsd: -1 } },
    ]);
  }

  /**
   * GET /v1/analytics/usage/by-model
   */
  async getUsageByModel(organizationId: string, rangeStr: string = '30d') {
    const { start, end } = parseTimeRange(rangeStr);

    return UsageEventModel.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: {
            provider: '$provider.name',
            model: '$model.name',
          },
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          inputTokens: { $sum: '$usage.inputTokens' },
          outputTokens: { $sum: '$usage.outputTokens' },
          cacheReadTokens: { $sum: '$usage.cacheReadTokens' },
          cacheWriteTokens: { $sum: '$usage.cacheWriteTokens' },
          reasoningTokens: { $sum: '$usage.reasoningTokens' },
          totalCostUsd: { $sum: '$cost.total' },
          avgLatencyMs: { $avg: '$performance.latencyMs' },
        },
      },
      { $sort: { totalCostUsd: -1 } },
    ]);
  }

  /**
   * GET /v1/analytics/usage/by-project
   */
  async getUsageByProject(organizationId: string, rangeStr: string = '30d') {
    const { start, end } = parseTimeRange(rangeStr);

    return UsageEventModel.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$projectId', 'unassigned'] },
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          totalCostUsd: { $sum: '$cost.total' },
          agents: { $addToSet: '$agent.name' },
          users: { $addToSet: '$userId' },
        },
      },
      { $sort: { totalCostUsd: -1 } },
    ]);
  }

  /**
   * GET /v1/analytics/usage/by-user
   */
  async getUsageByUser(organizationId: string, rangeStr: string = '30d') {
    const { start, end } = parseTimeRange(rangeStr);

    return UsageEventModel.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { $ifNull: ['$userId', 'anonymous-dev'] },
          totalRequests: { $sum: 1 },
          totalTokens: { $sum: '$usage.totalTokens' },
          totalCostUsd: { $sum: '$cost.total' },
          agents: { $addToSet: '$agent.name' },
          topModels: { $addToSet: '$model.name' },
        },
      },
      { $sort: { totalCostUsd: -1 } },
    ]);
  }

  /**
   * GET /v1/sessions
   */
  async listSessions(organizationId: string, options: { agent?: string; project?: string; limit?: number; offset?: number }) {
    const query: any = { organizationId };
    if (options.agent) query.agentName = options.agent;
    if (options.project) query.projectId = options.project;

    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    const [total, sessions] = await Promise.all([
      Session.countDocuments(query),
      Session.find(query)
        .sort({ startTime: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
    ]);

    return {
      total,
      limit,
      offset,
      sessions,
    };
  }

  /**
   * GET /v1/sessions/:id
   */
  async getSessionDetail(organizationId: string, sessionId: string) {
    const session = await Session.findOne({ organizationId, sessionId }).lean();
    if (!session) return null;

    const events = await UsageEventModel.find({ organizationId, sessionId })
      .sort({ timestamp: 1 })
      .lean();

    return {
      session,
      eventCount: events.length,
      events,
    };
  }

  /**
   * GET /v1/mcp/analytics
   */
  async getMcpAnalytics(organizationId: string, rangeStr: string = '30d') {
    const { start, end } = parseTimeRange(rangeStr);

    const [summary] = await McpToolCall.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalCalls: { $sum: 1 },
          avgLatencyMs: { $avg: '$latencyMs' },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
          },
          servers: { $addToSet: '$serverName' },
          tools: { $addToSet: '$toolName' },
        },
      },
    ]);

    const toolBreakdown = await McpToolCall.aggregate([
      {
        $match: {
          organizationId,
          timestamp: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { server: '$serverName', tool: '$toolName' },
          calls: { $sum: 1 },
          avgLatencyMs: { $avg: '$latencyMs' },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$status', 'error'] }, 1, 0] },
          },
        },
      },
      { $sort: { calls: -1 } },
    ]);

    return {
      totalCalls: summary?.totalCalls || 0,
      avgLatencyMs: Number((summary?.avgLatencyMs || 0).toFixed(1)),
      errorRate: summary?.totalCalls ? Number(((summary.errorCount / summary.totalCalls) * 100).toFixed(2)) : 0,
      serversCount: summary?.servers?.length || 0,
      toolsCount: summary?.tools?.length || 0,
      toolBreakdown: toolBreakdown.map((t) => ({
        serverName: t._id.server,
        toolName: t._id.tool,
        calls: t.calls,
        avgLatencyMs: Number(t.avgLatencyMs.toFixed(1)),
        errors: t.errorCount,
      })),
    };
  }
}

export const analyticsService = new AnalyticsService();
