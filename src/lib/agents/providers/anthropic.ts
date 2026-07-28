import type { AiProviderAdapter } from './types';
import { AiProviderError } from './types';

async function call(prompt: string, model: string, apiKey: string, jsonMode: boolean): Promise<string> {
  const finalPrompt = jsonMode
    ? `${prompt}\n\nRespond with ONLY valid JSON. No markdown code fences, no explanation.`
    : prompt;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      messages: [{ role: 'user', content: finalPrompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new AiProviderError('anthropic', `Anthropic request failed (${res.status}): ${body.slice(0, 300)}`, {
      isQuotaError: res.status === 429,
      status: res.status,
    });
  }

  const data = await res.json();
  return data?.content?.[0]?.text || '';
}

export const anthropicAdapter: AiProviderAdapter = {
  generateJson: (prompt, model, apiKey) => call(prompt, model, apiKey, true),
  generateText: (prompt, model, apiKey) => call(prompt, model, apiKey, false),
};
