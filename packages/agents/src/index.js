import { v4 as uuidv4 } from 'uuid';
import { defaultCostEngine } from '../../pricing/src/index.js';
/**
 * Adapter for Claude Code CLI sessions and transcript logs
 */
export class ClaudeCodeAdapter {
    name = 'claude-code';
    canHandle(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        return (payload.agent === 'claude-code' ||
            payload.agentName === 'claude_code' ||
            payload.type === 'claude_code_event' ||
            (payload.model && typeof payload.model === 'string' && payload.model.includes('claude') && payload.transcript !== undefined));
    }
    transform(payload, context) {
        const modelName = payload.model?.name || (typeof payload.model === 'string' ? payload.model : 'claude-3-7-sonnet');
        const inputTokens = payload.usage?.inputTokens ?? payload.inputTokens ?? payload.promptTokens ?? 0;
        const outputTokens = payload.usage?.outputTokens ?? payload.outputTokens ?? payload.completionTokens ?? 0;
        const cacheReadTokens = payload.usage?.cacheReadTokens ?? payload.cacheReadTokens ?? payload.cache_read_input_tokens ?? 0;
        const cacheWriteTokens = payload.usage?.cacheWriteTokens ?? payload.cacheWriteTokens ?? payload.cache_creation_input_tokens ?? 0;
        const reasoningTokens = payload.usage?.reasoningTokens ?? payload.reasoningTokens ?? 0;
        const totalTokens = inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens;
        const cost = defaultCostEngine.calculateCost('anthropic', modelName, {
            inputTokens,
            outputTokens,
            cacheReadTokens,
            cacheWriteTokens,
            reasoningTokens,
            totalTokens,
        });
        return {
            eventId: payload.eventId || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            organizationId: context.organizationId,
            userId: context.userId || payload.userId,
            projectId: context.projectId || payload.projectId,
            sessionId: context.sessionId || payload.sessionId || `sess_${uuidv4().slice(0, 8)}`,
            agent: {
                id: payload.agent?.id || 'agent_claude_code',
                name: 'claude-code',
                version: payload.agent?.version || payload.version || '1.2.3',
                type: 'coding_cli',
            },
            provider: {
                name: 'anthropic',
            },
            model: {
                name: modelName,
                version: payload.model?.version,
            },
            usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens,
                reasoningTokens,
                totalTokens,
            },
            cost,
            performance: {
                latencyMs: payload.performance?.latencyMs ?? payload.latencyMs ?? payload.requestLatencyMs,
                timeToFirstTokenMs: payload.performance?.timeToFirstTokenMs ?? payload.timeToFirstTokenMs,
            },
            status: payload.status || 'success',
            metadata: payload.metadata || {},
        };
    }
}
/**
 * Adapter for GitHub Copilot telemetry
 */
export class CopilotAdapter {
    name = 'github-copilot';
    canHandle(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        return (payload.agent === 'github-copilot' ||
            payload.agentName === 'copilot' ||
            payload.source === 'github.copilot' ||
            (typeof payload.editor === 'string' && payload.editor.includes('vscode-copilot')));
    }
    transform(payload, context) {
        const modelName = payload.model?.name || (typeof payload.model === 'string' ? payload.model : 'copilot-chat');
        const inputTokens = payload.usage?.inputTokens ?? payload.promptTokens ?? payload.inputTokens ?? 0;
        const outputTokens = payload.usage?.outputTokens ?? payload.completionTokens ?? payload.outputTokens ?? 0;
        const totalTokens = inputTokens + outputTokens;
        const cost = defaultCostEngine.calculateCost('github', modelName, {
            inputTokens,
            outputTokens,
            totalTokens,
        });
        return {
            eventId: payload.eventId || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            organizationId: context.organizationId,
            userId: context.userId || payload.userId || payload.githubUsername,
            projectId: context.projectId || payload.projectId || payload.repository,
            sessionId: context.sessionId || payload.sessionId || `sess_${uuidv4().slice(0, 8)}`,
            agent: {
                id: payload.agent?.id || 'agent_copilot',
                name: 'github-copilot',
                version: payload.agent?.version || payload.extensionVersion || '1.180.0',
                type: 'ide_extension',
            },
            provider: {
                name: 'github',
            },
            model: {
                name: modelName,
            },
            usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                reasoningTokens: 0,
                totalTokens,
            },
            cost,
            performance: {
                latencyMs: payload.performance?.latencyMs ?? payload.latencyMs ?? payload.requestLatencyMs,
            },
            status: payload.status || 'success',
            metadata: payload.metadata || { completionType: payload.completionType || 'inline' },
        };
    }
}
/**
 * Adapter for Gemini & Google Antigravity Agent
 */
