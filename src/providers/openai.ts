import type { UsageTracker } from '../tracker.js';
import type { UsageRecord } from '../types.js';

export interface ProviderCallContext {
  userId?: string;
  feature?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface OpenAIUsageMetadata {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
}

export interface OpenAIResponseLike {
  id?: string;
  model: string;
  usage?: OpenAIUsageMetadata;
}

/**
 * Extracts usage statistics from an OpenAI response object.
 */
export function extractOpenAIUsage(response: OpenAIResponseLike): {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  totalTokens: number;
} | null {
  if (!response || !response.usage) {
    return null;
  }

  const inputTokens = response.usage.prompt_tokens ?? 0;
  const outputTokens = response.usage.completion_tokens ?? 0;
  const cachedTokens = response.usage.prompt_tokens_details?.cached_tokens ?? 0;
  const totalTokens = response.usage.total_tokens ?? inputTokens + outputTokens;

  return {
    model: response.model,
    inputTokens,
    outputTokens,
    cachedTokens,
    totalTokens
  };
}

/**
 * Records usage directly from an OpenAI API response object.
 */
export function recordOpenAIResponse(
  tracker: UsageTracker,
  response: OpenAIResponseLike,
  context?: ProviderCallContext & { latencyMs?: number }
): UsageRecord | null {
  const extracted = extractOpenAIUsage(response);
  if (!extracted) {
    return null;
  }

  return tracker.record({
    provider: 'openai',
    model: extracted.model,
    requestId: context?.requestId || response.id,
    userId: context?.userId,
    feature: context?.feature,
    inputTokens: extracted.inputTokens,
    outputTokens: extracted.outputTokens,
    cachedTokens: extracted.cachedTokens,
    totalTokens: extracted.totalTokens,
    cachedTokensIncludedInInput: true, // OpenAI prompt_tokens includes cached_tokens
    latencyMs: context?.latencyMs,
    metadata: context?.metadata
  });
}

/**
 * Wraps an OpenAI client instance, automatically tracking token consumption,
 * latency, and estimated cost on chat completion calls without altering response behavior.
 */
export function wrapOpenAI<T extends { chat: { completions: { create: (...args: any[]) => any } } }>(
  client: T,
  tracker: UsageTracker,
  defaultContext?: ProviderCallContext
): T {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = (async (body: any, options?: any) => {
    const startTime = Date.now();
    const model = body?.model || 'unknown';
    const isStream = Boolean(body?.stream);

    try {
      const response = await originalCreate(body, options);

      if (isStream && response && typeof response[Symbol.asyncIterator] === 'function') {
        // Wrap async generator for streaming responses
        return wrapOpenAIStream(response, tracker, {
          model,
          startTime,
          context: defaultContext
        });
      }

      // Non-streaming response
      const latencyMs = Date.now() - startTime;
      if (response && response.usage) {
        recordOpenAIResponse(tracker, response, {
          ...defaultContext,
          latencyMs
        });
      }

      return response;
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      // Record failed request without counting tokens
      tracker.record({
        provider: 'openai',
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
 * Wraps an OpenAI async stream to intercept token usage metadata in the final chunk
 * when stream_options: { include_usage: true } is configured.
 */
async function* wrapOpenAIStream(
  stream: AsyncIterable<any>,
  tracker: UsageTracker,
  info: { model: string; startTime: number; context?: ProviderCallContext }
): AsyncGenerator<any, void, unknown> {
  let capturedUsage: OpenAIUsageMetadata | undefined;
  let model = info.model;
  let responseId: string | undefined;

  try {
    for await (const chunk of stream) {
      if (chunk.model) {
        model = chunk.model;
      }
      if (chunk.id) {
        responseId = chunk.id;
      }
      if (chunk.usage) {
        capturedUsage = chunk.usage;
      }
      yield chunk;
    }

    const latencyMs = Date.now() - info.startTime;
    if (capturedUsage) {
      recordOpenAIResponse(
        tracker,
        {
          id: responseId,
          model,
          usage: capturedUsage
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
      provider: 'openai',
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
