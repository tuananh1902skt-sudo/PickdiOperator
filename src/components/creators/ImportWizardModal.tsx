import React, { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  CheckCircle2,
  Zap,
  RefreshCw,
  FileSpreadsheet,
  UploadCloud
} from 'lucide-react';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (importedCreators: any[]) => void;
  activeWorkspaceId?: string;
}

// Field CRM mà 1 cột trong file Kalodata/CSV bất kỳ có thể được gán vào. Cột nào Juan không map
// (để "-- Bỏ qua --") thì bị bỏ qua hẳn, không tự bịa giá trị cho field đó.
const FILE_TARGET_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'handle', label: 'Handle TikTok (bắt buộc)', required: true },
  { key: 'displayName', label: 'Tên hiển thị' },
  { key: 'followers', label: 'Followers' },
  { key: 'avgViews', label: 'Avg. Views' },
  { key: 'engagementRate', label: 'Engagement Rate (%)' },
  { key: 'gmv30d', label: 'GMV / Doanh thu' },
  { key: 'category', label: 'Ngành hàng (Category)' },
  { key: 'country', label: 'Quốc gia' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Số điện thoại' },
  { key: 'profileUrl', label: 'Link hồ sơ TikTok' }
];

// Gợi ý map mặc định lần đầu (chỉ dùng khi chưa có map lưu trong localStorage), match theo tên cột
// gần giống — Juan vẫn có thể sửa lại tay, không phải map cứng vị trí cột.
const HEADER_GUESS: Record<string, string> = {
  handle: 'handle',
  creator_handle: 'handle',
  username: 'handle',
  nickname: 'displayName',
  displayname: 'displayName',
  name: 'displayName',
  followers: 'followers',
  'avg. views': 'avgViews',
  avgviews: 'avgViews',
  views: 'avgViews',
  'engagement rate': 'engagementRate',
  engagementrate: 'engagementRate',
  'revenue(₫)': 'gmv30d',
  revenue: 'gmv30d',
  gmv: 'gmv30d',
  'gmv 30d': 'gmv30d',
  category: 'category',
  industry: 'category',
  country: 'country',
  region: 'country',
  email: 'email',
  phone: 'phone',
  whatsapp: 'phone',
  tiktokurl: 'profileUrl',
  'tiktok url': 'profileUrl',
  profileurl: 'profileUrl'
};

const COLUMN_MAP_STORAGE_KEY = 'pickdi_import_column_map_v1';

function loadSavedColumnMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(COLUMN_MAP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function guessColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const h of headers) {
    const guess = HEADER_GUESS[h.trim().toLowerCase()];
    if (guess && !Object.values(map).includes(h)) {
      map[guess] = h;
    }
  }
  return map;
}

// Chuyển 1 ô số dạng chuỗi Excel/CSV (có thể có dấu %, dấu phẩy ngăn cách hàng nghìn) thành number.
// Trả về undefined nếu không parse được — không bịa số 0.
function parseLooseNumber(raw: any): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : undefined;
  const cleaned = String(raw).replace(/[%,₫$\s]/g, '');
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : undefined;
}

const NUMERIC_TARGET_FIELDS = new Set(['followers', 'avgViews', 'engagementRate', 'gmv30d']);

function buildRowObject(headers: string[], row: any[], columnMap: Record<string, string>) {
  const obj: Record<string, any> = {};
  for (const field of FILE_TARGET_FIELDS) {
    const sourceHeader = columnMap[field.key];
    if (!sourceHeader) continue;
    const colIdx = headers.indexOf(sourceHeader);
    if (colIdx === -1) continue;
    const rawValue = row[colIdx];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;
    obj[field.key] = NUMERIC_TARGET_FIELDS.has(field.key) ? parseLooseNumber(rawValue) : String(rawValue).trim();
  }
  return obj;
}

// Preset cột cố định cho export "Creator List" thật của Kalodata (sheet LIST_CREATOR, vd file
// Kalodata_Creator_<timestamp>_<region>.xlsx) — map cứng theo đúng tên cột Kalodata xuất ra,
// không đoán tên khác và không cho user tự chọn cột (khác với tab Generic CSV bên dưới).
// Kalodata "Creator List" KHÔNG export GPM/beauty ratio/demographics (tuổi, giới tính) — các
// field đó trên Creator vẫn tồn tại để điền tay hoặc từ nguồn khác, import Kalodata không đụng tới.
const KALODATA_HEADER_MAP: Record<string, string> = {
  handle: 'handle',
  nickname: 'displayName',
  followers: 'followers',
  'revenue($)': 'gmv30d',
  'engagement rate': 'engagementRate',
  views: 'viewsTotal',
  videonum: 'videoNum',
  tiktokurl: 'profileUrl',
  email: 'email'
};

