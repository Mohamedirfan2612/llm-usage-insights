import type { BudgetManager } from './budgets.js';
import type {
  AllFeaturesReport,
  AllUsersReport,
  EntityModelBreakdown,
  FeatureReport,
  ModelReport,
  ModelReportOptions,
  ModelUsageSummary,
  SortField,
  SortOrder,
  TimeInterval,
  TimeIntervalSummary,
  TimeReport,
  TimeReportOptions,
  UsageRecord,
  UserReport
} from './types.js';

/**
 * Heuristic token estimator for situations where the provider does not supply token usage.
 * Defaults to ~4 characters per token (the standard OpenAI/Anthropic approximation).
 */
export function estimateTokenCount(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;

  // Approximate 4 chars per token for typical Western text, min 1
  return Math.max(1, Math.ceil(trimmed.length / 4));
}

/**
 * Sort helper for model summaries.
 */
function sortModelSummaries(
  models: ModelUsageSummary[],
  sortBy: SortField = 'totalTokens',
  order: SortOrder = 'desc'
): ModelUsageSummary[] {
  const multiplier = order === 'asc' ? 1 : -1;

  return [...models].sort((a, b) => {
    let diff = 0;
    switch (sortBy) {
      case 'totalTokens':
        diff = a.totalTokens - b.totalTokens;
        break;
      case 'inputTokens':
        diff = a.inputTokens - b.inputTokens;
        break;
      case 'outputTokens':
        diff = a.outputTokens - b.outputTokens;
        break;
      case 'estimatedCost':
        diff = a.estimatedCost - b.estimatedCost;
        break;
      case 'requests':
        diff = a.requests - b.requests;
        break;
      default:
        diff = a.totalTokens - b.totalTokens;
    }

    if (diff === 0) {
      // Secondary sort: model name
      return a.model.localeCompare(b.model) * multiplier;
    }
    return diff * multiplier;
  });
}

/**
 * Generates an aggregated model-wise analytics report from a list of records.
 */
export function generateModelReport(
  records: UsageRecord[],
  options: ModelReportOptions = {},
  defaultCurrency: string = 'USD'
): ModelReport {
  let grandTotalRequests = 0;
  let grandTotalInputTokens = 0;
  let grandTotalOutputTokens = 0;
  let grandTotalCachedTokens = 0;
  let grandTotalTokens = 0;
  let grandTotalEstimatedCost = 0;

  // Group by "provider:model"
  const modelMap = new Map<
    string,
    {
      provider: string;
      model: string;
      requests: number;
      successfulRequests: number;
      failedRequests: number;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      totalTokens: number;
      estimatedCost: number;
      hasUnavailableCosts: boolean;
      latencyTotalMs: number;
      latencyCount: number;
    }
  >();

  for (const rec of records) {
    grandTotalRequests += 1;
    grandTotalInputTokens += rec.inputTokens;
    grandTotalOutputTokens += rec.outputTokens;
    grandTotalCachedTokens += rec.cachedTokens;
    grandTotalTokens += rec.totalTokens;

    if (rec.estimatedCost !== null) {
      grandTotalEstimatedCost += rec.estimatedCost;
    }

    const key = `${rec.provider.toLowerCase()}:${rec.model.toLowerCase()}`;
    let item = modelMap.get(key);
    if (!item) {
      item = {
        provider: rec.provider,
        model: rec.model,
        requests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        hasUnavailableCosts: false,
        latencyTotalMs: 0,
        latencyCount: 0
      };
      modelMap.set(key, item);
    }

    item.requests += 1;
    if (rec.status === 'success') {
      item.successfulRequests += 1;
    } else {
      item.failedRequests += 1;
    }

    item.inputTokens += rec.inputTokens;
    item.outputTokens += rec.outputTokens;
    item.cachedTokens += rec.cachedTokens;
    item.totalTokens += rec.totalTokens;

    if (rec.estimatedCost !== null) {
      item.estimatedCost += rec.estimatedCost;
    } else {
      item.hasUnavailableCosts = true;
    }

    if (typeof rec.latencyMs === 'number' && !Number.isNaN(rec.latencyMs)) {
      item.latencyTotalMs += rec.latencyMs;
      item.latencyCount += 1;
    }
  }

  grandTotalEstimatedCost = Number(grandTotalEstimatedCost.toFixed(6));

  const modelSummaries: ModelUsageSummary[] = [];

  for (const item of modelMap.values()) {
    const cost = Number(item.estimatedCost.toFixed(6));
    const avgTokens = item.requests > 0 ? Math.round(item.totalTokens / item.requests) : 0;
    const avgCost = item.requests > 0 ? Number((cost / item.requests).toFixed(6)) : 0;
    const pctTokens =
      grandTotalTokens > 0 ? Number(((item.totalTokens / grandTotalTokens) * 100).toFixed(2)) : 0;
    const pctCost =
      grandTotalEstimatedCost > 0
        ? Number(((cost / grandTotalEstimatedCost) * 100).toFixed(2))
        : 0;

    const avgLatency =
      item.latencyCount > 0 ? Math.round(item.latencyTotalMs / item.latencyCount) : null;

    modelSummaries.push({
      provider: item.provider,
      model: item.model,
      requests: item.requests,
      successfulRequests: item.successfulRequests,
      failedRequests: item.failedRequests,
      inputTokens: item.inputTokens,
      outputTokens: item.outputTokens,
      cachedTokens: item.cachedTokens,
      totalTokens: item.totalTokens,
      estimatedCost: cost,
      hasUnavailableCosts: item.hasUnavailableCosts,
      averageTokensPerRequest: avgTokens,
      averageCostPerRequest: avgCost,
      percentageOfTotalTokens: pctTokens,
      percentageOfTotalCost: pctCost,
      averageLatencyMs: avgLatency
    });
  }

  const sortedModels = sortModelSummaries(
    modelSummaries,
    options.sortBy || 'totalTokens',
    options.order || 'desc'
  );

  return {
    totalRequests: grandTotalRequests,
    totalTokens: grandTotalTokens,
    totalInputTokens: grandTotalInputTokens,
    totalOutputTokens: grandTotalOutputTokens,
    totalCachedTokens: grandTotalCachedTokens,
    totalEstimatedCost: grandTotalEstimatedCost,
    currency: defaultCurrency,
    models: sortedModels,
    generatedAt: new Date()
  };
}

