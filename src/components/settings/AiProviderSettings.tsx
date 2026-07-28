import React, { useEffect, useState } from 'react';
import { Sparkles, Save, Check } from 'lucide-react';

type AiProviderName = 'gemini' | 'openai' | 'anthropic' | 'grok';

interface ProviderRow {
  provider: AiProviderName;
  model: string;
  enabled: boolean;
  hasApiKey: boolean;
  apiKeyInput: string; // only sent to the server when non-empty (same pattern as Gmail app password)
}

const PROVIDER_LABELS: Record<AiProviderName, string> = {
  gemini: 'Google Gemini',
  openai: 'OpenAI',
  anthropic: 'Anthropic (Claude)',
  grok: 'Grok (xAI)',
};

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  gemini: 'gemini-3.6-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet-5',
  grok: 'grok-4',
};

const PROVIDER_ORDER: AiProviderName[] = ['gemini', 'openai', 'anthropic', 'grok'];

export const AiProviderSettings: React.FC = () => {
  const [rows, setRows] = useState<ProviderRow[]>(
    PROVIDER_ORDER.map(provider => ({ provider, model: DEFAULT_MODELS[provider], enabled: false, hasApiKey: false, apiKeyInput: '' }))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/ai-providers')
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.data?.providers)) {
          setRows(PROVIDER_ORDER.map(provider => {
            const saved = data.data.providers.find((p: any) => p.provider === provider);
            return {
              provider,
              model: saved?.model || DEFAULT_MODELS[provider],
              enabled: Boolean(saved?.enabled),
              hasApiKey: Boolean(saved?.hasApiKey),
              apiKeyInput: '',
            };
          }));
        }
      })
      .catch(err => console.error('Failed to load AI provider config:', err))
      .finally(() => setLoading(false));
  }, []);

  const updateRow = (provider: AiProviderName, patch: Partial<ProviderRow>) => {
    setRows(prev => prev.map(r => (r.provider === provider ? { ...r, ...patch } : r)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/ai-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          providers: rows.map(r => ({
            provider: r.provider,
            model: r.model,
            enabled: r.enabled,
            apiKey: r.apiKeyInput.trim() || undefined,
          })),
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setRows(prev => prev.map(r => {
          const saved = data.data.providers.find((p: any) => p.provider === r.provider);
          return { ...r, hasApiKey: Boolean(saved?.hasApiKey), apiKeyInput: '' };
        }));
        setMessage({ type: 'success', text: 'Đã lưu cấu hình AI Provider.' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Lưu thất bại' });
      }
    } catch (err) {
      console.error('Save AI provider config error:', err);
      setMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs">
      <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-indigo-600" />
        AI Providers & Fallback khi hết Quota
      </h3>
      <p className="text-slate-500">
        Được thử theo đúng thứ tự bên dưới (Gemini → OpenAI → Anthropic → Grok). Khi provider đang bật báo hết
        quota/giới hạn tốc độ, hệ thống tự động chuyển sang provider bật tiếp theo — dùng cho mọi tính năng
        AI trong app (viết email outreach, chấm điểm creator, trả lời đàm phán...), không chỉ riêng gửi hàng loạt.
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        {rows.map(row => (
          <div key={row.provider} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={e => updateRow(row.provider, { enabled: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600"
                />
                {PROVIDER_LABELS[row.provider]}
              </label>
              {row.hasApiKey && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
                  <Check className="w-3 h-3" /> Đã lưu API key
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="password"
                placeholder={row.hasApiKey ? '•••••••••••• (để trống nếu không đổi)' : 'API key'}
                value={row.apiKeyInput}
                onChange={e => updateRow(row.provider, { apiKeyInput: e.target.value })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <input
                type="text"
                placeholder="Model"
                value={row.model}
                onChange={e => updateRow(row.provider, { model: e.target.value })}
                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        ))}

        {message && (
          <div className={`p-2.5 rounded-xl text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
          }`}>
            {message.text}
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình AI Providers'}
          </button>
        </div>
      </form>
    </div>
  );
};
