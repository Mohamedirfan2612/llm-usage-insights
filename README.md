# llm-usage-insights

[![CI](https://github.com/Mohamedirfan2612/llm-usage-insights/actions/workflows/test.yml/badge.svg)](https://github.com/Mohamedirfan2612/llm-usage-insights/actions/workflows/test.yml)
[![npm version](https://img.shields.io/npm/v/llm-usage-insights.svg)](https://www.npmjs.com/package/llm-usage-insights)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org)

Lightweight, production-ready LLM token analytics, model-wise cost reports, and usage tracking for Node.js and TypeScript.

`llm-usage-insights` runs directly inside your Node.js or TypeScript application without requiring external servers, SaaS agents, or remote database infrastructure.

---

## Highlights

- **Model-Wise Token & Cost Analytics**: Accurately breakdown input tokens, output tokens, cached tokens, and total costs.
- **Configurable Pricing Registry**: Pre-loaded with current pricing for OpenAI, Anthropic, Google Gemini, and DeepSeek, with support for custom models and overrides.
- **Spending Budgets & Alert Thresholds**: Enforce optional monthly, weekly, or daily spending limits for individual users, features, or the entire application with configurable warning triggers (e.g., 80%).
- **Multi-Format Exports**: Export RFC 4180-compliant CSV, structured JSON, or self-contained offline HTML visual dashboards.
- **Zero-Invasive Provider Adapters**: Optional, lightweight wrappers for official OpenAI and Anthropic SDKs that capture usage and latency without altering existing return values.
- **Privacy First**: Never captures or stores prompt text, completion text, personal data, or API keys.
- **Dual ESM & CommonJS**: Full TypeScript typings (`.d.ts`) and support for modern ESM and classic CommonJS runtimes.

---

## Installation

```bash
npm install llm-usage-insights
```

If you plan to use the optional official provider wrappers, ensure their respective SDKs are installed:

```bash
# Optional: for OpenAI or Anthropic SDK wrappers
npm install openai @anthropic-ai/sdk
```

---

## Quick Start

```typescript
import { UsageTracker } from 'llm-usage-insights';

const tracker = new UsageTracker();

// Record an LLM completion
tracker.record({
  provider: 'openai',
  model: 'gpt-4o',
  userId: 'user_123',
  feature: 'chatbot',
  inputTokens: 1000,
  outputTokens: 500
});

// Generate model analytics report
const report = tracker.getModelReport({
  sortBy: 'totalTokens',
  order: 'desc'
});

console.log(report);
```

Sample output:

```json
{
  "totalRequests": 1,
  "totalTokens": 1500,
  "totalInputTokens": 1000,
  "totalOutputTokens": 500,
  "totalCachedTokens": 0,
  "totalEstimatedCost": 0.0075,
  "currency": "USD",
  "models": [
    {
      "provider": "openai",
      "model": "gpt-4o",
      "requests": 1,
      "successfulRequests": 1,
      "failedRequests": 0,
      "inputTokens": 1000,
      "outputTokens": 500,
      "cachedTokens": 0,
      "totalTokens": 1500,
      "estimatedCost": 0.0075,
      "hasUnavailableCosts": false,
      "averageTokensPerRequest": 1500,
      "averageCostPerRequest": 0.0075,
      "percentageOfTotalTokens": 100,
      "percentageOfTotalCost": 100,
      "averageLatencyMs": null
    }
  ],
  "generatedAt": "2026-10-11T16:30:00.000Z"
}
```

---

## Core Features & Usage

### 1. Model-Wise Analytics

Group usage by provider and model, with sorting by tokens, costs, or request count:

```typescript
const modelReport = tracker.getModelReport({
  sortBy: 'estimatedCost', // 'totalTokens' | 'inputTokens' | 'outputTokens' | 'estimatedCost' | 'requests'
  order: 'desc',           // 'desc' | 'asc'
  from: new Date('2026-10-01'),
  to: new Date('2026-10-31')
});

for (const model of modelReport.models) {
  console.log(`${model.provider}:${model.model} - Tokens: ${model.totalTokens}, Cost: $${model.estimatedCost}`);
}
```

### 2. User & Feature Reports

Inspect spending and token allocation per user or product feature:

```typescript
// Specific user report
const userReport = tracker.getUserReport('user_123');
console.log(`User spent: $${userReport.estimatedCost} across ${userReport.requests} requests`);

// All users aggregated
const allUsers = tracker.getAllUsersReport();

// Feature breakdown
const featureReport = tracker.getFeatureReport('semantic_search');
const allFeatures = tracker.getAllFeaturesReport();
```

### 3. Time-Based Analytics

Aggregate interactions into daily, weekly, or monthly intervals:

```typescript
const dailyReport = tracker.getReport({
  groupBy: 'day', // 'day' | 'week' | 'month'
  from: '2026-10-01',
  to: '2026-10-31',
  inclusiveEndDate: true
});

for (const interval of dailyReport.intervals) {
  console.log(`${interval.label} -> ${interval.totalTokens} tokens, $${interval.estimatedCost}`);
}
```

### 4. Configurable Pricing Registry

Model pricing is denominated per million tokens and accurately accounts for prompt cache hits:

```typescript
const tracker = new UsageTracker({
  pricing: {
    // Override or register custom models
    'my-provider:custom-llama-3': {
      inputPricePerMillion: 0.20,
      outputPricePerMillion: 0.20,
      cachedInputPricePerMillion: 0.05,
      currency: 'USD'
    }
  }
});
```

- **Unknown Models**: If pricing for a model is not found, `llm-usage-insights` will **never silently invent a price**. The record will have `costStatus: 'unavailable'` and `estimatedCost: null`.
- **Cached Tokens**: Handles prompt caching for OpenAI (cached tokens included in `prompt_tokens`) and Anthropic (cached tokens reported separately) without double counting.

### 5. Spending Budgets & Alert Thresholds

Set spending caps on users, features, or the entire application:

```typescript
const tracker = new UsageTracker({
  userBudgets: {
    user_123: {
      limit: 10.0,            // $10.00 spending limit
      period: 'monthly',       // 'daily' | 'weekly' | 'monthly' | 'total'
      warningThreshold: 0.8    // Triggers warning at 80% ($8.00)
    }
  },
  globalBudget: {
    limit: 500.0,
    period: 'monthly'
  },
  onBudgetWarning: (alert) => {
    console.warn(`[WARNING] ${alert.scope} ${alert.targetId} reached ${alert.percentageUsed}% of budget!`);
  },
  onBudgetExceeded: (alert) => {
    console.error(`[EXCEEDED] ${alert.scope} ${alert.targetId} has exceeded budget limit of $${alert.limit}!`);
  }
});

// Check budget programmatically before invoking an LLM call:
const check = tracker.checkBudget({ userId: 'user_123', estimatedCost: 0.05 });
if (!check.allowed) {
  throw new Error(`Budget exceeded: ${check.reason}`);
}
```

> **Note on Persistence**: The default in-memory budget manager operates within the local Node.js process. For multi-instance distributed clusters, supply a custom `StorageAdapter`.

### 6. RFC 4180 CSV & JSON Exports

Export data for downstream spreadsheet analysis or billing pipelines:

```typescript
// Export raw usage records to RFC 4180 CSV
const recordsCsv = tracker.exportCSV({ type: 'records' });

// Export model-wise summary report to CSV
const modelCsv = tracker.exportCSV({ type: 'models' });

// Export JSON
const jsonOutput = tracker.exportJSON({ type: 'models', pretty: true });
```

### 7. Self-Contained HTML Analytics Dashboard

Export a responsive, zero-dependency HTML dashboard:

```typescript
import fs from 'node:fs';

const html = tracker.exportHTML({
  title: 'Production LLM Analytics',
  sortBy: 'estimatedCost'
});

fs.writeFileSync('dashboard.html', html);
```

- Adheres to high-agency frontend directives: zero emojis, pure SVG icons, dark zinc color palette, monospace tabular figures, and clean bento metrics.

---

## Official Provider Wrappers

### OpenAI Wrapper

Wrap your existing `OpenAI` client:

```typescript
import OpenAI from 'openai';
import { UsageTracker, wrapOpenAI } from 'llm-usage-insights';

const openai = new OpenAI();
const tracker = new UsageTracker();

// Wrap client to automatically capture usage metadata and latency
const ai = wrapOpenAI(openai, tracker, {
  userId: 'customer_42',
  feature: 'search'
});

// Regular non-streaming call
const response = await ai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Explain quantum computing.' }]
});

// Streaming calls (requires stream_options: { include_usage: true } for tokens)
const stream = await ai.chat.completions.create({
  model: 'gpt-4o-mini',
  stream: true,
  stream_options: { include_usage: true },
  messages: [{ role: 'user', content: 'Write a poem.' }]
});
```

### Anthropic Wrapper

Wrap your existing `Anthropic` client:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { UsageTracker, wrapAnthropic } from 'llm-usage-insights';

const anthropic = new Anthropic();
const tracker = new UsageTracker();

const client = wrapAnthropic(anthropic, tracker, {
  userId: 'developer_1',
  feature: 'code_generation'
});

const message = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Refactor this code.' }]
});
```

### Direct Response Recording

If you do not want to wrap client instances, you can record responses manually:

```typescript
import { recordOpenAIResponse, recordAnthropicResponse } from 'llm-usage-insights';

recordOpenAIResponse(tracker, openAiResponse, { userId: 'alice', feature: 'chat' });
recordAnthropicResponse(tracker, anthropicResponse, { userId: 'bob', feature: 'summary' });
```

---

## Storage & Custom Adapters

By default, `UsageTracker` uses an in-memory store (`MemoryStore`). To persist records to PostgreSQL, Redis, MongoDB, or SQLite, implement the `StorageAdapter` interface:

```typescript
import type { StorageAdapter, UsageRecord, RecordFilter } from 'llm-usage-insights';

class PostgresStorageAdapter implements StorageAdapter {
  async record(entry: UsageRecord): Promise<void> {
    // await db.insertInto('llm_usage').values(entry);
  }

  async getRecords(filter?: RecordFilter): Promise<UsageRecord[]> {
    // return await db.selectFrom('llm_usage').where(...);
  }

  async clear(): Promise<void> {
    // await db.deleteFrom('llm_usage');
  }

  async count(filter?: RecordFilter): Promise<number> {
    // return await db.selectFrom('llm_usage').count();
  }
}

const tracker = new UsageTracker({
  storage: new PostgresStorageAdapter()
});
```

---

## Privacy Considerations

`llm-usage-insights` is designed with privacy and security as first principles:
- **Zero Prompt Logging**: Prompts and completions are never stored in `UsageRecord` objects.
- **Zero Secret Ingestion**: API keys and authorization headers are never intercepted, copied, or serialized.
- **Safe Serialization**: Only numeric token tallies, model identifiers, timestamps, latency measurements, and user-provided contextual metadata tags are maintained.

---

## API Reference

### `UsageTracker`

- `new UsageTracker(options?: TrackerOptions)`
- `tracker.record(input: RecordInput): UsageRecord`
- `tracker.recordEstimated(params: EstimateParams): UsageRecord`
- `tracker.getModelReport(options?: ModelReportOptions): ModelReport`
- `tracker.getUserReport(userId: string, filter?: RecordFilter): UserReport`
- `tracker.getAllUsersReport(filter?: RecordFilter): AllUsersReport`
- `tracker.getFeatureReport(feature: string, filter?: RecordFilter): FeatureReport`
- `tracker.getAllFeaturesReport(filter?: RecordFilter): AllFeaturesReport`
- `tracker.getReport(options?: TimeReportOptions): TimeReport`
- `tracker.checkBudget(context: BudgetCheckContext): BudgetCheckResult`
- `tracker.setUserBudget(userId: string, config: BudgetConfig): void`
- `tracker.setFeatureBudget(feature: string, config: BudgetConfig): void`
- `tracker.setGlobalBudget(config: BudgetConfig): void`
- `tracker.exportJSON(options?: ExportOptions): string`
- `tracker.exportCSV(options?: ExportOptions): string`
- `tracker.exportHTML(options?: HTMLExportOptions & ModelReportOptions): string`
- `tracker.getRecords(filter?: RecordFilter): UsageRecord[]`
- `tracker.clear(): void`

---

## Development & Testing

```bash
# Install dependencies
npm install

# Run unit test suite (Vitest)
npm run test

# Run TypeScript checks
npm run typecheck

# Build ESM and CommonJS bundles (tsup)
npm run build
```

---

## License

MIT © [MohamedIrfan](LICENSE)