/**
 * Helper to build model breakdowns for user or feature records.
 */
function buildModelBreakdown(records: UsageRecord[]): EntityModelBreakdown[] {
  const map = new Map<string, EntityModelBreakdown>();

  for (const rec of records) {
    const key = `${rec.provider.toLowerCase()}:${rec.model.toLowerCase()}`;
    let item = map.get(key);
    if (!item) {
      item = {
        provider: rec.provider,
        model: rec.model,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
      map.set(key, item);
    }
    item.requests += 1;
    item.inputTokens += rec.inputTokens;
    item.outputTokens += rec.outputTokens;
    item.totalTokens += rec.totalTokens;
    if (rec.estimatedCost !== null) {
      item.estimatedCost += rec.estimatedCost;
    }
  }

  return Array.from(map.values())
    .map((m) => ({ ...m, estimatedCost: Number(m.estimatedCost.toFixed(6)) }))
    .sort((a, b) => b.totalTokens - a.totalTokens);
}

/**
 * Generates report for a specific user.
 */
export function generateUserReport(
  userId: string,
  records: UsageRecord[],
  budgetManager?: BudgetManager
): UserReport {
  const userRecords = records.filter((r) => r.userId === userId);

  let requests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let totalTokens = 0;
  let estimatedCost = 0;

  for (const rec of userRecords) {
    requests += 1;
    inputTokens += rec.inputTokens;
    outputTokens += rec.outputTokens;
    cachedTokens += rec.cachedTokens;
    totalTokens += rec.totalTokens;
    if (rec.estimatedCost !== null) {
      estimatedCost += rec.estimatedCost;
    }
  }

  const budgetConfig = budgetManager?.getUserBudget(userId);
  const budgetStatus = budgetConfig
    ? budgetManager?.evaluateStatus(budgetConfig, userRecords, 0)
    : undefined;

  return {
    id: userId,
    userId,
    requests,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens,
    estimatedCost: Number(estimatedCost.toFixed(6)),
    budget: budgetStatus,
    modelsUsed: buildModelBreakdown(userRecords)
  };
}

/**
 * Generates report for all users found in records.
 */
export function generateAllUsersReport(
  records: UsageRecord[],
  budgetManager?: BudgetManager
): AllUsersReport {
  const userIds = new Set<string>();
  for (const rec of records) {
    if (rec.userId) {
      userIds.add(rec.userId);
    }
  }

  const users: UserReport[] = [];
  let grandRequests = 0;
  let grandTokens = 0;
  let grandCost = 0;

  for (const uid of userIds) {
    const report = generateUserReport(uid, records, budgetManager);
    users.push(report);
    grandRequests += report.requests;
    grandTokens += report.totalTokens;
    grandCost += report.estimatedCost;
  }

  users.sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    totalUsers: users.length,
    totalRequests: grandRequests,
    totalTokens: grandTokens,
    totalEstimatedCost: Number(grandCost.toFixed(6)),
    users,
    generatedAt: new Date()
  };
}

/**
 * Generates report for a specific feature.
 */
