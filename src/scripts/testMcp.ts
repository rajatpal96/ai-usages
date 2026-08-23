import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from '../config/db.js';
import { seedDatabase } from './seed.js';
import { MetricsService } from '../services/metricsService.js';

async function testMetricsAndMCP() {
  console.log('--- Testing AI Agent Metrics Service & MCP Tools ---');
  await connectDB();
  await seedDatabase();

  console.log('\n================ 1. ORGANIZATION METRICS ================');
  const orgMetrics = await MetricsService.getOrganizationMetrics();
  console.log(JSON.stringify(orgMetrics, null, 2));

  console.log('\n================ 2. TEAM METRICS ================');
  const teamMetrics = await MetricsService.getTeamMetrics('Frontend Engineering');
  console.log(JSON.stringify(teamMetrics, null, 2));

  console.log('\n================ 3. MEMBER METRICS ================');
  const memberMetrics = await MetricsService.getMemberMetrics('alex.dev@acme.com');
  console.log(JSON.stringify(memberMetrics, null, 2));

  console.log('\n================ 4. BUDGET ALERTS ================');
  const budgetAlerts = await MetricsService.getBudgetAlerts();
  console.log(JSON.stringify(budgetAlerts, null, 2));

  console.log('\n================ 5. INGEST NEW AGENT USAGE ================');
  const newUsage = await MetricsService.recordUsage({
    username: 'alex.dev@acme.com',
    organizationName: 'Acme Enterprises',
    teamName: 'Frontend Engineering',
    agentName: 'claude_code',
    captureMethod: 'proxy',
    model: 'claude-3-7-sonnet',
    promptTokens: 4500,
    completionTokens: 1200,
    requestLatencyMs: 340,
    extraMetadata: { task: 'Refactoring React components' }
  });
  console.log('Recorded new usage event:', {
    id: newUsage._id,
    tokens: newUsage.totalTokens,
    costUSD: newUsage.estimatedCost
  });

  await disconnectDB();
  console.log('\n✅ Test execution completed successfully!');
}

testMetricsAndMCP().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
