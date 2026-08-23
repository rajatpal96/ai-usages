'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Cpu, Zap, ShieldCheck, TrendingUp, Sparkles } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function ModelsPage() {
  const [range, setRange] = useState('30d');
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/analytics/usage/by-model?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setModels(json.models || []);
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [range]);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar range={range} onRangeChange={(r) => setRange(r)} onRefresh={fetchModels} />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Model & Token Efficiency
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Analyze prompt tokens, completion generation, reasoning overhead, and prompt caching savings across LLM providers.
          </p>
        </div>

        {/* Models Grid Table */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Model & Provider</th>
                <th className="px-6 py-4">Invocations</th>
                <th className="px-6 py-4">Input Tokens</th>
                <th className="px-6 py-4">Output Tokens</th>
                <th className="px-6 py-4">Cache Read Tokens</th>
                <th className="px-6 py-4">Avg Latency</th>
                <th className="px-6 py-4 text-right">Total Spend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {models.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 font-sans">
                    No model telemetry recorded yet.
                  </td>
                </tr>
              ) : (
                models.map((m) => (
                  <tr key={`${m._id.provider}-${m._id.model}`} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-white flex items-center gap-2">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        {m._id.model}
                      </div>
                      <div className="text-[10px] text-slate-500 uppercase">{m._id.provider}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {formatNumber(m.totalRequests)}
                    </td>
                    <td className="px-6 py-4 text-indigo-300">
                      {formatNumber(m.inputTokens)}
                    </td>
                    <td className="px-6 py-4 text-purple-300">
                      {formatNumber(m.outputTokens)}
                    </td>
                    <td className="px-6 py-4 text-cyan-300">
                      {formatNumber(m.cacheReadTokens)}
                    </td>
                    <td className="px-6 py-4 text-slate-300">
                      {m.avgLatencyMs ? `${Math.round(m.avgLatencyMs)}ms` : '—'}
                    </td>
                    <td className="px-6 py-4 font-bold text-emerald-400 text-right">
                      {formatCurrency(m.totalCostUsd)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
