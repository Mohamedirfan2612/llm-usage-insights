import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryStore, normalizeDateBoundary } from '../src/storage/memory-store.js';
import type { UsageRecord } from '../src/types.js';

describe('MemoryStore', () => {
  let store: MemoryStore;

  const sampleRecord = (overrides: Partial<UsageRecord> = {}): UsageRecord => ({
    id: 'test-id-' + Math.random(),
    provider: 'openai',
    model: 'gpt-4o',
    userId: 'user_1',
    feature: 'search',
    timestamp: new Date('2026-10-10T12:00:00Z'),
    inputTokens: 100,
    outputTokens: 50,
    cachedTokens: 0,
    totalTokens: 150,
    estimatedCost: 0.001,
    currency: 'USD',
    costStatus: 'calculated',
    status: 'success',
    isEstimatedTokens: false,
    ...overrides
  });

  beforeEach(() => {
    store = new MemoryStore();
  });

  it('stores and retrieves records', () => {
    store.record(sampleRecord({ model: 'gpt-4o' }));
    store.record(sampleRecord({ model: 'gpt-4o-mini' }));

    expect(store.count()).toBe(2);
    expect(store.getRecords()).toHaveLength(2);
  });

  it('filters by provider and model (case-insensitive)', () => {
    store.record(sampleRecord({ provider: 'OpenAI', model: 'GPT-4o' }));
    store.record(sampleRecord({ provider: 'Anthropic', model: 'claude-3-5-sonnet' }));

    const openAiRecords = store.getRecords({ provider: 'openai' });
    expect(openAiRecords).toHaveLength(1);
    expect(openAiRecords[0]?.model).toBe('GPT-4o');

    const claudeRecords = store.getRecords({ model: 'CLAUDE-3-5-SONNET' });
    expect(claudeRecords).toHaveLength(1);
  });

  it('filters by userId and feature', () => {
    store.record(sampleRecord({ userId: 'alice', feature: 'chat' }));
    store.record(sampleRecord({ userId: 'bob', feature: 'chat' }));
    store.record(sampleRecord({ userId: 'alice', feature: 'summarize' }));

    expect(store.getRecords({ userId: 'alice' })).toHaveLength(2);
    expect(store.getRecords({ feature: 'chat' })).toHaveLength(2);
    expect(store.getRecords({ userId: 'alice', feature: 'summarize' })).toHaveLength(1);
  });

  it('filters by date boundaries inclusive and exclusive', () => {
    store.record(sampleRecord({ timestamp: new Date('2026-10-01T10:00:00Z') }));
    store.record(sampleRecord({ timestamp: new Date('2026-10-05T10:00:00Z') }));
    store.record(sampleRecord({ timestamp: new Date('2026-10-10T10:00:00Z') }));

    const midRecords = store.getRecords({
      from: new Date('2026-10-02T00:00:00Z'),
      to: new Date('2026-10-08T00:00:00Z')
    });
    expect(midRecords).toHaveLength(1);

    // Inclusive vs exclusive test
    const exactToInclusive = store.getRecords({
      to: new Date('2026-10-05T10:00:00Z'),
      inclusiveEndDate: true
    });
    expect(exactToInclusive).toHaveLength(2);

    const exactToExclusive = store.getRecords({
      to: new Date('2026-10-05T10:00:00Z'),
      inclusiveEndDate: false
    });
    expect(exactToExclusive).toHaveLength(1);
  });

  it('clears records completely', () => {
    store.record(sampleRecord());
    expect(store.count()).toBe(1);
    store.clear();
    expect(store.count()).toBe(0);
    expect(store.getRecords()).toEqual([]);
  });

  it('normalizes date string boundaries properly', () => {
    const startOfDay = normalizeDateBoundary('2026-10-11', false);
    const endOfDay = normalizeDateBoundary('2026-10-11', true);

    expect(startOfDay).toBe(new Date('2026-10-11T00:00:00.000Z').getTime());
    expect(endOfDay).toBe(new Date('2026-10-11T23:59:59.999Z').getTime());
  });
});
