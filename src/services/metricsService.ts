import mongoose, { Types } from 'mongoose';
import { AgentUsage } from '../models/AgentUsage.js';
import { Organization } from '../models/Organization.js';
import { Team } from '../models/Team.js';
import { User } from '../models/User.js';
import { calculateEstimatedCost } from './costCalculator.js';

export interface IngestUsageDTO {
  username: string; // OS user or git committer email
  organizationName?: string;
  teamName?: string;
  agentName: string; // e.g. 'claude_code', 'cursor', 'copilot', 'custom_mcp'
  captureMethod: 'proxy' | 'log_watcher' | 'mcp_sniffer';
  model: string;
  promptTokens: number;
  completionTokens: number;
  requestLatencyMs?: number;
  extraMetadata?: Record<string, any>;
}

export class MetricsService {
  /**
   * Ingest a single usage event and auto-resolve Organization, Team, and User records if necessary.
   */
  static async recordUsage(dto: IngestUsageDTO) {
    const orgName = dto.organizationName || 'Default Organization';
    const teamName = dto.teamName || 'Engineering';

    let org = await Organization.findOne({ name: orgName });
    if (!org) {
      org = await Organization.create({ name: orgName, monthlyBudget: 1000 });
    }

    let team = await Team.findOne({ organizationId: org._id, name: teamName });
    if (!team) {
      team = await Team.create({ organizationId: org._id, name: teamName, monthlyBudget: 250 });
    }

    let user = await User.findOne({ username: dto.username });
    if (!user) {
      user = await User.create({
        organizationId: org._id,
        teamId: team._id,
        username: dto.username,
        name: dto.username.split('@')[0]
      });
    }

    const totalTokens = dto.promptTokens + dto.completionTokens;
    const estimatedCost = calculateEstimatedCost(dto.model, dto.promptTokens, dto.completionTokens);

    const usageRecord = await AgentUsage.create({
      timestamp: new Date(),
      metadata: {
        userId: user._id,
        teamId: team._id,
        organizationId: org._id,
        agentName: dto.agentName,
        captureMethod: dto.captureMethod,
        model: dto.model
      },
      promptTokens: dto.promptTokens,
      completionTokens: dto.completionTokens,
      totalTokens,
      estimatedCost,
      requestLatencyMs: dto.requestLatencyMs || 0,
      extraMetadata: dto.extraMetadata
    });

    return usageRecord;
  }

