import React from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Download, Sparkles } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Creator, Campaign } from '../../types';

interface ReportsViewProps {
  creators: Creator[];
  campaigns: Campaign[];
}

export const ReportsView: React.FC<ReportsViewProps> = ({ creators, campaigns }) => {
  const weeklyData = [
    { day: 'Mon', emailsSent: 18, replies: 7, deals: 2 },
    { day: 'Tue', emailsSent: 22, replies: 9, deals: 4 },
    { day: 'Wed', emailsSent: 25, replies: 11, deals: 5 },
    { day: 'Thu', emailsSent: 20, replies: 8, deals: 3 },
    { day: 'Fri', emailsSent: 28, replies: 12, deals: 6 },
    { day: 'Sat', emailsSent: 15, replies: 5, deals: 1 },
    { day: 'Sun', emailsSent: 10, replies: 3, deals: 1 }
  ];

  const categoryBreakdown = [
    { name: 'Beauty & Skincare', value: 45, color: '#6366f1' },
    { name: 'Makeup', value: 30, color: '#ec4899' },
    { name: 'Lifestyle', value: 15, color: '#8b5cf6' },
    { name: 'Fashion', value: 10, color: '#10b981' }
  ];

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

        <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs flex items-center gap-2">
          <Download className="w-4 h-4 text-indigo-500" />
          Export Executive Report
        </button>
      </div>

      {/* Summary Stat Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Total Database Creators</span>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{creators.length}</p>
          <span className="text-emerald-600 text-[11px] font-semibold">+12% this month</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Avg Response Rate</span>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">38.8%</p>
          <span className="text-emerald-600 text-[11px] font-semibold">Above industry benchmark (25%)</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Active Campaigns</span>
          <p className="text-2xl font-bold text-purple-600 mt-1">{campaigns.length}</p>
          <span className="text-slate-400 text-[11px]">Running Q3</span>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="text-[10px] font-bold text-slate-400 uppercase">Avg Brand Fit Score</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">91.4</p>
          <span className="text-slate-400 text-[11px]">Qualified Quality Threshold</span>
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
                <YAxis stroke="#94a3b8" fontSize={12} />
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
          </div>
        </div>
      </div>
    </div>
  );
};
