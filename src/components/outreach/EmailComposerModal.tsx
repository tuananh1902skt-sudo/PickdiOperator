import React, { useEffect, useState } from 'react';
import { X, Sparkles, Send, RefreshCw, Eye, Pencil } from 'lucide-react';
import { Creator, Campaign } from '../../types';
import { renderFirstContactEmailHtml } from '../../lib/emailTemplate';

interface EmailBranding {
  brand?: string;
  logoUrl?: string;
  primaryColor?: string;
  email?: string;
  senderName?: string;
  defaultCc?: string;
}

interface EmailComposerModalProps {
  isOpen: boolean;
  onClose: () => void;
  creator: Creator | null;
  campaigns: Campaign[];
  onSendEmail: (payload: { creatorId: string; creatorName: string; creatorHandle: string; campaignId?: string; campaignName?: string; subject: string; body: string; cc?: string }) => Promise<boolean>;
}

export const EmailComposerModal: React.FC<EmailComposerModalProps> = ({
  isOpen,
  onClose,
  creator,
  campaigns,
  onSendEmail
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [cc, setCc] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [branding, setBranding] = useState<EmailBranding>({});

  // Reset the draft whenever a different creator is opened, since this modal stays
  // mounted and only toggles `isOpen` — otherwise the previous creator's draft leaks through.
  useEffect(() => {
    if (isOpen) {
      setSelectedCampaignId(campaigns[0]?.id || '');
      setSubject('');
      setBody('');
      setCc(branding.defaultCc || '');
      setShowPreview(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, creator?.id]);

  // Loaded once per open just to render an accurate "what the creator will actually
  // see" HTML preview — the real send always re-reads config server-side anyway.
  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/settings/email')
      .then(res => res.json())
      .then(data => { if (data.success) { setBranding(data.data); setCc(data.data.defaultCc || ''); } })
      .catch(err => console.error('Failed to load email branding:', err));
  }, [isOpen]);

  if (!isOpen || !creator) return null;

  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  const handleGenerateAiEmail = async () => {
    setLoading(true);
    setGenerateError('');
    try {
      const res = await fetch('/api/ai/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creator,
          campaign: currentCampaign,
          tone: 'friendly, direct, lead with commission'
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setSubject(data.data.subject || `Collaboration Offer: ${currentCampaign?.name || 'Partnership'}`);
        setBody(data.data.body || '');
      } else {
        setGenerateError(data.message || 'AI không thể tạo bản nháp. Vui lòng tự soạn email.');
      }
    } catch (err) {
      console.error(err);
      setGenerateError('Không thể kết nối tới dịch vụ AI. Vui lòng tự soạn email.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || isSending) return;

    setIsSending(true);
    try {
      const success = await onSendEmail({
        creatorId: creator.id,
        creatorName: creator.displayName,
        creatorHandle: `@${creator.handle}`,
        campaignId: currentCampaign?.id,
        campaignName: currentCampaign?.name,
        subject,
        body,
        cc: cc.trim() || undefined
      });

      // Keep the draft open on failure so the composed subject/body aren't lost —
      // the parent already surfaces an error notification/alert on failure.
      if (success !== false) {
        onClose();
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-600" />
              Outreach Email Composer
            </h3>
            <p className="text-xs text-slate-500">
              Sending to <strong>{creator.displayName}</strong> ({creator.email})
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {/* Campaign Selector + AI Generator Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900 rounded-xl">
            <div className="flex-1 w-full sm:w-auto">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                Target Campaign Context
              </label>
              <select
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                disabled={campaigns.length === 0}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium disabled:opacity-60"
              >
                {campaigns.length === 0 ? (
                  <option value="">No campaigns yet — create one first</option>
                ) : (
                  campaigns.map(cmp => (
                    <option key={cmp.id} value={cmp.id}>{cmp.name}</option>
                  ))
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateAiEmail}
              disabled={loading}
              className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating Draft...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate AI Email Draft
                </>
              )}
            </button>
          </div>

          {generateError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium -mt-1">{generateError}</p>
          )}

          {/* Email Subject Input */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Collaboration Invitation: d'Alba Sunscreen x @handle"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* CC Input */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              CC (tùy chọn)
            </label>
            <input
              type="text"
              placeholder="teammate@company.com, another@company.com"
              value={cc}
              onChange={e => setCc(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Nhiều địa chỉ cách nhau bởi dấu phẩy. Để trống nếu không cần CC.
            </p>
          </div>

          {/* Email Body Textarea / HTML Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-bold text-slate-700 dark:text-slate-300">
                Additional Note (optional)
              </label>
              <button
                type="button"
                onClick={() => setShowPreview(p => !p)}
                className="text-[11px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
              >
                {showPreview ? <><Pencil className="w-3 h-3" /> Chỉnh sửa</> : <><Eye className="w-3 h-3" /> Xem trước email HTML</>}
              </button>
            </div>

            {showPreview ? (
              <iframe
                title="Email preview"
                sandbox=""
                srcDoc={renderFirstContactEmailHtml({
                  creatorName: creator.displayName,
                  senderName: branding.senderName,
                  brandName: currentCampaign?.brand || branding.brand,
                  logoUrl: branding.logoUrl,
                  primaryColor: branding.primaryColor,
                  productName: currentCampaign?.products?.[0]?.name,
                  productImageUrl: currentCampaign?.products?.[0]?.imageUrl,
                  productUrl: currentCampaign?.products?.[0]?.productUrl,
                  productRating: currentCampaign?.products?.[0]?.rating,
                  productReviewCount: currentCampaign?.products?.[0]?.reviewCount,
                  productSoldCount: currentCampaign?.products?.[0]?.soldCount,
                  productHighlights: currentCampaign?.products?.[0]?.highlights,
                  compensationOffer: currentCampaign?.products?.[0]?.compensationOffer,
                  bodyText: body,
                  ctaHref: branding.email ? `mailto:${branding.email}` : undefined,
                })}
                className="w-full h-80 rounded-xl border border-slate-200 dark:border-slate-700 bg-white"
              />
            ) : (
              <textarea
                rows={4}
                placeholder="Ghi chú/lời khen cá nhân hoá thêm cho creator này (không bắt buộc) — phần chào hỏi, offer, next-steps và chữ ký đã được template xử lý sẵn."
                value={body}
                onChange={e => setBody(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed text-xs"
              />
            )}
            <p className="text-[11px] text-slate-400 mt-1">
              Email dùng đúng mẫu "Piedmont Ethereal": chào hỏi, sản phẩm, offer, next-steps, chữ ký đã cố định — ô này chỉ để thêm 1 câu cá nhân hoá nếu muốn.
            </p>
          </div>

          {/* Workflow Guard Notice */}
          <div className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Workflow Rule: AI generated copy requires operator confirmation before sending.</span>
            <span className="font-bold text-indigo-600">Lead with Commission Structure</span>
          </div>

          {/* Modal Footer */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 font-medium hover:text-slate-700"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={!subject.trim() || isSending}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send Outreach Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
