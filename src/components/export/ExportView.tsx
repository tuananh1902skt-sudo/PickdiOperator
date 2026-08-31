import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Check, FileSpreadsheet } from 'lucide-react';
import { Creator } from '../../types';

interface ExportViewProps {
  creators: Creator[];
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
function formatUsdShort(v: number | undefined | null, plain = false): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  // Số thuần (Đ9 trong PIPELINE_SHEET_SPEC.md): xuất "53000" thay vì "$53k". Dạng rút gọn
  // đọc đẹp nhưng vào Sheet là CHUỖI — đó chính là lý do 1.305/1.593 ô GMV của file client
  // hiện tại không tính được công thức nào.
  if (plain) return String(Math.round(v));
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let short: string;
  if (abs >= 1e9) short = `${Math.round(abs / 1e9)}b`;
  else if (abs >= 1e6) short = `${Math.round(abs / 1e6)}m`;
  else if (abs >= 1e3) short = `${Math.round(abs / 1e3)}k`;
  else short = String(Math.round(abs));
  return `${sign}$${short}`;
}

// Generates a 1-line rationale for the "Why This Creator" column from existing metrics (no AI
// call) — dynamically picks the 2-3 most notable signals (GMV, % beauty, demographic, engagement,
// risk) per creator, then appends a situational conclusion instead of one fixed template for all.
function whyThisCreator(creator?: Creator): string {
  if (!creator) return '';
  const facts: string[] = [];

  const gmv = creator.gmv30d;
  if (gmv !== undefined && gmv > 0) facts.push(`GMV 30d ${formatUsdShort(gmv)}`);

  const beautyRatio = creator.beautyCategoryRatio
    ?? creator.salesMetrics?.categorySplit?.find(c => c.name.toLowerCase().includes('beauty'))?.value;
  if (beautyRatio !== undefined) facts.push(`${roundPct(beautyRatio, 0)}% revenue from beauty category`);

  const demo = creator.demographics;
  if (demo?.topGender && demo?.topAgeGroup) {
    facts.push(`top audience ${demo.topGender} ${demo.topAgeGroup}${demo.topCountry ? ` in ${demo.topCountry}` : ''}`);
  }

  if (creator.engagementRate !== undefined && creator.engagementRate >= 7) {
    facts.push(`engagement ${roundPct(creator.engagementRate, 1)}% above average`);
  }

  if (facts.length === 0) return '';

  const collabCount = creator.collabMetrics?.brandCollabCount;
  const isTopTier = creator.gmvTier === 'L4' || creator.gmvTier === 'L5';

  let conclusion = '';
  if (isTopTier) {
    conclusion = collabCount ? `safe pick, already collabed with ${collabCount} other brands` : 'safe pick';
  } else if (beautyRatio !== undefined && beautyRatio >= 50) {
    conclusion = 'strong fit for the category';
  } else if ((gmv === undefined || gmv < 5000) && creator.engagementRate !== undefined && creator.engagementRate >= 7) {
    conclusion = 'good candidate to test a new product';
  }

  return conclusion ? `${facts.slice(0, 3).join(', ')} — ${conclusion}.` : `${facts.slice(0, 3).join(', ')}.`;
}

// ─── Bộ cột thứ hai: xuất sang tab MAIN của sheet vận hành ───────────────────────────────
// Tên cột dưới đây khớp CHÍNH XÁC bảng nhận diện SYN trong apps-script (Import.gs) — dán
// nguyên khối này vào tab _DÁN rồi bấm 📥 Nhập creator mới là script tự map đúng cột, không
// phải kéo tay. Đổi tên cột ở đây thì phải đổi cả SYN bên kia.
type MainColumn = { header: string; get: (c: Creator, plain: boolean) => string };

const MAIN_COLUMNS: MainColumn[] = [
  { header: 'handle', get: c => fmt(c.handle) },
  { header: 'email', get: c => fmt(c.email) },
  { header: 'name', get: c => fmt(c.displayName) },
  { header: 'source', get: c => METRICS_SOURCE_LABEL[c.metricsSource || ''] || '' },
  { header: 'follower', get: (c, p) => formatUsdShortNum(c.followers, p) },
  { header: 'gmv 30d', get: (c, p) => formatUsdShort(c.gmv30d, p) },
  { header: 'gmv/video', get: (c, p) => formatUsdShort(gmvPerVideo(c), p) },
  { header: 'gpm', get: (c, p) => formatUsdShort(c.gpm, p) },
  { header: 'avg views', get: (c, p) => formatUsdShortNum(c.avgViews, p) },
  { header: 'beauty %', get: c => (beautyRatio(c) !== undefined ? roundPct(beautyRatio(c)!, 1) : '') },
  { header: 'female %', get: c => (c.demographics?.genderFemale !== undefined ? roundPct(c.demographics.genderFemale, 1) : '') },
  { header: 'age group', get: c => fmt(c.demographics?.topAgeGroup) },
  { header: 'category', get: c => categoryTop2(c) },
  { header: 'video link', get: c => fmt(c.recentVideos?.find(v => v.videoUrl)?.videoUrl) },
  { header: 'persona', get: c => personaStr(c) },
  { header: 'why this creator', get: c => whyThisCreator(c) },
];

