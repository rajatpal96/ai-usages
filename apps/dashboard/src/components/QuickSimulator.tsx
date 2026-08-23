'use client';

import React, { useState } from 'react';
import { Play, Sparkles, CheckCircle2, RefreshCw } from 'lucide-react';

interface QuickSimulatorProps {
  onEventSent?: () => void;
}

export function QuickSimulator({ onEventSent }: QuickSimulatorProps) {
  const [selectedAgent, setSelectedAgent] = useState<'claude-code' | 'github-copilot' | 'gemini-antigravity' | 'codex' | 'grok'>('claude-code');
  const [isSending, setIsSending] = useState(false);
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const AGENTS = [
    { id: 'claude-code', label: 'Claude Code', model: 'claude-3-7-sonnet' },
    { id: 'github-copilot', label: 'Copilot', model: 'copilot-chat' },
    { id: 'gemini-antigravity', label: 'Gemini / Antigravity', model: 'gemini-2.5-pro' },
    { id: 'codex', label: 'Codex / OpenAI', model: 'gpt-4o' },
    { id: 'grok', label: 'xAI Grok', model: 'grok-2' },
  ];

  const handleSimulate = async () => {
    setIsSending(true);
    setLastStatus(null);

    const agentObj = AGENTS.find((a) => a.id === selectedAgent)!;
    const promptTokens = Math.floor(Math.random() * 8000) + 1200;
    const completionTokens = Math.floor(Math.random() * 1500) + 300;
    const cacheTokens = Math.floor(Math.random() * 6000);
    const latencyMs = Math.floor(Math.random() * 3000) + 400;

    const payload = {
      agent: selectedAgent,
      model: agentObj.model,
      usage: {
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        cacheReadTokens: cacheTokens,
      },
      performance: { latencyMs },
      projectId: 'main-app-repo',
      userId: 'alex.engineer@acme.com',
      metadata: { simulated: true, action: 'code_generation' },
    };

    try {
      const res = await fetch('/ingest/v1/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setLastStatus(`Simulated ${agentObj.label} event (${promptTokens + completionTokens} tokens)`);
        if (onEventSent) onEventSent();
      } else {
        setLastStatus('Simulation failed');
      }
    } catch (e: any) {
      setLastStatus(`Error: ${e.message}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 rounded-2xl glass-panel border border-indigo-500/30 bg-gradient-to-br from-indigo-950/30 to-purple-950/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <h4 className="text-sm font-semibold text-white">Live Telemetry Simulator</h4>
        </div>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
          Instant Ingestion Test
        </span>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {AGENTS.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id as any)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
              selectedAgent === agent.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            {agent.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <button
          onClick={handleSimulate}
          disabled={isSending}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50"
        >
          {isSending ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5 fill-current" />
          )}
          <span>Fire Telemetry Event</span>
        </button>

        {lastStatus && (
          <span className="text-xs text-emerald-400 font-mono flex items-center gap-1.5 animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {lastStatus}
          </span>
        )}
      </div>
    </div>
  );
}
