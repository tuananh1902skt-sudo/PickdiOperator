import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Check, FileSpreadsheet } from 'lucide-react';
import { Creator, Campaign, CreatorCampaignAssignment, OutreachEmail, PostedVideo } from '../../types';

interface ExportViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  assignments: CreatorCampaignAssignment[];
  outreachList: OutreachEmail[];
  postedVideos: PostedVideo[];
}

function todayStr(): string {
  return toLocalDateStr(new Date().toISOString());
}

function toLocalDateStr(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'x' : '';
  return String(v);
}

// Làm tròn % về tối đa `digits` chữ số thập phân, bỏ ".0"/".00" thừa khi số tròn (vd 40.0% → 40%,
// 27.3% giữ nguyên) — khớp đúng cách file mẫu hiển thị % (không cố định số lẻ).
function roundPct(v: number, digits: number): string {
  const rounded = Number(v.toFixed(digits));
  return String(rounded);
}

// Top 2 ngành hàng theo % doanh thu thật (industry_groups từ TCM) — khớp đúng định dạng cột
// "Main Category (top 2)" của file d'Alba ("1. Beauty / Skincare 40%\n2. Womensweat 27.3%").
// Không có categorySplit (creator Kalodata/manual, chưa cào TCM) thì rơi về category đơn của creator.
function categoryTop2(creator?: Creator): string {
  // TCM trả cả bucket "-1" (chưa phân loại được ngành hàng) trong industry_groups — loại khỏi
  // top 2 vì không có ý nghĩa với VN/KR, không phải tên ngành hàng thật.
  const split = creator?.salesMetrics?.categorySplit?.filter(c => c.name !== '-1');
  if (split && split.length > 0) {
    return [...split]
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((c, i) => `${i + 1}. ${c.name} ${roundPct(c.value, 1)}%`)
      .join('\n');
  }
  return fmt(creator?.category);
}

// "Demographic" chỉ có 1 dòng dạng "Female 71.22%" trong file mẫu — ghép topGender với đúng
// % giới tính đó (genderFemale/genderMale), KHÔNG suy diễn khi thiếu 1 trong 2.
function demographicStr(creator?: Creator): string {
  const demo = creator?.demographics;
  if (!demo?.topGender) return '';
  const pct = demo.topGender === 'Female' ? demo.genderFemale : demo.topGender === 'Male' ? demo.genderMale : undefined;
  return pct !== undefined ? `${demo.topGender} ${roundPct(pct, 2)}%` : demo.topGender;
}

// GMV rút gọn dạng $53k/$1.2m/$3.4b cho dễ đọc trong cột "GMV/Video, Last 30d" — làm tròn
// về số nguyên (không giữ số lẻ như $53.1k) theo đúng ví dụ file mẫu yêu cầu.
function formatUsdShort(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let short: string;
  if (abs >= 1e9) short = `${Math.round(abs / 1e9)}b`;
  else if (abs >= 1e6) short = `${Math.round(abs / 1e6)}m`;
  else if (abs >= 1e3) short = `${Math.round(abs / 1e3)}k`;
  else short = String(Math.round(abs));
  return `${sign}$${short}`;
}

type ExportColumn = {
  section?: string; // nhãn nhóm cột (row 1 merge trong file gốc) — undefined = cột đứng riêng (vd "O/X & Reason")
  header: string;
  get: (ctx: RowContext) => string;
};

interface RowContext {
  creator?: Creator;
  assignment: CreatorCampaignAssignment;
  emails: OutreachEmail[]; // outreach emails của đúng cặp creator x campaign này
  totalGmv?: number; // tổng doanh thu các video đã đăng của đúng cặp creator x campaign này
}

