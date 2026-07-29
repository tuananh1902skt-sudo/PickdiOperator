import React, { useState } from 'react';
import { X, Rocket } from 'lucide-react';
import { DraftReview, PostedVideo } from '../../types';

export interface PostedVideoFormData {
  videoUrl: string;
  postedAt: string;
  videoId?: string;
  adCode?: string;
  totalRevenue?: number;
  totalOrders?: number;
  totalAdSpend?: number;
  roi?: number;
}

interface PostedVideoModalProps {
  review: DraftReview | null;
  existing?: PostedVideo | null; // nếu đã có PostedVideo cho review này → mở ở chế độ sửa
  onClose: () => void;
  onSubmit: (reviewId: string, data: PostedVideoFormData) => void;
}

export const PostedVideoModal: React.FC<PostedVideoModalProps> = ({ review, existing, onClose, onSubmit }) => {
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl || '');
  const [postedAt, setPostedAt] = useState(existing?.postedAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [videoId, setVideoId] = useState(existing?.videoId || '');
  const [adCode, setAdCode] = useState(existing?.adCode || '');
  const [totalRevenue, setTotalRevenue] = useState(existing?.totalRevenue != null ? String(existing.totalRevenue) : '');
  const [totalOrders, setTotalOrders] = useState(existing?.totalOrders != null ? String(existing.totalOrders) : '');
  const [totalAdSpend, setTotalAdSpend] = useState(existing?.totalAdSpend != null ? String(existing.totalAdSpend) : '');
  const [roi, setRoi] = useState(existing?.roi != null ? String(existing.roi) : '');

  if (!review) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl.trim()) return;
    onSubmit(review.id, {
      videoUrl: videoUrl.trim(),
      postedAt,
      videoId: videoId.trim() || undefined,
      adCode: adCode.trim() || undefined,
      totalRevenue: totalRevenue.trim() ? Number(totalRevenue) : undefined,
      totalOrders: totalOrders.trim() ? Number(totalOrders) : undefined,
      totalAdSpend: totalAdSpend.trim() ? Number(totalAdSpend) : undefined,
      roi: roi.trim() ? Number(roi) : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-600" />
            {existing ? 'Sửa video đã đăng' : 'Đánh dấu đã đăng'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <p className="text-slate-500">
            {review.creatorName} ({review.creatorHandle}) — {review.videoTitle}
          </p>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Link video *</label>
            <input
              type="text"
              required
              placeholder="https://www.tiktok.com/@handle/video/..."
              value={videoUrl}
              onChange={e => setVideoUrl(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Ngày đăng</label>
            <input
              type="date"
              value={postedAt}
              onChange={e => setPostedAt(e.target.value)}
              className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Video ID</label>
              <input
                type="text"
                value={videoId}
                onChange={e => setVideoId(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Spark Ads code</label>
              <input
                type="text"
                value={adCode}
                onChange={e => setAdCode(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tổng doanh thu</label>
              <input
                type="number"
                step="any"
                value={totalRevenue}
                onChange={e => setTotalRevenue(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tổng số đơn</label>
              <input
                type="number"
                step="1"
                value={totalOrders}
                onChange={e => setTotalOrders(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tổng chi ads</label>
              <input
                type="number"
                step="any"
                value={totalAdSpend}
                onChange={e => setTotalAdSpend(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ROI</label>
              <input
                type="number"
                step="any"
                value={roi}
                onChange={e => setRoi(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
            >
              Huỷ
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs"
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
