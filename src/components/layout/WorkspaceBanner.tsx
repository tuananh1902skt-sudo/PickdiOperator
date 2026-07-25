import React, { useEffect, useRef } from 'react';
import { ChevronDown, Check, Settings, ArrowRightLeft, Layers } from 'lucide-react';
import { Workspace } from '../../types';

interface WorkspaceBannerProps {
  activeWorkspace: Workspace;
  workspaces: Workspace[];
  onSelectWorkspace: (id: string) => void;
  onOpenSettings?: () => void;
  activeCreatorCount?: number;
  activeCampaignCount?: number;
}

export const WorkspaceBanner: React.FC<WorkspaceBannerProps> = ({
  activeWorkspace,
  workspaces,
  onSelectWorkspace,
  onOpenSettings,
  activeCreatorCount = 0,
  activeCampaignCount = 0
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const getWorkspaceBadgeStyle = (color: Workspace['color']) => {
    switch (color) {
      case 'rose':
        return {
          bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900',
          dot: 'bg-rose-500',
          accent: 'from-rose-500 to-pink-600',
          ring: 'ring-rose-500/20'
        };
      case 'purple':
        return {
          bg: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900',
          dot: 'bg-purple-500',
          accent: 'from-purple-600 to-indigo-600',
          ring: 'ring-purple-500/20'
        };
      case 'emerald':
        return {
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
          dot: 'bg-emerald-500',
          accent: 'from-emerald-600 to-teal-600',
          ring: 'ring-emerald-500/20'
        };
      case 'amber':
        return {
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
          dot: 'bg-amber-500',
          accent: 'from-amber-500 to-orange-600',
          ring: 'ring-amber-500/20'
        };
      case 'indigo':
      default:
        return {
          bg: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900',
          dot: 'bg-indigo-500',
          accent: 'from-indigo-600 to-blue-600',
          ring: 'ring-indigo-500/20'
        };
    }
  };

  const style = getWorkspaceBadgeStyle(activeWorkspace.color);

  return (
    <div className="relative mb-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs overflow-hidden">
      {/* Decorative gradient blur background */}
      <div className={`absolute -right-10 -top-10 w-48 h-48 bg-gradient-to-br ${style.accent} opacity-5 blur-2xl rounded-full pointer-events-none`} />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
        {/* Left Workspace Identity */}
        <div className="flex items-start md:items-center gap-3">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${style.accent} text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0`}>
            {activeWorkspace.code}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {activeWorkspace.name}
              </h2>
              <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full border ${style.bg} flex items-center gap-1.5`}>
                <span className={`w-1.5 h-1.5 rounded-full ${style.dot} animate-pulse`} />
                {activeWorkspace.category}
              </span>
              {activeWorkspace.isAgency && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Master Agency Hub
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
              {activeWorkspace.description}
            </p>
          </div>
        </div>

        {/* Right Switcher & Quick Stats */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Active Context Stats Pill */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
            <span className="text-slate-500">
              Roster: <strong className="text-slate-800 dark:text-slate-200">{activeCreatorCount} creators</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="text-slate-500">
              Campaigns: <strong className="text-indigo-600 dark:text-indigo-400">{activeCampaignCount} running</strong>
            </span>
          </div>

          {/* Switch Workspace Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition-all border border-slate-200 dark:border-slate-700"
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
              <span>Switch Workspace</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl z-50 p-2 text-xs">
                <div className="px-3 py-1.5 font-bold text-slate-400 uppercase tracking-wider text-[10px] flex items-center justify-between">
                  <span>Your Workspaces</span>
                  <span>{workspaces.length} Available</span>
                </div>

                <div className="space-y-1 my-1">
                  {workspaces.map((ws) => {
                    const wsStyle = getWorkspaceBadgeStyle(ws.color);
                    const isSelected = ws.id === activeWorkspace.id;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => {
                          onSelectWorkspace(ws.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left p-2.5 rounded-xl flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800/60 font-medium'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${wsStyle.accent} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                            {ws.code}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">{ws.name}</div>
                            <div className="text-[11px] text-slate-400">{ws.category}</div>
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
                      setDropdownOpen(false);
                      onOpenSettings();
                    }}
                    className="w-full mt-1 p-2 rounded-xl text-center font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-xs flex items-center justify-center gap-1.5"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    Manage & Create Workspaces
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
