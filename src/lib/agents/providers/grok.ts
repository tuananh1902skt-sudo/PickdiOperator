import type { AiProviderAdapter } from './types';
import { AiProviderError } from './types';

// xAI's Grok API is OpenAI-compatible (chat/completions shape), just a different host.
async function call(prompt: string, model: string, apiKey: string, jsonMode: boolean): Promise<string> {
  const res = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiProviderError('grok', `Grok request failed (${res.status}): ${body.slice(0, 300)}`, {
      isQuotaError: res.status === 429,
      status: res.status,
    });
  }

  const data = await res.json();
  return data?.choices?.[0]?.message?.content || '';
}

export const grokAdapter: AiProviderAdapter = {
  generateJson: (prompt, model, apiKey) => call(prompt, model, apiKey, true),
  generateText: (prompt, model, apiKey) => call(prompt, model, apiKey, false),
};
