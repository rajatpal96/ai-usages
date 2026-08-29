export interface TimeRangeFilter {
  start: Date;
  end: Date;
  rangeKey: '24h' | '7d' | '30d' | '90d' | 'custom';
}

export function parseTimeRange(range?: string): TimeRangeFilter {
  const end = new Date();
  const start = new Date();

  switch (range) {
    case '24h':
    case '1d':
      start.setHours(start.getHours() - 24);
      return { start, end, rangeKey: '24h' };
    case '7d':
      start.setDate(start.getDate() - 7);
      return { start, end, rangeKey: '7d' };
    case '90d':
      start.setDate(start.getDate() - 90);
      return { start, end, rangeKey: '90d' };
    case '30d':
    default:
      start.setDate(start.getDate() - 30);
      return { start, end, rangeKey: '30d' };
  }
}

export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

export function sanitizeMetadata(metadata?: Record<string, unknown>, privacyLevel: number = 1): Record<string, unknown> | undefined {
  if (!metadata) return undefined;
  if (privacyLevel === 1) {
    // Level 1: Standard metadata - preserves session intent, prompt snippets, tools, and action summaries while stripping raw secrets/apiKeys
    const safe: Record<string, unknown> = {};
    const safeKeys = [
      'task_id', 'agent_version', 'cli_version', 'tool', 'tools', 'toolCount', 'mode', 'platform', 'os', 'branch',
      'userPrompt', 'prompt', 'promptSnippet', 'actionSummary', 'summary', 'taskDescription', 'sessionGoal',
      'stepType', 'stepIndex', 'thinkingSnippet', 'turnId', 'status'
    ];
    for (const key of Object.keys(metadata)) {
      if (safeKeys.includes(key) || key.endsWith('_count') || key.endsWith('_id') || key.endsWith('_type')) {
        safe[key] = metadata[key];
      }
    }
    delete safe.secret;
    delete safe.apiKey;
    delete safe.password;
    return safe;
  }
  if (privacyLevel === 2) {
    // Level 2: Standard metadata without raw code or secret keys
    const safe = { ...metadata };
    delete safe.secret;
    delete safe.apiKey;
    delete safe.password;
    return safe;
  }
  // Level 3: Full (Explicit opt-in)
  return metadata;
}
