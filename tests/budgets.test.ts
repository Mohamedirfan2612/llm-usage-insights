import { describe, expect, it, vi } from 'vitest';
import { BudgetManager, getPeriodBounds } from '../src/budgets.js';
import { MemoryStore } from '../src/storage/memory-store.js';
import type { BudgetAlert, UsageRecord } from '../src/types.js';

describe('BudgetManager', () => {
  const sampleRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
    id: 'rec-' + Math.random(),
    provider: 'openai',
    model: 'gpt-4o',
    userId: 'user_123',
    feature: 'chatbot',
    timestamp: new Date(),
    inputTokens: 1000,
    outputTokens: 500,
    cachedTokens: 0,
    totalTokens: 1500,
    estimatedCost: 1.0,
    currency: 'USD',
    costStatus: 'calculated',
    status: 'success',
    isEstimatedTokens: false,
    ...overrides
  });

  it('correctly calculates period boundaries', () => {
    const ref = new Date('2026-10-15T15:30:00Z');
    const daily = getPeriodBounds('daily', ref);
    expect(daily.start.toISOString()).toBe('2026-10-15T00:00:00.000Z');
    expect(daily.end.toISOString()).toBe('2026-10-15T23:59:59.999Z');

    const monthly = getPeriodBounds('monthly', ref);
    expect(monthly.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(monthly.end.toISOString()).toBe('2026-10-31T23:59:59.999Z');
  });

  it('evaluates budget status and triggers warning alerts at threshold', () => {
    const onWarning = vi.fn();
    const onExceeded = vi.fn();

    const manager = new BudgetManager({
      userBudgets: {
        user_123: { limit: 10.0, warningThreshold: 0.8 } // warning at $8.00
      },
      onWarning,
      onExceeded
    });

    const store = new MemoryStore();
    // Record $7.50 spend - below 80%
    store.record(sampleRecord({ estimatedCost: 7.5 }));

    const check1 = manager.check(store, { userId: 'user_123', estimatedCost: 0 });
    expect(check1.allowed).toBe(true);
    expect(check1.userBudget?.isWarning).toBe(false);
    expect(check1.userBudget?.isExceeded).toBe(false);
    expect(onWarning).not.toHaveBeenCalled();

    // Now record another $1.00 => $8.50 (85%)
    store.record(sampleRecord({ estimatedCost: 1.0 }));
    const check2 = manager.check(store, { userId: 'user_123' });
    expect(check2.allowed).toBe(true);
    expect(check2.userBudget?.isWarning).toBe(true);
    expect(check2.userBudget?.isExceeded).toBe(false);
    expect(onWarning).toHaveBeenCalledTimes(1);
    expect(onExceeded).not.toHaveBeenCalled();
  });

  it('evaluates exceeded budget status and reports allowed: false', () => {
    const onExceeded = vi.fn();
    const manager = new BudgetManager({
      featureBudgets: {
        summarizer: { limit: 5.0 }
      },
      onExceeded
    });

    const store = new MemoryStore();
    store.record(sampleRecord({ feature: 'summarizer', estimatedCost: 4.0 }));
    store.record(sampleRecord({ feature: 'summarizer', estimatedCost: 1.5 })); // total $5.50

    const check = manager.check(store, { feature: 'summarizer' });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Feature budget exceeded');
    expect(check.featureBudget?.isExceeded).toBe(true);
    expect(check.featureBudget?.currentSpend).toBe(5.5);
    expect(onExceeded).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'exceeded',
        scope: 'feature',
        targetId: 'summarizer'
      })
    );
  });

  it('enforces global application budgets', () => {
    const manager = new BudgetManager({
      globalBudget: { limit: 20.0 }
    });

    const store = new MemoryStore();
    store.record(sampleRecord({ userId: 'u1', estimatedCost: 12.0 }));
    store.record(sampleRecord({ userId: 'u2', estimatedCost: 9.0 })); // total $21.0

    const check = manager.check(store, {});
    expect(check.allowed).toBe(false);
    expect(check.globalBudget?.isExceeded).toBe(true);
    expect(check.globalBudget?.currentSpend).toBe(21.0);
    expect(check.reason).toContain('Global application budget exceeded');
  });
});
