import { v4 as uuidv4 } from 'uuid';
import {
  connectDatabase,
  Organization,
  User,
  Project,
  Agent,
  Session,
  UsageEventModel,
  UsageHourly,
  UsageDaily,
  McpToolCall,
  Pricing,
  AlertRuleModel,
  BudgetModel,
  ApiKey,
} from './index.js';
import { DEFAULT_PRICING_CATALOG, defaultCostEngine } from '../../pricing/src/index.js';
import { generateApiKey } from '../../auth/src/index.js';
import { logger } from '../../logger/src/index.js';

export async function seedDatabase(organizationId: string = 'org_default') {
  await connectDatabase();
  logger.info({ organizationId }, 'Starting database seeding for AgentMeter fleet...');

  // 1. Organization
  await Organization.findOneAndUpdate(
    { orgId: organizationId },
    { orgId: organizationId, name: 'Acme Engineering', plan: 'enterprise' },
    { upsert: true }
  );

  // 2. Users
  const users = [
    { userId: 'usr_alex', name: 'Alex Rivera', email: 'alex.dev@acme.com', role: 'Staff Engineer' },
    { userId: 'usr_sarah', name: 'Sarah Chen', email: 'sarah.lead@acme.com', role: 'Tech Lead' },
    { userId: 'usr_marcus', name: 'Marcus Vance', email: 'marcus.backend@acme.com', role: 'Backend Dev' },
  ];
  for (const u of users) {
    await User.findOneAndUpdate({ userId: u.userId }, { ...u, organizationId }, { upsert: true });
  }

  // 3. Projects
  const projects = [
    { projectId: 'payment-service', name: 'Payment Microservice', repository: 'acme/payment-service', monthlyBudgetUsd: 400 },
    { projectId: 'frontend-web', name: 'Web Next.js Frontend', repository: 'acme/frontend-web', monthlyBudgetUsd: 350 },
    { projectId: 'core-api', name: 'Core Fastify API', repository: 'acme/core-api', monthlyBudgetUsd: 300 },
    { projectId: 'data-pipeline', name: 'AI Data Pipeline', repository: 'acme/data-pipeline', monthlyBudgetUsd: 200 },
  ];
  for (const p of projects) {
    await Project.findOneAndUpdate({ projectId: p.projectId }, { ...p, organizationId }, { upsert: true });
  }

  // 4. Pricing Catalog
  for (const tier of DEFAULT_PRICING_CATALOG) {
    await Pricing.findOneAndUpdate(
      { provider: tier.provider, model: tier.model },
      {
        provider: tier.provider,
        model: tier.model,
        inputPricePerMillion: tier.inputPricePerMillion,
        outputPricePerMillion: tier.outputPricePerMillion,
        cacheReadPricePerMillion: tier.cacheReadPricePerMillion || 0,
        cacheWritePricePerMillion: tier.cacheWritePricePerMillion || 0,
        currency: tier.currency,
        effectiveDate: new Date(tier.effectiveDate),
      },
      { upsert: true }
    );
  }

  // 5. Default API Key
  const existingKey = await ApiKey.findOne({ organizationId });
  if (!existingKey) {
    const keyData = generateApiKey(organizationId, 'Default Development Key');
    await ApiKey.create({
      hashedKey: keyData.hashedKey,
      prefix: keyData.key.slice(0, 16) + '...',
      organizationId,
      name: 'Default Development Key',
    });
    logger.info({ apiKey: keyData.key }, 'Created default organization API key');
  }

  // 6. Monthly Budget
  const currentMonth = new Date().toISOString().slice(0, 7);
  await BudgetModel.findOneAndUpdate(
    { organizationId, month: currentMonth },
    {
      organizationId,
      monthlyLimitUsd: 1250,
      alertThresholdPercent: 80,
      currentSpendUsd: 0,
      month: currentMonth,
    },
    { upsert: true }
  );

  // 7. Alert Rules
  const alertRules = [
    {
      organizationId,
      name: 'Hourly Spend Surge Guard',
      type: 'cost_spike',
      threshold: 40,
      timeWindow: '1h',
      notificationChannels: ['slack', 'webhook'],
      enabled: true,
    },
    {
      organizationId,
      name: 'Expensive Session Alert',
      type: 'expensive_session',
      threshold: 8,
      timeWindow: '24h',
      notificationChannels: ['email', 'slack'],
      enabled: true,
    },
    {
      organizationId,
      name: 'MCP High Latency Guard',
      type: 'mcp_latency',
      threshold: 2500,
      timeWindow: '24h',
      notificationChannels: ['webhook'],
      enabled: true,
    },
  ];
  for (const r of alertRules) {
    await AlertRuleModel.findOneAndUpdate(
      { organizationId, name: r.name },
      r,
      { upsert: true }
    );
  }

  // 8. Generate 30 Days of Multi-Agent Telemetry
  const AGENTS = [
    {
      name: 'claude-code',
      provider: 'anthropic',
      model: 'claude-3-7-sonnet',
      version: '1.2.3',
      type: 'coding_cli',
      weight: 0.35,
    },
    {
      name: 'github-copilot',
      provider: 'github',
      model: 'copilot-chat',
      version: '1.180.0',
      type: 'ide_extension',
      weight: 0.25,
    },
    {
      name: 'gemini-antigravity',
      provider: 'google',
      model: 'gemini-2.5-pro',
      version: '2.0.0',
      type: 'autonomous_pair_programmer',
      weight: 0.20,
    },
    {
      name: 'codex',
      provider: 'openai',
      model: 'gpt-4o',
      version: '1.0.0',
      type: 'coding_agent',
      weight: 0.12,
    },
    {
      name: 'grok',
      provider: 'xai',
      model: 'grok-2',
      version: '2.0',
      type: 'coding_assistant',
      weight: 0.08,
    },
  ];

  const now = new Date();
  const rawEvents: any[] = [];
  const sessionsList: any[] = [];
  let totalOrgCost = 0;

  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const eventDate = new Date(now);
    eventDate.setDate(eventDate.getDate() - dayOffset);

    // Number of sessions for this day
    const sessionCount = Math.floor(Math.random() * 5) + 3;

    for (let s = 0; s < sessionCount; s++) {
      const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
      const proj = projects[Math.floor(Math.random() * projects.length)];
      const usr = users[Math.floor(Math.random() * users.length)];
      const sessionId = `sess_${uuidv4().replace(/-/g, '').slice(0, 10)}`;

      const sessionStartTime = new Date(eventDate);
      sessionStartTime.setHours(9 + Math.floor(Math.random() * 8), Math.floor(Math.random() * 59));

      const eventCountInSession = Math.floor(Math.random() * 6) + 2;
      let sessionTokens = 0;
      let sessionCost = 0;
      let sessionDurationMs = 0;

      for (let e = 0; e < eventCountInSession; e++) {
        const timeStamp = new Date(sessionStartTime.getTime() + e * 45000);
        const promptTokens = Math.floor(Math.random() * 12000) + 1500;
        const completionTokens = Math.floor(Math.random() * 2500) + 350;
        const cacheReadTokens = agent.provider === 'anthropic' || agent.provider === 'google' ? Math.floor(Math.random() * 8000) : 0;
        const cacheWriteTokens = cacheReadTokens > 0 ? Math.floor(cacheReadTokens * 0.2) : 0;
        const reasoningTokens = agent.model.includes('3-7') || agent.model.includes('gemini') ? Math.floor(Math.random() * 500) : 0;
        const totalTokens = promptTokens + completionTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens;

        const cost = defaultCostEngine.calculateCost(agent.provider, agent.model, {
          inputTokens: promptTokens,
          outputTokens: completionTokens,
          cacheReadTokens,
          cacheWriteTokens,
          reasoningTokens,
          totalTokens,
        });

        const latencyMs = Math.floor(Math.random() * 3200) + 350;
        const isError = Math.random() < 0.03;

        rawEvents.push({
          eventId: `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
          timestamp: timeStamp,
          organizationId,
          userId: usr.userId,
          projectId: proj.projectId,
          sessionId,
          agent: {
            id: `agent_${agent.name}`,
            name: agent.name,
            version: agent.version,
            type: agent.type,
          },
          provider: { name: agent.provider },
          model: { name: agent.model },
          usage: {
            inputTokens: promptTokens,
            outputTokens: completionTokens,
            cacheReadTokens,
            cacheWriteTokens,
            reasoningTokens,
            totalTokens,
          },
          cost,
          performance: { latencyMs },
          status: isError ? 'error' : 'success',
          metadata: { branch: 'main', feature: 'refactor' },
        });

        sessionTokens += totalTokens;
        sessionCost += cost.total;
        sessionDurationMs += latencyMs + 15000;
      }

      totalOrgCost += sessionCost;

      sessionsList.push({
        sessionId,
        organizationId,
        projectId: proj.projectId,
        userId: usr.userId,
        agentName: agent.name,
        startTime: sessionStartTime,
        endTime: new Date(sessionStartTime.getTime() + sessionDurationMs),
        durationMs: sessionDurationMs,
        totalTokens: sessionTokens,
        totalCostUsd: Number(sessionCost.toFixed(4)),
        requestCount: eventCountInSession,
        status: 'completed',
      });
    }
  }

  // Insert usage events & sessions
  await UsageEventModel.deleteMany({ organizationId });
  await UsageEventModel.insertMany(rawEvents);

  await Session.deleteMany({ organizationId });
  await Session.insertMany(sessionsList);

  // Update budget current spend
  await BudgetModel.updateOne({ organizationId, month: currentMonth }, { $set: { currentSpendUsd: Number(totalOrgCost.toFixed(4)) } });

  // 9. Generate MCP Tool Calls
  const mcpTools = [
    'usage_today',
    'usage_this_week',
    'usage_this_month',
    'usage_by_agent',
    'usage_by_model',
    'usage_by_project',
    'cost_today',
    'cost_this_month',
    'budget_status',
    'top_expensive_sessions',
  ];

  const mcpCalls: any[] = [];
  for (let i = 0; i < 40; i++) {
    const tool = mcpTools[Math.floor(Math.random() * mcpTools.length)];
    const callTime = new Date(now.getTime() - Math.floor(Math.random() * 7 * 86400000));
    mcpCalls.push({
      callId: `mcp_${uuidv4().replace(/-/g, '').slice(0, 10)}`,
      timestamp: callTime,
      organizationId,
      userId: users[Math.floor(Math.random() * users.length)].userId,
      projectId: projects[Math.floor(Math.random() * projects.length)].projectId,
      serverName: 'agentmeter-mcp-server',
      toolName: tool,
      latencyMs: Math.floor(Math.random() * 200) + 15,
      status: Math.random() < 0.02 ? 'error' : 'success',
    });
  }

  await McpToolCall.deleteMany({ organizationId });
  await McpToolCall.insertMany(mcpCalls);

  logger.info(
    {
      eventsCount: rawEvents.length,
      sessionsCount: sessionsList.length,
      mcpCallsCount: mcpCalls.length,
      totalCost: Number(totalOrgCost.toFixed(2)),
    },
    '✅ Fleet database seeded successfully!'
  );
}

if (process.argv[1] && process.argv[1].includes('seed')) {
  seedDatabase().then(() => process.exit(0));
}
