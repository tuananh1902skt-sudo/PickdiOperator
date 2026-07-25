import React, { useEffect, useState } from 'react';
import {
  Target,
  Plus,
  Users,
  Calendar,
  Package,
  ExternalLink
} from 'lucide-react';
import { Campaign, Creator, Workspace } from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';

interface CampaignsViewProps {
  campaigns: Campaign[];
  creators: Creator[];
  activeWorkspace?: Workspace;
  workspaces?: Workspace[];
  onSelectWorkspace?: (id: string) => void;
  onOpenSettings?: () => void;
  onOpenCreateCampaign: () => void;
  onSelectCreator: (cr: Creator) => void;
  preselectCampaignId?: string | null;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({
  campaigns,
  creators,
  activeWorkspace,
  workspaces = [],
  onSelectWorkspace,
  onOpenSettings,
  onOpenCreateCampaign,
  onSelectCreator,
  preselectCampaignId
}) => {
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || '');

  // A campaign picked elsewhere (e.g. the ⌘K command palette) should open here selected,
  // not just switch to this tab and leave whatever was already selected.
  useEffect(() => {
    if (preselectCampaignId) setSelectedCampaignId(preselectCampaignId);
  }, [preselectCampaignId]);

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];
  const assignedCreators = creators.filter(cr => selectedCampaign?.creatorIds?.includes(cr.id));

  const getCreatorStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Completed':
        return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
      case 'Draft Submitted':
      case 'Negotiating':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      case 'Contacted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Running':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">RUNNING</span>;
      case 'Planning':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">PLANNING</span>;
      case 'Recruiting':
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">RECRUITING</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-800">COMPLETED</span>;
    }
  };

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
          activeCampaignCount={campaigns.length}
        />
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Campaign Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Track affiliate marketing campaigns, budgets, product SKUs & creator participation
          </p>
        </div>

        <button
          onClick={onOpenCreateCampaign}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create New Campaign
        </button>
      </div>

      {/* Campaign Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaigns.map(cmp => {
          const isSelected = cmp.id === selectedCampaignId;
          const budgetPct = cmp.budget > 0 ? Math.min(100, Math.round((cmp.spent / cmp.budget) * 100)) : 0;

          return (
            <div
              key={cmp.id}
              onClick={() => setSelectedCampaignId(cmp.id)}
              className={`p-5 rounded-2xl border transition-all cursor-pointer space-y-3 ${
                isSelected
                  ? 'bg-white dark:bg-slate-900 border-indigo-600 ring-2 ring-indigo-500/20 shadow-md'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                    {cmp.brand}
                  </span>
                  <h3 className="font-bold text-slate-900 dark:text-white text-sm leading-snug line-clamp-1">
                    {cmp.name}
                  </h3>
                </div>
                {getStatusBadge(cmp.status)}
              </div>

              <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                {cmp.objective}
              </p>

              {/* Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  <span>Budget Utilization</span>
                  <span>${cmp.spent} / ${cmp.budget} ({budgetPct}%)</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 h-full rounded-full transition-all" style={{ width: `${budgetPct}%` }} />
                </div>
              </div>

              {/* Stats Footer */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <strong>{cmp.creatorIds.length}</strong> Creators Assigned
                </span>
                <span className="flex items-center gap-1 text-[11px]">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  End {cmp.endDate}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Campaign Detailed Drawer / View */}
      {selectedCampaign && (
        <div className="p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  {selectedCampaign.brand}
                </span>
                <span className="text-xs text-slate-400">ID: {selectedCampaign.id}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                {selectedCampaign.name}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{selectedCampaign.description}</p>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Allocated Budget</span>
                <p className="text-lg font-bold text-slate-900 dark:text-white">${selectedCampaign.budget}</p>
              </div>
              <div className="text-right pl-3 border-l border-slate-200 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Assigned Creators</span>
                <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{assignedCreators.length}</p>
              </div>
            </div>
          </div>

          {/* Featured Products */}
          <div className="space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Package className="w-4 h-4 text-indigo-500" />
              Featured TikTok Shop Products ({selectedCampaign.products.length})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedCampaign.products.map(p => (
                <div key={p.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-200">{p.name}</h4>
                    <span className="text-[11px] font-mono text-slate-400">SKU: {p.sku}</span>
                  </div>
                  <span className="font-bold text-emerald-600 text-sm">${p.price}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Creators Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-4 h-4 text-indigo-500" />
                Assigned Creators Roster
              </h3>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-3">Creator</th>
                    <th className="p-3">Category</th>
                    <th className="p-3 text-right">Followers</th>
                    <th className="p-3 text-center">Brand Fit</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {assignedCreators.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-400">
                        No creators assigned to this campaign yet. Assign creators from Creators CRM list!
                      </td>
                    </tr>
                  ) : (
                    assignedCreators.map(cr => (
                      <tr key={cr.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <img src={cr.avatar} alt={cr.displayName} className="w-8 h-8 rounded-full object-cover" />
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{cr.displayName}</p>
                              <span className="text-[11px] text-slate-400">@{cr.handle}</span>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">{cr.category || '—'}</td>
                        <td className="p-3 text-right font-semibold">{cr.followers !== undefined ? `${(cr.followers / 1000).toFixed(0)}K` : '—'}</td>
                        <td className="p-3 text-center">
                          <span className="font-bold text-indigo-600">{cr.brandFitScore !== undefined ? `${cr.brandFitScore}/100` : '—'}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getCreatorStatusBadge(cr.status)}`}>
                            {cr.status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => onSelectCreator(cr)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