// Persona ghép từ demographics thật, theo đúng lối viết của cột Persona trong file client
// ("Hispanic / Female / 20s–30s"). Chỉ ghép cái gì có thật: TCM không trả sắc tộc nên không
// đoán vế đó, và topCountry của TCM thực chất là BANG Mỹ đông follower nhất, không phải quốc
// gia (xem follower_state_location). Trước đây cột này xuất ra rỗng cho mọi creator.
function personaStr(creator?: Creator): string {
  const demo = creator?.demographics;
  if (!demo) return '';
  return [demo.topGender, demo.topAgeGroup, demo.topCountry].filter(Boolean).join(' / ');
}

const METRICS_SOURCE_LABEL: Record<string, string> = {
  tcm: 'TCM',
  kalodata: 'Kalodata',
  tiktokOne: 'TTO',
  cruva: 'Cruva',
  manual: 'Manual',
};

// Số lượng (follower, view) không phải tiền — dạng rút gọn dùng k/m nhưng KHÔNG có "$".
function formatUsdShortNum(v: number | undefined | null, plain: boolean): string {
  const s = formatUsdShort(v, plain);
  return plain ? s : s.replace('$', '');
}

// GMV/video = gmv30d chia số video đã đăng trong 30 ngày (videoMetrics.videosCount, chỉ có
// khi đã cào TCM). Thiếu videosCount thì để TRỐNG chứ không rơi về gmv30d — gmv30d là GMV của
// cả kênh trong 30 ngày, đặt nguyên nó vào cột "GMV/video" là sai đơn vị.
function gmvPerVideo(c: Creator): number | undefined {
  const n = c.videoMetrics?.videosCount;
  if (c.gmv30d === undefined || !n || n <= 0) return undefined;
  return c.gmv30d / n;
}

