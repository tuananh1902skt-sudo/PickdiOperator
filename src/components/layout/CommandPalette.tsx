import React, { useState, useEffect } from 'react';
import {
  Search,
  Users,
  Target,
  CheckSquare,
  Sparkles,
  Plus,
  ArrowRight,
  X,
  FileCheck2,
  BarChart3
} from 'lucide-react';
import { Creator, Campaign, Task } from '../../types';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  creators: Creator[];
  campaigns: Campaign[];
  tasks: Task[];
  onSelectCreator: (cr: Creator) => void;
  onSelectCampaign: (cmp: Campaign) => void;
  onSelectTab: (tab: any) => void;
  onOpenQuickAdd: () => void;
  onOpenAi: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  creators,
  campaigns,
  tasks,
  onSelectCreator,
  onSelectCampaign,
  onSelectTab,
  onOpenQuickAdd,
  onOpenAi
}) => {
  const [query, setQuery] = useState('');

  // ⌘K open/close toggling is owned by the parent (App.tsx); this only needs to
  // handle Escape and clearing the query when the palette closes.
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const q = query.toLowerCase().trim();

  // Filter items
  const matchedCreators = q
    ? creators.filter(
        c =>
          c.displayName.toLowerCase().includes(q) ||
          c.handle.toLowerCase().includes(q) ||
          (c.category || '').toLowerCase().includes(q)
      )
    : creators.slice(0, 3);

  const matchedCampaigns = q
    ? campaigns.filter(
        c => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q)
      )
    : campaigns.slice(0, 2);

  const matchedTasks = q
    ? tasks.filter(t => t.title.toLowerCase().includes(q))
    : tasks.slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            id="command-palette-input"
            type="text"
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Type a command or search creators, campaigns, tasks..."
            className="w-full py-4 px-3 bg-transparent text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-2 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-800 rounded-md"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="p-2 overflow-y-auto space-y-4">
          {/* Quick Actions / Navigation */}
          {!q && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Quick Actions
              </div>
              <div className="space-y-1">
                <button
                  onClick={() => {
                    onClose();
                    onOpenQuickAdd();
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Plus className="w-4 h-4 text-indigo-500" />
                  <span className="font-semibold">Add New Creator</span>
                  <span className="ml-auto text-[10px] text-slate-400">Action</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenAi();
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span className="font-semibold">Ask AI Assistant Copilot</span>
                  <span className="ml-auto text-[10px] text-slate-400">AI Command</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onSelectTab('creators');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <Users className="w-4 h-4 text-slate-400" />
                  <span>Go to Creators CRM</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onSelectTab('reviews');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <FileCheck2 className="w-4 h-4 text-slate-400" />
                  <span>Go to Draft Content Reviews</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onSelectTab('reports');
                  }}
                  className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <BarChart3 className="w-4 h-4 text-slate-400" />
                  <span>Go to Reports & Analytics</span>
                  <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
                </button>
              </div>
            </div>
          )}

          {/* Creators Section */}
          {matchedCreators.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Creators ({matchedCreators.length})
              </div>
              <div className="space-y-1">
                {matchedCreators.map(cr => (
                  <button
                    key={cr.id}
                    onClick={() => {
                      onClose();
                      onSelectCreator(cr);
                    }}
                    className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <img src={cr.avatar} alt={cr.displayName} className="w-7 h-7 rounded-full object-cover" />
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">{cr.displayName}</span>
                      <span className="text-[11px] text-slate-400">@{cr.handle} • {cr.category}</span>
                    </div>
                    <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      Score: {cr.brandFitScore}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Campaigns Section */}
          {matchedCampaigns.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5" /> Campaigns ({matchedCampaigns.length})
              </div>
              <div className="space-y-1">
                {matchedCampaigns.map(cmp => (
                  <button
                    key={cmp.id}
                    onClick={() => {
                      onClose();
                      onSelectCampaign(cmp);
                    }}
                    className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      {cmp.brand.substring(0, 2)}
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="font-semibold">{cmp.name}</span>
                      <span className="text-[11px] text-slate-400">{cmp.brand} • Budget: ${cmp.budget}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tasks Section */}
          {matchedTasks.length > 0 && (
            <div>
              <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5" /> Tasks ({matchedTasks.length})
              </div>
              <div className="space-y-1">
                {matchedTasks.map(tsk => (
                  <button
                    key={tsk.id}
                    onClick={() => {
                      onClose();
                      onSelectTab('tasks');
                    }}
                    className="w-full px-3 py-2 rounded-lg flex items-center gap-3 text-xs text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <CheckSquare className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="truncate text-left font-medium">{tsk.title}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-medium">
                      Due {tsk.dueDate}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Command Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between text-[11px] text-slate-400">
          <span>Search shortcut: <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">⌘K</kbd></span>
          <span>Press <kbd className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">ESC</kbd> to close</span>
        </div>
      </div>
    </div>
  );
};
