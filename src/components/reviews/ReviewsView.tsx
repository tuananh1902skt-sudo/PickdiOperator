import React, { useState } from 'react';
import { FileCheck2, Play, ExternalLink } from 'lucide-react';
import { DraftReview } from '../../types';

interface ReviewsViewProps {
  reviews: DraftReview[];
  onSelectReview: (review: DraftReview) => void;
}

export const ReviewsView: React.FC<ReviewsViewProps> = ({ reviews, onSelectReview }) => {
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filteredReviews = reviews.filter(r => {
    if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileCheck2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Video Draft Compliance Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review creator draft submissions for TikTok Shop policy, brand safety & hook quality
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-medium text-slate-800 dark:text-slate-200"
          >
            <option value="ALL">Status: All Submissions</option>
            <option value="Pending Review">Pending Review</option>
            <option value="Approved">Approved</option>
            <option value="Revision Requested">Revision Requested</option>
          </select>
        </div>
      </div>

      {/* Draft Reviews Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredReviews.length === 0 ? (
          <div className="col-span-full py-12 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
            No draft video reviews found.
          </div>
        ) : (
          filteredReviews.map(r => (
            <div
              key={r.id}
              onClick={() => onSelectReview(r)}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-3 hover:border-indigo-400 transition-all cursor-pointer group"
            >
              <div className="relative aspect-video rounded-xl bg-slate-950 overflow-hidden flex items-center justify-center">
                <img
                  src={r.thumbnailUrl}
                  alt={r.videoTitle}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-slate-900/30 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                    <Play className="w-5 h-5 fill-white ml-0.5" />
                  </div>
                </div>
                <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono">
                  {r.durationSeconds}s
                </span>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 truncate">
                    {r.campaignName}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      r.status === 'Approved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : r.status === 'Revision Requested'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-indigo-100 text-indigo-800'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-xs line-clamp-1 group-hover:text-indigo-600">
                  {r.videoTitle}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Creator: <strong className="text-slate-800 dark:text-slate-200">{r.creatorName}</strong> ({r.creatorHandle})
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
                <span>Submitted {new Date(r.submittedAt).toLocaleDateString()}</span>
                <span className="font-bold text-indigo-600 flex items-center gap-0.5">
                  Audit <ExternalLink className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
