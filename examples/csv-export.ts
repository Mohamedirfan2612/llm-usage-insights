import { UsageTracker } from '../src/index.js';

const tracker = new UsageTracker();

tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  userId: 'user_finance_01',
  feature: 'report_generator',
  inputTokens: 3500,
  outputTokens: 1200,
  cachedTokens: 1000
});

tracker.record({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet',
  userId: 'user_support_02',
  feature: 'ticket_classifier',
  inputTokens: 1800,
  outputTokens: 400
});

// 1. Export Model Summary to CSV
console.log('=== CSV MODEL REPORT ===');
const modelCsv = tracker.exportCSV({ type: 'models' });
console.log(modelCsv);

// 2. Export Raw Records to CSV
console.log('\n=== CSV RAW RECORDS ===');
const recordsCsv = tracker.exportCSV({ type: 'records' });
console.log(recordsCsv);
