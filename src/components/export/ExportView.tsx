import React, { useMemo, useState } from 'react';
import { Copy, Download, Check, FileSpreadsheet } from 'lucide-react';
import { Creator, Campaign, CreatorCampaignAssignment, OutreachEmail, PostedVideo } from '../../types';

interface ExportViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  assignments: CreatorCampaignAssignment[];
  outreachList: OutreachEmail[];
  postedVideos: PostedVideo[];
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

// Top 2 ngành hàng theo % doanh thu thật (industry_groups từ TCM) — khớp đúng định dạng cột
// "Main Category (top 2)" của file d'Alba ("1. Beauty / Skincare 40%\n2. ..."). Không có
// categorySplit (creator Kalodata/manual, chưa cào TCM) thì rơi về category đơn của creator.
function categoryTop2(creator?: Creator): string {
  const split = creator?.salesMetrics?.categorySplit;
  if (split && split.length > 0) {
    return [...split]
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((c, i) => `${i + 1}. ${c.name} ${c.value}%`)
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
  return pct !== undefined ? `${demo.topGender} ${pct}%` : demo.topGender;
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
  { section: '1. Sourcing', header: 'GMV/Video, Last 30d ($)', get: ({ creator }) => fmt(creator?.gmv30d) },
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

  const creatorById = useMemo(() => new Map(creators.map(c => [c.id, c])), [creators]);

  const rows = useMemo(() => {
    return assignments
      .filter(a => a.campaignId === campaignId)
      .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime())
      .map(assignment => {
        const creator = creatorById.get(assignment.creatorId);
        const emails = outreachList.filter(o => o.creatorId === assignment.creatorId && o.campaignId === campaignId);
        const posted = postedVideos.filter(v => v.creatorId === assignment.creatorId && v.campaignId === campaignId);
        const totalGmv = posted.length > 0
          ? posted.reduce((sum, v) => sum + (v.totalRevenue || 0), 0)
          : undefined;
        const ctx: RowContext = { creator, assignment, emails, totalGmv };
        return COLUMNS.map(col => col.get(ctx));
      });
  }, [assignments, outreachList, postedVideos, creatorById, campaignId]);

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
              onClick={() => downloadCsv(`${selectedCampaignName || 'export'}-${toLocalDateStr(new Date().toISOString())}.csv`, headerLines, rows)}
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
