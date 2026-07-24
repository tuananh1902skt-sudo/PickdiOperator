import React, { useState } from 'react';
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
  Bot
} from 'lucide-react';
import { Creator, Campaign } from '../../types';

interface AiDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  creators: Creator[];
  campaigns: Campaign[];
}

export const AiDrawer: React.FC<AiDrawerProps> = ({
  isOpen,
  onClose,
  creators,
  campaigns
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

  // Chat message history
  const [chatMessages, setChatMessages] = useState<
    { role: 'user' | 'assistant'; text: string; time: string }[]
  >([
    {
      role: 'assistant',
      text: 'Xin chào! I am your AI Affiliate Operator Copilot powered by Gemini. How can I assist your TikTok Shop operations today?',
      time: 'Just now'
    }
  ]);

  if (!isOpen) return null;

  const currentCreator = creators.find(c => c.id === selectedCreatorId) || creators[0];
  const currentCampaign = campaigns.find(c => c.id === selectedCampaignId) || campaigns[0];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunAi = async () => {
    setLoading(true);
    setAiResult(null);

    try {
      if (activeMode === 'chat') {
        const textMsg = userPrompt;
        if (!textMsg) return;

        setChatMessages(prev => [
          ...prev,
          { role: 'user', text: textMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
        ]);
        setUserPrompt('');

        const res = await fetch('/api/ai/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creator: currentCreator })
        });
        const data = await res.json();

        setChatMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: `Analyzed @${currentCreator.handle}: Brand Fit Score is ${data.data?.brandFitScore || 90}/100. ${data.data?.summary || 'Great candidate for skincare & beauty campaigns!'}`,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      } else if (activeMode === 'research') {
        const res = await fetch('/api/ai/research', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creator: currentCreator })
        });
        const json = await res.json();
        setAiResult(json.data);
      } else if (activeMode === 'email') {
        const res = await fetch('/api/ai/email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ creator: currentCreator, campaign: currentCampaign })
        });
        const json = await res.json();
        setAiResult(json.data);
      } else if (activeMode === 'reply') {
        const res = await fetch('/api/ai/reply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            creator: currentCreator,
            campaign: currentCampaign,
            conversation: {
              messages: [
                { senderName: currentCreator.displayName, senderType: 'CREATOR', content: 'Hi, I received your proposal. Can you cover $800 rate + 15% commission?' }
              ]
            }
          })
        });
        const json = await res.json();
        setAiResult(json.data);
      } else if (activeMode === 'review') {
        const res = await fetch('/api/ai/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            videoTitle: `Draft video test for ${currentCampaign.name}`,
            campaignName: currentCampaign.name,
            draftUrl: 'https://tiktok.com/@sample/video'
          })
        });
        const json = await res.json();
        setAiResult(json.data);
      } else if (activeMode === 'digest') {
        const res = await fetch('/api/ai/daily-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const json = await res.json();
        setAiResult(json.data);
      }
    } catch (err) {
      console.error(err);
      setAiResult({ error: 'AI request failed. Please verify process.env.GEMINI_API_KEY.' });
    } finally {
      setLoading(false);
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
            <div className="space-y-3">
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 px-1">{msg.time}</span>
                </div>
              ))}
            </div>
          )}

          {/* AI Result Cards for structured modes */}
          {aiResult && (
            <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3 animate-in fade-in duration-200 text-xs text-slate-800 dark:text-slate-200">
              <div className="flex items-center justify-between border-b border-indigo-200 dark:border-indigo-900 pb-2">
                <span className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  Gemini Generated Result
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Hook Quality Score:</span>
                    <span className="font-bold text-indigo-600">{aiResult.hookQualityScore}/100</span>
                  </div>
                  <p><strong>Improvement Suggestions:</strong> {aiResult.improvementSuggestions}</p>
                  <p><strong>Recommendation:</strong> <span className="font-bold text-emerald-600">{aiResult.recommendation}</span></p>
                </div>
              )}

              {/* Digest render */}
              {activeMode === 'digest' && (
                <div className="space-y-2">
                  <p><strong>Progress Summary:</strong> {aiResult.progressSummary}</p>
                  <p><strong>Strategic AI Focus:</strong> {aiResult.aiRecommendation}</p>
                </div>
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
                onKeyDown={e => e.key === 'Enter' && handleRunAi()}
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