const KALODATA_PREVIEW_FIELDS: { key: string; label: string }[] = [
  { key: 'handle', label: 'Handle' },
  { key: 'displayName', label: 'Tên hiển thị' },
  { key: 'followers', label: 'Followers' },
  { key: 'gmv30d', label: 'Revenue (30d)' },
  { key: 'engagementRate', label: 'Engagement Rate' },
  { key: 'avgViews', label: 'Avg. Views/video' },
  { key: 'profileUrl', label: 'Link TikTok' },
  { key: 'email', label: 'Email' }
];

// Cột nào trong file khớp preset Kalodata, dùng để hiện cảnh báo thiếu cột trước khi import.
function matchedKalodataHeaders(headers: string[]): Record<string, string> {
  const matched: Record<string, string> = {};
  for (const h of headers) {
    const targetKey = KALODATA_HEADER_MAP[h.trim().toLowerCase()];
    if (targetKey && !matched[targetKey]) matched[targetKey] = h;
  }
  return matched;
}

// Preset cột cố định cho file CSV export từ extension "TikTok One Scraper (CSV export build)"
// (xem CSV_COLUMNS trong background.js của extension đó) — map cứng theo đúng tên cột extension
// xuất ra, giống cách xử lý Kalodata ở trên. Extension export thêm "Collab Score" và "TikTok One
// ID" nhưng Creator (src/types.ts) chưa có field tương ứng cho 2 cột đó — cố tình bỏ qua, không
// thêm field mới vào schema chỉ vì 1 nguồn import.
const TTO_HEADER_MAP: Record<string, string> = {
  handle: 'handle',
  'display name': 'displayName',
  bio: 'bio',
  email: 'email',
  instagram: 'instagram',
  followers: 'followers',
  'avg views': 'avgViews',
  'engagement rate %': 'engagementRate',
  category: 'category',
  'rate card $/100k': 'rateCard',
  'top gender': 'topGender',
  'top age range': 'topAgeGroup',
  'top country': 'topCountry',
  'avatar url': 'avatar'
};

const TTO_PREVIEW_FIELDS: { key: string; label: string }[] = [
  { key: 'handle', label: 'Handle' },
  { key: 'displayName', label: 'Tên hiển thị' },
  { key: 'followers', label: 'Followers' },
  { key: 'avgViews', label: 'Avg Views' },
  { key: 'engagementRate', label: 'Engagement Rate' },
  { key: 'category', label: 'Category' },
  { key: 'topGender', label: 'Top Gender' },
  { key: 'topCountry', label: 'Top Country' },
  { key: 'email', label: 'Email' }
];

function matchedTtoHeaders(headers: string[]): Record<string, string> {
  const matched: Record<string, string> = {};
  for (const h of headers) {
    const targetKey = TTO_HEADER_MAP[h.trim().toLowerCase()];
    if (targetKey && !matched[targetKey]) matched[targetKey] = h;
  }
  return matched;
}

const TTO_NUMERIC_FIELDS = new Set(['followers', 'avgViews', 'engagementRate']);

function buildTtoRowObject(headers: string[], row: any[]) {
  const raw: Record<string, any> = {};
  headers.forEach((h, idx) => {
    const targetKey = TTO_HEADER_MAP[h.trim().toLowerCase()];
    if (!targetKey) return;
    const rawValue = row[idx];
    if (rawValue === undefined || rawValue === null || rawValue === '') return;
    raw[targetKey] = TTO_NUMERIC_FIELDS.has(targetKey) ? parseLooseNumber(rawValue) : String(rawValue).trim();
  });

  // Top Gender/Age/Country gộp thành CreatorDemographics lồng nhau (xem src/types.ts) — chỉ tạo
  // object khi có ít nhất 1 trong 3, không bịa object rỗng.
  const demographics =
    raw.topGender || raw.topAgeGroup || raw.topCountry
      ? { topGender: raw.topGender, topAgeGroup: raw.topAgeGroup, topCountry: raw.topCountry }
      : undefined;

  return {
    handle: raw.handle,
    displayName: raw.displayName,
    bio: raw.bio,
    email: raw.email,
    instagram: raw.instagram,
    followers: raw.followers,
    avgViews: raw.avgViews,
    engagementRate: raw.engagementRate,
    category: raw.category,
    rateCard: raw.rateCard,
    avatar: raw.avatar,
    demographics,
    metricsSource: 'tiktokOne'
  };
}

