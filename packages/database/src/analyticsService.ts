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
      organizationId: organizationId === 'org_default' ? 'org_default' : { $in: [organizationId, 'org_default', 'EXT'] },
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

    // 5. Recent Sessions (Query Session collection or aggregate dynamically from UsageEventModel)
    let recentSessions = await Session.find({ organizationId })
      .sort({ startTime: -1 })
      .limit(6)
      .lean();

    if (!recentSessions || recentSessions.length === 0) {
      const sessionAgg = await UsageEventModel.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$sessionId',
            agentName: { $last: '$agent.name' },
            modelName: { $last: '$model.name' },
            totalTokens: { $sum: '$usage.totalTokens' },
            totalCostUsd: { $sum: '$cost.total' },
            startTime: { $min: '$timestamp' },
            lastEventTime: { $max: '$timestamp' },
            eventCount: { $sum: 1 },
          },
        },
        { $sort: { lastEventTime: -1 } },
        { $limit: 6 },
      ]);

      recentSessions = sessionAgg.map((s) => ({
        sessionId: s._id,
        agentName: s.agentName || 'claude-code',
        model: s.modelName,
        totalTokens: s.totalTokens,
        totalCostUsd: Number(s.totalCostUsd.toFixed(4)),
        startTime: s.startTime,
        lastEventTime: s.lastEventTime,
        durationMs: Math.max(1000, new Date(s.lastEventTime).getTime() - new Date(s.startTime).getTime()),
        eventCount: s.eventCount,
      })) as any;
    }

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
    if (options.agent && options.agent !== 'all') query['agent.name'] = options.agent;
    if (options.project) query.projectId = options.project;

    const limit = Math.min(options.limit || 50, 100);
    const offset = options.offset || 0;

    let dbSessions = await Session.find({ organizationId })
      .sort({ startTime: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    if (!dbSessions || dbSessions.length === 0) {
      const sessionAgg = await UsageEventModel.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$sessionId',
            agentName: { $last: '$agent.name' },
            model: { $last: '$model.name' },
            projectId: { $last: '$projectId' },
            sessionGoal: { $first: '$sessionGoal' },
            userPrompt: { $first: '$userPrompt' },
            actionSummary: { $last: '$actionSummary' },
            firstMetadataPrompt: { $first: '$metadata.userPrompt' },
            firstMetadataGoal: { $first: '$metadata.sessionGoal' },
            lastMetadataAction: { $last: '$metadata.actionSummary' },
            totalTokens: { $sum: '$usage.totalTokens' },
            totalCostUsd: { $sum: '$cost.total' },
            startTime: { $min: '$timestamp' },
            lastEventTime: { $max: '$timestamp' },
            eventCount: { $sum: 1 },
          },
        },
        { $sort: { lastEventTime: -1 } },
        { $skip: offset },
        { $limit: limit },
      ]);

      dbSessions = sessionAgg.map((s) => ({
        sessionId: s._id,
        agentName: s.agentName || 'claude-code',
        model: s.model,
        projectId: s.projectId,
        sessionGoal: s.sessionGoal || s.firstMetadataGoal || s.userPrompt || s.firstMetadataPrompt,
        userPrompt: s.userPrompt || s.firstMetadataPrompt,
        actionSummary: s.actionSummary || s.lastMetadataAction,
        totalTokens: s.totalTokens,
        totalCostUsd: Number(s.totalCostUsd.toFixed(4)),
        startTime: s.startTime,
        lastEventTime: s.lastEventTime,
        durationMs: Math.max(1000, new Date(s.lastEventTime).getTime() - new Date(s.startTime).getTime()),
        eventCount: s.eventCount,
      })) as any;
    }

    return {
      total: dbSessions.length,
      limit,
      offset,
      sessions: dbSessions,
    };
  }

  /**
   * GET /v1/sessions/:id
   */
  async getSessionDetail(organizationId: string, sessionId: string) {
    let session = await Session.findOne({ organizationId, sessionId }).lean();

    const events = await UsageEventModel.find({ organizationId, sessionId })
      .sort({ timestamp: 1 })
      .lean();

    if (events.length > 0) {
      const first = events[0];
      const last = events[events.length - 1];
      const totalTokens = events.reduce((acc, e) => acc + (e.usage?.totalTokens || 0), 0);
      const totalCostUsd = events.reduce((acc, e) => acc + (e.cost?.total || 0), 0);
      const resolvedGoal = session?.sessionGoal || session?.initialPrompt || first.sessionGoal || first.userPrompt || (first.metadata as any)?.sessionGoal || (first.metadata as any)?.userPrompt;

      session = {
        ...(session || {}),
        sessionId,
        organizationId,
        agentName: session?.agentName || first.agent?.name || 'claude-code',
        model: session?.metadata?.model || first.model?.name,
        projectId: session?.projectId || first.projectId,
        sessionGoal: resolvedGoal,
        initialPrompt: resolvedGoal,
        lastPrompt: last.userPrompt || (last.metadata as any)?.userPrompt,
        summary: session?.summary || last.actionSummary || (last.metadata as any)?.actionSummary,
        totalTokens: session?.totalTokens || totalTokens,
        totalCostUsd: Number((session?.totalCostUsd || totalCostUsd).toFixed(4)),
        startTime: session?.startTime || first.timestamp,
        lastEventTime: session?.endTime || last.timestamp,
        durationMs: session?.durationMs || Math.max(1000, new Date(last.timestamp).getTime() - new Date(first.timestamp).getTime()),
        eventCount: events.length,
      } as any;
    }

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