export class GeminiAntigravityAdapter {
    name = 'gemini-antigravity';
    canHandle(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        return (payload.agent === 'gemini' ||
            payload.agent === 'antigravity' ||
            payload.agentName === 'antigravity' ||
            payload.agentName === 'gemini' ||
            (typeof payload.model === 'string' && payload.model.includes('gemini')));
    }
    transform(payload, context) {
        const modelName = payload.model?.name || (typeof payload.model === 'string' ? payload.model : 'gemini-2.5-pro');
        const inputTokens = payload.usage?.inputTokens ?? payload.promptTokenCount ?? payload.inputTokens ?? 0;
        const outputTokens = payload.usage?.outputTokens ?? payload.candidatesTokenCount ?? payload.outputTokens ?? 0;
        const cacheReadTokens = payload.usage?.cacheReadTokens ?? payload.cachedContentTokenCount ?? 0;
        const reasoningTokens = payload.usage?.reasoningTokens ?? payload.thoughtsTokenCount ?? 0;
        const totalTokens = inputTokens + outputTokens + cacheReadTokens + reasoningTokens;
        const cost = defaultCostEngine.calculateCost('google', modelName, {
            inputTokens,
            outputTokens,
            cacheReadTokens,
            reasoningTokens,
            totalTokens,
        });
        return {
            eventId: payload.eventId || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            organizationId: context.organizationId,
            userId: context.userId || payload.userId,
            projectId: context.projectId || payload.projectId,
            sessionId: context.sessionId || payload.sessionId || `sess_${uuidv4().slice(0, 8)}`,
            agent: {
                id: payload.agent?.id || 'agent_antigravity',
                name: 'gemini-antigravity',
                version: payload.agent?.version || payload.version || '2.0.0',
                type: 'autonomous_pair_programmer',
            },
            provider: {
                name: 'google',
            },
            model: {
                name: modelName,
            },
            usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens: 0,
                reasoningTokens,
                totalTokens,
            },
            cost,
            performance: {
                latencyMs: payload.performance?.latencyMs ?? payload.latencyMs,
            },
            status: payload.status || 'success',
            metadata: payload.metadata || {},
        };
    }
}
/**
 * Adapter for Codex & OpenAI Agents
 */
export class CodexAdapter {
    name = 'codex';
    canHandle(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        return (payload.agent === 'codex' ||
            payload.agentName === 'codex' ||
            (typeof payload.model === 'string' && (payload.model.includes('codex') || payload.model.includes('gpt-4o') || payload.model.includes('o1') || payload.model.includes('o3'))));
    }
    transform(payload, context) {
        const modelName = payload.model?.name || (typeof payload.model === 'string' ? payload.model : 'gpt-4o');
        const inputTokens = payload.usage?.inputTokens ?? payload.usage?.prompt_tokens ?? payload.promptTokens ?? 0;
        const outputTokens = payload.usage?.outputTokens ?? payload.usage?.completion_tokens ?? payload.completionTokens ?? 0;
        const cacheReadTokens = payload.usage?.cacheReadTokens ?? payload.usage?.prompt_tokens_details?.cached_tokens ?? 0;
        const reasoningTokens = payload.usage?.reasoningTokens ?? payload.usage?.completion_tokens_details?.reasoning_tokens ?? 0;
        const totalTokens = inputTokens + outputTokens + cacheReadTokens + reasoningTokens;
        const cost = defaultCostEngine.calculateCost('openai', modelName, {
            inputTokens,
            outputTokens,
            cacheReadTokens,
            reasoningTokens,
            totalTokens,
        });
        return {
            eventId: payload.eventId || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            organizationId: context.organizationId,
            userId: context.userId || payload.userId,
            projectId: context.projectId || payload.projectId,
            sessionId: context.sessionId || payload.sessionId || `sess_${uuidv4().slice(0, 8)}`,
            agent: {
                id: payload.agent?.id || 'agent_codex',
                name: 'codex',
                version: payload.agent?.version || '1.0.0',
                type: 'coding_agent',
            },
            provider: {
                name: 'openai',
            },
            model: {
                name: modelName,
            },
            usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens: 0,
                reasoningTokens,
                totalTokens,
            },
            cost,
            performance: {
                latencyMs: payload.performance?.latencyMs ?? payload.latencyMs,
            },
            status: payload.status || 'success',
            metadata: payload.metadata || {},
        };
    }
}
/**
 * Adapter for xAI Grok
 */
