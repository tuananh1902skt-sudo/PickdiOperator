import React, { useEffect, useState } from 'react';
import { Handshake, Send, Plus, Trash2, Loader2, CheckCircle2, XCircle, Eye, Pencil } from 'lucide-react';
import type { Campaign } from '../../types';
import { renderDealOfferEmailHtml, DEAL_OFFER_DEFAULT_INTRO } from '../../lib/emailTemplate';
import { pickRandomDealOfferSubject } from '../../lib/outreachSubjects';

// Module "Chốt Deal": mỗi creator một deal riêng (số video, tổng phí, link video) — rate đã được
// client duyệt. Tách hẳn khỏi Dán & Gửi Outreach (không dán hàng loạt, không chia sẻ state):
// thêm từng creator, chỉnh số, xem trước mail thật rồi gửi từng mail một.
interface EmailBranding {
  brand?: string;
  logoUrl?: string;
  primaryColor?: string;
  email?: string;
  senderName?: string;
}

type SendStatus = 'idle' | 'sending' | 'sent' | 'failed';

interface DealRow {
  id: string;
  handle: string;
  email: string;
  displayName: string;
  videoCount: string;
  totalFee: string;
  referenceVideoUrl: string;
  subject: string;
  intro: string;
  sendStatus: SendStatus;
  sendError?: string;
}

// Mặc định CC đại diện client (người duyệt rate) — sửa/xoá được ở ô CC.
const DEFAULT_CC = 'dohyeon.kim@dalba.com';

let rowSeq = 0;
function newRow(): DealRow {
  return {
    id: `deal-${Date.now()}-${rowSeq++}`,
    handle: '', email: '', displayName: '',
    videoCount: '5', totalFee: '', referenceVideoUrl: '',
    subject: pickRandomDealOfferSubject(),
    intro: DEAL_OFFER_DEFAULT_INTRO,
    sendStatus: 'idle',
  };
}

const inputCls = 'px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-60';

interface DealOfferViewProps {
  campaigns: Campaign[];
}

