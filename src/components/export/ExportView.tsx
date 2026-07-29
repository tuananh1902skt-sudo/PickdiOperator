import React, { useMemo, useState } from 'react';
import { Copy, Download, Check, FileSpreadsheet } from 'lucide-react';
import { Creator, Campaign, CreatorCampaignAssignment, ContentReview, PostedVideo } from '../../types';

interface ExportViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  assignments: CreatorCampaignAssignment[];
  reviews: ContentReview[];
  postedVideos: PostedVideo[];
}

// 1 dòng bảng xuất — mỗi phần tử là {header, value} để giữ đúng thứ tự cột lúc copy/CSV,
// tránh lệch cột nếu sau này thêm/bớt field mà quên sửa đồng bộ ở 2 chỗ. `href` chỉ dùng để
// hiện link bấm được trên màn hình — Copy/CSV vẫn chỉ lấy `value` (text thường), vì Google
// Sheet dán TSV không giữ được hyperlink từ clipboard HTML theo cách đáng tin cậy.
type ExportCell = { header: string; value: string; href?: string };
type ExportRow = ExportCell[];

function todayStr(): string {
  return toLocalDateStr(new Date().toISOString());
}

// So ngày phải theo giờ LOCAL của máy operator, không phải ngày UTC trong ISO string —
// assignedAt/submittedAt/postedAt đều lưu bằng new Date().toISOString() (UTC). Với giờ VN
// (UTC+7), bất kỳ record nào tạo lúc 00:00-06:59 giờ local vẫn còn là ngày UTC hôm trước,
// nên so `.startsWith(selectedDate)` (selectedDate = ngày local) làm record đó biến mất
// khỏi export "hôm nay" cho tới khi tự lùi date-picker lại 1 ngày.
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

// GMV lưu ở đơn vị USD — rút gọn dạng $30K/$1.2M/$3.4B cho dễ đọc, bỏ ".0" thừa khi số tròn
// (vd $30.0K → $30K), giữ 1 số thập phân khi không tròn để không mất độ chính xác cần thiết.
function formatUsdShort(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let short: string;
  if (abs >= 1e9) short = `${(abs / 1e9).toFixed(1)}B`;
  else if (abs >= 1e6) short = `${(abs / 1e6).toFixed(1)}M`;
  else if (abs >= 1e3) short = `${(abs / 1e3).toFixed(1)}K`;
  else short = abs.toFixed(0);
  short = short.replace(/\.0([KMB])?$/, '$1');
  return `${sign}$${short}`;
}

