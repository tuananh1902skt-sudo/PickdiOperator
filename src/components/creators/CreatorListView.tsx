import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Users,
  Search,
  Sparkles,
  ExternalLink,
  Mail,
  Send,
  Archive,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  UploadCloud,
  Layers,
  Trash2,
  Bot,
  Settings2,
  SlidersHorizontal,
  X,
  AlertTriangle,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { Creator, Campaign, Workspace, CreatorCampaignAssignment, CreatorStatus } from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';
import {
  getStoredExtensionId,
  setStoredExtensionId,
  startAutoDetailQueue,
  getAutoDetailStatus,
  stopAutoDetailQueue,
  AutoDetailQueueState,
  startSearchCidQueue,
  getSearchCidStatus,
  stopSearchCidQueue,
  SearchCidQueueState
} from '../../lib/tcmExtensionBridge';

// Menu dùng chung cho cả header ("toàn bộ workspace") và bulk-action bar ("creator đã chọn") —
// gộp 2 thao tác TCM (tìm cid theo handle / cào chi tiết) + cấu hình Extension ID vào 1 dropdown
// duy nhất thay vì rải nút lẻ, để header/bulk bar không bị rối khi thêm tính năng mới.

const ALL_CREATOR_STATUSES: CreatorStatus[] = [
  'New Lead', 'Researching', 'Qualified', 'Contact lần 1', 'Contact lần 2', 'Contact lần 3',
  'Interested', 'Negotiating', 'Rejected', 'Approved', 'Sample Sent', 'Draft Submitted',
  'Revision Requested', 'Approved Draft', 'Posted', 'Completed', 'Archived'
];

interface TcmActionsMenuProps {
  triggerLabel: string;
  triggerClassName: string;
  findCidCount: number;
  onFindCid: () => void;
  scrapeDetailCount: number;
  onScrapeDetail: () => void;
  missingAvatarCount: number;
  onScrapeMissingAvatar: () => void;
  onConfigureExtension?: () => void;
  extensionId?: string;
  align?: 'left' | 'right';
}

