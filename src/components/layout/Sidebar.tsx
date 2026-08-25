import React from 'react';
import {
  Users,
  Send,
  Inbox,
  Target,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Bot,
  FileSpreadsheet
} from 'lucide-react';

export type ActiveTab =
  | 'creators'
  | 'outreach'
  | 'inbox'
  | 'campaigns'
  | 'export'
  | 'notifications'
  | 'settings';

interface SidebarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  unreadNotifsCount: number;
  creatorsCount?: number;
  unreadInboxCount?: number;
  openNotifDrawer?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  collapsed,
  setCollapsed,
  unreadNotifsCount,
  creatorsCount = 0,
  unreadInboxCount = 0,
  openNotifDrawer
}) => {
  const navItems = [
    { id: 'creators' as ActiveTab, label: 'Creators CRM', icon: Users, countText: creatorsCount > 0 ? `${creatorsCount}` : undefined },
    { id: 'outreach' as ActiveTab, label: 'Outreach & Pipeline', icon: Send },
    { id: 'inbox' as ActiveTab, label: 'Inbox', icon: Inbox, count: unreadInboxCount },
    { id: 'campaigns' as ActiveTab, label: 'Campaigns', icon: Target },
    { id: 'export' as ActiveTab, label: 'Xuất Google Sheet', icon: FileSpreadsheet },
    { id: 'notifications' as ActiveTab, label: 'Notifications', icon: Bell, count: unreadNotifsCount },
    { id: 'settings' as ActiveTab, label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      className={`relative flex flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-200 z-30 select-none ${
        collapsed ? 'w-[72px]' : 'w-[250px]'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-indigo-200 dark:shadow-none shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 dark:text-white text-sm truncate tracking-tight">
                Pickdi Operator
              </span>
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-500" />
                TikTok Shop Assistant
              </span>
            </div>
          )}
        </div>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Nav Items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              onClick={() => {
                if (item.id === 'notifications') {
                  if (openNotifDrawer) openNotifDrawer();
                  else setActiveTab(item.id);
                } else {
                  setActiveTab(item.id);
                }
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`} />
              {!collapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {!collapsed && item.countText ? (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-600 text-white shadow-xs">
                  {item.countText}
                </span>
              ) : null}

              {!collapsed && item.count ? (
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500 text-white">
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      {/* Footer workspace info */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-xs">
              AT
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                Anh Tuan
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Lead Operator
              </p>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
