import { UsageTracker } from '../src/index.js';

// Initialize the tracker
const tracker = new UsageTracker();

// Record sample LLM interactions
tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  userId: 'user_dev_01',
  feature: 'code_assistant',
  inputTokens: 1250,
  outputTokens: 480
});

tracker.record({
  provider: 'anthropic',
  model: 'claude-3-5-sonnet',
  userId: 'user_dev_02',
  feature: 'doc_summarizer',
  inputTokens: 2400,
  outputTokens: 850
});

tracker.record({
  provider: 'openai',
  model: 'gpt-4o-mini',
  userId: 'user_dev_01',
  feature: 'grammar_check',
  inputTokens: 450,
  outputTokens: 120
});

// Generate and display model analytics report
const modelReport = tracker.getModelReport({
  sortBy: 'totalTokens',
  order: 'desc'
});

console.log('--- MODEL USAGE REPORT ---');
console.log(`Total Requests: ${modelReport.totalRequests}`);
console.log(`Total Tokens: ${modelReport.totalTokens.toLocaleString()}`);
console.log(`Total Cost: $${modelReport.totalEstimatedCost.toFixed(4)}`);
console.table(
  modelReport.models.map((m) => ({
    Model: `${m.provider}:${m.model}`,
    Requests: m.requests,
    Tokens: m.totalTokens.toLocaleString(),
    'Cost ($)': `$${m.estimatedCost.toFixed(4)}`,
    '% Tokens': `${m.percentageOfTotalTokens}%`,
    '% Cost': `${m.percentageOfTotalCost}%`
  }))
);
