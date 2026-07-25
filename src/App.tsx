import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
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

import { CampaignsView } from './components/campaigns/CampaignsView';
import { CreateCampaignModal } from './components/campaigns/CreateCampaignModal';

import { ReviewsView } from './components/reviews/ReviewsView';
import { ReviewDetailModal } from './components/reviews/ReviewDetailModal';

import { TasksView } from './components/tasks/TasksView';
import { CreateTaskModal } from './components/tasks/CreateTaskModal';

import { ReportsView } from './components/reports/ReportsView';
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
  Workspace
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

export function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  // Workspaces State
  const [workspaces, setWorkspaces] = useState<Workspace[]>(INITIAL_WORKSPACES);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-pickdi');

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];
  const isAgencyWorkspace = activeWorkspace.isAgency || activeWorkspace.id === 'ws-pickdi';

  // Toggle for Showing / Hiding Mock Data
  const [showMockData, setShowMockData] = useState<boolean>(() => {
    const saved = localStorage.getItem('pickdi_show_mockdata');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('pickdi_show_mockdata', JSON.stringify(showMockData));
  }, [showMockData]);

  // Core Data Collections
  const [creators, setCreators] = useState<Creator[]>(INITIAL_CREATORS);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [outreachList, setOutreachList] = useState<OutreachEmail[]>(INITIAL_OUTREACH);
  const [conversations, setConversations] = useState<Conversation[]>(INITIAL_CONVERSATIONS);
  const [reviews, setReviews] = useState<DraftReview[]>(INITIAL_REVIEWS);
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [activities, setActivities] = useState<ActivityItem[]>(INITIAL_ACTIVITIES);

  // Helper to determine if an item is mock data
  const isItemMock = (item: { isMock?: boolean; id?: string }) => {
    if (item.isMock === true) return true;
    if (item.isMock === false) return false;
    if (item.id && /^(cr-[1-6]|cmp-[1-3]|out-[1-2]|conv-[1-2]|rev-[1-2]|tsk-[1-4]|notif-[1-3]|act-[1-4])$/.test(item.id)) {
      return true;
    }
    return false;
  };

  // Filter Data by Mock Toggle
  const displayCreators = showMockData ? creators : creators.filter(c => !isItemMock(c));
  const displayCampaigns = showMockData ? campaigns : campaigns.filter(c => !isItemMock(c));
  const displayOutreach = showMockData ? outreachList : outreachList.filter(o => !isItemMock(o));
  const displayConversations = showMockData ? conversations : conversations.filter(c => !isItemMock(c));
  const displayReviews = showMockData ? reviews : reviews.filter(r => !isItemMock(r));
  const displayTasks = showMockData ? tasks : tasks.filter(t => !isItemMock(t));
  const displayNotifications = showMockData ? notifications : notifications.filter(n => !isItemMock(n));
  const displayActivities = showMockData ? activities : activities.filter(a => !isItemMock(a));

  // Filter Data according to active workspace
  const inActiveWorkspace = (workspaceId?: string) =>
    isAgencyWorkspace || !workspaceId || workspaceId === activeWorkspaceId || workspaceId === 'ws-pickdi';

  const workspaceCreators = displayCreators.filter(c => inActiveWorkspace(c.workspaceId));
  const workspaceCampaigns = displayCampaigns.filter(cmp => inActiveWorkspace(cmp.workspaceId));
  const workspaceOutreach = displayOutreach.filter(o => inActiveWorkspace(o.workspaceId));
  const workspaceConversations = displayConversations.filter(c => inActiveWorkspace(c.workspaceId));
  const workspaceReviews = displayReviews.filter(r => inActiveWorkspace(r.workspaceId));
  const workspaceTasks = displayTasks.filter(t => inActiveWorkspace(t.workspaceId));
  const workspaceNotifications = displayNotifications.filter(n => inActiveWorkspace(n.workspaceId));

  // Modals & Drawers state
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuickAddModalOpen, setIsQuickAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);

  // Selected Detail states
  const [selectedCreatorForEmail, setSelectedCreatorForEmail] = useState<Creator | null>(null);
  const [isEmailComposerOpen, setIsEmailComposerOpen] = useState(false);
  const [selectedCreatorDetail, setSelectedCreatorDetail] = useState<Creator | null>(null);
  const [preselectCampaignId, setPreselectCampaignId] = useState<string | null>(null);
  const [selectedReviewDetail, setSelectedReviewDetail] = useState<DraftReview | null>(null);

  // Fetch state from backend & poll periodically for background script syncs
  const refreshCreators = async () => {
    if (document.hidden) return; // Don't poll when tab is hidden to save bandwidth & avoid rate limit
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
  };

  useEffect(() => {
    refreshCreators();

    fetch('/api/campaigns')
      .then(res => res.ok && res.headers.get('content-type')?.includes('application/json') ? res.json() : null)
      .then(data => { if (data && data.data) setCampaigns(data.data); })
      .catch(err => console.error(err));

    // Poll every 10 seconds for new scraped creators from extension/userscript
    const interval = setInterval(refreshCreators, 10000);

    // Also refresh immediately when switching back to this browser tab
    const handleFocus = () => refreshCreators();
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

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

  // Calculated Dashboard KPIs
  const kpis: DashboardKPIs = {
    todayEmailsSent: workspaceOutreach.length,
    todayRepliesReceived: workspaceConversations.filter(c => c.status === 'Need Reply').length,
    pendingReviewsCount: workspaceReviews.filter(r => r.status === 'Pending Review').length,
    overdueTasksCount: workspaceTasks.filter(t => t.status === 'Pending').length,
    activeCampaignsCount: workspaceCampaigns.filter(c => c.status === 'Running').length,
    creatorsAddedThisWeek: workspaceCreators.length,
    conversionRate: 38.8
  };

  // HANDLERS
  const handleAddWorkspace = (newWsData: Omit<Workspace, 'id'>) => {
    const newWs: Workspace = {
      ...newWsData,
      id: `ws-${Date.now()}`
    };
    setWorkspaces(prev => [...prev, newWs]);
    setActiveWorkspaceId(newWs.id);

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

  const handleAssignCreatorToWorkspace = async (creatorId: string, targetWorkspaceId: string) => {
    try {
      const res = await fetch(`/api/creators/${creatorId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: targetWorkspaceId })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || `Request failed with status ${res.status}`);
      }
      setCreators(prev => prev.map(c => c.id === creatorId ? { ...c, workspaceId: targetWorkspaceId } : c));
    } catch (err) {
      console.error('Error assigning creator to workspace:', err);
      setNotifications(prev => [
        {
          id: `notif-${Date.now()}`,
          title: 'Chuyển workspace thất bại',
          description: 'Không thể lưu thay đổi workspace cho creator này. Vui lòng thử lại.',
          priority: 'HIGH',
          category: 'System',
          isRead: false,
          createdAt: new Date().toISOString()
        },
        ...prev
      ]);
    }
  };

  const handleSendEmail = (payload: any) => {
    const newOutreach: OutreachEmail = {
      id: `out-${Date.now()}`,
      creatorId: payload.creatorId,
      creatorName: payload.creatorName,
      creatorHandle: payload.creatorHandle,
      campaignId: payload.campaignId,
      campaignName: payload.campaignName,
      subject: payload.subject,
      body: payload.body,
      status: 'Sent',
      sentAt: new Date().toISOString(),
      followUpCount: 0
    };

    setOutreachList(prev => [newOutreach, ...prev]);

    // Update creator status to Contacted
    setCreators(prev =>
      prev.map(c => (c.id === payload.creatorId ? { ...c, status: 'Contacted' } : c))
    );
  };

  const handleSendReply = (convId: string, content: string, isAiGenerated?: boolean) => {
    setConversations(prev =>
      prev.map(c => {
        if (c.id === convId) {
          const newMsg = {
            id: `msg-${Date.now()}`,
            senderName: 'Anh Tuan (Operator)',
            senderType: 'USER' as const,
            content,
            createdAt: new Date().toISOString(),
            isAiGenerated
          };
          return {
            ...c,
            status: 'Waiting Reply' as const,
            lastMessageAt: new Date().toISOString(),
            messages: [...c.messages, newMsg]
          };
        }
        return c;
      })
    );
  };

  const handleCreateCampaign = (campData: any) => {
    const newCamp: Campaign = {
      currency: 'USD',
      targetCategories: ['Beauty'],
      ...campData,
      id: `cmp-${Date.now()}`,
      spent: 0,
      creatorIds: [],
      createdAt: new Date().toISOString()
    };
    setCampaigns(prev => [newCamp, ...prev]);
  };

  const handleCreateTask = (taskData: any) => {
    const newTask: Task = {
      id: `task-${Date.now()}`,
      ...taskData,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    setTasks(prev => [newTask, ...prev]);
  };

  const handleToggleTask = (taskId: string) => {
    setTasks(prev =>
      prev.map(t =>
        t.id === taskId
          ? { ...t, status: t.status === 'Pending' ? 'Completed' : 'Pending' }
          : t
      )
    );
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
  };

  const handleArchiveCreator = (creatorId: string) => {
    setCreators(prev =>
      prev.map(c => (c.id === creatorId ? { ...c, status: 'Archived' } : c))
    );
  };

  const handleUpdateCreatorStatus = (creatorId: string, status: CreatorStatus) => {
    setCreators(prev =>
      prev.map(c => (c.id === creatorId ? { ...c, status } : c))
    );
  };

  const handleAssignCampaignToCreator = (creatorId: string, campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    setCreators(prev =>
      prev.map(c =>
        c.id === creatorId
          ? { ...c, campaignId, campaignName: campaign?.name }
          : c
      )
    );
    setCampaigns(prev =>
      prev.map(cmp =>
        cmp.id === campaignId
          ? { ...cmp, creatorIds: Array.from(new Set([...cmp.creatorIds, creatorId])) }
          : cmp
      )
    );
  };

  const handleUpdateReviewStatus = (reviewId: string, status: DraftReview['status'], feedback?: string) => {
    setReviews(prev =>
      prev.map(r =>
        r.id === reviewId ? { ...r, status, feedbackNote: feedback } : r
      )
    );
    setSelectedReviewDetail(null);
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

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans flex antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab as any}
        setActiveTab={setActiveTab as any}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        unreadNotifsCount={workspaceNotifications.filter(n => !n.isRead).length}
        creatorsCount={workspaceCreators.length}
        openAiDrawer={() => setIsAiDrawerOpen(true)}
        openNotifDrawer={() => setIsNotificationDrawerOpen(true)}
      />

      {/* Main App Canvas */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Navbar */}
        <Navbar
          openCommandPalette={() => setIsCommandPaletteOpen(true)}
          openQuickAdd={() => setIsQuickAddModalOpen(true)}
          openAiDrawer={() => setIsAiDrawerOpen(true)}
          openNotifDrawer={() => setIsNotificationDrawerOpen(true)}
          unreadNotifsCount={workspaceNotifications.filter(n => !n.isRead).length}
          darkMode={darkMode}
          setDarkMode={setDarkMode}
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={id => setActiveWorkspaceId(id)}
          onOpenSettings={() => setActiveTab('settings')}
          showMockData={showMockData}
          setShowMockData={setShowMockData}
        />

        {/* View Body */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {activeTab === 'dashboard' && (
            <DashboardView
              kpis={kpis}
              tasks={workspaceTasks.filter(t => t.status === 'Pending')}
              activities={displayActivities}
              recentReplies={workspaceConversations}
              creators={workspaceCreators}
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onOpenSettings={() => setActiveTab('settings')}
              activeCampaignCount={workspaceCampaigns.length}
              onSelectTab={setActiveTab}
              onSelectCreator={setSelectedCreatorDetail}
              onOpenQuickAdd={() => setIsQuickAddModalOpen(true)}
              onOpenAi={() => setIsAiDrawerOpen(true)}
              onCompleteTask={handleToggleTask}
            />
          )}

          {activeTab === 'creators' && (
            <CreatorListView
              creators={workspaceCreators}
              allCreators={displayCreators}
              campaigns={workspaceCampaigns}
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              showMockData={showMockData}
              setShowMockData={setShowMockData}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onOpenSettings={() => setActiveTab('settings')}
              onSelectCreator={setSelectedCreatorDetail}
              onOpenQuickAdd={() => setIsQuickAddModalOpen(true)}
              onOpenImport={() => setIsImportModalOpen(true)}
              onOpenEmailComposer={cr => {
                setSelectedCreatorForEmail(cr);
                setIsEmailComposerOpen(true);
              }}
              onArchiveCreator={handleArchiveCreator}
              onRunAiScore={() => setIsAiDrawerOpen(true)}
              onAssignCampaign={handleAssignCampaignToCreator}
              onAssignToWorkspace={handleAssignCreatorToWorkspace}
            />
          )}

          {activeTab === 'outreach' && (
            <OutreachView
              creators={workspaceCreators}
              campaigns={workspaceCampaigns}
              outreachList={workspaceOutreach}
              conversations={workspaceConversations}
              onOpenEmailComposer={cr => {
                setSelectedCreatorForEmail(cr);
                setIsEmailComposerOpen(true);
              }}
              onSendReply={handleSendReply}
              onUpdateCreatorStatus={handleUpdateCreatorStatus}
            />
          )}

          {activeTab === 'campaigns' && (
            <CampaignsView
              campaigns={workspaceCampaigns}
              creators={workspaceCreators}
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onOpenSettings={() => setActiveTab('settings')}
              onOpenCreateCampaign={() => setIsCreateCampaignModalOpen(true)}
              onSelectCreator={setSelectedCreatorDetail}
              preselectCampaignId={preselectCampaignId}
            />
          )}

          {activeTab === 'reviews' && (
            <ReviewsView
              reviews={workspaceReviews}
              onSelectReview={setSelectedReviewDetail}
            />
          )}

          {activeTab === 'tasks' && (
            <TasksView
              tasks={workspaceTasks}
              onToggleComplete={handleToggleTask}
              onOpenCreateTask={() => setIsCreateTaskModalOpen(true)}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              creators={workspaceCreators}
              campaigns={workspaceCampaigns}
              outreachList={workspaceOutreach}
              conversations={workspaceConversations}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              activeWorkspace={activeWorkspace}
              workspaces={workspaces}
              showMockData={showMockData}
              setShowMockData={setShowMockData}
              onSelectWorkspace={id => setActiveWorkspaceId(id)}
              onAddWorkspace={handleAddWorkspace}
            />
          )}
        </main>
      </div>

      {/* GLOBAL MODALS & DRAWERS */}
      <AiDrawer
        isOpen={isAiDrawerOpen}
        onClose={() => setIsAiDrawerOpen(false)}
        creators={workspaceCreators}
        campaigns={workspaceCampaigns}
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
        creators={workspaceCreators}
        campaigns={workspaceCampaigns}
        tasks={workspaceTasks}
        onSelectCreator={cr => {
          setSelectedCreatorDetail(cr);
          setActiveTab('creators');
        }}
        onSelectCampaign={cmp => {
          setPreselectCampaignId(cmp.id);
          setActiveTab('campaigns');
        }}
        onSelectTab={setActiveTab}
        onOpenQuickAdd={() => setIsQuickAddModalOpen(true)}
        onOpenAi={() => setIsAiDrawerOpen(true)}
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

      <CreateTaskModal
        isOpen={isCreateTaskModalOpen}
        onClose={() => setIsCreateTaskModalOpen(false)}
        creators={creators}
        onSubmit={handleCreateTask}
      />

      <EmailComposerModal
        isOpen={isEmailComposerOpen}
        onClose={() => setIsEmailComposerOpen(false)}
        creator={selectedCreatorForEmail}
        campaigns={campaigns}
        onSendEmail={handleSendEmail}
      />

      <CreatorDetailDrawer
        creator={selectedCreatorDetail}
        onClose={() => setSelectedCreatorDetail(null)}
        campaigns={campaigns}
        onOpenEmailComposer={cr => {
          setSelectedCreatorForEmail(cr);
          setIsEmailComposerOpen(true);
        }}
        onArchiveCreator={handleArchiveCreator}
        onAddNote={handleAddCreatorNote}
        onRunAiResearch={() => setIsAiDrawerOpen(true)}
      />

      <ReviewDetailModal
        review={selectedReviewDetail}
        onClose={() => setSelectedReviewDetail(null)}
        onUpdateStatus={handleUpdateReviewStatus}
      />
    </div>
  );
}
export default App;