// Cột đánh dấu [AUTO] trong file gốc là formula tính sẵn trên sheet (No., Quote per Video,
// Final per Video, Videos Delivered, GMV per Video, GMV/Fee, Stage) — để trống khi export vì
// operator sẽ kéo công thức có sẵn xuống dòng mới, export đè giá trị cứng vào sẽ làm hỏng
// công thức. Cột [VN]/[KR] mà app CHƯA có dữ liệu tương ứng (Offer, Reply/Quote Terms, KR
// Approval, Invoice, Brief, Payment, Renewal Call...) cũng để trống — đội VN/KR tự gõ tay
// thẳng trên Sheet, export không tự bịa dữ liệu.
const COLUMNS: ExportColumn[] = [
  { section: '1. Sourcing', header: 'No.', get: () => '' },
  { section: '1. Sourcing', header: 'Creator ID', get: () => '' },
  { section: '1. Sourcing', header: 'VN Owner', get: ({ creator }) => fmt(creator?.owner) },
  { section: '1. Sourcing', header: 'Listed Date', get: ({ assignment }) => toLocalDateStr(assignment.assignedAt) },
  { section: '1. Sourcing', header: 'TikTok Handle', get: ({ creator }) => fmt(creator?.handle) },
  { section: '1. Sourcing', header: 'TikTok Link', get: ({ creator }) => fmt(creator?.profileUrl) },
  { section: '1. Sourcing', header: 'Email', get: ({ creator }) => fmt(creator?.email) },
  { section: '1. Sourcing', header: 'Main Category (top 2)', get: ({ creator }) => categoryTop2(creator) },
  { section: '1. Sourcing', header: 'Demographic', get: ({ creator }) => demographicStr(creator) },
  { section: '1. Sourcing', header: 'GMV/Video, Last 30d ($)', get: ({ creator }) => formatUsdShort(creator?.gmv30d) },
  { section: '1. Sourcing', header: 'Why This Creator', get: ({ creator }) => fmt(creator?.scoreBreakdown?.strengths?.join('; ')) },
  { header: 'O/X & Reason', get: () => '' },
  { section: '2. Outreach', header: '1st Email Sent', get: ({ emails }) => {
    const first = [...emails].filter(e => e.sentAt).sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime())[0];
    return toLocalDateStr(first?.sentAt);
  } },
  { section: '2. Outreach', header: 'Offer', get: () => '' },
  { section: '2. Outreach', header: 'Reply Status', get: ({ emails }) => {
    const latest = [...emails].sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()).pop();
    return fmt(latest?.status);
  } },
  { section: '2. Outreach', header: 'Reply Date', get: ({ emails }) => {
    const replied = emails.filter(e => e.repliedAt).sort((a, b) => new Date(a.repliedAt!).getTime() - new Date(b.repliedAt!).getTime()).pop();
    return toLocalDateStr(replied?.repliedAt);
  } },
  { section: '3. Quote & Nego', header: 'Quote Total ($)', get: ({ assignment }) => fmt(assignment.originalPrice) },
  { section: '3. Quote & Nego', header: 'Quoted Videos', get: () => '' },
  { section: '3. Quote & Nego', header: 'Quote per Video ($)', get: () => '' },
  { section: '3. Quote & Nego', header: 'Quote Terms', get: () => '' },
  { section: '3. Quote & Nego', header: 'KR Target Price ($)', get: () => '' },
  { section: '3. Quote & Nego', header: 'Final Price ($)', get: ({ assignment }) => fmt(assignment.negotiatedPrice) },
  { section: '3. Quote & Nego', header: 'Final Videos', get: ({ assignment }) => fmt(assignment.contractedVideoCount) },
  { section: '3. Quote & Nego', header: 'Final per Video ($)', get: () => '' },
  { section: '3. Quote & Nego', header: 'Commission (%)', get: ({ assignment }) =>
    assignment.commissionPercent !== undefined ? fmt(assignment.commissionPercent / 100) : '' },
  { section: '3. Quote & Nego', header: 'Usage Rights (Spark)', get: () => '' },
  { section: '3. Quote & Nego', header: 'KR Approval', get: () => '' },
  { section: '3. Quote & Nego', header: 'KR Approval Date', get: () => '' },
  // contractUrl chỉ có 1 field trong app — dùng castingStage để suy ra đây là link bản nháp
  // hay bản đã ký, vì file gốc tách 2 cột (Contract Draft vs Signed by d'Alba) riêng.
  { section: '4. Contract & Approval', header: 'Contract Draft', get: ({ assignment }) =>
    assignment.contractUrl && assignment.castingStage !== 'Signed' && assignment.castingStage !== 'Confirmed' ? assignment.contractUrl : '' },
  { section: '4. Contract & Approval', header: 'Contract Sent', get: () => '' },
  { section: '4. Contract & Approval', header: "Signed by d'Alba", get: ({ assignment }) =>
    assignment.contractUrl && (assignment.castingStage === 'Signed' || assignment.castingStage === 'Confirmed') ? assignment.contractUrl : '' },
  { section: '4. Contract & Approval', header: 'Separate Invoice', get: () => '' },
  { section: '4. Contract & Approval', header: 'Invoice No.', get: () => '' },
  { section: '4. Contract & Approval', header: 'KR Payment Req. Filed', get: () => '' },
  { section: '4. Contract & Approval', header: 'KR Payment Req. Appr.', get: () => '' },
  { section: '5. Brief', header: 'Brief / Guide Link', get: () => '' },
  { section: '5. Brief', header: 'Brief Sent', get: () => '' },
  { section: '6. Delivery & Payment', header: 'Videos Delivered', get: () => '' },
  { section: '6. Delivery & Payment', header: 'KR Delivery Check', get: () => '' },
  { section: '6. Delivery & Payment', header: 'Payment Method', get: () => '' },
  { section: '6. Delivery & Payment', header: 'Payment Account', get: () => '' },
  { section: '6. Delivery & Payment', header: 'KR Paid Amount ($)', get: () => '' },
  { section: '6. Delivery & Payment', header: 'KR Paid Date', get: () => '' },
  { section: '7. Performance', header: 'Total GMV ($)', get: ({ totalGmv }) => fmt(totalGmv) },
  { section: '7. Performance', header: 'GMV per Video ($)', get: () => '' },
  { section: '7. Performance', header: 'GMV / Fee (x)', get: () => '' },
  { section: '7. Performance', header: 'KR Renewal Call', get: () => '' },
  { section: '8. Status', header: 'Stage', get: () => '' },
  { section: '8. Status', header: 'Notes', get: ({ assignment, creator }) =>
    fmt(assignment.notes) || fmt(creator?.notes?.map(n => n.content).join(' | ')) }
];

