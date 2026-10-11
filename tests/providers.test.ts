import { describe, expect, it } from 'vitest';
import {
  extractAnthropicUsage,
  extractOpenAIUsage,
  recordAnthropicResponse,
  recordOpenAIResponse,
  wrapAnthropic,
  wrapOpenAI
} from '../src/providers/index.js';
import { UsageTracker } from '../src/tracker.js';

describe('Provider Integrations', () => {
  describe('OpenAI Integration', () => {
    it('extracts OpenAI usage including cached tokens', () => {
      const mockResponse = {
        id: 'chatcmpl-123',
        model: 'gpt-4o',
        usage: {
          prompt_tokens: 1500,
          completion_tokens: 400,
          total_tokens: 1900,
          prompt_tokens_details: {
            cached_tokens: 500
          }
        }
      };

      const extracted = extractOpenAIUsage(mockResponse);
      expect(extracted).not.toBeNull();
      expect(extracted?.model).toBe('gpt-4o');
      expect(extracted?.inputTokens).toBe(1500);
      expect(extracted?.outputTokens).toBe(400);
      expect(extracted?.cachedTokens).toBe(500);
      expect(extracted?.totalTokens).toBe(1900);
    });

    it('records OpenAI response with tracker', () => {
      const tracker = new UsageTracker();
      const mockResponse = {
        id: 'chatcmpl-456',
        model: 'gpt-4o-mini',
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500
        }
      };

      const record = recordOpenAIResponse(tracker, mockResponse, {
        userId: 'dev_user',
        feature: 'chat',
        latencyMs: 180
      });

      expect(record).not.toBeNull();
      expect(record?.provider).toBe('openai');
      expect(record?.model).toBe('gpt-4o-mini');
      expect(record?.userId).toBe('dev_user');
      expect(record?.feature).toBe('chat');
      expect(record?.latencyMs).toBe(180);
      expect(record?.costStatus).toBe('calculated');
      expect(record?.estimatedCost).toBeGreaterThan(0);
    });

    it('wraps OpenAI client and records usage on non-streaming calls while preserving original response', async () => {
      const tracker = new UsageTracker();

      const mockResponse = {
        id: 'chatcmpl-789',
        model: 'gpt-4o',
        choices: [{ message: { role: 'assistant', content: 'Secret response' } }],
        usage: {
          prompt_tokens: 800,
          completion_tokens: 200,
          total_tokens: 1000
        }
      };

      const fakeClient = {
        chat: {
          completions: {
            create: async (_body: any) => mockResponse
          }
        }
      };

      const wrapped = wrapOpenAI(fakeClient, tracker, { userId: 'alice', feature: 'search' });

      const response = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Top secret prompt' }]
      });

      expect(response).toEqual(mockResponse);

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      const rec = records[0]!;
      expect(rec.provider).toBe('openai');
      expect(rec.model).toBe('gpt-4o');
      expect(rec.inputTokens).toBe(800);
      expect(rec.outputTokens).toBe(200);
      expect(rec.totalTokens).toBe(1000);
      expect(rec.userId).toBe('alice');

      expect(JSON.stringify(rec)).not.toContain('Top secret prompt');
      expect(JSON.stringify(rec)).not.toContain('Secret response');
    });

    it('wraps OpenAI streaming call and captures usage from final chunk', async () => {
      const tracker = new UsageTracker();

      async function* generateChunks() {
        yield { id: 'stream-1', model: 'gpt-4o', choices: [{ delta: { content: 'chunk1' } }] };
        yield { id: 'stream-1', model: 'gpt-4o', choices: [{ delta: { content: 'chunk2' } }] };
        yield {
          id: 'stream-1',
          model: 'gpt-4o',
          choices: [],
          usage: { prompt_tokens: 500, completion_tokens: 150, total_tokens: 650 }
        };
      }

      const fakeClient = {
        chat: {
          completions: {
            create: async (_body: any) => generateChunks()
          }
        }
      };

      const wrapped = wrapOpenAI(fakeClient, tracker, { userId: 'stream_user' });

      const stream = await wrapped.chat.completions.create({
        model: 'gpt-4o',
        stream: true,
        stream_options: { include_usage: true },
        messages: [{ role: 'user', content: 'test stream' }]
      });

      const collected: any[] = [];
      for await (const chunk of stream) {
        collected.push(chunk);
      }

      expect(collected).toHaveLength(3);

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.inputTokens).toBe(500);
      expect(records[0]?.outputTokens).toBe(150);
      expect(records[0]?.userId).toBe('stream_user');
    });

    it('handles failed OpenAI API requests by logging status error with 0 tokens and rethrowing', async () => {
      const tracker = new UsageTracker();

      const fakeClient = {
        chat: {
          completions: {
            create: async () => {
              throw new Error('OpenAI 429 Rate Limit Exceeded');
            }
          }
        }
      };

      const wrapped = wrapOpenAI(fakeClient, tracker, { userId: 'bob' });

      await expect(
        wrapped.chat.completions.create({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'test' }]
        })
      ).rejects.toThrow('OpenAI 429 Rate Limit Exceeded');

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      const rec = records[0]!;
      expect(rec.status).toBe('error');
      expect(rec.inputTokens).toBe(0);
      expect(rec.outputTokens).toBe(0);
      expect(rec.totalTokens).toBe(0);
      expect(rec.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Anthropic Integration', () => {
    it('extracts Anthropic usage with prompt caching', () => {
      const mockResponse = {
        id: 'msg-123',
        model: 'claude-3-5-sonnet-20241022',
        usage: {
          input_tokens: 1000,
          output_tokens: 300,
          cache_read_input_tokens: 2000,
          cache_creation_input_tokens: 500
        }
      };

      const extracted = extractAnthropicUsage(mockResponse);
      expect(extracted).not.toBeNull();
      expect(extracted?.model).toBe('claude-3-5-sonnet-20241022');
      expect(extracted?.inputTokens).toBe(1000);
      expect(extracted?.outputTokens).toBe(300);
      expect(extracted?.cachedTokens).toBe(2000);
      expect(extracted?.totalTokens).toBe(3300);
    });

    it('wraps Anthropic client and records non-streaming message usage', async () => {
      const tracker = new UsageTracker();

      const mockResponse = {
        id: 'msg-abc',
        model: 'claude-3-5-sonnet',
        content: [{ type: 'text', text: 'Anthropic reply' }],
        usage: {
          input_tokens: 500,
          output_tokens: 250,
          cache_read_input_tokens: 100
        }
      };

      const fakeClient = {
        messages: {
          create: async () => mockResponse
        }
      };

      const wrapped = wrapAnthropic(fakeClient, tracker, { feature: 'code-review' });

      const response = await wrapped.messages.create({
        model: 'claude-3-5-sonnet',
        max_tokens: 1000,
        messages: [{ role: 'user', content: 'review code' }]
      });

      expect(response).toEqual(mockResponse);

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      const rec = records[0]!;
      expect(rec.provider).toBe('anthropic');
      expect(rec.model).toBe('claude-3-5-sonnet');
      expect(rec.inputTokens).toBe(500);
      expect(rec.outputTokens).toBe(250);
      expect(rec.cachedTokens).toBe(100);
      expect(rec.feature).toBe('code-review');
      expect(rec.estimatedCost).toBeGreaterThan(0);
    });

    it('wraps Anthropic streaming response and captures tokens across events', async () => {
      const tracker = new UsageTracker();

      async function* generateStream() {
        yield {
          type: 'message_start',
          message: {
            id: 'msg-stream-1',
            model: 'claude-3-5-haiku',
            usage: { input_tokens: 800, cache_read_input_tokens: 100 }
          }
        };
        yield { type: 'content_block_delta', delta: { text: 'chunk' } };
        yield {
          type: 'message_delta',
          usage: { output_tokens: 350 }
        };
      }

      const fakeClient = {
        messages: {
          create: async () => generateStream()
        }
      };

      const wrapped = wrapAnthropic(fakeClient, tracker, { userId: 'anthropic_user' });

      const stream = await wrapped.messages.create({
        model: 'claude-3-5-haiku',
        stream: true,
        messages: [{ role: 'user', content: 'test stream' }]
      });

      for await (const chunk of stream) {
        expect(chunk).toBeDefined();
      }

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      const rec = records[0]!;
      expect(rec.provider).toBe('anthropic');
      expect(rec.model).toBe('claude-3-5-haiku');
      expect(rec.inputTokens).toBe(800);
      expect(rec.cachedTokens).toBe(100);
      expect(rec.outputTokens).toBe(350);
      expect(rec.userId).toBe('anthropic_user');
    });

    it('handles failed Anthropic API requests', async () => {
      const tracker = new UsageTracker();

      const fakeClient = {
        messages: {
          create: async () => {
            throw new Error('Anthropic Overloaded 529');
          }
        }
      };

      const wrapped = wrapAnthropic(fakeClient, tracker, { userId: 'charlie' });

      await expect(
        wrapped.messages.create({
          model: 'claude-3-5-sonnet',
          messages: [{ role: 'user', content: 'test' }]
        })
      ).rejects.toThrow('Anthropic Overloaded 529');

      const records = tracker.getRecords();
      expect(records).toHaveLength(1);
      expect(records[0]?.status).toBe('error');
      expect(records[0]?.inputTokens).toBe(0);
      expect(records[0]?.outputTokens).toBe(0);
    });
  });
});
