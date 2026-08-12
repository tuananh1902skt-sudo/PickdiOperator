import React, { useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  UserCheck,
  Mail,
  MessageSquare,
  FileCheck2,
  FileText,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Bot,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import { Creator, Campaign, Conversation, DraftReview, Workspace } from '../../types';
import { ChatMessage } from './ChatMessage';

// Maps backend errorType codes to a plain-language label instead of showing raw jargon.
const AI_ERROR_LABELS: Record<string, string> = {
  missing_api_key: 'Chưa cấu hình AI',
  invalid_ai_response: 'Phản hồi AI không hợp lệ',
  ai_call_failed: 'Lỗi hệ thống AI',
};

function friendlyAiErrorLabel(errorType?: string): string {
  return (errorType && AI_ERROR_LABELS[errorType]) || 'Lỗi AI';
}

interface AiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  creators: Creator[];
  campaigns: Campaign[];
  conversations?: Conversation[];
  reviews?: DraftReview[];
  activeWorkspace?: Workspace;
}

export const AiDrawer: React.FC<AiDrawerProps> = ({
  isOpen,
  onClose,
  creators,
  activeWorkspace,
  campaigns,
  conversations = [],
  reviews = []
}) => {
  const [activeMode, setActiveTabMode] = useState<
    'chat' | 'research' | 'email' | 'reply' | 'review' | 'digest'
  >('chat');

  // Input states
  const [selectedCreatorId, setSelectedCreatorId] = useState<string>(creators[0]?.id || '');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>(campaigns[0]?.id || '');
  const [userPrompt, setUserPrompt] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Custom inputs for Review mode when no review exists
  const [customVideoTitle, setCustomVideoTitle] = useState<string>('');
  const [customDraftUrl, setCustomDraftUrl] = useState<string>('');

  // Tracks which mode + request a fetch was fired for, so a slow response from a mode
  // the user has since navigated away from can't overwrite the current mode's result.
  const aiRequestRef = useRef(0);
  const activeModeRef = useRef(activeMode);
  activeModeRef.current = activeMode;

  // Initial welcome message formatted in Markdown
  const initialWelcomeMsg = `### 👋 Xin chào! Tôi là Pickdi AI Affiliate Operator (Gemini 3.6)

Tôi có thể hỗ trợ bạn vận hành chương trình Affiliate TikTok Shop:

* **📌 Hướng dẫn cào dữ liệu**: Cách dùng Pickdi Extension đồng bộ Creator & Chiến dịch về CRM.
* **📊 Phân tích Creator**: Tính điểm Brand Fit Score, nhận diện kênh thật / kênh ảo.
* **✉️ Viết Kịch bản Outreach**: Soạn Email tiếp cận ngắn gọn, tỉ lệ phản hồi cao.
* **💰 Thương lượng & Đàm phán**: Đề xuất mức hoa hồng & phí phẩy tối ưu.
* **📹 Kiểm tra Video Draft**: Đánh giá Hook power & tuân thủ quy định TikTok.

> 💡 **Mẹo:** Bạn có thể chọn nhanh các mẫu gợi ý bên dưới hoặc gõ câu hỏi cụ thể cho tôi nhé!`;

  // Chat message history
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; time: string }[]
  >([
    {
      role: 'assistant',
      text: initialWelcomeMsg,
      time: 'Vừa xong'
    }
  ]);

  if (!isOpen) return null;

  const currentCreator = creators.find(c => c.id === selectedCreatorId) || creators[0];
  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  // `creators` ở đây là danh sách siêu nhẹ (id/handle/displayName/avatar/status/category/
  // brandFitScore — xem /api/creators/lite, App.tsx `creatorsLite`), chỉ đủ để render dropdown
  // "Target Creator". Trước khi gửi cho research/email/reply/review — vốn cần bio/engagementRate/
  // score/metrics thật để AI phân tích đúng — phải fetch lại đầy đủ record qua /api/creators/:id.
  const fetchFullCreator = async (id: string): Promise<Creator | undefined> => {
    try {
      const res = await fetch(`/api/creators/${id}`);
      const data = await res.json();
      return data.success && data.data ? data.data : undefined;
    } catch (err) {
      console.error('Failed to fetch full creator for AI request:', err);
      return undefined;
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Copy to clipboard failed:', err));
  };

  const handleQuickPrompt = (promptText: string) => {
    if (loading) return; // avoid firing a second overlapping chat request mid-flight
    setUserPrompt(promptText);
    executeChatPrompt(promptText);
  };

  const executeChatPrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    setLoading(true);
    const updatedHistory = [
      ...chatMessages,
      {
        role: 'user' as const,
        text: promptText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
    setChatMessages(updatedHistory);
    setUserPrompt('');

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          messages: updatedHistory,
          creatorId: currentCreator?.id,
          campaignId: currentCampaign?.id
        })
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: `> ⚠️ **${friendlyAiErrorLabel(data.errorType)}**: ${data.message || 'Không nhận được phản hồi từ AI. Vui lòng thử lại.'}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
        return;
      }

      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: data.text || data.message || 'Không có phản hồi từ Gemini.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: '> ⚠️ **Lỗi kết nối**: Vui lòng kiểm tra lại kết nối mạng hoặc cấu hình máy chủ.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleRunAi = async () => {
    if (activeMode === 'chat') {
      executeChatPrompt(userPrompt);
      return;
    }

    setLoading(true);
    setAiResult(null);

    const requestId = ++aiRequestRef.current;
    const isStale = () => aiRequestRef.current !== requestId || activeModeRef.current !== activeMode;

    try {
      let res: Response;
      // research/email/reply gửi thẳng object creator cho AI phân tích/soạn nội dung — cần bio/
      // engagementRate/score/metrics thật, không phải bản lite dùng để render dropdown phía trên.
      const fullCreator = currentCreator && (activeMode === 'research' || activeMode === 'email' || activeMode === 'reply')
        ? await fetchFullCreator(currentCreator.id)
        : undefined;
      if (isStale()) return;
      const creatorForAi = fullCreator || currentCreator;

      if (activeMode === 'research') {
        if (!creatorForAi) {
          setAiResult({ error: 'Chưa chọn Creator để phân tích.' });
          return;
        }
        res = await fetch('/api/ai/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creator: creatorForAi, campaignId: currentCampaign?.id })
        });
      } else if (activeMode === 'email') {
        if (!creatorForAi) {
          setAiResult({ error: 'Chưa chọn Creator để viết mail.' });
          return;
        }
        res = await fetch('/api/ai/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creator: creatorForAi, campaign: currentCampaign })
        });
      } else if (activeMode === 'reply') {
        // Tìm cuộc hội thoại thực tế của Creator trong CRM
        const realConv = conversations.find(
          c => c.creatorId === currentCreator?.id || c.creatorHandle?.toLowerCase() === `@${currentCreator?.handle?.toLowerCase()}`
        );

        res = await fetch('/api/ai/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creator: creatorForAi,
            campaign: currentCampaign,
            conversation: realConv || { messages: [] }
          })
        });
      } else if (activeMode === 'review') {
        const realReview = reviews.find(
          r => r.creatorId === currentCreator?.id || r.creatorHandle?.toLowerCase() === `@${currentCreator?.handle?.toLowerCase()}`
        );

        const vTitle = customVideoTitle.trim() || realReview?.videoTitle || `Draft review video cho ${currentCreator?.displayName || 'Creator'}`;
        const dUrl = customDraftUrl.trim() || realReview?.draftUrl || '';

        res = await fetch('/api/ai/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoTitle: vTitle,
            campaignName: currentCampaign?.name || 'Campaign',
            draftUrl: dUrl
          })
        });
      } else if (activeMode === 'digest') {
        res = await fetch('/api/ai/daily-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: activeWorkspace?.isAgency ? undefined : activeWorkspace?.id })
        });
      } else {
        return;
      }

      const json = await res.json();
      if (isStale()) return;
      if (!res.ok || !json.success) {
        setAiResult({
          error: json.message || 'Yêu cầu AI thất bại. Vui lòng thử lại.',
          errorType: json.errorType
        });
      } else {
        setAiResult(json.data);
      }
    } catch (err: any) {
      console.error(err);
      if (!isStale()) {
        setAiResult({ error: 'Lỗi kết nối tới máy chủ. Vui lòng thử lại sau.' });
      }
    } finally {
      if (!isStale()) setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600/80 flex items-center justify-center text-white">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm leading-none flex items-center gap-1.5">
                AI Operator Copilot
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-mono">
                  Gemini 3.6
                </span>
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">Automated research, outreach & reviews</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feature Mode Selector */}
        <div className="grid grid-cols-6 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 p-1 text-[11px] font-medium">
          <button
            onClick={() => { setActiveTabMode('chat'); setAiResult(null); }}
            className={`py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeMode === 'chat' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat</span>
          </button>

          <button
            onClick={() => { setActiveTabMode('research'); setAiResult(null); }}
            className={`py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeMode === 'research' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Research</span>
          </button>

          <button
            onClick={() => { setActiveTabMode('email'); setAiResult(null); }}
            className={`py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeMode === 'email' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>

          <button
            onClick={() => { setActiveTabMode('reply'); setAiResult(null); }}
            className={`py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeMode === 'reply' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Reply</span>
          </button>

          <button
            onClick={() => { setActiveTabMode('review'); setAiResult(null); }}
            className={`py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeMode === 'review' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Review</span>
          </button>

          <button
            onClick={() => { setActiveTabMode('digest'); setAiResult(null); }}
            className={`py-2 flex flex-col items-center gap-1 rounded-lg transition-all ${
              activeMode === 'digest' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 font-bold shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Digest</span>
          </button>
        </div>

        {/* Target Selectors */}
        {(activeMode === 'research' || activeMode === 'email' || activeMode === 'reply') && (
          <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 grid grid-cols-2 gap-2 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Creator</label>
              <select
                value={selectedCreatorId}
                onChange={e => setSelectedCreatorId(e.target.value)}
                className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
              >
                {creators.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.displayName} (@{c.handle})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Target Campaign</label>
              <select
                value={selectedCampaignId}
                onChange={e => setSelectedCampaignId(e.target.value)}
                className="w-full p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-medium"
              >
                {campaigns.map(cmp => (
                  <option key={cmp.id} value={cmp.id}>
                    {cmp.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeMode === 'chat' && (
            <div className="space-y-4">
              {/* Quick Suggestion Chips */}
              <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-[10px] font-bold text-slate-400 uppercase w-full flex items-center gap-1 mb-1">
                  <Lightbulb className="w-3 h-3 text-amber-500" /> Gợi ý câu hỏi nhanh:
                </span>
                <button
                  onClick={() => handleQuickPrompt('Hướng dẫn cào dữ liệu TikTok Creator qua Pickdi Extension từng bước')}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-200 dark:border-indigo-800 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 transition-all text-left flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📌 Hướng dẫn cào Extension
                </button>
                <button
                  onClick={() => handleQuickPrompt(`Phân tích độ phù hợp thương hiệu (Brand Fit) của Creator @${currentCreator?.handle || 'creator'}`)}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-all text-left flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  📊 Phân tích Creator hiện tại
                </button>
                <button
                  onClick={() => handleQuickPrompt(`Soạn kịch bản Outreach email mời mở mẫu thử & hoa hồng cho campaign ${currentCampaign?.name || 'Chiến dịch'}`)}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-all text-left flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  ✉️ Kịch bản Outreach mời mở mẫu
                </button>
                <button
                  onClick={() => handleQuickPrompt('Tư vấn chiến lược thương lượng hoa hồng % và Booking Fee cho Creator TikTok Shop')}
                  disabled={loading}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-700 dark:text-slate-200 transition-all text-left flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  💰 Thương lượng Hoa hồng & Fee
                </button>
              </div>

              {/* Message List */}
              <div className="space-y-4">
                {chatMessages.map((msg, idx) => (
                  <ChatMessage key={idx} role={msg.role} text={msg.text} time={msg.time} />
                ))}

                {/* Loading indicator bubble */}
                {loading && (
                  <div className="flex gap-2.5 items-start">
                    <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center shrink-0 animate-pulse">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 rounded-2xl rounded-tl-xs bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      <span>Gemini 3.6 đang phân tích dữ liệu CRM & phản hồi...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Result Cards for structured modes */}
          {aiResult && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3 animate-in fade-in duration-200 text-xs text-slate-800 dark:text-slate-200">
              {aiResult.error ? (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-rose-800 dark:text-rose-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    <span>Thông báo AI</span>
                  </div>
                  <p className="leading-relaxed">{aiResult.error}</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-900 pb-2">
                    <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-500" />
                      {aiResult.source === 'deterministic' ? 'Thống kê Tổng quan (Deterministic)' : 'Kết quả từ Gemini AI'}
                      {aiResult.cached && (
                        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] bg-amber-100 text-amber-800 font-semibold">
                          ⚡ Cached
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => handleCopy(JSON.stringify(aiResult, null, 2))}
                      className="px-2 py-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-800 rounded text-[11px] flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold"
                    >
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>

                  {/* Research render */}
                  {activeMode === 'research' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Brand Fit Score:</span>
                        <span className="px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                          {aiResult.brandFitScore || 90}/100
                        </span>
                      </div>
                      <p><strong>Summary:</strong> {aiResult.summary}</p>
                      <div>
                        <strong>Strengths:</strong>
                        <ul className="list-disc pl-4 space-y-0.5 mt-1">
                          {aiResult.strengths?.map((s: string, i: number) => <li key={i}>{s}</li>)}
                        </ul>
                      </div>
                      <p><strong>Recommendation:</strong> <span className="font-bold text-indigo-600">{aiResult.recommendation}</span></p>
                    </div>
                  )}

                  {/* Email render */}
                  {activeMode === 'email' && (
                    <div className="space-y-2">
                      <p><strong>Subject:</strong> {aiResult.subject}</p>
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 whitespace-pre-wrap font-sans text-xs">
                        {aiResult.body}
                      </div>
                      <p><strong>Lead CTA:</strong> {aiResult.cta}</p>
                    </div>
                  )}

                  {/* Reply render */}
                  {activeMode === 'reply' && (
                    <div className="space-y-2">
                      <p><strong>Negotiation Strategy:</strong> {aiResult.negotiationStrategy}</p>
                      <div className="p-2.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800 whitespace-pre-wrap text-xs font-sans">
                        {aiResult.suggestedReply}
                      </div>
                      <p><strong>Suggested Action:</strong> <span className="font-bold text-emerald-600">{aiResult.suggestedNextAction}</span></p>
                    </div>
                  )}

                  {/* Review render */}
                  {activeMode === 'review' && (
                    <div className="space-y-2.5">
                      <div className="p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg text-amber-800 dark:text-amber-300 text-[11px] font-medium flex items-start gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>⚠️ Phân tích dựa trên tiêu đề & context, chưa xem nội dung video thật — Operator cần tự xem video trước khi Approve.</span>
                      </div>

                      {Array.isArray(aiResult.keyObservations) && aiResult.keyObservations.length > 0 && (
                        <div>
                          <strong>Nhận xét từ Metadata:</strong>
                          <ul className="list-disc pl-4 space-y-0.5 mt-1 text-slate-600 dark:text-slate-300">
                            {aiResult.keyObservations.map((obs: string, idx: number) => (
                              <li key={idx}>{obs}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {aiResult.improvementSuggestions && (
                        <p><strong>Gợi ý cải thiện:</strong> {aiResult.improvementSuggestions}</p>
                      )}

                      {aiResult.recommendation && (
                        <p><strong>Khuyến nghị AI:</strong> <span className="font-bold text-emerald-600">{aiResult.recommendation}</span></p>
                      )}
                    </div>
                  )}

                  {/* Digest render */}
                  {activeMode === 'digest' && (
                    <div className="space-y-2">
                      {aiResult.source === 'deterministic' && (
                        <div className="p-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                          ℹ️ Bản tóm tắt này được tổng hợp tự động từ số liệu hệ thống (Chưa cấu hình Gemini API hoặc dùng Fallback).
                        </div>
                      )}
                      <p><strong>Progress Summary:</strong> {aiResult.progressSummary}</p>
                      {Array.isArray(aiResult.urgentPriorities) && aiResult.urgentPriorities.length > 0 && (
                        <div>
                          <strong>Ưu tiên cần làm:</strong>
                          <ul className="list-disc pl-4 space-y-0.5 mt-1">
                            {aiResult.urgentPriorities.map((item: string, idx: number) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <p><strong>Khuyến nghị vận hành:</strong> {aiResult.aiRecommendation}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer Trigger Controls */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
          {activeMode === 'chat' ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={userPrompt}
                onChange={e => setUserPrompt(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && userPrompt.trim() && handleRunAi()}
                placeholder="Ask Copilot anything..."
                className="flex-1 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleRunAi}
                disabled={loading || !userPrompt.trim()}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
              >
                {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
          ) : (
            <button
              onClick={handleRunAi}
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating with Gemini 3.6...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Run {activeMode.toUpperCase()} Generation
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
