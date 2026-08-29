'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Navbar } from '../../../components/Navbar';
import {
  Terminal,
  ArrowLeft,
  Clock,
  Cpu,
  Coins,
  Activity,
  CheckCircle2,
  AlertCircle,
  Code2,
  Bot,
  Zap,
  MessageSquare,
  Wrench,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Brain,
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id as string;
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/sessions/${sessionId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch session detail:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId]);

  const session = data?.session;
  const events = data?.events || [];

  const sessionGoal = session?.sessionGoal || session?.initialPrompt || events[0]?.sessionGoal || events[0]?.userPrompt || events[0]?.metadata?.sessionGoal || events[0]?.metadata?.userPrompt;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar range="30d" onRangeChange={() => {}} onRefresh={fetchSession} />

      <div className="p-8 max-w-6xl mx-auto w-full space-y-8">
        {/* Back Link */}
        <Link
          href="/sessions"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Sessions Explorer
        </Link>

        {/* Session Header Card */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Terminal className="w-8 h-8" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white font-mono">{sessionId}</h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-mono">
                    COMPLETED
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Agent: <strong className="text-slate-200 font-mono">{session?.agentName}</strong> • Repo:{' '}
                  <strong className="text-slate-200 font-mono">{session?.projectId || 'main-repo'}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-6 text-right">
              <div>
                <div className="text-xs text-slate-400">Session Total Spend</div>
                <div className="text-2xl font-extrabold text-emerald-400 font-mono">
                  {formatCurrency(session?.totalCostUsd || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Session Goal Banner if available */}
          {sessionGoal && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-950/60 to-purple-950/40 border border-indigo-500/30 space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Session Goal / User Request
              </div>
              <p className="text-sm text-slate-200 font-medium leading-relaxed">
                {sessionGoal}
              </p>
            </div>
          )}

          {/* Session Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-800/80 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-cyan-400" /> Duration
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {Math.round((session?.durationMs || 1000) / 1000)}s
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Activity className="w-3.5 h-3.5 text-indigo-400" /> Invocations
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {session?.requestCount || events.length}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Cpu className="w-3.5 h-3.5 text-purple-400" /> Total Tokens
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {formatNumber(session?.totalTokens || 0)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5 mb-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Events Logged
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {events.length}
              </span>
            </div>
          </div>
        </div>

        {/* Chronological Event Timeline */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            Chronological Telemetry Event Timeline
          </h3>

          <div className="space-y-6 relative before:absolute before:inset-0 before:left-4 before:w-0.5 before:bg-slate-800">
            {events.map((evt: any, idx: number) => {
              const userPrompt = evt.userPrompt || evt.metadata?.userPrompt;
              const actionSummary = evt.actionSummary || evt.metadata?.actionSummary;
              const tools = evt.metadata?.tools || [];
              const thinking = evt.metadata?.thinkingSnippet;

              return (
                <div key={evt.eventId || idx} className="relative pl-10 group">
                  {/* Timeline Dot */}
                  <div className="absolute left-2.5 top-5 w-3.5 h-3.5 -translate-x-1/2 rounded-full bg-slate-950 border-2 border-indigo-500 group-hover:border-emerald-400 transition-colors shadow-[0_0_8px_rgba(99,102,241,0.5)]" />

                  <div className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-slate-700 transition-all space-y-4 bg-slate-900/50">
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-indigo-400">{evt.eventId}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                          {evt.model?.name}
                        </span>
                        {evt.status && (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold ${
                            evt.status === 'error'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}>
                            {evt.status}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
                        <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
                        <span className="text-emerald-400 font-bold">
                          {formatCurrency(evt.cost?.total || 0)}
                        </span>
                      </div>
                    </div>

                    {/* User Prompt Box (if turn has user prompt) */}
                    {userPrompt && (
                      <div className="p-3.5 rounded-xl bg-slate-950/80 border border-indigo-500/20 space-y-1">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                          <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                          User Prompt
                        </div>
                        <p className="text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                          {userPrompt}
                        </p>
                      </div>
                    )}

                    {/* Agent Action Summary & Tool Calls */}
                    {actionSummary && (
                      <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                            <Wrench className="w-3.5 h-3.5 text-emerald-400" />
                            Agent Action / Step
                          </div>
                          {tools.length > 0 && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {tools.length} tool call{tools.length > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-300">
                          {actionSummary}
                        </p>
                        {tools.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {tools.map((tool: string, tIdx: number) => (
                              <span
                                key={tIdx}
                                className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700/60 text-slate-300 font-mono text-[10px]"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Reasoning / Thinking Snippet */}
                    {thinking && (
                      <div className="p-3 rounded-xl bg-slate-950/30 border border-purple-900/30 text-xs text-slate-400 italic space-y-1">
                        <span className="text-[10px] font-semibold text-purple-400 not-italic uppercase tracking-wider flex items-center gap-1">
                          <Brain className="w-3 h-3 text-purple-400" /> Thought Process
                        </span>
                        <p className="text-[11px] leading-relaxed text-slate-300">
                          {thinking}...
                        </p>
                      </div>
                    )}

                    {/* Token breakdown row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/60 text-[11px] font-mono">
                      <div className="text-slate-400">
                        Input:{' '}
                        <strong className="text-indigo-300">
                          {formatNumber(evt.usage?.inputTokens || 0)}
                        </strong>
                      </div>
                      <div className="text-slate-400">
                        Output:{' '}
                        <strong className="text-purple-300">
                          {formatNumber(evt.usage?.outputTokens || 0)}
                        </strong>
                      </div>
                      <div className="text-slate-400">
                        Cache Read:{' '}
                        <strong className="text-cyan-300">
                          {formatNumber(evt.usage?.cacheReadTokens || 0)}
                        </strong>
                      </div>
                      <div className="text-slate-400">
                        Latency:{' '}
                        <strong className="text-amber-300">
                          {evt.performance?.latencyMs ? `${evt.performance.latencyMs}ms` : '—'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
