import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  Copy,
  Zap,
  Download,
  RefreshCw,
  ClipboardPaste
} from 'lucide-react';

interface ImportWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmImport: (importedCreators: any[]) => void;
  activeWorkspaceId?: string;
}

// Normalize a raw scraped record (from the TikTok One userscript, JSON, or CSV) into the
// shape /api/creators/batch-import expects. Missing fields are left undefined — never
// invent a placeholder number/email that would look like real scraped data.
function normalizeScrapedItem(item: any) {
  return {
    handle: item.handle || item.unique_id || item.username || undefined,
    displayName: item.displayName || item.nickname || item.name || undefined,
    avatar: item.avatar || item.avatar_thumb || item.head_url || undefined,
    tiktokOneId: item.tiktokOneId || item.creator_id || item.creator_o_id || item.star_id || item.user_id || undefined,
    followers: item.followers ?? item.follower_cnt ?? undefined,
    avgViews: item.avgViews ?? item.avg_video_views ?? undefined,
    engagementRate: item.engagementRate ?? item.engagement ?? undefined,
    gmv30d: item.gmv30d ?? item.e_commerce_gmv ?? undefined,
    category: item.category || undefined,
    country: item.country || item.region || undefined,
    email: item.email || item.contact_email || undefined,
    recentVideos: item.recentVideos || undefined,
    demographics: item.demographics || undefined,
    scores: item.scores || undefined
  };
}

function parseScrapedPayload(text: string): any[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const rawList =
      parsed?.creators ||
      parsed?.data?.creator_list ||
      parsed?.data?.creators ||
      parsed?.creator_list ||
      (Array.isArray(parsed) ? parsed : []);
    return Array.isArray(rawList) ? rawList.map(normalizeScrapedItem).filter(c => c.handle) : [];
  }

  // Fallback: CSV rows (handle, displayName, followers, email)
  return trimmed
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(',').map(p => p.trim());
      const handle = parts[0]?.replace(/^@/, '');
      if (!handle) return null;
      const followersNum = parts[2] ? Number(parts[2]) : NaN;
      return {
        handle,
        displayName: parts[1] || undefined,
        followers: Number.isFinite(followersNum) ? followersNum : undefined,
        email: parts[3] || undefined
      };
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
}

