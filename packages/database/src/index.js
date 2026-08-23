import mongoose, { Schema } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { logger } from '../../logger/src/index.js';
import { config } from '../../config/src/index.js';
let mongoMemoryServer = null;
export async function connectDatabase(customUri) {
    const uri = customUri || process.env.MONGODB_URI || config.MONGODB_URI;
    if (mongoose.connection.readyState === 1) {
        return mongoose;
    }
    try {
        logger.info({ uri: uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') }, 'Connecting to MongoDB...');
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
        logger.info('Connected to MongoDB successfully');
        return mongoose;
    }
    catch (err) {
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
export async function disconnectDatabase() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
    if (mongoMemoryServer) {
        await mongoMemoryServer.stop();
        mongoMemoryServer = null;
    }
}
export const OrganizationSchema = new Schema({
    orgId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    plan: { type: String, default: 'enterprise' },
}, { timestamps: true });
export const UserSchema = new Schema({
    userId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, default: 'developer' },
}, { timestamps: true });
UserSchema.index({ organizationId: 1, email: 1 });
export const ProjectSchema = new Schema({
    projectId: { type: String, required: true, unique: true, index: true },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    repository: { type: String },
    monthlyBudgetUsd: { type: Number, default: 500 },
}, { timestamps: true });
ProjectSchema.index({ organizationId: 1, name: 1 });
export const AgentSchema = new Schema({
    agentId: { type: String, required: true, index: true },
    organizationId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    type: { type: String, default: 'coding_agent' },
    defaultModel: { type: String },
    version: { type: String },
}, { timestamps: true });
AgentSchema.index({ organizationId: 1, name: 1 }, { unique: true });
export const SessionSchema = new Schema({
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
export const UsageEventSchema = new Schema({
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
export const UsageHourlySchema = new Schema({
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
export const UsageDailySchema = new Schema({
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
export const McpToolCallSchema = new Schema({
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
export const PricingSchema = new Schema({
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
export const AlertRuleSchema = new Schema({
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
export const AlertHistorySchema = new Schema({
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
export const BudgetSchema = new Schema({
    organizationId: { type: String, required: true, index: true },
    projectId: { type: String, index: true },
    monthlyLimitUsd: { type: Number, required: true },
    alertThresholdPercent: { type: Number, default: 80 },
    currentSpendUsd: { type: Number, default: 0 },
    month: { type: String, required: true },
}, { timestamps: true });
BudgetSchema.index({ organizationId: 1, month: 1, projectId: 1 }, { unique: true });
export const ApiKeySchema = new Schema({
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
export const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);
export const User = mongoose.models.User || mongoose.model('User', UserSchema);
export const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);
export const Agent = mongoose.models.Agent || mongoose.model('Agent', AgentSchema);
export const Session = mongoose.models.Session || mongoose.model('Session', SessionSchema);
export const UsageEventModel = mongoose.models.UsageEvent || mongoose.model('UsageEvent', UsageEventSchema);
export const UsageHourly = mongoose.models.UsageHourly || mongoose.model('UsageHourly', UsageHourlySchema);
export const UsageDaily = mongoose.models.UsageDaily || mongoose.model('UsageDaily', UsageDailySchema);
export const McpToolCall = mongoose.models.McpToolCall || mongoose.model('McpToolCall', McpToolCallSchema);
export const Pricing = mongoose.models.Pricing || mongoose.model('Pricing', PricingSchema);
export const AlertRuleModel = mongoose.models.AlertRule || mongoose.model('AlertRule', AlertRuleSchema);
export const AlertHistory = mongoose.models.AlertHistory || mongoose.model('AlertHistory', AlertHistorySchema);
export const BudgetModel = mongoose.models.Budget || mongoose.model('Budget', BudgetSchema);
export const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);
export * from './analyticsService.js';
