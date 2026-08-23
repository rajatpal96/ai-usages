import { Schema, model, Document, Types } from 'mongoose';

export interface IAgentUsageMetadata {
  userId: Types.ObjectId;
  teamId: Types.ObjectId;
  organizationId: Types.ObjectId;
  agentName: string;      // 'claude_code', 'cursor', 'copilot', 'windsurf', 'custom_mcp'
  captureMethod: string;  // 'proxy', 'log_watcher', 'mcp_sniffer'
  model: string;          // 'claude-3-5-sonnet', 'gpt-4o', 'gemini-1.5-pro', etc.
}

export interface IAgentUsage extends Document {
  timestamp: Date;
  metadata: IAgentUsageMetadata;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestLatencyMs: number;
  extraMetadata?: Record<string, any>;
}

const AgentUsageSchema = new Schema<IAgentUsage>({
  timestamp: { type: Date, default: Date.now, index: true },
  metadata: {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    teamId: { type: Schema.Types.ObjectId, ref: 'Team', required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    agentName: { type: String, required: true, index: true },
    captureMethod: { type: String, required: true },
    model: { type: String, required: true, index: true }
  },
  promptTokens: { type: Number, default: 0 },
  completionTokens: { type: Number, default: 0 },
  totalTokens: { type: Number, default: 0 },
  estimatedCost: { type: Number, default: 0 },
  requestLatencyMs: { type: Number, default: 0 },
  extraMetadata: { type: Schema.Types.Mixed }
});

// Compound indexes for fast metric aggregation
AgentUsageSchema.index({ 'metadata.organizationId': 1, timestamp: -1 });
AgentUsageSchema.index({ 'metadata.teamId': 1, timestamp: -1 });
AgentUsageSchema.index({ 'metadata.userId': 1, timestamp: -1 });
AgentUsageSchema.index({ 'metadata.agentName': 1, timestamp: -1 });

export const AgentUsage = model<IAgentUsage>('AgentUsage', AgentUsageSchema);
