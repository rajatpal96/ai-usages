import { eventBus } from './eventBus.js';
import {
  connectDatabase,
  UsageHourly,
  UsageDaily,
  Session,
  BudgetModel,
  AlertRuleModel,
  AlertHistory,
} from '../../../packages/database/src/index.js';
import { UsageEvent, McpToolCallEvent } from '../../../packages/event-schema/src/index.js';
import { createScopedLogger } from '../../../packages/logger/src/index.js';
import { kafkaClient, KAFKA_TOPICS } from '../../../packages/kafka/src/index.js';

const log = createScopedLogger('worker');

export class BackgroundWorker {
  private isInitialized = false;

  public async start(): Promise<void> {
    if (this.isInitialized) return;
    await connectDatabase();

    // Register EventBus subscriptions
    eventBus.subscribe('usage-events', this.processUsageEvent.bind(this));
    eventBus.subscribe('mcp-events', this.processMcpEvent.bind(this));

    // Register Kafka Consumer subscriptions
    await kafkaClient.subscribeConsumer(
      KAFKA_TOPICS.USAGE_EVENTS,
      'agentmeter-worker-group',
      this.processUsageEvent.bind(this)
    );
    await kafkaClient.subscribeConsumer(
      KAFKA_TOPICS.MCP_EVENTS,
      'agentmeter-worker-group',
      this.processMcpEvent.bind(this)
    );

    this.isInitialized = true;
    log.info('🚀 AgentMeter Background Worker & Kafka Consumers active');
  }

  /**
   * Process incoming raw UsageEvent:
   * 1. Rollup to Hourly and Daily collections
   * 2. Update Session document
   * 3. Evaluate Alerts & Budgets
   */
  private async processUsageEvent(event: UsageEvent): Promise<void> {
    try {
      const eventDate = new Date(event.timestamp);
      
      const hourDate = new Date(eventDate);
      hourDate.setMinutes(0, 0, 0);

      const dateStr = eventDate.toISOString().slice(0, 10);

      const isError = event.status === 'error' ? 1 : 0;
      const latency = event.performance?.latencyMs || 0;

      // Update Hourly Aggregation
      await UsageHourly.findOneAndUpdate(
        {
          organizationId: event.organizationId,
          hour: hourDate,
          projectId: event.projectId || 'global',
          agentName: event.agent.name,
          modelName: event.model.name,
          providerName: event.provider.name,
        },
        {
          $inc: {
            requestCount: 1,
            inputTokens: event.usage.inputTokens || 0,
            outputTokens: (event.usage.outputTokens || 0) + (event.usage.reasoningTokens || 0),
            cacheReadTokens: event.usage.cacheReadTokens || 0,
            cacheWriteTokens: event.usage.cacheWriteTokens || 0,
            totalTokens: event.usage.totalTokens || 0,
            totalCostUsd: event.cost?.total || 0,
            errorCount: isError,
          },
          $set: { avgLatencyMs: latency },
        },
        { upsert: true }
      );

      // Update Daily Aggregation
      await UsageDaily.findOneAndUpdate(
        {
          organizationId: event.organizationId,
          date: dateStr,
          projectId: event.projectId || 'global',
          agentName: event.agent.name,
          modelName: event.model.name,
          providerName: event.provider.name,
        },
        {
          $inc: {
            requestCount: 1,
            inputTokens: event.usage.inputTokens || 0,
            outputTokens: (event.usage.outputTokens || 0) + (event.usage.reasoningTokens || 0),
            cacheReadTokens: event.usage.cacheReadTokens || 0,
            cacheWriteTokens: event.usage.cacheWriteTokens || 0,
            totalTokens: event.usage.totalTokens || 0,
            totalCostUsd: event.cost?.total || 0,
            errorCount: isError,
          },
          $set: { avgLatencyMs: latency },
        },
        { upsert: true }
      );

      // 3. Update Session State
      if (event.sessionId) {
        const session = await Session.findOne({
          sessionId: event.sessionId,
          organizationId: event.organizationId,
        });

        if (!session) {
          await Session.create({
            sessionId: event.sessionId,
            organizationId: event.organizationId,
            projectId: event.projectId || 'default-project',
            userId: event.userId || 'developer',
            agentName: event.agent.name,
            startTime: eventDate,
            endTime: eventDate,
            durationMs: 1000,
            totalTokens: event.usage.totalTokens || 0,
            totalCostUsd: event.cost?.total || 0,
            requestCount: 1,
            status: event.status === 'error' ? 'error' : 'active',
            metadata: event.metadata || {},
          });
        } else {
          session.requestCount += 1;
          session.totalTokens += event.usage.totalTokens || 0;
          session.totalCostUsd = Number((session.totalCostUsd + (event.cost?.total || 0)).toFixed(4));
          session.endTime = eventDate;
          session.durationMs = Math.max(1000, eventDate.getTime() - session.startTime.getTime());
          if (event.status === 'error') session.status = 'error';
          await session.save();
        }
      }

      // 4. Alert & Budget Evaluation
      await this.evaluateAlertsAndBudgets(event);
    } catch (err: any) {
      log.error({ err: err.message, eventId: event.eventId }, 'Worker failed to process usage event');
    }
  }

