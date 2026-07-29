import React, { useEffect, useState } from 'react';
import { X, Play, Sparkles, CheckCircle2, AlertTriangle, RefreshCw, ThumbsUp, RotateCcw, HelpCircle } from 'lucide-react';
import { DraftReview } from '../../types';

type Checklist = NonNullable<DraftReview['checklist']>;
type ChecklistKey = keyof Checklist;

const CHECKLIST_ITEMS: { key: ChecklistKey; label: string }[] = [
  { key: 'productNameCorrect', label: 'Tên sản phẩm nhắc đúng' },
  { key: 'ingredientsBenefitsCorrect', label: 'Thành phần/công dụng nói đúng' },
  { key: 'durationValid', label: 'Độ dài video hợp lý (30-90 giây)' },
  { key: 'hookIn3Seconds', label: 'Có hook trong 3 giây đầu' },
  { key: 'matchesBrief', label: 'Đúng theo brief đã gửi' },
];

// Click cycles chưa xét (undefined) -> đạt (true) -> không đạt (false) -> chưa xét.
const nextChecklistValue = (value: boolean | undefined): boolean | undefined => {
  if (value === undefined) return true;
  if (value === true) return false;
  return undefined;
};

// Creator gửi draft qua link Drive (xem Phần 7 export "Link Drive") — Drive cho embed trực
// tiếp qua /preview, không cần API key. Video file trực tiếp (.mp4...) dùng thẻ <video> chuẩn.
// Các link khác (TikTok, Dropbox share link thường...) chặn iframe (X-Frame-Options) nên không
// đoán embed được — vẫn phải mở tab mới cho các trường hợp đó.
type EmbeddablePlayer = { type: 'drive' | 'file'; src: string } | null;

function getEmbeddablePlayer(url?: string): EmbeddablePlayer {
  if (!url) return null;

  const driveMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/) || url.match(/[?&]id=([^&]+)/);
  if (url.includes('drive.google.com') && driveMatch) {
    return { type: 'drive', src: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };
  }

  if (/\.(mp4|mov|webm|m4v)(\?.*)?$/i.test(url)) {
    return { type: 'file', src: url };
  }

  return null;
}

interface ReviewDetailModalProps {
  review: DraftReview | null;
  onClose: () => void;
  onUpdateStatus: (
    reviewId: string,
    status: 'Approved' | 'Revision Requested' | 'Rejected',
    feedback?: string,
    checklist?: Checklist
  ) => void;
}

