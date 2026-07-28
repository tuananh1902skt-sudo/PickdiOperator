import type { AgentDefinition, AgentRunResult } from './types';
import { getAgentPromptOverride } from '../../db';
import { getAiConfig } from '../aiConfig';
import { geminiAdapter } from './providers/gemini';
import { openaiAdapter } from './providers/openai';
import { anthropicAdapter } from './providers/anthropic';
import { grokAdapter } from './providers/grok';
import { AiProviderError } from './providers/types';
import type { AiProviderAdapter } from './providers/types';

const ADAPTERS: Record<string, AiProviderAdapter> = {
  gemini: geminiAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  grok: grokAdapter,
};

// Strips markdown code fences a model sometimes wraps JSON responses in.
function parseAiJsonResponse(rawText: string) {
  if (!rawText) return {};
  const cleanText = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleanText);
}

// Shared in-memory cache for duplicate agent calls (e.g. re-opening the same email composer).
const agentResponseCache = new Map<string, { result: any; expiresAt: number }>();

function getCachedAgentResponse(key: string) {
  const entry = agentResponseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    agentResponseCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedAgentResponse(key: string, result: any, ttlMs: number) {
  agentResponseCache.set(key, { result, expiresAt: Date.now() + ttlMs });
}

// Tracks which providers were attempted for the most recent call, purely so
// classifyAgentError can report a useful message ("Gemini quota hit, OpenAI also failed").
let lastAttemptedProviders: string[] = [];

async function enabledProviderChain() {
  return (await getAiConfig()).providers.filter(p => p.enabled && p.apiKey);
}

// Walks the configured provider chain in priority order. Falls through to the next
// provider ONLY on a quota/rate-limit error — a bad prompt, bad key, or JSON parse
// failure fails fast instead of silently burning through every provider's quota too.
async function runWithProviderChain<T>(
  run: (adapter: AiProviderAdapter, model: string, apiKey: string) => Promise<T>
): Promise<T> {
  const chain = await enabledProviderChain();
  if (chain.length === 0) {
    throw new Error('Chưa cấu hình AI provider nào — vào Settings > AI Providers để thiết lập.');
  }

  lastAttemptedProviders = [];
  let lastErr: any;

  for (const entry of chain) {
    lastAttemptedProviders.push(entry.provider);
    const adapter = ADAPTERS[entry.provider];
    if (!adapter) continue;
    try {
      return await run(adapter, entry.model, entry.apiKey);
    } catch (err: any) {
      lastErr = err;
      const isQuota = err instanceof AiProviderError ? err.isQuotaError : false;
      if (!isQuota) throw err;
      // quota error — try the next provider in the chain
    }
  }

  throw lastErr || new Error('Tất cả AI provider đã cấu hình đều thất bại.');
}

// Runs a registered agent: builds its prompt, calls the configured AI provider chain for
// strict-JSON output, parses the result, and caches it when the agent defines a cache key.
// Throws on failure — callers use handleAgentRouteError to turn that into the right HTTP
// response, or fall back to a template (outreach-specific — see server.ts bulk routes).
//
// instructionsOverride lets a caller (the Agent Prompt Studio "Test" button) preview a
// draft instructions edit without persisting it — when omitted, the saved DB override (or
// the agent's defaultInstructions) is used, which is what every real feature route does.
export async function runAgent<TContext = any>(
  agent: AgentDefinition<TContext>,
  ctx: TContext,
  instructionsOverride?: string
): Promise<AgentRunResult> {
  const cacheKey = instructionsOverride === undefined ? agent.cacheKey?.(ctx) : undefined;
  if (cacheKey) {
    const cached = getCachedAgentResponse(cacheKey);
    if (cached) return { data: cached, cached: true };
  }

  const instructions = instructionsOverride ?? (await getAgentPromptOverride(agent.id)) ?? agent.defaultInstructions;
  const prompt = agent.buildPrompt(ctx, instructions);

  let responseText = '';
  try {
    responseText = await runWithProviderChain((adapter, model, apiKey) =>
      adapter.generateJson(prompt, model, apiKey)
    );
    const parsed = parseAiJsonResponse(responseText || '{}');

    if (cacheKey) {
      setCachedAgentResponse(cacheKey, parsed, agent.cacheTtlMs ?? 5 * 60 * 1000);
    }

    return { data: parsed, cached: false };
  } catch (err: any) {
    if (err instanceof SyntaxError && responseText) {
      console.error(`Raw response causing SyntaxError from agent "${agent.id}":`, responseText);
    }
    throw err;
  }
}

// Runs an agent that returns free-form text (not JSON) — used by chat-style agents.
export async function runTextAgent<TContext = any>(
  agent: AgentDefinition<TContext>,
  ctx: TContext,
  instructionsOverride?: string
): Promise<string> {
  const instructions = instructionsOverride ?? (await getAgentPromptOverride(agent.id)) ?? agent.defaultInstructions;
  const prompt = agent.buildPrompt(ctx, instructions);
  return runWithProviderChain((adapter, model, apiKey) => adapter.generateText(prompt, model, apiKey));
}

// Express-agnostic error classifier shared by every AI route — turns a thrown error into
// the right { errorType, message } shape so the frontend can distinguish "no provider
// configured" from "the model returned garbage" from "every provider's quota is exhausted".
export async function classifyAgentError(err: any): Promise<{ status: number; errorType: string; message: string }> {
  console.error('AI Agent Error:', err, 'providers tried:', lastAttemptedProviders);

  if ((await enabledProviderChain()).length === 0) {
    return {
      status: 503,
      errorType: 'missing_api_key',
      message: 'Chưa cấu hình AI provider nào — vào Settings > AI Providers để thiết lập.',
    };
  }
  if (err instanceof AiProviderError && err.isQuotaError) {
    return {
      status: 429,
      errorType: 'quota_exhausted',
      message: `Đã hết quota ở ${lastAttemptedProviders.join(', ') || err.provider} — thêm provider dự phòng trong Settings > AI Providers hoặc thử lại sau.`,
    };
  }
  if (err instanceof SyntaxError) {
    return {
      status: 502,
      errorType: 'invalid_ai_response',
      message: 'Mô hình AI trả về kết quả không đúng định dạng JSON.',
    };
  }
  return {
    status: 500,
    errorType: 'ai_call_failed',
    message: 'Gợi ý từ AI thất bại. Vui lòng thử lại sau ít phút.',
  };
}
