import React, { useEffect, useState } from 'react';
import { FileText, Save } from 'lucide-react';

type SequenceStage = 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3';

interface OutreachTemplate {
  subject: string;
  body: string;
}

type OutreachTemplateSet = Record<SequenceStage, OutreachTemplate>;

const STAGE_LABELS: Record<SequenceStage, string> = {
  first: 'Email đầu tiên (First Contact)',
  reminder_1: 'Nhắc lần 1',
  reminder_2: 'Nhắc lần 2',
  reminder_3: 'Nhắc lần 3 (Close-out)',
};

const STAGE_ORDER: SequenceStage[] = ['first', 'reminder_1', 'reminder_2', 'reminder_3'];

export const OutreachTemplateSettings: React.FC = () => {
  const [templates, setTemplates] = useState<OutreachTemplateSet | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings/outreach-templates')
      .then(res => res.json())
      .then(data => { if (data.success) setTemplates(data.data); })
      .catch(err => console.error('Failed to load outreach templates:', err));
  }, []);

  const updateTemplate = (stage: SequenceStage, patch: Partial<OutreachTemplate>) => {
    setTemplates(prev => prev ? { ...prev, [stage]: { ...prev[stage], ...patch } } : prev);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templates) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/settings/outreach-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMessage({ type: 'success', text: 'Đã lưu mẫu email dự phòng.' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Lưu thất bại' });
      }
    } catch (err) {
      console.error('Save outreach templates error:', err);
      setMessage({ type: 'error', text: 'Lỗi kết nối máy chủ.' });
    } finally {
      setSaving(false);
    }
  };

  if (!templates) return null;

  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs">
      <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
        <FileText className="w-4 h-4 text-indigo-600" />
        Mẫu Email Dự Phòng (Outreach Template Fallback)
      </h3>
      <p className="text-slate-500">
        Chỉ dùng khi <strong>tất cả</strong> AI provider đã cấu hình đều hết quota/lỗi trong 1 đợt gửi hàng loạt —
        điền dữ liệu creator vào mẫu này thay vì chặn cả đợt gửi. Dùng token: {'{{creatorName}}'}, {'{{handle}}'},
        {' '}{'{{niche}}'}, {'{{followerTier}}'}, {'{{brandName}}'}, {'{{campaignName}}'}, {'{{productName}}'}.
      </p>

      <form onSubmit={handleSave} className="space-y-3">
        {STAGE_ORDER.map(stage => (
          <div key={stage} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
            <p className="font-bold text-slate-800 dark:text-slate-200">{STAGE_LABELS[stage]}</p>
            <input
              value={templates[stage]?.subject || ''}
              onChange={e => updateTemplate(stage, { subject: e.target.value })}
              placeholder="Subject"
              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
            />
            <textarea
              rows={4}
              value={templates[stage]?.body || ''}
              onChange={e => updateTemplate(stage, { body: e.target.value })}
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed font-mono text-[11px]"
            />
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
            {saving ? 'Đang lưu...' : 'Lưu mẫu email'}
          </button>
        </div>
      </form>
    </div>
  );
};
