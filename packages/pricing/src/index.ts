import { PricingTier } from '../../event-schema/src/index.js';

export interface TokenCounts {
  inputTokens?: number;
  outputTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
  totalTokens?: number;
}

export interface CalculatedCost {
  input: number;
  output: number;
  cache: number;
  total: number;
  currency: string;
}

/**
 * Standard Price Catalog (USD per 1 Million Tokens)
 */
export const DEFAULT_PRICING_CATALOG: PricingTier[] = [
  // Anthropic Models
  {
    provider: 'anthropic',
    model: 'claude-3-7-sonnet',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    currency: 'USD',
    effectiveDate: '2025-01-01T00:00:00Z',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 0.3,
    cacheWritePricePerMillion: 3.75,
    currency: 'USD',
    effectiveDate: '2024-06-20T00:00:00Z',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-5-haiku',
    inputPricePerMillion: 0.8,
    outputPricePerMillion: 4.0,
    cacheReadPricePerMillion: 0.08,
    cacheWritePricePerMillion: 1.0,
    currency: 'USD',
    effectiveDate: '2024-10-01T00:00:00Z',
  },
  {
    provider: 'anthropic',
    model: 'claude-3-opus',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 75.0,
    cacheReadPricePerMillion: 1.5,
    cacheWritePricePerMillion: 18.75,
    currency: 'USD',
    effectiveDate: '2024-03-01T00:00:00Z',
  },
  // OpenAI Models
  {
    provider: 'openai',
    model: 'gpt-4o',
    inputPricePerMillion: 2.5,
    outputPricePerMillion: 10.0,
    cacheReadPricePerMillion: 1.25,
    cacheWritePricePerMillion: 2.5,
    currency: 'USD',
    effectiveDate: '2024-05-13T00:00:00Z',
  },
  {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.6,
    cacheReadPricePerMillion: 0.075,
    cacheWritePricePerMillion: 0.15,
    currency: 'USD',
    effectiveDate: '2024-07-18T00:00:00Z',
  },
  {
    provider: 'openai',
    model: 'o1',
    inputPricePerMillion: 15.0,
    outputPricePerMillion: 60.0,
    cacheReadPricePerMillion: 7.5,
    cacheWritePricePerMillion: 15.0,
    currency: 'USD',
    effectiveDate: '2024-09-12T00:00:00Z',
  },
  {
    provider: 'openai',
    model: 'o3-mini',
    inputPricePerMillion: 1.1,
    outputPricePerMillion: 4.4,
    cacheReadPricePerMillion: 0.55,
    cacheWritePricePerMillion: 1.1,
    currency: 'USD',
    effectiveDate: '2025-01-31T00:00:00Z',
  },
  {
    provider: 'openai',
    model: 'codex',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 8.0,
    cacheReadPricePerMillion: 1.0,
    cacheWritePricePerMillion: 2.0,
    currency: 'USD',
    effectiveDate: '2023-01-01T00:00:00Z',
  },
  // Google Gemini Models
  {
    provider: 'google',
    model: 'gemini-2.5-pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.0,
    cacheReadPricePerMillion: 0.3125,
    cacheWritePricePerMillion: 1.25,
    currency: 'USD',
    effectiveDate: '2025-01-01T00:00:00Z',
  },
  {
    provider: 'google',
    model: 'gemini-2.0-flash',
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.4,
    cacheReadPricePerMillion: 0.025,
    cacheWritePricePerMillion: 0.1,
    currency: 'USD',
    effectiveDate: '2024-12-11T00:00:00Z',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.0,
    cacheReadPricePerMillion: 0.3125,
    cacheWritePricePerMillion: 1.25,
    currency: 'USD',
    effectiveDate: '2024-04-09T00:00:00Z',
  },
  {
    provider: 'google',
    model: 'gemini-1.5-flash',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.3,
    cacheReadPricePerMillion: 0.01875,
    cacheWritePricePerMillion: 0.075,
    currency: 'USD',
    effectiveDate: '2024-05-14T00:00:00Z',
  },
  // xAI Grok Models
  {
    provider: 'xai',
    model: 'grok-2',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 10.0,
    cacheReadPricePerMillion: 1.0,
    cacheWritePricePerMillion: 2.0,
    currency: 'USD',
    effectiveDate: '2024-08-01T00:00:00Z',
  },
  {
    provider: 'xai',
    model: 'grok-3',
    inputPricePerMillion: 3.0,
    outputPricePerMillion: 15.0,
    cacheReadPricePerMillion: 1.5,
    cacheWritePricePerMillion: 3.0,
    currency: 'USD',
    effectiveDate: '2025-02-01T00:00:00Z',
  },
  // GitHub Copilot / Default Generic
  {
    provider: 'github',
    model: 'copilot-chat',
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 8.0,
    cacheReadPricePerMillion: 0.5,
    cacheWritePricePerMillion: 2.0,
    currency: 'USD',
    effectiveDate: '2024-01-01T00:00:00Z',
  },
];

