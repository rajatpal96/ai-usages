'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Navbar } from '../../components/Navbar';
import { Terminal, Search, Filter, Clock, Cpu, Coins, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function SessionsPage() {
  const [range, setRange] = useState('30d');
  const [sessions, setSessions] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const url = selectedAgent !== 'all'
        ? `/api/v1/sessions?agent=${selectedAgent}`
        : `/api/v1/sessions`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        setSessions(json.sessions || []);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [selectedAgent]);

  const filtered = sessions.filter((s) => {
    return (
      s.sessionId?.toLowerCase().includes(search.toLowerCase()) ||
      s.agentName?.toLowerCase().includes(search.toLowerCase()) ||
      s.projectId?.toLowerCase().includes(search.toLowerCase()) ||
      s.sessionGoal?.toLowerCase().includes(search.toLowerCase()) ||
      s.userPrompt?.toLowerCase().includes(search.toLowerCase()) ||
      s.actionSummary?.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="flex-1 flex flex-col">
      <Navbar range={range} onRangeChange={(r) => setRange(r)} onRefresh={fetchSessions} />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            AI Agent Sessions Explorer
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Browse complete coding sessions across Claude Code, GitHub Copilot, Gemini/Antigravity, Codex & Grok.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search by session ID, goal, prompt, or repo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
            {['all', 'claude-code', 'github-copilot', 'gemini-antigravity', 'codex', 'grok'].map((agent) => (
              <button
                key={agent}
                onClick={() => setSelectedAgent(agent)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                  selectedAgent === agent
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {agent === 'all' ? 'All Agents' : agent}
              </button>
            ))}
          </div>
        </div>

        {/* Sessions Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Session / Goal</th>
                  <th className="px-6 py-4">Agent</th>
                  <th className="px-6 py-4">Project / Repo</th>
                  <th className="px-6 py-4">Duration</th>
                  <th className="px-6 py-4">Invocations</th>
                  <th className="px-6 py-4">Tokens</th>
                  <th className="px-6 py-4">Cost (USD)</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      No active or recorded sessions found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => {
                    const goal = s.sessionGoal || s.userPrompt || s.actionSummary;
                    return (
                      <tr key={s.sessionId} className="hover:bg-slate-900/40 transition-colors group">
                        <td className="px-6 py-4 max-w-xs sm:max-w-md">
                          <div className="font-mono font-semibold text-indigo-400 flex items-center gap-2">
                            <Terminal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                            <span className="truncate">{s.sessionId}</span>
                          </div>
                          {goal && (
                            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1 font-sans pl-5.5">
                              {goal}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-medium font-mono text-[11px]">
                            {s.agentName}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-mono whitespace-nowrap">
                          {s.projectId || 'main-repo'}
                        </td>
                        <td className="px-6 py-4 text-slate-400 whitespace-nowrap">
                          {Math.round((s.durationMs || 1000) / 1000)}s
                        </td>
                        <td className="px-6 py-4 text-slate-300 font-mono whitespace-nowrap">
                          {s.eventCount || s.requestCount || 1}
                        </td>
                        <td className="px-6 py-4 font-mono font-medium text-slate-200 whitespace-nowrap">
                          {formatNumber(s.totalTokens || 0)}
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-emerald-400 whitespace-nowrap">
                          {formatCurrency(s.totalCostUsd || 0)}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <Link
                            href={`/sessions/${s.sessionId}`}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 font-medium transition-all"
                          >
                            Timeline
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
