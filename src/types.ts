/**
 * llm-usage-insights - Core Types
 */

export type RequestStatus = 'success' | 'error';

export type CostStatus = 'calculated' | 'unavailable' | 'custom' | 'partial';

export type BudgetPeriod = 'daily' | 'weekly' | 'monthly' | 'total';

export type SortField = 'totalTokens' | 'inputTokens' | 'outputTokens' | 'estimatedCost' | 'requests';

export type SortOrder = 'asc' | 'desc';

export type TimeInterval = 'day' | 'week' | 'month';

/**
 * Standardized record stored for each LLM interaction.
 */
export interface UsageRecord {
  id: string;
  provider: string;
  model: string;
  requestId?: string;
  userId?: string;
  feature?: string;
  timestamp: Date;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCost: number | null;
  currency: string;
  costStatus: CostStatus;
  status: RequestStatus;
  latencyMs?: number;
  isEstimatedTokens: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Input accepted by UsageTracker.record()
 */
export interface RecordInput {
  provider: string;
  model: string;
  requestId?: string;
  userId?: string;
  feature?: string;
  timestamp?: Date | string | number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
  /**
   * If true, inputTokens already includes cachedTokens (OpenAI convention).
   * If false, cached tokens are separate from inputTokens.
   * Default: true.
   */
  cachedTokensIncludedInInput?: boolean;
  totalTokens?: number;
  estimatedCost?: number | null;
  currency?: string;
  costStatus?: CostStatus;
  status?: RequestStatus;
  latencyMs?: number;
  isEstimatedTokens?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Pricing definition for a specific model.
 */
export interface ModelPricing {
  provider?: string;
  model?: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  cachedInputPricePerMillion?: number;
  currency?: string;
  source?: string;
  updatedAt?: string;
}

/**
 * Pricing registry configuration.
 */
export interface PricingRegistryConfig {
  models?: Record<string, ModelPricing>;
  defaultCurrency?: string;
}

/**
 * Result of calculating cost for a given usage.
 */
export interface CostCalculationResult {
  cost: number | null;
  currency: string;
  status: CostStatus;
  breakdown?: {
    inputCost: number;
    outputCost: number;
    cachedInputCost: number;
  };
}

/**
 * Budget configuration for a user, feature, or global scope.
 */
export interface BudgetConfig {
  limit: number;
  period?: BudgetPeriod;
  warningThreshold?: number; // e.g. 0.8 for 80%
  currency?: string;
}

/**
 * Status of an active budget evaluation.
 */
export interface BudgetStatus {
  limit: number;
  currentSpend: number;
  remainingSpend: number;
  percentageUsed: number;
  isExceeded: boolean;
  isWarning: boolean;
  period: BudgetPeriod;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Result of checking budget before or after recording usage.
 */
export interface BudgetCheckResult {
  allowed: boolean;
  reason?: string;
  userBudget?: BudgetStatus;
  featureBudget?: BudgetStatus;
  globalBudget?: BudgetStatus;
}

/**
 * Alert object emitted when budget thresholds are crossed.
 */
export interface BudgetAlert {
  type: 'warning' | 'exceeded';
  scope: 'user' | 'feature' | 'global';
  targetId?: string;
  limit: number;
  currentSpend: number;
  percentageUsed: number;
  period: BudgetPeriod;
  timestamp: Date;
}

/**
 * Filters for querying records and generating reports.
 */
export interface RecordFilter {
  from?: Date | string;
  to?: Date | string;
  inclusiveEndDate?: boolean;
  provider?: string;
  model?: string;
  userId?: string;
  feature?: string;
  status?: RequestStatus;
}

/**
 * Options for model-wise reporting.
 */
export interface ModelReportOptions extends RecordFilter {
  sortBy?: SortField;
  order?: SortOrder;
}

/**
 * Summary for an individual model within a ModelReport.
 */
export interface ModelUsageSummary {
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
  averageTokensPerRequest: number;
  averageCostPerRequest: number;
  percentageOfTotalTokens: number;
  percentageOfTotalCost: number;
  averageLatencyMs: number | null;
}

/**
 * Complete model analytics report.
 */
export interface ModelReport {
  totalRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalEstimatedCost: number;
  currency: string;
  models: ModelUsageSummary[];
  generatedAt: Date;
}

/**
 * Model breakdown summary inside user or feature reports.
 */
export interface EntityModelBreakdown {
  provider: string;
  model: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Summary for a user or feature.
 */
export interface EntityUsageSummary {
  id: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCost: number;
  budget?: BudgetStatus;
  modelsUsed: EntityModelBreakdown[];
}

/**
 * Report for a single user.
 */
export interface UserReport extends EntityUsageSummary {
  userId: string;
}

/**
 * Report for a single feature.
 */
export interface FeatureReport extends EntityUsageSummary {
  feature: string;
}

/**
 * Report containing all users.
 */
export interface AllUsersReport {
  totalUsers: number;
  totalRequests: number;
  totalTokens: number;
  totalEstimatedCost: number;
  users: UserReport[];
  generatedAt: Date;
}

/**
 * Report containing all features.
 */
export interface AllFeaturesReport {
  totalFeatures: number;
  totalRequests: number;
  totalTokens: number;
  totalEstimatedCost: number;
  features: FeatureReport[];
  generatedAt: Date;
}

/**
 * Time bucket within a TimeReport.
 */
export interface TimeIntervalSummary {
  periodStart: string; // ISO string
  periodEnd: string;   // ISO string
  label: string;       // human readable label (e.g. YYYY-MM-DD)
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Options for time-based reporting.
 */
export interface TimeReportOptions extends RecordFilter {
  groupBy?: TimeInterval;
  timeZone?: string;
}

/**
 * Time-based usage report.
 */
export interface TimeReport {
  interval: TimeInterval;
  timeZone: string;
  totalRequests: number;
  totalTokens: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
  totalEstimatedCost: number;
  currency: string;
  intervals: TimeIntervalSummary[];
  generatedAt: Date;
}

/**
 * Options for exporting data.
 */
export interface ExportOptions extends RecordFilter {
  /**
   * If 'records', exports raw usage records.
   * If 'models', exports aggregated model report.
   * If 'users', exports aggregated user report.
   * If 'features', exports aggregated feature report.
   * Default: 'records'.
   */
  type?: 'records' | 'models' | 'users' | 'features';
  pretty?: boolean; // for JSON
}

/**
 * Options for Tracker initialization.
 */
export interface TrackerOptions {
  pricing?: Record<string, ModelPricing> | PricingRegistryConfig;
  pricingFilePath?: string;
  currency?: string;
  userBudgets?: Record<string, BudgetConfig>;
  featureBudgets?: Record<string, BudgetConfig>;
  globalBudget?: BudgetConfig;
  onBudgetWarning?: (alert: BudgetAlert) => void;
  onBudgetExceeded?: (alert: BudgetAlert) => void;
  storage?: StorageAdapter;
}

/**
 * Interface for storage backends.
 */
export interface StorageAdapter {
  record(entry: UsageRecord): Promise<void> | void;
  getRecords(filter?: RecordFilter): Promise<UsageRecord[]> | UsageRecord[];
  clear(): Promise<void> | void;
  count(filter?: RecordFilter): Promise<number> | number;
}
