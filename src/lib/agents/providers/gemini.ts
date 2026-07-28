import { GoogleGenAI } from '@google/genai';
import type { AiProviderAdapter } from './types';
import { AiProviderError } from './types';

function isQuota(err: any): boolean {
  const msg = String(err?.message || err || '');
  return err?.status === 429 || /RESOURCE_EXHAUSTED|quota|rate.?limit/i.test(msg);
}

function wrap(err: any): AiProviderError {
  return new AiProviderError('gemini', err?.message || 'Gemini request failed', {
    isQuotaError: isQuota(err),
    status: err?.status,
  });
}

export const geminiAdapter: AiProviderAdapter = {
  async generateJson(prompt, model, apiKey) {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });
      return response.text || '{}';
    } catch (err: any) {
      throw wrap(err);
    }
  },

  async generateText(prompt, model, apiKey) {
    const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
    try {
      const response = await ai.models.generateContent({ model, contents: prompt });
      return response.text || '';
    } catch (err: any) {
      throw wrap(err);
    }
  },
};
