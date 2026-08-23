import { z } from 'zod';

export const AgentSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  version: z.string().optional(),
  type: z.string().optional(),
});

export const ProviderSchema = z.object({
  name: z.string(),
});

export const ModelSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
});

export const TokenUsageSchema = z.object({
  inputTokens: z.number().int().nonnegative().optional().default(0),
  outputTokens: z.number().int().nonnegative().optional().default(0),
  cacheReadTokens: z.number().int().nonnegative().optional().default(0),
  cacheWriteTokens: z.number().int().nonnegative().optional().default(0),
  reasoningTokens: z.number().int().nonnegative().optional().default(0),
  totalTokens: z.number().int().nonnegative().optional().default(0),
});

export const CostSchema = z.object({
  input: z.number().nonnegative().optional().default(0),
  output: z.number().nonnegative().optional().default(0),
  cache: z.number().nonnegative().optional().default(0),
  total: z.number().nonnegative().optional().default(0),
  currency: z.string().default('USD'),
});

export const PerformanceSchema = z.object({
  latencyMs: z.number().nonnegative().optional(),
  timeToFirstTokenMs: z.number().nonnegative().optional(),
});

export const UsageEventStatusSchema = z.enum(['success', 'error', 'cancelled']);

export const UsageEventSchema = z.object({
  eventId: z.string(),
  timestamp: z.string(), // ISO 8601
  organizationId: z.string(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
  agent: AgentSchema,
  provider: ProviderSchema,
  model: ModelSchema,
  usage: TokenUsageSchema,
  cost: CostSchema.optional(),
  performance: PerformanceSchema.optional(),
  status: UsageEventStatusSchema.default('success'),
  metadata: z.record(z.unknown()).optional(),
});

export type Agent = z.infer<typeof AgentSchema>;
export type Provider = z.infer<typeof ProviderSchema>;
export type Model = z.infer<typeof ModelSchema>;
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
export type Cost = z.infer<typeof CostSchema>;
export type Performance = z.infer<typeof PerformanceSchema>;
export type UsageEventStatus = z.infer<typeof UsageEventStatusSchema>;
export type UsageEvent = z.infer<typeof UsageEventSchema>;

export const BatchEventsPayloadSchema = z.object({
  organizationId: z.string().optional(),
  events: z.array(UsageEventSchema),
});

export type BatchEventsPayload = z.infer<typeof BatchEventsPayloadSchema>;

export const McpToolCallEventSchema = z.object({
  callId: z.string(),
  timestamp: z.string(),
  organizationId: z.string(),
  userId: z.string().optional(),
  projectId: z.string().optional(),
  sessionId: z.string().optional(),
  serverName: z.string(),
  toolName: z.string(),
  parameters: z.record(z.unknown()).optional(),
  latencyMs: z.number().nonnegative(),
  status: z.enum(['success', 'error']).default('success'),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type McpToolCallEvent = z.infer<typeof McpToolCallEventSchema>;

export const AlertRuleTypeSchema = z.enum([
  'cost_spike',
  'budget_threshold',
  'agent_error_rate',
  'mcp_latency',
  'expensive_session',
]);

export const AlertRuleSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string(),
  name: z.string(),
  type: AlertRuleTypeSchema,
  threshold: z.number(),
  timeWindow: z.enum(['1h', '24h', '30d']).default('24h'),
  targetAgent: z.string().optional(),
  targetProject: z.string().optional(),
  notificationChannels: z.array(z.enum(['email', 'slack', 'discord', 'webhook'])).default(['webhook']),
  webhookUrl: z.string().url().optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string().optional(),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type AlertRuleType = z.infer<typeof AlertRuleTypeSchema>;

export const BudgetSchema = z.object({
  id: z.string().optional(),
  organizationId: z.string(),
  projectId: z.string().optional(),
  monthlyLimitUsd: z.number().positive(),
  alertThresholdPercent: z.number().min(1).max(100).default(80),
  currentSpendUsd: z.number().default(0),
  month: z.string(), // YYYY-MM
});

export type Budget = z.infer<typeof BudgetSchema>;

export const PricingTierSchema = z.object({
  id: z.string().optional(),
  provider: z.string(),
  model: z.string(),
  inputPricePerMillion: z.number().nonnegative(),
  outputPricePerMillion: z.number().nonnegative(),
  cacheReadPricePerMillion: z.number().nonnegative().optional().default(0),
  cacheWritePricePerMillion: z.number().nonnegative().optional().default(0),
  currency: z.string().default('USD'),
  effectiveDate: z.string().default(() => new Date().toISOString()),
});

export type PricingTier = z.infer<typeof PricingTierSchema>;
