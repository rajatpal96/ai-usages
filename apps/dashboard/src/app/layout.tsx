import './globals.css';
import { Sidebar } from '../components/Sidebar';

export const metadata = {
  title: 'AgentMeter | AI Agent Usage & Observability Platform',
  description: 'Unified AI coding-agent usage, token metrics, cost intelligence, session timelines, and MCP observability across Claude Code, GitHub Copilot, Gemini/Antigravity, Codex, and Grok.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100 antialiased min-h-screen flex selection:bg-indigo-500 selection:text-white">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}
