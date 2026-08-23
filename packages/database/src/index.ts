import mongoose, { Schema, Document, Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../../logger/src/index.js';
import { config } from '../../config/src/index.js';

let mongoMemoryServer: MongoMemoryServer | null = null;

export async function connectDatabase(customUri?: string): Promise<typeof mongoose> {
  const uri = customUri || process.env.MONGODB_URI || config.MONGODB_URI;

  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  try {
    logger.info({ uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }, 'Connecting to MongoDB...');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
    logger.info('Connected to MongoDB successfully');
    return mongoose;
  } catch (err: any) {
    if (config.ENABLE_MEMORY_DB_FALLBACK) {
      logger.warn({ error: err.message }, 'Failed to connect to primary MongoDB. Spawning MongoMemoryServer fallback...');
      if (!mongoMemoryServer) {
        mongoMemoryServer = await MongoMemoryServer.create();
      }
      const memUri = mongoMemoryServer.getUri();
      await mongoose.connect(memUri);
      logger.info({ memUri }, 'Connected to in-memory MongoDB fallback');
      return mongoose;
    }
    throw err;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoMemoryServer) {
    await mongoMemoryServer.stop();
    mongoMemoryServer = null;
  }
}

// -------------------------------------------------------------
// 1. Organization Schema
// -------------------------------------------------------------
export interface IOrganization extends Document {
  orgId: string;
  name: string;
  plan: string;
  createdAt: Date;
  updatedAt: Date;
}

export const OrganizationSchema = new Schema<IOrganization>({
  orgId: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  plan: { type: String, default: 'enterprise' },
}, { timestamps: true });

// -------------------------------------------------------------
// 2. User Schema
// -------------------------------------------------------------
export interface IUser extends Document {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

export const UserSchema = new Schema<IUser>({
  userId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, default: 'developer' },
}, { timestamps: true });

UserSchema.index({ organizationId: 1, email: 1 });

// -------------------------------------------------------------
// 3. Project Schema
// -------------------------------------------------------------
export interface IProject extends Document {
  projectId: string;
  organizationId: string;
  name: string;
  repository?: string;
  monthlyBudgetUsd?: number;
  createdAt: Date;
}

export const ProjectSchema = new Schema<IProject>({
  projectId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  repository: { type: String },
  monthlyBudgetUsd: { type: Number, default: 500 },
}, { timestamps: true });

ProjectSchema.index({ organizationId: 1, name: 1 });

// -------------------------------------------------------------
// 4. Agent Schema
// -------------------------------------------------------------
export interface IAgent extends Document {
  agentId: string;
  organizationId: string;
  name: string;
  type: string;
  defaultModel?: string;
  version?: string;
  createdAt: Date;
}

export const AgentSchema = new Schema<IAgent>({
  agentId: { type: String, required: true, index: true },
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, default: 'coding_agent' },
  defaultModel: { type: String },
  version: { type: String },
}, { timestamps: true });

AgentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

// -------------------------------------------------------------
// 5. Session Schema
// -------------------------------------------------------------
export interface ISession extends Document {
  sessionId: string;
  organizationId: string;
  projectId?: string;
  userId?: string;
  agentName: string;
  startTime: Date;
  endTime?: Date;
  durationMs: number;
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
  status: 'active' | 'completed' | 'error';
  metadata?: Record<string, any>;
}

