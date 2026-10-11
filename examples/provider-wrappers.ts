import { recordOpenAIResponse, recordAnthropicResponse, UsageTracker, wrapOpenAI } from '../src/index.js';

const tracker = new UsageTracker();

console.log('=== METHOD 1: Wrapping OpenAI Client ===');
// Simulated OpenAI Client
const fakeOpenAI = {
  chat: {
    completions: {
      create: async (body: any) => ({
        id: 'chatcmpl-mock-123',
        model: body.model,
        choices: [{ message: { role: 'assistant', content: 'Here is your generated answer.' } }],
        usage: {
          prompt_tokens: 1400,
          completion_tokens: 350,
          total_tokens: 1750,
          prompt_tokens_details: {
            cached_tokens: 400
          }
        }
      })
    }
  }
};

const wrappedClient = wrapOpenAI(fakeOpenAI, tracker, {
  userId: 'client_wrap_user',
  feature: 'smart_search'
});

await wrappedClient.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Search query' }]
});

console.log('=== METHOD 2: Direct Response Recording ===');
// Works with any standard response from OpenAI, Anthropic, or compatible proxy
const mockAnthropicResponse = {
  id: 'msg_mock_456',
  model: 'claude-3-5-sonnet',
  content: [{ type: 'text', text: 'Document analyzed.' }],
  usage: {
    input_tokens: 2800,
    output_tokens: 650,
    cache_read_input_tokens: 1200
  }
};

recordAnthropicResponse(tracker, mockAnthropicResponse, {
  userId: 'analyst_01',
  feature: 'pdf_analyzer',
  latencyMs: 420
});

const report = tracker.getModelReport();
console.table(
  report.models.map((m) => ({
    Model: `${m.provider}:${m.model}`,
    Requests: m.requests,
    Tokens: m.totalTokens.toLocaleString(),
    Cost: `$${m.estimatedCost.toFixed(4)}`
  }))
);
