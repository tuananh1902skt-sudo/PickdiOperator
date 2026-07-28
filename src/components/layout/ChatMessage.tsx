import React, { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import { Bot, User, Copy, Check, Sparkles } from 'lucide-react';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  text: string;
  time?: string;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ role, text, time }) => {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }).catch(err => console.error('Copy to clipboard failed:', err));
  };

  const isUser = role === 'user';

  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'} items-start group`}>
      {/* Avatar */}
      <div
        className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
          isUser
            ? 'bg-slate-800 dark:bg-slate-700 text-white'
            : 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white'
        }`}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Message Content Container */}
      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[92%]`}>
        {/* Name / Badge Header */}
        <div className="flex items-center gap-1.5 mb-1 px-1">
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {isUser ? 'Bạn' : 'Pickdi AI Copilot'}
          </span>
          {!isUser && (
            <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5" /> Gemini 3.6
            </span>
          )}
          {time && <span className="text-[10px] text-slate-400 font-mono">{time}</span>}
        </div>

        {/* Bubble */}
        <div
          className={`relative p-3.5 rounded-2xl text-xs leading-relaxed shadow-xs transition-all ${
            isUser
              ? 'bg-indigo-600 text-white rounded-tr-xs'
              : 'bg-white dark:bg-slate-800/90 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/90 dark:border-slate-700/80'
          }`}
        >
          {isUser ? (
            <div className="whitespace-pre-wrap font-sans">{text}</div>
          ) : (
            <div className="markdown-body space-y-2.5 text-xs">
              <Markdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-sm font-bold text-slate-900 dark:text-white mt-2 mb-1 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-700/50 pb-1">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-xs font-bold text-indigo-700 dark:text-indigo-300 mt-2 mb-1 flex items-center gap-1">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-2 mb-1">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => <p className="leading-relaxed my-1">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="list-disc pl-4 space-y-1 my-1 text-slate-700 dark:text-slate-200">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-4 space-y-1 my-1 text-slate-700 dark:text-slate-200">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => <li className="leading-normal">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="my-2 p-2.5 rounded-r-xl border-l-4 border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 font-medium text-xs leading-relaxed">
                      {children}
                    </blockquote>
                  ),
                  hr: () => <hr className="my-2.5 border-t border-slate-200 dark:border-slate-700" />,
                  code: ({ children }) => (
                    <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700/70 text-indigo-600 dark:text-indigo-300 font-mono text-[11px] border border-slate-200 dark:border-slate-600">
                      {children}
                    </code>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-bold text-slate-900 dark:text-white">{children}</strong>
                  ),
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 dark:text-indigo-400 font-medium underline hover:text-indigo-700 transition-colors"
                    >
                      {children}
                    </a>
                  )
                }}
              >
                {text}
              </Markdown>
            </div>
          )}

          {/* Assistant Action Bar (Copy Button) */}
          {!isUser && (
            <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between text-[10px] text-slate-400">
              <span className="text-[10px] text-slate-400">Pickdi Operator Assistant</span>
              <button
                onClick={handleCopy}
                className="px-2 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 transition-all"
                title="Copy tin nhắn"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Đã copy' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
