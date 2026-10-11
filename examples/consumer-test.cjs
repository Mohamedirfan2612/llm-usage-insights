const { UsageTracker } = require('../dist/index.cjs');

const tracker = new UsageTracker();
const rec = tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  inputTokens: 1000,
  outputTokens: 500
});

console.log('CJS Consumer Test Passed! Total tokens:', rec.totalTokens, 'Cost:', rec.estimatedCost);
