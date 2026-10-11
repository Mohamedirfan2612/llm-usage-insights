import crypto from 'node:crypto';
import {
  estimateTokenCount,
  generateAllFeaturesReport,
  generateAllUsersReport,
  generateFeatureReport,
  generateModelReport,
  generateTimeReport,
  generateUserReport
} from './analytics.js';
import { BudgetManager } from './budgets.js';
import { InvalidRecordError } from './errors.js';
import {
  exportFeaturesReportToCSV,
  exportModelReportToCSV,
  exportRecordsToCSV,
  exportUsersReportToCSV
} from './exporters/csv.js';
import { exportToHTML, type HTMLExportOptions } from './exporters/html.js';
import { exportToJSON } from './exporters/json.js';
import { PricingRegistry } from './pricing.js';
import { MemoryStore } from './storage/memory-store.js';
import type { StorageAdapter } from './storage/storage-interface.js';
import type {
  AllFeaturesReport,
  AllUsersReport,
  BudgetCheckResult,
  BudgetConfig,
  CostStatus,
  ExportOptions,
  FeatureReport,
  ModelReport,
  ModelReportOptions,
  RecordFilter,
  RecordInput,
  StorageAdapter as IStorageAdapter,
  TimeReport,
  TimeReportOptions,
  TrackerOptions,
  UsageRecord,
  UserReport
} from './types.js';

/**
 * Main UsageTracker class for tracking LLM token consumption, calculating costs,
 * monitoring budgets, and generating reports.
 */
export class UsageTracker {
  private readonly storage: StorageAdapter;
  private readonly pricing: PricingRegistry;
  private readonly budgets: BudgetManager;
  private readonly currency: string;

  constructor(options: TrackerOptions = {}) {
    this.storage = (options.storage as StorageAdapter) || new MemoryStore();
    this.pricing = new PricingRegistry(options.pricing);
    if (options.pricingFilePath) {
      this.pricing.loadFromFile(options.pricingFilePath);
    }
    this.currency = options.currency || this.pricing.getDefaultCurrency();
    this.pricing.setDefaultCurrency(this.currency);

    this.budgets = new BudgetManager({
      userBudgets: options.userBudgets,
      featureBudgets: options.featureBudgets,
      globalBudget: options.globalBudget,
      onWarning: options.onBudgetWarning,
      onExceeded: options.onBudgetExceeded
    });
  }

  /**
   * Get the underlying pricing registry instance.
   */
  public getPricingRegistry(): PricingRegistry {
    return this.pricing;
  }

  /**
   * Get the underlying storage adapter instance.
   */
  public getStorage(): IStorageAdapter {
    return this.storage;
  }

  /**
   * Record an LLM interaction.
   *
   * Validates tokens, resolves cost based on pricing registry,
   * evaluates active budget limits, and stores the record.
   */
  public record(input: RecordInput): UsageRecord {
    // 1. Validation
    if (!input.provider || typeof input.provider !== 'string' || input.provider.trim() === '') {
      throw new InvalidRecordError('Provider is required and must be a non-empty string.', 'provider');
    }
    if (!input.model || typeof input.model !== 'string' || input.model.trim() === '') {
      throw new InvalidRecordError('Model is required and must be a non-empty string.', 'model');
    }
    if (typeof input.inputTokens !== 'number' || input.inputTokens < 0 || Number.isNaN(input.inputTokens)) {
      throw new InvalidRecordError('inputTokens must be a non-negative number.', 'inputTokens');
    }
    if (typeof input.outputTokens !== 'number' || input.outputTokens < 0 || Number.isNaN(input.outputTokens)) {
      throw new InvalidRecordError('outputTokens must be a non-negative number.', 'outputTokens');
    }

    const cachedTokens = typeof input.cachedTokens === 'number' && input.cachedTokens >= 0 ? input.cachedTokens : 0;
    const cachedIncluded = input.cachedTokensIncludedInInput !== false;

    // 2. Resolve total tokens
    let totalTokens = input.totalTokens;
    if (typeof totalTokens !== 'number') {
      if (cachedIncluded) {
        // OpenAI standard: prompt_tokens already includes cached_tokens
        totalTokens = input.inputTokens + input.outputTokens;
      } else {
        totalTokens = input.inputTokens + cachedTokens + input.outputTokens;
      }
    }

    // 3. Resolve estimated cost
    let estimatedCost: number | null = null;
    let costStatus: CostStatus = input.costStatus || 'unavailable';

    if (input.estimatedCost !== undefined) {
      estimatedCost = input.estimatedCost;
      costStatus = input.costStatus || 'custom';
    } else {
      const calc = this.pricing.calculateCost({
        provider: input.provider,
        model: input.model,
        inputTokens: input.inputTokens,
        outputTokens: input.outputTokens,
        cachedTokens,
        cachedTokensIncludedInInput: cachedIncluded
      });
      estimatedCost = calc.cost;
      costStatus = calc.status;
    }

    const timestamp = input.timestamp ? new Date(input.timestamp) : new Date();

    const record: UsageRecord = {
      id: crypto.randomUUID(),
      provider: input.provider.trim(),
      model: input.model.trim(),
      requestId: input.requestId,
      userId: input.userId,
      feature: input.feature,
      timestamp,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cachedTokens,
      totalTokens,
      estimatedCost,
      currency: input.currency || this.currency,
      costStatus,
      status: input.status || 'success',
      latencyMs: input.latencyMs,
      isEstimatedTokens: Boolean(input.isEstimatedTokens),
      metadata: input.metadata
    };

