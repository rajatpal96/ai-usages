'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Layers, Activity, Clock, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

export default function McpPage() {
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchMcp = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/mcp/analytics?range=${range}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch MCP analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMcp();
  }, [range]);

  return (
    <div className="flex-1 flex flex-col">
      <Navbar range={range} onRangeChange={(r) => setRange(r)} onRefresh={fetchMcp} />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Model Context Protocol (MCP) Observability
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Observe MCP tool calls executed by AI agents, measure latency distributions, and monitor tool reliability.
          </p>
        </div>

        {/* Top MCP Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="p-5 rounded-2xl glass-panel border border-indigo-500/20 bg-indigo-500/5">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase">
              <span>Total Tool Calls</span>
              <Layers className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 font-mono">
              {data ? formatNumber(data.totalCalls) : 0}
            </div>
            <div className="text-xs text-slate-400 mt-2">
              Across {data?.serversCount || 1} servers & {data?.toolsCount || 12} tools
            </div>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-cyan-500/20 bg-cyan-500/5">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase">
              <span>Average Latency</span>
              <Clock className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2 font-mono">
              {data?.avgLatencyMs || 0}ms
            </div>
            <div className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> Fast execution
            </div>
          </div>

          <div className="p-5 rounded-2xl glass-panel border border-rose-500/20 bg-rose-500/5">
            <div className="flex justify-between items-center text-xs text-slate-400 font-semibold uppercase">
              <span>Tool Error Rate</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-2xl font-bold text-rose-400 mt-2 font-mono">
              {data?.errorRate || 0}%
            </div>
            <div className="text-xs text-slate-400 mt-2">Fault tolerance status</div>
          </div>
        </div>

        {/* MCP Tool Calls Breakdown */}
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-800 space-y-4 p-6">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-400" />
            Registered Tools Telemetry Breakdown
          </h3>

          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Tool Name</th>
                <th className="px-6 py-4">Server</th>
                <th className="px-6 py-4">Calls Executed</th>
                <th className="px-6 py-4">Avg Latency</th>
                <th className="px-6 py-4 text-right">Errors</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {(!data?.toolBreakdown || data.toolBreakdown.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-sans">
                    No MCP tool calls logged yet.
                  </td>
                </tr>
              ) : (
                data.toolBreakdown.map((t: any) => (
                  <tr key={`${t.serverName}-${t.toolName}`} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-6 py-4 font-bold text-indigo-300">
                      {t.toolName}
                    </td>
                    <td className="px-6 py-4 text-slate-400">
                      {t.serverName}
                    </td>
                    <td className="px-6 py-4 text-white">
                      {formatNumber(t.calls)}
                    </td>
                    <td className="px-6 py-4 text-cyan-300">
                      {t.avgLatencyMs}ms
                    </td>
                    <td className="px-6 py-4 text-right text-rose-400 font-semibold">
                      {t.errors}
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
