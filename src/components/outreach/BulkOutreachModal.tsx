import React, { useEffect, useMemo, useState } from 'react';
import { X, Sparkles, Send, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Clock, Loader2, Eye, Pencil } from 'lucide-react';
import { Creator, Campaign, BulkOutreachJob, BulkOutreachItem } from '../../types';
import { renderFirstContactEmailHtml } from '../../lib/emailTemplate';

interface EmailBranding {
  brand?: string;
  logoUrl?: string;
  primaryColor?: string;
  email?: string;
  senderName?: string;
  defaultCc?: string;
}

type SequenceStage = 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3';

const STAGE_OPTIONS: { value: SequenceStage; label: string }[] = [
  { value: 'first', label: 'Email đầu tiên (First Contact)' },
  { value: 'reminder_1', label: 'Nhắc lần 1' },
  { value: 'reminder_2', label: 'Nhắc lần 2' },
  { value: 'reminder_3', label: 'Nhắc lần 3 (Close-out)' },
];

interface BulkOutreachModalProps {
  isOpen: boolean;
  onClose: () => void;
  creatorIds: string[];
  creators: Creator[];
  campaigns: Campaign[];
  workspaceId?: string;
  defaultCampaignId?: string;
  defaultSequenceStage?: SequenceStage;
  onCompleted?: () => void;
}

// Cheap client-side similarity check on top of the server-side "avoid repeating this
// batch's phrasings" instruction — flags drafts whose first ~10 words overlap heavily so
// the operator can spot template-y duplicates before sending.
function findSimilarPairs(items: BulkOutreachItem[]): Set<string> {
  const flagged = new Set<string>();
  const drafts = items.filter(i => i.status === 'draft' && i.body);
  const wordSets = drafts.map(i => ({
    id: i.creatorId,
    words: new Set(i.body.toLowerCase().split(/\s+/).slice(0, 10)),
  }));

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const a = wordSets[i].words;
      const b = wordSets[j].words;
      const intersection = [...a].filter(w => b.has(w)).length;
      const union = new Set([...a, ...b]).size;
      if (union > 0 && intersection / union > 0.6) {
        flagged.add(wordSets[i].id);
        flagged.add(wordSets[j].id);
      }
    }
  }
  return flagged;
}

