import { describe, expect, it } from 'vitest';
import { DEFAULT_MODEL_PRICING, PricingRegistry, normalizePricingKey } from '../src/pricing.js';

describe('PricingRegistry', () => {
  it('loads built-in default models', () => {
    const registry = new PricingRegistry();
    expect(registry.has('openai', 'gpt-4o')).toBe(true);
    expect(registry.has('anthropic', 'claude-3-5-sonnet')).toBe(true);
    expect(registry.has('google', 'gemini-1.5-pro')).toBe(true);
  });

  it('normalizes pricing keys properly', () => {
    expect(normalizePricingKey('OpenAI', 'GPT-4o')).toBe('openai:gpt-4o');
    expect(normalizePricingKey('openai', 'openai/gpt-4o')).toBe('openai:gpt-4o');
    expect(normalizePricingKey('openai', 'openai:gpt-4o')).toBe('openai:gpt-4o');
  });

  it('calculates cost accurately with standard input and output tokens', () => {
    const registry = new PricingRegistry();
    const result = registry.calculateCost({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100_000,
      outputTokens: 50_000
    });

    expect(result.status).toBe('calculated');
    expect(result.currency).toBe('USD');
    expect(result.cost).toBe(0.75);
    expect(result.breakdown?.inputCost).toBe(0.25);
    expect(result.breakdown?.outputCost).toBe(0.50);
  });

  it('correctly accounts for cached tokens without double counting (OpenAI convention)', () => {
    const registry = new PricingRegistry();
    const result = registry.calculateCost({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 100_000,
      outputTokens: 10_000,
      cachedTokens: 40_000,
      cachedTokensIncludedInInput: true
    });

    expect(result.status).toBe('calculated');
    expect(result.cost).toBe(0.3);
    expect(result.breakdown?.inputCost).toBe(0.15);
    expect(result.breakdown?.cachedInputCost).toBe(0.05);
    expect(result.breakdown?.outputCost).toBe(0.10);
  });

  it('correctly calculates cached tokens when not included in inputTokens (Anthropic convention)', () => {
    const registry = new PricingRegistry();
    const result = registry.calculateCost({
      provider: 'anthropic',
      model: 'claude-3-5-sonnet',
      inputTokens: 10_000,
      cachedTokens: 100_000,
      outputTokens: 2_000,
      cachedTokensIncludedInInput: false
    });

    expect(result.status).toBe('calculated');
    expect(result.cost).toBe(0.09);
    expect(result.breakdown?.inputCost).toBe(0.03);
    expect(result.breakdown?.cachedInputCost).toBe(0.03);
    expect(result.breakdown?.outputCost).toBe(0.03);
  });

  it('returns status unavailable and cost null for unknown models without inventing prices', () => {
    const registry = new PricingRegistry();
    const result = registry.calculateCost({
      provider: 'custom-provider',
      model: 'unknown-mystery-model-9000',
      inputTokens: 1000,
      outputTokens: 1000
    });

    expect(result.status).toBe('unavailable');
    expect(result.cost).toBeNull();
    expect(result.breakdown).toBeUndefined();
  });

  it('allows registering and overriding custom model pricing', () => {
    const registry = new PricingRegistry();
    registry.register('custom-provider', 'my-custom-model', {
      inputPricePerMillion: 1.0,
      outputPricePerMillion: 2.0,
      currency: 'EUR'
    });

    expect(registry.has('custom-provider', 'my-custom-model')).toBe(true);

    const result = registry.calculateCost({
      provider: 'custom-provider',
      model: 'my-custom-model',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000
    });

    expect(result.status).toBe('calculated');
    expect(result.cost).toBe(3.0);
    expect(result.currency).toBe('EUR');
  });

  it('resolves date-versioned snapshots to base model pricing when exact match is absent', () => {
    const registry = new PricingRegistry();
    const result = registry.calculateCost({
      provider: 'openai',
      model: 'gpt-4o-2024-11-20',
      inputTokens: 100_000,
      outputTokens: 50_000
    });

    expect(result.status).toBe('calculated');
    expect(result.cost).toBe(0.75);
  });
});