function beautyRatio(c: Creator): number | undefined {
  return c.beautyCategoryRatio
    ?? c.salesMetrics?.categorySplit?.find(x => x.name.toLowerCase().includes('beauty'))?.value;
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
export const ExportView: React.FC<ExportViewProps> = ({ creators }) => {
  // Lọc theo ngày import để mỗi lần dán chỉ đúng số creator vừa cào trong ngày — render cả
  // nghìn dòng một lúc làm treo trình duyệt, và thao tác thật cũng diễn ra theo ngày.
  const [selectedDate, setSelectedDate] = useState(todayStr());
  // Lấp dữ liệu cho creator đã có là việc một lần, không diễn ra theo ngày: roster nằm rải trên
  // hàng chục ngày import, và những dòng import từ trước khi cột importedAt tồn tại thì KHÔNG
  // ngày nào chọn ra được. Bật cờ này để bỏ lọc ngày. Mặc định tắt, nên việc thường ngày
  // (cào hôm nay → xuất hôm nay → dán) không đổi gì.
  const [allDates, setAllDates] = useState(false);
  // Đ9: số vào Sheet phải là số thuần.
  const [plainNumbers, setPlainNumbers] = useState(true);

  // Nguồn dòng là creator VỪA IMPORT, không phải creator đã gán campaign — đúng thứ tự thật
  // của quy trình: cào bằng extension → xuất sang sheet → lọc tay trên sheet → mới outreach.
  const mainCreators = useMemo(() => {
    return creators
      .filter(c => allDates || toLocalDateStr(c.importedAt) === selectedDate)
      .sort((a, b) => a.handle.localeCompare(b.handle));
  }, [creators, selectedDate, allDates]);

  // Các ngày import đang có — để operator biết chọn ngày nào thay vì mò từng ngày một.
  const availableImportDates = useMemo(() => {
    const m = new Map<string, number>();
    creators.forEach(c => {
      const d = toLocalDateStr(c.importedAt);
      if (d) m.set(d, (m.get(d) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  }, [creators]);

  // `creators` (App.tsx global list state) cố tình bỏ demographics/salesMetrics/gpm để nhẹ khi
  // load cả roster (xem comment CREATOR_LIST_COLUMNS trong db.ts) — nên các dòng ĐANG hiển thị
  // phải lấy bổ sung qua /api/creators/export, một request cho cả lô.
  const [detailById, setDetailById] = useState<Map<string, Creator>>(new Map());
  // Khoá effect theo chuỗi id (primitive) thay vì theo reference của `mainCreators` — App.tsx
  // tạo mảng creators MỚI mỗi lần re-render nên reference đổi liên tục. Đánh dấu "đã fetch"
  // bằng useRef (không phải state) để tránh fetch lặp lại.
  // KHÔNG dùng cờ "cancelled" ở đây — React StrictMode (dev) chạy effect 2 lần liên tiếp
  // (mount → cleanup → mount lại); ref đã dedupe id nên lần chạy thứ 2 không fetch lại, nhưng
  // nếu có cờ cancelled thì cleanup của lần 2 sẽ huỷ luôn kết quả của lần fetch DUY NHẤT (lần 1),
  // khiến dữ liệu tải về không bao giờ được áp dụng vào state.
  const attemptedIdsRef = useRef<Set<string>>(new Set());
  const creatorIdsKey = useMemo(() => mainCreators.map(c => c.id).join(','), [mainCreators]);
  useEffect(() => {
    const ids = creatorIdsKey ? creatorIdsKey.split(',').filter(Boolean) : [];
    const idsToFetch = ids.filter(id => !attemptedIdsRef.current.has(id));
    if (idsToFetch.length === 0) return;
    idsToFetch.forEach(id => attemptedIdsRef.current.add(id));
    fetch('/api/creators/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: idsToFetch }),
    })
      .then(r => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(res => {
        const rows: Creator[] = res?.data ?? [];
        if (rows.length === 0) return;
        setDetailById(prev => {
          const next = new Map(prev);
          rows.forEach(c => next.set(c.id, c));
          return next;
        });
      });
  }, [creatorIdsKey]);

  const rows = useMemo(() => {
    return mainCreators.map(summary => {
      // /api/creators/export trả đúng bộ cột của danh sách CỘNG thêm 6 cột, nên bản chi tiết
      // là superset — dùng thẳng, không cần ghép từng field (cách ghép cũ bỏ sót `gpm`).
      const creator = detailById.get(summary.id) ?? summary;
      return MAIN_COLUMNS.map(col => col.get(creator, plainNumbers));
    });
  }, [mainCreators, detailById, plainNumbers]);

  // Bảng bên dưới CHỈ là bản xem trước. Copy và Tải CSV vẫn lấy đủ `rows` — cắt ở đây thôi vì
  // render vài nghìn dòng × 16 cột làm treo trình duyệt, mà thao tác thật là copy cả cục chứ
  // không phải ngồi đọc từng dòng.
  const PREVIEW_MAX = 200;
  const previewRows = rows.length > PREVIEW_MAX ? rows.slice(0, PREVIEW_MAX) : rows;
  const headers = useMemo(() => MAIN_COLUMNS.map(c => c.header), []);
  // Chỉ MỘT dòng tiêu đề — tab _DÁN của apps-script đọc tên cột ở dòng 2, dòng 1 bên đó là dải
  // hướng dẫn cố định.
  const headerLines = useMemo(() => [headers], [headers]);
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
        <div className="flex items-center gap-2 flex-wrap">
          <label htmlFor="export-date" className="text-sm text-slate-500 dark:text-slate-400">Ngày import</label>
          <input
            id="export-date"
            type="date"
            list="export-import-dates"
            value={selectedDate}
            disabled={allDates}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-40"
          />
          <datalist id="export-import-dates">
            {availableImportDates.map(([d, n]) => <option key={d} value={d} label={`${n} creator`} />)}
          </datalist>
          <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={allDates}
              onChange={e => setAllDates(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            Tất cả các ngày
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={plainNumbers}
              onChange={e => setPlainNumbers(e.target.checked)}
              className="rounded border-slate-300 dark:border-slate-600"
            />
            <span>
              Số thuần
              <span className="text-slate-400 dark:text-slate-500"> — xuất <code className="font-mono">53000</code> thay vì <code className="font-mono">$53k</code></span>
            </span>
          </label>
        </div>
      </div>

      <div className="px-3 py-2 rounded-lg text-xs border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200">
        16 cột, tên khớp bảng nhận diện của Apps Script. Copy → dán vào tab <b>_DÁN</b> của sheet (từ dòng 3, dòng 2 là tên cột) → bấm <b>📥 Nhập creator mới</b>. Nguồn dòng là creator <b>{allDates ? 'đã import, không lọc ngày' : 'import trong ngày đã chọn'}</b>.{allDates && <> Dùng cho lần lấp dữ liệu creator cũ; xong rồi nên bỏ tick lại.</>}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
            {allDates ? 'Tất cả creator đã import' : `Import ngày ${selectedDate}`}
          </h3>
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
              onClick={() => downloadCsv(
                allDates ? 'MAIN-tat-ca.csv' : `MAIN-${selectedDate}.csv`,
                headerLines,
                rows
              )}
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
                {headers.map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={headers.length || 1} className="px-3 py-6 text-center text-slate-400">
                    {allDates ? 'Chưa có creator nào' : `Không có creator nào import ngày ${selectedDate}`}
                  </td>
                </tr>
              ) : (
                previewRows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                    {row.map((cell, j) => (
                      <td key={j} className="px-3 py-2 whitespace-nowrap text-slate-700 dark:text-slate-300">
                        {cell.split('\n').map((line, k) => <div key={k}>{line}</div>) || <span className="text-slate-300 dark:text-slate-700">—</span>}
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {rows.length > previewRows.length && (
                <tr>
                  <td colSpan={headers.length || 1} className="px-3 py-3 text-center text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    Xem trước {previewRows.length} dòng đầu — Copy và Tải CSV vẫn lấy đủ {rows.length} dòng.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
