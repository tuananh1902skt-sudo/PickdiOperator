import React from 'react';
import { BarChart3, Download } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Creator, Campaign, OutreachEmail, Conversation } from '../../types';

interface ReportsViewProps {
  creators: Creator[];
  campaigns: Campaign[];
  outreachList?: OutreachEmail[];
  conversations?: Conversation[];
}

const PIE_COLORS = ['#6366f1', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#0ea5e9'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ReportsView: React.FC<ReportsViewProps> = ({
  creators,
  campaigns,
  outreachList = [],
  conversations = []
}) => {
  // Last 7 days of real outreach activity, grouped by day-of-week.
  const today = new Date();
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const weeklyData = last7Days.map(dayStart => {
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const emailsSent = outreachList.filter(o => {
      if (!o.sentAt) return false;
      const t = new Date(o.sentAt).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;

    const replies = conversations.reduce((count, conv) => {
      return (
        count +
        conv.messages.filter(m => {
          if (m.senderType !== 'CREATOR') return false;
          const t = new Date(m.createdAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        }).length
      );
    }, 0);

    return { day: DAY_LABELS[dayStart.getDay()], emailsSent, replies };
  });

  // Real category distribution from the current creator roster.
  const categoryCounts: Record<string, number> = {};
  creators.forEach(c => {
    const key = c.category || 'Uncategorized';
    categoryCounts[key] = (categoryCounts[key] || 0) + 1;
  });
  const categoryBreakdown = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value], i) => ({ name, value, color: PIE_COLORS[i % PIE_COLORS.length] }));

  // Real response rate: replied / sent.
  const sentCount = outreachList.length;
  const repliedCount = outreachList.filter(o => o.status === 'Replied').length;
  const responseRate = sentCount > 0 ? (repliedCount / sentCount) * 100 : 0;

  // Real average brand fit score across creators that have one.
  const scoredCreators = creators.filter(c => c.brandFitScore !== undefined);
  const avgBrandFitScore =
    scoredCreators.length > 0
      ? scoredCreators.reduce((sum, c) => sum + (c.brandFitScore || 0), 0) / scoredCreators.length
      : 0;

  // Real growth: creators added in the last 30 days vs. the rest of the database.
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newThisMonth = creators.filter(c => c.createdAt && new Date(c.createdAt) >= thirtyDaysAgo).length;

  const handleExport = () => {
    const report = {
      generatedAt: new Date().toISOString(),
      totalCreators: creators.length,
      newCreatorsLast30Days: newThisMonth,
      responseRatePct: Number(responseRate.toFixed(1)),
      activeCampaigns: campaigns.length,
      avgBrandFitScore: Number(avgBrandFitScore.toFixed(1)),
      weeklyOutreach: weeklyData,
      categoryBreakdown
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `executive_report_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Executive Reports & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Performance metrics for TikTok Shop affiliate recruitment & conversion funnels
          </p>
        </div>

        <button
          onClick={handleExport}
          className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2"
        >
          <Download className="w-4 h-4 text-indigo-500" />
          Export Executive Report
        </button>
      </div>

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Database Creators</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{creators.length}</p>
          <span className="text-emerald-600 text-[11px] font-semibold">+{newThisMonth} in last 30 days</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Avg Response Rate</span>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">{responseRate.toFixed(1)}%</p>
          <span className="text-slate-400 text-[11px]">{repliedCount} of {sentCount} emails replied</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Campaigns</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">{campaigns.length}</p>
          <span className="text-slate-400 text-[11px]">{campaigns.filter(c => c.status === 'Running').length} currently running</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Avg Brand Fit Score</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{scoredCreators.length > 0 ? avgBrandFitScore.toFixed(1) : '—'}</p>
          <span className="text-slate-400 text-[11px]">Across {scoredCreators.length} scored creators</span>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Outreach Bar Chart (2 cols) */}
        <div className="lg:col-span-2 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Weekly Outreach & Response Trend
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="emailsSent" fill="#6366f1" name="Emails Sent" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replies" fill="#10b981" name="Replies Received" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution Pie Chart (1 col) */}
        <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-4">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">
            Creator Niche Share
          </h3>
          <div className="h-52">
            {categoryBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {categoryBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No creator data yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
