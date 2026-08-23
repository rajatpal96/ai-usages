---
name: tokentrail
description: "Monitor and query AI token usage, session costs, agent timelines, and model analytics with TokenTrail. ACTIVATE this skill when the user asks about AI costs, token consumption, agent observability, MCP server status, or session statistics."
---

# TokenTrail Observability & Token Intelligence

TokenTrail is an AI Agent Usage & Observability platform providing real-time telemetry, token analytics, and cost intelligence across Claude Code, GitHub Copilot, Google Gemini / Antigravity, OpenAI Codex, and Grok.

## Available Tools & MCP Integration

When the `tokentrail` MCP server is active, you have access to tools for:
- `get_metrics_overview`: High-level aggregate metrics across all agents and models.
- `get_agent_usage`: Usage, cost breakdown, and active sessions by agent name.
- `get_model_analytics`: Model performance, token consumption, and input/output cache ratios.
- `get_session_timeline`: Trace events and tool execution history for a given session ID.
- `get_pricing_catalog`: Live pricing calculation per million tokens.
- `check_budget_status`: Evaluate current spending against configured workspace budget limits.

## CLI Commands Reference

- **Login**: `npx @rajatpal96/tokentrail login` (Opens browser loopback OAuth to link credentials)
- **Connect Agent**: `npx @rajatpal96/tokentrail connect <claude|copilot|antigravity|codex>`
- **Health Check**: `npx @rajatpal96/tokentrail doctor`
- **Connected Status**: `npx @rajatpal96/tokentrail status`
