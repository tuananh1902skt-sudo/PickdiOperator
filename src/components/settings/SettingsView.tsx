import React, { useState } from 'react';
import { Settings, Shield, User, Sparkles, Mail, Database, Bell, Building2, Plus, Check, Layers } from 'lucide-react';
import { Workspace } from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';

interface SettingsViewProps {
  activeWorkspace?: Workspace;
  workspaces?: Workspace[];
  onSelectWorkspace?: (id: string) => void;
  onAddWorkspace?: (ws: Omit<Workspace, 'id'>) => void;
  showMockData?: boolean;
  setShowMockData?: (val: boolean) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeWorkspace,
  workspaces = [],
  onSelectWorkspace,
  onAddWorkspace,
  showMockData = true,
  setShowMockData
}) => {
  const [operatorName, setOperatorName] = useState('Anh Tuan');
  const [brandName, setBrandName] = useState(activeWorkspace?.brandName || "d'Alba Piedmont Vietnam");
  const [signature, setSignature] = useState("Best regards,\nAnh Tuan | Affiliate Operator\n" + (activeWorkspace?.name || "d'Alba Official Store Vietnam"));
  const [autoScoreEnabled, setAutoScoreEnabled] = useState(true);
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(true);

  // New Workspace Modal state
  const [isCreatingWs, setIsCreatingWs] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [newWsCode, setNewWsCode] = useState('');
  const [newWsBrand, setNewWsBrand] = useState('');
  const [newWsCategory, setNewWsCategory] = useState('Beauty & Skincare');
  const [newWsColor, setNewWsColor] = useState<'indigo' | 'rose' | 'purple' | 'emerald' | 'amber'>('indigo');
  const [newWsDesc, setNewWsDesc] = useState('');

  const handleCreateWorkspaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim() || !newWsCode.trim()) return;

    if (onAddWorkspace) {
      onAddWorkspace({
        name: newWsName.trim(),
        code: newWsCode.trim().toUpperCase(),
        brandName: newWsBrand.trim() || newWsName.trim(),
        category: newWsCategory,
        color: newWsColor,
        description: newWsDesc.trim() || `Affiliate campaign workspace for ${newWsName.trim()}`,
        memberCount: 1,
        creatorCount: 0,
        activeCampaignCount: 0
      });
    }

    setNewWsName('');
    setNewWsCode('');
    setNewWsBrand('');
    setNewWsDesc('');
    setIsCreatingWs(false);
  };

  return (
    <div className="space-y-6 pb-12 max-w-4xl animate-in fade-in duration-200">
      {/* Workspace Banner */}
      {activeWorkspace && (
        <WorkspaceBanner
          activeWorkspace={activeWorkspace}
          workspaces={workspaces}
          onSelectWorkspace={onSelectWorkspace || (() => {})}
          activeCreatorCount={activeWorkspace.creatorCount || 0}
          activeCampaignCount={activeWorkspace.activeCampaignCount || 0}
        />
      )}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Workspace & Brand Hub Settings
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage multi-brand workspaces, isolation parameters, AI copilot behaviors & team signatures
          </p>
        </div>

        <button
          onClick={() => setIsCreatingWs(true)}
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
        >
          <Plus className="w-4 h-4" />
          Create New Workspace
        </button>
      </div>

      {/* Workspaces Management Section */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              All Brand Workspaces ({workspaces.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Data & creators are isolated per workspace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {workspaces.map(ws => {
            const isActive = ws.id === activeWorkspace?.id;
            return (
              <div
                key={ws.id}
                className={`p-4 rounded-2xl border transition-all relative ${
                  isActive
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                      {ws.code}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">{ws.name}</h4>
                      <p className="text-[11px] text-slate-400">{ws.category}</p>
                    </div>
                  </div>

                  {isActive ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white flex items-center gap-1">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectWorkspace && onSelectWorkspace(ws.id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100"
                    >
                      Switch
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
                  {ws.description}
                </p>

                <div className="flex items-center gap-3 text-[10px] text-slate-400 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <span>Code: <strong className="text-slate-700 dark:text-slate-300">{ws.code}</strong></span>
                  <span>•</span>
                  <span>Brand: <strong className="text-slate-700 dark:text-slate-300">{ws.brandName}</strong></span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Create Workspace Modal / inline form */}
        {isCreatingWs && (
          <form onSubmit={handleCreateWorkspaceSubmit} className="mt-4 p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-indigo-200 dark:border-indigo-900 space-y-3 animate-in fade-in duration-150">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-indigo-500" /> Create New Brand Workspace
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Workspace Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Innisfree Official Vietnam"
                  value={newWsName}
                  onChange={e => setNewWsName(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Short Code * (e.g. INNI)</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="INNI"
                  value={newWsCode}
                  onChange={e => setNewWsCode(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 uppercase"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Brand Name</label>
                <input
                  type="text"
                  placeholder="e.g. Innisfree Vietnam"
                  value={newWsBrand}
                  onChange={e => setNewWsBrand(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <select
                  value={newWsCategory}
                  onChange={e => setNewWsCategory(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                >
                  <option value="Beauty & Skincare">Beauty & Skincare</option>
                  <option value="Makeup & Cosmetics">Makeup & Cosmetics</option>
                  <option value="Fashion & Lifestyle">Fashion & Lifestyle</option>
                  <option value="Mom & Baby">Mom & Baby</option>
                  <option value="Multi-Brand Network">Multi-Brand Network</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1 text-xs">Description</label>
              <textarea
                rows={2}
                placeholder="Brief description of brand affiliate hub objectives..."
                value={newWsDesc}
                onChange={e => setNewWsDesc(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsCreatingWs(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-600 dark:text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white font-bold text-xs shadow-sm hover:bg-indigo-700"
              >
                Create Workspace
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Settings Section: Mock Data Controls */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-amber-500" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Hiển thị Dữ liệu Mẫu (Mock Data)
              </h3>
              <p className="text-xs text-slate-500">
                Cho phép ẩn/hiện toàn bộ dữ liệu creator, chiến dịch, email mẫu để bạn chỉ làm việc với data thật đã quét bằng Extension.
              </p>
            </div>
          </div>

          {setShowMockData && (
            <button
              onClick={() => setShowMockData(!showMockData)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                showMockData
                  ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>{showMockData ? 'Đang BẬT Dữ liệu mẫu' : 'Đang ẨN Dữ liệu mẫu'}</span>
            </button>
          )}
        </div>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-xs text-slate-600 dark:text-slate-300 space-y-1">
          <p>
            • <strong>Khi Bật:</strong> Hệ thống bao gồm 6 Creator mẫu, 3 Chiến dịch mẫu & Lịch sử tương tác mẫu để trải nghiệm giao diện.
          </p>
          <p>
            • <strong>Khi Tắt:</strong> Toàn bộ dữ liệu mẫu bị ẩn. CRM chỉ hiển thị những Creator do Tampermonkey Userscript cào trực tiếp từ TikTok One / Affiliate.
          </p>
        </div>
      </div>

      {/* Settings Section 1: AI & Gemini Status */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              Gemini AI Copilot Integration
            </h3>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
            Active (`gemini-3.6-flash`)
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Server-side API key is automatically injected by AI Studio at runtime into Express server.
        </p>

        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Auto-Score New Lead Profile</span>
              <p className="text-slate-400 text-[11px]">Automatically calculate Brand Fit & Risk score on creator creation</p>
            </div>
            <input
              type="checkbox"
              checked={autoScoreEnabled}
              onChange={e => setAutoScoreEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-800 dark:text-slate-200">Auto-Generate Outreach Drafts</span>
              <p className="text-slate-400 text-[11px]">Pre-generate email draft when assigning creator to campaign</p>
            </div>
            <input
              type="checkbox"
              checked={autoDraftEnabled}
              onChange={e => setAutoDraftEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Settings Section 2: Operator Profile */}
      <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Operator Profile & Email Signature
        </h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Operator Display Name</label>
            <input
              type="text"
              value={operatorName}
              onChange={e => setOperatorName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Brand Name Context</label>
            <input
              type="text"
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>
        </div>

        <div>
          <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Default Email Signature</label>
          <textarea
            rows={3}
            value={signature}
            onChange={e => setSignature(e.target.value)}
            className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px]"
          />
        </div>
      </div>
    </div>
  );
};
