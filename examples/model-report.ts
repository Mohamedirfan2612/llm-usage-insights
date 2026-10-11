import { UsageTracker } from '../src/index.js';

const tracker = new UsageTracker({
  pricing: {
    // Custom model pricing override
    'custom:local-llama3': {
      inputPricePerMillion: 0.2,
      outputPricePerMillion: 0.2,
      currency: 'USD'
    }
  }
});

// Simulate multi-model requests
const models = [
  { provider: 'openai', model: 'gpt-4o', input: 3200, output: 850, cached: 1200 },
  { provider: 'openai', model: 'gpt-4o-mini', input: 12000, output: 2400, cached: 4000 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', input: 4500, output: 1200, cached: 800 },
  { provider: 'custom', model: 'local-llama3', input: 8000, output: 2000, cached: 0 }
];

for (const m of models) {
  tracker.record({
    provider: m.provider,
    model: m.model,
    inputTokens: m.input,
    outputTokens: m.output,
    cachedTokens: m.cached
  });
}

// 1. Report sorted by highest cost
console.log('\n=== SORTED BY HIGHEST ESTIMATED COST ===');
const costReport = tracker.getModelReport({ sortBy: 'estimatedCost', order: 'desc' });
for (const m of costReport.models) {
  console.log(
    `• ${m.provider}:${m.model} -> Cost: $${m.estimatedCost.toFixed(4)} (${m.percentageOfTotalCost}% of total spend), Requests: ${m.requests}`
  );
}

// 2. Report sorted by highest total tokens
console.log('\n=== SORTED BY HIGHEST TOTAL TOKENS ===');
const tokenReport = tracker.getModelReport({ sortBy: 'totalTokens', order: 'desc' });
for (const m of tokenReport.models) {
  console.log(
    `• ${m.provider}:${m.model} -> Total Tokens: ${m.totalTokens.toLocaleString()} (${m.percentageOfTotalTokens}% of total tokens)`
  );
}
