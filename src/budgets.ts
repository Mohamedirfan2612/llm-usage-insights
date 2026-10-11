import type {
  BudgetAlert,
  BudgetCheckResult,
  BudgetConfig,
  BudgetPeriod,
  BudgetStatus,
  StorageAdapter,
  UsageRecord
} from './types.js';

/**
 * Calculates start and end timestamps for a given budget period.
 */
export function getPeriodBounds(period: BudgetPeriod, referenceDate: Date = new Date()): { start: Date; end: Date } {
  const now = new Date(referenceDate);

  if (period === 'daily') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    return { start, end };
  }

  if (period === 'weekly') {
    const day = now.getUTCDay(); // 0 is Sunday
    const diffToMonday = day === 0 ? -6 : 1 - day; // Monday as week start
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + diffToMonday);

    const start = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    return { start, end };
  }

  if (period === 'monthly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    // Day 0 of next month is the last day of the current month
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
    return { start, end };
  }

  // 'total'
  return {
    start: new Date(0),
    end: new Date(8640000000000000)
  };
}

/**
 * Manages spending limits and warning alerts for users, features, and global application.
 *
 * NOTE ON CONCURRENCY & PERSISTENCE:
 * This in-memory budget manager tracks spending within the local process.
 * It does not provide atomic, cross-process distributed guarantees.
 * For distributed multi-instance clusters, connect a custom persistent StorageAdapter.
 */
export class BudgetManager {
  private userBudgets = new Map<string, BudgetConfig>();
  private featureBudgets = new Map<string, BudgetConfig>();
  private globalBudget?: BudgetConfig;

  private onWarning?: (alert: BudgetAlert) => void;
  private onExceeded?: (alert: BudgetAlert) => void;

  constructor(options?: {
    userBudgets?: Record<string, BudgetConfig>;
    featureBudgets?: Record<string, BudgetConfig>;
    globalBudget?: BudgetConfig;
    onWarning?: (alert: BudgetAlert) => void;
    onExceeded?: (alert: BudgetAlert) => void;
  }) {
    if (options?.userBudgets) {
      for (const [userId, config] of Object.entries(options.userBudgets)) {
        this.setUserBudget(userId, config);
      }
    }
    if (options?.featureBudgets) {
      for (const [feature, config] of Object.entries(options.featureBudgets)) {
        this.setFeatureBudget(feature, config);
      }
    }
    if (options?.globalBudget) {
      this.setGlobalBudget(options.globalBudget);
    }
    this.onWarning = options?.onWarning;
    this.onExceeded = options?.onExceeded;
  }

  public setUserBudget(userId: string, config: BudgetConfig): void {
    this.setUserBudgetsInternal(userId, { ...config, period: config.period || 'monthly' });
  }

  private setUserBudgetsInternal(userId: string, config: BudgetConfig): void {
    this.userBudgets.set(userId, config);
  }

  public setFeatureBudget(feature: string, config: BudgetConfig): void {
    this.featureBudgets.set(feature, { ...config, period: config.period || 'monthly' });
  }

  public setGlobalBudget(config: BudgetConfig): void {
    this.globalBudget = { ...config, period: config.period || 'monthly' };
  }

  public getUserBudget(userId: string): BudgetConfig | undefined {
    return this.userBudgets.get(userId);
  }

  public getFeatureBudget(feature: string): BudgetConfig | undefined {
    return this.featureBudgets.get(feature);
  }

  public getGlobalBudget(): BudgetConfig | undefined {
    return this.globalBudget;
  }

