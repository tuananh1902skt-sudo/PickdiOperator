import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ExternalLink,
  Sparkles,
  Mail,
  Archive,
  Bookmark,
  HelpCircle,
  Play,
  BarChart2,
  ArrowDown
} from 'lucide-react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Creator, Campaign } from '../../types';

interface CreatorDetailDrawerProps {
  creator: Creator | null;
  onClose: () => void;
  campaigns: Campaign[];
  onOpenEmailComposer: (cr: Creator) => void;
  onArchiveCreator: (id: string) => void;
  onAddNote: (creatorId: string, content: string) => void;
  onRunAiResearch: (cr: Creator) => void;
}

export const CreatorDetailDrawer: React.FC<CreatorDetailDrawerProps> = ({
  creator,
  onClose,
  campaigns,
  onOpenEmailComposer,
  onArchiveCreator,
  onAddNote,
  onRunAiResearch
}) => {
  const [activeSection, setActiveSection] = useState<string>('sec-overview');
  const [bookmarked, setBookmarked] = useState(false);
  const [scoreTab, setScoreTab] = useState<'overall' | 'creativity'>('overall');
  const [contentFilter, setContentFilter] = useState<'all' | 'branded' | 'non-branded'>('all');
  const [trendSort, setTrendSort] = useState<'recent' | 'popular'>('recent');
  const [demoTab, setDemoTab] = useState<'reached' | 'engaged' | 'followers'>('reached');
  const [newNoteText, setNewNoteText] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isManualScroll = useRef(false);

  useEffect(() => {
    const sectionIds = [
      'sec-overview',
      'sec-content',
      'sec-trend',
      'sec-videos',
      'sec-collaborations',
      'sec-demographics',
      'sec-notes'
    ];

    const handleScroll = () => {
      if (isManualScroll.current) return;
      const container = scrollContainerRef.current;
      if (!container) return;

      const containerTop = container.getBoundingClientRect().top;

      let currentSec = sectionIds[0];
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          // If top of section is near or above 180px from top of container viewport
          if (rect.top - containerTop <= 180) {
            currentSec = id;
          }
        }
      }
      setActiveSection(currentSec);
    };

    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, [creator]);

  useEffect(() => {
    const tabEl = document.getElementById(`tab-${activeSection}`);
    if (tabEl) {
      tabEl.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    }
  }, [activeSection]);

  if (!creator) return null;

  const EMPTY = 'Chưa có dữ liệu';

  const formatNumber = (num?: number | null) => {
    if (num === undefined || num === null || isNaN(num)) return EMPTY;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(0) + 'K';
    return num.toLocaleString();
  };

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    isManualScroll.current = true;
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        isManualScroll.current = false;
      }, 700);
    }
  };

  // Radar chart — only built from real creator.scores, no invented fallback numbers
  const hasScores = !!creator.scores && Object.values(creator.scores).some(v => v !== undefined);
  const radarData = [
    { subject: 'Broadcasting', value: creator.scores?.broadcasting ?? 0, fullMark: 100 },
    { subject: 'Diligence', value: creator.scores?.diligence ?? 0, fullMark: 100 },
    { subject: 'Commercial', value: creator.scores?.commercial ?? creator.commercialScore ?? 0, fullMark: 100 },
    { subject: 'Brand Fit', value: creator.brandFitScore ?? 0, fullMark: 100 },
    { subject: 'Creativity', value: creator.scores?.creativity ?? 0, fullMark: 100 }
  ];

  // Videos Grid Data — only real creator.recentVideos from the scraper, never invented
  const displayVideos = creator.recentVideos || [];

  // Performance Trend Bar Chart Data — only built when real video views exist
  const parseView = (val?: string | number) => {
    if (val === undefined) return undefined;
    if (typeof val === 'number') return val;
    const s = String(val).toUpperCase().trim();
    if (s.endsWith('M')) return parseFloat(s) * 1000000;
    if (s.endsWith('K')) return parseFloat(s) * 1000;
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  };

  const trendBarData = displayVideos.map((v, i) => {
    const numViews = parseView(v.views) ?? 0;
    return {
      date: v.date ? (v.date.includes('/') ? v.date.split(' ')[0].slice(0, 5) : v.date) : `V${i + 1}`,
      branded: v.isBranded ? numViews : 0,
      nonBranded: !v.isBranded ? numViews : 0,
      boosted: 0
    };
  });

  // Donut chart colors
  const COLORS = ['#818cf8', '#0284c7', '#f472b6', '#b45309', '#0d9488', '#9333ea'];

  // Demographic Donut Data — only rendered when the scraper actually captured demographics
  const hasGenderData = creator.demographics?.genderFemale !== undefined || creator.demographics?.genderMale !== undefined;
  const genderData = hasGenderData ? [
    { name: 'Female', value: creator.demographics?.genderFemale ?? 0 },
    { name: 'Male', value: creator.demographics?.genderMale ?? 0 }
  ] : [];

  const ageData = creator.demographics?.ageDistribution || [];

  // Real view-count summary — undefined (not a fabricated number) when there's no video data
  const parsedViews = displayVideos.map(v => parseView(v.views)).filter((v): v is number => v !== undefined);
  const maxViewVal = parsedViews.length ? Math.max(...parsedViews) : undefined;
  const minViewVal = parsedViews.length ? Math.min(...parsedViews) : undefined;
  const avgViewVal = parsedViews.length
    ? Math.round(parsedViews.reduce((a, b) => a + b, 0) / parsedViews.length)
    : undefined;

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    onAddNote(creator.id, newNoteText);
    setNewNoteText('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div
        className="w-full max-w-7xl bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Control Header Bar */}
        <div className="px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded-md bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center gap-1 border border-teal-200 dark:border-teal-800">
              <BarChart2 className="w-3.5 h-3.5" /> TikTok Creator Profile Analytics (Scroll View)
            </span>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">ID: {creator.id}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenEmailComposer(creator)}
              className="py-1.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
            >
              <Mail className="w-3.5 h-3.5" /> Generate Outreach
            </button>
            <button
              onClick={() => onRunAiResearch(creator)}
              className="py-1.5 px-3 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 font-bold text-xs rounded-lg flex items-center gap-1 hover:bg-purple-100 dark:hover:bg-purple-900"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> AI Research
            </button>
            <button
              onClick={() => onArchiveCreator(creator.id)}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Archive Creator"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content Split: Fixed Left Profile Card & Continuous Vertical Scroll Right Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT SIDEBAR: Creator Identity Card */}
          <div className="w-full md:w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 overflow-y-auto shrink-0 space-y-5">
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <img
                  src={
                    creator.avatar ||
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
                  }
                  alt={creator.displayName}
                  className="w-24 h-24 rounded-full object-cover ring-4 ring-teal-500/20 shadow-md"
                />
                {creator.country && (
                  <span className="absolute bottom-0 right-1 bg-white dark:bg-slate-800 rounded-full p-1 shadow-md text-xs">
                    {creator.country === 'Vietnam' ? '🇻🇳' : creator.country === 'United States' ? '🇺🇸' : '🌐'}
                  </span>
                )}
              </div>

              <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                {creator.handle}
              </h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{creator.displayName}</p>

              {/* Data Source Badge — reflects how this creator actually entered the CRM */}
              {creator.source === 'scraper' ? (
                <div className="mt-2.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Auto-Synced từ TikTok One Extension</span>
                </div>
              ) : (
                <div className="mt-2.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-center gap-1.5">
                  <span>Nhập tay (Manual)</span>
                </div>
              )}

              <div className="mt-2 flex flex-col items-center gap-1">
                <a
                  href={creator.profileUrl || `https://www.tiktok.com/@${(creator.handle || '').replace(/^@/, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                >
                  View TikTok profile <ExternalLink className="w-3 h-3" />
                </a>
                {creator.tiktokOneId ? (
                  <a
                    href={`https://ads.tiktok.com/creative/creator/profile/${creator.tiktokOneId}?creatorType=1&region=${creator.country === 'United States' ? 'us_ttp' : 'vn_ttp'}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    View TikTok One profile <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                    Chưa có ID TikTok One (Quét bằng Extension)
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Creator bio</h4>
                <p className="text-slate-600 dark:text-slate-400 whitespace-pre-line leading-relaxed">
                  {creator.bio || 'Chưa có tiểu sử (Tự động thu thập qua Extension hoặc TikTok One)'}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Languages spoken</h4>
                <p className="text-slate-600 dark:text-slate-400">{creator.language || EMPTY}</p>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1.5">Video content tag</h4>
                <div className="flex flex-wrap gap-1.5">
                  {creator.category ? (
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium">
                      {creator.category}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">{EMPTY}</span>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">Brand fit score</h4>
                {creator.brandFitScore !== undefined ? (
                  <span className="inline-block px-2.5 py-0.5 rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-bold text-sm">
                    {creator.brandFitScore}
                  </span>
                ) : (
                  <span className="text-slate-400 italic text-xs">{EMPTY}</span>
                )}
              </div>

              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-0.5">Start from</h4>
                <p className="text-lg font-black text-slate-900 dark:text-white">
                  {creator.rateCard ? (
                    <>${creator.rateCard} <span className="text-xs font-normal text-slate-500">USD</span></>
                  ) : (
                    <span className="text-slate-400 italic text-sm font-normal">{EMPTY}</span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => onOpenEmailComposer(creator)}
                  className="flex-1 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors text-center"
                >
                  Collaborate
                </button>
                <button
                  onClick={() => setBookmarked(!bookmarked)}
                  className={`p-2.5 border rounded-xl transition-colors ${
                    bookmarked
                      ? 'bg-amber-50 border-amber-300 text-amber-600'
                      : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL: Sticky Quick Jump Navigation + Continuous Vertical Scroll Sections */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
            {/* Sticky Anchor Navigation Bar */}
            <div className="sticky top-0 z-20 px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 overflow-x-auto shrink-0 text-xs font-bold scrollbar-none shadow-xs">
              <span className="text-slate-400 text-[10px] uppercase tracking-wider flex items-center gap-1 shrink-0 mr-1">
                <ArrowDown className="w-3 h-3" /> Jump to:
              </span>

              <button
                id="tab-sec-overview"
                onClick={() => scrollToSection('sec-overview')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-overview'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Creator overview
              </button>

              <button
                id="tab-sec-content"
                onClick={() => scrollToSection('sec-content')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-content'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Content performance
              </button>

              <button
                id="tab-sec-trend"
                onClick={() => scrollToSection('sec-trend')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-trend'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Performance trend
              </button>

              <button
                id="tab-sec-videos"
                onClick={() => scrollToSection('sec-videos')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-videos'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Videos
              </button>

              <button
                id="tab-sec-collaborations"
                onClick={() => scrollToSection('sec-collaborations')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-collaborations'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Collaborations
              </button>

              <button
                id="tab-sec-demographics"
                onClick={() => scrollToSection('sec-demographics')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-demographics'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Audience demographics
              </button>

              <button
                id="tab-sec-notes"
                onClick={() => scrollToSection('sec-notes')}
                className={`py-1.5 px-3 rounded-lg whitespace-nowrap transition-all ${
                  activeSection === 'sec-notes'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Notes & CRM ({creator.notes?.length || 0})
              </button>
            </div>

            {/* SINGLE CONTINUOUS SCROLL CONTAINER FOR ALL SECTIONS */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-12 scroll-smooth">
              {/* SECTION 1: CREATOR OVERVIEW */}
              <section id="sec-overview" className="space-y-6 pt-2">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-teal-500 inline-block" />
                    1. Creator overview
                  </h3>

                  {/* Top 3 Stat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                      <span className="text-xs text-slate-500 font-medium">Followers</span>
                      <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                        {formatNumber(creator.followers)}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        Follower growth rate <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                      <p className={`text-2xl font-black mt-1 ${creator.followerGrowthRate ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                        {creator.followerGrowthRate || EMPTY}
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        Posting frequency <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                      {creator.postingFrequency30d !== undefined ? (
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">
                          {creator.postingFrequency30d} <span className="text-xs font-normal text-slate-400">/ 30 days</span>
                        </p>
                      ) : (
                        <p className="text-sm font-normal text-slate-400 italic mt-1">{EMPTY}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Collaboration Evaluation Section (Radar + Score breakdown) */}
                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Collaboration evaluation</h4>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Radar Chart Container */}
                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          Overall score <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                      </div>
                      <p className={`text-3xl font-black mb-4 ${hasScores || creator.brandFitScore !== undefined ? 'text-teal-600 dark:text-teal-400' : 'text-slate-400 italic text-base font-normal'}`}>
                        {creator.scores?.overall ?? (creator.brandFitScore !== undefined && creator.commercialScore !== undefined
                          ? Math.round((creator.brandFitScore + creator.commercialScore) / 2)
                          : EMPTY)}
                      </p>

                      {hasScores ? (
                        <div className="h-64 w-full flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 12 }} />
                              <Radar name="Creator Score" dataKey="value" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} />
                            </RadarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="h-64 w-full flex items-center justify-center text-slate-400 text-xs italic">
                          {EMPTY} — cần cào từ TikTok One
                        </div>
                      )}
                    </div>

                    {/* Score Breakdown Cards */}
                    <div className="space-y-4">
                      <div className="flex justify-between items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                        <button
                          onClick={() => setScoreTab('overall')}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-colors ${
                            scoreTab === 'overall'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-500'
                          }`}
                        >
                          Overall
                        </button>
                        <button
                          onClick={() => setScoreTab('creativity')}
                          className={`flex-1 py-1.5 rounded-lg text-center transition-colors flex items-center justify-center gap-1 ${
                            scoreTab === 'creativity'
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-500'
                          }`}
                        >
                          Creativity & Talent <HelpCircle className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          Broadcasting <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                        <div className="flex items-baseline gap-2">
                          <span className={`text-2xl font-black ${creator.scores?.broadcasting !== undefined ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                            {creator.scores?.broadcasting ?? EMPTY}
                          </span>
                        </div>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          Diligence <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                        <p className={`text-2xl font-black ${creator.scores?.diligence !== undefined ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                          {creator.scores?.diligence ?? EMPTY}
                        </p>
                      </div>

                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          Commercial <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </span>
                        <p className={`text-2xl font-black ${(creator.scores?.commercial ?? creator.commercialScore) !== undefined ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                          {creator.scores?.commercial ?? creator.commercialScore ?? EMPTY}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 2: CONTENT PERFORMANCE */}
              <section id="sec-content" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-indigo-500 inline-block" />
                      2. Content performance
                    </h3>
                    <p className="text-xs text-slate-500">Average performance of the 30 most recent videos</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium">
                      <option>All traffic</option>
                    </select>
                    <select className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium">
                      <option>All industries</option>
                    </select>
                  </div>
                </div>

                {/* Filter Sub-pills */}
                <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold w-fit">
                  <button
                    onClick={() => setContentFilter('all')}
                    className={`px-4 py-1.5 rounded-lg transition-colors ${
                      contentFilter === 'all'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setContentFilter('branded')}
                    className={`px-4 py-1.5 rounded-lg transition-colors ${
                      contentFilter === 'branded'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Branded content
                  </button>
                  <button
                    onClick={() => setContentFilter('non-branded')}
                    className={`px-4 py-1.5 rounded-lg transition-colors ${
                      contentFilter === 'non-branded'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500'
                    }`}
                  >
                    Non-branded content
                  </button>
                </div>

                {/* Metrics Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Median views */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        Median views <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                        Top 10 %
                      </span>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                      {formatNumber(creator.avgViews)}
                    </p>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-500 flex items-center gap-1">
                        Industry benchmark <HelpCircle className="w-3 h-3 text-slate-400" />
                      </span>
                      <span className={`font-bold ${creator.medianViewsBenchmark ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic font-normal'}`}>
                        {creator.medianViewsBenchmark || EMPTY}
                      </span>
                    </div>
                  </div>

                  {/* 6-second video views */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      6-second video views <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <p className={`text-3xl font-black ${creator.sixSecondViewRate ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                      {creator.sixSecondViewRate || EMPTY}
                    </p>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-500 flex items-center gap-1">
                        Industry benchmark <HelpCircle className="w-3 h-3 text-slate-400" />
                      </span>
                      <span className={`font-bold ${creator.sixSecondViewRateBenchmark ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic font-normal'}`}>
                        {creator.sixSecondViewRateBenchmark || EMPTY}
                      </span>
                    </div>
                  </div>

                  {/* Engagement rate */}
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      Engagement rate <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <p className={`text-3xl font-black ${creator.engagementRate !== undefined ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                      {creator.engagementRate !== undefined ? `${creator.engagementRate}%` : EMPTY}
                    </p>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                      <span className="text-slate-500 flex items-center gap-1">
                        Industry benchmark <HelpCircle className="w-3 h-3 text-slate-400" />
                      </span>
                      <span className={`font-bold ${creator.engagementRateBenchmark ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 italic font-normal'}`}>
                        {creator.engagementRateBenchmark || EMPTY}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              {/* SECTION 3: PERFORMANCE TREND */}
              <section id="sec-trend" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-purple-500 inline-block" />
                    3. Performance trend
                  </h3>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                      <button
                        onClick={() => setTrendSort('recent')}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          trendSort === 'recent'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Most recent
                      </button>
                      <button
                        onClick={() => setTrendSort('popular')}
                        className={`px-3 py-1 rounded-lg transition-colors ${
                          trendSort === 'popular'
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500'
                        }`}
                      >
                        Most popular
                      </button>
                    </div>

                    <select className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium">
                      <option>Video views</option>
                    </select>
                  </div>
                </div>

                {/* Summary row */}
                <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500">
                  <div>
                    Highest video view <strong className="text-slate-900 dark:text-white ml-1">{formatNumber(maxViewVal)}</strong>
                  </div>
                  <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                  <div>
                    Lowest video view <strong className="text-slate-900 dark:text-white ml-1">{formatNumber(minViewVal)}</strong>
                  </div>
                  <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                  <div>
                    Average video view <strong className="text-slate-900 dark:text-white ml-1">{formatNumber(avgViewVal)}</strong>
                  </div>
                </div>

                {/* Bar Chart */}
                <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-4">
                  {trendBarData.length > 0 ? (
                    <>
                      <div className="h-72 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={trendBarData}>
                            <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                            <YAxis stroke="#94a3b8" fontSize={11} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                            <Tooltip
                              formatter={(val: any) => [`${(Number(val) / 1000).toFixed(1)}K`, 'Views']}
                              contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                            />
                            <Bar dataKey="branded" stackId="a" fill="#c084fc" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="nonBranded" stackId="a" fill="#818cf8" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="boosted" stackId="a" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="flex flex-wrap gap-4 text-xs font-medium text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Branded content
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-indigo-400" /> Non-branded content
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-teal-400" /> Boosted with paid traffic
                        </span>
                      </div>
                    </>
                  ) : (
                    <div className="h-40 w-full flex items-center justify-center text-slate-400 text-xs italic">
                      {EMPTY} — chưa cào được video nào
                    </div>
                  )}
                </div>
              </section>

              {/* SECTION 4: VIDEOS */}
              <section id="sec-videos" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-pink-500 inline-block" />
                    4. Recent Videos
                  </h3>

                  <div className="flex items-center bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                    <button className="px-3 py-1.5 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg shadow-xs">
                      Most recent
                    </button>
                    <button className="px-3 py-1.5 text-slate-500 hover:text-slate-800">Most popular</button>
                    <button className="px-3 py-1.5 text-slate-500 hover:text-slate-800">Branded content</button>
                  </div>
                </div>

                {/* Video Grid */}
                {displayVideos.length === 0 && (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic">
                    {EMPTY} — chưa cào được video nào từ TikTok
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {displayVideos.map(vid => (
                    <a
                      key={vid.id}
                      href={vid.videoUrl || creator.profileUrl || `https://www.tiktok.com/@${(creator.handle || '').replace(/^@/, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="group bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 flex flex-col shadow-xs hover:shadow-md transition-all hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="relative aspect-[3/4] bg-slate-100 overflow-hidden">
                        <img
                          src={vid.thumb}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Play count badge */}
                        <div className="absolute bottom-2 left-2 flex items-center gap-1 text-white text-xs font-bold bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-full">
                          <Play className="w-3 h-3 fill-white text-white" />
                          {typeof vid.views === 'number' ? formatNumber(vid.views) : vid.views}
                        </div>
                      </div>

                      <div className="p-3 flex-1 flex flex-col justify-between space-y-2">
                        <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-2 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                          {vid.title}
                        </p>

                        <div>
                          {vid.isBranded && (
                            <span className="inline-block px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300 text-[10px] font-bold mb-1">
                              Branded content
                            </span>
                          )}
                          <p className="text-[10px] text-slate-400 font-mono">{vid.date}</p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </section>

              {/* SECTION 5: COLLABORATIONS */}
              <section id="sec-collaborations" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                    5. Collaborations
                  </h3>
                  <select className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium">
                    <option>Last 90 days</option>
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      Branded videos <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <p className={`text-3xl font-black ${creator.brandedVideosCount !== undefined ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                      {creator.brandedVideosCount !== undefined ? creator.brandedVideosCount : EMPTY}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      Industry covered <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <p className={`text-3xl font-black ${creator.industryCoveredCount !== undefined ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                      {creator.industryCoveredCount !== undefined ? creator.industryCoveredCount : EMPTY}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-1">
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      Response rate <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                    </span>
                    <p className={`text-3xl font-black ${creator.responseRate ? 'text-slate-900 dark:text-white' : 'text-slate-400 italic text-sm font-normal'}`}>
                      {creator.responseRate || EMPTY}
                    </p>
                  </div>
                </div>
              </section>

              {/* SECTION 6: AUDIENCE DEMOGRAPHICS */}
              <section id="sec-demographics" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                    6. Audience demographics
                  </h3>

                  <div className="flex items-center gap-1 bg-slate-200/60 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold w-fit mb-4">
                    <button
                      onClick={() => setDemoTab('reached')}
                      className={`px-4 py-1.5 rounded-lg transition-colors ${
                        demoTab === 'reached'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Audience reached
                    </button>
                    <button
                      onClick={() => setDemoTab('engaged')}
                      className={`px-4 py-1.5 rounded-lg transition-colors ${
                        demoTab === 'engaged'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Audience engaged
                    </button>
                    <button
                      onClick={() => setDemoTab('followers')}
                      className={`px-4 py-1.5 rounded-lg transition-colors ${
                        demoTab === 'followers'
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      Follower demographics
                    </button>
                  </div>

                  {/* Summary row */}
                  <div className="flex flex-wrap items-center gap-6 text-xs text-slate-500 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800">
                    <div>
                      Gender{' '}
                      <strong className="text-slate-900 dark:text-white ml-1">
                        {creator.demographics?.genderFemale !== undefined ? `Female (${creator.demographics.genderFemale}%)` : EMPTY}
                      </strong>
                    </div>
                    <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                    <div>
                      Top Age <strong className="text-slate-900 dark:text-white ml-1">{creator.demographics?.topAgeGroup || EMPTY}</strong>
                    </div>
                    <div className="h-3 w-px bg-slate-300 dark:bg-slate-700" />
                    <div>
                      Top country or region{' '}
                      <strong className="text-slate-900 dark:text-white ml-1">{creator.demographics?.topCountry || creator.country || EMPTY}</strong>
                    </div>
                  </div>
                </div>

                {/* Donut Charts — only rendered when the scraper actually captured this demographic */}
                {(hasGenderData || ageData.length > 0) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {hasGenderData && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">Gender</h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={genderData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {genderData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={val => `${val}%`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-4 text-xs font-medium text-slate-500">
                          {genderData.map((g, i) => (
                            <span key={g.name} className="flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              {g.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {ageData.length > 0 && (
                      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 space-y-3">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1">
                          Age <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        </h4>
                        <div className="h-48 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={ageData}
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={70}
                                paddingAngle={3}
                                dataKey="value"
                              >
                                {ageData.map((_, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={val => `${val}%`} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center flex-wrap gap-3 text-xs font-medium text-slate-500">
                          {ageData.map((a, i) => (
                            <span key={a.name} className="flex items-center gap-1">
                              <span
                                className="w-2.5 h-2.5 rounded-full"
                                style={{ backgroundColor: COLORS[i % COLORS.length] }}
                              />
                              {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-slate-400 text-xs italic">
                    {EMPTY} — TikTok One chưa trả về audience demographics cho creator này
                  </div>
                )}
              </section>

              {/* SECTION 7: INTERNAL NOTES & CRM LOGS */}
              <section id="sec-notes" className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800 pb-8">
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-600 inline-block" />
                  7. Internal Notes & CRM Activities
                </h3>

                <form onSubmit={handleNoteSubmit} className="space-y-2">
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={e => setNewNoteText(e.target.value)}
                    placeholder="Write an internal operator note about rate negotiations, preferences, contact history..."
                    className="w-full p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={!newNoteText.trim()}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold disabled:opacity-50 shadow-xs"
                  >
                    Save Internal Note
                  </button>
                </form>

                <div className="space-y-3">
                  {!creator.notes || creator.notes.length === 0 ? (
                    <p className="text-slate-400 py-6 text-center text-xs">No internal notes added yet.</p>
                  ) : (
                    creator.notes.map(n => (
                      <div
                        key={n.id}
                        className="p-4 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between text-slate-400 text-[11px]">
                          <span className="font-bold text-slate-700 dark:text-slate-300">{n.author}</span>
                          <span>{new Date(n.createdAt).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-800 dark:text-slate-200">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
