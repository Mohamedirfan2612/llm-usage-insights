import fs from 'node:fs';
import path from 'node:path';
import type { CostCalculationResult, ModelPricing, PricingRegistryConfig } from './types.js';

/**
 * Built-in default model pricing table.
 * Embedded directly to ensure zero-IO availability across all bundlers / runtimes.
 */
export const DEFAULT_MODEL_PRICING: Record<string, ModelPricing> = {
  // OpenAI Models
  'openai:gpt-4o': {
    provider: 'openai',
    model: 'gpt-4o',
    inputPricePerMillion: 2.50,
    outputPricePerMillion: 10.00,
    cachedInputPricePerMillion: 1.25,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:gpt-4o-mini': {
    provider: 'openai',
    model: 'gpt-4o-mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    cachedInputPricePerMillion: 0.075,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:gpt-4.1-mini': {
    provider: 'openai',
    model: 'gpt-4.1-mini',
    inputPricePerMillion: 0.40,
    outputPricePerMillion: 1.60,
    cachedInputPricePerMillion: 0.20,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:gpt-4.1': {
    provider: 'openai',
    model: 'gpt-4.1',
    inputPricePerMillion: 2.00,
    outputPricePerMillion: 8.00,
    cachedInputPricePerMillion: 1.00,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:o1': {
    provider: 'openai',
    model: 'o1',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 60.00,
    cachedInputPricePerMillion: 7.50,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:o1-mini': {
    provider: 'openai',
    model: 'o1-mini',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 12.00,
    cachedInputPricePerMillion: 1.50,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:o3-mini': {
    provider: 'openai',
    model: 'o3-mini',
    inputPricePerMillion: 1.10,
    outputPricePerMillion: 4.40,
    cachedInputPricePerMillion: 0.55,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:gpt-4-turbo': {
    provider: 'openai',
    model: 'gpt-4-turbo',
    inputPricePerMillion: 10.00,
    outputPricePerMillion: 30.00,
    cachedInputPricePerMillion: 5.00,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:gpt-3.5-turbo': {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    inputPricePerMillion: 0.50,
    outputPricePerMillion: 1.50,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:text-embedding-3-small': {
    provider: 'openai',
    model: 'text-embedding-3-small',
    inputPricePerMillion: 0.02,
    outputPricePerMillion: 0.00,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },
  'openai:text-embedding-3-large': {
    provider: 'openai',
    model: 'text-embedding-3-large',
    inputPricePerMillion: 0.13,
    outputPricePerMillion: 0.00,
    currency: 'USD',
    source: 'https://openai.com/api/pricing/',
    updatedAt: '2026-10-01'
  },

  // Anthropic Models
  'anthropic:claude-3-5-sonnet': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    cachedInputPricePerMillion: 0.30,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-5-sonnet-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
    cachedInputPricePerMillion: 0.30,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-5-haiku': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku',
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 5.00,
    cachedInputPricePerMillion: 0.10,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-5-haiku-20241022': {
    provider: 'anthropic',
    model: 'claude-3-5-haiku-20241022',
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 5.00,
    cachedInputPricePerMillion: 0.10,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-opus': {
    provider: 'anthropic',
    model: 'claude-3-opus',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    cachedInputPricePerMillion: 1.50,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-opus-20240229': {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
    cachedInputPricePerMillion: 1.50,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-haiku': {
    provider: 'anthropic',
    model: 'claude-3-haiku',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    cachedInputPricePerMillion: 0.03,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },
  'anthropic:claude-3-haiku-20240307': {
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    cachedInputPricePerMillion: 0.03,
    currency: 'USD',
    source: 'https://docs.anthropic.com/en/docs/pricing',
    updatedAt: '2026-10-01'
  },

  // Google Models
  'google:gemini-1.5-pro': {
    provider: 'google',
    model: 'gemini-1.5-pro',
    inputPricePerMillion: 1.25,
    outputPricePerMillion: 5.00,
    cachedInputPricePerMillion: 0.3125,
    currency: 'USD',
    source: 'https://ai.google.dev/pricing',
    updatedAt: '2026-10-01'
  },
  'google:gemini-1.5-flash': {
    provider: 'google',
    model: 'gemini-1.5-flash',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    cachedInputPricePerMillion: 0.01875,
    currency: 'USD',
    source: 'https://ai.google.dev/pricing',
    updatedAt: '2026-10-01'
  },
  'google:gemini-2.0-flash': {
    provider: 'google',
    model: 'gemini-2.0-flash',
    inputPricePerMillion: 0.10,
    outputPricePerMillion: 0.40,
    cachedInputPricePerMillion: 0.025,
    currency: 'USD',
    source: 'https://ai.google.dev/pricing',
    updatedAt: '2026-10-01'
  },

  // DeepSeek Models
  'deepseek:deepseek-chat': {
    provider: 'deepseek',
    model: 'deepseek-chat',
    inputPricePerMillion: 0.14,
    outputPricePerMillion: 0.28,
    cachedInputPricePerMillion: 0.014,
    currency: 'USD',
    source: 'https://platform.deepseek.com/pricing',
    updatedAt: '2026-10-01'
  },
  'deepseek:deepseek-reasoner': {
    provider: 'deepseek',
    model: 'deepseek-reasoner',
    inputPricePerMillion: 0.55,
    outputPricePerMillion: 2.19,
    cachedInputPricePerMillion: 0.14,
    currency: 'USD',
    source: 'https://platform.deepseek.com/pricing',
    updatedAt: '2026-10-01'
  }
};

