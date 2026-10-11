import { describe, expect, it } from 'vitest';
import {
  estimateTokenCount,
  generateAllFeaturesReport,
  generateAllUsersReport,
  generateFeatureReport,
  generateModelReport,
  generateTimeReport,
  generateUserReport
} from '../src/analytics.js';
import type { UsageRecord } from '../src/types.js';

describe('Analytics Engine', () => {
  const createRecord = (overrides: Partial<UsageRecord>): UsageRecord => ({
    id: 'rec-' + Math.random(),
    provider: 'openai',
    model: 'gpt-4o',
    userId: 'user_1',
    feature: 'search',
    timestamp: new Date('2026-10-10T12:00:00Z'),
    inputTokens: 1000,
    outputTokens: 500,
    cachedTokens: 200,
    totalTokens: 1500,
    estimatedCost: 0.05,
    currency: 'USD',
    costStatus: 'calculated',
    status: 'success',
    latencyMs: 320,
    isEstimatedTokens: false,
    ...overrides
  });

  it('generates empty report gracefully without NaN or division by zero', () => {
    const report = generateModelReport([]);
    expect(report.totalRequests).toBe(0);
    expect(report.totalTokens).toBe(0);
    expect(report.totalEstimatedCost).toBe(0);
    expect(report.models).toHaveLength(0);
  });

  it('aggregates model statistics and computes averages and percentages accurately', () => {
    const records: UsageRecord[] = [
      createRecord({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 1000,
        outputTokens: 500,
        cachedTokens: 100,
        totalTokens: 1500,
        estimatedCost: 0.03,
        latencyMs: 300
      }),
      createRecord({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 2000,
        outputTokens: 1000,
        cachedTokens: 200,
        totalTokens: 3000,
        estimatedCost: 0.07,
        latencyMs: 500
      }),
      createRecord({
        provider: 'anthropic',
        model: 'claude-3-5-sonnet',
        inputTokens: 500,
        outputTokens: 500,
        cachedTokens: 0,
        totalTokens: 1000,
        estimatedCost: 0.02,
        latencyMs: 400
      })
    ];

    const report = generateModelReport(records);

    expect(report.totalRequests).toBe(3);
    expect(report.totalTokens).toBe(5500); // 1500 + 3000 + 1000
    expect(report.totalInputTokens).toBe(3500);
    expect(report.totalOutputTokens).toBe(2000);
    expect(report.totalCachedTokens).toBe(300);
    expect(report.totalEstimatedCost).toBe(0.12);

    expect(report.models).toHaveLength(2);

    const gpt4o = report.models.find((m) => m.model === 'gpt-4o')!;
    expect(gpt4o.requests).toBe(2);
    expect(gpt4o.totalTokens).toBe(4500);
    expect(gpt4o.inputTokens).toBe(3000);
    expect(gpt4o.outputTokens).toBe(1500);
    expect(gpt4o.cachedTokens).toBe(300);
    expect(gpt4o.estimatedCost).toBe(0.10);
    expect(gpt4o.averageTokensPerRequest).toBe(2250);
    expect(gpt4o.averageCostPerRequest).toBe(0.05);
    expect(gpt4o.percentageOfTotalTokens).toBe(81.82); // 4500 / 5500 * 100
    expect(gpt4o.percentageOfTotalCost).toBe(83.33); // 0.10 / 0.12 * 100
    expect(gpt4o.averageLatencyMs).toBe(400); // (300 + 500) / 2
  });

  it('supports sorting by different metrics and orders', () => {
    const records: UsageRecord[] = [
      createRecord({ model: 'model-a', inputTokens: 500, outputTokens: 100, totalTokens: 600, estimatedCost: 0.01, latencyMs: 100 }),
      createRecord({ model: 'model-b', inputTokens: 100, outputTokens: 900, totalTokens: 1000, estimatedCost: 0.08, latencyMs: 200 }),
      createRecord({ model: 'model-c', inputTokens: 800, outputTokens: 50, totalTokens: 850, estimatedCost: 0.03, latencyMs: 300 })
    ];

    // Sort by totalTokens desc
    const byTokensDesc = generateModelReport(records, { sortBy: 'totalTokens', order: 'desc' });
    expect(byTokensDesc.models.map((m) => m.model)).toEqual(['model-b', 'model-c', 'model-a']);

    // Sort by inputTokens desc
    const byInputDesc = generateModelReport(records, { sortBy: 'inputTokens', order: 'desc' });
    expect(byInputDesc.models.map((m) => m.model)).toEqual(['model-c', 'model-a', 'model-b']);

    // Sort by estimatedCost desc
    const byCostDesc = generateModelReport(records, { sortBy: 'estimatedCost', order: 'desc' });
    expect(byCostDesc.models.map((m) => m.model)).toEqual(['model-b', 'model-c', 'model-a']);

    // Sort by estimatedCost asc
    const byCostAsc = generateModelReport(records, { sortBy: 'estimatedCost', order: 'asc' });
    expect(byCostAsc.models.map((m) => m.model)).toEqual(['model-a', 'model-c', 'model-b']);
  });

  it('generates user reports with model breakdown', () => {
    const records: UsageRecord[] = [
      createRecord({ userId: 'alice', model: 'gpt-4o', totalTokens: 1000, estimatedCost: 0.01 }),
      createRecord({ userId: 'alice', model: 'gpt-4o-mini', totalTokens: 500, estimatedCost: 0.002 }),
      createRecord({ userId: 'bob', model: 'claude-3-5-sonnet', totalTokens: 2000, estimatedCost: 0.03 })
    ];

    const aliceReport = generateUserReport('alice', records);
    expect(aliceReport.userId).toBe('alice');
    expect(aliceReport.requests).toBe(2);
    expect(aliceReport.totalTokens).toBe(1500);
    expect(aliceReport.estimatedCost).toBe(0.012);
    expect(aliceReport.modelsUsed).toHaveLength(2);

    const allUsers = generateAllUsersReport(records);
    expect(allUsers.totalUsers).toBe(2);
    expect(allUsers.users[0]?.userId).toBe('bob'); // sorted by totalTokens desc (2000 vs 1500)
  });

  it('generates feature reports with model breakdown', () => {
    const records: UsageRecord[] = [
      createRecord({ feature: 'chat', model: 'gpt-4o', totalTokens: 800, estimatedCost: 0.02 }),
      createRecord({ feature: 'chat', model: 'gpt-4o-mini', totalTokens: 400, estimatedCost: 0.001 }),
      createRecord({ feature: 'autocomplete', model: 'gpt-4o-mini', totalTokens: 100, estimatedCost: 0.0005 })
    ];

    const chatReport = generateFeatureReport('chat', records);
    expect(chatReport.feature).toBe('chat');
    expect(chatReport.requests).toBe(2);
    expect(chatReport.totalTokens).toBe(1200);
    expect(chatReport.modelsUsed).toHaveLength(2);

    const allFeatures = generateAllFeaturesReport(records);
    expect(allFeatures.totalFeatures).toBe(2);
    expect(allFeatures.features[0]?.feature).toBe('chat');
  });

  it('aggregates time-based reports daily and monthly', () => {
    const records: UsageRecord[] = [
      createRecord({ timestamp: new Date('2026-10-01T10:00:00Z'), totalTokens: 100, estimatedCost: 0.01 }),
      createRecord({ timestamp: new Date('2026-10-01T18:00:00Z'), totalTokens: 200, estimatedCost: 0.02 }),
      createRecord({ timestamp: new Date('2026-10-02T12:00:00Z'), totalTokens: 300, estimatedCost: 0.03 }),
      createRecord({ timestamp: new Date('2026-11-05T12:00:00Z'), totalTokens: 400, estimatedCost: 0.04 })
    ];

    const daily = generateTimeReport(records, { groupBy: 'day' });
    expect(daily.intervals).toHaveLength(3); // Oct 1, Oct 2, Nov 5
    expect(daily.intervals[0]?.label).toBe('2026-10-01');
    expect(daily.intervals[0]?.requests).toBe(2);
    expect(daily.intervals[0]?.totalTokens).toBe(300);
    expect(daily.intervals[0]?.estimatedCost).toBe(0.03);

    const monthly = generateTimeReport(records, { groupBy: 'month' });
    expect(monthly.intervals).toHaveLength(2); // 2026-10, 2026-11
    expect(monthly.intervals[0]?.label).toBe('2026-10');
    expect(monthly.intervals[0]?.totalTokens).toBe(600);
    expect(monthly.intervals[1]?.label).toBe('2026-11');
    expect(monthly.intervals[1]?.totalTokens).toBe(400);
  });

  it('estimates tokens based on character length heuristics', () => {
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('hello')).toBe(2);
    expect(estimateTokenCount('The quick brown fox jumps over the lazy dog.')).toBe(11);
  });
});