export const ReviewDetailModal: React.FC<ReviewDetailModalProps> = ({
  review,
  onClose,
  onUpdateStatus
}) => {
  const [feedback, setFeedback] = useState('');
  const [checklist, setChecklist] = useState<Checklist>({});
  const [aiChecking, setAiChecking] = useState(false);
  const [aiReviewResult, setAiReviewResult] = useState<any>(null);
  const [isPlayingInline, setIsPlayingInline] = useState(false);

  // This modal stays mounted and just swaps `review` — clear the previous
  // review's draft feedback and AI result so they don't leak into the next one.
  useEffect(() => {
    setFeedback('');
    setChecklist(review?.checklist ?? {});
    setAiReviewResult(null);
    setIsPlayingInline(false);
  }, [review?.id]);

  if (!review) return null;

  const embeddablePlayer = getEmbeddablePlayer(review.draftUrl);

  const toggleChecklistItem = (key: ChecklistKey) => {
    setChecklist(prev => ({ ...prev, [key]: nextChecklistValue(prev[key]) }));
  };

  const handleRunAiCheck = async () => {
    setAiChecking(true);
    try {
      const res = await fetch('/api/ai/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: review.videoTitle,
          campaignName: review.campaignName,
          draftUrl: review.draftUrl
        })
      });
      const data = await res.json();
      if (data.success && data.data) {
        setAiReviewResult(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiChecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <Play className="w-5 h-5 text-indigo-600" />
              TikTok Video Draft Compliance Review
            </h3>
            <p className="text-xs text-slate-500">
              Submitted by <strong>{review.creatorName}</strong> ({review.creatorHandle}) for {review.campaignName}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-800 dark:text-slate-200">
          {/* Main Layout: Video Preview Player + Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Video Player Card */}
            <div className="space-y-3">
              <div className="relative aspect-[9/16] bg-slate-950 rounded-2xl overflow-hidden flex items-center justify-center group shadow-md">
                {isPlayingInline && embeddablePlayer?.type === 'drive' && (
                  <iframe
                    src={embeddablePlayer.src}
                    className="w-full h-full border-0"
                    allow="autoplay"
                    allowFullScreen
                    title={review.videoTitle}
                  />
                )}
                {isPlayingInline && embeddablePlayer?.type === 'file' && (
                  <video
                    src={embeddablePlayer.src}
                    className="w-full h-full object-contain bg-black"
                    controls
                    autoPlay
                  />
                )}
                {!isPlayingInline && (
                  <>
                    <img
                      src={review.thumbnailUrl}
                      alt={review.videoTitle}
                      className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                    />
                    <button
                      type="button"
                      onClick={() => embeddablePlayer && setIsPlayingInline(true)}
                      disabled={!embeddablePlayer}
                      className="absolute inset-0 bg-slate-900/40 flex flex-col items-center justify-center p-4 text-center text-white disabled:cursor-not-allowed"
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-600/90 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 text-white fill-white ml-1" />
                      </div>
                      <span className="text-xs font-bold mt-2">{review.videoTitle}</span>
                      <span className="text-[10px] text-slate-300 font-mono mt-1">{review.durationSeconds}s duration</span>
                      {!embeddablePlayer && (
                        <span className="text-[10px] text-amber-300 font-semibold mt-2">
                          Không phát được trong app — dùng nút "Open Draft Video in New Tab" bên dưới
                        </span>
                      )}
                    </button>
                  </>
                )}
              </div>

              <a
                href={review.draftUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5"
              >
                Open Draft Video in New Tab
              </a>
            </div>

            {/* Compliance Checklist & AI Tools */}
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                  Checklist duyệt video (d'Alba)
                </h4>

                <div className="space-y-1.5 text-[11px]">
                  {CHECKLIST_ITEMS.map(item => {
                    const value = checklist[item.key];
                    const Icon = value === true ? CheckCircle2 : value === false ? AlertTriangle : HelpCircle;
                    const colorClass =
                      value === true ? 'text-emerald-600' : value === false ? 'text-rose-600' : 'text-slate-400';
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => toggleChecklistItem(item.key)}
                        className={`w-full flex items-center gap-2 font-semibold text-left rounded-lg px-1.5 py-1 hover:bg-slate-100 dark:hover:bg-slate-800 ${colorClass}`}
                      >
                        <Icon className="w-4 h-4 shrink-0" />
                        <span>{item.label}{value === undefined ? ' (chưa xét)' : ''}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* AI Hook & Compliance Check Button */}
              <button
                type="button"
                onClick={handleRunAiCheck}
                disabled={aiChecking}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-xs flex items-center justify-center gap-2 text-xs"
              >
                {aiChecking ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Analyzing Video Script with AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Run AI Hook & Compliance Audit
                  </>
                )}
              </button>

              {/* AI Review Results if generated */}
              {aiReviewResult && (
                <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/60 dark:bg-indigo-950/40 text-xs space-y-2.5 animate-in fade-in duration-150">
                  <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-800 dark:text-amber-300 text-[11px] font-medium flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>⚠️ Phân tích dựa trên tiêu đề & context, chưa xem nội dung video thật — Operator cần tự xem video trước khi Approve.</span>
                  </div>

                  {Array.isArray(aiReviewResult.keyObservations) && aiReviewResult.keyObservations.length > 0 && (
                    <div>
                      <span className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Nhận xét từ Metadata:</span>
                      <ul className="list-disc pl-4 space-y-0.5 text-slate-600 dark:text-slate-300">
                        {aiReviewResult.keyObservations.map((obs: string, idx: number) => (
                          <li key={idx}>{obs}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiReviewResult.improvementSuggestions && (
                    <p><strong>Gợi ý cải thiện:</strong> {aiReviewResult.improvementSuggestions}</p>
                  )}

                  {aiReviewResult.recommendation && (
                    <p><strong>Khuyến nghị AI:</strong> <span className="font-bold text-emerald-600">{aiReviewResult.recommendation}</span></p>
                  )}
                </div>
              )}

              {/* Reviewer Feedback Notes */}
              <div className="space-y-1">
                <label className="block font-bold text-slate-700 dark:text-slate-300">
                  Revision Notes / Feedback for Creator:
                </label>
                <textarea
                  rows={3}
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  placeholder="Specify exact timestamp and edit request (e.g. at 0:05 please show texture close-up)..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Decision Action Buttons Footer */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onUpdateStatus(review.id, 'Rejected', feedback, checklist)}
              className="px-4 py-2 bg-rose-50 text-rose-700 font-bold rounded-xl border border-rose-200 hover:bg-rose-100"
            >
              Reject Video
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onUpdateStatus(review.id, 'Revision Requested', feedback, checklist)}
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                Request Revision
              </button>

              <button
                type="button"
                onClick={() => onUpdateStatus(review.id, 'Approved', feedback, checklist)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <ThumbsUp className="w-4 h-4" />
                Approve Draft
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
