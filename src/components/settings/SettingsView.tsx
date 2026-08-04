import React, { useEffect, useRef, useState } from 'react';
import { Settings, User, Sparkles, Building2, Plus, Check, Mail, Save, KeyRound, Target } from 'lucide-react';
import { Workspace, WorkspaceScoringCriteria, CreatorGmvTier } from '../../types';
import { WorkspaceBanner } from '../layout/WorkspaceBanner';
import { AgentPromptStudio } from './AgentPromptStudio';
import { AiProviderSettings } from './AiProviderSettings';
import { OutreachTemplateSettings } from './OutreachTemplateSettings';

const SECTIONS = [
  { id: 'workspaces', label: 'Brand Workspaces', icon: Building2 },
  { id: 'scoring-criteria', label: 'Sourcing Scoring Criteria', icon: Target },
  { id: 'ai-copilot', label: 'AI Copilot', icon: Sparkles },
  { id: 'ai-providers', label: 'AI Providers', icon: Sparkles },
  { id: 'agent-studio', label: 'Agent Prompt Studio', icon: Sparkles },
  { id: 'profile', label: 'Operator Profile', icon: User },
  { id: 'email', label: 'Email Outreach Sync', icon: Mail },
  { id: 'outreach-templates', label: 'Outreach Templates', icon: Mail },
] as const;

