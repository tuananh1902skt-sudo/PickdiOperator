import React, { useState, useEffect, useMemo } from 'react';
import {
  Send,
  Sparkles,
  Inbox as InboxIcon,
  RefreshCw,
  AlertTriangle,
  UserCheck,
  X,
  Filter,
  Search
} from 'lucide-react';
import {
  Creator,
  Campaign,
  Conversation,
  UnmatchedInboundEmail,
  Workspace
} from '../../types';

interface InboxViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  conversations: Conversation[];
  workspaces: Workspace[];
  onSendReply: (convId: string, content: string, isAiGenerated?: boolean) => void;
  onCheckInbox?: () => Promise<{ success: boolean; imported?: number; skipped?: number; message?: string }>;
  onRefreshData?: () => void;
}

// Deterministic color per campaign/brand label so the same name always renders with the
// same badge color across the inbox, without needing a stored color field anywhere.
const LABEL_COLORS = [
  'bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300',
  'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
];

const labelColorFor = (label: string) => {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return LABEL_COLORS[hash % LABEL_COLORS.length];
};

export const InboxView: React.FC<InboxViewProps> = ({
  creators,
  campaigns,
  conversations,
  workspaces,
  onSendReply,
  onCheckInbox,
  onRefreshData
}) => {
  const [selectedConvId, setSelectedConvId] = useState<string>(conversations[0]?.id || '');
  const [replyInput, setReplyInput] = useState('');
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [checkingInbox, setCheckingInbox] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);
  const [unmatchedList, setUnmatchedList] = useState<UnmatchedInboundEmail[]>([]);
  const [isUnmatchedModalOpen, setIsUnmatchedModalOpen] = useState(false);
  const [selectedAssignments, setSelectedAssignments] = useState<Record<string, string>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('ALL');
  const [brandFilter, setBrandFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchUnmatchedEmails = async () => {
    try {
      const res = await fetch('/api/inbox/unmatched');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setUnmatchedList(data.data);
          const initialMap: Record<string, string> = {};
          data.data.forEach((item: UnmatchedInboundEmail) => {
            if (item.candidateCreatorIds && item.candidateCreatorIds.length > 0) {
              initialMap[item.id] = item.candidateCreatorIds[0];
            }
          });
          setSelectedAssignments(initialMap);
        }
      }
    } catch (err) {
      console.error('Error fetching unmatched emails:', err);
    }
  };

  useEffect(() => {
    fetchUnmatchedEmails();
  }, []);

  const handleCheckInboxClick = async () => {
    setCheckingInbox(true);
    setSyncStatusMsg(null);
    try {
      let result: { success: boolean; imported?: number; skipped?: number; message?: string };
      if (onCheckInbox) {
        result = await onCheckInbox();
      } else {
        const res = await fetch('/api/inbox/check', { method: 'POST' });
        result = await res.json();
      }

      await fetchUnmatchedEmails();

      if (result && result.success) {
        setSyncStatusMsg(`Đã đồng bộ: ${result.imported ?? 0} tin nhắn mới, ${result.skipped ?? 0} bỏ qua`);
        if (onRefreshData) onRefreshData();
      } else {
        setSyncStatusMsg(`Lỗi đồng bộ: ${result?.message || 'Không thể kiểm tra inbox lúc này. Vui lòng thử lại.'}`);
      }
    } catch (err: any) {
      console.error('Check inbox error:', err);
      setSyncStatusMsg('Lỗi kết nối tới máy chủ. Vui lòng thử lại sau.');
    } finally {
      setCheckingInbox(false);
    }
  };

  const handleAssignUnmatched = async (unmatchedId: string) => {
    const targetCreatorId = selectedAssignments[unmatchedId];
    if (!targetCreatorId) {
      alert('Vui lòng chọn 1 creator để gán!');
      return;
    }

    setAssigningId(unmatchedId);
    try {
      const res = await fetch(`/api/inbox/unmatched/${unmatchedId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: targetCreatorId })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUnmatchedList(prev => prev.filter(item => item.id !== unmatchedId));
        if (onRefreshData) onRefreshData();
      } else {
        alert(`Lỗi gán email: ${data.message || 'Không thể gán'}`);
      }
    } catch (err: any) {
      console.error('Assign unmatched email error:', err);
      alert('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setAssigningId(null);
    }
  };

  const brandNameFor = (conv?: Conversation) =>
    conv?.workspaceId ? workspaces.find(w => w.id === conv.workspaceId)?.brandName : undefined;

  const campaignOptions = useMemo(
    () => Array.from(new Set(conversations.map(c => c.campaignName).filter(Boolean))) as string[],
    [conversations]
  );
  const brandOptions = useMemo(
    () => Array.from(new Set(conversations.map(c => brandNameFor(c)).filter(Boolean))) as string[],
    [conversations, workspaces]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(conversations.map(c => c.status))),
    [conversations]
  );

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return conversations.filter(c => {
      if (unreadOnly && !c.unread) return false;
      if (campaignFilter !== 'ALL' && c.campaignName !== campaignFilter) return false;
      if (brandFilter !== 'ALL' && brandNameFor(c) !== brandFilter) return false;
      if (statusFilter !== 'ALL' && c.status !== statusFilter) return false;
      if (q) {
        const haystack = `${c.creatorName} ${c.creatorHandle} ${c.campaignName || ''} ${brandNameFor(c) || ''}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [conversations, workspaces, searchQuery, campaignFilter, brandFilter, statusFilter, unreadOnly]);

  const hasActiveFilters =
    searchQuery.trim() !== '' || campaignFilter !== 'ALL' || brandFilter !== 'ALL' || statusFilter !== 'ALL' || unreadOnly;

  const resetFilters = () => {
    setSearchQuery('');
    setCampaignFilter('ALL');
    setBrandFilter('ALL');
    setStatusFilter('ALL');
    setUnreadOnly(false);
  };

  const currentConv = conversations.find(c => c.id === selectedConvId) || conversations[0];
  const currentCreator = creators.find(c => c.id === currentConv?.creatorId);
  const currentCampaign = campaigns.find(c => c.id === currentConv?.campaignId);

  const handleGenerateAiReply = async () => {
    if (!currentConv || !currentCreator) return;
    setAiReplyLoading(true);
    try {
      const res = await fetch('/api/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversation: currentConv,
          creator: currentCreator,
          campaign: currentCampaign
        })
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAiSuggestion(json.data);
        setReplyInput(json.data.suggestedReply || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAiReplyLoading(false);
    }
  };

  const handleSendReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || !selectedConvId) return;
    onSendReply(selectedConvId, replyInput, !!aiSuggestion);
    setReplyInput('');
    setAiSuggestion(null);
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <InboxIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Inbox
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Toàn bộ hội thoại với creator, mỗi luồng gắn nhãn Campaign & Brand để dễ phân loại
          </p>
        </div>

        <button
          onClick={handleCheckInboxClick}
          disabled={checkingInbox}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${checkingInbox ? 'animate-spin' : ''}`} />
          {checkingInbox ? 'Đang kiểm tra mail...' : 'Kiểm tra mail mới'}
        </button>
      </div>

      {syncStatusMsg && (
        <div className="px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 dark:bg-indigo-950 dark:border-indigo-900 dark:text-indigo-200 text-xs font-medium flex items-center justify-between">
          <span>{syncStatusMsg}</span>
          <button onClick={() => setSyncStatusMsg(null)} className="text-slate-400 hover:text-slate-600 font-bold ml-2">×</button>
        </div>
      )}

      {unmatchedList.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-950/60 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              ⚠️ <strong>{unmatchedList.length}</strong> email chưa xác định được người gửi — cần gán thủ công
            </span>
          </div>
          <button
            onClick={() => setIsUnmatchedModalOpen(true)}
            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all shrink-0"
          >
            Xem & Gán thủ công
          </button>
        </div>
      )}

      {/* Conversation Inbox */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[75vh] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
        {/* Left Column: Conversation List */}
        <div className="lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Active Creator Messages ({filteredConversations.length}/{conversations.length})
              </span>
              {hasActiveFilters && (
                <button
                  onClick={resetFilters}
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Xoá lọc
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Tìm creator, campaign, brand..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto">
              <Filter className="w-3 h-3 text-slate-400 shrink-0" />
              <select
                value={campaignFilter}
                onChange={e => setCampaignFilter(e.target.value)}
                className="shrink-0 py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Campaign</option>
                {campaignOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                value={brandFilter}
                onChange={e => setBrandFilter(e.target.value)}
                className="shrink-0 py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Brand</option>
                {brandOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="shrink-0 py-1 px-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 text-[10px] font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Status</option>
                {statusOptions.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <button
                onClick={() => setUnreadOnly(v => !v)}
                className={`shrink-0 py-1 px-2 rounded-md text-[10px] font-bold border transition-colors ${
                  unreadOnly
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                Chưa đọc
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Không có hội thoại nào khớp bộ lọc
              </div>
            ) : (
              filteredConversations.map(c => {
                const brandName = brandNameFor(c);
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedConvId(c.id);
                      setAiSuggestion(null);
                    }}
                    className={`relative p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                      c.id === selectedConvId
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                        : c.unread
                        ? 'bg-indigo-50/30 dark:bg-indigo-950/20 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    {c.unread && (
                      <span className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                    )}
                    <img src={c.creatorAvatar} alt={c.creatorName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    <div className="flex-1 min-w-0 text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`truncate ${c.unread ? 'font-extrabold text-slate-900 dark:text-white' : 'font-bold text-slate-900 dark:text-white'}`}>
                          {c.creatorName}
                        </span>
                        <span className={`text-[10px] shrink-0 ${c.unread ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-slate-400'}`}>
                          {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className={`truncate ${c.unread ? 'text-slate-900 dark:text-white font-semibold' : 'text-slate-600 dark:text-slate-300 font-medium'}`}>
                        {c.messages[c.messages.length - 1]?.content || c.lastMessagePreview || <span className="italic text-slate-400">No messages yet</span>}
                      </p>
                      <div className="flex items-center flex-wrap gap-1 mt-1.5">
                        {c.campaignName && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${labelColorFor(c.campaignName)}`}>
                            {c.campaignName}
                          </span>
                        )}
                        {brandName && (
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${labelColorFor(brandName)}`}>
                            {brandName}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {c.status}
                        </span>
                        {c.unread && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-600 text-white">
                            Mới
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Center Column: Thread Chat Window */}
        <div className="lg:col-span-8 flex flex-col h-full bg-slate-50/30 dark:bg-slate-900">
          {currentConv ? (
            <>
              {/* Chat Header */}
              <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img src={currentConv.creatorAvatar} alt={currentConv.creatorName} className="w-8 h-8 rounded-full object-cover" />
                  <div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs leading-none">
                      {currentConv.creatorName} ({currentConv.creatorHandle})
                    </h4>
                    <div className="flex items-center flex-wrap gap-1 mt-1">
                      {currentConv.campaignName && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${labelColorFor(currentConv.campaignName)}`}>
                          {currentConv.campaignName}
                        </span>
                      )}
                      {brandNameFor(currentConv) && (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${labelColorFor(brandNameFor(currentConv)!)}`}>
                          {brandNameFor(currentConv)}
                        </span>
                      )}
                      {!currentConv.campaignName && <span className="text-[10px] text-slate-400">General Outreach</span>}
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleGenerateAiReply}
                  disabled={aiReplyLoading}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-2xs"
                >
                  {aiReplyLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  AI Reply Assistant
                </button>
              </div>

              {/* AI Suggestion Banner if present */}
              {aiSuggestion && (
                <div className="m-3 p-3 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-900 rounded-xl text-xs space-y-1">
                  <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" /> AI Suggested Strategy: {aiSuggestion.negotiationStrategy}
                  </div>
                  <div className="text-slate-700 dark:text-slate-300">
                    Next Best Action: <strong>{aiSuggestion.suggestedNextAction}</strong>
                  </div>
                </div>
              )}

              {/* Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {currentConv.messages.map(m => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.senderType === 'USER' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-2xl text-xs leading-relaxed ${
                        m.senderType === 'USER'
                          ? 'bg-indigo-600 text-white rounded-br-none'
                          : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-bl-none'
                      }`}
                    >
                      {m.content}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 px-1">
                      {m.senderName} • {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Input Area */}
              <form onSubmit={handleSendReplySubmit} className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-2">
                <input
                  type="text"
                  value={replyInput}
                  onChange={e => setReplyInput(e.target.value)}
                  placeholder="Write a message reply or use AI suggested reply..."
                  className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!replyInput.trim()}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  Send Reply
                </button>
              </form>
            </>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">
              Select a conversation from the left to open chat
            </div>
          )}
        </div>
      </div>

      {/* MODAL: Manual Review & Assign for Unmatched Inbound Emails */}
      {isUnmatchedModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Gán thủ công Email chưa xác định người gửi ({unmatchedList.length})
                </h3>
              </div>
              <button
                onClick={() => setIsUnmatchedModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              {unmatchedList.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  Không còn email nào chưa gán! All caught up 🎉
                </div>
              ) : (
                unmatchedList.map(item => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 dark:border-slate-700/60 pb-2">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {item.senderName ? `${item.senderName} (${item.senderEmail})` : item.senderEmail}
                        </span>
                        <p className="text-slate-500 text-[11px] font-medium mt-0.5">
                          Chủ đề: <strong>{item.subject}</strong>
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 shrink-0">
                        {new Date(item.receivedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {item.content || '(Nội dung trống)'}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 shrink-0">
                          Gán cho Creator:
                        </label>
                        <select
                          value={selectedAssignments[item.id] || ''}
                          onChange={e =>
                            setSelectedAssignments(prev => ({
                              ...prev,
                              [item.id]: e.target.value
                            }))
                          }
                          className="flex-1 py-1.5 px-2 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500"
                        >
                          {item.candidateCreatorIds.map(cid => {
                            const candidate = creators.find(c => c.id === cid);
                            return (
                              <option key={cid} value={cid}>
                                {candidate ? `${candidate.displayName} (@${candidate.handle})` : cid}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <button
                        onClick={() => handleAssignUnmatched(item.id)}
                        disabled={assigningId === item.id}
                        className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg font-bold text-xs flex items-center gap-1 shrink-0"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {assigningId === item.id ? 'Đang gán...' : 'Gán vào Conversation'}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setIsUnmatchedModalOpen(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
