import { getAppConfig, setAppConfig } from '../db';

export type AiProviderName = 'gemini' | 'openai' | 'anthropic' | 'grok';

export interface AiProviderEntry {
  provider: AiProviderName;
  apiKey: string;
  model: string;
  enabled: boolean;
}

export interface AiConfig {
  // Ordered by priority — first enabled entry is tried first, later entries are fallback
  // if an earlier one hits a quota/rate-limit error. See src/lib/agents/runtime.ts.
  providers: AiProviderEntry[];
}

const CONFIG_KEY = 'aiConfig';

const DEFAULT_MODEL: Record<AiProviderName, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5',
  grok: 'grok-4',
};

// No config saved yet — fall back to the single Gemini env-var setup that already exists,
// so nothing regresses for installs that haven't opened the new Settings section.
function defaultConfig(): AiConfig {
  return {
    providers: [
      {
        provider: 'gemini',
        apiKey: process.env.GEMINI_API_KEY || '',
        model: process.env.GEMINI_MODEL || DEFAULT_MODEL.gemini,
        enabled: true,
      },
    ],
  };
}

export async function getAiConfig(): Promise<AiConfig> {
  try {
    const data = await getAppConfig<AiConfig | null>(CONFIG_KEY, null);
    if (data && Array.isArray(data.providers) && data.providers.length > 0) {
      return { providers: data.providers };
    }
  } catch (err) {
    console.error('Error reading AI config:', err);
  }
  return defaultConfig();
}

export async function saveAiConfig(providers: AiProviderEntry[]): Promise<AiConfig> {
  const updated: AiConfig = { providers };
  await setAppConfig(CONFIG_KEY, updated);
  return updated;
}

export function defaultModelFor(provider: AiProviderName): string {
  return DEFAULT_MODEL[provider];
}
