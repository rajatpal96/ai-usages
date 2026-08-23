'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { PiggyBank, Bell, AlertTriangle, ShieldCheck, Plus, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function BudgetsPage() {
  const [budget, setBudget] = useState<any>(null);
  const [alerts, setAlerts] = useState<any>({ rules: [], history: [] });
  const [newLimit, setNewLimit] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const fetchBudgetAndAlerts = async () => {
    try {
      const [bRes, aRes] = await Promise.all([
        fetch('/api/v1/budgets'),
        fetch('/api/v1/alerts'),
      ]);
      if (bRes.ok) setBudget(await bRes.json());
      if (aRes.ok) setAlerts(await aRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBudgetAndAlerts();
  }, []);

  const handleUpdateBudget = async () => {
    if (!newLimit) return;
    try {
      const res = await fetch('/api/v1/budgets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monthlyLimitUsd: Number(newLimit), alertThresholdPercent: 80 }),
      });
      if (res.ok) {
        setBudget(await res.json());
        setStatusMsg('Monthly budget updated!');
        setNewLimit('');
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const percentUsed = budget ? Math.min(100, Math.round((budget.currentSpendUsd / budget.monthlyLimitUsd) * 100)) : 0;

  return (
    <div className="flex-1 flex flex-col">
      <Navbar range="30d" onRangeChange={() => {}} onRefresh={fetchBudgetAndAlerts} />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Budgets, Cost Limits & Anomaly Alerts
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Configure automated spending caps, cost-spike detection rules, and webhook notifications across email, Slack & Discord.
          </p>
        </div>

        {/* Monthly Budget Card */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <PiggyBank className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Monthly AI Spend Cap</h3>
                <p className="text-xs text-slate-400">Alert threshold: 80% of limit</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="New limit (e.g. 1500)"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-40 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleUpdateBudget}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                Update Limit
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="text-xs text-emerald-400 flex items-center gap-1.5 font-mono">
              <CheckCircle2 className="w-4 h-4" /> {statusMsg}
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-mono">
              <span className="text-slate-400">
                Spent: <strong className="text-white">{formatCurrency(budget?.currentSpendUsd || 0)}</strong>
              </span>
              <span className="text-emerald-400 font-bold">
                Cap: {formatCurrency(budget?.monthlyLimitUsd || 1000)} ({percentUsed}% used)
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-800">
              <div
                style={{ width: `${percentUsed}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  percentUsed > 80 ? 'bg-rose-500' : 'bg-gradient-to-r from-indigo-500 to-emerald-400'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Alert Rules & History Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Active Alert Rules */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Active Anomaly Rules
              </h3>
            </div>

            <div className="space-y-2.5">
              {[
                { name: 'Daily Spend Surge', type: 'cost_spike', threshold: '$50.00 / hour', channel: 'Slack & Email' },
                { name: 'Runaway Session Guard', type: 'expensive_session', threshold: '$10.00 single session', channel: 'Webhook' },
                { name: 'Agent Error Spike', type: 'agent_error_rate', threshold: '> 10% errors in 1h', channel: 'Discord' },
                { name: 'MCP Latency Degradation', type: 'mcp_latency', threshold: '> 3000ms latency', channel: 'Webhook' },
              ].map((rule) => (
                <div key={rule.name} className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{rule.name}</div>
                    <div className="text-[11px] text-slate-400 font-mono">Threshold: {rule.threshold}</div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 font-mono text-[10px] border border-indigo-500/20">
                    {rule.channel}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Triggered Alert History */}
          <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Recent Trigger History
            </h3>

            <div className="space-y-2.5">
              {(!alerts.history || alerts.history.length === 0) ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  No alerts triggered in this billing cycle.
                </div>
              ) : (
                alerts.history.map((h: any) => (
                  <div key={h._id || h.ruleId} className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-rose-300">
                      <span>{h.ruleName}</span>
                      <span className="font-mono text-[10px] text-slate-400">
                        {new Date(h.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-300">{h.message}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