  /**
   * Process incoming MCP tool call
   */
  private async processMcpEvent(mcpEvent: McpToolCallEvent): Promise<void> {
    try {
      if (mcpEvent.latencyMs > 3000) {
        log.warn(
          { tool: mcpEvent.toolName, latencyMs: mcpEvent.latencyMs },
          'High MCP tool latency detected'
        );
      }
    } catch (err: any) {
      log.error({ err: err.message }, 'Failed to process MCP event in worker');
    }
  }

  /**
   * Evaluate dynamic alert rules and budget caps
   */
  private async evaluateAlertsAndBudgets(event: UsageEvent): Promise<void> {
    try {
      const orgId = event.organizationId;
      const currentMonth = new Date().toISOString().slice(0, 7);

      // 1. Budget Checks
      const budget = await BudgetModel.findOne({ organizationId: orgId, month: currentMonth });
      if (budget) {
        budget.currentSpendUsd = Number((budget.currentSpendUsd + (event.cost?.total || 0)).toFixed(4));
        await budget.save();

        const usagePercent = (budget.currentSpendUsd / budget.monthlyLimitUsd) * 100;
        if (usagePercent >= budget.alertThresholdPercent) {
          log.warn(
            { orgId, currentSpend: budget.currentSpendUsd, limit: budget.monthlyLimitUsd, percent: usagePercent },
            '⚠️ Organization monthly budget threshold reached!'
          );

          await AlertHistory.create({
            organizationId: orgId,
            ruleId: budget._id.toString(),
            ruleName: `Monthly Budget Threshold (${budget.alertThresholdPercent}%)`,
            type: 'budget_threshold',
            triggeredValue: budget.currentSpendUsd,
            threshold: budget.monthlyLimitUsd * (budget.alertThresholdPercent / 100),
            message: `Current spend of $${budget.currentSpendUsd} reached ${usagePercent.toFixed(1)}% of the $${budget.monthlyLimitUsd} monthly limit.`,
            status: 'triggered',
          });
        }
      }

      // 2. Alert Rules Checks
      const rules = await AlertRuleModel.find({ organizationId: orgId, enabled: true });
      for (const rule of rules) {
        if (rule.type === 'expensive_session' && event.cost?.total && event.cost.total > rule.threshold) {
          await this.triggerAlert(rule, event.cost.total, `Single event cost $${event.cost.total} exceeded threshold $${rule.threshold}`);
        }
        if (rule.type === 'mcp_latency' && event.performance?.latencyMs && event.performance.latencyMs > rule.threshold) {
          await this.triggerAlert(rule, event.performance.latencyMs, `Event latency ${event.performance.latencyMs}ms exceeded threshold ${rule.threshold}ms`);
        }
      }
    } catch (err: any) {
      log.error({ err: err.message }, 'Error in evaluateAlertsAndBudgets');
    }
  }

  private async triggerAlert(rule: any, triggeredValue: number, message: string): Promise<void> {
    log.warn({ ruleName: rule.name, triggeredValue, message }, '🚨 Alert triggered!');
    await AlertHistory.create({
      organizationId: rule.organizationId,
      ruleId: rule._id.toString(),
      ruleName: rule.name,
      type: rule.type,
      triggeredValue,
      threshold: rule.threshold,
      message,
      status: 'triggered',
    });
  }
}

export const worker = new BackgroundWorker();

if (process.argv[1] && process.argv[1].includes('apps/worker')) {
  worker.start();
}
