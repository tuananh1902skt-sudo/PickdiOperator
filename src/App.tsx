import React, { useState, useEffect } from 'react';
import { Sidebar, ActiveTab } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { AiDrawer } from './components/layout/AiDrawer';
import { NotificationDrawer } from './components/layout/NotificationDrawer';
import { CommandPalette } from './components/layout/CommandPalette';

import { DashboardView } from './components/dashboard/DashboardView';
import { CreatorListView } from './components/creators/CreatorListView';
import { CreatorDetailDrawer } from './components/creators/CreatorDetailDrawer';
import { QuickAddCreatorModal } from './components/creators/QuickAddCreatorModal';
import { ImportWizardModal } from './components/creators/ImportWizardModal';

import { OutreachView } from './components/outreach/OutreachView';
import { EmailComposerModal } from './components/outreach/EmailComposerModal';
import { BulkOutreachModal } from './components/outreach/BulkOutreachModal';
import { InboxView } from './components/inbox/InboxView';

import { CampaignsView } from './components/campaigns/CampaignsView';
import { CreateCampaignModal } from './components/campaigns/CreateCampaignModal';

import { PostedVideoModal, PostedVideoFormData } from './components/reviews/PostedVideoModal';

import { ExportView } from './components/export/ExportView';
import { SettingsView } from './components/settings/SettingsView';

import {
  Creator,
  CreatorStatus,
  Campaign,
  OutreachEmail,
  Conversation,
  DraftReview,
  Task,
  NotificationItem,
  DashboardKPIs,
  ActivityItem,
  Workspace,
  CreatorCampaignAssignment,
  PostedVideo
} from './types';

import {
  INITIAL_WORKSPACES,
  INITIAL_CREATORS,
  INITIAL_CAMPAIGNS,
  INITIAL_OUTREACH,
  INITIAL_CONVERSATIONS,
  INITIAL_REVIEWS,
  INITIAL_TASKS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITIES
} from './data/initialData';

// Đồng bộ activeTab với URL (pathname) để reload/back-forward/bookmark giữ đúng trang thay
// vì luôn rơi về Dashboard — mỗi tab ứng với 1 path riêng, path lạ/không khớp mặc định về
// Dashboard.
const TAB_PATHS: Record<ActiveTab, string> = {
  dashboard: '/dashboard',
  creators: '/creators',
  outreach: '/outreach',
  inbox: '/inbox',
  campaigns: '/campaigns',
  export: '/export',
  notifications: '/notifications',
  settings: '/settings'
};
const PATH_TO_TAB: Record<string, ActiveTab> = Object.fromEntries(
  Object.entries(TAB_PATHS).map(([tab, path]) => [path, tab as ActiveTab])
) as Record<string, ActiveTab>;

// 1 lớp sâu hơn cho 2 chi tiết hay mở nhất — /creators/:id, /campaigns/:id/edit — parse trực
// tiếp từ pathname thay vì tra bảng cố định như trên.
type RouteParams = { creatorId?: string; campaignEditId?: string };
type ParsedRoute = { tab: ActiveTab } & RouteParams;

const parseRoute = (pathname: string): ParsedRoute => {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] === 'creators' && parts[1]) return { tab: 'creators', creatorId: parts[1] };
  if (parts[0] === 'campaigns' && parts[1] && parts[2] === 'edit') return { tab: 'campaigns', campaignEditId: parts[1] };
  return { tab: PATH_TO_TAB['/' + (parts[0] || 'dashboard')] || 'dashboard' };
};