// Nhãn nhóm chỉ lặp lại ở cột đầu tiên của mỗi nhóm liên tiếp (giống merge cell ở row 1 file
// gốc), các cột sau trong cùng nhóm để trống — tránh lặp lại tên nhóm 11 lần liền nhau.
function groupHeaderLine(): string[] {
  const line: string[] = [];
  let prevSection: string | undefined;
  COLUMNS.forEach(col => {
    if (col.section && col.section !== prevSection) {
      line.push(col.section);
    } else {
      line.push('');
    }
    prevSection = col.section;
  });
  return line;
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function rowsToTsv(headerLines: string[][], rows: string[][]): string {
  const headerText = headerLines.map(line => line.join('\t'));
  const dataLines = rows.map(r => r.map(v => v.replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
  return [...headerText, ...dataLines].join('\n');
}

function rowsToCsv(headerLines: string[][], rows: string[][]): string {
  const headerText = headerLines.map(line => line.map(csvEscape).join(','));
  const dataLines = rows.map(r => r.map(csvEscape).join(','));
  return [...headerText, ...dataLines].join('\n');
}

function downloadCsv(filename: string, headerLines: string[][], rows: string[][]) {
  const csv = rowsToCsv(headerLines, rows);
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ExportView: React.FC<ExportViewProps> = ({ creators, campaigns, assignments, outreachList, postedVideos }) => {
  const activeCampaigns = useMemo(() => campaigns.filter(c => c.status !== 'Archived'), [campaigns]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => activeCampaigns[0]?.id || campaigns[0]?.id || '');
  const campaignId = selectedCampaignId || activeCampaigns[0]?.id || campaigns[0]?.id || '';
  // Lọc theo "Listed Date" (= ngày assign vào campaign) để mỗi lần nộp chỉ xuất đúng số creator
  // mới thêm trong ngày đó — render cả nghìn dòng 1 lúc (toàn bộ roster của campaign) làm treo
  // trình duyệt, và thực tế thao tác nộp file cũng diễn ra theo ngày chứ không phải 1 lần duy nhất.
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const creatorById = useMemo(() => new Map(creators.map(c => [c.id, c])), [creators]);

  const filteredAssignments = useMemo(() => {
    return assignments
      .filter(a => a.campaignId === campaignId && toLocalDateStr(a.assignedAt) === selectedDate)
      .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime());
  }, [assignments, campaignId, selectedDate]);

  // `creators` (App.tsx global list state) cố tình bỏ demographics/salesMetrics để nhẹ khi load
  // cả 3900+ creator (xem comment CREATOR_LIST_COLUMNS trong db.ts) — Main Category (top 2) và
  // Demographic cần 2 field JSONB đó nên phải fetch riêng qua getCreatorById cho từng creator
  // ĐANG hiển thị (số dòng đã nhỏ vì lọc theo ngày ở trên rồi, không phải fetch cả roster).
  const [detailById, setDetailById] = useState<Map<string, Creator>>(new Map());
  // Khoá effect theo chuỗi id (primitive) thay vì theo reference của `filteredAssignments` —
  // App.tsx tạo mảng assignments/creators MỚI mỗi lần re-render (không useMemo ở đó) nên reference
  // đổi liên tục. Đánh dấu "đã fetch" bằng useRef (không phải state) để tránh fetch lặp lại.
  // KHÔNG dùng cờ "cancelled" ở đây — React StrictMode (dev) chạy effect 2 lần liên tiếp
  // (mount → cleanup → mount lại); ref đã dedupe id nên lần chạy thứ 2 không fetch lại, nhưng
  // nếu có cờ cancelled thì cleanup của lần 2 sẽ huỷ luôn kết quả của lần fetch DUY NHẤT (lần 1),
  // khiến dữ liệu tải về không bao giờ được áp dụng vào state.
  const attemptedIdsRef = useRef<Set<string>>(new Set());
  const creatorIdsKey = useMemo(() => filteredAssignments.map(a => a.creatorId).join(','), [filteredAssignments]);
  useEffect(() => {
    const ids = creatorIdsKey ? creatorIdsKey.split(',').filter(Boolean) : [];
    const idsToFetch = ids.filter(id => !attemptedIdsRef.current.has(id));
    if (idsToFetch.length === 0) return;
    idsToFetch.forEach(id => attemptedIdsRef.current.add(id));
    Promise.all(idsToFetch.map(id => fetch(`/api/creators/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)))
      .then(results => {
        setDetailById(prev => {
          const next = new Map(prev);
          results.forEach((res, i) => {
            if (res?.data) next.set(idsToFetch[i], res.data as Creator);
          });
          return next;
        });
      });
  }, [creatorIdsKey]);

  const rows = useMemo(() => {
    return filteredAssignments.map(assignment => {
      const summary = creatorById.get(assignment.creatorId);
      const detail = detailById.get(assignment.creatorId);
      const creator = summary && detail ? { ...summary, demographics: detail.demographics, salesMetrics: detail.salesMetrics } : summary;
      const emails = outreachList.filter(o => o.creatorId === assignment.creatorId && o.campaignId === campaignId);
      const posted = postedVideos.filter(v => v.creatorId === assignment.creatorId && v.campaignId === campaignId);
      const totalGmv = posted.length > 0
        ? posted.reduce((sum, v) => sum + (v.totalRevenue || 0), 0)
        : undefined;
      const ctx: RowContext = { creator, assignment, emails, totalGmv };
      return COLUMNS.map(col => col.get(ctx));
    });
  }, [filteredAssignments, outreachList, postedVideos, creatorById, detailById, campaignId]);

  const headers = useMemo(() => COLUMNS.map(c => c.header), []);
  const headerLines = useMemo(() => [groupHeaderLine(), headers], [headers]);
  const selectedCampaignName = campaigns.find(c => c.id === campaignId)?.name || '';
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const tsv = rowsToTsv(headerLines, rows);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Xuất dữ liệu cho Google Sheet d'Alba</h2>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="export-campaign" className="text-sm text-slate-500 dark:text-slate-400">Sản phẩm / Campaign</label>
          <select
            id="export-campaign"
            value={campaignId}
            onChange={e => setSelectedCampaignId(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            {campaigns.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <label htmlFor="export-date" className="text-sm text-slate-500 dark:text-slate-400">Ngày</label>
          <input
            id="export-date"
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{selectedCampaignName || 'Chọn campaign'}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{rows.length} creator</span>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Đã copy' : 'Copy'}
            </button>
            <button
              onClick={() => downloadCsv(`${selectedCampaignName || 'export'}-${selectedDate}.csv`, headerLines, rows)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Tải CSV
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500">
                {groupHeaderLine().map((g, i) => (
                  <th key={i} className="px-3 py-1 text-left font-medium whitespace-nowrap border-b border-slate-100 dark:border-slate-800">{g}</th>
                ))}
              </tr>
              <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length || 1} className="px-3 py-6 text-center text-slate-400">
                    Chưa có creator nào cho campaign này
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {cell.split('\n').map((line, k) => <div key={k}>{line}</div>) || <span className="text-slate-300 dark:text-slate-700">—</span>}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
