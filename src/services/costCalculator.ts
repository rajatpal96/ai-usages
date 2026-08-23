export interface Pricing {
  promptPricePer1k: number;
  completionPricePer1k: number;
}

const MODEL_PRICING_MAP: Record<string, Pricing> = {
  // OpenAI
  'gpt-4o': { promptPricePer1k: 0.0025, completionPricePer1k: 0.01 },
  'gpt-4o-mini': { promptPricePer1k: 0.00015, completionPricePer1k: 0.0006 },
  'o1-preview': { promptPricePer1k: 0.015, completionPricePer1k: 0.06 },
  'o3-mini': { promptPricePer1k: 0.0011, completionPricePer1k: 0.0044 },
  
  // Anthropic
  'claude-3-5-sonnet': { promptPricePer1k: 0.003, completionPricePer1k: 0.015 },
  'claude-3-7-sonnet': { promptPricePer1k: 0.003, completionPricePer1k: 0.015 },
  'claude-3-5-haiku': { promptPricePer1k: 0.001, completionPricePer1k: 0.005 },
  'claude-3-opus': { promptPricePer1k: 0.015, completionPricePer1k: 0.075 },

  // Google Gemini
  'gemini-1.5-pro': { promptPricePer1k: 0.00125, completionPricePer1k: 0.005 },
  'gemini-1.5-flash': { promptPricePer1k: 0.000075, completionPricePer1k: 0.0003 },
  'gemini-2.0-flash': { promptPricePer1k: 0.0001, completionPricePer1k: 0.0004 },

  // Default fallback
  'default': { promptPricePer1k: 0.002, completionPricePer1k: 0.008 }
};

export function calculateEstimatedCost(model: string, promptTokens: number, completionTokens: number): number {
  const normalizedModel = Object.keys(MODEL_PRICING_MAP).find(m => model.toLowerCase().includes(m)) || 'default';
  const pricing = MODEL_PRICING_MAP[normalizedModel];

  const promptCost = (promptTokens / 1000) * pricing.promptPricePer1k;
  const completionCost = (completionTokens / 1000) * pricing.completionPricePer1k;

  return parseFloat((promptCost + completionCost).toFixed(6));
}
