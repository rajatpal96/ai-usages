import dotenv from 'dotenv';
dotenv.config();

import { connectDatabase, UsageEventModel } from '../packages/database/src/index.js';
import { seedDatabase } from '../packages/database/src/seed.js';
import { startApiServer } from '../apps/api/src/index.js';
import { startIngestionServer } from '../apps/ingestion/src/index.js';
import { worker } from '../apps/worker/src/index.js';
import { runMcpStdio } from '../apps/mcp-server/src/index.js';
import { logger } from '../packages/logger/src/index.js';
import { config } from '../packages/config/src/index.js';

async function main() {
  if (process.argv.includes('--mcp') || process.env.RUN_MCP === 'true') {
    await runMcpStdio();
    return;
  }

  console.log('================================================================');
  console.log('      ⚡ AGENTMETER: AI AGENT USAGE & OBSERVABILITY PLATFORM    ');
  console.log('================================================================');

  // 1. Connect to MongoDB (or in-memory fallback)
  await connectDatabase();

  // 2. Auto-seed if database is empty
  const count = await UsageEventModel.countDocuments();
  if (count === 0) {
    logger.info('Empty database detected. Seeding realistic 30-day multi-agent telemetry fleet...');
    await seedDatabase(config.DEFAULT_ORG_ID);
  } else {
    logger.info({ count }, 'Found existing telemetry events in database.');
  }

  // 3. Start Background Worker
  await worker.start();

  // 4. Start Ingestion Service (Port 4001)
  await startIngestionServer(config.INGESTION_PORT);

  // 5. Start Usage & Analytics REST API (Port 4000)
  await startApiServer(config.API_PORT);

  logger.info(`
🚀 AgentMeter Platform Ready:
  📊 Usage & Analytics API : http://localhost:${config.API_PORT}/v1/analytics/overview
  ⚡ Ingestion API        : http://localhost:${config.INGESTION_PORT}/v1/events
  🔄 LLM Gateway Proxy     : http://localhost:${config.INGESTION_PORT}/v1/chat/completions
  🖥️ Dashboard             : http://localhost:${config.DASHBOARD_PORT}
  🔌 MCP Server            : Run 'npm run mcp' for Stdio protocol
  `);
}

main().catch((err) => {
  logger.fatal({ err: err.message }, 'Fatal platform bootstrap failure');
  process.exit(1);
});
