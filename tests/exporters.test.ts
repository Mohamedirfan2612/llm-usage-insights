import { describe, expect, it } from 'vitest';
import { generateModelReport } from '../src/analytics.js';
import {
  escapeCSVCell,
  exportFeaturesReportToCSV,
  exportModelReportToCSV,
  exportRecordsToCSV,
  exportUsersReportToCSV
} from '../src/exporters/csv.js';
import { exportToHTML } from '../src/exporters/html.js';
import { exportToJSON } from '../src/exporters/json.js';
import type { UsageRecord } from '../src/types.js';

describe('Exporters', () => {
  const sampleRecords: UsageRecord[] = [
    {
      id: 'rec-1',
      provider: 'openai',
      model: 'gpt-4o',
      requestId: 'req-abc,123', // contains comma
      userId: 'user_"vip"', // contains quotes
      feature: 'chat\nsupport', // contains newline
      timestamp: new Date('2026-10-10T12:00:00Z'),
      inputTokens: 1000,
      outputTokens: 500,
      cachedTokens: 200,
      totalTokens: 1500,
      estimatedCost: 0.05,
      currency: 'USD',
      costStatus: 'calculated',
      status: 'success',
      latencyMs: 250,
      isEstimatedTokens: false
    }
  ];

  it('escapes cells according to RFC 4180 standard', () => {
    expect(escapeCSVCell('plain')).toBe('plain');
    expect(escapeCSVCell('hello, world')).toBe('"hello, world"');
    expect(escapeCSVCell('say "hello"')).toBe('"say ""hello"""');
    expect(escapeCSVCell('line1\nline2')).toBe('"line1\nline2"');
    expect(escapeCSVCell(1234)).toBe('1234');
    expect(escapeCSVCell(null)).toBe('');
    expect(escapeCSVCell(undefined)).toBe('');
  });

  it('exports records to valid CSV with escaped special characters', () => {
    const csv = exportRecordsToCSV(sampleRecords);
    expect(csv).toContain('id,timestamp,provider,model');
    expect(csv).toContain('"req-abc,123"'); // comma escaped
    expect(csv).toContain('"user_""vip"""'); // quotes escaped
    expect(csv).toContain('"chat\nsupport"'); // newline escaped
  });

  it('exports model report to CSV with correct headers and values', () => {
    const modelReport = generateModelReport(sampleRecords);
    const csv = exportModelReportToCSV(modelReport);

    expect(csv).toContain('provider,model,requests,successfulRequests');
    expect(csv).toContain('openai,gpt-4o,1,1,0,1000,500,200,1500,0.05');
  });

  it('exports user and feature reports to CSV', () => {
    const usersCsv = exportUsersReportToCSV({
      totalUsers: 1,
      totalRequests: 1,
      totalTokens: 1500,
      totalEstimatedCost: 0.05,
      users: [
        {
          id: 'user_1',
          userId: 'user_1',
          requests: 1,
          inputTokens: 1000,
          outputTokens: 500,
          cachedTokens: 200,
          totalTokens: 1500,
          estimatedCost: 0.05,
          modelsUsed: []
        }
      ],
      generatedAt: new Date()
    });
    expect(usersCsv).toContain('userId,requests,inputTokens');
    expect(usersCsv).toContain('user_1,1,1000,500,200,1500,0.05');

    const featuresCsv = exportFeaturesReportToCSV({
      totalFeatures: 1,
      totalRequests: 1,
      totalTokens: 1500,
      totalEstimatedCost: 0.05,
      features: [
        {
          id: 'chat',
          feature: 'chat',
          requests: 1,
          inputTokens: 1000,
          outputTokens: 500,
          cachedTokens: 200,
          totalTokens: 1500,
          estimatedCost: 0.05,
          modelsUsed: []
        }
      ],
      generatedAt: new Date()
    });
    expect(featuresCsv).toContain('feature,requests,inputTokens');
    expect(featuresCsv).toContain('chat,1,1000,500,200,1500,0.05');
  });

  it('exports to JSON formatted or compact', () => {
    const compact = exportToJSON(sampleRecords, { pretty: false });
    expect(compact).not.toContain('\n');
    expect(JSON.parse(compact)).toHaveLength(1);

    const pretty = exportToJSON(sampleRecords, { pretty: true });
    expect(pretty).toContain('\n');
    expect(JSON.parse(pretty)).toHaveLength(1);
  });

  it('exports HTML report with high-agency frontend directives and zero emojis', () => {
    const modelReport = generateModelReport(sampleRecords);
    const html = exportToHTML(modelReport, { title: 'Analytics Demo' });

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Analytics Demo');
    expect(html).toContain('gpt-4o');
    expect(html).toContain('1,500'); // formatted tokens
    expect(html).toContain('$0.0500'); // formatted cost
    expect(html).toContain('bento-grid');
    // Ensure no emojis exist in generated markup
    expect(html).not.toMatch(/[\u{1F300}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u);
  });
});