function buildKalodataRowObject(headers: string[], row: any[]) {
  const raw: Record<string, any> = {};
  headers.forEach((h, idx) => {
    const targetKey = KALODATA_HEADER_MAP[h.trim().toLowerCase()];
    if (!targetKey) return;
    const rawValue = row[idx];
    if (rawValue === undefined || rawValue === null || rawValue === '') return;
    if (targetKey === 'handle' || targetKey === 'email' || targetKey === 'displayName' || targetKey === 'profileUrl') {
      raw[targetKey] = String(rawValue).trim();
    } else {
      raw[targetKey] = parseLooseNumber(rawValue);
    }
  });

  // Kalodata "Views" là tổng view trong Date Range, không phải avg/video — chia cho VideoNum
  // để ra avg views/video thật, không bịa nếu thiếu 1 trong 2 số hoặc VideoNum = 0.
  const avgViews =
    typeof raw.viewsTotal === 'number' && typeof raw.videoNum === 'number' && raw.videoNum > 0
      ? Math.round(raw.viewsTotal / raw.videoNum)
      : undefined;

  return {
    handle: raw.handle,
    displayName: raw.displayName,
    email: raw.email,
    followers: raw.followers,
    gmv30d: raw.gmv30d,
    engagementRate: raw.engagementRate,
    avgViews,
    profileUrl: raw.profileUrl,
    // Không bịa true — chỉ true khi thật sự có Revenue > 0 từ Kalodata.
    hasAffiliateGmv: typeof raw.gmv30d === 'number' && raw.gmv30d > 0,
    metricsSource: 'kalodata'
  };
}

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  activeWorkspaceId
}) => {
  // --- File import (CSV/Excel Kalodata) state ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 'cruva' chưa có preset cột riêng (Cruva chưa xác nhận tên cột export chuẩn) — dùng chung UI
  // map cột tay như Generic CSV, chỉ khác nhãn metricsSource gắn vào khi import (xem handleFileImport).
  const [importMode, setImportMode] = useState<'kalodata' | 'tto' | 'cruva' | 'generic'>('kalodata');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [fileRows, setFileRows] = useState<any[][]>([]);
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileImporting, setFileImporting] = useState(false);
  const [fileStatusMsg, setFileStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    setFileError(null);
    setFileStatusMsg(null);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) throw new Error('File không có sheet nào');
      const ws = wb.Sheets[sheetName];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
      if (rows.length === 0) throw new Error('File trống');

      const headers = (rows[0] || []).map(h => String(h ?? '').trim()).filter(Boolean);
      const dataRows = rows.slice(1).filter(r => r.some(cell => cell !== '' && cell !== null && cell !== undefined));

      if (headers.length === 0 || dataRows.length === 0) {
        setFileError('Không đọc được dòng tiêu đề hoặc file không có dữ liệu.');
        setFileHeaders([]);
        setFileRows([]);
        return;
      }

      // Ưu tiên map đã lưu từ lần trước (nếu cột đó vẫn còn tồn tại trong file mới), field nào
      // chưa có trong map lưu thì thử gợi ý theo tên cột gần giống, còn lại để trống cho Juan tự chọn.
      const saved = loadSavedColumnMap();
      const guessed = guessColumnMap(headers);
      const merged: Record<string, string> = { ...guessed };
      for (const field of FILE_TARGET_FIELDS) {
        const savedHeader = saved[field.key];
        if (savedHeader && headers.includes(savedHeader)) {
          merged[field.key] = savedHeader;
        }
      }

      setFileName(file.name);
      setFileHeaders(headers);
      setFileRows(dataRows);
      setColumnMap(merged);
    } catch (err: any) {
      console.error('Parse import file error:', err);
      setFileError('Không đọc được file này. Kiểm tra lại định dạng CSV/Excel (.csv, .xlsx, .xls).');
      setFileHeaders([]);
      setFileRows([]);
    }
  };

  const handleColumnMapChange = (fieldKey: string, headerValue: string) => {
    setColumnMap(prev => {
      const next = { ...prev };
      if (headerValue) {
        next[fieldKey] = headerValue;
      } else {
        delete next[fieldKey];
      }
      return next;
    });
  };

  const kalodataFoundHeaders = matchedKalodataHeaders(fileHeaders);
  const ttoFoundHeaders = matchedTtoHeaders(fileHeaders);

  const mappedFileItems = (
    importMode === 'kalodata'
      ? fileRows.map(row => buildKalodataRowObject(fileHeaders, row))
      : importMode === 'tto'
      ? fileRows.map(row => buildTtoRowObject(fileHeaders, row))
      : fileRows.map(row => {
          const obj: Record<string, any> = buildRowObject(fileHeaders, row, columnMap);
          if (importMode === 'cruva') obj.metricsSource = 'cruva';
          return obj;
        })
  )
    .map(item => (item.handle ? { ...item, handle: String(item.handle).replace(/^@/, '').trim() } : item))
    .filter(item => item.handle);

  const filePreviewRows = mappedFileItems.slice(0, 5);
  const fileSkippedCount = fileRows.length - mappedFileItems.length;

  const handleFileImport = async () => {
    if (mappedFileItems.length === 0) return;
    setFileImporting(true);
    setFileStatusMsg(null);
    try {
      const res = await fetch('/api/creators/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          source: `File Import${fileName ? ` (${fileName})` : ''}`,
          metricsSource: importMode === 'kalodata' ? 'kalodata' : importMode === 'tto' ? 'tiktokOne' : importMode === 'cruva' ? 'cruva' : undefined,
          creators: mappedFileItems
        })
      });
      const data = await res.json();
      if (data.success) {
        // Lưu map cột chỉ sau khi import thành công — tránh lưu 1 map dở dang chưa test.
        localStorage.setItem(COLUMN_MAP_STORAGE_KEY, JSON.stringify(columnMap));
        onConfirmImport(mappedFileItems);
        setFileStatusMsg(`✅ Đã nhập ${data.importedCount} creator mới (${data.updatedCount} cập nhật) vào workspace ${activeWorkspaceId}. Đã bỏ qua ${fileSkippedCount} dòng thiếu handle.`);
        setFileName(null);
        setFileHeaders([]);
        setFileRows([]);
      } else {
        setFileStatusMsg(`❌ Import thất bại: ${data.message || 'Lỗi không xác định'}`);
      }
    } catch (err: any) {
      console.error('Batch import from file error:', err);
      setFileStatusMsg('❌ Lỗi kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setFileImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Import Creator (File CSV/Excel)
              </h3>
              <p className="text-xs text-slate-500">
                Nhập creator hàng loạt từ file Kalodata/TikTok One/Cruva/CSV vào workspace {activeWorkspaceId}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Import mode tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 w-fit">
            <button
              type="button"
              onClick={() => setImportMode('kalodata')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                importMode === 'kalodata'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Kalodata
            </button>
            <button
              type="button"
              onClick={() => setImportMode('tto')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                importMode === 'tto'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              TikTok One
            </button>
            <button
              type="button"
              onClick={() => setImportMode('cruva')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                importMode === 'cruva'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Cruva
            </button>
            <button
              type="button"
              onClick={() => setImportMode('generic')}
              className={`px-3.5 py-1.5 rounded-lg font-bold text-[11px] transition-colors ${
                importMode === 'generic'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Generic CSV
            </button>
          </div>

          <div className="p-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-slate-900 dark:text-white text-xs">
                {importMode === 'kalodata'
                  ? 'Import file export từ Kalodata'
                  : importMode === 'tto'
                  ? 'Import file CSV từ TikTok One Scraper'
                  : importMode === 'cruva'
                  ? 'Import file export từ Cruva'
                  : 'Import file CSV/Excel bất kỳ'}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
              {importMode === 'kalodata' ? (
                <>
                  Chọn file "Creator List" export nguyên bản từ Kalodata (vd Kalodata_Creator_...xlsx, sheet
                  LIST_CREATOR) — app tự nhận diện cột theo tên cột chuẩn của Kalodata (Handle, Nickname,
                  Followers, Revenue($), Engagement Rate, Views, VideoNum, TikTokUrl). Kalodata không export
                  GPM/beauty ratio/demographics nên các field đó phải điền tay sau. Cột nào file không có sẽ
                  bị bỏ qua, không tự bịa số.
                </>
              ) : importMode === 'tto' ? (
                <>
                  Chọn file CSV export từ extension "TikTok One Scraper (CSV export build)" (nút Export
                  CSV trong popup extension) — app tự nhận diện đúng cột extension đó xuất ra (Handle,
                  Display Name, Bio, Email, Instagram, Followers, Avg Views, Engagement Rate %, Category,
                  Rate Card, Top Gender/Age Range/Country, Avatar URL). Cột "Collab Score" và "TikTok One
                  ID" trong file KHÔNG được nhập (CRM chưa có field tương ứng) — bị bỏ qua an toàn.
                </>
              ) : importMode === 'cruva' ? (
                <>
                  Chọn file export từ Cruva — Cruva chưa có preset cột cố định như Kalodata nên bạn tự map
                  mỗi cột trong file khớp với field nào của CRM (giống tab Generic CSV). Creator nhập ở đây sẽ
                  được gắn nhãn nguồn "Cruva" để phân biệt với Kalodata/TCM.
                </>
              ) : (
                <>
                  Chọn file CSV/Excel bất kỳ (sheet không đúng chuẩn Kalodata) — app sẽ đọc dòng tiêu đề, bạn tự
                  chọn mỗi cột trong file khớp với field nào của CRM. Cột không map bị bỏ qua, không tự bịa số.
                </>
              )}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelected}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all text-xs"
            >
              <UploadCloud className="w-4 h-4" />
              Chọn file CSV/Excel
            </button>
            {fileName && (
              <span className="ml-2 text-[11px] text-slate-500">
                Đã chọn: <strong className="text-slate-700 dark:text-slate-300">{fileName}</strong> ({fileRows.length} dòng dữ liệu)
              </span>
            )}

            {fileError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300">
                {fileError}
              </div>
            )}
          </div>

          {fileHeaders.length > 0 && importMode === 'kalodata' && (
            <>
              {/* Detected columns (read-only, không cho map tay như Generic CSV) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="font-bold text-slate-900 dark:text-white text-xs">Cột đã nhận diện trong file</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {KALODATA_PREVIEW_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 text-[11px] font-medium text-slate-500">{field.label}</span>
                      {kalodataFoundHeaders[field.key] ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                          {kalodataFoundHeaders[field.key]}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">không có trong file</span>
                      )}
                    </div>
                  ))}
                </div>
                {!kalodataFoundHeaders.handle && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-300">
                    File này không có cột "handle" — không thể nhận diện creator. Kiểm tra lại đúng file export
                    Kalodata, hoặc dùng tab "Generic CSV" để tự map cột.
                  </div>
                )}
              </div>

              {/* Preview */}
              {kalodataFoundHeaders.handle && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white text-xs">
                    Xem trước ({filePreviewRows.length}/{mappedFileItems.length} dòng hợp lệ hiển thị, tổng {fileRows.length} dòng trong file)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10.5px] border-collapse">
                      <thead>
                        <tr className="text-left text-slate-500">
                          {KALODATA_PREVIEW_FIELDS.filter(f => kalodataFoundHeaders[f.key]).map(f => (
                            <th key={f.key} className="py-1 pr-3 font-semibold border-b border-slate-200 dark:border-slate-800">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreviewRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                            {KALODATA_PREVIEW_FIELDS.filter(f => kalodataFoundHeaders[f.key]).map(f => (
                              <td key={f.key} className="py-1 pr-3 text-slate-700 dark:text-slate-300">{String(row[f.key] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {fileSkippedCount > 0 && (
                    <div className="text-[11px] text-slate-500">
                      Sẽ bỏ qua {fileSkippedCount} dòng không đọc được handle.
                    </div>
                  )}
                  <button
                    onClick={handleFileImport}
                    disabled={fileImporting || mappedFileItems.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-50"
                  >
                    {fileImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {fileImporting ? 'Đang nhập...' : `Xác nhận nhập ${mappedFileItems.length} creator`}
                  </button>
                </div>
              )}
            </>
          )}

          {fileHeaders.length > 0 && importMode === 'tto' && (
            <>
              {/* Detected columns (read-only, không cho map tay — cùng kiểu preset cố định như Kalodata) */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="font-bold text-slate-900 dark:text-white text-xs">Cột đã nhận diện trong file</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {TTO_PREVIEW_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-2">
                      <span className="w-32 shrink-0 text-[11px] font-medium text-slate-500">{field.label}</span>
                      {ttoFoundHeaders[field.key] ? (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                          {ttoFoundHeaders[field.key]}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">không có trong file</span>
                      )}
                    </div>
                  ))}
                </div>
                {!ttoFoundHeaders.handle && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-300">
                    File này không có cột "Handle" — không thể nhận diện creator. Kiểm tra lại đúng file
                    Export CSV từ extension TikTok One Scraper, hoặc dùng tab "Generic CSV" để tự map cột.
                  </div>
                )}
              </div>

              {/* Preview */}
              {ttoFoundHeaders.handle && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white text-xs">
                    Xem trước ({filePreviewRows.length}/{mappedFileItems.length} dòng hợp lệ hiển thị, tổng {fileRows.length} dòng trong file)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10.5px] border-collapse">
                      <thead>
                        <tr className="text-left text-slate-500">
                          {TTO_PREVIEW_FIELDS.filter(f => ttoFoundHeaders[f.key]).map(f => (
                            <th key={f.key} className="py-1 pr-3 font-semibold border-b border-slate-200 dark:border-slate-800">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreviewRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                            {TTO_PREVIEW_FIELDS.filter(f => ttoFoundHeaders[f.key]).map(f => (
                              <td key={f.key} className="py-1 pr-3 text-slate-700 dark:text-slate-300">{String(row[f.key] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {fileSkippedCount > 0 && (
                    <div className="text-[11px] text-slate-500">
                      Sẽ bỏ qua {fileSkippedCount} dòng không đọc được handle.
                    </div>
                  )}
                  <button
                    onClick={handleFileImport}
                    disabled={fileImporting || mappedFileItems.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-50"
                  >
                    {fileImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {fileImporting ? 'Đang nhập...' : `Xác nhận nhập ${mappedFileItems.length} creator`}
                  </button>
                </div>
              )}
            </>
          )}

          {fileHeaders.length > 0 && (importMode === 'generic' || importMode === 'cruva') && (
            <>
              {/* Column mapping */}
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="font-bold text-slate-900 dark:text-white text-xs">Map cột file → field CRM</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {FILE_TARGET_FIELDS.map(field => (
                    <div key={field.key} className="flex items-center gap-2">
                      <label className={`w-40 shrink-0 text-[11px] font-medium ${field.required ? 'text-slate-800 dark:text-slate-200' : 'text-slate-500'}`}>
                        {field.label}
                      </label>
                      <select
                        value={columnMap[field.key] || ''}
                        onChange={e => handleColumnMapChange(field.key, e.target.value)}
                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-[11px]"
                      >
                        <option value="">-- Bỏ qua --</option>
                        {fileHeaders.map(h => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {!columnMap.handle && (
                  <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-700 dark:text-amber-300">
                    Cần map cột cho "Handle TikTok" trước khi nhập — đây là field bắt buộc để nhận diện creator.
                  </div>
                )}
              </div>

              {/* Preview */}
              {columnMap.handle && (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="font-bold text-slate-900 dark:text-white text-xs">
                    Xem trước ({filePreviewRows.length}/{mappedFileItems.length} dòng hợp lệ hiển thị, tổng {fileRows.length} dòng trong file)
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[10.5px] border-collapse">
                      <thead>
                        <tr className="text-left text-slate-500">
                          {FILE_TARGET_FIELDS.filter(f => columnMap[f.key]).map(f => (
                            <th key={f.key} className="py-1 pr-3 font-semibold border-b border-slate-200 dark:border-slate-800">{f.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreviewRows.map((row, i) => (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800/60">
                            {FILE_TARGET_FIELDS.filter(f => columnMap[f.key]).map(f => (
                              <td key={f.key} className="py-1 pr-3 text-slate-700 dark:text-slate-300">{String(row[f.key] ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {fileSkippedCount > 0 && (
                    <div className="text-[11px] text-slate-500">
                      Sẽ bỏ qua {fileSkippedCount} dòng không đọc được handle.
                    </div>
                  )}
                  <button
                    onClick={handleFileImport}
                    disabled={fileImporting || mappedFileItems.length === 0}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-50"
                  >
                    {fileImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    {fileImporting ? 'Đang nhập...' : `Xác nhận nhập ${mappedFileItems.length} creator`}
                  </button>
                </div>
              )}
            </>
          )}

          {fileStatusMsg && (
            <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium font-mono text-slate-800 dark:text-slate-200">
              {fileStatusMsg}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 text-xs">
          <span className="text-slate-500 font-medium">
            Workspace đích: <strong className="text-slate-800 dark:text-slate-200">{activeWorkspaceId}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
