'use client';

import React from 'react';
import { formatNumber, formatCurrency } from '@/lib/utils';
import { Bot, Terminal, Sparkles, Code2, Flame } from 'lucide-react';

interface AgentUsageItem {
  agentName: string;
  totalTokens: number;
  totalCostUsd: number;
  requestCount: number;
  percentage: number;
}

interface AgentUsageBarProps {
  agents: AgentUsageItem[];
}

const AGENT_META: Record<string, { label: string; icon: any; color: string; bg: string; border: string }> = {
  'claude-code': {
    label: 'Claude Code',
    icon: Terminal,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  'github-copilot': {
    label: 'GitHub Copilot',
    icon: Code2,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  'gemini-antigravity': {
    label: 'Gemini / Antigravity',
    icon: Sparkles,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
  },
  codex: {
    label: 'Codex / OpenAI',
    icon: Bot,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  grok: {
    label: 'xAI Grok',
    icon: Flame,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
  },
};

export function AgentUsageBar({ agents }: AgentUsageBarProps) {
  if (!agents || agents.length === 0) {
    return <div className="text-xs text-slate-500 py-4">No agent activity registered.</div>;
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden flex p-0.5 border border-slate-800">
        {agents.map((agent, idx) => {
          const meta = AGENT_META[agent.agentName] || { bg: 'bg-slate-500' };
          const bgColors = ['bg-amber-400', 'bg-cyan-400', 'bg-indigo-500', 'bg-emerald-400', 'bg-rose-400'];
          const colorClass = bgColors[idx % bgColors.length];

          return (
            <div
              key={agent.agentName}
              style={{ width: `${Math.max(4, agent.percentage)}%` }}
              className={`h-full first:rounded-l-full last:rounded-r-full ${colorClass} transition-all duration-500`}
              title={`${agent.agentName}: ${agent.percentage}%`}
            />
          );
        })}
      </div>

      {/* Agent List Items */}
      <div className="space-y-2.5">
        {agents.map((agent) => {
          const meta = AGENT_META[agent.agentName] || {
            label: agent.agentName,
            icon: Bot,
            color: 'text-slate-300',
            bg: 'bg-slate-800/40',
            border: 'border-slate-700',
          };
          const Icon = meta.icon;

          return (
            <div
              key={agent.agentName}
              className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-slate-800/80 hover:border-slate-700 transition-all text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg ${meta.bg} ${meta.color} border ${meta.border}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="font-semibold text-slate-200">{meta.label}</div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {formatNumber(agent.requestCount)} reqs • {formatNumber(agent.totalTokens)} tokens
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold text-emerald-400 font-mono">
                  {formatCurrency(agent.totalCostUsd)}
                </div>
                <div className="text-[10px] text-slate-400 font-mono">{agent.percentage}% share</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