const TcmActionsMenu: React.FC<TcmActionsMenuProps> = ({
  triggerLabel,
  triggerClassName,
  findCidCount,
  onFindCid,
  scrapeDetailCount,
  onScrapeDetail,
  missingAvatarCount,
  onScrapeMissingAvatar,
  onConfigureExtension,
  extensionId,
  align = 'right'
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button onClick={() => setOpen(o => !o)} className={triggerClassName}>
        <Bot className="w-4 h-4" />
        {triggerLabel}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div
            className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-2 w-72 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-20 p-1.5`}
          >
            <button
              onClick={() => {
                onFindCid();
                setOpen(false);
              }}
              disabled={findCidCount === 0}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              Tìm cid TCM theo handle ({findCidCount} chưa có)
            </button>
            <button
              onClick={() => {
                onScrapeDetail();
                setOpen(false);
              }}
              disabled={scrapeDetailCount === 0}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Bot className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              Cào chi tiết TCM ({scrapeDetailCount} thiếu)
            </button>
            <button
              onClick={() => {
                onScrapeMissingAvatar();
                setOpen(false);
              }}
              disabled={missingAvatarCount === 0}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <ImageIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              Cào lại avatar thiếu ({missingAvatarCount} thiếu)
            </button>
            {onConfigureExtension && (
              <>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  onClick={() => {
                    onConfigureExtension();
                    setOpen(false);
                  }}
                  title={extensionId ? `Extension ID hiện tại: ${extensionId}` : undefined}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2"
                >
                  <Settings2 className="w-3.5 h-3.5 shrink-0" />
                  {extensionId ? 'Đổi Extension ID' : 'Cấu hình Extension ID'}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// Popover gọn cho "Assign Campaign" trong bảng — thay cho <select> luôn hiện trong ô, vốn
// đẩy chiều cao dòng lên khi cộng thêm với các badge campaign đã gán (mỗi thứ 1 dòng riêng
// khiến bảng bị xuống dòng rất nhiều). Giờ chỉ hiện nút "+", bấm mới mở danh sách.
interface AssignCampaignMenuProps {
  availableCampaigns: Campaign[];
  onAssign: (campaignId: string) => void;
}

const AssignCampaignMenu: React.FC<AssignCampaignMenuProps> = ({ availableCampaigns, onAssign }) => {
  const [open, setOpen] = useState(false);
  if (availableCampaigns.length === 0) return null;
  return (
    <div className="relative shrink-0">
      <button
        onClick={e => {
          e.stopPropagation();
          setOpen(o => !o);
        }}
        className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-indigo-100 hover:text-indigo-700 dark:hover:bg-indigo-950 dark:hover:text-indigo-300 transition-colors"
        title="Assign campaign"
      >
        + Campaign
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={e => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute left-0 mt-1 w-48 max-h-56 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg z-20 p-1">
            {availableCampaigns.map(cmp => (
              <button
                key={cmp.id}
                onClick={e => {
                  e.stopPropagation();
                  onAssign(cmp.id);
                  setOpen(false);
                }}
                className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 truncate"
                title={cmp.name}
              >
                {cmp.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface CreatorListViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  assignments?: CreatorCampaignAssignment[];
  activeWorkspace?: Workspace;
  workspaces?: Workspace[];
  onSelectWorkspace?: (id: string) => void;
  onOpenSettings?: () => void;
  onSelectCreator: (cr: Creator) => void;
  onOpenImport: () => void;
  onRefresh?: () => Promise<void> | void;
  onOpenEmailComposer: (cr: Creator) => void;
  onArchiveCreator: (id: string) => void;
  onDeleteCreatorPermanently?: (id: string) => void;
  onRunAiScore: (cr: Creator) => void;
  onAssignCampaign: (crId: string, cmpId: string) => void;
  onUnassignCampaign?: (assignmentId: string) => void;
  onOpenBulkOutreach?: (creatorIds: string[]) => void;
  onUpdateStatus?: (creatorId: string, status: CreatorStatus) => void;
}

export const CreatorListView: React.FC<CreatorListViewProps> = ({
  creators,
  campaigns,
  assignments = [],
  activeWorkspace,
  workspaces = [],
  onSelectWorkspace,
  onOpenSettings,
  onSelectCreator,
  onOpenImport,
  onRefresh,
  onOpenEmailComposer,
  onArchiveCreator,
  onDeleteCreatorPermanently,
  onRunAiScore,
  onAssignCampaign,
  onUnassignCampaign,
  onOpenBulkOutreach,
  onUpdateStatus
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');
  // Lọc theo ngày import — group theo ngày (YYYY-MM-DD, giờ local) của creator.importedAt, để
  // operator cô lập đúng đợt vừa import (vd 2000 creator import hôm nay) và duyệt giữ/xóa trước
  // khi bắt đầu cào, thay vì lẫn lộn với toàn bộ database. Creator chưa từng import qua file/sheet
  // (chỉ tới từ TCM scrape hoặc thêm tay) không có importedAt nên không xuất hiện trong danh sách
  // ngày — chọn "Chưa rõ ngày import" để xem riêng nhóm đó.
  const [selectedImportDate, setSelectedImportDate] = useState('ALL');

  // Sort theo cột — bấm vào tiêu đề cột trong bảng (Creator, Category & Niche, Email,
  // Followers, Avg Views, ER %, Brands, Campaigns, Status) để sort tăng/giảm,
  // bấm lại lần nữa trên cùng cột để đảo chiều. null = giữ nguyên thứ tự gốc.
  type SortKey = 'creator' | 'category' | 'email' | 'followers' | 'avgViews' | 'er' | 'gmv' | 'brands' | 'campaigns' | 'status';
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Bộ lọc nâng cao — gắn trực tiếp với 2 chức năng quét data TCM (tìm cid / cào chi tiết) để
  // operator lọc ra đúng nhóm creator cần chạy hàng đợi tiếp theo, cộng thêm range lọc theo các
  // chỉ số sourcing hay dùng nhất (ER%, Avg Views, Followers) thay vì phải lướt cả
  // bảng để tìm bằng mắt.
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [tcmScrapeFilter, setTcmScrapeFilter] = useState<'ALL' | 'NO_CID' | 'HAS_CID_NO_DETAIL' | 'HAS_DETAIL' | 'NOT_FOUND' | 'MISSING_AVATAR'>('ALL');
  const [minEr, setMinEr] = useState('');
  const [maxEr, setMaxEr] = useState('');
  const [minAvgViews, setMinAvgViews] = useState('');
  const [maxAvgViews, setMaxAvgViews] = useState('');
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [minGmv, setMinGmv] = useState('');
  const [maxGmv, setMaxGmv] = useState('');
  const [minBeautyRatio, setMinBeautyRatio] = useState('');
  const [maxBeautyRatio, setMaxBeautyRatio] = useState('');

  const advancedFilterCount = [
    tcmScrapeFilter !== 'ALL',
    minEr !== '',
    maxEr !== '',
    minAvgViews !== '',
    maxAvgViews !== '',
    minFollowers !== '',
    maxFollowers !== '',
    minGmv !== '',
    maxGmv !== '',
    minBeautyRatio !== '',
    maxBeautyRatio !== ''
  ].filter(Boolean).length;

  const clearAdvancedFilters = () => {
    setTcmScrapeFilter('ALL');
    setMinEr('');
    setMaxEr('');
    setMinAvgViews('');
    setMaxAvgViews('');
    setMinFollowers('');
    setMaxFollowers('');
    setMinGmv('');
    setMaxGmv('');
    setMinBeautyRatio('');
    setMaxBeautyRatio('');
  };

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCampaignId, setBulkCampaignId] = useState('');

  // Pagination
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  // ================== AUTO-CÀO CHI TIẾT TCM TỪ WEBAPP (extension bridge) ==================
  // Webapp không tự cào được TCM (không có cookie login TCM của user, request TCM bắt buộc chữ
  // ký chống bot do JS của chính trang tự tính) — nút này chỉ ra lệnh cho extension "Pickdi TCM
  // Creator Scraper" (đã cài trên máy) tự mở lần lượt tab nền tới trang chi tiết từng creator,
  // vẫn là request thật TCM tự ký, y hệt cơ chế khi user tự bấm trong popup — chỉ khác nguồn kích
  // hoạt là nút trong CRM thay vì popup. Xem src/lib/tcmExtensionBridge.ts.
  const [extensionId, setExtensionId] = useState(getStoredExtensionId());
  const [queueState, setQueueState] = useState<AutoDetailQueueState | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const queuePollRef = useRef<number | null>(null);
  const queueTickRef = useRef<(() => void) | null>(null);
  const [searchCidState, setSearchCidState] = useState<SearchCidQueueState | null>(null);
  const [searchCidError, setSearchCidError] = useState<string | null>(null);
  const searchCidPollRef = useRef<number | null>(null);
  const searchCidTickRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (queuePollRef.current) window.clearInterval(queuePollRef.current);
      if (searchCidPollRef.current) window.clearInterval(searchCidPollRef.current);
    };
  }, []);

  // Browsers clamp setInterval in backgrounded tabs, so the queue-status polls above stall
  // silently while the user is on another tab/app — the scrape itself keeps running
  // server-side, but the UI looks frozen until the next throttled tick. Force an immediate
  // re-check as soon as the tab becomes visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (queuePollRef.current) queueTickRef.current?.();
      if (searchCidPollRef.current) searchCidTickRef.current?.();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const pollQueueStatus = () => {
    if (queuePollRef.current) return;
    const tick = async () => {
      try {
        const state = await getAutoDetailStatus();
        setQueueState(state);
        const stillGoing =
          !!state &&
          (state.status === 'running' ||
            (state.status === 'done' && !!state.autoContinue && (state.pending?.length || 0) > 0));
        if (!stillGoing && queuePollRef.current) {
          window.clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }
      } catch {
        if (queuePollRef.current) {
          window.clearInterval(queuePollRef.current);
          queuePollRef.current = null;
        }
      }
    };
    queueTickRef.current = tick;
    tick();
    queuePollRef.current = window.setInterval(tick, 2000);
  };

  const pollSearchCidStatus = () => {
    if (searchCidPollRef.current) return;
    const tick = async () => {
      try {
        const state = await getSearchCidStatus();
        setSearchCidState(state);
        if (state?.status !== 'running' && searchCidPollRef.current) {
          window.clearInterval(searchCidPollRef.current);
          searchCidPollRef.current = null;
        }
      } catch {
        if (searchCidPollRef.current) {
          window.clearInterval(searchCidPollRef.current);
          searchCidPollRef.current = null;
        }
      }
    };
    searchCidTickRef.current = tick;
    tick();
    searchCidPollRef.current = window.setInterval(tick, 2000);
  };

  const handleConfigureExtensionId = () => {
    const next = window.prompt(
      'Dán Extension ID của "Pickdi TCM Creator Scraper" (xem tại chrome://extensions, bật Developer mode):',
      extensionId
    );
    if (next === null) return;
    setStoredExtensionId(next);
    setExtensionId(next.trim());
  };

  const handleAutoScrapeDetail = async (targets: Creator[]) => {
    setQueueError(null);
    const items = targets
      .filter(c => !!c.tcmCreatorOecuid)
      .map(c => ({ cid: c.tcmCreatorOecuid as string, handle: c.handle }));
    if (items.length === 0) {
      setQueueError('Không có creator nào đủ điều kiện (cần được import từ TCM và có tcmCreatorOecuid).');
      return;
    }
    try {
      const res = await startAutoDetailQueue(items);
      if (!res || res.ok === false) {
        setQueueError((res && res.message) || 'Không khởi động được hàng đợi.');
        return;
      }
      pollQueueStatus();
    } catch (err: any) {
      setQueueError(err?.message || String(err));
    }
  };

  const handleStopQueue = async () => {
    try {
      await stopAutoDetailQueue();
      pollQueueStatus();
    } catch (err: any) {
      setQueueError(err?.message || String(err));
    }
  };

  const handleFindTcmCid = async (targets: Creator[]) => {
    setSearchCidError(null);
    const handles = targets.filter(c => !c.tcmCreatorOecuid).map(c => c.handle);
    if (handles.length === 0) {
      setSearchCidError('Không có creator nào đủ điều kiện (cần có handle và chưa có cid TCM).');
      return;
    }
    try {
      const res = await startSearchCidQueue(handles);
      if (!res || res.ok === false) {
        setSearchCidError((res && res.message) || 'Không khởi động được hàng đợi.');
        return;
      }
      pollSearchCidStatus();
    } catch (err: any) {
      setSearchCidError(err?.message || String(err));
    }
  };

  const handleStopSearchCidQueue = async () => {
    try {
      await stopSearchCidQueue();
      pollSearchCidStatus();
    } catch (err: any) {
      setSearchCidError(err?.message || String(err));
    }
  };

  // "Thiếu detail" = đã có cid TCM (đủ điều kiện mở trang chi tiết) nhưng chưa từng cào — dùng
  // collabMetrics làm cờ đại diện vì field này CHỈ được normalizeTcmProfileDetail() set (detail
  // endpoint), KHÔNG bao giờ được set bởi normalizeCreator() (list/handle-search endpoint).
  const creatorsMissingTcmDetail = useMemo(() => creators.filter(c => !!c.tcmCreatorOecuid && !c.collabMetrics), [creators]);
  // Creator chỉ có TikTok handle, chưa từng khớp với TCM (Kalodata/manual/file import) — ứng
  // viên cho hàng đợi "tìm cid theo handle".
  const creatorsMissingTcmCid = useMemo(() => creators.filter(c => !c.tcmCreatorOecuid), [creators]);
  // "Thiếu avatar" khác với "thiếu detail": avatar được tải NGẦM sau khi cào (server.ts
  // batch-import), có thể fail âm thầm (CDN hết hạn, content-type lạ, quá dung lượng) mà không
  // để lại dấu vết nào trên collabMetrics — nên 1 creator đã cào chi tiết xong vẫn có thể trắng
  // avatar mãi mãi nếu không có cách chủ động cào lại. Chỉ tính creator đã có cid TCM vì đó là
  // điều kiện duy nhất để mở lại trang chi tiết qua extension.
  const creatorsMissingAvatar = useMemo(() => creators.filter(c => !!c.tcmCreatorOecuid && !c.avatar), [creators]);

  const sourceCreators = creators;

  // Danh sách category cho dropdown filter — lấy trực tiếp từ category thực tế của các creator
  // đang có (thay vì 3 giá trị hardcode cũ), để filter luôn khớp với data thật, kể cả khi
  // creator được import với category mới lạ (TCM/Kalodata trả về nhiều category hơn 3 giá trị cũ).
  // useMemo vì với vài nghìn creator (sau các đợt import) và component re-render mỗi 10s (poll
  // ở App.tsx) hoặc mỗi keystroke filter khác, việc build lại toàn bộ Set/sort này ở mọi render
  // (kể cả khi creators không đổi) là chi phí O(n) lãng phí và cộng dồn với các pass filter/sort khác.
  const availableCategories = useMemo(
    () =>
      Array.from(new Set(sourceCreators.map(c => c.category).filter((cat): cat is string => !!cat))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [sourceCreators]
  );

  // Danh sách các đợt import theo ngày — key là YYYY-MM-DD (giờ local) rút từ importedAt, kèm
  // số lượng creator mỗi ngày để operator biết chọn đúng đợt (vd "02/08/2026 (2.000)"). Sắp xếp
  // ngày gần nhất lên đầu vì đó là đợt vừa import, thứ operator cần lọc ngay sau khi cào xong.
  const { importDateCounts, creatorsWithoutImportDate } = useMemo(() => {
    const counts = new Map<string, number>();
    let withoutDate = 0;
    sourceCreators.forEach(c => {
      if (!c.importedAt) {
        withoutDate++;
        return;
      }
      const d = new Date(c.importedAt);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return { importDateCounts: counts, creatorsWithoutImportDate: withoutDate };
  }, [sourceCreators]);
  const availableImportDates = useMemo(
    () => Array.from(importDateCounts.entries()).sort((a, b) => b[0].localeCompare(a[0])),
    [importDateCounts]
  );
  const formatImportDateLabel = (key: string) => {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('vi-VN');
  };

  // Filtering logic
  const filteredCreators = useMemo(() => sourceCreators.filter(c => {
    // Ẩn mặc định creator đã archive/bị từ chối khỏi mọi view — trừ khi operator chủ động
    // lọc đúng "Archived" để tra lại danh sách đã từ chối (vd rejected bởi d'Alba qua Sheet).
    if (c.status === 'Archived' && selectedStatus !== 'Archived') return false;

    const q = search.toLowerCase().trim();
    if (q) {
      const matchQuery =
        c.displayName.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.niche || []).some(n => n.toLowerCase().includes(q)) ||
        (c.email || '').toLowerCase().includes(q);
      if (!matchQuery) return false;
    }

    if (selectedStatus !== 'ALL' && c.status !== selectedStatus) return false;
    if (selectedCountry !== 'ALL' && c.country !== selectedCountry) return false;
    if (selectedCategory !== 'ALL' && c.category !== selectedCategory) return false;
    if (selectedOwner !== 'ALL' && c.owner !== selectedOwner) return false;

    if (selectedImportDate !== 'ALL') {
      if (selectedImportDate === 'NONE') {
        if (c.importedAt) return false;
      } else {
        if (!c.importedAt) return false;
        const d = new Date(c.importedAt);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (key !== selectedImportDate) return false;
      }
    }

    // Trạng thái quét TCM — cùng tiêu chí đủ điều kiện với 2 hàng đợi "Tìm cid" / "Cào chi
    // tiết" phía trên (creatorsMissingTcmCid / creatorsMissingTcmDetail) để filter luôn khớp
    // với những gì 2 nút đó sẽ thực sự xử lý.
    if (tcmScrapeFilter === 'NO_CID' && c.tcmCreatorOecuid) return false;
    if (tcmScrapeFilter === 'HAS_CID_NO_DETAIL' && !(c.tcmCreatorOecuid && !c.collabMetrics)) return false;
    if (tcmScrapeFilter === 'HAS_DETAIL' && !(c.tcmCreatorOecuid && !!c.collabMetrics)) return false;
    if (tcmScrapeFilter === 'NOT_FOUND' && !(!c.tcmCreatorOecuid && c.tcmNotFoundAt)) return false;
    if (tcmScrapeFilter === 'MISSING_AVATAR' && !(c.tcmCreatorOecuid && !c.avatar)) return false;

    if (minEr !== '' && (c.engagementRate === undefined || c.engagementRate < Number(minEr))) return false;
    if (maxEr !== '' && (c.engagementRate === undefined || c.engagementRate > Number(maxEr))) return false;

    if (minAvgViews !== '' && (c.avgViews === undefined || c.avgViews < Number(minAvgViews))) return false;
    if (maxAvgViews !== '' && (c.avgViews === undefined || c.avgViews > Number(maxAvgViews))) return false;

    if (minFollowers !== '' && (c.followers === undefined || c.followers < Number(minFollowers))) return false;
    if (maxFollowers !== '' && (c.followers === undefined || c.followers > Number(maxFollowers))) return false;

    if (minGmv !== '' && (c.gmv30d === undefined || c.gmv30d < Number(minGmv))) return false;
    if (maxGmv !== '' && (c.gmv30d === undefined || c.gmv30d > Number(maxGmv))) return false;

    if (minBeautyRatio !== '' && (c.beautyCategoryRatio === undefined || c.beautyCategoryRatio < Number(minBeautyRatio))) return false;
    if (maxBeautyRatio !== '' && (c.beautyCategoryRatio === undefined || c.beautyCategoryRatio > Number(maxBeautyRatio))) return false;

    return true;
  }), [
    sourceCreators,
    search,
    selectedStatus,
    selectedCountry,
    selectedCategory,
    selectedOwner,
    selectedImportDate,
    tcmScrapeFilter,
    minEr,
    maxEr,
    minAvgViews,
    maxAvgViews,
    minFollowers,
    maxFollowers,
    minGmv,
    maxGmv,
    minBeautyRatio,
    maxBeautyRatio,
  ]);

  // Brands/Campaigns không phải field trực tiếp trên Creator — đếm từ assignments, cùng cách
  // tính với cột hiển thị bên dưới, để sort theo đúng số lượng đang thấy trên bảng.
  const getBrandCount = (cr: Creator) =>
    new Set(assignments.filter(a => a.creatorId === cr.id).map(a => a.workspaceId).filter(Boolean)).size;
  const getCampaignCount = (cr: Creator) => assignments.filter(a => a.creatorId === cr.id).length;

  const sortedCreators = useMemo(
    () =>
      !sortKey
        ? filteredCreators
        : [...filteredCreators].sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
              case 'creator':
                cmp = a.displayName.localeCompare(b.displayName);
                break;
              case 'category':
                cmp = (a.category || '').localeCompare(b.category || '');
                break;
              case 'email':
                cmp = (a.email || '').localeCompare(b.email || '');
                break;
              case 'followers':
                cmp = (a.followers ?? -1) - (b.followers ?? -1);
                break;
              case 'avgViews':
                cmp = (a.avgViews ?? -1) - (b.avgViews ?? -1);
                break;
              case 'er':
                cmp = (a.engagementRate ?? -1) - (b.engagementRate ?? -1);
                break;
              case 'gmv':
                cmp = (a.gmv30d ?? -1) - (b.gmv30d ?? -1);
                break;
              case 'brands':
                cmp = getBrandCount(a) - getBrandCount(b);
                break;
              case 'campaigns':
                cmp = getCampaignCount(a) - getCampaignCount(b);
                break;
              case 'status':
                cmp = a.status.localeCompare(b.status);
                break;
            }
            return sortDir === 'asc' ? cmp : -cmp;
          }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredCreators, sortKey, sortDir, assignments]
  );

  // Drop selections that fell out of view (e.g. filter changed) so bulk actions
  // never silently apply to creators no longer visible in the table.
  useEffect(() => {
    setSelectedIds(prev => {
      const visibleIds = new Set(sortedCreators.map(c => c.id));
      const next = prev.filter(id => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedCreators]);

  // Search/filter changes reshuffle the result set — always land back on page 1
  // so the user isn't stranded on a page that no longer has any rows.
  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    selectedStatus,
    selectedCountry,
    selectedCategory,
    selectedOwner,
    selectedImportDate,
    sortKey,
    sortDir,
    tcmScrapeFilter,
    minEr,
    maxEr,
    minAvgViews,
    maxAvgViews,
    minFollowers,
    maxFollowers,
    minGmv,
    maxGmv,
    minBeautyRatio,
    maxBeautyRatio
  ]);

  const totalPages = Math.max(1, Math.ceil(sortedCreators.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const paginatedCreators = sortedCreators.slice(pageStart, pageStart + PAGE_SIZE);

  // Select-all only applies to the rows currently on screen (this page of the
  // filtered/paginated set), not every creator matching the filter across all pages.
  const toggleSelectAll = () => {
    const visibleIds = paginatedCreators.map(c => c.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedIds.includes(id));
    if (allVisibleSelected) {
      setSelectedIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const formatNumber = (num?: number | null) => {
    if (num === undefined || num === null || isNaN(num)) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
  };

  // Nhãn nguồn dữ liệu metrics (Kalodata/TCM/Cruva/Manual) — badge nhỏ kèm tooltip ngày
  // import/cào, để phân biệt creator nào tới từ platform nào (xem Creator.metricsSource trong
  // src/types.ts). Không hiển thị gì nếu chưa có metricsSource (creator cũ trước khi có field này).
  const METRICS_SOURCE_META: Record<string, { label: string; className: string }> = {
    kalodata: { label: 'KD', className: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300' },
    tcm: { label: 'TCM', className: 'bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300' },
    cruva: { label: 'CV', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300' },
    tiktokOne: { label: 'TTO', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300' },
    manual: { label: 'MAN', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' }
  };

  const renderSourceBadge = (cr: Creator) => {
    if (!cr.metricsSource) return null;
    const meta = METRICS_SOURCE_META[cr.metricsSource];
    if (!meta) return null;
    const fullLabel = cr.metricsSource === 'kalodata' ? 'Kalodata' : cr.metricsSource === 'tcm' ? 'TCM' : cr.metricsSource === 'cruva' ? 'Cruva' : cr.metricsSource === 'tiktokOne' ? 'TikTok One' : 'Manual';
    const tooltipParts = [`Nguồn: ${fullLabel}`];
    if (cr.importedAt) tooltipParts.push(`Import: ${new Date(cr.importedAt).toLocaleDateString()}`);
    if (cr.metricsSyncedAt) tooltipParts.push(`Cào: ${new Date(cr.metricsSyncedAt).toLocaleDateString()}`);
    return (
      <span
        className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold leading-none ${meta.className}`}
        title={tooltipParts.join(' • ')}
      >
        {meta.label}
      </span>
    );
  };

  // Nhãn cảnh báo "không tìm thấy trên TCM" — chỉ hiện khi vẫn chưa có tcmCreatorOecuid (nếu đã
  // tìm thấy ở lượt sau, batch-import xoá tcmNotFoundAt, xem server.ts).
  const renderTcmNotFoundBadge = (cr: Creator) => {
    if (cr.tcmCreatorOecuid || !cr.tcmNotFoundAt) return null;
    return (
      <span
        title={`Lần tìm gần nhất (${new Date(cr.tcmNotFoundAt).toLocaleDateString()}) không khớp handle này trên TCM.`}
        className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold leading-none flex items-center gap-0.5 bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
      >
        <AlertTriangle className="w-2.5 h-2.5" />
        Không thấy trên TCM
      </span>
    );
  };

  // Tiêu đề cột bấm được để sort — dùng chung cho mọi cột sortable trong bảng, tự hiện mũi tên
  // theo hướng đang sort, còn lại mờ đi để gợi ý "bấm để sort" mà không làm rối header.
  const renderSortableTh = (label: string, key: SortKey, className: string) => {
    const active = sortKey === key;
    return (
      <th className={className}>
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={`inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200 transition-colors ${
            active ? 'text-indigo-600 dark:text-indigo-400' : ''
          }`}
        >
          <span>{label}</span>
          {active ? (
            sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3 opacity-25" />
          )}
        </button>
      </th>
    );
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Workspace Banner */}
      {activeWorkspace && (
        <WorkspaceBanner
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={onSelectWorkspace || (() => {})}
          onOpenSettings={onOpenSettings}
          activeCreatorCount={creators.length}
          activeCampaignCount={campaigns.length}
        />
      )}

      {/* Top Header & Scope Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              Creator CRM Database
            </h1>
          </div>

          <p className="text-xs text-slate-500">
            {`Showing creators affiliated with ${activeWorkspace?.name || 'this workspace'}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <TcmActionsMenu
            triggerLabel="TCM Tools"
            triggerClassName="px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            findCidCount={creatorsMissingTcmCid.length}
            onFindCid={() => handleFindTcmCid(creatorsMissingTcmCid)}
            scrapeDetailCount={creatorsMissingTcmDetail.length}
            onScrapeDetail={() => handleAutoScrapeDetail(creatorsMissingTcmDetail)}
            missingAvatarCount={creatorsMissingAvatar.length}
            onScrapeMissingAvatar={() => handleAutoScrapeDetail(creatorsMissingAvatar)}
            onConfigureExtension={handleConfigureExtensionId}
            extensionId={extensionId}
          />
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              title="Tải lại danh sách creator"
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          )}
          <button
            onClick={onOpenImport}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            Import Creator
          </button>
        </div>
      </div>

      {/* Trạng thái các hàng đợi TCM đang chạy nền (extension) — gộp chung 1 khối, mỗi hàng đợi
          1 dòng, để không dồn nhiều box rời rạc khi cả 2 job cùng chạy. */}
      {((queueState?.queue?.length || 0) > 0 || (searchCidState?.queue?.length || 0) > 0) && (
        <div className="p-3 rounded-2xl bg-slate-900 dark:bg-slate-800 text-white text-xs space-y-2">
          {(searchCidState?.queue?.length || 0) > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Search className="w-4 h-4 shrink-0" />
                {searchCidState?.status === 'running' ? (
                  <>
                    🔎 Đang tìm cid: {searchCidState.processedCount || 0}/{searchCidState.totalCount || searchCidState.queue?.length} xong
                    ({searchCidState.failedCount || 0} lỗi)
                    {searchCidState.currentHandle ? ` — đang tra @${searchCidState.currentHandle}` : ''}
                  </>
                ) : (
                  <>
                    {searchCidState?.status === 'stopped' ? '⏹ Đã dừng tìm cid' : '✅ Tìm cid hoàn tất'}:{' '}
                    {searchCidState?.processedCount || 0}/{searchCidState?.totalCount || searchCidState?.queue?.length} xong (
                    {searchCidState?.failedCount || 0} lỗi)
                  </>
                )}
              </span>
              {searchCidState?.status === 'running' && (
                <button
                  onClick={handleStopSearchCidQueue}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg font-semibold shrink-0"
                >
                  Dừng
                </button>
              )}
            </div>
          )}
          {(searchCidState?.failedCount || 0) > 0 && (
            <div className="pl-6 text-[11px] text-white/60 space-y-0.5">
              {(searchCidState?.results || [])
                .filter(r => !r.ok)
                .slice(-3)
                .map((r, i) => (
                  <div key={i}>
                    @{r.handle}: {r.message || 'Lỗi không rõ nguyên nhân'}
                  </div>
                ))}
            </div>
          )}
          {(queueState?.queue?.length || 0) > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4 shrink-0" />
                {queueState?.status === 'running' ? (
                  <>
                    🤖 Đang cào chi tiết: {queueState.processedCount || 0}/{queueState.totalCount || queueState.queue?.length} xong
                    ({queueState.failedCount || 0} lỗi)
                    {queueState.currentHandle ? ` — đang mở @${queueState.currentHandle}` : ''}
                  </>
                ) : (
                  <>
                    {queueState?.status === 'stopped' ? '⏹ Đã dừng' : '✅ Cào chi tiết hoàn tất'}: {queueState?.processedCount || 0}/
                    {queueState?.totalCount || queueState?.queue?.length} xong ({queueState?.failedCount || 0} lỗi)
                    {(queueState?.pending?.length || 0) > 0 ? ` — còn ${queueState?.pending?.length} chờ đợt kế` : ''}
                  </>
                )}
              </span>
              {queueState?.status === 'running' && (
                <button
                  onClick={handleStopQueue}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg font-semibold shrink-0"
                >
                  Dừng
                </button>
              )}
            </div>
          )}
          {(queueState?.failedCount || 0) > 0 && (
            <div className="pl-6 text-[11px] text-white/60 space-y-0.5">
              {(queueState?.results || [])
                .filter(r => !r.ok)
                .slice(-3)
                .map((r, i) => (
                  <div key={i}>
                    @{r.handle}: {r.message || 'Lỗi không rõ nguyên nhân'}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
      {(queueError || searchCidError) && (
        <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs space-y-1.5">
          {searchCidError && (
            <div className="flex items-center justify-between gap-3">
              <span>⚠️ {searchCidError}</span>
              <button onClick={() => setSearchCidError(null)} className="font-bold shrink-0">✕</button>
            </div>
          )}
          {queueError && (
            <div className="flex items-center justify-between gap-3">
              <span>⚠️ {queueError}</span>
              <button onClick={() => setQueueError(null)} className="font-bold shrink-0">✕</button>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by creator name, @handle, niche or email..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filters Selectors */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 text-xs">
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="ALL">Status: All</option>
              <option value="New Lead">New Lead</option>
              <option value="Researching">Researching</option>
              <option value="Qualified">Qualified</option>
              <option value="Contact lần 1">Contact lần 1</option>
              <option value="Contact lần 2">Contact lần 2</option>
              <option value="Contact lần 3">Contact lần 3</option>
              <option value="Negotiating">Negotiating</option>
              <option value="Rejected">Rejected</option>
              <option value="Approved">Approved</option>
              <option value="Draft Submitted">Draft Submitted</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived (đã từ chối)</option>
            </select>

            <select
              value={selectedCountry}
              onChange={e => setSelectedCountry(e.target.value)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="ALL">Country: All</option>
              <option value="Vietnam">Vietnam 🇻🇳</option>
              <option value="United States">United States 🇺🇸</option>
            </select>

            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
            >
              <option value="ALL">Category: All</option>
              {availableCategories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={selectedImportDate}
              onChange={e => setSelectedImportDate(e.target.value)}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
              title="Lọc theo ngày import — cô lập đợt vừa import để duyệt giữ/xóa trước khi cào"
            >
              <option value="ALL">Đợt import: Tất cả</option>
              {availableImportDates.map(([key, count]) => (
                <option key={key} value={key}>{`${formatImportDateLabel(key)} (${count})`}</option>
              ))}
              {creatorsWithoutImportDate > 0 && (
                <option value="NONE">{`Chưa rõ ngày import (${creatorsWithoutImportDate})`}</option>
              )}
            </select>

            {sortKey && (
              <button
                onClick={() => setSortKey(null)}
                className="p-2 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1 shrink-0"
                title="Bỏ sort, quay về thứ tự mặc định"
              >
                <X className="w-3.5 h-3.5" />
                Bỏ sort
              </button>
            )}

            <button
              onClick={() => setShowAdvancedFilters(o => !o)}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                advancedFilterCount > 0
                  ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Bộ lọc {advancedFilterCount > 0 ? `(${advancedFilterCount})` : ''}
              {showAdvancedFilters ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Advanced Filters — range theo chỉ số sourcing + trạng thái quét TCM */}
        {showAdvancedFilters && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Lọc theo chỉ số & trạng thái quét TCM</span>
              {advancedFilterCount > 0 && (
                <button
                  onClick={clearAdvancedFilters}
                  className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Xóa bộ lọc
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-end gap-4">
              {/* Trạng thái quét TCM — khớp đúng 2 chức năng quét data (tìm cid / cào chi tiết) */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Trạng thái quét TCM</label>
                <select
                  value={tcmScrapeFilter}
                  onChange={e => setTcmScrapeFilter(e.target.value as typeof tcmScrapeFilter)}
                  className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium text-xs"
                >
                  <option value="ALL">Tất cả</option>
                  <option value="NO_CID">Chưa có cid TCM</option>
                  <option value="HAS_CID_NO_DETAIL">Có cid, chưa cào chi tiết</option>
                  <option value="HAS_DETAIL">Đã cào chi tiết TCM</option>
                  <option value="NOT_FOUND">Không tìm thấy trên TCM</option>
                  <option value="MISSING_AVATAR">Thiếu avatar</option>
                </select>
              </div>

              {/* Engagement Rate */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">ER %</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={minEr}
                    onChange={e => setMinEr(e.target.value)}
                    placeholder="Min"
                    className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min={0}
                    step="0.1"
                    value={maxEr}
                    onChange={e => setMaxEr(e.target.value)}
                    placeholder="Max"
                    className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Avg Views */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Avg Views</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={minAvgViews}
                    onChange={e => setMinAvgViews(e.target.value)}
                    placeholder="Min"
                    className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min={0}
                    value={maxAvgViews}
                    onChange={e => setMaxAvgViews(e.target.value)}
                    placeholder="Max"
                    className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Followers */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">Followers</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={minFollowers}
                    onChange={e => setMinFollowers(e.target.value)}
                    placeholder="Min"
                    className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min={0}
                    value={maxFollowers}
                    onChange={e => setMaxFollowers(e.target.value)}
                    placeholder="Max"
                    className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* GMV 30d */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">GMV (30d)</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    value={minGmv}
                    onChange={e => setMinGmv(e.target.value)}
                    placeholder="Min"
                    className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min={0}
                    value={maxGmv}
                    onChange={e => setMaxGmv(e.target.value)}
                    placeholder="Max"
                    className="w-24 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Beauty Category Ratio */}
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-semibold text-slate-500 uppercase">% Beauty</label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={minBeautyRatio}
                    onChange={e => setMinBeautyRatio(e.target.value)}
                    placeholder="Min"
                    className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                  <span className="text-slate-400">–</span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={maxBeautyRatio}
                    onChange={e => setMaxBeautyRatio(e.target.value)}
                    placeholder="Max"
                    className="w-20 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Action Strip */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in duration-150">
            <span className="font-semibold">
              {selectedIds.length} creators selected
            </span>
            <div className="flex items-center gap-2">
              {onOpenBulkOutreach && (
                <button
                  onClick={() => onOpenBulkOutreach(selectedIds)}
                  className="px-2.5 py-1 bg-indigo-600 text-white font-semibold rounded-lg flex items-center gap-1 hover:bg-indigo-700"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gửi Hàng Loạt
                </button>
              )}

              <div className="flex items-center gap-1">
                <select
                  value={bulkCampaignId}
                  onChange={e => setBulkCampaignId(e.target.value)}
                  className="text-xs p-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 text-indigo-900 dark:text-indigo-200"
                >
                  <option value="">Chọn campaign...</option>
                  {campaigns.map(cmp => (
                    <option key={cmp.id} value={cmp.id}>{cmp.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    if (!bulkCampaignId) return;
                    const assignedCreatorIds = new Set(
                      assignments.filter(a => a.campaignId === bulkCampaignId).map(a => a.creatorId)
                    );
                    selectedIds
                      .filter(id => !assignedCreatorIds.has(id))
                      .forEach(id => onAssignCampaign(id, bulkCampaignId));
                    setBulkCampaignId('');
                  }}
                  disabled={!bulkCampaignId}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg flex items-center gap-1 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Layers className="w-3.5 h-3.5" />
                  Gán Campaign
                </button>
              </div>

              <button
                onClick={() => {
                  selectedIds.forEach(id => {
                    const cr = sourceCreators.find(c => c.id === id);
                    if (cr) onRunAiScore(cr);
                  });
                }}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg flex items-center gap-1 hover:bg-indigo-100"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Bulk AI Score
              </button>

              {(() => {
                const selectedCreators = selectedIds
                  .map(id => sourceCreators.find(c => c.id === id))
                  .filter((c): c is Creator => !!c);
                return (
                  <TcmActionsMenu
                    triggerLabel="TCM"
                    triggerClassName="px-2.5 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 font-semibold rounded-lg flex items-center gap-1 hover:bg-indigo-100"
                    findCidCount={selectedCreators.filter(c => !c.tcmCreatorOecuid).length}
                    onFindCid={() => handleFindTcmCid(selectedCreators)}
                    scrapeDetailCount={selectedCreators.filter(c => !!c.tcmCreatorOecuid && !c.collabMetrics).length}
                    onScrapeDetail={() => handleAutoScrapeDetail(selectedCreators)}
                    missingAvatarCount={selectedCreators.filter(c => !!c.tcmCreatorOecuid && !c.avatar).length}
                    onScrapeMissingAvatar={() => handleAutoScrapeDetail(selectedCreators.filter(c => !!c.tcmCreatorOecuid && !c.avatar))}
                  />
                );
              })()}

              <button
                onClick={() => {
                  selectedIds.forEach(id => onArchiveCreator(id));
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-semibold hover:bg-rose-100"
              >
                Archive Selected
              </button>

              {onDeleteCreatorPermanently && (
                <button
                  onClick={() => {
                    const confirmed = window.confirm(
                      `Xóa vĩnh viễn ${selectedIds.length} creator đã chọn? Hành động này không thể hoàn tác.`
                    );
                    if (!confirmed) return;
                    selectedIds.forEach(id => onDeleteCreatorPermanently(id));
                    setSelectedIds([]);
                  }}
                  className="px-2.5 py-1 bg-rose-600 text-white font-semibold rounded-lg flex items-center gap-1 hover:bg-rose-700"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa Vĩnh Viễn
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 text-slate-500 uppercase font-semibold text-[10px] tracking-wider">
                <th className="py-3 px-4 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedCreators.length > 0 && paginatedCreators.every(c => selectedIds.includes(c.id))}
                    onChange={toggleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                {renderSortableTh('Creator', 'creator', 'py-3 px-4 min-w-[180px]')}
                {renderSortableTh('Category & Niche', 'category', 'py-3 px-4 min-w-[140px]')}
                {renderSortableTh('Email', 'email', 'py-3 px-4 min-w-[160px]')}
                {renderSortableTh('Followers', 'followers', 'py-3 px-4 text-right whitespace-nowrap')}
                {renderSortableTh('Avg Views', 'avgViews', 'py-3 px-4 text-right whitespace-nowrap')}
                {renderSortableTh('ER %', 'er', 'py-3 px-4 text-center whitespace-nowrap')}
                {renderSortableTh('GMV (30d)', 'gmv', 'py-3 px-4 text-right whitespace-nowrap')}
                {renderSortableTh('Brands', 'brands', 'py-3 px-4 min-w-[110px]')}
                {renderSortableTh('Campaigns', 'campaigns', 'py-3 px-4 min-w-[200px]')}
                {renderSortableTh('Status', 'status', 'py-3 px-4 whitespace-nowrap')}
                <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {sortedCreators.length === 0 ? (
                <tr>
                  <td colSpan={13} className="text-center py-12 text-slate-400">
                    No creators found matching current criteria.
                  </td>
                </tr>
              ) : (
                paginatedCreators.map(cr => {
                  const isSelected = selectedIds.includes(cr.id);

                  return (
                    <tr
                      key={cr.id}
                      className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-50/30 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(cr.id)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>

                      {/* Profile Column */}
                      <td className="py-3.5 px-4">
                        <div
                          className="flex items-center gap-3 cursor-pointer group"
                          onClick={() => onSelectCreator(cr)}
                        >
                          <img
                            src={cr.avatar}
                            alt={cr.displayName}
                            className="w-9 h-9 rounded-full object-cover shrink-0 ring-2 ring-slate-100 dark:ring-slate-800 group-hover:ring-indigo-500 transition-all"
                          />
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {cr.displayName}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                              @{cr.handle} • {cr.country}
                              {renderSourceBadge(cr)}
                              {renderTcmNotFoundBadge(cr)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category — 1 dòng duy nhất, niche rút gọn kèm tooltip đầy đủ thay vì
                          badge xuống dòng, để chiều cao hàng không phụ thuộc số lượng niche */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {cr.category || <span className="text-slate-400 italic font-normal">—</span>}
                          </span>
                          {(cr.niche || []).length > 0 && (
                            <span
                              className="text-[10px] text-slate-400 truncate"
                              title={(cr.niche || []).join(', ')}
                            >
                              {(cr.niche || []).join(' · ')}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="py-3.5 px-4 max-w-[180px]">
                        {cr.email ? (
                          <a
                            href={`mailto:${cr.email}`}
                            onClick={e => e.stopPropagation()}
                            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline truncate block"
                            title={cr.email}
                          >
                            {cr.email}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-400 italic">—</span>
                        )}
                      </td>

                      {/* Followers */}
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        {formatNumber(cr.followers)}
                      </td>

                      {/* Avg Views */}
                      <td className="py-3.5 px-4 text-right font-medium text-slate-700 dark:text-slate-300">
                        {formatNumber(cr.avgViews)}
                      </td>

                      {/* ER % */}
                      <td className="py-3.5 px-4 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {cr.engagementRate !== undefined ? `${cr.engagementRate}%` : '—'}
                      </td>

                      {/* GMV (30d) */}
                      <td className="py-3.5 px-4 text-right font-semibold text-slate-900 dark:text-white">
                        {cr.gmv30d !== undefined ? `$${formatNumber(cr.gmv30d)}` : '—'}
                      </td>

                      {/* Brands — suy ra tự động từ các campaign creator này đang chạy, không còn
                          gán thủ công 1 brand duy nhất (1 creator có thể chạy nhiều brand cùng lúc) */}
                      <td className="py-3.5 px-4 max-w-[110px]">
                        {(() => {
                          const brandIds = Array.from(
                            new Set(assignments.filter(a => a.creatorId === cr.id).map(a => a.workspaceId).filter(Boolean))
                          ) as string[];
                          const brandWs = brandIds.map(id => workspaces.find(w => w.id === id)).filter(Boolean) as Workspace[];
                          return brandWs.length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">—</span>
                          ) : (
                            <div
                              className="flex flex-nowrap gap-1 overflow-hidden"
                              title={brandWs.map(ws => ws.code).join(', ')}
                            >
                              {brandWs.slice(0, 2).map(ws => (
                                <span
                                  key={ws.id}
                                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0"
                                >
                                  {ws.code}
                                </span>
                              ))}
                              {brandWs.length > 2 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-500 shrink-0">
                                  +{brandWs.length - 2}
                                </span>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Campaign(s) — 1 creator có thể chạy nhiều campaign cùng lúc. Chip xếp
                          1 dòng duy nhất (wrap tối đa 2 dòng thay vì n dòng không giới hạn), nút
                          gán campaign mới chuyển sang popover (AssignCampaignMenu) để không còn
                          <select> luôn chiếm chỗ trong ô. */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        {(() => {
                          const crAssignments = assignments.filter(a => a.creatorId === cr.id);
                          const assignedCampaignIds = new Set(crAssignments.map(a => a.campaignId));
                          const availableCampaigns = campaigns.filter(cmp => !assignedCampaignIds.has(cmp.id));

                          return (
                            <div className="flex flex-wrap items-center gap-1 max-h-[3.25rem] overflow-hidden">
                              {crAssignments.map(a => (
                                <span
                                  key={a.id}
                                  className="max-w-[110px] px-2 py-1 text-[11px] font-semibold rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center gap-1"
                                  title={a.campaignName}
                                >
                                  <span className="truncate">{a.campaignName}</span>
                                  {onUnassignCampaign && (
                                    <button
                                      onClick={() => onUnassignCampaign(a.id)}
                                      className="text-purple-400 hover:text-rose-600 shrink-0"
                                      title="Gỡ khỏi campaign này"
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              ))}
                              <AssignCampaignMenu
                                availableCampaigns={availableCampaigns}
                                onAssign={cmpId => onAssignCampaign(cr.id, cmpId)}
                              />
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {(() => {
                          const badgeClass = cr.status === 'Approved' || cr.status === 'Completed'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : cr.status === 'Draft Submitted' || cr.status === 'Negotiating'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : cr.status === 'Rejected'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : cr.status === 'Contact lần 1' || cr.status === 'Contact lần 2' || cr.status === 'Contact lần 3'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300';

                          if (!onUpdateStatus) {
                            return (
                              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-full border whitespace-nowrap ${badgeClass}`}>
                                {cr.status}
                              </span>
                            );
                          }

                          return (
                            <select
                              value={cr.status}
                              onClick={e => e.stopPropagation()}
                              onChange={e => onUpdateStatus(cr.id, e.target.value as CreatorStatus)}
                              className={`px-2.5 py-1 text-[11px] font-bold rounded-full border whitespace-nowrap cursor-pointer ${badgeClass}`}
                            >
                              {ALL_CREATOR_STATUSES.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          );
                        })()}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => onOpenEmailComposer(cr)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Generate Outreach Email"
                          >
                            <Mail className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onSelectCreator(cr)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="View Creator Detail"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => onArchiveCreator(cr.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            title="Archive Creator"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer & Pagination */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-xs text-slate-500">
          <span>
            {sortedCreators.length === 0
              ? 'Showing 0 of 0 creators'
              : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, sortedCreators.length)} of ${sortedCreators.length} creators`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="p-1 border border-slate-200 dark:border-slate-800 rounded disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800 dark:text-slate-200">
              {safePage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="p-1 border border-slate-200 dark:border-slate-800 rounded disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