export const SessionSchema = new Schema<ISession>({
  sessionId: { type: String, required: true, unique: true, index: true },
  organizationId: { type: String, required: true, index: true },
  projectId: { type: String, index: true },
  userId: { type: String, index: true },
  agentName: { type: String, required: true, index: true },
  startTime: { type: Date, required: true, index: true },
  endTime: { type: Date },
  durationMs: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  totalCostUsd: { type: Number, default: 0 },
  requestCount: { type: Number, default: 0 },
  status: { type: String, enum: ['active', 'completed', 'error'], default: 'active' },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

SessionSchema.index({ organizationId: 1, startTime: -1 });
SessionSchema.index({ organizationId: 1, totalCostUsd: -1 });

// -------------------------------------------------------------
// 6. Raw Usage Events Schema (Universal UsageEvent)
// -------------------------------------------------------------
export interface IUsageEvent extends Document {
  eventId: string;
  timestamp: Date;
  organizationId: string;
  userId?: string;
  projectId?: string;
  sessionId?: string;
  agent: {
    id?: string;
    name: string;
    version?: string;
    type?: string;
  };
  provider: {
    name: string;
  };
  model: {
    name: string;
    version?: string;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheWriteTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  };
  cost: {
    input: number;
    output: number;
    cache: number;
    total: number;
    currency: string;
  };
  performance?: {
    latencyMs?: number;
    timeToFirstTokenMs?: number;
  };
  status: 'success' | 'error' | 'cancelled';
  metadata?: Record<string, any>;
}

export const UsageEventSchema = new Schema<IUsageEvent>({
  eventId: { type: String, required: true },
  timestamp: { type: Date, required: true },
  organizationId: { type: String, required: true },
  userId: { type: String },
  projectId: { type: String },
  sessionId: { type: String },
  agent: {
    id: { type: String },
    name: { type: String, required: true },
    version: { type: String },
    type: { type: String },
  },
  provider: {
    name: { type: String, required: true },
  },
  model: {
    name: { type: String, required: true },
    version: { type: String },
  },
  usage: {
    inputTokens: { type: Number, default: 0 },
    outputTokens: { type: Number, default: 0 },
    cacheReadTokens: { type: Number, default: 0 },
    cacheWriteTokens: { type: Number, default: 0 },
    reasoningTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
  },
  cost: {
    input: { type: Number, default: 0 },
    output: { type: Number, default: 0 },
    cache: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    currency: { type: String, default: 'USD' },
  },
  performance: {
    latencyMs: { type: Number },
    timeToFirstTokenMs: { type: Number },
  },
  status: { type: String, enum: ['success', 'error', 'cancelled'], default: 'success' },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

// Strict 6 compound indexes required by TDD Section 11:
UsageEventSchema.index({ organizationId: 1, timestamp: -1 });
UsageEventSchema.index({ organizationId: 1, projectId: 1, timestamp: -1 });
UsageEventSchema.index({ organizationId: 1, userId: 1, timestamp: -1 });
UsageEventSchema.index({ organizationId: 1, 'agent.name': 1, timestamp: -1 });
UsageEventSchema.index({ organizationId: 1, 'provider.name': 1, timestamp: -1 });
UsageEventSchema.index({ sessionId: 1 });
UsageEventSchema.index({ eventId: 1 }, { unique: true });

// -------------------------------------------------------------
// 7. Usage Hourly Pre-Aggregations
// -------------------------------------------------------------
export interface IUsageHourly extends Document {
  organizationId: string;
  hour: Date; // rounded to start of hour
  projectId?: string;
  agentName: string;
  modelName: string;
  providerName: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  errorCount: number;
}

export const UsageHourlySchema = new Schema<IUsageHourly>({
  organizationId: { type: String, required: true },
  hour: { type: Date, required: true },
  projectId: { type: String, default: 'global' },
  agentName: { type: String, required: true },
  modelName: { type: String, required: true },
  providerName: { type: String, required: true },
  requestCount: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  cacheReadTokens: { type: Number, default: 0 },
  cacheWriteTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  totalCostUsd: { type: Number, default: 0 },
  avgLatencyMs: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
}, { timestamps: true });

UsageHourlySchema.index({ organizationId: 1, hour: -1, agentName: 1, modelName: 1 });
UsageHourlySchema.index({ organizationId: 1, hour: -1, projectId: 1 });

// -------------------------------------------------------------
// 8. Usage Daily Pre-Aggregations
// -------------------------------------------------------------
export interface IUsageDaily extends Document {
  organizationId: string;
  date: string; // YYYY-MM-DD
  projectId?: string;
  agentName: string;
  modelName: string;
  providerName: string;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  totalTokens: number;
  totalCostUsd: number;
  avgLatencyMs: number;
  errorCount: number;
}

export const UsageDailySchema = new Schema<IUsageDaily>({
  organizationId: { type: String, required: true },
  date: { type: String, required: true },
  projectId: { type: String, default: 'global' },
  agentName: { type: String, required: true },
  modelName: { type: String, required: true },
  providerName: { type: String, required: true },
  requestCount: { type: Number, default: 0 },
  inputTokens: { type: Number, default: 0 },
  outputTokens: { type: Number, default: 0 },
  cacheReadTokens: { type: Number, default: 0 },
  cacheWriteTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  totalCostUsd: { type: Number, default: 0 },
  avgLatencyMs: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
}, { timestamps: true });

UsageDailySchema.index({ organizationId: 1, date: -1, agentName: 1 });
UsageDailySchema.index({ organizationId: 1, date: -1, projectId: 1 });

// -------------------------------------------------------------
// 9. MCP Tool Calls
// -------------------------------------------------------------
export interface IMcpToolCall extends Document {
  callId: string;
  timestamp: Date;
  organizationId: string;
  userId?: string;
  projectId?: string;
  sessionId?: string;
  serverName: string;
  toolName: string;
  parameters?: Record<string, any>;
  latencyMs: number;
  status: 'success' | 'error';
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export const McpToolCallSchema = new Schema<IMcpToolCall>({
  callId: { type: String, required: true, unique: true, index: true },
  timestamp: { type: Date, required: true, index: true },
  organizationId: { type: String, required: true, index: true },
  userId: { type: String, index: true },
  projectId: { type: String, index: true },
  sessionId: { type: String, index: true },
  serverName: { type: String, required: true, index: true },
  toolName: { type: String, required: true, index: true },
  parameters: { type: Schema.Types.Mixed },
  latencyMs: { type: Number, required: true },
  status: { type: String, enum: ['success', 'error'], default: 'success' },
  errorMessage: { type: String },
  metadata: { type: Schema.Types.Mixed },
}, { timestamps: true });

McpToolCallSchema.index({ organizationId: 1, serverName: 1, toolName: 1, timestamp: -1 });

// -------------------------------------------------------------
// 10. Pricing Schema
// -------------------------------------------------------------
export interface IPricing extends Document {
  provider: string;
  model: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cacheReadPricePerMillion: number;
  cacheWritePricePerMillion: number;
  currency: string;
  effectiveDate: Date;
}

export const PricingSchema = new Schema<IPricing>({
  provider: { type: String, required: true },
  model: { type: String, required: true },
  inputPricePerMillion: { type: Number, required: true },
  outputPricePerMillion: { type: Number, required: true },
  cacheReadPricePerMillion: { type: Number, default: 0 },
  cacheWritePricePerMillion: { type: Number, default: 0 },
  currency: { type: String, default: 'USD' },
  effectiveDate: { type: Date, default: Date.now },
}, { timestamps: true });

PricingSchema.index({ provider: 1, model: 1, effectiveDate: -1 });

// -------------------------------------------------------------
// 11. Alerts & Budgets Schema
// -------------------------------------------------------------
export interface IAlertRule extends Document {
  organizationId: string;
  name: string;
  type: 'cost_spike' | 'budget_threshold' | 'agent_error_rate' | 'mcp_latency' | 'expensive_session';
  threshold: number;
  timeWindow: '1h' | '24h' | '30d';
  targetAgent?: string;
  targetProject?: string;
  notificationChannels: string[];
  webhookUrl?: string;
  enabled: boolean;
}

export const AlertRuleSchema = new Schema<IAlertRule>({
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  threshold: { type: Number, required: true },
  timeWindow: { type: String, default: '24h' },
  targetAgent: { type: String },
  targetProject: { type: String },
  notificationChannels: [{ type: String }],
  webhookUrl: { type: String },
  enabled: { type: Boolean, default: true },
}, { timestamps: true });

export interface IAlertHistory extends Document {
  organizationId: string;
  ruleId: string;
  ruleName: string;
  type: string;
  triggeredValue: number;
  threshold: number;
  message: string;
  timestamp: Date;
  status: 'triggered' | 'acknowledged' | 'resolved';
}

export const AlertHistorySchema = new Schema<IAlertHistory>({
  organizationId: { type: String, required: true, index: true },
  ruleId: { type: String, required: true, index: true },
  ruleName: { type: String, required: true },
  type: { type: String, required: true },
  triggeredValue: { type: Number, required: true },
  threshold: { type: Number, required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true },
  status: { type: String, enum: ['triggered', 'acknowledged', 'resolved'], default: 'triggered' },
}, { timestamps: true });

export interface IBudget extends Document {
  organizationId: string;
  projectId?: string;
  monthlyLimitUsd: number;
  alertThresholdPercent: number;
  currentSpendUsd: number;
  month: string; // YYYY-MM
}

export const BudgetSchema = new Schema<IBudget>({
  organizationId: { type: String, required: true, index: true },
  projectId: { type: String, index: true },
  monthlyLimitUsd: { type: Number, required: true },
  alertThresholdPercent: { type: Number, default: 80 },
  currentSpendUsd: { type: Number, default: 0 },
  month: { type: String, required: true },
}, { timestamps: true });

BudgetSchema.index({ organizationId: 1, month: 1, projectId: 1 }, { unique: true });

// -------------------------------------------------------------
// 12. API Keys Schema
// -------------------------------------------------------------
export interface IApiKey extends Document {
  hashedKey: string;
  prefix: string; // e.g. am_live_ab12...
  organizationId: string;
  name: string;
  lastUsedAt?: Date;
  expiresAt?: Date;
  revoked: boolean;
}

export const ApiKeySchema = new Schema<IApiKey>({
  hashedKey: { type: String, required: true, unique: true, index: true },
  prefix: { type: String, required: true },
  organizationId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  lastUsedAt: { type: Date },
  expiresAt: { type: Date },
  revoked: { type: Boolean, default: false },
}, { timestamps: true });

// -------------------------------------------------------------
// Model Exports
// -------------------------------------------------------------
export const Organization: Model<IOrganization> = mongoose.models.Organization || mongoose.model<IOrganization>('Organization', OrganizationSchema);
export const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
export const Project: Model<IProject> = mongoose.models.Project || mongoose.model<IProject>('Project', ProjectSchema);
export const Agent: Model<IAgent> = mongoose.models.Agent || mongoose.model<IAgent>('Agent', AgentSchema);
export const Session: Model<ISession> = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);
export const UsageEventModel: Model<IUsageEvent> = mongoose.models.UsageEvent || mongoose.model<IUsageEvent>('UsageEvent', UsageEventSchema);
export const UsageHourly: Model<IUsageHourly> = mongoose.models.UsageHourly || mongoose.model<IUsageHourly>('UsageHourly', UsageHourlySchema);
export const UsageDaily: Model<IUsageDaily> = mongoose.models.UsageDaily || mongoose.model<IUsageDaily>('UsageDaily', UsageDailySchema);
export const McpToolCall: Model<IMcpToolCall> = mongoose.models.McpToolCall || mongoose.model<IMcpToolCall>('McpToolCall', McpToolCallSchema);
export const Pricing: Model<IPricing> = mongoose.models.Pricing || mongoose.model<IPricing>('Pricing', PricingSchema);
export const AlertRuleModel: Model<IAlertRule> = mongoose.models.AlertRule || mongoose.model<IAlertRule>('AlertRule', AlertRuleSchema);
export const AlertHistory: Model<IAlertHistory> = mongoose.models.AlertHistory || mongoose.model<IAlertHistory>('AlertHistory', AlertHistorySchema);
export const BudgetModel: Model<IBudget> = mongoose.models.Budget || mongoose.model<IBudget>('Budget', BudgetSchema);
export const ApiKey: Model<IApiKey> = mongoose.models.ApiKey || mongoose.model<IApiKey>('ApiKey', ApiKeySchema);

export * from './analyticsService.js';