interface SettingsViewProps {
  activeWorkspace?: Workspace;
  workspaces?: Workspace[];
  onSelectWorkspace?: (id: string) => void;
  onAddWorkspace?: (ws: Omit<Workspace, 'id'>) => void;
  onUpdateScoringCriteria?: (workspaceId: string, criteria: WorkspaceScoringCriteria) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeWorkspace,
  workspaces = [],
  onSelectWorkspace,
  onAddWorkspace,
  onUpdateScoringCriteria
}) => {
  const defaultSignature =
    "Best regards,\nAnh Tuan | Affiliate Operator\n" + (activeWorkspace?.name || "d'Alba Official Store Vietnam");

  const [operatorName, setOperatorName] = useState(
    () => localStorage.getItem('pickdi_operator_name') || 'Anh Tuan'
  );
  const [brandName, setBrandName] = useState(
    () => localStorage.getItem('pickdi_brand_name') || activeWorkspace?.brandName || "d'Alba Piedmont Vietnam"
  );
  const [signature, setSignature] = useState(
    () => localStorage.getItem('pickdi_signature') || defaultSignature
  );
  const [autoScoreEnabled, setAutoScoreEnabled] = useState(
    () => localStorage.getItem('pickdi_auto_score') !== 'false'
  );
  const [autoDraftEnabled, setAutoDraftEnabled] = useState(
    () => localStorage.getItem('pickdi_auto_draft') !== 'false'
  );

  // Sourcing Scoring Criteria — ngưỡng d'Alba trong scoring.ts (GMV Performance/Audience
  // Profile Fit/Reach Consistency) đọc từ Workspace.scoringCriteria, sửa được ở đây thay vì
  // hardcode trong code vì tiêu chí sourcing thay đổi theo brand/thời gian.
  const [gmvTierTarget, setGmvTierTarget] = useState<CreatorGmvTier | ''>('');
  const [gpmFloor, setGpmFloor] = useState('');
  const [gpmIdeal, setGpmIdeal] = useState('');
  const [genderFemaleFloor, setGenderFemaleFloor] = useState('');
  const [genderFemaleIdeal, setGenderFemaleIdeal] = useState('');
  const [beautyCategoryRatioFloor, setBeautyCategoryRatioFloor] = useState('');
  const [beautyCategoryRatioIdeal, setBeautyCategoryRatioIdeal] = useState('');
  const [avgViewsFloor, setAvgViewsFloor] = useState('');
  const [avgViewsIdeal, setAvgViewsIdeal] = useState('');
  const [preferredAgeGroup, setPreferredAgeGroup] = useState('');
  const [highFollowerNoAffiliateThreshold, setHighFollowerNoAffiliateThreshold] = useState('');
  const [scoringCriteriaSaveMessage, setScoringCriteriaSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    const c = activeWorkspace?.scoringCriteria;
    setGmvTierTarget((c?.gmvTierTarget as CreatorGmvTier) || '');
    setGpmFloor(c?.gpmFloor != null ? String(c.gpmFloor) : '');
    setGpmIdeal(c?.gpmIdeal != null ? String(c.gpmIdeal) : '');
    setGenderFemaleFloor(c?.genderFemaleFloor != null ? String(c.genderFemaleFloor) : '');
    setGenderFemaleIdeal(c?.genderFemaleIdeal != null ? String(c.genderFemaleIdeal) : '');
    setBeautyCategoryRatioFloor(c?.beautyCategoryRatioFloor != null ? String(c.beautyCategoryRatioFloor) : '');
    setBeautyCategoryRatioIdeal(c?.beautyCategoryRatioIdeal != null ? String(c.beautyCategoryRatioIdeal) : '');
    setAvgViewsFloor(c?.avgViewsFloor != null ? String(c.avgViewsFloor) : '');
    setAvgViewsIdeal(c?.avgViewsIdeal != null ? String(c.avgViewsIdeal) : '');
    setPreferredAgeGroup(c?.preferredAgeGroup || '');
    setHighFollowerNoAffiliateThreshold(c?.highFollowerNoAffiliateThreshold != null ? String(c.highFollowerNoAffiliateThreshold) : '');
    setScoringCriteriaSaveMessage(null);
  }, [activeWorkspace?.id]);

  const handleSaveScoringCriteria = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !onUpdateScoringCriteria) return;
    const toNum = (v: string) => (v.trim() === '' ? undefined : Number(v));
    const criteria: WorkspaceScoringCriteria = {
      gmvTierTarget: gmvTierTarget || undefined,
      gpmFloor: toNum(gpmFloor),
      gpmIdeal: toNum(gpmIdeal),
      genderFemaleFloor: toNum(genderFemaleFloor),
      genderFemaleIdeal: toNum(genderFemaleIdeal),
      beautyCategoryRatioFloor: toNum(beautyCategoryRatioFloor),
      beautyCategoryRatioIdeal: toNum(beautyCategoryRatioIdeal),
      avgViewsFloor: toNum(avgViewsFloor),
      avgViewsIdeal: toNum(avgViewsIdeal),
      preferredAgeGroup: preferredAgeGroup.trim() || undefined,
      highFollowerNoAffiliateThreshold: toNum(highFollowerNoAffiliateThreshold),
    };
    onUpdateScoringCriteria(activeWorkspace.id, criteria);
    setScoringCriteriaSaveMessage('Đã lưu tiêu chí chấm điểm cho workspace này.');
  };

  // Email SMTP/IMAP configuration state (works with Gmail, Naver Works Mail, or any IMAP/SMTP provider)
  const [emailAddress, setEmailAddress] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [imapHost, setImapHost] = useState('');
  const [imapPort, setImapPort] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [emailBrand, setEmailBrand] = useState('');
  const [emailProduct, setEmailProduct] = useState('');
  const [emailLogoUrl, setEmailLogoUrl] = useState('');
  const [emailPrimaryColor, setEmailPrimaryColor] = useState('');
  const [emailSenderName, setEmailSenderName] = useState('');
  const [emailDefaultCc, setEmailDefaultCc] = useState('');
  const [hasPassword, setHasPassword] = useState(false);
  const [emailConfigLoading, setEmailConfigLoading] = useState(false);
  const [emailConfigSaving, setEmailConfigSaving] = useState(false);
  const [emailSaveMessage, setEmailSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load email config on mount
  useEffect(() => {
    setEmailConfigLoading(true);
    fetch('/api/settings/email')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setEmailAddress(data.data.email || '');
          setImapHost(data.data.imapHost || '');
          setImapPort(data.data.imapPort ? String(data.data.imapPort) : '');
          setSmtpHost(data.data.smtpHost || '');
          setSmtpPort(data.data.smtpPort ? String(data.data.smtpPort) : '');
          setEmailBrand(data.data.brand || '');
          setEmailProduct(data.data.product || '');
          setEmailLogoUrl(data.data.logoUrl || '');
          setEmailPrimaryColor(data.data.primaryColor || '');
          setEmailSenderName(data.data.senderName || '');
          setEmailDefaultCc(data.data.defaultCc || '');
          setHasPassword(Boolean(data.data.hasPassword));
        }
      })
      .catch(err => console.error('Failed to load email config:', err))
      .finally(() => setEmailConfigLoading(false));
  }, []);

  const handleSaveEmailConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailConfigSaving(true);
    setEmailSaveMessage(null);
    try {
      const res = await fetch('/api/settings/email', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddress,
          password: emailPassword.trim() || undefined,
          imapHost: imapHost.trim(),
          imapPort: imapPort.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: smtpPort.trim(),
          brand: emailBrand,
          product: emailProduct,
          logoUrl: emailLogoUrl.trim(),
          primaryColor: emailPrimaryColor.trim(),
          senderName: emailSenderName.trim(),
          defaultCc: emailDefaultCc.trim()
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setHasPassword(Boolean(data.data.hasPassword));
        setEmailPassword('');
        setEmailSaveMessage({ type: 'success', text: 'Đã lưu cấu hình Email Outreach thành công!' });
      } else {
        setEmailSaveMessage({ type: 'error', text: data.message || 'Lưu thất bại' });
      }
    } catch (err: any) {
      console.error('Save email config error:', err);
      setEmailSaveMessage({ type: 'error', text: 'Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.' });
    } finally {
      setEmailConfigSaving(false);
    }
  };

  // Auto-save operator preferences as they change — there's no separate Save button,
  // so without this every edit was silently lost on navigation/reload.
  useEffect(() => {
    localStorage.setItem('pickdi_operator_name', operatorName);
  }, [operatorName]);
  useEffect(() => {
    localStorage.setItem('pickdi_brand_name', brandName);
  }, [brandName]);
  useEffect(() => {
    localStorage.setItem('pickdi_signature', signature);
  }, [signature]);
  useEffect(() => {
    localStorage.setItem('pickdi_auto_score', String(autoScoreEnabled));
  }, [autoScoreEnabled]);
  useEffect(() => {
    localStorage.setItem('pickdi_auto_draft', String(autoDraftEnabled));
  }, [autoDraftEnabled]);

  // Scrollspy for the section nav
  const [activeSection, setActiveSection] = useState<string>(SECTIONS[0].id);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: 0 }
    );
    SECTIONS.forEach(s => {
      const el = sectionRefs.current[s.id];
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollToSection = (id: string) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
    <div className="pb-12 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Workspace Banner */}
      {activeWorkspace && (
        <div className="mb-6">
          <WorkspaceBanner
            activeWorkspace={activeWorkspace}
            workspaces={workspaces}
            onSelectWorkspace={onSelectWorkspace || (() => {})}
            activeCreatorCount={activeWorkspace.creatorCount || 0}
            activeCampaignCount={activeWorkspace.activeCampaignCount || 0}
          />
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs flex items-center justify-between mb-6">
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
          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          Create New Workspace
        </button>
      </div>

      <div className="flex items-start gap-6">
        {/* Section Nav */}
        <nav className="hidden lg:block w-56 shrink-0 sticky top-6 self-start">
          <ul className="space-y-1">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = activeSection === s.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => scrollToSection(s.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-left transition-all ${
                      isActive
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                        : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/60 dark:text-slate-400'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`} />
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-6">

      {/* Workspaces Management Section */}
      <div
        id="workspaces"
        ref={el => { sectionRefs.current['workspaces'] = el; }}
        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 scroll-mt-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              All Brand Workspaces ({workspaces.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400">Data & creators are isolated per workspace</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
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

      {/* Sourcing Scoring Criteria — ngưỡng dùng bởi src/scoring.ts (GMV Performance/Audience
          Profile Fit/Reach Consistency) cho workspace đang chọn ở trên. */}
      <div
        id="scoring-criteria"
        ref={el => { sectionRefs.current['scoring-criteria'] = el; }}
        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs scroll-mt-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Target className="w-4 h-4 text-indigo-600" />
            Sourcing Scoring Criteria — {activeWorkspace?.name || 'chọn workspace'}
          </h3>
        </div>
        <p className="text-slate-500">
          Ngưỡng dùng để chấm điểm GMV Performance / Audience Profile Fit / Reach Consistency cho creator
          trong workspace này. Bỏ trống field nào thì nhóm/tiêu chí đó bị loại khỏi điểm (theo nguyên tắc
          thiếu dữ liệu chung), không tự gán điểm trung tính giả.
        </p>

        <form onSubmit={handleSaveScoringCriteria} className="space-y-4">
          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">GMV Performance</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">GMV Tier mục tiêu</label>
                <select
                  value={gmvTierTarget}
                  onChange={e => setGmvTierTarget(e.target.value as CreatorGmvTier | '')}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="">—</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                  <option value="L3">L3</option>
                  <option value="L4">L4</option>
                  <option value="L5">L5</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">GPM Floor (USD/1000 views)</label>
                <input
                  type="number"
                  value={gpmFloor}
                  onChange={e => setGpmFloor(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">GPM Ideal (USD/1000 views)</label>
                <input
                  type="number"
                  value={gpmIdeal}
                  onChange={e => setGpmIdeal(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Audience Profile Fit</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">% Nữ — Floor</label>
                <input
                  type="number"
                  value={genderFemaleFloor}
                  onChange={e => setGenderFemaleFloor(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">% Nữ — Ideal</label>
                <input
                  type="number"
                  value={genderFemaleIdeal}
                  onChange={e => setGenderFemaleIdeal(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">% Beauty/Personal Care — Floor</label>
                <input
                  type="number"
                  value={beautyCategoryRatioFloor}
                  onChange={e => setBeautyCategoryRatioFloor(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">% Beauty/Personal Care — Ideal</label>
                <input
                  type="number"
                  value={beautyCategoryRatioIdeal}
                  onChange={e => setBeautyCategoryRatioIdeal(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Nhóm tuổi ưu tiên (bonus, vd 35-44)</label>
                <input
                  type="text"
                  placeholder="35-44"
                  value={preferredAgeGroup}
                  onChange={e => setPreferredAgeGroup(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Reach Consistency</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Avg Views — Floor</label>
                <input
                  type="number"
                  value={avgViewsFloor}
                  onChange={e => setAvgViewsFloor(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">Avg Views — Ideal</label>
                <input
                  type="number"
                  value={avgViewsIdeal}
                  onChange={e => setAvgViewsIdeal(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Eligibility Gate (Risk Flag)</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Follower cao nhưng chưa có GMV affiliate — ngưỡng follower
                </label>
                <input
                  type="number"
                  value={highFollowerNoAffiliateThreshold}
                  onChange={e => setHighFollowerNoAffiliateThreshold(e.target.value)}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          {scoringCriteriaSaveMessage && (
            <div className="p-2.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900">
              {scoringCriteriaSaveMessage}
            </div>
          )}

          <div className="flex items-center justify-end pt-1">
            <button
              type="submit"
              disabled={!activeWorkspace}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu tiêu chí chấm điểm
            </button>
          </div>
        </form>
      </div>

      {/* Settings Section 1: AI & Gemini Status */}
      <div
        id="ai-copilot"
        ref={el => { sectionRefs.current['ai-copilot'] = el; }}
        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 scroll-mt-6"
      >
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            <div className="pr-3">
              <span className="font-bold text-slate-800 dark:text-slate-200">Auto-Score New Lead Profile</span>
              <p className="text-slate-400 text-[11px]">Automatically calculate Brand Fit & Risk score on creator creation</p>
            </div>
            <input
              type="checkbox"
              checked={autoScoreEnabled}
              onChange={e => setAutoScoreEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
            <div className="pr-3">
              <span className="font-bold text-slate-800 dark:text-slate-200">Auto-Generate Outreach Drafts</span>
              <p className="text-slate-400 text-[11px]">Pre-generate email draft when assigning creator to campaign</p>
            </div>
            <input
              type="checkbox"
              checked={autoDraftEnabled}
              onChange={e => setAutoDraftEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0"
            />
          </div>
        </div>
      </div>

      <div
        id="ai-providers"
        ref={el => { sectionRefs.current['ai-providers'] = el; }}
        className="scroll-mt-6"
      >
        <AiProviderSettings />
      </div>

      <div
        id="agent-studio"
        ref={el => { sectionRefs.current['agent-studio'] = el; }}
        className="scroll-mt-6"
      >
        <AgentPromptStudio />
      </div>

      {/* Settings Section 2: Operator Profile */}
      <div
        id="profile"
        ref={el => { sectionRefs.current['profile'] = el; }}
        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs scroll-mt-6"
      >
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Operator Profile & Email Signature
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* Settings Section 3: Gmail SMTP/IMAP Outreach Config */}
      <div
        id="email"
        ref={el => { sectionRefs.current['email'] = el; }}
        className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-4 text-xs scroll-mt-6"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Mail className="w-4 h-4 text-indigo-600" />
            Email Outreach 2-way Sync (SMTP / IMAP)
          </h3>
          {hasPassword ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1">
              <Check className="w-3 h-3" /> Email Connected
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              Chưa cấu hình mật khẩu
            </span>
          )}
        </div>

        <p className="text-slate-500 text-xs">
          Cấu hình hộp thư dùng cho outreach (Naver Works Mail, Gmail, hoặc bất kỳ nhà cung cấp nào hỗ trợ
          IMAP/SMTP) để tự động gửi email và đồng bộ tin nhắn creator phản hồi.
        </p>

        {/* Security Guide Callout */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
            Lấy thông tin IMAP/SMTP:
          </div>
          <p>
            Với Naver Works Mail: đăng nhập → Mail → Cài đặt → mục "POP3/IMAP" → bật IMAP/SMTP, trang đó
            sẽ hiện đúng host/port cần điền bên dưới. Với Gmail: bật 2FA rồi tạo App Password tại{' '}
            <a
              href="https://myaccount.google.com/apppasswords"
              target="_blank"
              rel="noreferrer"
              className="underline font-bold text-indigo-600 dark:text-indigo-400"
            >
              myaccount.google.com/apppasswords
            </a>{' '}
            (host: imap.gmail.com / smtp.gmail.com).
          </p>
        </div>

        <form onSubmit={handleSaveEmailConfig} className="space-y-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Địa chỉ email *
              </label>
              <input
                type="email"
                required
                placeholder="creator.dalba@worksmobile.com"
                value={emailAddress}
                onChange={e => setEmailAddress(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Mật khẩu {hasPassword ? '(Đã lưu - để trống nếu không đổi)' : '*'}
              </label>
              <input
                type="password"
                placeholder={hasPassword ? '•••••••••••••••• (Đã lưu)' : 'Mật khẩu hoặc App Password'}
                value={emailPassword}
                onChange={e => setEmailPassword(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                IMAP Host *
              </label>
              <input
                type="text"
                required
                placeholder="imap.worksmobile.com"
                value={imapHost}
                onChange={e => setImapHost(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                IMAP Port *
              </label>
              <input
                type="number"
                required
                placeholder="993"
                value={imapPort}
                onChange={e => setImapPort(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                SMTP Host *
              </label>
              <input
                type="text"
                required
                placeholder="smtp.worksmobile.com"
                value={smtpHost}
                onChange={e => setSmtpHost(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                SMTP Port *
              </label>
              <input
                type="number"
                required
                placeholder="465"
                value={smtpPort}
                onChange={e => setSmtpPort(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên Brand mặc định
              </label>
              <input
                type="text"
                placeholder="e.g. d'Alba Vietnam"
                value={emailBrand}
                onChange={e => setEmailBrand(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên Sản phẩm mặc định
              </label>
              <input
                type="text"
                placeholder="e.g. First Spray Serum"
                value={emailProduct}
                onChange={e => setEmailProduct(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Logo URL (cho email HTML)
              </label>
              <input
                type="url"
                placeholder="https://your-domain.com/logo.png"
                value={emailLogoUrl}
                onChange={e => setEmailLogoUrl(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Phải là URL ảnh công khai trên internet (email client tải ảnh trực tiếp từ URL này, không lấy từ máy bạn).
                Để trống nếu chưa có ảnh — email vẫn gửi được, chỉ hiện tên brand dạng chữ ở phần header thay logo.
              </p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Màu thương hiệu (nút CTA)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={emailPrimaryColor || '#735c00'}
                  onChange={e => setEmailPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 cursor-pointer"
                />
                <input
                  type="text"
                  placeholder="#735c00"
                  value={emailPrimaryColor}
                  onChange={e => setEmailPrimaryColor(e.target.value)}
                  className="flex-1 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Để trống dùng màu vàng gold mặc định của mẫu "Piedmont Ethereal".</p>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Tên người gửi (chữ ký email)
              </label>
              <input
                type="text"
                placeholder="Juan"
                value={emailSenderName}
                onChange={e => setEmailSenderName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">Để trống mặc định là "Juan" — dùng cho dòng "Best regards, {'{'}Tên{'}'}" ở cuối email.</p>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                CC mặc định cho email outreach
              </label>
              <input
                type="text"
                placeholder="teammate@company.com, another@company.com"
                value={emailDefaultCc}
                onChange={e => setEmailDefaultCc(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Tự động điền vào ô CC khi soạn email outreach (đơn lẻ hoặc hàng loạt) — vẫn có thể chỉnh sửa hoặc xoá trước khi gửi. Nhiều địa chỉ cách nhau bởi dấu phẩy.
              </p>
            </div>
          </div>

          {emailSaveMessage && (
            <div
              className={`p-2.5 rounded-xl text-xs font-semibold ${
                emailSaveMessage.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900'
                  : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-900'
              }`}
            >
              {emailSaveMessage.text}
            </div>
          )}

          <div className="flex items-center justify-end pt-2">
            <button
              type="submit"
              disabled={emailConfigSaving || !emailAddress.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 text-xs"
            >
              <Save className="w-3.5 h-3.5" />
              {emailConfigSaving ? 'Đang lưu...' : 'Lưu cấu hình Email'}
            </button>
          </div>
        </form>
      </div>

      <div
        id="outreach-templates"
        ref={el => { sectionRefs.current['outreach-templates'] = el; }}
        className="scroll-mt-6"
      >
        <OutreachTemplateSettings />
      </div>

        </div>
      </div>
    </div>
  );
};