export function App() {
  const initialRoute = parseRoute(window.location.pathname);
  const [activeTab, setActiveTabState] = useState<ActiveTab>(initialRoute.tab);
  // Id lấy từ URL lúc mount/back-forward nhưng CHƯA chắc đã có sẵn trong data (creators/
  // reviews/campaigns fetch bất đồng bộ) — giữ tạm ở đây, effect riêng theo từng data
  // collection sẽ resolve thành object thật + tự dọn khi data đã load xong.
  const [pendingCreatorId, setPendingCreatorId] = useState<string | null>(initialRoute.creatorId || null);
  const [pendingCampaignEditId, setPendingCampaignEditId] = useState<string | null>(initialRoute.campaignEditId || null);

  const navigateTo = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState(null, '', path);
    }
  };

  // setActiveTab đẩy path tương ứng vào history (thay vì chỉ đổi state trong bộ nhớ) để
  // F5/mở tab mới bằng đúng URL đó, hoặc bấm back/forward, đều ra đúng trang.
  const setActiveTab = (tab: ActiveTab) => {
    setActiveTabState(tab);
    navigateTo(TAB_PATHS[tab]);
  };

  useEffect(() => {
    if (window.location.pathname === '/') {
      window.history.replaceState(null, '', TAB_PATHS.dashboard);
    }
    // Back/forward không tự resolve object — chỉ đặt lại tab + id đang chờ, các effect
    // theo dõi creators/reviews/campaigns bên dưới sẽ tìm đúng object (gần như ngay lập
    // tức vì data thường đã có sẵn trong state).
    const handlePopState = () => {
      const route = parseRoute(window.location.pathname);
      setActiveTabState(route.tab);
      setSelectedCreatorDetail(null);
      setPendingCreatorId(route.creatorId || null);
      setEditingCampaign(null);
      setPendingCampaignEditId(route.campaignEditId || null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Workspaces State
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(INITIAL_WORKSPACES[0]?.id || '');

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const isAgencyWorkspace = Boolean(activeWorkspace.isAgency);

  // Core Data Collections
  const [creators, setCreators] = useState<Creator[]>(INITIAL_CREATORS);
  // Danh sách siêu nhẹ (id/handle/displayName/avatar/status/category, xem
  // /api/creators/lite) — dùng cho CommandPalette + AiDrawer, vốn chỉ cần chọn 1 creator từ
  // danh sách chứ không hiển thị bảng CRM đầy đủ như CreatorListView. Tránh 2 UI đó phải ăn
  // theo state `creators` (~40 cột, toàn bộ bảng) chỉ để render vài trăm byte mỗi dòng.
  const [creatorsLite, setCreatorsLite] = useState<Creator[]>(INITIAL_CREATORS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [outreachList, setOutreachList] = useState<OutreachEmail[]>(INITIAL_OUTREACH);
  // Fetch mặc định (/api/conversations) giờ trả bản rút gọn KHÔNG có `messages` (xem
  // getConversationsForList ở db.ts) — chỉ nạp full messages khi thực sự cần (mở tab Inbox/
  // Reports, xem effect theo dõi activeTab bên dưới) thay vì tải toàn bộ nội dung email của
  // MỌI conversation ngay lúc app mount.
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  // todayRepliesReceived giờ đọc từ bộ đếm server-side (incrementTodayReplyCounter ở db.ts)
  // thay vì reduce qua conversations[].messages — không còn cần load full messages chỉ để ra 1
  // con số KPI.
  const [todayRepliesReceived, setTodayRepliesReceived] = useState(0);
  const [reviews, setReviews] = useState<DraftReview[]>(INITIAL_REVIEWS);
  const [postedVideos, setPostedVideos] = useState<PostedVideo[]>([]);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);
  // Quan hệ nhiều-nhiều Creator ↔ Campaign — nguồn sự thật cho việc creator nào đang chạy
  // campaign nào ở brand nào (xem CreatorCampaignAssignment ở types.ts).
  const [assignments, setAssignments] = useState<CreatorCampaignAssignment[]>([]);

  // Filter Data according to active workspace
  const inActiveWorkspace = (workspaceId?: string) =>
    isAgencyWorkspace || !workspaceId || workspaceId === activeWorkspaceId;

  // Creator "thuộc" 1 brand/workspace khi có ít nhất 1 campaign assignment ở workspace đó —
  // KHÔNG dùng creator.workspaceId để quyết định điều này nữa một khi creator đã có assignment
  // (field đó giờ chỉ là "home workspace" lúc tạo lead). Ở workspace Agency thấy toàn bộ; ở
  // 1 brand cụ thể, creator chưa từng làm campaign với brand đó sẽ ẩn hoàn toàn — đúng ranh
  // giới dữ liệu giữa các brand/client.
  // Ngoại lệ: creator MỚI import/tạo, chưa từng được gán vào campaign nào ở đâu cả — nếu vẫn
  // đòi hỏi có assignment thì creator sẽ biến mất khỏi mọi workspace không phải Agency ngay
  // sau khi import (Import Wizard/scraper chỉ tạo Creator, không tự tạo assignment). Với nhóm
  // này, tạm dùng creator.workspaceId (home workspace lúc tạo) làm nơi hiển thị mặc định.
  const creatorBelongsToActiveWorkspace = (creatorId: string) => {
    if (isAgencyWorkspace) return true;
    const creatorAssignments = assignments.filter(a => a.creatorId === creatorId);
    if (creatorAssignments.length > 0) {
      return creatorAssignments.some(a => a.workspaceId === activeWorkspaceId);
    }
    const creator = creators.find(c => c.id === creatorId);
    return !creator?.workspaceId || creator.workspaceId === activeWorkspaceId;
  };

  // Trạng thái hiển thị của creator trong workspace đang mở PHẢI lấy từ assignment riêng
  // của workspace đó (nếu có) — không phải Creator.status chung — vì cùng 1 creator có thể
  // đang "Contact lần 1/2/3" ở brand A nhưng chưa từng liên hệ ở brand B. Outreach send giờ chỉ
  // ghi "Contact lần N" vào assignment.status, không còn ghi vào Creator.status nữa — nên ở
  // workspace Agency (xem toàn bộ creator nhiều brand cùng lúc) cũng phải lấy từ assignment mới
  // nhất trên tất cả brand, nếu không status sẽ đứng yên ở "New Lead" và creator "biến mất" khỏi
  // filter dù đã contact thật.
  const resolveWorkspaceStatus = (creator: Creator): Creator => {
    const scoped = assignments.filter(a =>
      a.creatorId === creator.id && (isAgencyWorkspace || a.workspaceId === activeWorkspaceId)
    );
    if (scoped.length === 0) return creator;
    const latest = [...scoped].sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())[0];
    return creator.status === latest.status ? creator : { ...creator, status: latest.status };
  };

  const workspaceCreators = creators
    .filter(c => creatorBelongsToActiveWorkspace(c.id))
    .map(resolveWorkspaceStatus);
  const workspaceCreatorsLite = creatorsLite
    .filter(c => creatorBelongsToActiveWorkspace(c.id))
    .map(resolveWorkspaceStatus);
  const workspaceCampaigns = campaigns.filter(cmp => inActiveWorkspace(cmp.workspaceId));
  const workspaceOutreach = outreachList.filter(o => inActiveWorkspace(o.workspaceId));
  const workspaceConversations = conversations.filter(c => inActiveWorkspace(c.workspaceId));
  const workspaceReviews = reviews.filter(r => inActiveWorkspace(r.workspaceId));
  const workspacePostedVideos = postedVideos.filter(v => inActiveWorkspace(v.workspaceId));
  const workspaceAssignments = assignments.filter(a => inActiveWorkspace(a.workspaceId));
  const workspaceTasks = tasks.filter(t => inActiveWorkspace(t.workspaceId));
  const workspaceNotifications = notifications.filter(n => inActiveWorkspace(n.workspaceId));

  // Modals & Drawers state
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  // Selected Detail states
  const [selectedCreatorForEmail, setSelectedCreatorForEmail] = useState<Creator | null>(null);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [bulkOutreachConfig, setBulkOutreachConfig] = useState<{
    creatorIds: string[];
    defaultCampaignId?: string;
    defaultSequenceStage?: 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3';
  } | null>(null);
  const [selectedCreatorDetail, setSelectedCreatorDetail] = useState<Creator | null>(null);
  const [preselectCampaignId, setPreselectCampaignId] = useState<string | null>(null);
  const [reviewForPostedVideo, setReviewForPostedVideo] = useState<DraftReview | null>(null);

  // /api/creators (state `creators`) chỉ trả cột nhẹ cho bảng danh sách — bio/recentVideos/
  // demographics/salesMetrics/videoMetrics/liveMetrics/notes/tags CHỈ có khi fetch riêng
  // /api/creators/:id (getCreatorById, full row).
  // Gọi hàm này mỗi khi mở CreatorDetailDrawer để nạp đủ dữ liệu cho các field đó.
  const fetchFullCreatorDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/creators/${id}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSelectedCreatorDetail(prev => (prev?.id === id ? data.data : prev));
      }
    } catch (err) {
      console.error('Failed to fetch full creator detail:', err);
    }
  };

  // Resolve id lấy từ URL (mount hoặc back/forward) thành object thật ngay khi data
  // collection tương ứng có sẵn — chạy lại mỗi khi creators/reviews/campaigns đổi vì lúc
  // mount data initial (mock) có thể chưa chứa id thật, phải chờ fetch xong mới tìm ra.
  useEffect(() => {
    if (!pendingCreatorId) return;
    const found = creators.find(c => c.id === pendingCreatorId);
    if (found) {
      setSelectedCreatorDetail(found);
      setPendingCreatorId(null);
      fetchFullCreatorDetail(found.id);
    }
  }, [pendingCreatorId, creators]);

  useEffect(() => {
    if (!pendingCampaignEditId) return;
    const found = campaigns.find(c => c.id === pendingCampaignEditId);
    if (found) {
      setEditingCampaign(found);
      setPendingCampaignEditId(null);
    }
  }, [pendingCampaignEditId, campaigns]);

  // Mở/đóng 3 drawer/modal chi tiết này luôn đi kèm đổi URL — đây là nơi duy nhất nên gọi
  // setSelectedCreatorDetail/setSelectedReviewDetail/setEditingCampaign để MỞ hay ĐÓNG;
  // các chỗ khác (đồng bộ data cho drawer đang mở) vẫn set thẳng state như cũ.
  const openCreatorDetail = (cr: Creator) => {
    setActiveTabState('creators');
    setSelectedCreatorDetail(cr);
    navigateTo(`/creators/${cr.id}`);
    // cr thường tới từ list state đã trim cột nặng (xem fetchFullCreatorDetail) — nạp lại đầy
    // đủ dữ liệu ngay khi mở, drawer hiện tạm với dữ liệu nhẹ trong lúc chờ.
    fetchFullCreatorDetail(cr.id);
  };
  const closeCreatorDetail = () => {
    setSelectedCreatorDetail(null);
    navigateTo(TAB_PATHS.creators);
  };

  const openCampaignEdit = (c: Campaign) => {
    setActiveTabState('campaigns');
    setEditingCampaign(c);
    navigateTo(`/campaigns/${c.id}/edit`);
  };
  const closeCampaignEdit = () => {
    setEditingCampaign(null);
    navigateTo(TAB_PATHS.campaigns);
  };

  // Fetch state from backend — called on mount and manually via the Refresh button
  // (no auto-poll: the extension/userscript writes creators in the background, so the
  // operator refreshes on demand after running a scrape rather than paying for a timer).
  const refreshCreators = async () => {
    try {
      const res = await fetch('/api/creators');
      if (!res.ok) {
        console.warn(`[CRM Scraper Sync] /api/creators returned status ${res.status}`);
        return;
      }
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await res.text();
        console.warn('[CRM Scraper Sync] Non-JSON response received:', text.slice(0, 100));
        return;
      }
      const data = await res.json();
      if (data && data.success && Array.isArray(data.data)) {
        setCreators(data.data);
      } else if (Array.isArray(data)) {
        setCreators(data);
      }
    } catch (err) {
      console.error('[CRM Scraper Sync] Error fetching /api/creators:', err);
    }

    try {
      const liteRes = await fetch('/api/creators/lite');
      if (liteRes.ok && liteRes.headers.get('content-type')?.includes('application/json')) {
        const liteData = await liteRes.json();
        if (liteData && Array.isArray(liteData.data)) setCreatorsLite(liteData.data);
      }
    } catch (err) {
      console.error('[CommandPalette/AiDrawer] Error refreshing /api/creators/lite:', err);
    }
  };

  const fetchTodayRepliesReceived = async () => {
    try {
      const res = await fetch('/api/kpis/today-replies');
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.success && data.data) setTodayRepliesReceived(data.data.todayRepliesReceived);
    } catch (err) {
      console.error('Error fetching today-replies KPI:', err);
    }
  };

  // Chỉ gọi khi operator thực sự mở Inbox (đọc/trả lời thread) hoặc Reports (biểu đồ replies
  // theo ngày) — 2 nơi duy nhất cần nội dung `messages` đầy đủ, xem /api/conversations/full.
  const fetchFullConversations = async () => {
    try {
      const res = await fetch('/api/conversations/full');
      if (!res.ok || !res.headers.get('content-type')?.includes('application/json')) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setConversations(data.data);
    } catch (err) {
      console.error('Error fetching full conversations:', err);
    }
  };

  // Bulk outreach sends run in the background server-side — once a batch finishes, pull
  // every record it could have touched (creators' lastContactAt, outreach history,
  // conversations, campaign assignment status) back in rather than trying to patch each
  // one in from the job's item list.
  const refreshAfterBulkOutreach = async () => {
    try {
      const [resCreators, resOutreach, resConv, resAssignments] = await Promise.all([
        fetch('/api/creators'),
        fetch('/api/outreach'),
        fetch('/api/conversations'),
        fetch('/api/assignments'),
      ]);
      if (resCreators.ok) {
        const data = await resCreators.json();
        if (data.success && Array.isArray(data.data)) setCreators(data.data);
      }
      if (resOutreach.ok) {
        const data = await resOutreach.json();
        if (data.success) setOutreachList(data.data);
      }
      if (resConv.ok) {
        const data = await resConv.json();
        if (data.success) setConversations(data.data);
      }
      if (resAssignments.ok) {
        const data = await resAssignments.json();
        if (data.success) setAssignments(data.data);
      }
    } catch (err) {
      console.error('Error refreshing after bulk outreach:', err);
    }
  };

  useEffect(() => {
    refreshCreators();

    fetch('/api/workspaces')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && Array.isArray(data.data) && data.data.length > 0) setWorkspaces(data.data); })
      .catch(err => console.error(err));

    fetch('/api/campaigns')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && data.data) setCampaigns(data.data); })
      .catch(err => console.error(err));

    fetch('/api/assignments')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && Array.isArray(data.data)) setAssignments(data.data); })
      .catch(err => console.error(err));

    fetch('/api/reviews')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && Array.isArray(data.data)) setReviews(data.data); })
      .catch(err => console.error(err));

    fetch('/api/posted-videos')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && Array.isArray(data.data)) setPostedVideos(data.data); })
      .catch(err => console.error(err));

    fetch('/api/conversations')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && Array.isArray(data.data)) setConversations(data.data); })
      .catch(err => console.error(err));

    fetchTodayRepliesReceived();

    fetch('/api/outreach')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && Array.isArray(data.data)) setOutreachList(data.data); })
      .catch(err => console.error(err));

  }, []);

  // Drawer chi tiết creator chỉ nhận `creator` như 1 snapshot lúc click — nếu để mở trong lúc
  // extension đẩy data mới lên backend (vd nút "Auto quét + Lấy chi tiết" chạy trong tab TCM
  // khác), poll 10s ở trên vẫn cập nhật `creators` nhưng KHÔNG tự thay object bên trong drawer
  // đang mở, nên user thấy backend báo cập nhật thành công mà UI vẫn hiện data cũ/trống cho
  // tới khi tự đóng-mở lại. Đồng bộ lại tham chiếu mỗi khi `creators` đổi để drawer luôn hiện
  // đúng data mới nhất mà không cần thao tác gì thêm.
  useEffect(() => {
    setSelectedCreatorDetail(prev => {
      if (!prev) return prev;
      const fresh = creators.find(c => c.id === prev.id);
      return fresh || prev;
    });
  }, [creators]);

  // conversations mặc định là bản rút gọn (không có messages) — nạp lại bản đầy đủ đúng lúc
  // operator mở Inbox (đọc/trả lời thread), thay vì tải full messages ngay từ lúc app mount dù
  // chưa chắc dùng đến.
  useEffect(() => {
    if (activeTab === 'inbox') {
      fetchFullConversations();
    }
  }, [activeTab]);

  // Dark mode class toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Keyboard shortcut for Cmd+K command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const conversionRate = workspaceCreators.length > 0
    ? Number(((workspaceCreators.filter(c => ['Approved', 'Completed'].includes(c.status)).length / workspaceCreators.length) * 100).toFixed(1))
    : 0;

  // Calculated Dashboard KPIs — all time-windowed fields are filtered against actual
  // dates (previously these counted all-time totals/status matches mislabeled as "today"/"this week").
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthStr = todayStr.slice(0, 7);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);
  const kpis: DashboardKPIs = {
    todayEmailsSent: workspaceOutreach.filter(o => o.sentAt && o.sentAt.startsWith(todayStr)).length,
    todayRepliesReceived,
    pendingReviewsCount: workspaceReviews.filter(r => r.status === 'Pending Review').length,
    overdueTasksCount: workspaceTasks.filter(t => t.status !== 'Completed' && t.dueDate < todayStr).length,
    activeCampaignsCount: workspaceCampaigns.filter(c => c.status === 'Running').length,
    creatorsAddedThisWeek: workspaceCreators.filter(c => c.createdAt && new Date(c.createdAt) >= sevenDaysAgo).length,
    conversionRate: conversionRate
  };
  const creatorsAddedToday = workspaceCreators.filter(c => c.createdAt && c.createdAt.startsWith(todayStr)).length;
  const videosPostedThisMonth = workspacePostedVideos.filter(v => v.postedAt && v.postedAt.startsWith(currentMonthStr)).length;

  // HANDLERS
  const WORKSPACE_COLOR_CYCLE: Workspace['color'][] = ['indigo', 'rose', 'emerald', 'amber'];

  // Workspace brand cụ thể (khác Agency) chỉ được tạo khi thật sự cần — ở đây là lúc tạo
  // campaign mới từ view Agency mà brand đã nhập chưa có workspace tương ứng. Không hardcode
  // sẵn danh sách brand nào (xem INITIAL_WORKSPACES) — khớp tên (không phân biệt hoa/thường)
  // với workspace đã có trước, nếu chưa có thì tạo mới.
  // So khớp brand bỏ qua hoa/thường, dấu câu (', ., -, ...) và khoảng trắng thừa — để
  // "dalba", "D'alba", "D' Alba" đều trỏ về cùng 1 workspace thay vì tạo trùng.
  const normalizeBrandKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

  const resolveOrCreateWorkspaceForBrand = (brandName: string): string => {
    const trimmed = brandName.trim();
    if (!trimmed) return activeWorkspaceId;
    const key = normalizeBrandKey(trimmed);
    const existing = workspaces.find(
      w => normalizeBrandKey(w.brandName) === key || normalizeBrandKey(w.name) === key
    );
    if (existing) return existing.id;

    const codeBase = trimmed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'BRND';
    const existingCodes = new Set(workspaces.map(w => w.code));
    let code = codeBase;
    let suffix = 2;
    while (existingCodes.has(code)) {
      code = `${codeBase}${suffix}`.slice(0, 6);
      suffix++;
    }

    const newWs: Workspace = {
      id: `ws-${Date.now()}`,
      name: trimmed,
      code,
      brandName: trimmed,
      category: 'Brand Affiliate Program',
      color: WORKSPACE_COLOR_CYCLE[workspaces.length % WORKSPACE_COLOR_CYCLE.length],
      description: `Affiliate campaign workspace tự động tạo cho ${trimmed}`,
      memberCount: 1,
      creatorCount: 0,
      activeCampaignCount: 0
    };
    setWorkspaces(prev => [...prev, newWs]);
    fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWs)
    }).catch(err => console.error('Error persisting new workspace:', err));
    return newWs.id;
  };

  const handleAddWorkspace = (newWsData: Omit<Workspace, 'id'>) => {
    const newWs: Workspace = {
      ...newWsData,
      id: `ws-${Date.now()}`
    };
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);
    fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWs)
    }).catch(err => console.error('Error persisting new workspace:', err));

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        workspaceId: newWs.id,
        title: `Workspace "${newWs.name}" Initialized`,
        description: `Successfully configured multi-brand workspace context for ${newWs.brandName}`,
        priority: 'MEDIUM',
        category: 'System',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
  };

  const handleUpdateWorkspaceScoringCriteria = async (workspaceId: string, criteria: Workspace['scoringCriteria']) => {
    setWorkspaces(prev => prev.map(w => (w.id === workspaceId ? { ...w, scoringCriteria: criteria } : w)));
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scoringCriteria: criteria })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setWorkspaces(prev => prev.map(w => (w.id === workspaceId ? data.data : w)));
      }
    } catch (err) {
      console.error('Error saving scoring criteria:', err);
    }
  };

  const handleQuickAddCreator = async (newCr: any): Promise<boolean> => {
    try {
      const res = await fetch('/api/creators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCr)
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCreators(prev => [data.data, ...prev]);
        setCreatorsLite(prev => [data.data, ...prev]);
        return true;
      }
      throw new Error(data.message || 'Failed to save creator');
    } catch (err) {
      console.error(err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Lưu creator thất bại',
          description: `Không thể lưu @${newCr.handle} vào CRM. Vui lòng kiểm tra kết nối và thử lại.`,
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
      return false;
    }
  };

  // ImportWizardModal already POSTs the parsed creators to /api/creators/batch-import
  // itself before calling this — this only needs to pull the fresh server state in,
  // not import a second time.
  const handleBulkImportCreators = async (_imported: any[]) => {
    try {
      await refreshCreators();
    } catch (err) {
      console.error('Error refreshing creators after batch import:', err);
    }
  };


  const handleSendEmail = async (payload: any) => {
    try {
      const res = await fetch('/api/outreach/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, workspaceId: activeWorkspaceId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gửi email outreach thất bại');
      }

      setOutreachList(prev => [data.data, ...prev]);
      setCreators(prev =>
        prev.map(c => (c.id === payload.creatorId ? { ...c, lastContactAt: new Date().toISOString() } : c))
      );
      // "Contact lần N" được ghi vào assignment (riêng cho workspace+campaign này), không phải
      // Creator.status chung — xem server.ts /api/outreach/send.
      if (data.assignment) {
        setAssignments(prev => [data.assignment, ...prev.filter((a: CreatorCampaignAssignment) => a.id !== data.assignment.id)]);
      }
      if (data.conversation) {
        setConversations(prev => {
          const exists = prev.some(c => c.id === data.conversation.id);
          return exists
            ? prev.map(c => (c.id === data.conversation.id ? data.conversation : c))
            : [data.conversation, ...prev];
        });
      }
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Đã gửi Email Outreach ✉️',
          description: `Đã gửi email đến ${payload.creatorName} (${payload.creatorHandle})`,
          priority: 'LOW',
          category: 'Outreach',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
      return true;
    } catch (err: any) {
      console.error('Send email error:', err);
      alert('Không thể gửi email. Vui lòng kiểm tra kết nối mạng và cấu hình Gmail rồi thử lại.');
      return false;
    }
  };

  const handleSendReply = async (convId: string, content: string, isAiGenerated?: boolean) => {
    try {
      const res = await fetch(`/api/conversations/${convId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, isAiGenerated })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Gửi reply thất bại');
      }

      setConversations(prev =>
        prev.map(c => (c.id === convId ? data.data : c))
      );
      return true;
    } catch (err: any) {
      console.error('Send reply error:', err);
      alert('Không thể gửi phản hồi. Vui lòng thử lại sau.');
      return false;
    }
  };

  const handleCheckInbox = async () => {
    try {
      const res = await fetch('/api/inbox/check', { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success) {
        // Gọi từ InboxView (operator đang xem thread) — nạp full messages luôn thay vì bản rút
        // gọn, đỡ phải đợi thêm 1 round-trip nữa khi thread vừa có tin nhắn mới.
        const [resOut] = await Promise.all([fetch('/api/outreach'), fetchFullConversations()]);
        if (resOut.ok) {
          const outData = await resOut.json();
          if (outData.success) setOutreachList(outData.data);
        }
        fetchTodayRepliesReceived();
      }
      return data;
    } catch (err: any) {
      console.error('Check inbox error:', err);
      return { success: false, message: 'Không thể kết nối tới máy chủ. Vui lòng thử lại.' };
    }
  };

  const handleCreateCampaign = async (campData: any) => {
    // Ở view Agency (nhiều brand), campaign mới gắn vào đúng workspace theo tên Brand đã nhập,
    // tự tạo workspace nếu brand đó chưa tồn tại. Nếu đang ở trong 1 workspace brand cụ thể thì
    // giữ nguyên context đó (không tạo workspace khác dựa theo field Brand).
    const workspaceId = isAgencyWorkspace && campData.brand
      ? resolveOrCreateWorkspaceForBrand(campData.brand)
      : activeWorkspaceId;

    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...campData, workspaceId })
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.message || 'Failed to save campaign');
      }
      setCampaigns(prev => [data.data as Campaign, ...prev]);
    } catch (err) {
      console.error('Error creating campaign:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Tạo campaign thất bại',
          description: `Không thể lưu campaign "${campData.name}". Vui lòng kiểm tra kết nối và thử lại.`,
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleUpdateCampaign = async (campaignId: string, campData: any) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campData)
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.data) {
        throw new Error(data.message || 'Failed to update campaign');
      }
      setCampaigns(prev => prev.map(c => (c.id === campaignId ? (data.data as Campaign) : c)));
    } catch (err) {
      console.error('Error updating campaign:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Cập nhật campaign thất bại',
          description: `Không thể lưu thay đổi cho campaign "${campData.name}". Vui lòng thử lại.`,
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleArchiveCampaign = async (campaignId: string) => {
    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Failed to archive campaign');
      }
      setCampaigns(prev => prev.map(c => (c.id === campaignId ? { ...c, status: 'Archived' } : c)));
    } catch (err) {
      console.error('Error archiving campaign:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Xóa campaign thất bại',
          description: 'Không thể lưu thay đổi này. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  // Cả archive và đổi trạng thái pipeline (kéo-thả kanban) đều phải ghi vào đúng assignment
  // của workspace đang mở — xem POST /api/creators/:id/workspace-status ở server.ts — để
  // hành động ở workspace này không ảnh hưởng tới cách creator hiện ra ở workspace khác.
  const updateCreatorWorkspaceStatus = async (creatorId: string, status: CreatorStatus) => {
    try {
      const res = await fetch(`/api/creators/${creatorId}/workspace-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspaceId, status })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể cập nhật trạng thái');
      }
      if (data.data.assignment) {
        const updated = data.data.assignment as CreatorCampaignAssignment;
        setAssignments(prev => prev.map(a => (a.id === updated.id ? updated : a)));
      } else if (data.data.creator) {
        const updated = data.data.creator as Creator;
        setCreators(prev => prev.map(c => (c.id === updated.id ? updated : c)));
      }
    } catch (err) {
      console.error('Error updating creator workspace status:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Cập nhật trạng thái thất bại',
          description: 'Không thể lưu thay đổi này. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleArchiveCreator = (creatorId: string) => updateCreatorWorkspaceStatus(creatorId, 'Archived');

  // Xóa vĩnh viễn creator khỏi DB (không thể hoàn tác) — khác handleArchiveCreator (soft-delete).
  // Xem deleteCreatorPermanently ở src/db.ts để biết các bảng liên quan bị dọn theo.
  const handleDeleteCreatorPermanently = async (creatorId: string) => {
    try {
      const res = await fetch(`/api/creators/${creatorId}/permanent`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể xóa creator này.');
      }
      setCreators(prev => prev.filter(c => c.id !== creatorId));
      setAssignments(prev => prev.filter(a => a.creatorId !== creatorId));
    } catch (err) {
      console.error('Error permanently deleting creator:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Xóa creator thất bại',
          description: 'Không thể xóa creator này. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleUpdateCreatorStatus = (creatorId: string, status: CreatorStatus) =>
    updateCreatorWorkspaceStatus(creatorId, status);

  // Gán 1 creator vào 1 campaign — KHÔNG ghi đè assignment khác, 1 creator có thể chạy nhiều
  // campaign ở nhiều brand cùng lúc. Xem CreatorCampaignAssignment ở types.ts.
  const handleAssignCampaignToCreator = async (creatorId: string, campaignId: string) => {
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId, campaignId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gán creator vào campaign này.');
      }
      setAssignments(prev => [data.data.assignment, ...prev.filter(a => a.id !== data.data.assignment.id)]);
      setCampaigns(prev => prev.map(c => (c.id === data.data.campaign.id ? data.data.campaign : c)));
    } catch (err) {
      console.error('Error assigning creator to campaign:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Gán campaign thất bại',
          description: 'Không thể lưu assignment này. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  // Sửa các trường Sourcing List (giá/hợp đồng/hạng GMV...) của 1 assignment đã tồn tại —
  // khác với handleAssignCampaignToCreator (tạo mới/đổi status), hàm này chỉ PATCH thông tin
  // thương mại, không đụng tới status/campaign hiện tại.
  const handleUpdateAssignment = async (assignmentId: string, updates: Partial<CreatorCampaignAssignment>) => {
    const prevAssignments = assignments;
    setAssignments(prev => prev.map(a => (a.id === assignmentId ? { ...a, ...updates } : a)));
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể lưu thông tin Sourcing List.');
      }
      setAssignments(prev => prev.map(a => (a.id === data.data.id ? data.data : a)));
    } catch (err) {
      console.error('Error updating assignment:', err);
      setAssignments(prevAssignments);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Lưu Sourcing List thất bại',
          description: 'Không thể lưu thông tin giá/hợp đồng. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleUnassignCreatorCampaign = async (assignmentId: string) => {
    const prevAssignments = assignments;
    setAssignments(prev => prev.filter(a => a.id !== assignmentId));
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || 'Không thể gỡ creator khỏi campaign này.');
      }
      setCampaigns(prev => prev.map(c => (c.id === data.data.id ? data.data : c)));
    } catch (err) {
      console.error('Error unassigning creator from campaign:', err);
      setAssignments(prevAssignments);
    }
  };

  const handleSubmitPostedVideo = async (reviewId: string, form: PostedVideoFormData) => {
    setReviewForPostedVideo(null);
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;

    const existing = postedVideos.find(v => v.reviewId === reviewId);
    try {
      if (existing) {
        const res = await fetch(`/api/posted-videos/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (data.success && data.data) {
          setPostedVideos(prev => prev.map(v => (v.id === existing.id ? data.data : v)));
        }
      } else {
        const res = await fetch('/api/posted-videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: review.workspaceId,
            reviewId: review.id,
            creatorId: review.creatorId,
            creatorName: review.creatorName,
            creatorHandle: review.creatorHandle,
            campaignId: review.campaignId,
            campaignName: review.campaignName,
            ...form
          })
        });
        const data = await res.json();
        if (data.success && data.data) {
          setPostedVideos(prev => [data.data, ...prev]);
        }
      }
    } catch (err) {
      console.error('Error saving posted video:', err);
    }
  };

  const handleAddCreatorNote = (creatorId: string, content: string) => {
    const newNote = {
      id: `n-${Date.now()}`,
      author: 'Anh Tuan',
      content,
      createdAt: new Date().toISOString()
    };

    setCreators(prev =>
      prev.map(c => (c.id === creatorId ? { ...c, notes: [newNote, ...(c.notes || [])] } : c))
    );

    if (selectedCreatorDetail?.id === creatorId) {
      setSelectedCreatorDetail(prev =>
        prev ? { ...prev, notes: [newNote, ...(prev.notes || [])] } : null
      );
    }
  };

  const handleUpdateCreatorEmail = async (creatorId: string, email: string) => {
    const prevCreators = creators;
    const prevSelected = selectedCreatorDetail;
    setCreators(prev => prev.map(c => (c.id === creatorId ? { ...c, email } : c)));
    if (selectedCreatorDetail?.id === creatorId) {
      setSelectedCreatorDetail(prev => (prev ? { ...prev, email } : prev));
    }
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || 'Không thể lưu email.');
      setCreators(prev => prev.map(c => (c.id === creatorId ? data.data : c)));
      if (selectedCreatorDetail?.id === creatorId) {
        setSelectedCreatorDetail(prev => (prev ? data.data : prev));
      }
    } catch (err) {
      console.error('Error updating creator email:', err);
      setCreators(prevCreators);
      setSelectedCreatorDetail(prevSelected);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Lưu email thất bại',
          description: 'Không thể lưu email creator này. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        unreadNotifsCount={workspaceNotifications.filter(n => !n.isRead).length}
        creatorsCount={workspaceCreators.length}
        unreadInboxCount={workspaceConversations.filter(c => c.unread).length}
        openNotifDrawer={() => setIsNotificationDrawerOpen(true)}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          openCommandPalette={() => setIsCommandPaletteOpen(true)}
          openNotifDrawer={() => setIsNotificationDrawerOpen(true)}
          unreadNotifsCount={workspaceNotifications.filter(n => !n.isRead).length}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={id => setActiveWorkspaceId(id)}
          onOpenSettings={() => setActiveTab('settings')}
        />

        {/* View Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              kpis={kpis}
              tasks={workspaceTasks.filter(t => t.status === 'Pending')}
              activities={activities}
              recentReplies={workspaceConversations}
              creators={workspaceCreators}
              creatorsAddedToday={creatorsAddedToday}
              videosPostedThisMonth={videosPostedThisMonth}
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onOpenSettings={() => setActiveTab('settings')}
              activeCampaignCount={workspaceCampaigns.length}
              onSelectTab={setActiveTab}
              onSelectCreator={openCreatorDetail}
              onOpenQuickAdd={() => setIsQuickAddModalOpen(true)}
              onOpenAi={() => setIsAiDrawerOpen(true)}
            />
          )}

          {activeTab === 'creators' && (
            <CreatorListView
              creators={workspaceCreators}
              campaigns={isAgencyWorkspace ? campaigns : workspaceCampaigns}
              assignments={assignments}
              workspaces={workspaces}
              activeWorkspace={activeWorkspace}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onOpenSettings={() => setActiveTab('settings')}
              onSelectCreator={openCreatorDetail}
              onOpenImport={() => setIsImportModalOpen(true)}
              onRefresh={refreshCreators}
              onOpenEmailComposer={cr => {
                setSelectedCreatorForEmail(cr);
                setIsEmailComposerOpen(true);
              }}
              onArchiveCreator={handleArchiveCreator}
              onDeleteCreatorPermanently={handleDeleteCreatorPermanently}
              onRunAiScore={() => setIsAiDrawerOpen(true)}
              onAssignCampaign={handleAssignCampaignToCreator}
              onUnassignCampaign={handleUnassignCreatorCampaign}
              onOpenBulkOutreach={creatorIds => setBulkOutreachConfig({ creatorIds })}
            />
          )}

          {activeTab === 'outreach' && (
            <OutreachView
              creators={workspaceCreators}
              outreachList={workspaceOutreach}
              onOpenEmailComposer={cr => {
                setSelectedCreatorForEmail(cr);
                setIsEmailComposerOpen(true);
              }}
              onUpdateCreatorStatus={handleUpdateCreatorStatus}
              onSelectCreator={openCreatorDetail}
              onOpenBulkOutreach={(creatorIds, defaultSequenceStage) =>
                setBulkOutreachConfig({ creatorIds, defaultSequenceStage })
              }
            />
          )}

          {activeTab === 'inbox' && (
            <InboxView
              creators={workspaceCreators}
              campaigns={workspaceCampaigns}
              conversations={workspaceConversations}
              workspaces={workspaces}
              onSendReply={handleSendReply}
              onCheckInbox={handleCheckInbox}
            />
          )}

          {activeTab === 'campaigns' && (
            <CampaignsView
              campaigns={workspaceCampaigns}
              creators={workspaceCreators}
              assignments={assignments}
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onOpenSettings={() => setActiveTab('settings')}
              onOpenCreateCampaign={() => setIsCreateCampaignModalOpen(true)}
              onEditCampaign={openCampaignEdit}
              onArchiveCampaign={handleArchiveCampaign}
              onSelectCreator={openCreatorDetail}
              preselectCampaignId={preselectCampaignId}
              onOpenBulkOutreach={(creatorIds, campaignId) => setBulkOutreachConfig({ creatorIds, defaultCampaignId: campaignId })}
            />
          )}

          {activeTab === 'export' && (
            <ExportView
              creators={workspaceCreators}
              campaigns={workspaceCampaigns}
              assignments={workspaceAssignments}
              outreachList={workspaceOutreach}
              postedVideos={workspacePostedVideos}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onAddWorkspace={handleAddWorkspace}
              onUpdateScoringCriteria={handleUpdateWorkspaceScoringCriteria}
            />
          )}
        </main>
      </div>

      {/* GLOBAL MODALS & DRAWERS */}
      <AiDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        creators={workspaceCreatorsLite}
        campaigns={workspaceCampaigns}
        conversations={workspaceConversations}
        reviews={workspaceReviews}
        activeWorkspace={activeWorkspace}
      />

      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        notifications={workspaceNotifications}
        onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, isRead: true })))}
        onSelectTab={tab => {
          setActiveTab(tab);
          setIsNotificationDrawerOpen(false);
        }}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        creators={workspaceCreatorsLite}
        campaigns={workspaceCampaigns}
        onSelectCreator={openCreatorDetail}
        onSelectCampaign={cmp => {
          setPreselectCampaignId(cmp.id);
          setActiveTab('campaigns');
        }}
        onSelectTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddModalOpen(true)}
      />

      <QuickAddCreatorModal
        isOpen={isQuickAddModalOpen}
        onClose={() => setIsQuickAddModalOpen(false)}
        onSubmit={handleQuickAddCreator}
      />

      <ImportWizardModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onConfirmImport={handleBulkImportCreators}
        activeWorkspaceId={activeWorkspaceId}
      />

      <CreateCampaignModal
        isOpen={isCreateCampaignModalOpen}
        onClose={() => setIsCreateCampaignModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />

      <CreateCampaignModal
        key={editingCampaign?.id || 'edit-campaign-empty'}
        isOpen={!!editingCampaign}
        campaign={editingCampaign}
        onClose={closeCampaignEdit}
        onSubmit={campData => {
          if (editingCampaign) handleUpdateCampaign(editingCampaign.id, campData);
        }}
      />

      <EmailComposerModal
        isOpen={isEmailComposerOpen}
        onClose={() => setIsEmailComposerOpen(false)}
        creator={selectedCreatorForEmail}
        campaigns={isAgencyWorkspace ? campaigns : workspaceCampaigns}
        onSendEmail={handleSendEmail}
      />

      <BulkOutreachModal
        isOpen={!!bulkOutreachConfig}
        onClose={() => setBulkOutreachConfig(null)}
        creatorIds={bulkOutreachConfig?.creatorIds || []}
        creators={isAgencyWorkspace ? creators : workspaceCreators}
        campaigns={isAgencyWorkspace ? campaigns : workspaceCampaigns}
        workspaceId={activeWorkspaceId}
        defaultCampaignId={bulkOutreachConfig?.defaultCampaignId}
        defaultSequenceStage={bulkOutreachConfig?.defaultSequenceStage}
        onCompleted={refreshAfterBulkOutreach}
      />

      <CreatorDetailDrawer
        creator={selectedCreatorDetail}
        campaigns={campaigns}
        workspaces={workspaces}
        assignments={assignments}
        scoringCriteria={activeWorkspace?.scoringCriteria}
        onClose={closeCreatorDetail}
        onOpenEmailComposer={cr => {
          setSelectedCreatorForEmail(cr);
          setIsEmailComposerOpen(true);
        }}
        onArchiveCreator={handleArchiveCreator}
        onAddNote={handleAddCreatorNote}
        onAssignCampaign={handleAssignCampaignToCreator}
        onUnassignCampaign={handleUnassignCreatorCampaign}
        onUpdateAssignment={handleUpdateAssignment}
        onUpdateEmail={handleUpdateCreatorEmail}
      />

      <PostedVideoModal
        review={reviewForPostedVideo}
        existing={reviewForPostedVideo ? postedVideos.find(v => v.reviewId === reviewForPostedVideo.id) : null}
        onClose={() => setReviewForPostedVideo(null)}
        onSubmit={handleSubmitPostedVideo}
      />
    </div>
  );
}
export default App;
