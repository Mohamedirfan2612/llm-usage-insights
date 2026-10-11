import { UsageTracker } from '../dist/index.js';

const tracker = new UsageTracker();
const rec = tracker.record({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet',
  inputTokens: 2000,
  outputTokens: 500
});

console.log('ESM Consumer Test Passed! Total tokens:', rec.totalTokens, 'Cost:', rec.estimatedCost);