  /**
   * Evaluates the budget status for a given scope using provided usage records.
   */
  public evaluateStatus(
    config: BudgetConfig,
    records: UsageRecord[],
    additionalCost: number = 0,
    referenceDate: Date = new Date()
  ): BudgetStatus {
    const period = config.period || 'monthly';
    const { start, end } = getPeriodBounds(period, referenceDate);
    const startMs = start.getTime();
    const endMs = end.getTime();

    // Sum spend for records within period
    let currentSpend = 0;
    for (const rec of records) {
      const recMs = rec.timestamp.getTime();
      if (recMs >= startMs && recMs <= endMs && rec.estimatedCost !== null) {
        currentSpend += rec.estimatedCost;
      }
    }

    currentSpend += additionalCost;
    currentSpend = Number(currentSpend.toFixed(6));

    const remainingSpend = Math.max(0, Number((config.limit - currentSpend).toFixed(6)));
    const percentageUsed = config.limit > 0 ? Number(((currentSpend / config.limit) * 100).toFixed(2)) : 0;
    const isExceeded = currentSpend > config.limit;

    const warningThresholdFraction = config.warningThreshold ?? 0.8; // default 80%
    const isWarning = !isExceeded && currentSpend >= config.limit * warningThresholdFraction;

    return {
      limit: config.limit,
      currentSpend,
      remainingSpend,
      percentageUsed,
      isExceeded,
      isWarning,
      period,
      periodStart: start,
      periodEnd: end
    };
  }

  /**
   * Check whether an upcoming or current interaction violates any configured budgets.
   */
  public check(
    storage: StorageAdapter,
    context: { userId?: string; feature?: string; estimatedCost?: number }
  ): BudgetCheckResult {
    const cost = context.estimatedCost || 0;
    const records = storage.getRecords() as UsageRecord[]; // Synchronous for MemoryStore
    const now = new Date();

    let userStatus: BudgetStatus | undefined;
    let featureStatus: BudgetStatus | undefined;
    let globalStatus: BudgetStatus | undefined;

    // 1. User Budget Check
    if (context.userId && this.userBudgets.has(context.userId)) {
      const cfg = this.userBudgets.get(context.userId)!;
      const userRecords = records.filter((r) => r.userId === context.userId);
      userStatus = this.evaluateStatus(cfg, userRecords, cost, now);
      this.triggerAlerts('user', context.userId, userStatus);
    }

    // 2. Feature Budget Check
    if (context.feature && this.featureBudgets.has(context.feature)) {
      const cfg = this.featureBudgets.get(context.feature)!;
      const featureRecords = records.filter((r) => r.feature === context.feature);
      featureStatus = this.evaluateStatus(cfg, featureRecords, cost, now);
      this.triggerAlerts('feature', context.feature, featureStatus);
    }

    // 3. Global Budget Check
    if (this.globalBudget) {
      globalStatus = this.evaluateStatus(this.globalBudget, records, cost, now);
      this.triggerAlerts('global', undefined, globalStatus);
    }

    const isExceeded = Boolean(
      userStatus?.isExceeded || featureStatus?.isExceeded || globalStatus?.isExceeded
    );

    let reason: string | undefined;
    if (userStatus?.isExceeded) {
      reason = `User budget exceeded for "${context.userId}": $${userStatus.currentSpend} / $${userStatus.limit}`;
    } else if (featureStatus?.isExceeded) {
      reason = `Feature budget exceeded for "${context.feature}": $${featureStatus.currentSpend} / $${featureStatus.limit}`;
    } else if (globalStatus?.isExceeded) {
      reason = `Global application budget exceeded: $${globalStatus.currentSpend} / $${globalStatus.limit}`;
    }

    return {
      allowed: !isExceeded,
      reason,
      userBudget: userStatus,
      featureBudget: featureStatus,
      globalBudget: globalStatus
    };
  }

  private triggerAlerts(
    scope: 'user' | 'feature' | 'global',
    targetId: string | undefined,
    status: BudgetStatus
  ): void {
    if (status.isExceeded && this.onExceeded) {
      this.onExceeded({
        type: 'exceeded',
        scope,
        targetId,
        limit: status.limit,
        currentSpend: status.currentSpend,
        percentageUsed: status.percentageUsed,
        period: status.period,
        timestamp: new Date()
      });
    } else if (status.isWarning && this.onWarning) {
      this.onWarning({
        type: 'warning',
        scope,
        targetId,
        limit: status.limit,
        currentSpend: status.currentSpend,
        percentageUsed: status.percentageUsed,
        period: status.period,
        timestamp: new Date()
      });
    }
  }
}