export class CostEngine {
  private tiers: Map<string, PricingTier> = new Map();

  constructor(customTiers: PricingTier[] = DEFAULT_PRICING_CATALOG) {
    this.loadTiers(customTiers);
  }

  public loadTiers(tiers: PricingTier[]): void {
    for (const tier of tiers) {
      const key = this.normalizeKey(tier.provider, tier.model);
      this.tiers.set(key, tier);
    }
  }

  private normalizeKey(provider: string, model: string): string {
    const p = provider.toLowerCase().trim();
    const m = model.toLowerCase().replace(/^(models\/|claude-3-|gpt-)/, '').trim();
    return `${p}:${m}`;
  }

  public findTier(provider: string, model: string): PricingTier | undefined {
    const directKey = this.normalizeKey(provider, model);
    if (this.tiers.has(directKey)) {
      return this.tiers.get(directKey);
    }

    // Fuzzy matching
    const p = provider.toLowerCase();
    const m = model.toLowerCase();

    for (const [key, tier] of this.tiers.entries()) {
      if (key.includes(p) && (key.includes(m) || m.includes(tier.model.toLowerCase()))) {
        return tier;
      }
    }

    // Fallback based on provider
    if (p.includes('anthropic') || m.includes('sonnet') || m.includes('claude')) {
      return this.tiers.get('anthropic:sonnet') || this.tiers.get('anthropic:3-7-sonnet') || DEFAULT_PRICING_CATALOG[0];
    }
    if (p.includes('openai') || m.includes('gpt')) {
      return this.tiers.get('openai:4o') || DEFAULT_PRICING_CATALOG[4];
    }
    if (p.includes('google') || m.includes('gemini')) {
      return this.tiers.get('google:gemini-2.0-flash') || DEFAULT_PRICING_CATALOG[10];
    }
    if (p.includes('xai') || m.includes('grok')) {
      return this.tiers.get('xai:grok-2') || DEFAULT_PRICING_CATALOG[13];
    }

    // Generic fallback
    return {
      provider,
      model,
      inputPricePerMillion: 2.0,
      outputPricePerMillion: 8.0,
      cacheReadPricePerMillion: 0.5,
      cacheWritePricePerMillion: 2.0,
      currency: 'USD',
      effectiveDate: new Date().toISOString(),
    };
  }

  public calculateCost(provider: string, model: string, usage: TokenCounts): CalculatedCost {
    const tier = this.findTier(provider, model);
    const inputTokens = usage.inputTokens || 0;
    const outputTokens = (usage.outputTokens || 0) + (usage.reasoningTokens || 0);
    const cacheReadTokens = usage.cacheReadTokens || 0;
    const cacheWriteTokens = usage.cacheWriteTokens || 0;

    const inputRate = (tier?.inputPricePerMillion ?? 2.0) / 1_000_000;
    const outputRate = (tier?.outputPricePerMillion ?? 8.0) / 1_000_000;
    const cacheReadRate = (tier?.cacheReadPricePerMillion ?? 0.5) / 1_000_000;
    const cacheWriteRate = (tier?.cacheWritePricePerMillion ?? 2.0) / 1_000_000;

    const inputCost = inputTokens * inputRate;
    const outputCost = outputTokens * outputRate;
    const cacheCost = cacheReadTokens * cacheReadRate + cacheWriteTokens * cacheWriteRate;
    const totalCost = inputCost + outputCost + cacheCost;

    return {
      input: Number(inputCost.toFixed(6)),
      output: Number(outputCost.toFixed(6)),
      cache: Number(cacheCost.toFixed(6)),
      total: Number(totalCost.toFixed(6)),
      currency: tier?.currency || 'USD',
    };
  }
}

export const defaultCostEngine = new CostEngine();