// Copy dạng TSV (tab-separated) — đây là định dạng Google Sheet/Excel hiểu đúng khi dán,
// tự tách đúng từng cột, không lệch hàng/cột như copy text thường. Header truyền riêng
// (không lấy từ rows[0]) để cột luôn đúng kể cả khi bảng không có dòng dữ liệu nào.
function rowsToTsv(headers: string[], rows: ExportRow[]): string {
  const headerLine = headers.join('\t');
  const dataLines = rows.map(r => r.map(c => c.value.replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
  return [headerLine, ...dataLines].join('\n');
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function rowsToCsv(headers: string[], rows: ExportRow[]): string {
  const headerLine = headers.map(csvEscape).join(',');
  const dataLines = rows.map(r => r.map(c => csvEscape(c.value)).join(','));
  return [headerLine, ...dataLines].join('\n');
}

function downloadCsv(filename: string, headers: string[], rows: ExportRow[]) {
  const csv = rowsToCsv(headers, rows);
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

const CHECKLIST_LABELS: { key: keyof NonNullable<ContentReview['checklist']>; label: string }[] = [
  { key: 'productNameCorrect', label: 'Tên SP đúng' },
  { key: 'ingredientsBenefitsCorrect', label: 'Thành phần/Công dụng đúng' },
  { key: 'durationValid', label: 'Độ dài hợp lý' },
  { key: 'hookIn3Seconds', label: 'Hook 3s đầu' },
  { key: 'matchesBrief', label: 'Đúng brief' }
];

function checklistCell(v?: boolean): string {
  if (v === true) return 'Đạt';
  if (v === false) return 'Không đạt';
  return '';
}

const SOURCING_HEADERS = [
  'Ngày', 'Handle', 'Link TikTok', 'GMV 30 ngày (USD)', 'Đạt/Không đạt', 'Email', 'Sản phẩm', 'Số video hợp đồng',
  'Giá gốc', 'Giá đã chốt', 'Giá mỗi video', '% Hoa hồng', 'Trạng thái', 'Giai đoạn casting', 'Link hợp đồng'
];
const DRAFT_HEADERS = [
  'Handle', 'Link TikTok', 'Số hợp đồng', 'Số thứ tự bản nháp', 'Link Drive', ...CHECKLIST_LABELS.map(c => c.label), 'Feedback'
];
const UPLOADED_HEADERS = [
  'Handle', 'Link TikTok', 'Đợt', 'Giá mỗi video', 'Paid/Non-paid', 'Ngày đăng', 'Link video', 'Video ID', 'Ad code',
  'ROI', 'Tổng doanh thu', 'Tổng đơn', 'Tổng chi ads'
];

interface ExportTableProps {
  title: string;
  headers: string[];
  rows: ExportRow[];
  filename: string;
}

const ExportTable: React.FC<ExportTableProps> = ({ title, headers, rows, filename }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const tsv = rowsToTsv(headers, rows);
    await navigator.clipboard.writeText(tsv);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{rows.length} dòng</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Đã copy' : 'Copy'}
          </button>
          <button
            onClick={() => downloadCsv(filename, headers, rows)}
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
            <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400">
              {headers.map(h => (
                <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length || 1} className="px-3 py-6 text-center text-slate-400">
                  Không có dữ liệu cho ngày này
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  {row.map((cell, j) => (
                    <td key={j} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {cell.href && cell.value ? (
                        <a
                          href={cell.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                          {cell.value}
                        </a>
                      ) : (
                        cell.value || <span className="text-slate-300 dark:text-slate-700">—</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export const ExportView: React.FC<ExportViewProps> = ({ creators, campaigns, assignments, reviews, postedVideos }) => {
  const [selectedDate, setSelectedDate] = useState(todayStr());

  const creatorById = useMemo(() => new Map(creators.map(c => [c.id, c])), [creators]);
  const campaignById = useMemo(() => new Map(campaigns.map(c => [c.id, c])), [campaigns]);

  const sourcingRows: ExportRow[] = useMemo(() => {
    return assignments
      .filter(a => toLocalDateStr(a.assignedAt) === selectedDate)
      .map(a => {
        const creator = creatorById.get(a.creatorId);
        return [
          { header: 'Ngày', value: fmt(toLocalDateStr(a.assignedAt)) },
          { header: 'Handle', value: fmt(creator?.handle), href: creator?.profileUrl },
          { header: 'Link TikTok', value: fmt(creator?.profileUrl) },
          { header: 'GMV 30 ngày (USD)', value: formatUsdShort(creator?.gmv30d) },
          { header: 'Đạt/Không đạt', value: fmt(a.qualification) },
          { header: 'Email', value: fmt(creator?.email) },
          { header: 'Sản phẩm', value: fmt(a.campaignName || campaignById.get(a.campaignId)?.name) },
          { header: 'Số video hợp đồng', value: fmt(a.contractedVideoCount) },
          { header: 'Giá gốc', value: fmt(a.originalPrice) },
          { header: 'Giá đã chốt', value: fmt(a.negotiatedPrice) },
          { header: 'Giá mỗi video', value: fmt(a.pricePerVideo) },
          { header: '% Hoa hồng', value: fmt(a.commissionPercent) },
          { header: 'Trạng thái', value: fmt(a.status) },
          { header: 'Giai đoạn casting', value: fmt(a.castingStage) },
          { header: 'Link hợp đồng', value: fmt(a.contractUrl) }
        ];
      });
  }, [assignments, creatorById, campaignById, selectedDate]);

  // "Số hợp đồng" (Video Draft) = số video đã ký hợp đồng của assignment cùng creator+campaign
  // với review này (khớp cột "Số video hợp đồng" ở Sourcing List, không phải field riêng).
  // "Số thứ tự bản nháp" không có field riêng trong ContentReview — tính bằng thứ tự nộp
  // (submittedAt) trong các review cùng creator+campaign, vì mỗi lần yêu cầu sửa lại sẽ tạo
  // ra 1 lần nộp bản nháp mới.
  const draftRows: ExportRow[] = useMemo(() => {
    const dayReviews = reviews.filter(r => toLocalDateStr(r.submittedAt) === selectedDate);
    const orderByGroup = new Map<string, ContentReview[]>();
    reviews.forEach(r => {
      const key = `${r.creatorId}::${r.campaignId}`;
      const list = orderByGroup.get(key) || [];
      list.push(r);
      orderByGroup.set(key, list);
    });
    orderByGroup.forEach(list => list.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()));

    return dayReviews.map(r => {
      const key = `${r.creatorId}::${r.campaignId}`;
      const draftIndex = (orderByGroup.get(key) || []).findIndex(x => x.id === r.id) + 1;
      const assignment = assignments.find(a => a.creatorId === r.creatorId && a.campaignId === r.campaignId);
      const creator = creatorById.get(r.creatorId);
      const row: ExportRow = [
        { header: 'Handle', value: fmt(r.creatorHandle), href: creator?.profileUrl },
        { header: 'Link TikTok', value: fmt(creator?.profileUrl) },
        { header: 'Số hợp đồng', value: fmt(assignment?.contractedVideoCount) },
        { header: 'Số thứ tự bản nháp', value: fmt(draftIndex) },
        { header: 'Link Drive', value: fmt(r.draftUrl) }
      ];
      CHECKLIST_LABELS.forEach(({ key, label }) => {
        row.push({ header: label, value: checklistCell(r.checklist?.[key]) });
      });
      row.push({ header: 'Feedback', value: fmt(r.feedback || r.feedbackNote) });
      return row;
    });
  }, [reviews, assignments, creatorById, selectedDate]);

  const uploadedRows: ExportRow[] = useMemo(() => {
    return postedVideos
      .filter(v => toLocalDateStr(v.postedAt) === selectedDate)
      .map(v => {
        const creator = creatorById.get(v.creatorId);
        return [
        { header: 'Handle', value: fmt(v.creatorHandle), href: creator?.profileUrl },
        { header: 'Link TikTok', value: fmt(creator?.profileUrl) },
        { header: 'Đợt', value: fmt(v.round) },
        { header: 'Giá mỗi video', value: fmt(v.pricePerVideo) },
        { header: 'Paid/Non-paid', value: fmt(v.paid ? 'Paid' : 'Non-Paid') },
        { header: 'Ngày đăng', value: fmt(toLocalDateStr(v.postedAt)) },
        { header: 'Link video', value: fmt(v.videoUrl) },
        { header: 'Video ID', value: fmt(v.videoId) },
        { header: 'Ad code', value: fmt(v.adCode) },
        { header: 'ROI', value: fmt(v.roi) },
        { header: 'Tổng doanh thu', value: fmt(v.totalRevenue) },
        { header: 'Tổng đơn', value: fmt(v.totalOrders) },
        { header: 'Tổng chi ads', value: fmt(v.totalAdSpend) }
        ];
      });
  }, [postedVideos, creatorById, selectedDate]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Xuất dữ liệu cho Google Sheet d'Alba</h2>
        </div>
        <div className="flex items-center gap-2">
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

      <ExportTable title="Sourcing List" headers={SOURCING_HEADERS} rows={sourcingRows} filename={`sourcing-list-${selectedDate}.csv`} />
      <ExportTable title="Video Draft" headers={DRAFT_HEADERS} rows={draftRows} filename={`video-draft-${selectedDate}.csv`} />
      <ExportTable title="Uploaded" headers={UPLOADED_HEADERS} rows={uploadedRows} filename={`uploaded-${selectedDate}.csv`} />
    </div>
  );
};
