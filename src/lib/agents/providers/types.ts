// Common error shape every provider adapter throws, so runtime.ts can decide whether to
// fall through to the next configured provider (quota/rate-limit) or fail fast (bad key,
// bad prompt, network error unrelated to quota).
export class AiProviderError extends Error {
  provider: string;
  isQuotaError: boolean;
  status?: number;

  constructor(provider: string, message: string, opts: { isQuotaError: boolean; status?: number }) {
    super(message);
    this.name = 'AiProviderError';
    this.provider = provider;
    this.isQuotaError = opts.isQuotaError;
    this.status = opts.status;
  }
}

export interface AiProviderAdapter {
  // Returns the raw text response (may be JSON possibly wrapped in markdown fences —
  // parsing/unwrapping is shared logic in runtime.ts, not per-adapter).
  generateJson(prompt: string, model: string, apiKey: string): Promise<string>;
  generateText(prompt: string, model: string, apiKey: string): Promise<string>;
}
