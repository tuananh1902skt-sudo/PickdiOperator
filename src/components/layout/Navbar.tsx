import React from 'react';
import {
  Search,
  Plus,
  Sparkles,
  Bell,
  Sun,
  Moon,
  ChevronDown,
  Building2,
  Check,
  PlusCircle,
  Layers,
  Database
} from 'lucide-react';
import { Workspace } from '../../types';

interface NavbarProps {
  openCommandPalette: () => void;
  openQuickAdd: () => void;
  openAiDrawer: () => void;
  openNotifDrawer: () => void;
  unreadNotifsCount: number;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  onSelectWorkspace: (id: string) => void;
  onOpenSettings?: () => void;
  showMockData?: boolean;
  setShowMockData?: (val: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  openCommandPalette,
  openQuickAdd,
  openAiDrawer,
  openNotifDrawer,
  unreadNotifsCount,
  darkMode,
  setDarkMode,
  activeWorkspace,
  workspaces,
  onSelectWorkspace,
  onOpenSettings,
  showMockData = true,
  setShowMockData
}) => {
  const [wsDropdownOpen, setWsDropdownOpen] = React.useState(false);

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur sticky top-0 z-20 px-4 md:px-6 flex items-center justify-between gap-4">
      {/* Workspace Switcher */}
      <div className="relative">
        <button
          id="workspace-switcher-btn"
          onClick={() => setWsDropdownOpen(!wsDropdownOpen)}
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 bg-slate-50 dark:bg-slate-800/80 transition-all text-xs font-semibold text-slate-800 dark:text-slate-200 shadow-2xs"
        >
          <div className="w-5 h-5 rounded-md bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">
            {activeWorkspace.code || 'WS'}
          </div>
          <span className="max-w-[160px] sm:max-w-[210px] truncate">{activeWorkspace.name}</span>
          <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
        </button>

        {wsDropdownOpen && (
          <div className="absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-2 text-xs">
            <div className="px-3 py-1.5 font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px] flex items-center justify-between">
              <span>Switch Active Workspace</span>
              <span className="text-slate-400 font-normal">{workspaces.length} Brand Hubs</span>
            </div>

            <div className="space-y-1 my-1">
              {workspaces.map((ws) => {
                const isSelected = ws.id === activeWorkspace.id;
                return (
                  <button
                    key={ws.id}
                    onClick={() => {
                      onSelectWorkspace(ws.id);
                      setWsDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/80 font-bold text-indigo-900 dark:text-indigo-200'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                        {ws.code}
                      </div>
                      <div>
                        <div className="line-clamp-1">{ws.name}</div>
                        <div className="text-[10px] text-slate-400 font-normal flex items-center gap-1">
                          {ws.category} {ws.isAgency && <span className="text-purple-600 font-bold">• Agency</span>}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {onOpenSettings && (
              <button
                onClick={() => {
                  setWsDropdownOpen(false);
                  onOpenSettings();
                }}
                className="w-full mt-1 p-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/40 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5 text-indigo-500" />
                Add & Manage Workspaces
              </button>
            )}
          </div>
        )}
      </div>

      {/* Center Search Bar */}
      <div className="flex-1 max-w-xl hidden sm:block">
        <button
          id="global-search-trigger"
          onClick={openCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border border-transparent hover:border-slate-300 dark:hover:border-slate-700 text-xs transition-all"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400" />
            <span>Search creators, campaigns, tasks, messages, notes...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-mono font-medium text-slate-500 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-md shadow-2xs">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mock Data Toggle Button */}
        {setShowMockData && (
          <button
            id="mockdata-toggle-btn"
            onClick={() => setShowMockData(!showMockData)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
              showMockData
                ? 'border-amber-200 dark:border-amber-900/80 bg-amber-50/90 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/80 shadow-2xs'
                : 'border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={
              showMockData
                ? 'Đang bật dữ liệu mẫu. Nhấp để ẩn dữ liệu mẫu (chỉ xem data thực)'
                : 'Đang ẩn dữ liệu mẫu. Nhấp để bật dữ liệu mẫu'
            }
          >
            <Database className={`w-3.5 h-3.5 ${showMockData ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-slate-400'}`} />
            <span className="hidden lg:inline">
              Mock Data: <strong className={showMockData ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500'}>{showMockData ? 'HIỆN' : 'ẨN'}</strong>
            </span>
            <span className="lg:hidden">
              {showMockData ? 'Mock: ON' : 'Mock: OFF'}
            </span>
          </button>
        )}

        {/* Quick Add Button */}
        <button
          id="quick-add-btn"
          onClick={openQuickAdd}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium shadow-sm transition-all active:scale-95"
          title="Quick Add Creator / Task"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Creator</span>
        </button>

        {/* AI Assistant Button */}
        <button
          id="ai-assistant-header-btn"
          onClick={openAiDrawer}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-xs font-medium transition-all"
          title="Open AI Assistant"
        >
          <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-pulse" />
          <span className="hidden md:inline font-semibold">AI Copilot</span>
        </button>

        {/* Notification Bell */}
        <button
          id="notif-bell-btn"
          onClick={openNotifDrawer}
          className="relative p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Notifications"
        >
          <Bell className="w-5 h-5" />
          {unreadNotifsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full ring-2 ring-white dark:ring-slate-900" />
          )}
        </button>

        {/* Dark Mode Toggle */}
        <button
          id="dark-mode-toggle-btn"
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
        </button>

        {/* User Profile Avatar */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
            AT
          </div>
        </div>
      </div>
    </header>
  );
};
