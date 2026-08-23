'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../components/Navbar';
import { MetricCard } from '../components/MetricCard';
import { TokenTrendChart } from '../components/TokenTrendChart';
import { AgentUsageBar } from '../components/AgentUsageBar';
import { QuickSimulator } from '../components/QuickSimulator';
import {
  Activity,
  Coins,
  Cpu,
  Bot,
  Terminal,
  FolderGit2,
  AlertTriangle,
  ChevronRight,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';
import Link from 'next/link';

export default function OverviewPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOverview = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(`/api/v1/analytics/overview?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch overview data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, [range]);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar
        range={range}
        onRangeChange={(r) => setRange(r)}
        onRefresh={fetchOverview}
        isRefreshing={isRefreshing}
      />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* Hero Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              AI Agent Fleet Observability
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ● Live Fleet Active
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Unified intelligence across Claude Code, GitHub Copilot, Gemini/Antigravity, Codex & Grok.
            </p>
          </div>
        </div>

        {/* Quick Simulator Bar */}
        <QuickSimulator onEventSent={fetchOverview} />

        {/* Top 4 KPI Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <MetricCard
            title="Total Spend (USD)"
            value={data ? formatCurrency(data.totalCostUsd) : '$0.00'}
            subtitle={`Past ${range.toUpperCase()} consumption`}
            trend={{ value: '+14.2% vs prev', isPositive: false }}
            icon={Coins}
            color="emerald"
          />
          <MetricCard
            title="Tokens Processed"
            value={data ? formatNumber(data.totalTokens) : '0'}
            subtitle="Prompts, outputs & cache"
            trend={{ value: '+28.5%', isPositive: true }}
            icon={Cpu}
            color="indigo"
          />
          <MetricCard
            title="AI Invocations"
            value={data ? formatNumber(data.totalRequests) : '0'}
            subtitle="Agent completions & edits"
            trend={{ value: '+8.1%', isPositive: true }}
            icon={Activity}
            color="cyan"
          />
          <MetricCard
            title="Active Agents"
            value={data ? data.activeAgentsCount : 5}
            subtitle="Heterogeneous coding tools"
            icon={Bot}
            color="purple"
          />
        </div>

        {/* Main Grid: Token Trend & Agent Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Token & Cost Trend Chart */}
          <div className="lg:col-span-2 p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-400" />
                  Token Volume & Spend Trajectory
                </h3>
                <p className="text-xs text-slate-400">
                  Input prompt tokens vs generated completions vs cached prompt savings
                </p>
              </div>
            </div>
            <TokenTrendChart data={data?.tokenTrend || []} />
          </div>

          {/* Usage by Agent Breakdown */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-400" />
                Fleet Share by Agent
              </h3>
              <Link href="/agents" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                Deep Dive →
              </Link>
            </div>
            <AgentUsageBar agents={data?.usageByAgent || []} />
          </div>
        </div>

        {/* Bottom Grid: Cost by Project & Recent Agent Sessions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Cost Allocation by Repository / Project */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-cyan-400" />
                Cost by Project & Repository
              </h3>
              <span className="text-xs text-slate-400">Budget Limit: $250/repo</span>
            </div>

            <div className="space-y-3">
              {(data?.costByProject || []).map((proj: any) => {
                const percent = Math.min(100, Math.round((proj.totalCostUsd / (proj.budgetUsd || 250)) * 100));
                return (
                  <div key={proj.projectId} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800">
                    <div className="flex justify-between text-xs mb-1.5 font-medium">
                      <span className="text-slate-200 font-mono flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-cyan-400" />
                        {proj.projectId}
                      </span>
                      <span className="text-emerald-400 font-mono">
                        {formatCurrency(proj.totalCostUsd)}{' '}
                        <span className="text-slate-500 font-normal">/ ${proj.budgetUsd || 250}</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className={`h-full rounded-full ${
                          percent > 85 ? 'bg-rose-500' : percent > 60 ? 'bg-amber-400' : 'bg-cyan-400'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Agent Sessions */}
          <div className="p-6 rounded-2xl glass-panel space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                Live Agent Sessions
              </h3>
              <Link href="/sessions" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
                View All →
              </Link>
            </div>

            <div className="space-y-2.5">
              {(data?.recentSessions || []).map((session: any) => (
                <Link
                  key={session.sessionId}
                  href={`/sessions/${session.sessionId}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-indigo-500/40 hover:bg-slate-900/80 transition-all text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    </div>
                    <div>
                      <div className="font-semibold text-slate-200 group-hover:text-indigo-300 font-mono transition-colors">
                        {session.sessionId}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {session.agentName} • {Math.round((session.durationMs || 1000) / 1000)}s duration
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-semibold text-emerald-400 font-mono">
                      {formatCurrency(session.totalCostUsd || 0)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {formatNumber(session.totalTokens || 0)} tokens
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
