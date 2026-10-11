import type { UsageTracker } from '../tracker.js';
import type { UsageRecord } from '../types.js';
import type { ProviderCallContext } from './openai.js';

export interface AnthropicUsageMetadata {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

export interface AnthropicResponseLike {
  id?: string;
  model: string;
  usage?: AnthropicUsageMetadata;
}

/**
 * Extracts usage statistics from an Anthropic message response object.
 */
export function extractAnthropicUsage(response: AnthropicResponseLike): {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
} | null {
  if (!response || !response.usage) {
    return null;
  }

  const inputTokens = response.usage.input_tokens ?? 0;
  const outputTokens = response.usage.output_tokens ?? 0;
  const cachedTokens = response.usage.cache_read_input_tokens ?? 0;
  // Anthropic input_tokens does not include cache_read_input_tokens
  const totalTokens = inputTokens + cachedTokens + outputTokens;

  return {
    model: response.model,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens
  };
}

/**
 * Records usage directly from an Anthropic API response object.
 */
export function recordAnthropicResponse(
  tracker: UsageTracker,
  response: AnthropicResponseLike,
  context?: ProviderCallContext & { latencyMs?: number }
): UsageRecord | null {
  const extracted = extractAnthropicUsage(response);
  if (!extracted) {
    return null;
  }

  return tracker.record({
    provider: 'anthropic',
    model: extracted.model,
    requestId: context?.requestId || response.id,
    userId: context?.userId,
    feature: context?.feature,
    inputTokens: extracted.inputTokens,
    outputTokens: extracted.outputTokens,
    cachedTokens: extracted.cachedTokens,
    totalTokens: extracted.totalTokens,
    cachedTokensIncludedInInput: false, // In Anthropic, input_tokens is separate from cache_read_input_tokens
    latencyMs: context?.latencyMs,
    metadata: context?.metadata
  });
}

/**
 * Wraps an Anthropic client instance, automatically capturing tokens and calculating costs.
 */
export function wrapAnthropic<T extends { messages: { create: (...args: any[]) => any } }>(
  client: T,
  tracker: UsageTracker,
  defaultContext?: ProviderCallContext
): T {
  const originalCreate = client.messages.create.bind(client.messages);

  client.messages.create = (async (body: any, options?: any) => {
    const startTime = Date.now();
    const model = body?.model || 'unknown';
    const isStream = Boolean(body?.stream);

    try {
      const response = await originalCreate(body, options);

      if (isStream && response && typeof response[Symbol.asyncIterator] === 'function') {
        return wrapAnthropicStream(response, tracker, {
          model,
          startTime,
          context: defaultContext
        });
      }

      const latencyMs = Date.now() - startTime;
      if (response && response.usage) {
        recordAnthropicResponse(tracker, response, {
          ...defaultContext,
          latencyMs
        });
      }

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      tracker.record({
        provider: 'anthropic',
        model,
        requestId: defaultContext?.requestId,
        userId: defaultContext?.userId,
        feature: defaultContext?.feature,
        inputTokens: 0,
        outputTokens: 0,
        status: 'error',
        latencyMs,
        metadata: {
          ...defaultContext?.metadata,
          error: error instanceof Error ? error.name : 'UnknownError'
        }
      });
      throw error;
    }
  }) as any;

  return client;
}

/**
 * Wraps Anthropic streaming response to accumulate token counts from message_start and message_delta.
 */
async function* wrapAnthropicStream(
  stream: AsyncIterable<any>,
  tracker: UsageTracker,
  info: { model: string; startTime: number; context?: ProviderCallContext }
): AsyncGenerator<any, void, unknown> {
  let model = info.model;
  let responseId: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedTokens = 0;

  try {
    for await (const chunk of stream) {
      if (chunk.type === 'message_start' && chunk.message) {
        if (chunk.message.model) model = chunk.message.model;
        if (chunk.message.id) responseId = chunk.message.id;
        if (chunk.message.usage) {
          inputTokens = chunk.message.usage.input_tokens ?? 0;
          cachedTokens = chunk.message.usage.cache_read_input_tokens ?? 0;
        }
      } else if (chunk.type === 'message_delta' && chunk.usage) {
        if (typeof chunk.usage.output_tokens === 'number') {
          outputTokens = chunk.usage.output_tokens;
        }
      }
      yield chunk;
    }

    const latencyMs = Date.now() - info.startTime;
    if (inputTokens > 0 || outputTokens > 0 || cachedTokens > 0) {
      recordAnthropicResponse(
        tracker,
        {
          id: responseId,
          model,
          usage: {
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            cache_read_input_tokens: cachedTokens
          }
        },
        {
          ...info.context,
          latencyMs
        }
      );
    }
  } catch (error) {
    const latencyMs = Date.now() - info.startTime;
    tracker.record({
      provider: 'anthropic',
      model,
      requestId: responseId || info.context?.requestId,
      userId: info.context?.userId,
      feature: info.context?.feature,
      inputTokens: 0,
      outputTokens: 0,
      status: 'error',
      latencyMs,
      metadata: {
        ...info.context?.metadata,
        error: error instanceof Error ? error.name : 'UnknownError'
      }
    });
    throw error;
  }
}
