#!/usr/bin/env node

import { runMcpStdio } from '../src/index.js';

runMcpStdio().catch((err) => {
  console.error('TokenTrail MCP Error:', err);
  process.exit(1);
});