export function generateFeatureReport(
  feature: string,
  records: UsageRecord[],
  budgetManager?: BudgetManager
): FeatureReport {
  const featureRecords = records.filter((r) => r.feature === feature);

  let requests = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;
  let totalTokens = 0;
  let estimatedCost = 0;

  for (const rec of featureRecords) {
    requests += 1;
    inputTokens += rec.inputTokens;
    outputTokens += rec.outputTokens;
    cachedTokens += rec.cachedTokens;
    totalTokens += rec.totalTokens;
    if (rec.estimatedCost !== null) {
      estimatedCost += rec.estimatedCost;
    }
  }

  const budgetConfig = budgetManager?.getFeatureBudget(feature);
  const budgetStatus = budgetConfig
    ? budgetManager?.evaluateStatus(budgetConfig, featureRecords, 0)
    : undefined;

  return {
    id: feature,
    feature,
    requests,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens,
    estimatedCost: Number(estimatedCost.toFixed(6)),
    budget: budgetStatus,
    modelsUsed: buildModelBreakdown(featureRecords)
  };
}

/**
 * Generates report for all features found in records.
 */
export function generateAllFeaturesReport(
  records: UsageRecord[],
  budgetManager?: BudgetManager
): AllFeaturesReport {
  const features = new Set<string>();
  for (const rec of records) {
    if (rec.feature) {
      features.add(rec.feature);
    }
  }

  const featureReports: FeatureReport[] = [];
  let grandRequests = 0;
  let grandTokens = 0;
  let grandCost = 0;

  for (const feat of features) {
    const report = generateFeatureReport(feat, records, budgetManager);
    featureReports.push(report);
    grandRequests += report.requests;
    grandTokens += report.totalTokens;
    grandCost += report.estimatedCost;
  }

  featureReports.sort((a, b) => b.totalTokens - a.totalTokens);

  return {
    totalFeatures: featureReports.length,
    totalRequests: grandRequests,
    totalTokens: grandTokens,
    totalEstimatedCost: Number(grandCost.toFixed(6)),
    features: featureReports,
    generatedAt: new Date()
  };
}

/**
 * Formats a Date object into a string key based on interval.
 */
function getIntervalKey(date: Date, interval: TimeInterval): { key: string; start: Date; end: Date } {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (interval === 'day') {
    const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, day, 23, 59, 59, 999));
    const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { key, start, end };
  }

  if (interval === 'week') {
    const dayOfWeek = date.getUTCDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(Date.UTC(year, month, day + diffToMonday, 0, 0, 0, 0));
    const sunday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    const key = `${monday.getUTCFullYear()}-W${String(getWeekNumber(monday)).padStart(2, '0')}`;
    return { key, start: monday, end: sunday };
  }

  // month
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
  const key = `${year}-${String(month + 1).padStart(2, '0')}`;
  return { key, start, end };
}

function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Generates a time-aggregated analytics report (daily, weekly, or monthly).
 */
export function generateTimeReport(
  records: UsageRecord[],
  options: TimeReportOptions = {},
  defaultCurrency: string = 'USD'
): TimeReport {
  const interval = options.groupBy || 'day';
  const buckets = new Map<
    string,
    {
      periodStart: Date;
      periodEnd: Date;
      label: string;
      requests: number;
      inputTokens: number;
      outputTokens: number;
      cachedTokens: number;
      totalTokens: number;
      estimatedCost: number;
    }
  >();

  let totalRequests = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  let totalTokens = 0;
  let totalEstimatedCost = 0;

  for (const rec of records) {
    totalRequests += 1;
    totalInputTokens += rec.inputTokens;
    totalOutputTokens += rec.outputTokens;
    totalCachedTokens += rec.cachedTokens;
    totalTokens += rec.totalTokens;
    if (rec.estimatedCost !== null) {
      totalEstimatedCost += rec.estimatedCost;
    }

    const { key, start, end } = getIntervalKey(rec.timestamp, interval);
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        periodStart: start,
        periodEnd: end,
        label: key,
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        cachedTokens: 0,
        totalTokens: 0,
        estimatedCost: 0
      };
      buckets.set(key, bucket);
    }

    bucket.requests += 1;
    bucket.inputTokens += rec.inputTokens;
    bucket.outputTokens += rec.outputTokens;
    bucket.cachedTokens += rec.cachedTokens;
    bucket.totalTokens += rec.totalTokens;
    if (rec.estimatedCost !== null) {
      bucket.estimatedCost += rec.estimatedCost;
    }
  }

  const summaries: TimeIntervalSummary[] = Array.from(buckets.values())
    .sort((a, b) => a.periodStart.getTime() - b.periodStart.getTime())
    .map((b) => ({
      periodStart: b.periodStart.toISOString(),
      periodEnd: b.periodEnd.toISOString(),
      label: b.label,
      requests: b.requests,
      inputTokens: b.inputTokens,
      outputTokens: b.outputTokens,
      cachedTokens: b.cachedTokens,
      totalTokens: b.totalTokens,
      estimatedCost: Number(b.estimatedCost.toFixed(6))
    }));

  return {
    interval,
    timeZone: options.timeZone || 'UTC',
    totalRequests,
    totalTokens,
    totalInputTokens,
    totalOutputTokens,
    totalCachedTokens,
    totalEstimatedCost: Number(totalEstimatedCost.toFixed(6)),
    currency: defaultCurrency,
    intervals: summaries,
    generatedAt: new Date()
  };
}
