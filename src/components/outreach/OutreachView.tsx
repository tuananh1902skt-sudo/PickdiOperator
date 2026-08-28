import React, { useState } from 'react';
import {
  Send,
  Kanban,
  Mail,
  Users
} from 'lucide-react';
import {
  Creator,
  CreatorStatus,
  OutreachEmail
} from '../../types';

interface OutreachViewProps {
  creators: Creator[];
  outreachList: OutreachEmail[];
  onOpenEmailComposer: (cr: Creator) => void;
  onUpdateCreatorStatus: (creatorId: string, status: CreatorStatus) => void;
  onSelectCreator: (cr: Creator) => void;
  onOpenBulkOutreach?: (creatorIds: string[], defaultSequenceStage: 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3') => void;
}

// Stages where the creator has already been contacted at least once — a bulk "send
// reminder" action only makes sense here, not for New Lead/Researching/Qualified.
const REMINDER_ELIGIBLE_STATUSES: Creator['status'][] = ['Contact lần 1', 'Contact lần 2', 'Contact lần 3', 'Interested', 'Negotiating'];
const STALE_CONTACT_DAYS = 3;

// Which reminder sequence stage a column's bulk "send reminder" button should
// default to, so the kanban card actually advances instead of re-writing the
// same (or an earlier) stage. Interested/Negotiating creators have already
// passed the contact-stage columns, so they fall back to the last reminder.
const REMINDER_STAGE_BY_STATUS: Partial<Record<Creator['status'], 'reminder_1' | 'reminder_2' | 'reminder_3'>> = {
  'Contact lần 1': 'reminder_1',
  'Contact lần 2': 'reminder_2',
  'Contact lần 3': 'reminder_3',
  Interested: 'reminder_3',
  Negotiating: 'reminder_3',
};

function daysSinceContact(lastContactAt?: string): number | undefined {
  if (!lastContactAt) return undefined;
  return Math.floor((Date.now() - new Date(lastContactAt).getTime()) / 86400000);
}

// Each stage owns a distinct hue so a column, its header, and its badges are
// instantly recognizable across the board without reading the label.
interface StageStyle {
  label: string;
  status: Creator['status'];
  border: string;
  headerBg: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  dropBg: string;
  dot: string;
}

export const OutreachView: React.FC<OutreachViewProps> = ({
  creators,
  outreachList,
  onOpenEmailComposer,
  onUpdateCreatorStatus,
  onSelectCreator,
  onOpenBulkOutreach
}) => {
  const [activeTab, setActiveTab] = useState<'kanban' | 'history'>('kanban');
  const [draggedCreatorId, setDraggedCreatorId] = useState<string | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<CreatorStatus | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectStage = (stageCreatorIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = stageCreatorIds.length > 0 && stageCreatorIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        stageCreatorIds.forEach(id => next.delete(id));
      } else {
        stageCreatorIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Covers every non-archived CreatorStatus so a creator never silently disappears
  // from the pipeline just because their status isn't one of the "main" stages.
  const pipelineStages: StageStyle[] = [
    { label: 'New Lead', status: 'New Lead', border: 'border-slate-300 dark:border-slate-700', headerBg: 'bg-slate-100 dark:bg-slate-800', headerText: 'text-slate-700 dark:text-slate-300', badgeBg: 'bg-slate-200 dark:bg-slate-700', badgeText: 'text-slate-700 dark:text-slate-200', dropBg: 'bg-slate-50/80 dark:bg-slate-900/40', dot: 'bg-slate-400' },
    { label: 'Researching', status: 'Researching', border: 'border-cyan-300 dark:border-cyan-800', headerBg: 'bg-cyan-100 dark:bg-cyan-950/60', headerText: 'text-cyan-700 dark:text-cyan-300', badgeBg: 'bg-cyan-200 dark:bg-cyan-900', badgeText: 'text-cyan-800 dark:text-cyan-200', dropBg: 'bg-cyan-50/80 dark:bg-cyan-950/30', dot: 'bg-cyan-400' },
    { label: 'Qualified', status: 'Qualified', border: 'border-blue-300 dark:border-blue-800', headerBg: 'bg-blue-100 dark:bg-blue-950/60', headerText: 'text-blue-700 dark:text-blue-300', badgeBg: 'bg-blue-200 dark:bg-blue-900', badgeText: 'text-blue-800 dark:text-blue-200', dropBg: 'bg-blue-50/80 dark:bg-blue-950/30', dot: 'bg-blue-400' },
    { label: 'Contact lần 1', status: 'Contact lần 1', border: 'border-indigo-300 dark:border-indigo-800', headerBg: 'bg-indigo-100 dark:bg-indigo-950/60', headerText: 'text-indigo-700 dark:text-indigo-300', badgeBg: 'bg-indigo-200 dark:bg-indigo-900', badgeText: 'text-indigo-800 dark:text-indigo-200', dropBg: 'bg-indigo-50/80 dark:bg-indigo-950/30', dot: 'bg-indigo-400' },
    { label: 'Contact lần 2', status: 'Contact lần 2', border: 'border-violet-300 dark:border-violet-800', headerBg: 'bg-violet-100 dark:bg-violet-950/60', headerText: 'text-violet-700 dark:text-violet-300', badgeBg: 'bg-violet-200 dark:bg-violet-900', badgeText: 'text-violet-800 dark:text-violet-200', dropBg: 'bg-violet-50/80 dark:bg-violet-950/30', dot: 'bg-violet-400' },
    { label: 'Contact lần 3', status: 'Contact lần 3', border: 'border-fuchsia-300 dark:border-fuchsia-800', headerBg: 'bg-fuchsia-100 dark:bg-fuchsia-950/60', headerText: 'text-fuchsia-700 dark:text-fuchsia-300', badgeBg: 'bg-fuchsia-200 dark:bg-fuchsia-900', badgeText: 'text-fuchsia-800 dark:text-fuchsia-200', dropBg: 'bg-fuchsia-50/80 dark:bg-fuchsia-950/30', dot: 'bg-fuchsia-400' },
    { label: 'Interested', status: 'Interested', border: 'border-sky-300 dark:border-sky-800', headerBg: 'bg-sky-100 dark:bg-sky-950/60', headerText: 'text-sky-700 dark:text-sky-300', badgeBg: 'bg-sky-200 dark:bg-sky-900', badgeText: 'text-sky-800 dark:text-sky-200', dropBg: 'bg-sky-50/80 dark:bg-sky-950/30', dot: 'bg-sky-400' },
    { label: 'Negotiating', status: 'Negotiating', border: 'border-amber-300 dark:border-amber-800', headerBg: 'bg-amber-100 dark:bg-amber-950/60', headerText: 'text-amber-700 dark:text-amber-300', badgeBg: 'bg-amber-200 dark:bg-amber-900', badgeText: 'text-amber-800 dark:text-amber-200', dropBg: 'bg-amber-50/80 dark:bg-amber-950/30', dot: 'bg-amber-400' },
    { label: 'Rejected', status: 'Rejected', border: 'border-red-300 dark:border-red-800', headerBg: 'bg-red-100 dark:bg-red-950/60', headerText: 'text-red-700 dark:text-red-300', badgeBg: 'bg-red-200 dark:bg-red-900', badgeText: 'text-red-800 dark:text-red-200', dropBg: 'bg-red-50/80 dark:bg-red-950/30', dot: 'bg-red-400' },
    { label: 'Approved', status: 'Approved', border: 'border-emerald-300 dark:border-emerald-800', headerBg: 'bg-emerald-100 dark:bg-emerald-950/60', headerText: 'text-emerald-700 dark:text-emerald-300', badgeBg: 'bg-emerald-200 dark:bg-emerald-900', badgeText: 'text-emerald-800 dark:text-emerald-200', dropBg: 'bg-emerald-50/80 dark:bg-emerald-950/30', dot: 'bg-emerald-400' },
    { label: 'Sample Sent', status: 'Sample Sent', border: 'border-purple-300 dark:border-purple-800', headerBg: 'bg-purple-100 dark:bg-purple-950/60', headerText: 'text-purple-700 dark:text-purple-300', badgeBg: 'bg-purple-200 dark:bg-purple-900', badgeText: 'text-purple-800 dark:text-purple-200', dropBg: 'bg-purple-50/80 dark:bg-purple-950/30', dot: 'bg-purple-400' },
    { label: 'Draft Submitted', status: 'Draft Submitted', border: 'border-orange-300 dark:border-orange-800', headerBg: 'bg-orange-100 dark:bg-orange-950/60', headerText: 'text-orange-700 dark:text-orange-300', badgeBg: 'bg-orange-200 dark:bg-orange-900', badgeText: 'text-orange-800 dark:text-orange-200', dropBg: 'bg-orange-50/80 dark:bg-orange-950/30', dot: 'bg-orange-400' },
    { label: 'Revision Requested', status: 'Revision Requested', border: 'border-rose-300 dark:border-rose-800', headerBg: 'bg-rose-100 dark:bg-rose-950/60', headerText: 'text-rose-700 dark:text-rose-300', badgeBg: 'bg-rose-200 dark:bg-rose-900', badgeText: 'text-rose-800 dark:text-rose-200', dropBg: 'bg-rose-50/80 dark:bg-rose-950/30', dot: 'bg-rose-400' },
    { label: 'Approved Draft', status: 'Approved Draft', border: 'border-lime-300 dark:border-lime-800', headerBg: 'bg-lime-100 dark:bg-lime-950/60', headerText: 'text-lime-700 dark:text-lime-300', badgeBg: 'bg-lime-200 dark:bg-lime-900', badgeText: 'text-lime-800 dark:text-lime-200', dropBg: 'bg-lime-50/80 dark:bg-lime-950/30', dot: 'bg-lime-400' },
    { label: 'Posted', status: 'Posted', border: 'border-teal-300 dark:border-teal-800', headerBg: 'bg-teal-100 dark:bg-teal-950/60', headerText: 'text-teal-700 dark:text-teal-300', badgeBg: 'bg-teal-200 dark:bg-teal-900', badgeText: 'text-teal-800 dark:text-teal-200', dropBg: 'bg-teal-50/80 dark:bg-teal-950/30', dot: 'bg-teal-400' },
    { label: 'Completed', status: 'Completed', border: 'border-green-300 dark:border-green-800', headerBg: 'bg-green-100 dark:bg-green-950/60', headerText: 'text-green-700 dark:text-green-300', badgeBg: 'bg-green-200 dark:bg-green-900', badgeText: 'text-green-800 dark:text-green-200', dropBg: 'bg-green-50/80 dark:bg-green-950/30', dot: 'bg-green-400' }
  ];

  const stageStyleByStatus = new Map(pipelineStages.map(s => [s.status, s]));

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Outreach & Collaboration Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage creator recruitment pipeline, automated negotiation replies and email history
          </p>
        </div>

        {/* Right Action Controls & View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300">
            <button
              onClick={() => setActiveTab('kanban')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activeTab === 'kanban' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold' : ''
              }`}
            >
              <Kanban className="w-4 h-4" />
              Pipeline Kanban
            </button>
          </div>
        </div>
      </div>

      {/* Floating bulk-action bar for kanban multi-select */}
      {activeTab === 'kanban' && selectedIds.size > 0 && (
        <div className="sticky top-2 z-20 flex items-center justify-between gap-3 bg-indigo-600 text-white px-4 py-2.5 rounded-xl shadow-lg">
          <span className="text-xs font-bold flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            Đã chọn {selectedIds.size} creator
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={clearSelection}
              className="text-[11px] font-semibold text-indigo-100 hover:text-white px-2 py-1"
            >
              Bỏ chọn
            </button>
            {onOpenBulkOutreach && (
              <button
                onClick={() => onOpenBulkOutreach(Array.from(selectedIds), 'first')}
                className="flex items-center gap-1.5 text-xs font-bold bg-white text-indigo-700 px-3 py-1.5 rounded-lg hover:bg-indigo-50"
              >
                <Mail className="w-3.5 h-3.5" />
                Outreach Hàng Loạt
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW 1: PIPELINE KANBAN */}
      {activeTab === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStages.map(stage => {
            const stageCreators = creators.filter(c => c.status === stage.status);
            const staleCreatorIds = REMINDER_ELIGIBLE_STATUSES.includes(stage.status)
              ? stageCreators.filter(c => {
                  const since = daysSinceContact(c.lastContactAt);
                  return since !== undefined && since >= STALE_CONTACT_DAYS && !c.doNotContact;
                }).map(c => c.id)
              : [];

            const isDragOver = dragOverStatus === stage.status;

            return (
              <div
                key={stage.status}
                onDragOver={e => {
                  e.preventDefault();
                  if (draggedCreatorId) setDragOverStatus(stage.status);
                }}
                onDragLeave={() => setDragOverStatus(prev => (prev === stage.status ? null : prev))}
                onDrop={e => {
                  e.preventDefault();
                  const creatorId = e.dataTransfer.getData('text/plain') || draggedCreatorId;
                  if (creatorId) onUpdateCreatorStatus(creatorId, stage.status);
                  setDraggedCreatorId(null);
                  setDragOverStatus(null);
                }}
                className={`w-72 shrink-0 ${stage.dropBg} p-3 rounded-2xl border flex flex-col max-h-[75vh] transition-colors ${
                  isDragOver
                    ? 'border-indigo-400 dark:border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900/60'
                    : stage.border
                }`}
              >
                {/* Column Header */}
                <div className={`flex items-center justify-between px-2.5 py-2 mb-3 rounded-xl ${stage.headerBg}`}>
                  <label className={`font-bold text-xs flex items-center gap-1.5 ${stage.headerText} cursor-pointer`}>
                    {stageCreators.length > 0 && (
                      <input
                        type="checkbox"
                        checked={stageCreators.every(c => selectedIds.has(c.id))}
                        onChange={() => toggleSelectStage(stageCreators.map(c => c.id))}
                        className="w-3 h-3 rounded accent-indigo-600"
                      />
                    )}
                    <span className={`w-1.5 h-1.5 rounded-full ${stage.dot}`} />
                    {stage.label}
                  </label>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${stage.badgeBg} ${stage.badgeText}`}>
                    {stageCreators.length}
                  </span>
                </div>

                {staleCreatorIds.length > 0 && onOpenBulkOutreach && (
                  <button
                    onClick={() => onOpenBulkOutreach(staleCreatorIds, REMINDER_STAGE_BY_STATUS[stage.status] ?? 'reminder_1')}
                    className="mb-3 -mt-2 w-full text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 rounded-lg py-1.5 flex items-center justify-center gap-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                  >
                    <Users className="w-3 h-3" />
                    Nhắc lại hàng loạt ({staleCreatorIds.length})
                  </button>
                )}

                {/* Column Cards */}
                <div className="flex-1 overflow-y-auto space-y-3">
                  {stageCreators.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      {isDragOver ? 'Drop to move here' : 'No creators in this stage'}
                    </div>
                  ) : (
                    stageCreators.map(cr => {
                      const cardStage = stageStyleByStatus.get(cr.status) ?? stage;

                      return (
                      <div
                        key={cr.id}
                        draggable
                        onClick={() => onSelectCreator(cr)}
                        onDragStart={e => {
                          e.dataTransfer.setData('text/plain', cr.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedCreatorId(cr.id);
                        }}
                        onDragEnd={() => {
                          setDraggedCreatorId(null);
                          setDragOverStatus(null);
                        }}
                        className={`p-3.5 rounded-xl border bg-white dark:bg-slate-800/80 shadow-2xs space-y-2.5 hover:border-indigo-300 hover:shadow-md transition-all group cursor-pointer active:cursor-grabbing ${
                          draggedCreatorId === cr.id ? 'opacity-40' : ''
                        } ${
                          selectedIds.has(cr.id)
                            ? 'border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-300 dark:ring-indigo-700'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(cr.id)}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleSelectOne(cr.id)}
                            className="w-3.5 h-3.5 rounded accent-indigo-600 shrink-0"
                          />
                          <img
                            src={cr.avatar}
                            alt={cr.displayName}
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="font-bold text-slate-900 dark:text-white text-xs truncate">
                              {cr.displayName}
                            </span>
                            <span className="text-[11px] text-slate-400 truncate">@{cr.handle}</span>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          Category: <strong className="text-slate-700 dark:text-slate-300">{cr.category || '—'}</strong>
                        </div>

                        {/* Move Stage dropdown */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              onOpenEmailComposer(cr);
                            }}
                            className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" /> Outreach
                          </button>

                          <select
                            value={cr.status}
                            onClick={e => e.stopPropagation()}
                            onChange={e => onUpdateCreatorStatus(cr.id, e.target.value as CreatorStatus)}
                            className={`text-[10px] py-1 px-1.5 border-0 rounded-full font-bold ${cardStage.badgeBg} ${cardStage.badgeText}`}
                          >
                            {pipelineStages.map(s => (
                              <option key={s.status} value={s.status}>
                                {s.status === cr.status ? s.label : `Move: ${s.label}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: SENT HISTORY */}
      {activeTab === 'history' && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-500 font-bold uppercase text-[10px]">
                <th className="p-3">Creator</th>
                <th className="p-3">Campaign</th>
                <th className="p-3">Subject Line</th>
                <th className="p-3">Status</th>
                <th className="p-3">Sent Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {outreachList.map(out => (
                <tr key={out.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-bold text-slate-900 dark:text-white">
                    {out.creatorName} ({out.creatorHandle})
                  </td>
                  <td className="p-3 text-slate-600 dark:text-slate-300">{out.campaignName}</td>
                  <td className="p-3 font-medium text-slate-800 dark:text-slate-200">{out.subject}</td>
                  <td className="p-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                      {out.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400">
                    {out.sentAt ? new Date(out.sentAt).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
