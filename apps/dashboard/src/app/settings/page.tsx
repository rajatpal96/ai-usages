'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '../../components/Navbar';
import { Key, Shield, Eye, Copy, Check, Plus, Database, Sparkles, Layers, Lock } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

export default function SettingsPage() {
  const [keys, setKeys] = useState<any[]>([]);
  const [keyName, setKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [pricing, setPricing] = useState<any[]>([]);
  const [privacyLevel, setPrivacyLevel] = useState(1);

  // MCP OAuth Token Generator State
  const [mcpClientId, setMcpClientId] = useState('cursor-mcp-client');
  const [mcpScopes, setMcpScopes] = useState<string[]>(['mcp:read', 'mcp:usage', 'mcp:cost']);
  const [generatedMcpToken, setGeneratedMcpToken] = useState<string | null>(null);
  const [copiedMcpToken, setCopiedMcpToken] = useState(false);

  const fetchKeysAndPricing = async () => {
    try {
      const [kRes, pRes] = await Promise.all([
        fetch('/api/v1/api-keys'),
        fetch('/api/v1/pricing'),
      ]);
      if (kRes.ok) {
        const j = await kRes.json();
        setKeys(j.keys || []);
      }
      if (pRes.ok) {
        const j = await pRes.json();
        setPricing(j.pricing || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchKeysAndPricing();
  }, []);

  const handleCreateKey = async () => {
    if (!keyName) return;
    try {
      const res = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName }),
      });
      if (res.ok) {
        const json = await res.json();
        setCreatedKey(json.apiKey);
        setKeyName('');
        fetchKeysAndPricing();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateMcpToken = async () => {
    try {
      const res = await fetch('/api/v1/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: mcpClientId,
          scope: mcpScopes.join(' '),
        }),
      });
      if (res.ok) {
        const json = await res.json();
        setGeneratedMcpToken(json.access_token);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleScope = (scope: string) => {
    setMcpScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const copyToClipboard = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col">
      <Navbar range="30d" onRangeChange={() => {}} onRefresh={fetchKeysAndPricing} />

      <div className="p-8 max-w-7xl mx-auto w-full space-y-8">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Settings, Security & MCP OAuth
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Manage organization API authentication, issue scoped MCP OAuth 2.0 Access Tokens for AI clients, and configure privacy policies.
          </p>
        </div>

        {/* MCP OAuth 2.0 Token Server Section */}
        <div className="p-6 rounded-2xl glass-panel border border-indigo-500/30 bg-gradient-to-br from-indigo-950/20 to-purple-950/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/40 text-indigo-400">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  MCP OAuth 2.0 Access Token Server
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Bearer Token Protected
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Generate scoped OAuth Access Tokens for Claude Desktop, Cursor, and Antigravity MCP clients
                </p>
              </div>
            </div>

            <button
              onClick={handleGenerateMcpToken}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-xs font-semibold shadow-lg shadow-indigo-500/25 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Issue MCP Access Token
            </button>
          </div>

          {/* Scope selection */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300">Target Client ID</label>
                <input
                  type="text"
                  value={mcpClientId}
                  onChange={(e) => setMcpClientId(e.target.value)}
                  className="mt-1 block w-64 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">Authorized MCP Scopes</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'mcp:usage', label: 'mcp:usage (Session & Agent Metrics)' },
                    { id: 'mcp:cost', label: 'mcp:cost (Spend & Budgets)' },
                    { id: 'mcp:read', label: 'mcp:read (Overview & Models)' },
                    { id: 'mcp:admin', label: 'mcp:admin (Full Access)' },
                  ].map((scope) => (
                    <button
                      key={scope.id}
                      onClick={() => toggleScope(scope.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${
                        mcpScopes.includes(scope.id)
                          ? 'bg-indigo-600 text-white border border-indigo-500 shadow-sm'
                          : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {scope.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Generated MCP Token Output */}
          {generatedMcpToken && (
            <div className="p-4 rounded-xl bg-indigo-950/50 border border-indigo-500/50 space-y-2 animate-fade-in">
              <div className="flex justify-between items-center text-xs text-indigo-300 font-semibold">
                <span>Active MCP Bearer Access Token (Pass via `mcpAccessToken` or MCP environment):</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-indigo-500/30 text-xs font-mono text-emerald-400 select-all truncate">
                  {generatedMcpToken}
                </code>
                <button
                  onClick={() => copyToClipboard(generatedMcpToken, setCopiedMcpToken)}
                  className="flex items-center gap-1 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  {copiedMcpToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedMcpToken ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* API Keys Section */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                <Key className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">Organization API Keys</h3>
                <p className="text-xs text-slate-400">Used by Local Collectors, IDE extensions & CLI loggers to ingest telemetry</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Key label (e.g. CI/CD Collector)"
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                className="w-56 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={handleCreateKey}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                Generate Key
              </button>
            </div>
          </div>

          {/* Newly created key banner */}
          {createdKey && (
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/50 space-y-2">
              <div className="flex justify-between items-center text-xs text-indigo-300 font-semibold">
                <span>New API Key Created (Copy it now — it won't be shown again):</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-slate-950 border border-indigo-500/30 text-xs font-mono text-emerald-400 select-all">
                  {createdKey}
                </code>
                <button
                  onClick={() => copyToClipboard(createdKey, setCopiedKey)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium"
                >
                  {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copiedKey ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Keys list */}
          <div className="divide-y divide-slate-800/80">
            {keys.map((k) => (
              <div key={k._id} className="py-3 flex items-center justify-between text-xs font-mono">
                <div>
                  <div className="font-semibold text-slate-200">{k.name}</div>
                  <div className="text-slate-500 text-[11px]">Prefix: {k.prefix}</div>
                </div>
                <div className="text-slate-400 text-right">
                  <div>Created: {new Date(k.createdAt).toLocaleDateString()}</div>
                  <span className="text-emerald-400 text-[10px]">Active</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Privacy Boundary Selector */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Telemetry Privacy Levels</h3>
              <p className="text-xs text-slate-400">Control data ingestion boundaries (Prompts, Code, and Secrets are never collected)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {[
              {
                level: 1,
                title: 'Level 1: Metadata Only (Default)',
                desc: 'Only token counts, model names, latency, and sanitized tool names are transmitted. Zero prompt or code content.',
                recommended: true,
              },
              {
                level: 2,
                title: 'Level 2: Execution Stats',
                desc: 'Includes command names, file modification counts, and git branch names for enhanced productivity metrics.',
                recommended: false,
              },
              {
                level: 3,
                title: 'Level 3: Full Audit (Opt-in)',
                desc: 'For enterprise internal security compliance with dedicated encryption vaults. (Disabled in MVP)',
                recommended: false,
                disabled: true,
              },
            ].map((p) => (
              <div
                key={p.level}
                onClick={() => !p.disabled && setPrivacyLevel(p.level)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  privacyLevel === p.level
                    ? 'bg-indigo-950/30 border-indigo-500/50 shadow-lg shadow-indigo-500/10'
                    : p.disabled
                    ? 'opacity-40 bg-slate-900/30 border-slate-800 cursor-not-allowed'
                    : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-xs text-white">{p.title}</h4>
                  {p.recommended && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Catalog Viewer */}
        <div className="p-6 rounded-2xl glass-panel border border-slate-800 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Dynamic Pricing Engine Catalog</h3>
              <p className="text-xs text-slate-400">Versioned USD rates per 1 Million Tokens for Anthropic, OpenAI, Google, xAI & Copilot</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 border-b border-slate-800/80 text-slate-400 font-semibold uppercase">
                <tr>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Input / 1M</th>
                  <th className="px-4 py-3">Output / 1M</th>
                  <th className="px-4 py-3">Cache Read / 1M</th>
                  <th className="px-4 py-3">Cache Write / 1M</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {pricing.slice(0, 10).map((t: any) => (
                  <tr key={`${t.provider}-${t.model}`} className="hover:bg-slate-900/40">
                    <td className="px-4 py-3 font-semibold uppercase text-slate-400">{t.provider}</td>
                    <td className="px-4 py-3 text-indigo-300 font-bold">{t.model}</td>
                    <td className="px-4 py-3">${t.inputPricePerMillion.toFixed(2)}</td>
                    <td className="px-4 py-3">${t.outputPricePerMillion.toFixed(2)}</td>
                    <td className="px-4 py-3 text-cyan-300">${(t.cacheReadPricePerMillion || 0).toFixed(3)}</td>
                    <td className="px-4 py-3 text-purple-300">${(t.cacheWritePricePerMillion || 0).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