  /**
   * Get Organization-wide metrics.
   */
  static async getOrganizationMetrics(orgIdOrName?: string) {
    let orgQuery: any = {};
    if (orgIdOrName) {
      if (mongoose.Types.ObjectId.isValid(orgIdOrName)) {
        orgQuery._id = new Types.ObjectId(orgIdOrName);
      } else {
        orgQuery.name = orgIdOrName;
      }
    }

    const org = await Organization.findOne(orgQuery) || await Organization.findOne();
    if (!org) {
      return { message: 'No organization metrics found.' };
    }

    const matchStage = { 'metadata.organizationId': org._id };

    const totalUsage = await AgentUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalPromptTokens: { $sum: '$promptTokens' },
          totalCompletionTokens: { $sum: '$completionTokens' },
          totalTokens: { $sum: '$totalTokens' },
          totalEstimatedCostUSD: { $sum: '$estimatedCost' },
          totalRequests: { $sum: 1 },
          uniqueUsers: { $addToSet: '$metadata.userId' }
        }
      }
    ]);

    const teamBreakdown = await AgentUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$metadata.teamId',
          totalTokens: { $sum: '$totalTokens' },
          totalCostUSD: { $sum: '$estimatedCost' },
          requests: { $sum: 1 },
          users: { $addToSet: '$metadata.userId' }
        }
      },
      {
        $lookup: {
          from: 'teams',
          localField: '_id',
          foreignField: '_id',
          as: 'team'
        }
      },
      { $unwind: '$team' },
      {
        $project: {
          teamId: '$_id',
          teamName: '$team.name',
          department: '$team.department',
          monthlyBudgetUSD: '$team.monthlyBudget',
          totalTokens: 1,
          totalCostUSD: { $round: ['$totalCostUSD', 4] },
          requests: 1,
          activeUsersCount: { $size: '$users' }
        }
      }
    ]);

    const agentBreakdown = await AgentUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: '$metadata.agentName',
          totalTokens: { $sum: '$totalTokens' },
          totalCostUSD: { $sum: '$estimatedCost' },
          requests: { $sum: 1 }
        }
      },
      {
        $project: {
          agentName: '$_id',
          totalTokens: 1,
          totalCostUSD: { $round: ['$totalCostUSD', 4] },
          requests: 1
        }
      }
    ]);

    const stats = totalUsage[0] || {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      totalEstimatedCostUSD: 0,
      totalRequests: 0,
      uniqueUsers: []
    };

    return {
      organization: {
        id: org._id,
        name: org.name,
        monthlyBudgetUSD: org.monthlyBudget
      },
      summary: {
        totalPromptTokens: stats.totalPromptTokens,
        totalCompletionTokens: stats.totalCompletionTokens,
        totalTokens: stats.totalTokens,
        totalEstimatedCostUSD: parseFloat((stats.totalEstimatedCostUSD || 0).toFixed(4)),
        totalRequests: stats.totalRequests,
        activeDevelopersCount: (stats.uniqueUsers || []).length
      },
      teamBreakdown,
      agentBreakdown
    };
  }

  /**
   * Get Team-wise metrics.
   */
  static async getTeamMetrics(teamIdOrName?: string) {
    let matchStage: any = {};
    if (teamIdOrName) {
      if (mongoose.Types.ObjectId.isValid(teamIdOrName)) {
        matchStage['metadata.teamId'] = new Types.ObjectId(teamIdOrName);
      } else {
        const teamObj = await Team.findOne({ name: teamIdOrName });
        if (teamObj) matchStage['metadata.teamId'] = teamObj._id;
      }
    }

    const teamAggregation = await AgentUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            teamId: '$metadata.teamId',
            userId: '$metadata.userId'
          },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUSD: { $sum: '$estimatedCost' },
          requests: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'teams',
          localField: '_id.teamId',
          foreignField: '_id',
          as: 'team'
        }
      },
      { $unwind: '$team' },
      {
        $group: {
          _id: '$_id.teamId',
          teamName: { $first: '$team.name' },
          department: { $first: '$team.department' },
          monthlyBudgetUSD: { $first: '$team.monthlyBudget' },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUSD: { $sum: '$totalCostUSD' },
          totalRequests: { $sum: '$requests' },
          members: {
            $push: {
              userId: '$user._id',
              username: '$user.username',
              name: '$user.name',
              totalTokens: '$totalTokens',
              totalCostUSD: { $round: ['$totalCostUSD', 4] },
              requests: '$requests'
            }
          }
        }
      },
      {
        $project: {
          teamId: '$_id',
          teamName: 1,
          department: 1,
          monthlyBudgetUSD: 1,
          totalTokens: 1,
          totalCostUSD: { $round: ['$totalCostUSD', 4] },
          totalRequests: 1,
          activeMembersCount: { $size: '$members' },
          members: 1
        }
      }
    ]);

    return { teams: teamAggregation };
  }

  /**
   * Get Member-wise metrics.
   */
  static async getMemberMetrics(usernameOrId?: string) {
    let matchStage: any = {};
    if (usernameOrId) {
      if (mongoose.Types.ObjectId.isValid(usernameOrId)) {
        matchStage['metadata.userId'] = new Types.ObjectId(usernameOrId);
      } else {
        const userObj = await User.findOne({ username: usernameOrId });
        if (userObj) matchStage['metadata.userId'] = userObj._id;
      }
    }

    const memberAggregation = await AgentUsage.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            userId: '$metadata.userId',
            agentName: '$metadata.agentName',
            model: '$metadata.model'
          },
          promptTokens: { $sum: '$promptTokens' },
          completionTokens: { $sum: '$completionTokens' },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUSD: { $sum: '$estimatedCost' },
          requests: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      { $unwind: '$user' },
      {
        $lookup: {
          from: 'teams',
          localField: 'user.teamId',
          foreignField: '_id',
          as: 'team'
        }
      },
      { $unwind: '$team' },
      {
        $group: {
          _id: '$_id.userId',
          username: { $first: '$user.username' },
          name: { $first: '$user.name' },
          teamName: { $first: '$team.name' },
          totalTokens: { $sum: '$totalTokens' },
          totalCostUSD: { $sum: '$totalCostUSD' },
          totalRequests: { $sum: '$requests' },
          breakdown: {
            $push: {
              agentName: '$_id.agentName',
              model: '$_id.model',
              promptTokens: '$promptTokens',
              completionTokens: '$completionTokens',
              totalTokens: '$totalTokens',
              totalCostUSD: { $round: ['$totalCostUSD', 4] },
              requests: '$requests'
            }
          }
        }
      },
      {
        $project: {
          userId: '$_id',
          username: 1,
          name: 1,
          teamName: 1,
          totalTokens: 1,
          totalCostUSD: { $round: ['$totalCostUSD', 4] },
          totalRequests: 1,
          breakdown: 1
        }
      }
    ]);

    return { members: memberAggregation };
  }

  /**
   * Get Budget Alerts (Teams or Orgs exceeding budget).
   */
  static async getBudgetAlerts() {
    const teams = await Team.find();
    const alerts = [];

    for (const team of teams) {
      const usage = await AgentUsage.aggregate([
        { $match: { 'metadata.teamId': team._id } },
        { $group: { _id: null, totalCostUSD: { $sum: '$estimatedCost' } } }
      ]);

      const cost = usage[0]?.totalCostUSD || 0;
      const budget = team.monthlyBudget;
      const percentUsed = budget > 0 ? (cost / budget) * 100 : 0;

      if (percentUsed >= 80) {
        alerts.push({
          teamId: team._id,
          teamName: team.name,
          monthlyBudgetUSD: budget,
          currentSpendUSD: parseFloat(cost.toFixed(4)),
          percentUsed: parseFloat(percentUsed.toFixed(2)),
          status: percentUsed >= 100 ? 'EXCEEDED' : 'WARNING'
        });
      }
    }

    return { alertsCount: alerts.length, alerts };
  }
}
