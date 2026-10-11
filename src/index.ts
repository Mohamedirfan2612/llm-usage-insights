/**
 * llm-usage-insights
 * Lightweight, production-quality LLM analytics, model-wise cost reports,
 * and usage tracking for Node.js and TypeScript.
 */

// Core Tracker
export { UsageTracker } from './tracker.js';

// Types
export type {
  AllFeaturesReport,
  AllUsersReport,
  BudgetAlert,
  BudgetCheckResult,
  BudgetConfig,
  BudgetPeriod,
  BudgetStatus,
  CostCalculationResult,
  CostStatus,
  EntityModelBreakdown,
  EntityUsageSummary,
  ExportOptions,
  FeatureReport,
  ModelPricing,
  ModelReport,
  ModelReportOptions,
  ModelUsageSummary,
  PricingRegistryConfig,
  RecordFilter,
  RecordInput,
  RequestStatus,
  SortField,
  SortOrder,
  StorageAdapter,
  TimeInterval,
  TimeIntervalSummary,
  TimeReport,
  TimeReportOptions,
  TrackerOptions,
  UsageRecord,
  UserReport
} from './types.js';

// Errors
export {
  BudgetExceededError,
  InvalidRecordError,
  PricingNotFoundError,
  StorageError,
  UsageInsightsError
} from './errors.js';

// Pricing
export {
  DEFAULT_MODEL_PRICING,
  PricingRegistry,
  normalizePricingKey
} from './pricing.js';

// Storage
export { MemoryStore, normalizeDateBoundary } from './storage/memory-store.js';
export type { StorageAdapter as IStorageAdapter } from './storage/storage-interface.js';

// Budgets
export { BudgetManager, getPeriodBounds } from './budgets.js';

// Analytics
export {
  estimateTokenCount,
  generateAllFeaturesReport,
  generateAllUsersReport,
  generateFeatureReport,
  generateModelReport,
  generateTimeReport,
  generateUserReport
} from './analytics.js';

// Exporters
export { exportToJSON, type JsonExportTarget } from './exporters/json.js';
export {
  escapeCSVCell,
  exportFeaturesReportToCSV,
  exportModelReportToCSV,
  exportRecordsToCSV,
  exportUsersReportToCSV
} from './exporters/csv.js';
export { exportToHTML, type HTMLExportOptions } from './exporters/html.js';

// Provider Integrations
export {
  extractAnthropicUsage,
  extractOpenAIUsage,
  recordAnthropicResponse,
  recordOpenAIResponse,
  wrapAnthropic,
  wrapOpenAI,
  type AnthropicResponseLike,
  type AnthropicUsageMetadata,
  type OpenAIResponseLike,
  type OpenAIUsageMetadata,
  type ProviderCallContext
} from './providers/index.js';