/**
 * Normalizes model and provider keys into a canonical format: "provider:model"
 */
export function normalizePricingKey(provider: string, model: string): string {
  const normProvider = provider.trim().toLowerCase();
  let normModel = model.trim().toLowerCase();

  // If model already contains provider prefix like "openai/gpt-4o", strip prefix
  if (normModel.startsWith(`${normProvider}/`) || normModel.startsWith(`${normProvider}:`)) {
    normModel = normModel.slice(normProvider.length + 1);
  }

  return `${normProvider}:${normModel}`;
}

/**
 * Registry managing LLM pricing configurations and calculating exact costs.
 */
export class PricingRegistry {
  private readonly prices = new Map<string, ModelPricing>();
  private defaultCurrency = 'USD';

  constructor(initialPricing?: Record<string, ModelPricing> | PricingRegistryConfig) {
    // 1. Seed with built-in default prices
    for (const [key, value] of Object.entries(DEFAULT_MODEL_PRICING)) {
      this.prices.set(key.toLowerCase(), { ...value });
    }

    // 2. Load custom pricing if provided
    if (initialPricing) {
      this.loadConfig(initialPricing);
    }
  }

  /**
   * Set default fallback currency.
   */
  public setDefaultCurrency(currency: string): void {
    this.defaultCurrency = currency.toUpperCase();
  }

  /**
   * Get default currency.
   */
  public getDefaultCurrency(): string {
    return this.defaultCurrency;
  }

  /**
   * Register or override pricing for a model.
   */
  public register(keyOrProvider: string, pricingOrModel: string | ModelPricing, pricing?: ModelPricing): void {
    if (typeof pricingOrModel === 'string' && pricing) {
      // Called as: register('openai', 'gpt-4o', { inputPricePerMillion: 2.5, ... })
      const key = normalizePricingKey(keyOrProvider, pricingOrModel);
      this.prices.set(key, {
        provider: keyOrProvider.toLowerCase(),
        model: pricingOrModel.toLowerCase(),
        ...pricing
      });
    } else if (typeof pricingOrModel === 'object') {
      // Called as: register('openai:gpt-4o', { inputPricePerMillion: 2.5, ... })
      const rawKey = keyOrProvider.trim().toLowerCase();
      let key = rawKey;
      if (!key.includes(':') && pricingOrModel.provider) {
        key = normalizePricingKey(pricingOrModel.provider, rawKey);
      }
      this.prices.set(key, { ...pricingOrModel });
    }
  }

  /**
   * Check if pricing is registered for the specified provider and model.
   */
  public has(provider: string, model: string): boolean {
    return this.get(provider, model) !== undefined;
  }

