import { describe, expect, it, vi } from 'vitest';
import { InvalidRecordError } from '../src/errors.js';
import { UsageTracker } from '../src/tracker.js';

describe('UsageTracker', () => {
  it('records valid interactions and calculates costs accurately', () => {
    const tracker = new UsageTracker();

    const record = tracker.record({
      provider: 'openai',
      model: 'gpt-4o',
      userId: 'user_1',
      feature: 'assistant',
      inputTokens: 1000,
      outputTokens: 500
    });

    expect(record.id).toBeDefined();
    expect(record.provider).toBe('openai');
    expect(record.model).toBe('gpt-4o');
    expect(record.totalTokens).toBe(1500);
    expect(record.estimatedCost).toBe(0.0075);
    expect(record.costStatus).toBe('calculated');
    expect(record.status).toBe('success');
  });

  it('validates required fields and throws InvalidRecordError', () => {
    const tracker = new UsageTracker();

    expect(() =>
      tracker.record({
        provider: '',
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: 100
      })
    ).toThrow(InvalidRecordError);

    expect(() =>
      tracker.record({
        provider: 'openai',
        model: '',
        inputTokens: 100,
        outputTokens: 100
      })
    ).toThrow(InvalidRecordError);

    expect(() =>
      tracker.record({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: -10,
        outputTokens: 100
      })
    ).toThrow(InvalidRecordError);

    expect(() =>
      tracker.record({
        provider: 'openai',
        model: 'gpt-4o',
        inputTokens: 100,
        outputTokens: -5
      })
    ).toThrow(InvalidRecordError);
  });

  it('handles unknown models by recording costStatus as unavailable and cost as null', () => {
    const tracker = new UsageTracker();

    const record = tracker.record({
      provider: 'custom-provider',
      model: 'unseen-model-v1',
      inputTokens: 1000,
      outputTokens: 1000
    });

    expect(record.costStatus).toBe('unavailable');
    expect(record.estimatedCost).toBeNull();
  });

  it('permits manual override of estimatedCost', () => {
    const tracker = new UsageTracker();

    const record = tracker.record({
      provider: 'openai',
      model: 'gpt-4o',
      inputTokens: 1000,
      outputTokens: 500,
      estimatedCost: 0.999
    });

    expect(record.estimatedCost).toBe(0.999);
    expect(record.costStatus).toBe('custom');
  });

  it('records estimated usage from text', () => {
    const tracker = new UsageTracker();

    const record = tracker.recordEstimated({
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptText: 'Summarize the following meeting notes.',
      completionText: 'Here is the summary of the meeting.'
    });

    expect(record.isEstimatedTokens).toBe(true);
    expect(record.inputTokens).toBeGreaterThan(0);
    expect(record.outputTokens).toBeGreaterThan(0);
    expect(record.totalTokens).toBe(record.inputTokens + record.outputTokens);
  });

  it('triggers budget callbacks when spending thresholds are crossed', () => {
    const onBudgetWarning = vi.fn();
    const onBudgetExceeded = vi.fn();

    const tracker = new UsageTracker({
      pricing: {
        'openai:expensive-model': {
          inputPricePerMillion: 1000.0,
          outputPricePerMillion: 1000.0
        }
      },
      userBudgets: {
        user_corp: {
          limit: 1.0,
          warningThreshold: 0.8
        }
      },
      onBudgetWarning,
      onBudgetExceeded
    });

    tracker.record({
      provider: 'openai',
      model: 'expensive-model',
      userId: 'user_corp',
      inputTokens: 850,
      outputTokens: 0
    });

    expect(onBudgetWarning).toHaveBeenCalledTimes(1);
    expect(onBudgetExceeded).not.toHaveBeenCalled();

    tracker.record({
      provider: 'openai',
      model: 'expensive-model',
      userId: 'user_corp',
      inputTokens: 300,
      outputTokens: 0
    });

    expect(onBudgetExceeded).toHaveBeenCalledTimes(1);
  });

  it('supports concurrent recordings without data corruption', async () => {
    const tracker = new UsageTracker();

    const promises = Array.from({ length: 50 }, (_, i) =>
      Promise.resolve().then(() =>
        tracker.record({
          provider: 'openai',
          model: 'gpt-4o-mini',
          userId: `user_${i % 5}`,
          feature: `feature_${i % 2}`,
          inputTokens: 100,
          outputTokens: 50
        })
      )
    );

    await Promise.all(promises);

    const report = tracker.getModelReport();
    expect(report.totalRequests).toBe(50);
    expect(report.totalTokens).toBe(50 * 150);
  });

  it('exports reports via exportJSON, exportCSV, and exportHTML', () => {
    const tracker = new UsageTracker();
    tracker.record({
      provider: 'openai',
      model: 'gpt-4o',
      userId: 'user_1',
      feature: 'chat',
      inputTokens: 500,
      outputTokens: 200
    });

    const jsonRecords = tracker.exportJSON();
    expect(JSON.parse(jsonRecords)).toHaveLength(1);

    const jsonModels = tracker.exportJSON({ type: 'models' });
    expect(JSON.parse(jsonModels).totalRequests).toBe(1);

    const csvModels = tracker.exportCSV({ type: 'models' });
    expect(csvModels).toContain('gpt-4o');

    const html = tracker.exportHTML();
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('gpt-4o');
  });
});
