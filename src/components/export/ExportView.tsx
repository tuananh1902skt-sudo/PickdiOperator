import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, Check, FileSpreadsheet } from 'lucide-react';
import { Creator, Campaign, CreatorCampaignAssignment, OutreachEmail, PostedVideo, Conversation } from '../../types';

interface ExportViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  assignments: CreatorCampaignAssignment[];
  outreachList: OutreachEmail[];
  postedVideos: PostedVideo[];
  conversations: Conversation[];
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
  conversation?: Conversation; // để biết creator đang "Negotiating" — OutreachEmail.status không có giá trị này
  plainNumbers: boolean; // xuất số thuần thay vì dạng rút gọn $53k (xem formatUsdShort)
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
  { section: '1. Sourcing', header: 'GMV/Video, Last 30d ($)', get: ({ creator, plainNumbers }) => formatUsdShort(creator?.gmv30d, plainNumbers) },
  { section: '1. Sourcing', header: 'Why This Creator', get: ({ creator }) => whyThisCreator(creator) },
  { header: 'O/X & Reason', get: () => '' },
  { section: '2. Outreach', header: '1st Email Sent', get: ({ emails }) => {
    const first = [...emails].filter(e => e.sentAt).sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime())[0];
    return toLocalDateStr(first?.sentAt);
  } },
  { section: '2. Outreach', header: 'Offer', get: () => '' },
  { section: '2. Outreach', header: 'Reply Status', get: ({ emails, conversation }) => {
    // Conversation.status ưu tiên hơn vì nó có 'Negotiating' (imapSync tự set khi phát hiện
    // reply mang tính đàm phán giá/rate card) — OutreachEmail.status tối đa chỉ lên tới 'Replied'.
    if (conversation?.status === 'Negotiating') return 'Negotiating';
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

export const ExportView: React.FC<ExportViewProps> = ({ creators, campaigns, assignments, outreachList, postedVideos, conversations }) => {
  const activeCampaigns = useMemo(() => campaigns.filter(c => c.status !== 'Archived'), [campaigns]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(() => activeCampaigns[0]?.id || campaigns[0]?.id || '');
  const campaignId = selectedCampaignId || activeCampaigns[0]?.id || campaigns[0]?.id || '';
  // Lọc theo "Listed Date" (= ngày assign vào campaign) để mỗi lần nộp chỉ xuất đúng số creator
  // mới thêm trong ngày đó — render cả nghìn dòng 1 lúc (toàn bộ roster của campaign) làm treo
  // trình duyệt, và thực tế thao tác nộp file cũng diễn ra theo ngày chứ không phải 1 lần duy nhất.
  const [selectedDate, setSelectedDate] = useState(todayStr());
  // Lấp dữ liệu cho creator đã có là việc một lần, không diễn ra theo ngày: roster nằm rải trên
  // hàng chục ngày import, và những dòng import từ trước khi cột importedAt tồn tại thì KHÔNG
  // ngày nào chọn ra được. Bật cờ này để bỏ lọc ngày. Mặc định tắt, nên việc thường ngày
  // (cào hôm nay → xuất hôm nay → dán) không đổi gì.
  const [allDates, setAllDates] = useState(false);

  // Hai bộ cột cho hai đích khác nhau:
  //   'client' — 49 cột đúng format 04_Grinding Cream, dán vào file chung của team
  //   'main'   — 16 cột tên khớp bảng nhận diện của apps-script, dán vào tab _DÁN của sheet
  //              riêng rồi bấm 📥 Nhập creator mới
  const [mode, setMode] = useState<'client' | 'main'>('client');
  // Đ9: số vào Sheet phải là số thuần. Mặc định bật cho cả hai bộ cột.
  const [plainNumbers, setPlainNumbers] = useState(true);

  const creatorById = useMemo(() => new Map(creators.map(c => [c.id, c])), [creators]);

  // Bộ cột MAIN chạy trên creator VỪA IMPORT, không phải creator đã assign vào campaign —
  // ImportWizardModal không gán campaign, nên nếu lấy theo assignment thì creator mới cào
  // xong sẽ không bao giờ xuất được. Đây đúng là thứ tự thật của quy trình: cào → import →
  // xuất sang sheet → lọc tay trên sheet → mới tick chọn để outreach.
  const mainCreators = useMemo(() => {
    if (mode !== 'main') return [];
    return creators
      .filter(c => allDates || toLocalDateStr(c.importedAt) === selectedDate)
      .sort((a, b) => a.handle.localeCompare(b.handle));
  }, [mode, creators, selectedDate, allDates]);

  // Các ngày import đang có — để operator biết chọn ngày nào thay vì mò từng ngày một.
  const availableImportDates = useMemo(() => {
    const m = new Map<string, number>();
    creators.forEach(c => {
      const d = toLocalDateStr(c.importedAt);
      if (d) m.set(d, (m.get(d) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 30);
  }, [creators]);
  const conversationByCreatorId = useMemo(() => new Map(conversations.map(c => [c.creatorId, c])), [conversations]);

  const filteredAssignments = useMemo(() => {
    return assignments
      .filter(a => a.campaignId === campaignId && toLocalDateStr(a.assignedAt) === selectedDate)
      .sort((a, b) => new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime());
  }, [assignments, campaignId, selectedDate]);

  // `creators` (App.tsx global list state) cố tình bỏ demographics/salesMetrics/gpm để nhẹ khi
  // load cả roster (xem comment CREATOR_LIST_COLUMNS trong db.ts) — nên các dòng ĐANG hiển thị
  // phải lấy bổ sung qua /api/creators/export, một request cho cả lô. Trước đây chỗ này gọi
  // /api/creators/:id cho từng dòng: N+1 request, và vẫn không lấy `gpm` nên cột GPM của bộ 16
  // cột MAIN xuất ra rỗng dù DB có dữ liệu.
  const [detailById, setDetailById] = useState<Map<string, Creator>>(new Map());
  // Khoá effect theo chuỗi id (primitive) thay vì theo reference của `filteredAssignments` —
  // App.tsx tạo mảng assignments/creators MỚI mỗi lần re-render (không useMemo ở đó) nên reference
  // đổi liên tục. Đánh dấu "đã fetch" bằng useRef (không phải state) để tránh fetch lặp lại.
  // KHÔNG dùng cờ "cancelled" ở đây — React StrictMode (dev) chạy effect 2 lần liên tiếp
  // (mount → cleanup → mount lại); ref đã dedupe id nên lần chạy thứ 2 không fetch lại, nhưng
  // nếu có cờ cancelled thì cleanup của lần 2 sẽ huỷ luôn kết quả của lần fetch DUY NHẤT (lần 1),
  // khiến dữ liệu tải về không bao giờ được áp dụng vào state.
  const attemptedIdsRef = useRef<Set<string>>(new Set());
  const creatorIdsKey = useMemo(
    () => (mode === 'main' ? mainCreators.map(c => c.id) : filteredAssignments.map(a => a.creatorId)).join(','),
    [mode, mainCreators, filteredAssignments]
  );
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

  const mainRows = useMemo(() => {
    if (mode !== 'main') return [];
    return mainCreators.map(summary => {
      // /api/creators/export trả đúng bộ cột của danh sách CỘNG thêm 6 cột, nên bản chi tiết
      // là superset — dùng thẳng, không cần ghép từng field (cách ghép cũ bỏ sót `gpm`).
      const creator = detailById.get(summary.id) ?? summary;
      return MAIN_COLUMNS.map(col => col.get(creator, plainNumbers));
    });
  }, [mode, mainCreators, detailById, plainNumbers]);

  const clientRows = useMemo(() => {
    return filteredAssignments.map(assignment => {
      const summary = creatorById.get(assignment.creatorId);
      const creator = detailById.get(assignment.creatorId) ?? summary;
      const emails = outreachList.filter(o => o.creatorId === assignment.creatorId && o.campaignId === campaignId);
      const posted = postedVideos.filter(v => v.creatorId === assignment.creatorId && v.campaignId === campaignId);
      const totalGmv = posted.length > 0
        ? posted.reduce((sum, v) => sum + (v.totalRevenue || 0), 0)
        : undefined;
      const conversation = conversationByCreatorId.get(assignment.creatorId);
      const ctx: RowContext = { creator, assignment, emails, totalGmv, conversation, plainNumbers };
      return COLUMNS.map(col => col.get(ctx));
    });
  }, [filteredAssignments, outreachList, postedVideos, creatorById, detailById, campaignId, conversationByCreatorId, plainNumbers]);

  const rows = mode === 'main' ? mainRows : clientRows;
  // Bảng bên dưới CHỈ là bản xem trước. Copy và Tải CSV vẫn lấy đủ `rows` — cắt ở đây thôi vì
  // render vài nghìn dòng × 16 cột làm treo trình duyệt, mà thao tác thật là copy cả cục chứ
  // không phải ngồi đọc từng dòng.
  const PREVIEW_MAX = 200;
  const previewRows = rows.length > PREVIEW_MAX ? rows.slice(0, PREVIEW_MAX) : rows;
  const headers = useMemo(
    () => (mode === 'main' ? MAIN_COLUMNS.map(c => c.header) : COLUMNS.map(c => c.header)),
    [mode]
  );
  // Bộ cột MAIN chỉ có MỘT dòng tiêu đề — tab _DÁN của apps-script đọc tên cột ở dòng 2, và
  // dòng 1 bên đó là dải hướng dẫn cố định, nên không được xuất thêm dòng nhóm như bộ client.
  const headerLines = useMemo(
    () => (mode === 'main' ? [headers] : [groupHeaderLine(), headers]),
    [mode, headers]
  );
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
        <div className="flex items-center gap-2 flex-wrap">
          {mode === 'client' && (
            <>
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
            </>
          )}
          <label htmlFor="export-date" className="text-sm text-slate-500 dark:text-slate-400">
            {mode === 'main' ? 'Ngày import' : 'Ngày assign'}
          </label>
          <input
            id="export-date"
            type="date"
            list={mode === 'main' ? 'export-import-dates' : undefined}
            value={selectedDate}
            disabled={mode === 'main' && allDates}
            onChange={e => setSelectedDate(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 disabled:opacity-40"
          />
          <datalist id="export-import-dates">
            {availableImportDates.map(([d, n]) => <option key={d} value={d} label={`${n} creator`} />)}
          </datalist>
          {mode === 'main' && (
            <label className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={allDates}
                onChange={e => setAllDates(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-600"
              />
              Tất cả các ngày
            </label>
          )}
        </div>
      </div>

      {/* Chọn bộ cột — hai đích khác nhau, đừng dán nhầm chỗ */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <button
            onClick={() => setMode('client')}
            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
              mode === 'client'
                ? 'bg-indigo-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Format client · 04_Grinding Cream
          </button>
          <button
            onClick={() => setMode('main')}
            className={`px-3 py-1.5 text-xs font-semibold border-l border-slate-200 dark:border-slate-700 transition-colors ${
              mode === 'main'
                ? 'bg-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Tab MAIN · sheet vận hành
          </button>
        </div>

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

      <div className={`px-3 py-2 rounded-lg text-xs border ${
        mode === 'main'
          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
          : 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 text-indigo-900 dark:text-indigo-200'
      }`}>
        {mode === 'main' ? (
          <>16 cột, tên khớp bảng nhận diện của Apps Script. Copy → dán vào tab <b>_DÁN</b> của sheet riêng (từ dòng 3, dòng 2 là tên cột) → bấm <b>📥 Nhập creator mới</b>. Nguồn dòng là creator <b>{allDates ? 'đã import, không lọc ngày' : 'import trong ngày đã chọn'}</b>, không phải creator đã gán campaign.{allDates && <> Dùng cho lần lấp dữ liệu creator cũ; xong rồi nên bỏ tick lại.</>}</>
        ) : (
          <>49 cột đúng format client. Copy → sang file chung của team dán bằng <b>Ctrl+Shift+V</b> (chỉ giá trị). Nguồn dòng là creator <b>được gán vào campaign</b> trong ngày đã chọn.</>
        )}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
            {mode === 'main'
              ? (allDates ? 'Tất cả creator đã import' : `Import ngày ${selectedDate}`)
              : (selectedCampaignName || 'Chọn campaign')}
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
                mode === 'main'
                  ? (allDates ? 'MAIN-tat-ca.csv' : `MAIN-${selectedDate}.csv`)
                  : `${selectedCampaignName || 'export'}-${selectedDate}.csv`,
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
              {mode === 'client' && (
                <tr className="bg-slate-50 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500">
                  {groupHeaderLine().map((g, i) => (
                    <th key={i} className="px-3 py-1 text-left font-medium whitespace-nowrap border-b border-slate-100 dark:border-slate-800">{g}</th>
                  ))}
                </tr>
              )}
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
                    {mode === 'main'
                      ? (allDates ? 'Chưa có creator nào' : `Không có creator nào import ngày ${selectedDate}`)
                      : 'Chưa có creator nào cho campaign này'}
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