  /**
   * Get pricing for the specified provider and model.
   * Supports smart fuzzy matching on date versions if exact match is not found.
   */
  public get(provider: string, model: string): ModelPricing | undefined {
    const key = normalizePricingKey(provider, model);
    if (this.prices.has(key)) {
      return this.prices.get(key);
    }

    // Direct lookup without provider prefix if user registered bare model
    const bareModel = model.trim().toLowerCase();
    if (this.prices.has(bareModel)) {
      return this.prices.get(bareModel);
    }

    // Attempt date-snapshot fallback: e.g. "gpt-4o-2024-08-06" -> "gpt-4o"
    const snapshotRegex = /^([a-zA-Z0-9.-]+)-(\d{4}[-_]?\d{2}[-_]?\d{2})$/;
    const match = bareModel.match(snapshotRegex);
    if (match && match[1]) {
      const baseKey = normalizePricingKey(provider, match[1]);
      if (this.prices.has(baseKey)) {
        return this.prices.get(baseKey);
      }
    }

    return undefined;
  }

  /**
   * Load pricing from a configuration object or dictionary.
   */
  public loadConfig(config: Record<string, ModelPricing> | PricingRegistryConfig): void {
    const isRegistryConfig = 'models' in config && typeof config.models === 'object';
    if (isRegistryConfig) {
      const reg = config as PricingRegistryConfig;
      if (typeof reg.defaultCurrency === 'string') {
        this.defaultCurrency = reg.defaultCurrency.toUpperCase();
      }
      if (reg.models) {
        for (const [key, value] of Object.entries(reg.models)) {
          this.register(key, value);
        }
      }
    } else {
      for (const [key, value] of Object.entries(config as Record<string, ModelPricing>)) {
        this.register(key, value);
      }
    }
  }

  /**
   * Load pricing from a JSON file.
   */
  public loadFromFile(filePath: string): void {
    const resolvedPath = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    const content = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(content);
    this.loadConfig(parsed);
  }

  /**
   * Calculate cost for the given usage.
   * Returns status: 'unavailable' and cost: null if pricing is missing.
   * Never invents a price silently.
   */
  public calculateCost(params: {
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
    cachedTokensIncludedInInput?: boolean;
  }): CostCalculationResult {
    const { provider, model, inputTokens, outputTokens, cachedTokens = 0, cachedTokensIncludedInInput = true } = params;

    const pricing = this.get(provider, model);
    if (!pricing) {
      return {
        cost: null,
        currency: this.defaultCurrency,
        status: 'unavailable'
      };
    }

    const currency = pricing.currency || this.defaultCurrency;
    const cachedPrice = pricing.cachedInputPricePerMillion ?? pricing.inputPricePerMillion;

    let nonCachedInputTokens = inputTokens;
    let actualCachedTokens = cachedTokens;

    if (cachedTokensIncludedInInput) {
      // OpenAI convention: prompt_tokens already includes cached_tokens
      nonCachedInputTokens = Math.max(0, inputTokens - cachedTokens);
    }

    const inputCost = (nonCachedInputTokens / 1_000_000) * pricing.inputPricePerMillion;
    const cachedInputCost = (actualCachedTokens / 1_000_000) * cachedPrice;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPricePerMillion;

    const rawTotalCost = inputCost + cachedInputCost + outputCost;
    // Round to 8 decimal places to eliminate floating point imprecision while preserving micro-cent accuracy
    const totalCost = Number(rawTotalCost.toFixed(8));

    return {
      cost: totalCost,
      currency,
      status: 'calculated',
      breakdown: {
        inputCost: Number(inputCost.toFixed(8)),
        outputCost: Number(outputCost.toFixed(8)),
        cachedInputCost: Number(cachedInputCost.toFixed(8))
      }
    };
  }

  /**
   * Export all currently registered pricing entries.
   */
  public getAll(): Record<string, ModelPricing> {
    const result: Record<string, ModelPricing> = {};
    for (const [k, v] of this.prices.entries()) {
      result[k] = { ...v };
    }
    return result;
  }
}