    // 4. Budget check & alert triggers
    this.budgets.check(this.storage, {
      userId: record.userId,
      feature: record.feature,
      estimatedCost: record.estimatedCost ?? 0
    });

    // 5. Store record
    this.storage.record(record);

    return record;
  }

  /**
   * Records usage using estimated token counts from prompt and completion text.
   * Useful when actual provider usage metadata is not returned.
   */
  public recordEstimated(params: {
    provider: string;
    model: string;
    promptText?: string;
    completionText?: string;
    requestId?: string;
    userId?: string;
    feature?: string;
    latencyMs?: number;
    metadata?: Record<string, unknown>;
  }): UsageRecord {
    const inputTokens = estimateTokenCount(params.promptText || '');
    const outputTokens = estimateTokenCount(params.completionText || '');

    return this.record({
      provider: params.provider,
      model: params.model,
      requestId: params.requestId,
      userId: params.userId,
      feature: params.feature,
      inputTokens,
      outputTokens,
      latencyMs: params.latencyMs,
      isEstimatedTokens: true,
      metadata: params.metadata
    });
  }

  /**
   * Get an aggregated model-wise report.
   */
  public getModelReport(options?: ModelReportOptions): ModelReport {
    const records = this.storage.getRecords(options) as UsageRecord[];
    return generateModelReport(records, options, this.currency);
  }

  /**
   * Get report for a specific user.
   */
  public getUserReport(userId: string, filter?: RecordFilter): UserReport {
    const combinedFilter = { ...filter, userId };
    const records = this.storage.getRecords(combinedFilter) as UsageRecord[];
    return generateUserReport(userId, records, this.budgets);
  }

  /**
   * Get report for all users.
   */
  public getAllUsersReport(filter?: RecordFilter): AllUsersReport {
    const records = this.storage.getRecords(filter) as UsageRecord[];
    return generateAllUsersReport(records, this.budgets);
  }

  /**
   * Get report for a specific feature.
   */
  public getFeatureReport(feature: string, filter?: RecordFilter): FeatureReport {
    const combinedFilter = { ...filter, feature };
    const records = this.storage.getRecords(combinedFilter) as UsageRecord[];
    return generateFeatureReport(feature, records, this.budgets);
  }

  /**
   * Get report for all features.
   */
  public getAllFeaturesReport(filter?: RecordFilter): AllFeaturesReport {
    const records = this.storage.getRecords(filter) as UsageRecord[];
    return generateAllFeaturesReport(records, this.budgets);
  }

  /**
   * Get time-based analytics aggregated daily, weekly, or monthly.
   */
  public getReport(options?: TimeReportOptions): TimeReport {
    const records = this.storage.getRecords(options) as UsageRecord[];
    return generateTimeReport(records, options, this.currency);
  }

  /**
   * Check budget status for an upcoming or simulated interaction.
   */
  public checkBudget(context: { userId?: string; feature?: string; estimatedCost?: number }): BudgetCheckResult {
    return this.budgets.check(this.storage, context);
  }

  /**
   * Configure spending budget for a user.
   */
  public setUserBudget(userId: string, config: BudgetConfig): void {
    this.budgets.setUserBudget(userId, config);
  }

  /**
   * Configure spending budget for a feature.
   */
  public setFeatureBudget(feature: string, config: BudgetConfig): void {
    this.budgets.setFeatureBudget(feature, config);
  }

  /**
   * Configure global application spending budget.
   */
  public setGlobalBudget(config: BudgetConfig): void {
    this.budgets.setGlobalBudget(config);
  }

  /**
   * Export usage data or aggregated reports as JSON.
   */
  public exportJSON(options?: ExportOptions): string {
    const type = options?.type || 'records';
    if (type === 'models') {
      const report = this.getModelReport(options);
      return exportToJSON(report, options);
    }
    if (type === 'users') {
      const report = this.getAllUsersReport(options);
      return exportToJSON(report, options);
    }
    if (type === 'features') {
      const report = this.getAllFeaturesReport(options);
      return exportToJSON(report, options);
    }

    const records = this.storage.getRecords(options) as UsageRecord[];
    return exportToJSON(records, options);
  }

  /**
   * Export usage data or aggregated reports as RFC 4180 compliant CSV.
   */
  public exportCSV(options?: ExportOptions): string {
    const type = options?.type || 'records';
    if (type === 'models') {
      const report = this.getModelReport(options);
      return exportModelReportToCSV(report);
    }
    if (type === 'users') {
      const report = this.getAllUsersReport(options);
      return exportUsersReportToCSV(report);
    }
    if (type === 'features') {
      const report = this.getAllFeaturesReport(options);
      return exportFeaturesReportToCSV(report);
    }

    const records = this.storage.getRecords(options) as UsageRecord[];
    return exportRecordsToCSV(records);
  }

  /**
   * Export an interactive visual HTML analytics report.
   */
  public exportHTML(options?: HTMLExportOptions & ModelReportOptions): string {
    const report = this.getModelReport(options);
    return exportToHTML(report, options);
  }

  /**
   * Get raw records matching the filter.
   */
  public getRecords(filter?: RecordFilter): UsageRecord[] {
    return this.storage.getRecords(filter) as UsageRecord[];
  }

  /**
   * Clear all recorded usage data.
   */
  public clear(): void {
    this.storage.clear();
  }
}
