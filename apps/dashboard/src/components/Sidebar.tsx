'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Bot,
  Activity,
  Boxes,
  Cpu,
  PiggyBank,
  Settings,
  Radio,
  Terminal,
  Layers,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'AI Agents', href: '/agents', icon: Bot },
  { name: 'Sessions', href: '/sessions', icon: Terminal },
  { name: 'Models & Tokens', href: '/models', icon: Cpu },
  { name: 'MCP Analytics', href: '/mcp', icon: Layers },
  { name: 'Budgets & Alerts', href: '/budgets', icon: PiggyBank },
  { name: 'Settings & Keys', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-slate-800/80 bg-slate-950/80 backdrop-blur-xl flex flex-col h-screen sticky top-0 z-40">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/60 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-[2px] flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
          </div>
        </div>
        <div>
          <h1 className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
            AgentMeter
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
              v1.0
            </span>
          </h1>
          <p className="text-xs text-slate-400">AI Observability & Cost</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Observability
        </div>
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600/20 to-purple-600/10 text-white border border-indigo-500/30 shadow-md shadow-indigo-500/5'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
              <span>{item.name}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Connected Agents Pill */}
      <div className="p-4 border-t border-slate-800/60 bg-slate-950/40">
        <div className="rounded-xl p-3 bg-slate-900/60 border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Live Telemetry
            </span>
            <span className="font-mono text-emerald-400 text-[11px]">ACTIVE</span>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {['Claude', 'Copilot', 'Gemini', 'Codex', 'Grok'].map((agent) => (
              <span
                key={agent}
                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/50"
              >
                {agent}
              </span>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
