import React, { useEffect, useState } from 'react';
import { Sparkles, RotateCcw, Save, PlayCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface AgentPromptInfo {
  id: string;
  label: string;
  defaultInstructions: string;
  customInstructions: string | null;
  isCustom: boolean;
}

const DOMAIN_LABELS: Record<string, string> = {
  outreach: 'Outreach',
  negotiation: 'Negotiation',
  creator: 'Creator Management',
  review: 'Reviews / Compliance',
  ops: 'Dashboard / Ops',
};

function domainOf(agentId: string) {
  return agentId.split('.')[0];
}

const AgentRow: React.FC<{ agent: AgentPromptInfo; onChanged: () => void }> = ({ agent, onChanged }) => {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(agent.customInstructions ?? agent.defaultInstructions);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(agent.customInstructions ?? agent.defaultInstructions);
  }, [agent.customInstructions, agent.defaultInstructions]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/agent-prompts/${agent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customInstructions: draft }),
      });
      const json = await res.json();
      if (json.success) {
        setMessage('Đã lưu.');
        onChanged();
      } else {
        setMessage(json.message || 'Lưu thất bại.');
      }
    } catch {
      setMessage('Lưu thất bại — kiểm tra kết nối.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/agent-prompts/${agent.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setDraft(agent.defaultInstructions);
        setMessage('Đã đưa về mặc định.');
        onChanged();
      }
    } catch {
      setMessage('Reset thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);
    try {
      const res = await fetch(`/api/agent-prompts/${agent.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customInstructions: draft }),
      });
      const json = await res.json();
      if (json.success) {
        setTestResult(json.data);
      } else {
        setTestError(json.message || 'Test thất bại.');
      }
    } catch {
      setTestError('Test thất bại — kiểm tra kết nối.');
    } finally {
      setTesting(false);
    }
  };

  const isDirty = draft !== (agent.customInstructions ?? agent.defaultInstructions);

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">{agent.label}</span>
          <code className="text-[10px] text-slate-400">{agent.id}</code>
          {agent.isCustom && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
              Custom
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="p-3.5 space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Instructions (behavior/tone — dữ liệu creator/campaign live và JSON output contract luôn cố định, không thể sửa ở đây)
            </label>
            <textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              rows={6}
              className="w-full p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-[11px] leading-relaxed"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-3 py-1.5 bg-indigo-600 disabled:opacity-40 text-white font-bold rounded-lg flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            {agent.isCustom && (
              <button
                type="button"
                onClick={handleReset}
                disabled={saving}
                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-lg flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Reset to default
              </button>
            )}
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="px-3 py-1.5 bg-emerald-600 disabled:opacity-40 text-white font-bold rounded-lg flex items-center gap-1.5"
            >
              <PlayCircle className="w-3.5 h-3.5" /> {testing ? 'Đang chạy…' : 'Test với dữ liệu mẫu'}
            </button>
            {message && <span className="text-slate-400">{message}</span>}
          </div>

          {testError && (
            <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300">{testError}</div>
          )}
          {testResult && (
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 whitespace-pre-wrap font-mono text-[11px]">
              {typeof testResult.text === 'string' ? testResult.text : JSON.stringify(testResult, null, 2)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const AgentPromptStudio: React.FC = () => {
  const [agents, setAgents] = useState<AgentPromptInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    fetch('/api/agent-prompts')
      .then(res => res.json())
      .then(json => {
        if (json.success) setAgents(json.data);
        else setError(json.message || 'Không tải được danh sách agent.');
      })
      .catch(() => setError('Không tải được danh sách agent — kiểm tra kết nối.'));
  };

  useEffect(() => { load(); }, []);

  const grouped = (agents || []).reduce<Record<string, AgentPromptInfo[]>>((acc, agent) => {
    const key = domainOf(agent.id);
    (acc[key] = acc[key] || []).push(agent);
    return acc;
  }, {});

  return (
    <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-indigo-600" />
        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Agent Prompt Studio</h3>
      </div>
      <p className="text-xs text-slate-500">
        Tuỳ chỉnh cách hành xử (tone, quy tắc) của từng agent AI đang chạy trong hệ thống. Dữ liệu CRM live và định dạng JSON output luôn cố định để không làm hỏng tính năng.
      </p>

      {error && <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-xs">{error}</div>}
      {!agents && !error && <div className="text-xs text-slate-400">Đang tải danh sách agent…</div>}

      {agents && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([domain, list]) => (
            <div key={domain} className="space-y-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {DOMAIN_LABELS[domain] || domain}
              </h4>
              <div className="space-y-2">
                {list.map(agent => (
                  <AgentRow key={agent.id} agent={agent} onChanged={load} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
