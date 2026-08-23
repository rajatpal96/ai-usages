'use client';

import React, { useState } from 'react';
import { Shield, Mail, Lock, Sparkles, CheckCircle2, X, Github, Chrome } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (profile: any, token: string) => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'sso' | 'email'>('sso');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSsoLogin = async (provider: 'google' | 'github' | 'microsoft' | 'saml_sso') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/auth/sso/${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `alex.${provider}@acme.com`,
          name: `Alex (${provider.toUpperCase()})`,
        }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('agentmeter_token', data.token);
        localStorage.setItem('agentmeter_user', JSON.stringify(data.profile));
        onSuccess(data.profile, data.token);
        onClose();
      } else {
        setError(data.error || 'SSO Authentication failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok && data.token) {
        localStorage.setItem('agentmeter_token', data.token);
        localStorage.setItem('agentmeter_user', JSON.stringify(data.profile));
        onSuccess(data.profile, data.token);
        onClose();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">AgentMeter Identity Layer</h3>
              <p className="text-xs text-slate-400">Enterprise SSO & Multi-Tenant Login</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
            {error}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('sso')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'sso' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Identity Providers (SSO)
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex-1 py-1.5 rounded-lg transition-all ${
              activeTab === 'email' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'
            }`}
          >
            Email / Password
          </button>
        </div>

        {activeTab === 'sso' ? (
          <div className="space-y-3">
            <button
              onClick={() => handleSsoLogin('google')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-xs font-semibold text-slate-200 transition-all group"
            >
              <Chrome className="w-4 h-4 text-rose-400" />
              <span>Continue with Google Workspace</span>
            </button>

            <button
              onClick={() => handleSsoLogin('github')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-xs font-semibold text-slate-200 transition-all group"
            >
              <Github className="w-4 h-4 text-slate-100" />
              <span>Continue with GitHub Enterprise</span>
            </button>

            <button
              onClick={() => handleSsoLogin('microsoft')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-xs font-semibold text-slate-200 transition-all group"
            >
              <span className="w-4 h-4 text-cyan-400 font-bold font-mono">⊞</span>
              <span>Continue with Microsoft Azure AD</span>
            </button>

            <button
              onClick={() => handleSsoLogin('saml_sso')}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/40 border border-indigo-500/30 text-xs font-semibold text-indigo-300 transition-all group"
            >
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>Enterprise SAML 2.0 / OIDC SSO</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-1 block">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-medium text-slate-400 mb-1 block">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all"
            >
              {loading ? 'Signing in...' : 'Sign In with Email'}
            </button>
          </form>
        )}

        <div className="text-[11px] text-slate-500 text-center border-t border-slate-800/60 pt-3">
          Protected by AgentMeter Enterprise Identity & Authorization Layer
        </div>
      </div>
    </div>
  );
}