export const BulkOutreachModal: React.FC<BulkOutreachModalProps> = ({
  isOpen,
  onClose,
  creatorIds,
  creators,
  campaigns,
  workspaceId,
  defaultCampaignId,
  defaultSequenceStage = 'first',
  onCompleted,
}) => {
  const [campaignId, setCampaignId] = useState(defaultCampaignId || campaigns[0]?.id || '');
  const [sequenceStage, setSequenceStage] = useState<SequenceStage>(defaultSequenceStage);
  const [contentSource, setContentSource] = useState<'ai' | 'template'>('ai');
  const [cc, setCc] = useState('');
  const [job, setJob] = useState<BulkOutreachJob | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [missingEmailDrafts, setMissingEmailDrafts] = useState<Record<string, string>>({});
  const [savingEmailId, setSavingEmailId] = useState<string | null>(null);
  const [pacingMin, setPacingMin] = useState(45);
  const [pacingMax, setPacingMax] = useState(120);
  const [dailyCap, setDailyCap] = useState(80);
  const [previewCreatorId, setPreviewCreatorId] = useState<string | null>(null);
  const [branding, setBranding] = useState<EmailBranding>({});

  useEffect(() => {
    if (isOpen) {
      setJob(null);
      setError('');
      setCampaignId(defaultCampaignId || campaigns[0]?.id || '');
      setSequenceStage(defaultSequenceStage);
      setContentSource('ai');
      setPreviewCreatorId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/settings/email')
      .then(res => res.json())
      .then(data => { if (data.success) { setBranding(data.data); setCc(data.data.defaultCc || ''); } })
      .catch(err => console.error('Failed to load email branding:', err));
  }, [isOpen]);

  // Poll job progress while the send loop is running in the background.
  useEffect(() => {
    if (!job || job.status !== 'sending') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/outreach/bulk/${job.id}`);
        const data = await res.json();
        if (data.success) {
          setJob(data.data);
          if (data.data.status === 'done') {
            onCompleted?.();
          }
        }
      } catch (err) {
        console.error('Poll bulk job error:', err);
      }
    }, 4000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.id, job?.status]);

  if (!isOpen) return null;

  // Template-mode drafts are expected to share nearly identical wording by design (same
  // mail-merge template for every creator) — the similarity check only makes sense for AI
  // drafts, which are supposed to be distinct per creator.
  const similarPairs = job && job.contentSource !== 'template' ? findSimilarPairs(job.items) : new Set<string>();

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/outreach/bulk/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorIds, campaignId, sequenceStage, contentSource, workspaceId, cc: cc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Tạo bản nháp thất bại');
      setJob(data.data);
      setPacingMin(data.data.pacingMinSeconds);
      setPacingMax(data.data.pacingMaxSeconds);
      setDailyCap(data.data.dailyCap);
    } catch (err: any) {
      setError(err.message || 'Tạo bản nháp thất bại');
    } finally {
      setGenerating(false);
    }
  };

  const updateItem = (creatorId: string, patch: Partial<BulkOutreachItem>) => {
    setJob(prev => prev ? { ...prev, items: prev.items.map(i => i.creatorId === creatorId ? { ...i, ...patch } : i) } : prev);
  };

  const handleSaveEdit = async (item: BulkOutreachItem) => {
    if (!job) return;
    try {
      await fetch(`/api/outreach/bulk/${job.id}/items/${item.creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject: item.subject, body: item.body }),
      });
    } catch (err) {
      console.error('Save item edit error:', err);
    }
  };

  const handleRegenerate = async (creatorId: string) => {
    if (!job) return;
    setRegeneratingId(creatorId);
    try {
      const res = await fetch(`/api/outreach/bulk/${job.id}/items/${creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true }),
      });
      const data = await res.json();
      if (data.success) setJob(data.data);
    } catch (err) {
      console.error('Regenerate error:', err);
    } finally {
      setRegeneratingId(null);
    }
  };

  // Fills in a missing email for a "skipped_no_email" item — saves it to the creator's CRM
  // profile (the source of truth used at actual send time) and un-skips the item so it
  // rejoins the batch with a freshly generated draft.
  const handleSaveMissingEmail = async (creatorId: string) => {
    if (!job) return;
    const email = (missingEmailDrafts[creatorId] || '').trim();
    if (!email) return;
    setSavingEmailId(creatorId);
    try {
      const res = await fetch(`/api/outreach/bulk/${job.id}/items/${creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Lưu email thất bại');
      setJob(data.data);
      setMissingEmailDrafts(prev => {
        const next = { ...prev };
        delete next[creatorId];
        return next;
      });
    } catch (err: any) {
      setError(err.message || 'Lưu email thất bại');
    } finally {
      setSavingEmailId(null);
    }
  };

  const handleSend = async () => {
    if (!job) return;
    setSending(true);
    try {
      const res = await fetch(`/api/outreach/bulk/${job.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pacingMinSeconds: pacingMin, pacingMaxSeconds: pacingMax, dailyCap, cc: cc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gửi thất bại');
      setJob(data.data);
    } catch (err: any) {
      setError(err.message || 'Gửi thất bại');
    } finally {
      setSending(false);
    }
  };

  const currentCampaign = campaigns.find(c => c.id === campaignId);
  const draftItems = job?.items.filter(i => i.status !== 'skipped_no_email' && i.status !== 'skipped_do_not_contact') || [];
  // Only the still-unsent items — what the review/edit list and the send button should
  // count. Distinct from draftItems (which includes already-sent/failed items too, needed
  // for the sending/done progress view) so a resumed paused_cap job doesn't re-show
  // already-sent emails as editable drafts.
  const remainingItems = job?.items.filter(i => i.status === 'draft') || [];
  const skippedItems = job?.items.filter(i => i.status === 'skipped_no_email' || i.status === 'skipped_do_not_contact') || [];
  const sentCount = job?.items.filter(i => i.status === 'sent').length || 0;
  const failedCount = job?.items.filter(i => i.status === 'failed').length || 0;
  const isSendingOrDone = job?.status === 'sending' || job?.status === 'done';
  const isPausedCap = job?.status === 'paused_cap';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Send className="w-4 h-4 text-indigo-600" />
              Gửi Outreach Hàng Loạt
            </h3>
            <p className="text-xs text-slate-500">{creatorIds.length} creator đã chọn</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs overflow-y-auto flex-1">
          {error && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-950/40 p-2 rounded-lg">{error}</p>
          )}

          {!job && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Campaign</label>
                  <select
                    value={campaignId}
                    onChange={e => setCampaignId(e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    {campaigns.length === 0 ? (
                      <option value="">Không có campaign</option>
                    ) : (
                      campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Loại email</label>
                  <select
                    value={sequenceStage}
                    onChange={e => setSequenceStage(e.target.value as SequenceStage)}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                  >
                    {STAGE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Nguồn nội dung</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setContentSource('ai')}
                    className={`px-3 py-2 rounded-lg border font-bold text-left ${
                      contentSource === 'ai'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> AI viết riêng</span>
                    <span className="block font-normal text-[10px] mt-0.5 opacity-80">1 email khác nhau cho mỗi creator</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentSource('template')}
                    className={`px-3 py-2 rounded-lg border font-bold text-left ${
                      contentSource === 'template'
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">Dùng mẫu (Template)</span>
                    <span className="block font-normal text-[10px] mt-0.5 opacity-80">Dùng nguyên mẫu HTML có sẵn, không cần AI</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">CC (tùy chọn, áp dụng cho cả đợt)</label>
                <input
                  type="text"
                  placeholder="teammate@company.com, another@company.com"
                  value={cc}
                  onChange={e => setCc(e.target.value)}
                  className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-[11px] text-indigo-700 dark:text-indigo-300">
                {contentSource === 'template' ? (
                  sequenceStage === 'first' ? (
                    <>Email đầu tiên sẽ dùng nguyên mẫu thiết kế HTML có sẵn (chào hỏi, sản phẩm, offer, next-steps,
                    chữ ký) — không có đoạn AI, chỉ tên/handle được điền đúng theo từng creator. Vẫn xem lại và thêm
                    ghi chú riêng cho từng người trước khi gửi nếu muốn.</>
                  ) : (
                    <>Email nhắc sẽ điền từ mẫu chữ đã lưu trong Cài đặt &gt; Mẫu Email, với tên, handle... đúng theo
                    từng creator (không dùng AI). Vẫn xem lại và sửa được từng email trước khi gửi.</>
                  )
                ) : (
                  <>AI sẽ viết 1 email riêng cho từng creator (dựa trên niche, follower, tương tác...),
                  tự tránh lặp văn phong giữa các email trong cùng đợt.</>
                )} Creator không có email hoặc đã đánh dấu
                "Không liên hệ nữa" sẽ tự động bị loại — bạn sẽ thấy rõ lý do ở bước sau.
              </div>

              <button
                onClick={handleGenerate}
                disabled={generating || creatorIds.length === 0}
                className="w-full px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? 'Đang tạo bản nháp...' : 'Tạo Bản Nháp'}
              </button>
            </div>
          )}

          {job && !isSendingOrDone && (
            <div className="space-y-3">
              {isPausedCap && (
                <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 text-[11px] text-orange-800 dark:text-orange-300 flex items-start gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>
                    Đã tạm dừng vì chạm <strong>Giới hạn/ngày</strong> — {sentCount} email đã gửi, còn{' '}
                    <strong>{remainingItems.length}</strong> chưa gửi. Tăng "Giới hạn/ngày" bên dưới rồi bấm
                    "Tiếp tục gửi" để gửi nốt phần còn lại.
                  </span>
                </div>
              )}

              {skippedItems.length > 0 && (
                <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 space-y-1.5">
                  <p className="font-bold">{skippedItems.length} creator bị loại tự động:</p>
                  {skippedItems.map(i => (
                    <div key={i.creatorId}>
                      <p>• {i.creatorName} — {i.skipReason}</p>
                      {i.status === 'skipped_no_email' && (
                        <div className="flex items-center gap-1.5 mt-1 ml-2.5">
                          <input
                            type="email"
                            placeholder="Điền email để thêm creator này vào đợt gửi"
                            value={missingEmailDrafts[i.creatorId] ?? ''}
                            onChange={e => setMissingEmailDrafts(prev => ({ ...prev, [i.creatorId]: e.target.value }))}
                            className="flex-1 p-1.5 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[11px]"
                          />
                          <button
                            onClick={() => handleSaveMissingEmail(i.creatorId)}
                            disabled={savingEmailId === i.creatorId || !(missingEmailDrafts[i.creatorId] || '').trim()}
                            className="px-2 py-1.5 text-[10px] font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg shrink-0"
                          >
                            {savingEmailId === i.creatorId ? 'Đang lưu...' : 'Thêm vào đợt gửi'}
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <p className="font-bold text-slate-700 dark:text-slate-300">
                {remainingItems.length} email sẽ được gửi — xem lại và sửa nếu cần:
              </p>

              <div className="space-y-3">
                {remainingItems.map(item => (
                  <div key={item.creatorId} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800 dark:text-slate-200">{item.creatorName} ({item.creatorHandle})</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setPreviewCreatorId(prev => prev === item.creatorId ? null : item.creatorId)}
                          className="px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
                        >
                          {previewCreatorId === item.creatorId ? <><Pencil className="w-3 h-3" /> Sửa</> : <><Eye className="w-3 h-3" /> Xem trước</>}
                        </button>
                        <button
                          onClick={() => handleRegenerate(item.creatorId)}
                          disabled={regeneratingId === item.creatorId}
                          className="px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
                        >
                          {regeneratingId === item.creatorId ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                          {job?.contentSource === 'template' ? 'Điền lại từ mẫu' : 'Viết lại'}
                        </button>
                      </div>
                    </div>

                    {item.source === 'template_fallback' && (
                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        AI không khả dụng — đã điền từ mẫu có sẵn, cần xem lại trước khi gửi
                      </div>
                    )}
                    {similarPairs.has(item.creatorId) && (
                      <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 font-semibold">
                        <AlertTriangle className="w-3.5 h-3.5" />
                        Nội dung mở đầu khá giống 1 email khác trong đợt này — cân nhắc viết lại
                      </div>
                    )}

                    <input
                      value={item.subject}
                      onChange={e => updateItem(item.creatorId, { subject: e.target.value })}
                      onBlur={() => handleSaveEdit(item)}
                      className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    />
                    {previewCreatorId === item.creatorId ? (
                      <iframe
                        title={`Preview - ${item.creatorName}`}
                        sandbox=""
                        srcDoc={renderFirstContactEmailHtml({
                              creatorName: item.creatorName,
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
                              bodyText: sequenceStage === 'first' ? item.body : undefined,
                              introText: sequenceStage === 'first' ? undefined : item.body,
                              ctaHref: branding.email ? `mailto:${branding.email}` : undefined,
                            })}
                        className="w-full h-72 rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                      />
                    ) : (
                      <>
                        {sequenceStage !== 'first' && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Đây chỉ là câu mở đầu (thay câu pitch mặc định) — phần sản phẩm, offer và CTA bên dưới vẫn giữ nguyên như mẫu.
                          </p>
                        )}
                        <textarea
                          rows={4}
                          value={item.body}
                          onChange={e => updateItem(item.creatorId, { body: e.target.value })}
                          onBlur={() => handleSaveEdit(item)}
                          placeholder={item.source === 'template' && sequenceStage === 'first'
                            ? 'Để trống nếu không cần — chào hỏi, sản phẩm, offer, next-steps và chữ ký đã được mẫu HTML xử lý sẵn. Gõ vào đây nếu muốn thêm 1 câu cá nhân hoá riêng cho creator này.'
                            : undefined}
                          className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white leading-relaxed"
                        />
                      </>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <p className="font-bold text-slate-700 dark:text-slate-300">Tốc độ gửi (chống spam)</p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cách nhau tối thiểu (giây)</label>
                    <input type="number" min={5} value={pacingMin} onChange={e => setPacingMin(Number(e.target.value))} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Cách nhau tối đa (giây)</label>
                    <input type="number" min={5} value={pacingMax} onChange={e => setPacingMax(Number(e.target.value))} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Giới hạn/ngày</label>
                    <input type="number" min={1} value={dailyCap} onChange={e => setDailyCap(Number(e.target.value))} className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {job && isSendingOrDone && (
            <div className="space-y-3">
              <p className="font-bold text-slate-700 dark:text-slate-300">
                {job.status === 'done' ? 'Đã gửi xong' : 'Đang gửi...'} — {sentCount}/{draftItems.length} đã gửi
                {failedCount > 0 ? `, ${failedCount} lỗi` : ''}
              </p>
              <div className="space-y-1.5">
                {draftItems.map(item => (
                  <div key={item.creatorId} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{item.creatorName}</span>
                    <span className="flex items-center gap-1.5">
                      {item.status === 'sent' && <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Đã gửi</>}
                      {item.status === 'failed' && <><XCircle className="w-3.5 h-3.5 text-rose-600" /> {item.error || 'Lỗi'}</>}
                      {item.status === 'sending' && <><Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" /> Đang gửi</>}
                      {item.status === 'draft' && <><Clock className="w-3.5 h-3.5 text-slate-400" /> Đang chờ</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button onClick={onClose} className="text-slate-500 font-medium hover:text-slate-700">
            {isSendingOrDone ? 'Đóng (vẫn tiếp tục gửi ở nền)' : 'Hủy'}
          </button>

          {job && !isSendingOrDone && (
            <button
              onClick={handleSend}
              disabled={sending || remainingItems.length === 0}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {sending
                ? 'Đang bắt đầu gửi...'
                : isPausedCap
                  ? `Tiếp tục gửi ${remainingItems.length} email còn lại`
                  : `Gửi ${remainingItems.length} Email`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
