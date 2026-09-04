import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardList, Send, X, Loader2, CheckCircle2, XCircle, AlertTriangle, Eye, Pencil } from 'lucide-react';
import type { SequenceStage } from '../../lib/outreachTemplates';
import type { Campaign } from '../../types';
import { renderFirstContactEmailHtml } from '../../lib/emailTemplate';

// Chỉ những field branding mà khung mail Piedmont cần để dựng preview giống hệt mail thật
// (/api/settings/email trả về nhiều hơn thế — phần còn lại là cấu hình SMTP/IMAP).
interface EmailBranding {
  brand?: string;
  logoUrl?: string;
  primaryColor?: string;
  email?: string;
  senderName?: string;
}

// Mirrors normalizeHandle() in CreatorListView.tsx — kept as a local copy on purpose: this
// page has zero dependency on the Creator CRM module by design (no shared state, no shared
// filtering), matching the "dán > outreach > xong" direction — app không quản trị creator
// nữa, chỉ soạn + gửi từ đúng những gì vừa dán vào.
function normalizeHandle(raw: string): string {
  let s = raw.trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  if (s.startsWith('tiktok.com/')) s = s.slice('tiktok.com/'.length);
  s = s.split(/[?#]/)[0];
  s = s.replace(/^@/, '').split('/')[0];
  return s.trim();
}

interface ParsedRow {
  handle: string;
  email: string;
  displayName: string;
}

// Chấp nhận đúng khối dán từ tab ➜ GỬI OUTREACH của Sheet (tab-separated: Handle, Email,
// Tên hiển thị, Trạng thái, Tier — 2 cột cuối bị bỏ qua, không cần cho soạn/gửi mail), hoặc
// dán tay phân cách bằng dấu phẩy. Dòng tiêu đề "Handle ..." bị bỏ qua tự động.
function parseRows(text: string): ParsedRow[] {
  const seen = new Set<string>();
  const out: ParsedRow[] = [];
  text.split(/\r?\n/).forEach(line => {
    if (!line.trim()) return;
    const cols = (line.includes('\t') ? line.split('\t') : line.split(',')).map(c => c.trim());
    const handle = normalizeHandle(cols[0] || '');
    if (!handle || handle === 'handle') return;
    if (seen.has(handle)) return;
    seen.add(handle);
    out.push({ handle, email: cols[1] || '', displayName: cols[2] || '' });
  });
  return out;
}

type DraftStatus = 'draft' | 'skipped_no_email';
type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

interface DraftItem extends ParsedRow {
  subject: string;
  body: string;
  source: string;
  status: DraftStatus;
  skipReason?: string;
  sendStatus: SendStatus;
  sendError?: string;
}

const STAGE_OPTIONS: { value: SequenceStage; label: string }[] = [
  { value: 'first', label: 'Email đầu tiên (First Contact)' },
  { value: 'reminder_1', label: 'Nhắc lần 1' },
  { value: 'reminder_2', label: 'Nhắc lần 2' },
  { value: 'reminder_3', label: 'Nhắc lần 3 (Close-out)' },
];

function randomDelayMs() {
  // Rải nhịp gửi 45–120s giữa các mail — cùng khoảng pacing mà job Bulk Outreach cũ dùng,
  // để không đổi hành vi gửi mà spam filter đã quen (né bị đánh dấu spam vì gửi dồn dập).
  return (45 + Math.random() * 75) * 1000;
}

interface AdhocOutreachViewProps {
  campaigns: Campaign[];
}

export const AdhocOutreachView: React.FC<AdhocOutreachViewProps> = ({ campaigns }) => {
  const [pasteText, setPasteText] = useState('');
  const [stage, setStage] = useState<SequenceStage>('first');
  const [contentSource, setContentSource] = useState<'ai' | 'template'>('ai');
  const [campaignId, setCampaignId] = useState('');
  const [cc, setCc] = useState('');
  const [items, setItems] = useState<DraftItem[] | null>(null);
  const [branding, setBranding] = useState<EmailBranding>({});
  const [previewHandle, setPreviewHandle] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Preview dựng ở client phải khớp đúng những gì /api/outreach/adhoc/send dựng ở server:
  // cùng renderFirstContactEmailHtml, cùng nguồn branding (Settings > Email) và cùng product
  // đầu tiên của campaign đang chọn — nên phải kéo branding về đây thay vì đoán.
  useEffect(() => {
    fetch('/api/settings/email')
      .then(res => res.json())
      .then(json => { if (json?.success) setBranding(json.data); })
      .catch(err => console.error('Failed to load email branding:', err));
  }, []);

  const rows = useMemo(() => parseRows(pasteText), [pasteText]);
  const currentCampaign = campaigns.find(c => c.id === campaignId);
  const product = currentCampaign?.products?.[0];

  // Giữ nguyên thứ tự ưu tiên của server (campaign.name trước, rồi brand trong Settings) —
  // lệch chỗ này là preview hiển thị một tên thương hiệu, mail gửi đi lại ra tên khác.
  const renderPreview = (item: DraftItem) => renderFirstContactEmailHtml({
    creatorName: item.displayName || item.handle,
    senderName: branding.senderName,
    brandName: currentCampaign?.name || branding.brand,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    productName: product?.name,
    productImageUrl: product?.imageUrl,
    productUrl: product?.productUrl,
    productRating: product?.rating,
    productReviewCount: product?.reviewCount,
    productSoldCount: product?.soldCount,
    productHighlights: product?.highlights,
    compensationOffer: product?.compensationOffer,
    bodyText: stage === 'first' ? item.body : undefined,
    introText: stage === 'first' ? undefined : item.body,
    ctaHref: branding.email ? `mailto:${branding.email}?subject=${encodeURIComponent(item.subject)}` : undefined,
  });
  const missingEmailCount = rows.filter(r => !r.email).length;

  const handleGenerate = async () => {
    if (rows.length === 0) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/outreach/adhoc/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, sequenceStage: stage, contentSource, campaignId: campaignId || undefined }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Tạo bản nháp thất bại');
      setItems(data.data.map((it: any) => ({ ...it, sendStatus: 'idle' as SendStatus })));
    } catch (err: any) {
      setError(err.message || 'Tạo bản nháp thất bại');
    } finally {
      setGenerating(false);
    }
  };

  const updateItem = (handle: string, patch: Partial<DraftItem>) => {
    setItems(prev => prev ? prev.map(it => (it.handle === handle ? { ...it, ...patch } : it)) : prev);
  };

  const sendOne = async (item: DraftItem) => {
    updateItem(item.handle, { sendStatus: 'sending', sendError: undefined });
    try {
      const res = await fetch('/api/outreach/adhoc/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: item.email,
          subject: item.subject,
          body: item.body,
          cc: cc.trim() || undefined,
          creatorName: item.displayName,
          sequenceStage: stage,
          campaignId: campaignId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gửi thất bại');
      updateItem(item.handle, { sendStatus: 'sent' });
      return true;
    } catch (err: any) {
      updateItem(item.handle, { sendStatus: 'failed', sendError: err.message || 'Gửi thất bại' });
      return false;
    }
  };

  const handleSendAll = async () => {
    if (!items) return;
    setSending(true);
    const toSend = items.filter(it => it.status === 'draft' && it.sendStatus !== 'sent');
    for (let i = 0; i < toSend.length; i++) {
      await sendOne(toSend[i]);
      if (i < toSend.length - 1) await new Promise(r => setTimeout(r, randomDelayMs()));
    }
    setSending(false);
  };

  const clearAll = () => {
    setItems(null);
    setPasteText('');
    setError('');
    setPreviewHandle(null);
  };

  const sentCount = items?.filter(it => it.sendStatus === 'sent').length || 0;
  const sendableCount = items?.filter(it => it.status === 'draft').length || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Dán &amp; Gửi Outreach</h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-4">
        Dán thẳng cột Handle/Email/Tên hiển thị copy từ tab <span className="font-semibold">➜ GỬI OUTREACH</span> ở
        Google Sheet — không cần creator đã có trong app. Sheet vẫn là nơi duy nhất theo dõi đã gửi hay chưa.
      </p>

      {!items && (
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
          <textarea
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
            rows={8}
            spellCheck={false}
            placeholder={'glowbymina\tmina@brand.com\tMina Nguyen\nskinwithtee\ttee@brand.com\tTee Pham'}
            className="w-full p-3 text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 resize-y"
          />

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>
              Đọc được <span className="font-semibold text-slate-700 dark:text-slate-200">{rows.length}</span> handle.
              {missingEmailCount > 0 && (
                <span className="ml-1 text-amber-600 dark:text-amber-400 inline-flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {missingEmailCount} dòng thiếu email — sẽ bị bỏ qua.
                </span>
              )}
            </span>
            {pasteText && (
              <button onClick={() => setPasteText('')} className="underline underline-offset-2 hover:no-underline">
                Xoá ô
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <select
              value={stage}
              onChange={e => setStage(e.target.value as SequenceStage)}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              {STAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select
              value={contentSource}
              onChange={e => setContentSource(e.target.value as 'ai' | 'template')}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            >
              <option value="ai">Soạn bằng AI</option>
              <option value="template">Dùng mẫu có sẵn</option>
            </select>

            <select
              value={campaignId}
              onChange={e => setCampaignId(e.target.value)}
              title="Campaign — dùng để lấy logo/ảnh sản phẩm/offer cho khung mail. Bỏ trống vẫn gửi được, chỉ là không có ảnh sản phẩm."
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 max-w-[220px]"
            >
              <option value="">Không gắn campaign</option>
              {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>

            <input
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="CC (tuỳ chọn)"
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-48"
            />

            <button
              onClick={handleGenerate}
              disabled={rows.length === 0 || generating}
              className="ml-auto px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {generating && <Loader2 className="w-4 h-4 animate-spin" />}
              Soạn nháp cho {rows.length} creator
            </button>
          </div>

          {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        </div>
      )}

      {items && (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {sentCount}/{sendableCount} đã gửi
              {items.some(it => it.status === 'skipped_no_email') && (
                <span className="ml-2 text-amber-600 dark:text-amber-400">
                  · {items.filter(it => it.status === 'skipped_no_email').length} bị bỏ qua (thiếu email)
                </span>
              )}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={clearAll}
                disabled={sending}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-40 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" /> Làm lại từ đầu
              </button>
              <button
                onClick={handleSendAll}
                disabled={sending || sentCount >= sendableCount}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? 'Đang gửi…' : 'Gửi tất cả'}
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Phần soạn ở đây chỉ là chữ. Khi gửi, mail được bọc vào đúng khung HTML (logo, ảnh sản
            phẩm, offer, CTA) như Bulk Outreach — bấm <span className="font-semibold">Xem trước</span> để
            thấy mail thật. Chọn campaign ở bước dán nếu muốn có card sản phẩm.
          </p>

          <div className="space-y-3">
            {items.map(item => (
              <div
                key={item.handle}
                className={`p-4 rounded-xl border space-y-2 ${
                  item.status === 'skipped_no_email'
                    ? 'border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                    @{item.handle} {item.displayName && <span className="font-normal text-slate-400">· {item.displayName}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs">
                    <span className="text-slate-400">{item.email || '— thiếu email —'}</span>
                    {item.sendStatus === 'sent' && <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Đã gửi</span>}
                    {item.sendStatus === 'sending' && <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi</span>}
                    {item.sendStatus === 'failed' && <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1" title={item.sendError}><XCircle className="w-3.5 h-3.5" /> Lỗi</span>}
                    {item.status === 'draft' && (
                      <button
                        onClick={() => setPreviewHandle(prev => (prev === item.handle ? null : item.handle))}
                        className="px-2 py-1 text-[10px] font-bold text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
                      >
                        {previewHandle === item.handle ? <><Pencil className="w-3 h-3" /> Sửa</> : <><Eye className="w-3 h-3" /> Xem trước</>}
                      </button>
                    )}
                  </div>
                </div>

                {item.status === 'skipped_no_email' ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">{item.skipReason}</p>
                ) : (
                  <>
                    <input
                      value={item.subject}
                      onChange={e => updateItem(item.handle, { subject: e.target.value })}
                      disabled={item.sendStatus === 'sent' || item.sendStatus === 'sending'}
                      className="w-full px-2.5 py-1.5 text-sm font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 disabled:opacity-60"
                    />
                    {previewHandle === item.handle ? (
                      <iframe
                        title={`Xem trước - ${item.handle}`}
                        sandbox=""
                        srcDoc={renderPreview(item)}
                        className="w-full h-96 rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                      />
                    ) : (
                      <>
                        {stage !== 'first' && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            Đây chỉ là câu mở đầu (thay câu pitch mặc định) — phần sản phẩm, offer và CTA bên dưới vẫn giữ nguyên như mẫu.
                          </p>
                        )}
                        <textarea
                          value={item.body}
                          onChange={e => updateItem(item.handle, { body: e.target.value })}
                          disabled={item.sendStatus === 'sent' || item.sendStatus === 'sending'}
                          rows={4}
                          className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 resize-y disabled:opacity-60"
                        />
                      </>
                    )}
                    {item.sendStatus === 'failed' && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-rose-600 dark:text-rose-400">{item.sendError}</p>
                        <button
                          onClick={() => sendOne(item)}
                          className="text-xs font-semibold underline underline-offset-2 hover:no-underline text-rose-600 dark:text-rose-400"
                        >
                          Gửi lại
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
