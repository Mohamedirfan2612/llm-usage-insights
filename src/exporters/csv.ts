import type { AllFeaturesReport, AllUsersReport, ModelReport, UsageRecord } from '../types.js';

/**
 * Escapes an individual cell value according to RFC 4180.
 * Wraps in double quotes and escapes existing quotes by doubling them
 * if commas, quotes, or newlines are present.
 */
export function escapeCSVCell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts an array of string rows into RFC 4180 CSV text.
 */
function toCSVString(rows: (unknown[])[]): string {
  return rows.map((row) => row.map(escapeCSVCell).join(',')).join('\r\n');
}

/**
 * Exports raw usage records to CSV format.
 */
export function exportRecordsToCSV(records: UsageRecord[]): string {
  const headers = [
    'id',
    'timestamp',
    'provider',
    'model',
    'requestId',
    'userId',
    'feature',
    'status',
    'inputTokens',
    'outputTokens',
    'cachedTokens',
    'totalTokens',
    'estimatedCost',
    'currency',
    'costStatus',
    'isEstimatedTokens',
    'latencyMs'
  ];

  const rows: (unknown[])[] = [headers];

  for (const rec of records) {
    rows.push([
      rec.id,
      rec.timestamp.toISOString(),
      rec.provider,
      rec.model,
      rec.requestId ?? '',
      rec.userId ?? '',
      rec.feature ?? '',
      rec.status,
      rec.inputTokens,
      rec.outputTokens,
      rec.cachedTokens,
      rec.totalTokens,
      rec.estimatedCost !== null ? rec.estimatedCost : '',
      rec.currency,
      rec.costStatus,
      rec.isEstimatedTokens,
      rec.latencyMs ?? ''
    ]);
  }

  return toCSVString(rows);
}

/**
 * Exports aggregated model report to CSV format.
 */
export function exportModelReportToCSV(report: ModelReport): string {
  const headers = [
    'provider',
    'model',
    'requests',
    'successfulRequests',
    'failedRequests',
    'inputTokens',
    'outputTokens',
    'cachedTokens',
    'totalTokens',
    'estimatedCost',
    'averageTokensPerRequest',
    'averageCostPerRequest',
    'percentageOfTotalTokens',
    'percentageOfTotalCost',
    'averageLatencyMs'
  ];

  const rows: (unknown[])[] = [headers];

  for (const m of report.models) {
    rows.push([
      m.provider,
      m.model,
      m.requests,
      m.successfulRequests,
      m.failedRequests,
      m.inputTokens,
      m.outputTokens,
      m.cachedTokens,
      m.totalTokens,
      m.estimatedCost,
      m.averageTokensPerRequest,
      m.averageCostPerRequest,
      m.percentageOfTotalTokens,
      m.percentageOfTotalCost,
      m.averageLatencyMs ?? ''
    ]);
  }

  return toCSVString(rows);
}

/**
 * Exports user usage report to CSV.
 */
export function exportUsersReportToCSV(report: AllUsersReport): string {
  const headers = [
    'userId',
    'requests',
    'inputTokens',
    'outputTokens',
    'cachedTokens',
    'totalTokens',
    'estimatedCost',
    'budgetLimit',
    'budgetSpent',
    'percentageUsed',
    'isExceeded'
  ];

  const rows: (unknown[])[] = [headers];

  for (const u of report.users) {
    rows.push([
      u.userId,
      u.requests,
      u.inputTokens,
      u.outputTokens,
      u.cachedTokens,
      u.totalTokens,
      u.estimatedCost,
      u.budget?.limit ?? '',
      u.budget?.currentSpend ?? '',
      u.budget?.percentageUsed ?? '',
      u.budget?.isExceeded ?? ''
    ]);
  }

  return toCSVString(rows);
}

/**
 * Exports feature usage report to CSV.
 */
export function exportFeaturesReportToCSV(report: AllFeaturesReport): string {
  const headers = [
    'feature',
    'requests',
    'inputTokens',
    'outputTokens',
    'cachedTokens',
    'totalTokens',
    'estimatedCost',
    'budgetLimit',
    'budgetSpent',
    'percentageUsed',
    'isExceeded'
  ];

  const rows: (unknown[])[] = [headers];

  for (const f of report.features) {
    rows.push([
      f.feature,
      f.requests,
      f.inputTokens,
      f.outputTokens,
      f.cachedTokens,
      f.totalTokens,
      f.estimatedCost,
      f.budget?.limit ?? '',
      f.budget?.currentSpend ?? '',
      f.budget?.percentageUsed ?? '',
      f.budget?.isExceeded ?? ''
    ]);
  }

  return toCSVString(rows);
}
