import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Plus,
  Download,
  Sparkles,
  ExternalLink,
  Mail,
  Archive,
  ChevronLeft,
  ChevronRight,
  Zap
} from 'lucide-react';
import { Creator, Campaign, Workspace } from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';

interface CreatorListViewProps {
  creators: Creator[];
  allCreators?: Creator[];
  campaigns: Campaign[];
  activeWorkspace?: Workspace;
  workspaces?: Workspace[];
  onSelectWorkspace?: (id: string) => void;
  onAssignToWorkspace?: (creatorId: string, workspaceId: string) => void;
  onOpenSettings?: () => void;
  onSelectCreator: (cr: Creator) => void;
  onOpenQuickAdd: () => void;
  onOpenImport: () => void;
  onOpenEmailComposer: (cr: Creator) => void;
  onArchiveCreator: (id: string) => void;
  onRunAiScore: (cr: Creator) => void;
  onAssignCampaign: (crId: string, cmpId: string) => void;
  showMockData?: boolean;
  setShowMockData?: (val: boolean) => void;
}

export const CreatorListView: React.FC<CreatorListViewProps> = ({
  creators,
  allCreators = [],
  campaigns,
  activeWorkspace,
  workspaces = [],
  onSelectWorkspace,
  onAssignToWorkspace,
  onOpenSettings,
  onSelectCreator,
  onOpenQuickAdd,
  onOpenImport,
  onOpenEmailComposer,
  onArchiveCreator,
  onRunAiScore,
  onAssignCampaign,
  showMockData = true,
  setShowMockData
}) => {
  // Tab Mode: 'workspace' (current workspace creators) vs 'global' (all agency creators)
  const [viewScope, setViewScope] = useState<'workspace' | 'global'>('workspace');

  // Ở view Agency (PICKDI, tổng hợp nhiều brand) chưa gắn campaign cụ thể nên hiển thị Overall
  // score (comprehensiveScore riêng của TikTok One) để so sánh nhanh cả kho creator. Khi chuyển
  // sang 1 workspace brand cụ thể, đổi lại thành Brand Fit (điểm nền tự tính, xem src/scoring.ts).
  const isAgencyView = !activeWorkspace || activeWorkspace.isAgency || activeWorkspace.id === 'ws-pickdi';
  const scoreColumnLabel = isAgencyView ? 'Overall Score' : 'Brand Fit';
  const getScoreValue = (cr: Creator) => (isAgencyView ? cr.scores?.overall : cr.brandFitScore);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Choose source list depending on scope
  const sourceCreators = viewScope === 'workspace' ? creators : (allCreators.length > 0 ? allCreators : creators);

  // Filtering logic
  const filteredCreators = sourceCreators.filter(c => {
    if (c.status === 'Archived') return false;

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

    return true;
  });

  // Drop selections that fell out of view (e.g. filter changed) so bulk actions
  // never silently apply to creators no longer visible in the table.
  useEffect(() => {
    setSelectedIds(prev => {
      const visibleIds = new Set(filteredCreators.map(c => c.id));
      const next = prev.filter(id => visibleIds.has(id));
      return next.length === prev.length ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCreators]);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredCreators.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCreators.map(c => c.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const csvEscape = (value: unknown) => {
    const str = value === undefined || value === null ? '' : String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const handleExportCSV = () => {
    const headers = ['Handle', 'Name', 'Category', 'Followers', 'AvgViews', 'ER%', 'BrandFitScore', 'Status', 'Email'];
    const rows = filteredCreators.map(c => [
      c.handle,
      c.displayName,
      c.category,
      c.followers,
      c.avgViews,
      c.engagementRate,
      c.brandFitScore,
      c.status,
      c.email
    ]);
    const csvContent = [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `tiktok_creators_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatNumber = (num?: number | null) => {
    if (num === undefined || num === null || isNaN(num)) return '—';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toString();
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

            {/* Scope Tabs */}
            <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ml-2">
              <button
                onClick={() => setViewScope('workspace')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewScope === 'workspace'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {activeWorkspace ? activeWorkspace.code : 'Current Workspace'} ({creators.length})
              </button>

              <button
                onClick={() => setViewScope('global')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  viewScope === 'global'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Master Agency Database ({allCreators.length || creators.length})
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-500">
            {viewScope === 'workspace'
              ? `Showing creators affiliated with ${activeWorkspace?.name || 'this workspace'}`
              : 'Showing all creator leads across the entire agency network pool'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenImport}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            Extension / Scraper (0đ)
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
          >
            <Download className="w-4 h-4 text-indigo-500" />
            Export CSV
          </button>

          <button
            onClick={onOpenQuickAdd}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Creator
          </button>
        </div>
      </div>

      {/* Mock Data Banner Info */}
      {showMockData ? (
        <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping shrink-0" />
            <span>
              <strong>Đang bật Dữ liệu Mẫu (Mock Data):</strong> Hệ thống hiển thị các profile creator mẫu để demo. Bạn có thể bấm nút <strong>Mock Data</strong> trên Navbar để ẩn/hiện.
            </span>
          </div>
          {setShowMockData && (
            <button
              onClick={() => setShowMockData(false)}
              className="text-amber-700 dark:text-amber-300 underline font-semibold hover:text-amber-900 shrink-0 text-xs"
            >
              Ẩn dữ liệu mẫu
            </button>
          )}
        </div>
      ) : (
        <div className="px-4 py-2.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-xl text-xs text-emerald-900 dark:text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
            <span>
              <strong>Đã ẩn Dữ liệu Mẫu:</strong> Danh sách dưới đây chỉ chứa các Creator thực do Bạn đã cào qua Tampermonkey Userscript hoặc Import CSV.
            </span>
          </div>
          {setShowMockData && (
            <button
              onClick={() => setShowMockData(true)}
              className="text-emerald-700 dark:text-emerald-300 underline font-semibold hover:text-emerald-900 shrink-0 text-xs"
            >
              Bật lại dữ liệu mẫu
            </button>
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
              <option value="Contacted">Contacted</option>
              <option value="Negotiating">Negotiating</option>
              <option value="Approved">Approved</option>
              <option value="Draft Submitted">Draft Submitted</option>
              <option value="Completed">Completed</option>
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
              <option value="Beauty & Skincare">Beauty & Skincare</option>
              <option value="Makeup">Makeup</option>
              <option value="Beauty & Lifestyle">Beauty & Lifestyle</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Strip */}
        {selectedIds.length > 0 && (
          <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 flex items-center justify-between text-xs text-indigo-900 dark:text-indigo-200 animate-in fade-in duration-150">
            <span className="font-semibold">
              {selectedIds.length} creators selected
            </span>
            <div className="flex items-center gap-2">
              {onAssignToWorkspace && (
                <select
                  onChange={e => {
                    if (e.target.value) {
                      selectedIds.forEach(id => onAssignToWorkspace(id, e.target.value));
                      setSelectedIds([]);
                    }
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Assign to Brand Workspace...</option>
                  {workspaces.map(ws => (
                    <option key={ws.id} value={ws.id}>→ {ws.name} ({ws.code})</option>
                  ))}
                </select>
              )}

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

              <button
                onClick={() => {
                  selectedIds.forEach(id => onArchiveCreator(id));
                  setSelectedIds([]);
                }}
                className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg font-semibold hover:bg-rose-100"
              >
                Archive Selected
              </button>
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
                    checked={selectedIds.length === filteredCreators.length && filteredCreators.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="py-3 px-4">Creator</th>
                <th className="py-3 px-4">Category & Niche</th>
                <th className="py-3 px-4 text-right">Followers</th>
                <th className="py-3 px-4 text-right">Avg Views</th>
                <th className="py-3 px-4 text-center">ER %</th>
                <th className="py-3 px-4 text-center">{scoreColumnLabel}</th>
                <th className="py-3 px-4">Brand / Workspace</th>
                <th className="py-3 px-4">Campaign</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredCreators.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12 text-slate-400">
                    No creators found matching current criteria.
                  </td>
                </tr>
              ) : (
                filteredCreators.map(cr => {
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
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-medium text-slate-800 dark:text-slate-200">
                            {cr.category || <span className="text-slate-400 italic font-normal">—</span>}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {(cr.niche || []).slice(0, 2).map((n, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 text-[10px] rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                              >
                                {n}
                              </span>
                            ))}
                          </div>
                        </div>
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

                      {/* Score Badge — Overall score (agency view) hoặc Brand Fit (brand view), xem isAgencyView ở trên */}
                      <td className="py-3.5 px-4 text-center">
                        {(() => {
                          const scoreVal = getScoreValue(cr);
                          return scoreVal !== undefined ? (
                            <span
                              className={`px-2 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                                scoreVal >= 90
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : scoreVal >= 80
                                  ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              <Sparkles className="w-3 h-3" />
                              {scoreVal}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs italic">—</span>
                          );
                        })()}
                      </td>

                      {/* Brand / Workspace */}
                      <td className="py-3.5 px-4">
                        <select
                          value={cr.workspaceId || 'ws-pickdi'}
                          onChange={e => {
                            if (onAssignToWorkspace) onAssignToWorkspace(cr.id, e.target.value);
                          }}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          {workspaces.map(ws => (
                            <option key={ws.id} value={ws.id}>
                              {ws.name} ({ws.code})
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Campaign */}
                      <td className="py-3.5 px-4">
                        {cr.campaignName ? (
                          <span className="px-2 py-1 text-[11px] font-semibold rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 truncate max-w-[140px] block">
                            {cr.campaignName}
                          </span>
                        ) : (
                          <select
                            onChange={e => {
                              if (e.target.value) onAssignCampaign(cr.id, e.target.value);
                            }}
                            className="text-[11px] p-1 border rounded bg-slate-50 dark:bg-slate-800 text-slate-500"
                          >
                            <option value="">+ Assign Campaign</option>
                            {campaigns.map(cmp => (
                              <option key={cmp.id} value={cmp.id}>{cmp.name}</option>
                            ))}
                          </select>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-full border ${
                            cr.status === 'Approved' || cr.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : cr.status === 'Draft Submitted' || cr.status === 'Negotiating'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : cr.status === 'Contacted'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          {cr.status}
                        </span>
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
          <span>Showing 1–{filteredCreators.length} of {filteredCreators.length} creators</span>
          <div className="flex items-center gap-1">
            <button disabled className="p-1 border border-slate-200 dark:border-slate-800 rounded disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-bold text-slate-800 dark:text-slate-200">1</span>
            <button disabled className="p-1 border border-slate-200 dark:border-slate-800 rounded disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
