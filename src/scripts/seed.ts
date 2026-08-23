import { connectDB, disconnectDB } from '../config/db.js';
import { Organization } from '../models/Organization.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { AgentUsage } from '../models/AgentUsage.js';
import { calculateEstimatedCost } from '../services/costCalculator.js';

export async function seedDatabase() {
  console.log('[Seed] Seeding sample organization, teams, members, and agent usage metrics...');

  // Clear existing data
  await Organization.deleteMany({});
  await Team.deleteMany({});
  await User.deleteMany({});
  await AgentUsage.deleteMany({});

  // 1. Create Organization
  const org = await Organization.create({
    name: 'Acme Enterprises',
    monthlyBudget: 2500
  });

  // 2. Create Teams
  const teamFrontend = await Team.create({
    organizationId: org._id,
    name: 'Frontend Engineering',
    department: 'Engineering',
    monthlyBudget: 600
  });

  const teamBackend = await Team.create({
    organizationId: org._id,
    name: 'Backend Services',
    department: 'Engineering',
    monthlyBudget: 800
  });

  const teamMobile = await Team.create({
    organizationId: org._id,
    name: 'AI & Mobile',
    department: 'Product',
    monthlyBudget: 500
  });

  const teamDevOps = await Team.create({
    organizationId: org._id,
    name: 'DevOps & Cloud',
    department: 'Infrastructure',
    monthlyBudget: 400
  });

  // 3. Create Users (Team Members)
  const usersData = [
    { username: 'alex.dev@acme.com', name: 'Alex Johnson', teamId: teamFrontend._id, role: 'Senior Frontend Engineer' },
    { username: 'sarah.frontend@acme.com', name: 'Sarah Lee', teamId: teamFrontend._id, role: 'UI/UX Developer' },
    { username: 'michael.backend@acme.com', name: 'Michael Chen', teamId: teamBackend._id, role: 'Backend Lead' },
    { username: 'priya.data@acme.com', name: 'Priya Sharma', teamId: teamBackend._id, role: 'Data Engineer' },
    { username: 'david.mobile@acme.com', name: 'David Smith', teamId: teamMobile._id, role: 'Mobile Developer' },
    { username: 'elena.devops@acme.com', name: 'Elena Rostova', teamId: teamDevOps._id, role: 'DevOps Specialist' }
  ];

  const createdUsers: any[] = [];
  for (const u of usersData) {
    const userObj = await User.create({
      organizationId: org._id,
      teamId: u.teamId,
      username: u.username,
      name: u.name,
      role: u.role
    });
    createdUsers.push(userObj);
  }

  // 4. Generate Realistic Agent Usages
  const agents = [
    { name: 'claude_code', defaultModel: 'claude-3-5-sonnet', method: 'log_watcher' },
    { name: 'cursor', defaultModel: 'claude-3-5-sonnet', method: 'log_watcher' },
    { name: 'copilot', defaultModel: 'gpt-4o', method: 'proxy' },
    { name: 'windsurf', defaultModel: 'claude-3-7-sonnet', method: 'proxy' },
    { name: 'custom_mcp', defaultModel: 'gemini-1.5-pro', method: 'mcp_sniffer' }
  ];

  const now = Date.now();
  const DAY_MS = 24 * 60 * 60 * 1000;

  const usageEntries = [];

  // Generate 120 sample requests over the past 7 days
  for (let i = 0; i < 120; i++) {
    const user = createdUsers[i % createdUsers.length];
    const agent = agents[i % agents.length];

    const daysAgo = Math.random() * 7;
    const timestamp = new Date(now - daysAgo * DAY_MS);

    const promptTokens = Math.floor(200 + Math.random() * 2500);
    const completionTokens = Math.floor(50 + Math.random() * 800);
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = calculateEstimatedCost(agent.defaultModel, promptTokens, completionTokens);

    usageEntries.push({
      timestamp,
      metadata: {
        userId: user._id,
        teamId: user.teamId,
        organizationId: org._id,
        agentName: agent.name,
        captureMethod: agent.method,
        model: agent.defaultModel
      },
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCost,
      requestLatencyMs: Math.floor(120 + Math.random() * 600),
      extraMetadata: {
        gitRepo: i % 2 === 0 ? 'acme-web-app' : 'acme-api-service',
        gitBranch: i % 3 === 0 ? 'feature/ai-integration' : 'main'
      }
    });
  }

  await AgentUsage.insertMany(usageEntries);
  console.log(`[Seed] Successfully seeded Organization "${org.name}", 4 teams, 6 users, and ${usageEntries.length} agent usage records!`);
}

// Allow standalone execution
if (process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js')) {
  (async () => {
    await connectDB();
    await seedDatabase();
    await disconnectDB();
    process.exit(0);
  })();
}
