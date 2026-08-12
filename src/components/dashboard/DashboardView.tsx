import React, { useEffect, useState } from 'react';
import {
  Send,
  MessageSquare,
  FileCheck2,
  AlertTriangle,
  TrendingUp,
  Target,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  Users,
  Video
} from 'lucide-react';
import {
  DashboardKPIs,
  Task,
  ActivityItem,
  Conversation,
  Creator,
  Workspace
} from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';

// Mục tiêu KPI cá nhân theo quy trình d'Alba — chỉ Juan dùng nên để cố định ở đây,
// sửa trực tiếp khi d'Alba đổi mục tiêu, không cần màn hình cài đặt riêng.
const DAILY_CREATOR_LISTUP_TARGET = 200;
const MONTHLY_VIDEO_POSTED_TARGET_MIN = 300;
const MONTHLY_VIDEO_POSTED_TARGET_MAX = 500;

interface DashboardViewProps {
  kpis: DashboardKPIs;
  tasks: Task[];
  activities: ActivityItem[];
  recentReplies: Conversation[];
  creators: Creator[];
  creatorsAddedToday: number;
  videosPostedThisMonth: number;
  activeWorkspace?: Workspace;
  workspaces?: Workspace[];
  onSelectWorkspace?: (id: string) => void;
  onOpenSettings?: () => void;
  activeCampaignCount?: number;
  onSelectTab: (tab: any) => void;
  onSelectCreator: (cr: Creator) => void;
  onOpenQuickAdd: () => void;
  onOpenAi: () => void;
  onCompleteTask: (id: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  kpis,
  tasks,
  activities,
  recentReplies,
  creators,
  creatorsAddedToday,
  videosPostedThisMonth,
  activeWorkspace,
  workspaces = [],
  onSelectWorkspace,
  onOpenSettings,
  activeCampaignCount = 0,
  onSelectTab,
  onSelectCreator,
  onOpenQuickAdd,
  onOpenAi,
  onCompleteTask
}) => {
  const [prioritySuggestion, setPrioritySuggestion] = useState<{ priorityAction: string; reasoning?: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/ai/priority-suggestion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: activeWorkspace?.isAgency ? undefined : activeWorkspace?.id })
    })
      .then(res => res.json())
      .then(json => {
        if (!cancelled && json.success) {
          setPrioritySuggestion({ priorityAction: json.data.priorityAction, reasoning: json.data.reasoning });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [activeWorkspace?.id]);

  const todayStr = new Date().toISOString().split('T')[0];

  const pipelineFunnel = [
    { label: 'New Leads', count: creators.filter(c => c.status === 'New Lead').length, color: 'bg-slate-500' },
    { label: 'Contact lần 1', count: creators.filter(c => c.status === 'Contact lần 1').length, color: 'bg-blue-500' },
    { label: 'Contact lần 2', count: creators.filter(c => c.status === 'Contact lần 2').length, color: 'bg-blue-600' },
    { label: 'Contact lần 3', count: creators.filter(c => c.status === 'Contact lần 3').length, color: 'bg-blue-700' },
    { label: 'Negotiating', count: creators.filter(c => c.status === 'Negotiating').length, color: 'bg-purple-500' },
    { label: 'Approved', count: creators.filter(c => c.status === 'Approved').length, color: 'bg-indigo-500' },
    { label: 'Draft Submitted', count: creators.filter(c => c.status === 'Draft Submitted').length, color: 'bg-amber-500' },
    { label: 'Completed', count: creators.filter(c => c.status === 'Completed').length, color: 'bg-emerald-500' }
  ];

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Workspace Banner */}
      {activeWorkspace && (
        <WorkspaceBanner
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={onSelectWorkspace || (() => {})}
          onOpenSettings={onOpenSettings}
          activeCreatorCount={creators.length}
          activeCampaignCount={activeCampaignCount}
        />
      )}

      {/* Greeting & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30">
              Live Operational Sync
            </span>
            <span className="text-xs text-slate-300">Today, {new Date().toLocaleDateString('vi-VN')}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome back, Anh Tuan 👋</h1>
          <p className="text-xs text-slate-300 max-w-2xl">
            You have <strong className="text-white">{tasks.length} pending tasks</strong> and{' '}
            <strong className="text-white">{kpis.pendingReviewsCount} draft video</strong> waiting for compliance review.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenQuickAdd}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Add New Creator
          </button>
          <button
            onClick={onOpenAi}
            className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-2 transition-all"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            AI Daily Digest
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Today Emails</span>
            <Send className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.todayEmailsSent}</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Target 20/day</div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Replies Today</span>
            <MessageSquare className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.todayRepliesReceived}</div>
          <div className="text-[11px] text-indigo-600 font-semibold mt-1">
            {kpis.todayEmailsSent > 0
              ? `${((kpis.todayRepliesReceived / kpis.todayEmailsSent) * 100).toFixed(1)}% Reply Rate`
              : '0% Reply Rate'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Pending Reviews</span>
            <FileCheck2 className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.pendingReviewsCount}</div>
          <div className="text-[11px] text-amber-600 font-semibold mt-1">
            {kpis.pendingReviewsCount > 0 ? 'Action Needed' : 'Up to date'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Pending Tasks</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{tasks.length}</div>
          <div className="text-[11px] text-slate-400 mt-1">
            {tasks.filter(t => t.dueDate < todayStr).length} Overdue
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Active Campaigns</span>
            <Target className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.activeCampaignsCount}</div>
          <div className="text-[11px] text-purple-600 font-semibold mt-1">
            {kpis.activeCampaignsCount > 0 ? `${kpis.activeCampaignsCount} Active` : 'No active campaigns'}
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Conversion Rate</span>
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{kpis.conversionRate}%</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">
            {creators.length > 0
              ? `${creators.filter(c => ['Approved', 'Completed'].includes(c.status)).length} of ${creators.length} converted`
              : '0 converted'}
          </div>
        </div>
      </div>

      {/* Personal KPI Targets: List-up hôm nay + Video lên sóng tháng này */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>List-up hôm nay</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {creatorsAddedToday} <span className="text-sm font-medium text-slate-400">/ {DAILY_CREATOR_LISTUP_TARGET}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{ width: `${Math.min(100, (creatorsAddedToday / DAILY_CREATOR_LISTUP_TARGET) * 100)}%` }}
            />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-2">
            <span>Video lên sóng tháng này</span>
            <Video className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {videosPostedThisMonth}{' '}
            <span className="text-sm font-medium text-slate-400">
              / {MONTHLY_VIDEO_POSTED_TARGET_MIN}-{MONTHLY_VIDEO_POSTED_TARGET_MAX}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.min(100, (videosPostedThisMonth / MONTHLY_VIDEO_POSTED_TARGET_MIN) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Pipeline Funnel + Today Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Creator Pipeline Funnel (2 Cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Creator Operations Pipeline
              </h3>
              <p className="text-xs text-slate-500">Live creator distribution across workflow stages</p>
            </div>
            <button
              onClick={() => onSelectTab('outreach')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Open Pipeline Kanban <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pipelineFunnel.map((stage, idx) => (
              <div
                key={idx}
                onClick={() => onSelectTab('creators')}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                    {stage.label}
                  </span>
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">{stage.count}</div>
              </div>
            ))}
          </div>

          {/* AI Recommendation Banner — powered by ops.priority_suggester agent, reasons over
              every open campaign/conversation/review/task instead of a canned string. */}
          {prioritySuggestion ? (
            <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-100 dark:border-indigo-900 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-200 mb-0.5">
                  AI Operator Priority Suggestion
                </h4>
                <p className="text-indigo-800 dark:text-indigo-300 leading-relaxed">
                  {prioritySuggestion.priorityAction}
                </p>
                {prioritySuggestion.reasoning && (
                  <p className="text-indigo-600/80 dark:text-indigo-400/80 mt-1 italic">{prioritySuggestion.reasoning}</p>
                )}
              </div>
              <button
                onClick={() => onSelectTab('outreach')}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-indigo-700 shrink-0"
              >
                Negotiate Now
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs">
                <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">
                  AI Operator Suggestion
                </h4>
                <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                  {recentReplies.length > 0 ? 'Đang phân tích công việc ưu tiên…' : 'Chưa có trao đổi nào với Creator. Hãy quét Creator bằng extension hoặc thêm Creator mới để bắt đầu chiến dịch outreach.'}
                </p>
              </div>
              <button
                onClick={onOpenQuickAdd}
                className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg shadow-2xs hover:bg-indigo-700 shrink-0"
              >
                + Thêm Creator
              </button>
            </div>
          )}
        </div>

        {/* Today's Tasks Sidebar (1 Col) */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                Today's Tasks
              </h3>
              <button
                onClick={() => onSelectTab('tasks')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View all ({tasks.length})
              </button>
            </div>

            <div className="space-y-2.5">
              {tasks.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400">All tasks completed!</div>
              ) : (
                tasks.map(t => (
                  <div
                    key={t.id}
                    className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-start gap-2.5 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                  >
                    <button
                      onClick={() => onCompleteTask(t.id)}
                      className="mt-0.5 p-0.5 text-slate-300 hover:text-emerald-500 rounded"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 dark:text-slate-200 leading-snug truncate">
                        {t.title}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Due {t.dueDate}
                        </span>
                        {t.relatedCreatorName && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium truncate">
                            • {t.relatedCreatorName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            onClick={() => onSelectTab('tasks')}
            className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold rounded-xl text-xs flex items-center justify-center gap-1 transition-colors"
          >
            Manage Operational Tasks <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Bottom Row: Recent Activity & Pending Replies */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inbound Creator Replies */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-500" />
              Recent Creator Replies
            </h3>
            <button
              onClick={() => onSelectTab('outreach')}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Open Inbox →
            </button>
          </div>

          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 -mr-1">
            {recentReplies.length === 0 ? (
              <p className="text-xs text-slate-400 py-4">No unread replies</p>
            ) : (
              recentReplies.map(r => (
                <div
                  key={r.id}
                  onClick={() => onSelectTab('outreach')}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex items-start gap-3 hover:border-indigo-300 dark:hover:border-indigo-800 cursor-pointer transition-all"
                >
                  <img src={r.creatorAvatar} alt={r.creatorName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-white">{r.creatorName}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-800">
                        {r.status}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 line-clamp-1 italic">
                      "{r.messages[r.messages.length - 1]?.content || r.lastMessagePreview}"
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Activity Timeline Stream */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Recent Workspace Audit Activity
            </h3>
            <span className="text-xs text-slate-400">Real-time log</span>
          </div>

          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">Chưa có hoạt động nào được ghi nhận</p>
            ) : (
              activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 text-xs">
                  <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                  <div className="flex-1">
                    <p className="text-slate-800 dark:text-slate-200">
                      <strong className="font-semibold">{a.actor}</strong> {a.action}{' '}
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium">{a.target}</span>
                    </p>
                    <span className="text-[10px] text-slate-400">{new Date(a.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
