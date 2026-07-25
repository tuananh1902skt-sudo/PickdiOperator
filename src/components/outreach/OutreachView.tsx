import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Kanban,
  Inbox,
  Clock,
  RefreshCw,
  Mail
} from 'lucide-react';
import {
  Creator,
  CreatorStatus,
  Campaign,
  OutreachEmail,
  Conversation
} from '../../types';

interface OutreachViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  outreachList: OutreachEmail[];
  conversations: Conversation[];
  onOpenEmailComposer: (cr: Creator) => void;
  onSendReply: (convId: string, content: string, isAiGenerated?: boolean) => void;
  onUpdateCreatorStatus: (creatorId: string, status: CreatorStatus) => void;
}

export const OutreachView: React.FC<OutreachViewProps> = ({
  creators,
  campaigns,
  outreachList,
  conversations,
  onOpenEmailComposer,
  onSendReply,
  onUpdateCreatorStatus
}) => {
  const [activeTab, setActiveTab] = useState<'kanban' | 'inbox' | 'history'>('kanban');
  const [selectedConvId, setSelectedConvId] = useState<string>(conversations[0]?.id || '');
  const [replyInput, setReplyInput] = useState('');
  const [aiReplyLoading, setAiReplyLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  const pipelineStages: { label: string; status: Creator['status']; color: string }[] = [
    { label: 'New Lead', status: 'New Lead', color: 'border-slate-300' },
    { label: 'Qualified', status: 'Qualified', color: 'border-blue-400' },
    { label: 'Contacted', status: 'Contacted', color: 'border-indigo-400' },
    { label: 'Negotiating', status: 'Negotiating', color: 'border-amber-400' },
    { label: 'Approved', status: 'Approved', color: 'border-emerald-400' },
    { label: 'Completed', status: 'Completed', color: 'border-emerald-600' }
  ];

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

        {/* View Switcher Tabs */}
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

          <button
            onClick={() => setActiveTab('inbox')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'inbox' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold' : ''
            }`}
          >
            <Inbox className="w-4 h-4" />
            Conversation Inbox
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
              activeTab === 'history' ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs font-bold' : ''
            }`}
          >
            <Clock className="w-4 h-4" />
            Sent History ({outreachList.length})
          </button>
        </div>
      </div>

      {/* VIEW 1: PIPELINE KANBAN */}
      {activeTab === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {pipelineStages.map(stage => {
            const stageCreators = creators.filter(c => c.status === stage.status);

            return (
              <div
                key={stage.status}
                className="w-72 shrink-0 bg-slate-100/70 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[75vh]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200 dark:border-slate-800">
                  <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                    {stage.label}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {stageCreators.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="flex-1 overflow-y-auto space-y-3">
                  {stageCreators.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      No creators in this stage
                    </div>
                  ) : (
                    stageCreators.map(cr => (
                      <div
                        key={cr.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 shadow-2xs space-y-2.5 hover:border-indigo-300 transition-all group"
                      >
                        <div className="flex items-center gap-2.5">
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
                          {cr.brandFitScore !== undefined && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                              Score {cr.brandFitScore}
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 line-clamp-1">
                          Category: <strong className="text-slate-700 dark:text-slate-300">{cr.category || '—'}</strong>
                        </div>

                        {/* Move Stage dropdown */}
                        <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between">
                          <button
                            onClick={() => onOpenEmailComposer(cr)}
                            className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" /> Outreach
                          </button>

                          <select
                            value={cr.status}
                            onChange={e => onUpdateCreatorStatus(cr.id, e.target.value as CreatorStatus)}
                            className="text-[10px] py-1 px-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
                          >
                            {pipelineStages.map(s => (
                              <option key={s.status} value={s.status}>
                                {s.status === cr.status ? s.label : `Move: ${s.label}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VIEW 2: CONVERSATION INBOX */}
      {activeTab === 'inbox' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[75vh] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-900 shadow-2xs">
          {/* Left Column: Conversation List */}
          <div className="lg:col-span-4 border-r border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Active Creator Messages ({conversations.length})
              </span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {conversations.map(c => (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedConvId(c.id);
                    setAiSuggestion(null);
                  }}
                  className={`p-3.5 flex items-start gap-3 cursor-pointer transition-colors ${
                    c.id === selectedConvId
                      ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-l-4 border-indigo-600'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <img src={c.creatorAvatar} alt={c.creatorName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-slate-900 dark:text-white truncate">{c.creatorName}</span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(c.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 truncate font-medium">
                      {c.messages[c.messages.length - 1]?.content || <span className="italic text-slate-400">No messages yet</span>}
                    </p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                      {c.status}
                    </span>
                  </div>
                </div>
              ))}
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
                      <span className="text-[10px] text-slate-400">{currentConv.campaignName || 'General Outreach'}</span>
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
      )}

      {/* VIEW 3: SENT HISTORY */}
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