export const DealOfferView: React.FC<DealOfferViewProps> = ({ campaigns }) => {
  const [rows, setRows] = useState<DealRow[]>(() => [newRow()]);
  const [campaignId, setCampaignId] = useState('');
  const [productName, setProductName] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [cc, setCc] = useState(DEFAULT_CC);
  const [branding, setBranding] = useState<EmailBranding>({});
  const [previewId, setPreviewId] = useState<string | null>(null);

  // Preview phải khớp đúng mail server dựng (cùng renderer, cùng branding trong Settings > Email).
  useEffect(() => {
    fetch('/api/settings/email')
      .then(res => res.json())
      .then(json => { if (json?.success) setBranding(json.data); })
      .catch(err => console.error('Failed to load email branding:', err));
  }, []);

  const campaign = campaigns.find(c => c.id === campaignId);
  const product = campaign?.products?.[0];

  const update = (id: string, patch: Partial<DealRow>) =>
    setRows(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));

  const renderPreview = (r: DealRow) => renderDealOfferEmailHtml({
    creatorName: r.displayName || r.handle,
    senderName: branding.senderName,
    brandName: campaign?.name || branding.brand,
    logoUrl: branding.logoUrl,
    primaryColor: branding.primaryColor,
    introText: r.intro,
    productName: productName.trim() || product?.name,
    productImageUrl: product?.imageUrl,
    productUrl: product?.productUrl,
    productRating: product?.rating,
    productReviewCount: product?.reviewCount,
    productSoldCount: product?.soldCount,
    productHighlights: product?.highlights,
    videoCount: r.videoCount.trim() || undefined,
    totalFee: r.totalFee.trim() || undefined,
    referenceVideoUrl: r.referenceVideoUrl.trim() || undefined,
    paymentTerms: paymentTerms.trim() || undefined,
    ctaHref: branding.email ? `mailto:${branding.email}?subject=${encodeURIComponent(r.subject)}` : undefined,
  });

  const missing = (r: DealRow) =>
    !r.email.trim() ? 'Thiếu email' : !r.videoCount.trim() ? 'Thiếu số video' : !r.totalFee.trim() ? 'Thiếu tổng phí' : '';

  const sendOne = async (r: DealRow) => {
    const problem = missing(r);
    if (problem) { update(r.id, { sendStatus: 'failed', sendError: problem }); return; }
    if (!window.confirm(`Gửi offer ${r.videoCount} video / ${r.totalFee} tới ${r.email}?`)) return;
    update(r.id, { sendStatus: 'sending', sendError: undefined });
    try {
      const res = await fetch('/api/outreach/deal/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: r.email.trim(),
          subject: r.subject,
          body: r.intro,
          cc: cc.trim() || undefined,
          creatorName: r.displayName || r.handle,
          campaignId: campaignId || undefined,
          deal: {
            productName: productName.trim() || undefined,
            videoCount: r.videoCount.trim(),
            totalFee: r.totalFee.trim(),
            referenceVideoUrl: r.referenceVideoUrl.trim() || undefined,
            paymentTerms: paymentTerms.trim() || undefined,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Gửi thất bại');
      update(r.id, { sendStatus: 'sent' });
    } catch (err: any) {
      update(r.id, { sendStatus: 'failed', sendError: err.message || 'Gửi thất bại' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Handshake className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Chốt Deal</h2>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 -mt-4">
        Mail offer paid với số video + tổng phí cụ thể cho từng creator. Chỉ dùng cho rate đã được client duyệt —
        mỗi creator một dòng, đổi số là ra mail mới. Thanh toán mặc định Net-30 sau khi giao nội dung.
      </p>

      <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
        <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Áp cho mọi deal</div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={campaignId}
            onChange={e => setCampaignId(e.target.value)}
            title="Campaign — lấy logo, ảnh, rating và link sản phẩm cho thẻ sản phẩm trong mail."
            className={`${inputCls} max-w-[220px]`}
          >
            <option value="">Không gắn campaign</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={productName} onChange={e => setProductName(e.target.value)}
            placeholder="Tên sản phẩm (bỏ trống = sản phẩm của campaign)" className={`${inputCls} w-72`} />
          <input value={paymentTerms} onChange={e => setPaymentTerms(e.target.value)}
            placeholder="Thanh toán (bỏ trống = Net-30)" className={`${inputCls} w-56`} />
          <input value={cc} onChange={e => setCc(e.target.value)} placeholder="CC" className={`${inputCls} w-56`} />
        </div>
      </div>

      <div className="space-y-3">
        {rows.map(r => {
          const locked = r.sendStatus === 'sent' || r.sendStatus === 'sending';
          return (
            <div key={r.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <input value={r.handle} onChange={e => update(r.id, { handle: e.target.value.replace(/^@/, '') })} disabled={locked} placeholder="Handle (vd dealswithkeelz)" className={inputCls} />
                <input value={r.displayName} onChange={e => update(r.id, { displayName: e.target.value })} disabled={locked} placeholder="Tên hiển thị (vd KEELZ)" className={inputCls} />
                <input value={r.email} onChange={e => update(r.id, { email: e.target.value })} disabled={locked} placeholder="Email" className={inputCls} />
                <input value={r.videoCount} onChange={e => update(r.id, { videoCount: e.target.value })} disabled={locked} placeholder="Số video" className={inputCls} />
                <input value={r.totalFee} onChange={e => update(r.id, { totalFee: e.target.value })} disabled={locked} placeholder="Tổng phí (vd $2,000)" className={inputCls} />
                <input value={r.referenceVideoUrl} onChange={e => update(r.id, { referenceVideoUrl: e.target.value })} disabled={locked} placeholder="Link video của creator (tuỳ chọn)" className={inputCls} />
              </div>
              <input value={r.subject} onChange={e => update(r.id, { subject: e.target.value })} disabled={locked}
                className={`${inputCls} w-full font-medium`} />

              {previewId === r.id ? (
                <iframe
                  title={`Xem trước - ${r.handle || r.id}`}
                  sandbox=""
                  srcDoc={renderPreview(r)}
                  className="w-full h-[32rem] rounded-lg border border-slate-200 dark:border-slate-700 bg-white"
                />
              ) : (
                <textarea value={r.intro} onChange={e => update(r.id, { intro: e.target.value })} disabled={locked} rows={3}
                  className={`${inputCls} w-full resize-y`} />
              )}

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs">
                  {r.sendStatus === 'sent' && <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Đã gửi</span>}
                  {r.sendStatus === 'sending' && <span className="text-indigo-600 dark:text-indigo-400 flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Đang gửi</span>}
                  {r.sendStatus === 'failed' && <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> {r.sendError}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewId(prev => (prev === r.id ? null : r.id))}
                    className="px-2.5 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1"
                  >
                    {previewId === r.id ? <><Pencil className="w-3.5 h-3.5" /> Sửa</> : <><Eye className="w-3.5 h-3.5" /> Xem trước</>}
                  </button>
                  {r.sendStatus !== 'sent' && rows.length > 1 && (
                    <button onClick={() => setRows(prev => prev.filter(x => x.id !== r.id))} disabled={locked}
                      className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-40" title="Xoá dòng">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => sendOne(r)}
                    disabled={locked}
                    className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" /> Gửi
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={() => setRows(prev => [...prev, newRow()])}
        className="px-3 py-2 text-sm font-semibold rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Thêm creator
      </button>
    </div>
  );
};
