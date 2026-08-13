import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  Mail,
  Archive,
  Bookmark,
  HelpCircle,
  ArrowDown,
  AlertTriangle,
  Pencil
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Creator,
  Campaign,
  Workspace,
  CreatorCampaignAssignment,
  CreatorGmvTier,
  CreatorQualification,
  CastingStage,
  WorkspaceScoringCriteria,
} from '../../types';
import { cooperationModeForTier, cooperationModeLabel } from '../../lib/gmvTier';

// Mốc mặc định để tô màu badge checklist d'Alba khi workspace chưa tự cấu hình Settings >
// Sourcing Scoring Criteria — giữ 1 bản hằng số nhẹ riêng ở đây cho UI, độc lập với mọi
// logic scoring khác trong hệ thống.
const DEFAULT_DALBA_CRITERIA: Required<Pick<WorkspaceScoringCriteria, 'genderFemaleFloor' | 'genderFemaleIdeal' | 'beautyCategoryRatioFloor' | 'beautyCategoryRatioIdeal' | 'avgViewsFloor' | 'avgViewsIdeal' | 'preferredAgeGroup'>> = {
  genderFemaleFloor: 60,
  genderFemaleIdeal: 80,
  beautyCategoryRatioFloor: 70,
  beautyCategoryRatioIdeal: 80,
  avgViewsFloor: 800,
  avgViewsIdeal: 900,
  preferredAgeGroup: '35-44',
};

const GMV_TIERS: CreatorGmvTier[] = ['L1', 'L2', 'L3', 'L4'];
const QUALIFICATIONS: CreatorQualification[] = ['Qualified', 'Not Qualified', 'Not Reviewed'];
const CASTING_STAGES: CastingStage[] = [
  'Awaiting Confirmation',
  'Awaiting dAlba Signature',
  'Signed',
  'Confirmed',
];

type SourcingFormState = {
  gmvTier: string;
  qualification: string;
  originalPrice: string;
  negotiatedPrice: string;
  pricePerVideo: string;
  commissionPercent: string;
  contractedVideoCount: string;
  contractUrl: string;
  castingStage: string;
};

function assignmentToFormState(a: CreatorCampaignAssignment): SourcingFormState {
  return {
    gmvTier: a.gmvTier || '',
    qualification: a.qualification || '',
    originalPrice: a.originalPrice != null ? String(a.originalPrice) : '',
    negotiatedPrice: a.negotiatedPrice != null ? String(a.negotiatedPrice) : '',
    pricePerVideo: a.pricePerVideo != null ? String(a.pricePerVideo) : '',
    commissionPercent: a.commissionPercent != null ? String(a.commissionPercent) : '',
    contractedVideoCount: a.contractedVideoCount != null ? String(a.contractedVideoCount) : '',
    contractUrl: a.contractUrl || '',
    castingStage: a.castingStage || '',
  };
}

interface CreatorDetailDrawerProps {
  creator: Creator | null;
  campaigns?: Campaign[];
  workspaces?: Workspace[];
  assignments?: CreatorCampaignAssignment[];
  scoringCriteria?: WorkspaceScoringCriteria;
  onClose: () => void;
  onOpenEmailComposer: (cr: Creator) => void;
  onArchiveCreator: (id: string) => void;
  onAddNote: (creatorId: string, content: string) => void;
  onAssignCampaign?: (creatorId: string, campaignId: string) => void;
  onUnassignCampaign?: (assignmentId: string) => void;
  onUpdateAssignment?: (assignmentId: string, updates: Partial<CreatorCampaignAssignment>) => void;
  onUpdateEmail?: (creatorId: string, email: string) => void;
}

