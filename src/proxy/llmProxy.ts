import express from 'express';
import cors from 'cors';
import { MetricsService } from '../services/metricsService.js';

export function createLLMProxyApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 1. Direct Usage Ingestion API Endpoint (For Custom Agents, Log Scrapers, CI/CD)
  app.post('/api/ingest', async (req, res) => {
    try {
      const {
        username,
        organizationName,
        teamName,
        agentName,
        captureMethod,
        model,
        promptTokens,
        completionTokens,
        requestLatencyMs,
        extraMetadata
      } = req.body;

      if (!username || !agentName || !model) {
        return res.status(400).json({ error: 'Missing required fields: username, agentName, model' });
      }

      const record = await MetricsService.recordUsage({
        username,
        organizationName,
        teamName,
        agentName,
        captureMethod: captureMethod || 'proxy',
        model,
        promptTokens: Number(promptTokens || 0),
        completionTokens: Number(completionTokens || 0),
        requestLatencyMs: Number(requestLatencyMs || 0),
        extraMetadata
      });

      res.status(201).json({ success: true, usageId: record._id, estimatedCost: record.estimatedCost });
    } catch (err: any) {
      console.error('[Proxy] Ingest error:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // 2. Mock / Proxy LLM Request Interceptor (OpenAI / Anthropic Compatible)
  app.post(['/v1/chat/completions', '/v1/messages'], async (req, res) => {
    try {
      const username = (req.headers['x-user-id'] || req.headers['x-developer-email'] || process.env.USER || 'developer@company.com') as string;
      const teamName = (req.headers['x-team-name'] || 'Engineering') as string;
      const agentName = (req.headers['x-agent-name'] || 'llm-proxy-agent') as string;

      const model = req.body.model || 'gpt-4o';
      
      // Estimate prompt tokens roughly if not provided
      const promptText = JSON.stringify(req.body.messages || req.body.prompt || '');
      const promptTokens = Math.max(10, Math.ceil(promptText.length / 4));
      const completionTokens = Math.floor(promptTokens * 0.4); // simulated output

      await MetricsService.recordUsage({
        username,
        teamName,
        agentName,
        captureMethod: 'proxy',
        model,
        promptTokens,
        completionTokens,
        requestLatencyMs: 150
      });

      // Simple mock response if acting as local proxy without upstream key
      res.json({
        id: `chatcmpl-${Date.now()}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model,
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Proxy received and recorded AI agent metric successfully!'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens
        }
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'AI Agent Metrics Gateway' });
  });

  return app;
}