export const ImportWizardModal: React.FC<ImportWizardModalProps> = ({
  isOpen,
  onClose,
  onConfirmImport,
  activeWorkspaceId
}) => {
  const [pastedText, setPastedText] = useState('');
  const [parsedItems, setParsedItems] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const runParse = (text: string) => {
    setParseError(null);
    try {
      const items = parseScrapedPayload(text);
      setParsedItems(items);
      if (items.length === 0) {
        setParseError('Không tìm thấy creator hợp lệ trong dữ liệu này.');
      }
    } catch (err: any) {
      console.error('Parse scraped payload error:', err);
      setParsedItems([]);
      setParseError('Không đọc được dữ liệu. Vui lòng kiểm tra lại định dạng JSON/CSV đã dán vào.');
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || !text.trim()) {
        setParseError('Bộ nhớ tạm đang trống. Hãy copy dữ liệu JSON/CSV muốn nhập trước.');
        return;
      }
      setPastedText(text);
      runParse(text);
    } catch (err) {
      setParseError('Trình duyệt chặn đọc Clipboard tự động. Hãy dán (Ctrl+V) dữ liệu vào ô bên dưới rồi bấm "Xử lý dữ liệu".');
    }
  };

  const handleConfirmImport = async () => {
    if (parsedItems.length === 0) return;
    setIsImporting(true);
    setStatusMsg(null);
    try {
      const res = await fetch('/api/creators/batch-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          source: 'TikTok One Extension',
          creators: parsedItems
        })
      });
      const data = await res.json();
      if (data.success) {
        onConfirmImport(parsedItems);
        setStatusMsg(`✅ Đã nhập ${data.importedCount} creator mới (${data.updatedCount} cập nhật) vào workspace ${activeWorkspaceId}.`);
        setParsedItems([]);
        setPastedText('');
      } else {
        setStatusMsg(`❌ Import thất bại: ${data.message || 'Lỗi không xác định'}`);
      }
    } catch (err: any) {
      console.error('Batch import creators error:', err);
      setStatusMsg('❌ Lỗi kết nối tới máy chủ. Vui lòng thử lại.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                TikTok One Bulk Scraper
              </h3>
              <p className="text-xs text-slate-500">
                Cào hàng loạt creator từ TikTok One / Creator Marketplace vào workspace {activeWorkspaceId}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-indigo-950 text-white space-y-3 shadow-md border border-indigo-900/50">
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400 shrink-0" />
              <h4 className="font-bold text-sm text-white">Pickdi TikTok One Scraper (Chrome Extension)</h4>
            </div>
            <p className="text-slate-300 text-xs leading-relaxed">
              Extension thật gọi trực tiếp API tìm creator của TikTok One và đọc số liệu engagement thật từ TikTok — không đoán DOM, không bịa số khi thiếu field.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <a
                href="/api/extension/download"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all text-xs"
              >
                <Download className="w-4 h-4" />
                Download Extension (.zip)
              </a>
            </div>
          </div>

          {/* Step Guide */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center">1</span>
                Tải & giải nén
              </div>
              <p className="text-[11px] text-slate-500">
                Bấm Download rồi giải nén file .zip ra một thư mục.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center">2</span>
                Load unpacked
              </div>
              <p className="text-[11px] text-slate-500">
                Vào <code>chrome://extensions</code> → bật Developer mode → Load unpacked → chọn thư mục vừa giải nén.
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-1">
              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5 text-xs">
                <span className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] flex items-center justify-center">3</span>
                Mở popup & cào
              </div>
              <p className="text-[11px] text-slate-500">
                Nhập Webapp URL trong popup, dùng 3 nút: Tìm creator (TikTok One), Lấy chi tiết trang, Lấy engagement.
              </p>
            </div>
          </div>

          {/* Sync buffer into CRM */}
          <div className="p-4 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-3">
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="font-bold text-slate-900 dark:text-white text-xs">Nhập thủ công (nếu cần)</span>
            </div>
            <p className="text-slate-600 dark:text-slate-400 text-[11px]">
              Extension gửi thẳng data qua nút "Tìm creator" trong popup. Nếu bạn có sẵn JSON/CSV muốn dán thủ công, dùng ô bên dưới.
            </p>

            <button
              onClick={handlePasteFromClipboard}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition-all text-xs"
            >
              <Copy className="w-4 h-4" />
              Dán từ Clipboard
            </button>

            <textarea
              rows={4}
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
              placeholder="Hoặc dán thủ công (Ctrl+V) dữ liệu JSON/CSV tại đây..."
              className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-[11px]"
            />
            <button
              type="button"
              onClick={() => runParse(pastedText)}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs"
            >
              <RefreshCw className="w-4 h-4" /> Xử lý dữ liệu
            </button>

            {parseError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[11px] text-rose-700 dark:text-rose-300">
                {parseError}
              </div>
            )}

            {parsedItems.length > 0 && (
              <div className="space-y-2">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300">
                  Đã đọc được <strong>{parsedItems.length}</strong> creator. Các field không có trong dữ liệu gốc sẽ hiển thị &ldquo;Chưa có dữ liệu&rdquo; trong hồ sơ, không tự bịa số.
                </div>
                <button
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs disabled:opacity-50"
                >
                  {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {isImporting ? 'Đang nhập...' : `Xác nhận nhập ${parsedItems.length} creator`}
                </button>
              </div>
            )}

            {statusMsg && (
              <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium font-mono text-slate-800 dark:text-slate-200">
                {statusMsg}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 text-xs">
          <span className="text-slate-500 font-medium">
            Workspace đích: <strong className="text-slate-800 dark:text-slate-200">{activeWorkspaceId}</strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
