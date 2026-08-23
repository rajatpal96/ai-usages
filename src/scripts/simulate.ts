import { collector } from '../apps/collector/src/index.js';

const AGENTS = [
  { name: 'claude-code', model: 'claude-3-7-sonnet', type: 'coding_cli' },
  { name: 'github-copilot', model: 'copilot-chat', type: 'ide_extension' },
  { name: 'gemini-antigravity', model: 'gemini-2.5-pro', type: 'autonomous_pair_programmer' },
  { name: 'codex', model: 'gpt-4o', type: 'coding_agent' },
  { name: 'grok', model: 'grok-2', type: 'coding_assistant' },
];

const PROJECTS = ['payment-service', 'frontend-web', 'core-api', 'data-pipeline'];

console.log('================================================================');
console.log('🤖 STARTING LIVE MULTI-AGENT TELEMETRY TRAFFIC SIMULATOR');
console.log('================================================================');

let eventCounter = 0;

setInterval(() => {
  const agent = AGENTS[Math.floor(Math.random() * AGENTS.length)];
  const project = PROJECTS[Math.floor(Math.random() * PROJECTS.length)];

  const promptTokens = Math.floor(Math.random() * 8000) + 1200;
  const completionTokens = Math.floor(Math.random() * 1500) + 300;
  const cacheReadTokens = Math.floor(Math.random() * 5000);
  const latencyMs = Math.floor(Math.random() * 2500) + 400;

  eventCounter++;
  console.log(`[Event #${eventCounter}] Emitting ${agent.name} telemetry (${promptTokens} in / ${completionTokens} out / ${cacheReadTokens} cache) for project ${project}...`);

  collector.enqueue({
    agent: agent.name,
    model: agent.model,
    usage: {
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      cacheReadTokens,
    },
    performance: { latencyMs },
    projectId: project,
    userId: 'dev@acme.com',
    status: Math.random() < 0.04 ? 'error' : 'success',
  });
}, 2000);