export const CreatorDetailDrawer: React.FC<CreatorDetailDrawerProps> = ({
  creator,
  campaigns = [],
  workspaces = [],
  assignments = [],
  scoringCriteria,
  onClose,
  onOpenEmailComposer,
  onArchiveCreator,
  onAddNote,
  onAssignCampaign,
  onUnassignCampaign,
  onUpdateAssignment,
  onUpdateEmail
}) => {
  const [activeSection, setActiveSection] = useState<string>('sec-campaigns');
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [sourcingForm, setSourcingForm] = useState<SourcingFormState | null>(null);
  const [bookmarked, setBookmarked] = useState(false);
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  // Ảnh bìa thật lấy lazy qua TikTok oEmbed API công khai (không cần login/API key) — TikTok One
  // network-intercept không trả field ảnh bìa nên phải bổ sung riêng theo video, cache theo id
  // trong phiên xem này (không lưu server vì link CDN có chữ ký kèm hạn, không cache lâu được).
  const [thumbCache, setThumbCache] = useState<Record<string, string>>({});
  const [playingVideo, setPlayingVideo] = useState<{ itemID: string; title: string } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isManualScroll = useRef(false);

  useEffect(() => {
    const sectionIds = [
      'sec-campaigns',
      'sec-sales',
      'sec-video',
      'sec-followers',
      'sec-notes'
    ];

    const handleScroll = () => {
      if (isManualScroll.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const containerTop = container.getBoundingClientRect().top;

      let currentSec = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // If top of section is near or above 180px from top of container viewport
          if (rect.top - containerTop <= 180) {
            currentSec = id;
          }
        }
      }
      setActiveSection(currentSec);
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [creator]);

  useEffect(() => {
    const tabEl = document.getElementById(`tab-${activeSection}`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeSection]);

  // Lazy-load ảnh bìa thật qua TikTok oEmbed (public, không cần login) cho video chưa có thumb.
  // Đặt TRƯỚC early-return `if (!creator)` bên dưới vì hook không được gọi có điều kiện — tự
  // tính lại danh sách video ở đây thay vì dùng displayVideos (biến đó khai báo sau early-return).
  useEffect(() => {
    if (!creator) return;
    const videos = creator.recentVideos || [];

    const toFetch = videos.filter(v => !v.thumb && v.videoUrl && !thumbCache[v.id]);
    if (toFetch.length === 0) return;
    let cancelled = false;
    toFetch.forEach(async v => {
      try {
        const res = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(v.videoUrl!)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.thumbnail_url) {
          setThumbCache(prev => (prev[v.id] ? prev : { ...prev, [v.id]: data.thumbnail_url }));
        }
      } catch {
        // Video bị xoá/riêng tư hoặc mạng lỗi — bỏ qua, giữ nguyên placeholder.
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator?.id]);

  // This drawer stays mounted and only swaps `creator` — without this, a half-typed
  // note, bookmark, filter, or open video modal from the previous creator leaks
  // into the next one (e.g. a note gets attached to the wrong creator).
  useEffect(() => {
    setBookmarked(false);
    setNewNoteText('');
    setPlayingVideo(null);
    setActiveSection('sec-campaigns');
    setEditingEmail(false);
  }, [creator?.id]);

  if (!creator) return null;

  const EMPTY = 'Chưa có dữ liệu';

  const formatNumber = (num?: number | null) => {
    if (num === undefined || num === null || isNaN(num)) return EMPTY;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toLocaleString();
  };

  // ===== Checklist d'Alba (BƯỚC 2) — nhóm này ops nhìn đầu tiên để quyết outreach hay không,
  // luôn hiển thị tĩnh ở đầu (không nằm trong vùng cuộn) thay vì phải bấm qua từng tab TCM. =====
  const dalbaCriteria = { ...DEFAULT_DALBA_CRITERIA, ...scoringCriteria };
  // Beauty ratio ưu tiên field sourcing thật (import Kalodata/manual); nếu chưa có thì lấy từ
  // donut "GMV by product category" thật của TCM (salesMetrics.categorySplit).
  const beautyRatioVal =
    creator.beautyCategoryRatio ??
    creator.salesMetrics?.categorySplit?.find(c => /beauty|personal care/i.test(c.name))?.value;
  const genderFemaleVal = creator.demographics?.genderFemale;
  const preferredAgePctVal = creator.demographics?.ageDistribution?.find(a => a.name === dalbaCriteria.preferredAgeGroup)?.value;
  const gpmValForChecklist = creator.gpm ?? creator.salesMetrics?.gpm;

  type BandStatus = 'pass' | 'partial' | 'fail' | 'nodata';
  const bandStatus = (value: number | undefined, floor?: number, ideal?: number): BandStatus => {
    if (value === undefined || floor === undefined || ideal === undefined) return 'nodata';
    if (value >= ideal) return 'pass';
    if (value >= floor) return 'partial';
    return 'fail';
  };
  const BAND_STYLES: Record<BandStatus, string> = {
    pass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    partial: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
    fail: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
    nodata: 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700',
  };
  const dalbaBadge = (label: string, value: number | undefined, unit: string, status: BandStatus) => (
    <div key={label} className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-0.5 ${BAND_STYLES[status]}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</span>
      <span>{value !== undefined ? `${value}${unit}` : EMPTY}</span>
    </div>
  );

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    isManualScroll.current = true;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        isManualScroll.current = false;
      }, 700);
    }
  };

  // Donut chart colors
  const COLORS = ['#818cf8', '#0284c7', '#f472b6', '#b45309', '#0d9488', '#9333ea'];

  // Demographic Donut Data — only rendered when the scraper actually captured demographics
  const hasGenderData = creator.demographics?.genderFemale !== undefined || creator.demographics?.genderMale !== undefined;
  const genderData = hasGenderData ? [
    { name: 'Female', value: creator.demographics?.genderFemale ?? 0 },
    { name: 'Male', value: creator.demographics?.genderMale ?? 0 }
  ] : [];

  const ageData = creator.demographics?.ageDistribution || [];
  const countryData = creator.demographics?.countryDistribution || [];

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onAddNote(creator.id, newNoteText);
    setNewNoteText('');
  };

  const handleSaveEmail = () => {
    setEditingEmail(false);
    onUpdateEmail?.(creator.id, emailDraft.trim());
  };

  return (
    <>
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div
        className="w-full max-w-7xl bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Control Header Bar */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-end shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenEmailComposer(creator)}
              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Generate Outreach
            </button>
            <button
              onClick={() => onArchiveCreator(creator.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Archive Creator"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Split: Fixed Left Profile Card & Continuous Vertical Scroll Right Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT SIDEBAR: Creator Identity Card */}
          <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 overflow-y-auto shrink-0 space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <img
                  src={
                    creator.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  }
                  alt={creator.displayName}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-teal-500/20 shadow-md"
                />
                {creator.country && (
                  <span className="absolute bottom-0 right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow-md text-xs">
                    {creator.country === 'Vietnam' ? '🇻🇳' : creator.country === 'United States' ? '🇺🇸' : '🌐'}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                {creator.handle}
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{creator.displayName}</p>

              {/* Data Source Badge — reflects how this creator actually entered the CRM */}
              {creator.source === 'scraper' ? (
                <div className="mt-2.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Auto-Synced từ Pickdi Extension</span>
                </div>
              ) : (
                <div className="mt-2.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5">
                  <span>Nhập tay (Manual)</span>
                </div>
              )}

              {/* Metrics platform badge — nguồn dữ liệu metrics (Kalodata/TCM/Cruva/Manual), khác với
                  badge "source" ở trên (kiểu creator vào CRM). Cruva chưa có luồng scrape riêng, chỉ
                  vào qua import file giống Kalodata (xem ImportWizardModal). */}
              {creator.metricsSource && (
                <div
                  className={`mt-1.5 px-3 py-1 rounded-full border text-[11px] font-bold flex items-center justify-center gap-1.5 ${
                    creator.metricsSource === 'kalodata'
                      ? 'bg-violet-50 dark:bg-violet-950/50 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300'
                      : creator.metricsSource === 'tcm'
                      ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300'
                      : creator.metricsSource === 'cruva'
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <span>
                    Nguồn:{' '}
                    {creator.metricsSource === 'kalodata'
                      ? 'Kalodata'
                      : creator.metricsSource === 'tcm'
                      ? 'TCM'
                      : creator.metricsSource === 'cruva'
                      ? 'Cruva'
                      : 'Manual'}
                  </span>
                </div>
              )}
              {(creator.importedAt || creator.metricsSyncedAt) && (
                <div className="mt-1 flex flex-col items-center gap-0.5 text-[10.5px] text-slate-400 dark:text-slate-500">
                  {creator.importedAt && <span>Ngày import: {new Date(creator.importedAt).toLocaleDateString()}</span>}
                  {creator.metricsSyncedAt && <span>Ngày cào: {new Date(creator.metricsSyncedAt).toLocaleDateString()}</span>}
                </div>
              )}

              <div className="mt-2 flex flex-col items-center gap-1">
                <a
                  href={creator.profileUrl || `https://www.tiktok.com/@${(creator.handle || '').replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  View TikTok profile <ExternalLink className="w-3 h-3" />
                </a>
                {/* Chỉ có khi extension đã cào được creator_oecuid từ TCM (marketplace/profile) —
                    không tự suy diễn/đoán cid vì TCM yêu cầu cid thật để mở đúng trang creator. */}
                {creator.tcmCreatorOecuid && (
                  <a
                    href={`https://affiliate-us.tiktok.com/connection/creator/detail?cid=${encodeURIComponent(creator.tcmCreatorOecuid)}&shop_region=US`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                  >
                    View TCM creator profile <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {/* Lần search-cid gần nhất (extension) không khớp handle này trên TCM — xem
                    POST /api/creators/tcm-not-found (server.ts). Xoá ngay khi tìm thấy cid. */}
                {!creator.tcmCreatorOecuid && creator.tcmNotFoundAt && (
                  <span
                    title={`Lần tìm gần nhất: ${new Date(creator.tcmNotFoundAt).toLocaleDateString()}`}
                    className="text-[10.5px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1"
                  >
                    <AlertTriangle className="w-3 h-3" /> Không tìm thấy trên TCM
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center justify-center gap-1.5 text-xs w-full">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {editingEmail ? (
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <input
                      type="email"
                      autoFocus
                      value={emailDraft}
                      onChange={e => setEmailDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') { e.preventDefault(); handleSaveEmail(); }
                        if (e.key === 'Escape') setEditingEmail(false);
                      }}
                      placeholder="creator@email.com"
                      className="flex-1 min-w-0 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                    />
                    <button onClick={handleSaveEmail} className="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] shrink-0">
                      Lưu
                    </button>
                    <button onClick={() => setEditingEmail(false)} className="text-slate-400 hover:text-slate-600 text-[11px] shrink-0">
                      Hủy
                    </button>
                  </div>
                ) : creator.email ? (
                  <>
                    <a href={`mailto:${creator.email}`} className="font-medium text-slate-600 dark:text-slate-300 hover:underline break-all">
                      {creator.email}
                    </a>
                    <button
                      onClick={() => { setEmailDraft(creator.email || ''); setEditingEmail(true); }}
                      className="text-slate-400 hover:text-indigo-600 shrink-0"
                      title="Sửa email"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => { setEmailDraft(''); setEditingEmail(true); }}
                    className="text-slate-400 italic hover:text-indigo-600 hover:no-underline underline decoration-dashed"
                  >
                    Chưa có email — bấm để thêm
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Creator bio</h4>
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                  {creator.bio || 'Chưa có tiểu sử (Tự động thu thập qua Extension)'}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Languages spoken</h4>
                <p className="text-slate-600 dark:text-slate-400">{creator.language || EMPTY}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">Category</h4>
                <div className="flex flex-wrap gap-1.5">
                  {creator.category ? (
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {creator.category}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">{EMPTY}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => onOpenEmailComposer(creator)}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
                >
                  Collaborate
                </button>
                <button
                  onClick={() => setBookmarked(!bookmarked)}
                  className={`p-2.5 border rounded-xl transition-colors ${
                    bookmarked
                      ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Sticky Quick Jump Navigation + Continuous Vertical Scroll Sections */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Đánh giá theo tiêu chí d'Alba — luôn hiển thị tĩnh, KHÔNG nằm trong vùng cuộn, vì
                đây là phần ops nhìn đầu tiên để quyết outreach hay không (BƯỚC 2). */}
            <div className="px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <h4 className="text-xs font-black uppercase tracking-wide text-slate-500 mb-2.5">
                Đánh giá theo tiêu chí d'Alba
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-0.5 ${creator.gmvTier ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' : BAND_STYLES.nodata}`}>
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">GMV tier</span>
                  <span>{creator.gmvTier || EMPTY}</span>
                </div>
                <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-0.5 ${creator.gmvTier ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800' : BAND_STYLES.nodata}`}>
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Hình thức hợp tác</span>
                  <span>{cooperationModeLabel(cooperationModeForTier(creator.gmvTier)) || EMPTY}</span>
                </div>
                <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-0.5 ${gpmValForChecklist !== undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700' : BAND_STYLES.nodata}`}>
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">GPM</span>
                  <span>{gpmValForChecklist !== undefined ? `$${gpmValForChecklist}` : EMPTY}</span>
                </div>
                {dalbaBadge('% nữ', genderFemaleVal, '%', bandStatus(genderFemaleVal, dalbaCriteria.genderFemaleFloor, dalbaCriteria.genderFemaleIdeal))}
                {dalbaBadge('% beauty', beautyRatioVal, '%', bandStatus(beautyRatioVal, dalbaCriteria.beautyCategoryRatioFloor, dalbaCriteria.beautyCategoryRatioIdeal))}
                <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-0.5 ${preferredAgePctVal !== undefined ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700' : BAND_STYLES.nodata}`}>
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">% tuổi {dalbaCriteria.preferredAgeGroup}</span>
                  <span>{preferredAgePctVal !== undefined ? `${preferredAgePctVal}%` : EMPTY}</span>
                </div>
                {dalbaBadge('Avg views', creator.avgViews, '', bandStatus(creator.avgViews, dalbaCriteria.avgViewsFloor, dalbaCriteria.avgViewsIdeal))}
                <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex flex-col gap-0.5 ${
                  creator.hasAffiliateGmv === undefined ? BAND_STYLES.nodata : creator.hasAffiliateGmv ? BAND_STYLES.pass : BAND_STYLES.fail
                }`}>
                  <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">Eligibility</span>
                  <span>{creator.hasAffiliateGmv === undefined ? EMPTY : creator.hasAffiliateGmv ? 'Đạt' : 'Chưa có affiliate GMV'}</span>
                </div>
              </div>
            </div>

            {/* Sticky Anchor Navigation Bar */}
            <div className="sticky top-0 z-20 px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 overflow-x-auto shrink-0 text-xs font-bold scrollbar-none shadow-xs">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                <ArrowDown className="w-3 h-3" /> Jump to:
              </span>

              <button
                id="tab-sec-campaigns"
                onClick={() => scrollToSection('sec-campaigns')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-campaigns'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Brands & Campaigns ({assignments.filter(a => a.creatorId === creator.id).length})
              </button>

              <button
                id="tab-sec-sales"
                onClick={() => scrollToSection('sec-sales')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-sales'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Sales
              </button>

              <button
                id="tab-sec-video"
                onClick={() => scrollToSection('sec-video')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-video'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Video
              </button>

              <button
                id="tab-sec-followers"
                onClick={() => scrollToSection('sec-followers')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-followers'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Followers
              </button>

              <button
                id="tab-sec-notes"
                onClick={() => scrollToSection('sec-notes')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-notes'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Notes & CRM ({creator.notes?.length || 0})
              </button>
            </div>

            {/* SINGLE CONTINUOUS SCROLL CONTAINER FOR ALL SECTIONS */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-12 scroll-smooth">
              {/* SECTION: BRANDS & CAMPAIGNS — CRM-internal, not part of TCM's own tab layout,
                  kept as the first section since it's the first thing ops needs to act on. 1
                  creator có thể chạy nhiều campaign ở nhiều brand cùng lúc, mỗi lần hợp tác có
                  status riêng (xem CreatorCampaignAssignment). */}
              <section id="sec-campaigns" className="space-y-6 pt-2">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                  Brands & Campaigns
                </h3>

                {(() => {
                  const crAssignments = assignments.filter(a => a.creatorId === creator.id);
                  const assignedCampaignIds = new Set(crAssignments.map(a => a.campaignId));
                  const availableCampaigns = campaigns.filter(cmp => !assignedCampaignIds.has(cmp.id));

                  return (
                    <div className="space-y-3">
                      {crAssignments.length === 0 ? (
                        <p className="text-slate-400 py-6 text-center text-xs">
                          Creator này chưa được gán vào campaign/brand nào.
                        </p>
                      ) : (
                        crAssignments.map(a => {
                          const ws = workspaces.find(w => w.id === a.workspaceId);
                          const isEditing = editingAssignmentId === a.id;
                          return (
                            <div
                              key={a.id}
                              className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {ws && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                        {ws.code}
                                      </span>
                                    )}
                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate">{a.campaignName}</span>
                                    {a.gmvTier && (
                                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                                        {a.gmvTier}
                                      </span>
                                    )}
                                    {a.qualification && (
                                      <span
                                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                                          a.qualification === 'Qualified'
                                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                            : a.qualification === 'Not Qualified'
                                            ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                        }`}
                                      >
                                        {a.qualification}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    Assigned {new Date(a.assignedAt).toLocaleDateString()}
                                    {a.castingStage ? ` · ${a.castingStage}` : ''}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
                                    {a.status}
                                  </span>
                                  {onUpdateAssignment && (
                                    <button
                                      onClick={() => {
                                        if (isEditing) {
                                          setEditingAssignmentId(null);
                                          setSourcingForm(null);
                                        } else {
                                          setEditingAssignmentId(a.id);
                                          setSourcingForm(assignmentToFormState(a));
                                        }
                                      }}
                                      className="text-xs text-indigo-600 hover:text-indigo-800 font-bold"
                                    >
                                      {isEditing ? 'Đóng' : 'Giá/Hợp đồng'}
                                    </button>
                                  )}
                                  {onUnassignCampaign && (
                                    <button
                                      onClick={() => onUnassignCampaign(a.id)}
                                      className="text-xs text-slate-400 hover:text-rose-600 font-bold"
                                      title="Gỡ khỏi campaign này"
                                    >
                                      Gỡ
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditing && sourcingForm && onUpdateAssignment && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Hạng GMV</label>
                                    <select
                                      value={sourcingForm.gmvTier}
                                      onChange={e => setSourcingForm({ ...sourcingForm, gmvTier: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    >
                                      <option value="">—</option>
                                      {GMV_TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Trạng thái phù hợp</label>
                                    <select
                                      value={sourcingForm.qualification}
                                      onChange={e => setSourcingForm({ ...sourcingForm, qualification: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    >
                                      <option value="">—</option>
                                      {QUALIFICATIONS.map(q => <option key={q} value={q}>{q}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Giai đoạn casting</label>
                                    <select
                                      value={sourcingForm.castingStage}
                                      onChange={e => setSourcingForm({ ...sourcingForm, castingStage: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    >
                                      <option value="">—</option>
                                      {CASTING_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Số video hợp đồng</label>
                                    <input
                                      type="number"
                                      value={sourcingForm.contractedVideoCount}
                                      onChange={e => setSourcingForm({ ...sourcingForm, contractedVideoCount: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Giá gốc</label>
                                    <input
                                      type="number"
                                      value={sourcingForm.originalPrice}
                                      onChange={e => setSourcingForm({ ...sourcingForm, originalPrice: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Giá đã chốt</label>
                                    <input
                                      type="number"
                                      value={sourcingForm.negotiatedPrice}
                                      onChange={e => setSourcingForm({ ...sourcingForm, negotiatedPrice: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">Giá mỗi video</label>
                                    <input
                                      type="number"
                                      value={sourcingForm.pricePerVideo}
                                      onChange={e => setSourcingForm({ ...sourcingForm, pricePerVideo: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                  </div>
                                  <div>
                                    <label className="block font-bold text-slate-500 mb-1">% hoa hồng</label>
                                    <input
                                      type="number"
                                      value={sourcingForm.commissionPercent}
                                      onChange={e => setSourcingForm({ ...sourcingForm, commissionPercent: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                  </div>
                                  <div className="col-span-2 sm:col-span-4">
                                    <label className="block font-bold text-slate-500 mb-1">Link hợp đồng</label>
                                    <input
                                      type="text"
                                      placeholder="https://..."
                                      value={sourcingForm.contractUrl}
                                      onChange={e => setSourcingForm({ ...sourcingForm, contractUrl: e.target.value })}
                                      className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                    />
                                  </div>
                                  <div className="col-span-2 sm:col-span-4 flex justify-end pt-1">
                                    <button
                                      onClick={() => {
                                        const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v));
                                        onUpdateAssignment(a.id, {
                                          gmvTier: (sourcingForm.gmvTier || undefined) as CreatorGmvTier | undefined,
                                          qualification: (sourcingForm.qualification || undefined) as CreatorQualification | undefined,
                                          castingStage: (sourcingForm.castingStage || undefined) as CastingStage | undefined,
                                          originalPrice: toNum(sourcingForm.originalPrice),
                                          negotiatedPrice: toNum(sourcingForm.negotiatedPrice),
                                          pricePerVideo: toNum(sourcingForm.pricePerVideo),
                                          commissionPercent: toNum(sourcingForm.commissionPercent),
                                          contractedVideoCount: toNum(sourcingForm.contractedVideoCount),
                                          contractUrl: sourcingForm.contractUrl.trim() || undefined,
                                        });
                                        setEditingAssignmentId(null);
                                        setSourcingForm(null);
                                      }}
                                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs"
                                    >
                                      Lưu
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {onAssignCampaign && availableCampaigns.length > 0 && (
                        <select
                          value=""
                          onChange={e => {
                            if (e.target.value) onAssignCampaign(creator.id, e.target.value);
                          }}
                          className="w-full sm:w-auto p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-500"
                        >
                          <option value="">+ Thêm campaign khác cho creator này</option>
                          {availableCampaigns.map(cmp => (
                            <option key={cmp.id} value={cmp.id}>{cmp.name} ({cmp.brand})</option>
                          ))}
                        </select>
                      )}
                    </div>
                  );
                })()}
              </section>

              {/* SECTION: SALES — GMV/Items sold/GPM/GMV per customer + donut kênh (Video/LIVE)
                  và donut ngành hàng (nguồn thật cho beautyCategoryRatio). */}
              <section id="sec-sales" className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  Sales
                </h3>
                {creator.salesMetrics ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                        <span className="text-xs text-slate-500 font-medium">GMV</span>
                        <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                          {typeof creator.salesMetrics.gmv === 'number' ? `$${formatNumber(creator.salesMetrics.gmv)}` : EMPTY}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                        <span className="text-xs text-slate-500 font-medium">Items sold</span>
                        <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                          {typeof creator.salesMetrics.itemsSold === 'number' ? formatNumber(creator.salesMetrics.itemsSold) : EMPTY}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                        <span className="text-xs text-slate-500 font-medium">GPM</span>
                        <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                          {typeof creator.salesMetrics.gpm === 'number' ? `$${creator.salesMetrics.gpm}` : EMPTY}
                        </p>
                      </div>
                      <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                        <span className="text-xs text-slate-500 font-medium">GMV per customer</span>
                        <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                          {typeof creator.salesMetrics.gmvPerCustomer === 'number' ? `$${creator.salesMetrics.gmvPerCustomer}` : EMPTY}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {creator.salesMetrics.channelSplit && (creator.salesMetrics.channelSplit.video !== undefined || creator.salesMetrics.channelSplit.live !== undefined) ? (
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">GMV per sales channel</h4>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={[
                                    { name: 'Video', value: creator.salesMetrics.channelSplit.video ?? 0 },
                                    { name: 'LIVE', value: creator.salesMetrics.channelSplit.live ?? 0 }
                                  ]}
                                  cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value"
                                >
                                  {COLORS.slice(0, 2).map((c, i) => <Cell key={i} fill={c} />)}
                                </Pie>
                                <Tooltip formatter={val => `${val}%`} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic flex items-center justify-center">
                          {EMPTY} — GMV per sales channel
                        </div>
                      )}

                      {creator.salesMetrics.categorySplit && creator.salesMetrics.categorySplit.length > 0 ? (
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">GMV by product category</h4>
                          <div className="h-48 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={creator.salesMetrics.categorySplit} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                                  {creator.salesMetrics.categorySplit.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={val => `${val}%`} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                            {creator.salesMetrics.categorySplit.map((c, i) => (
                              <span key={c.name} className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                {c.name} ({c.value}%)
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic flex items-center justify-center">
                          {EMPTY} — GMV by product category
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic">
                    {EMPTY} — chỉ có khi import từ TikTok Creator Marketplace
                  </div>
                )}
              </section>

              {/* SECTION: VIDEO */}
              <section id="sec-video" className="space-y-4 pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-pink-500 inline-block" />
                  Video
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-xs text-slate-500 font-medium">Video GPM</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {typeof creator.videoMetrics?.gpm === 'number' ? `$${creator.videoMetrics.gpm}` : EMPTY}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-xs text-slate-500 font-medium">Videos (30d)</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {typeof creator.videoMetrics?.videosCount === 'number' ? creator.videoMetrics.videosCount : EMPTY}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-xs text-slate-500 font-medium">Avg. video views</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {typeof creator.videoMetrics?.avgViews === 'number' ? creator.videoMetrics.avgViews.toLocaleString() : EMPTY}
                    </p>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <span className="text-xs text-slate-500 font-medium">Avg. video engagement rate</span>
                    <p className="text-xl font-black text-slate-900 dark:text-white mt-1">
                      {typeof creator.videoMetrics?.engagementRatePct === 'number' ? `${creator.videoMetrics.engagementRatePct}%` : EMPTY}
                    </p>
                  </div>
                </div>
              </section>

              {/* SECTION 5: AUDIENCE DEMOGRAPHICS */}
              <section id="sec-followers" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    Followers
                  </h3>
                  <p className="text-xs text-slate-500 mb-4">
                    Chỉ hiển thị Follower demographics — một số nguồn scrape có trả thêm Audience
                    reached/engaged nhưng hệ thống chưa chuẩn hoá riêng được 2 loại đó nên tạm ẩn thay vì hiện data trùng lặp.
                  </p>

                  {/* Summary row */}
                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div>
                      Gender{' '}
                      <strong className="text-slate-900 dark:text-white ml-1">
                        {creator.demographics?.genderFemale !== undefined ? `Female (${creator.demographics.genderFemale}%)` : EMPTY}
                      </strong>
                    </div>
                    <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                    <div>
                      Top Age <strong className="text-slate-900 dark:text-white ml-1">{creator.demographics?.topAgeGroup || EMPTY}</strong>
                    </div>
                    <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                    <div>
                      Top country or region{' '}
                      <strong className="text-slate-900 dark:text-white ml-1">{creator.demographics?.topCountry || creator.country || EMPTY}</strong>
                    </div>
                  </div>
                </div>

                {/* Donut Charts — only rendered when the scraper actually captured this demographic */}
                {(hasGenderData || ageData.length > 0 || countryData.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {hasGenderData && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Gender</h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={genderData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {genderData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={val => `${val}%`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-4 text-xs font-medium text-slate-500">
                          {genderData.map((g, i) => (
                            <span key={g.name} className="flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ageData.length > 0 && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          Age <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={ageData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {ageData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={val => `${val}%`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center flex-wrap gap-3 text-xs font-medium text-slate-500">
                          {ageData.map((a, i) => (
                            <span key={a.name} className="flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {countryData.length > 0 && (
                      // TCM layout thật là bar chart "Top 5 locations" (bang/quốc gia + %), không
                      // phải donut như Gender/Age — chỉ 2 chart kia mới đúng dạng donut.
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          Top 5 locations <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={countryData.slice(0, 5)} layout="vertical" margin={{ left: 8 }}>
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="name" width={90} stroke="#94a3b8" fontSize={11} />
                              <Tooltip formatter={val => `${val}%`} />
                              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                {countryData.slice(0, 5).map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic">
                    {EMPTY} — chưa có follower demographics cho creator này
                  </div>
                )}
              </section>

              {/* SECTION 6: INTERNAL NOTES & CRM LOGS */}
              <section id="sec-notes" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800 pb-8">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-600 inline-block" />
                  6. Internal Notes & CRM Activities
                </h3>

                <form onSubmit={handleNoteSubmit} className="space-y-2">
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Write an internal operator note about rate negotiations, preferences, contact history..."
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs"
                  >
                    Save Internal Note
                  </button>
                </form>

                <div className="space-y-3">
                  {!creator.notes || creator.notes.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center text-xs">No internal notes added yet.</p>
                  ) : (
                    creator.notes.map(n => (
                      <div
                        key={n.id}
                        className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{n.author}</span>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Modal phát video inline — dùng iframe embed chính chủ TikTok (tiktok.com/embed/v2/{itemID}),
        không tải file mp4 hay vi phạm gì, chỉ nhúng player gốc của TikTok. */}
    {playingVideo && (
      <div
        className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
        onClick={() => setPlayingVideo(null)}
      >
        <div className="relative w-full max-w-sm" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setPlayingVideo(null)}
            className="absolute -top-10 right-0 text-white/80 hover:text-white p-1.5"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="bg-black rounded-2xl overflow-hidden shadow-2xl" style={{ aspectRatio: '9/16' }}>
            <iframe
              key={playingVideo.itemID}
              src={`https://www.tiktok.com/embed/v2/${playingVideo.itemID}`}
              className="w-full h-full"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title={playingVideo.title || 'TikTok video'}
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};
