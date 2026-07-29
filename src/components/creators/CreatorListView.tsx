import React, { useEffect, useState } from 'react';
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
  UploadCloud
} from 'lucide-react';
import { Creator, Campaign, Workspace, CreatorCampaignAssignment } from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';

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
  onOpenEmailComposer: (cr: Creator) => void;
  onArchiveCreator: (id: string) => void;
  onRunAiScore: (cr: Creator) => void;
  onAssignCampaign: (crId: string, cmpId: string) => void;
  onUnassignCampaign?: (assignmentId: string) => void;
  onOpenBulkOutreach?: (creatorIds: string[]) => void;
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
  onOpenEmailComposer,
  onArchiveCreator,
  onRunAiScore,
  onAssignCampaign,
  onUnassignCampaign,
  onOpenBulkOutreach
}) => {
  // "Brand Fit" cũ đọc như 1 điểm content-quality chung chung — đổi tên cho đúng ý nghĩa
  // thật của brandFitScore: điểm phù hợp với TIÊU CHÍ SOURCING d'Alba (GMV tier, GPM, %
  // audience nữ, % beauty category, avg views — xem src/scoring.ts), không phải điểm
  // content/production quality.
  const scoreColumnLabel = "d'Alba Fit";
  const getScoreValue = (cr: Creator) => cr.brandFitScore;

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCountry, setSelectedCountry] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedOwner, setSelectedOwner] = useState('ALL');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const sourceCreators = creators;

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
          </div>

          <p className="text-xs text-slate-500">
            {`Showing creators affiliated with ${activeWorkspace?.name || 'this workspace'}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onOpenImport}
            className="px-3.5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <UploadCloud className="w-4 h-4" />
            Import Creator
          </button>
        </div>
      </div>

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
              {onOpenBulkOutreach && (
                <button
                  onClick={() => onOpenBulkOutreach(selectedIds)}
                  className="px-2.5 py-1 bg-indigo-600 text-white font-semibold rounded-lg flex items-center gap-1 hover:bg-indigo-700"
                >
                  <Send className="w-3.5 h-3.5" />
                  Gửi Hàng Loạt
                </button>
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
                <th className="py-3 px-4">Brands</th>
                <th className="py-3 px-4">Campaigns</th>
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

                      {/* Score Badge — Brand Fit (điểm nền tự tính, xem src/scoring.ts) */}
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

                      {/* Brands — suy ra tự động từ các campaign creator này đang chạy, không còn
                          gán thủ công 1 brand duy nhất (1 creator có thể chạy nhiều brand cùng lúc) */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const brandIds = Array.from(
                            new Set(assignments.filter(a => a.creatorId === cr.id).map(a => a.workspaceId).filter(Boolean))
                          ) as string[];
                          const brandWs = brandIds.map(id => workspaces.find(w => w.id === id)).filter(Boolean) as Workspace[];
                          return brandWs.length === 0 ? (
                            <span className="text-slate-400 text-[11px] italic">Chưa gán brand nào</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {brandWs.map(ws => (
                                <span
                                  key={ws.id}
                                  className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                >
                                  {ws.code}
                                </span>
                              ))}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Campaign(s) — 1 creator có thể chạy nhiều campaign cùng lúc */}
                      <td className="py-3.5 px-4">
                        {(() => {
                          const crAssignments = assignments.filter(a => a.creatorId === cr.id);
                          const assignedCampaignIds = new Set(crAssignments.map(a => a.campaignId));
                          const availableCampaigns = campaigns.filter(cmp => !assignedCampaignIds.has(cmp.id));

                          return (
                            <div className="flex flex-col gap-1 max-w-[160px]">
                              {crAssignments.map(a => (
                                <span
                                  key={a.id}
                                  className="px-2 py-1 text-[11px] font-semibold rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 truncate flex items-center justify-between gap-1"
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
                              {availableCampaigns.length > 0 && (
                                <select
                                  value=""
                                  onChange={e => {
                                    if (e.target.value) onAssignCampaign(cr.id, e.target.value);
                                  }}
                                  className="text-[11px] p-1 border rounded bg-slate-50 dark:bg-slate-800 text-slate-500"
                                >
                                  <option value="">+ Assign Campaign</option>
                                  {availableCampaigns.map(cmp => (
                                    <option key={cmp.id} value={cmp.id}>{cmp.name}</option>
                                  ))}
                                </select>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-full border whitespace-nowrap ${
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
