import { UsageTracker } from '../src/index.js';

const tracker = new UsageTracker({
  // Configure budget with 80% threshold warning and strict limit
  userBudgets: {
    user_test: {
      limit: 0.05, // $0.05 budget
      period: 'monthly',
      warningThreshold: 0.8 // warning at $0.04
    }
  },
  onBudgetWarning: (alert) => {
    console.warn(`[BUDGET WARNING] ${alert.scope} '${alert.targetId}' reached ${alert.percentageUsed}% of limit ($${alert.currentSpend}/$${alert.limit})`);
  },
  onBudgetExceeded: (alert) => {
    console.error(`[BUDGET EXCEEDED] ${alert.scope} '${alert.targetId}' exceeded limit! Spend: $${alert.currentSpend}/$${alert.limit}`);
  }
});

console.log('--- Simulating Request 1 ($0.035 spend, ~70% of budget) ---');
tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  userId: 'user_test',
  inputTokens: 10000,
  outputTokens: 1000
});

console.log('\n--- Simulating Request 2 (adds $0.010 spend -> total $0.045, triggers 80% warning) ---');
tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  userId: 'user_test',
  inputTokens: 4000,
  outputTokens: 0
});

console.log('\n--- Simulating Request 3 (adds $0.020 spend -> total $0.065, triggers exceeded alert) ---');
tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  userId: 'user_test',
  inputTokens: 8000,
  outputTokens: 0
});

const userReport = tracker.getUserReport('user_test');
console.log('\nUser Report Budget Status:');
console.log({
  spent: `$${userReport.budget?.currentSpend}`,
  limit: `$${userReport.budget?.limit}`,
  pctUsed: `${userReport.budget?.percentageUsed}%`,
  isExceeded: userReport.budget?.isExceeded
});
