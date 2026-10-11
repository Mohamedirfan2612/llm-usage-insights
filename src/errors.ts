/**
 * Custom error hierarchy for llm-usage-insights
 */

export class UsageInsightsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UsageInsightsError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PricingNotFoundError extends UsageInsightsError {
  public readonly provider: string;
  public readonly model: string;

  constructor(provider: string, model: string, message?: string) {
    super(message || `Pricing not found for model "${model}" under provider "${provider}".`);
    this.name = 'PricingNotFoundError';
    this.provider = provider;
    this.model = model;
  }
}

export class BudgetExceededError extends UsageInsightsError {
  public readonly scope: 'user' | 'feature' | 'global';
  public readonly targetId?: string;
  public readonly limit: number;
  public readonly currentSpend: number;

  constructor(
    scope: 'user' | 'feature' | 'global',
    limit: number,
    currentSpend: number,
    targetId?: string,
    message?: string
  ) {
    const targetDesc = targetId ? ` ("${targetId}")` : '';
    super(
      message ||
        `Budget limit of $${limit.toFixed(4)} exceeded for ${scope}${targetDesc}. Current spend: $${currentSpend.toFixed(4)}.`
    );
    this.name = 'BudgetExceededError';
    this.scope = scope;
    this.targetId = targetId;
    this.limit = limit;
    this.currentSpend = currentSpend;
  }
}

export class InvalidRecordError extends UsageInsightsError {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'InvalidRecordError';
    this.field = field;
  }
}

export class StorageError extends UsageInsightsError {
  public readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}