export class GrokAdapter {
    name = 'grok';
    canHandle(payload) {
        if (!payload || typeof payload !== 'object')
            return false;
        return (payload.agent === 'grok' ||
            payload.agentName === 'grok' ||
            (typeof payload.model === 'string' && payload.model.includes('grok')));
    }
    transform(payload, context) {
        const modelName = payload.model?.name || (typeof payload.model === 'string' ? payload.model : 'grok-2');
        const inputTokens = payload.usage?.inputTokens ?? payload.promptTokens ?? 0;
        const outputTokens = payload.usage?.outputTokens ?? payload.completionTokens ?? 0;
        const totalTokens = inputTokens + outputTokens;
        const cost = defaultCostEngine.calculateCost('xai', modelName, {
            inputTokens,
            outputTokens,
            totalTokens,
        });
        return {
            eventId: payload.eventId || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            organizationId: context.organizationId,
            userId: context.userId || payload.userId,
            projectId: context.projectId || payload.projectId,
            sessionId: context.sessionId || payload.sessionId || `sess_${uuidv4().slice(0, 8)}`,
            agent: {
                id: payload.agent?.id || 'agent_grok',
                name: 'grok',
                version: payload.agent?.version || '2.0',
                type: 'coding_assistant',
            },
            provider: {
                name: 'xai',
            },
            model: {
                name: modelName,
            },
            usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens: 0,
                cacheWriteTokens: 0,
                reasoningTokens: 0,
                totalTokens,
            },
            cost,
            performance: {
                latencyMs: payload.performance?.latencyMs ?? payload.latencyMs,
            },
            status: payload.status || 'success',
            metadata: payload.metadata || {},
        };
    }
}
/**
 * Generic Proxy / Standard Adapter
 */
export class GenericProxyAdapter {
    name = 'generic-proxy';
    canHandle(_payload) {
        return true; // Fallback
    }
    transform(payload, context) {
        const agentName = payload.agent?.name || payload.agentName || 'custom-agent';
        const providerName = payload.provider?.name || payload.provider || 'custom-provider';
        const modelName = payload.model?.name || (typeof payload.model === 'string' ? payload.model : 'custom-model');
        const inputTokens = payload.usage?.inputTokens ?? payload.promptTokens ?? 0;
        const outputTokens = payload.usage?.outputTokens ?? payload.completionTokens ?? 0;
        const cacheReadTokens = payload.usage?.cacheReadTokens ?? payload.cacheReadTokens ?? 0;
        const cacheWriteTokens = payload.usage?.cacheWriteTokens ?? payload.cacheWriteTokens ?? 0;
        const reasoningTokens = payload.usage?.reasoningTokens ?? 0;
        const totalTokens = payload.usage?.totalTokens ?? (inputTokens + outputTokens + cacheReadTokens + cacheWriteTokens + reasoningTokens);
        const cost = payload.cost?.total !== undefined
            ? payload.cost
            : defaultCostEngine.calculateCost(providerName, modelName, {
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens,
                reasoningTokens,
                totalTokens,
            });
        return {
            eventId: payload.eventId || `evt_${uuidv4().replace(/-/g, '').slice(0, 12)}`,
            timestamp: payload.timestamp || new Date().toISOString(),
            organizationId: context.organizationId,
            userId: context.userId || payload.userId,
            projectId: context.projectId || payload.projectId,
            sessionId: context.sessionId || payload.sessionId || `sess_${uuidv4().slice(0, 8)}`,
            agent: {
                id: payload.agent?.id || `agent_${agentName.replace(/[^a-zA-Z0-9_]/g, '_')}`,
                name: agentName,
                version: payload.agent?.version || '1.0.0',
                type: payload.agent?.type || 'generic',
            },
            provider: {
                name: providerName,
            },
            model: {
                name: modelName,
                version: payload.model?.version,
            },
            usage: {
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens,
                reasoningTokens,
                totalTokens,
            },
            cost,
            performance: {
                latencyMs: payload.performance?.latencyMs ?? payload.latencyMs ?? payload.requestLatencyMs,
                timeToFirstTokenMs: payload.performance?.timeToFirstTokenMs,
            },
            status: payload.status || 'success',
            metadata: payload.metadata || {},
        };
    }
}
export class AdapterRegistry {
    adapters = [
        new ClaudeCodeAdapter(),
        new CopilotAdapter(),
        new GeminiAntigravityAdapter(),
        new CodexAdapter(),
        new GrokAdapter(),
        new GenericProxyAdapter(), // Fallback
    ];
    register(adapter) {
        this.adapters.unshift(adapter); // High priority
    }
    resolve(payload) {
        for (const adapter of this.adapters) {
            if (adapter.canHandle(payload)) {
                return adapter;
            }
        }
        return this.adapters[this.adapters.length - 1]; // Generic fallback
    }
    normalize(payload, context) {
        const adapter = this.resolve(payload);
        return adapter.transform(payload, context);
    }
}
export const adapterRegistry = new AdapterRegistry();
