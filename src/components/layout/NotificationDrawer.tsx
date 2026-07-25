import React, { useState } from 'react';
import {
  Bell,
  X,
  CheckCheck,
  Filter,
  Clock
} from 'lucide-react';
import { NotificationItem } from '../../types';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectTab: (tab: any) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onSelectTab
}) => {
  const [filter, setFilter] = useState<'ALL' | 'UNREAD' | 'HIGH'>('ALL');

  if (!isOpen) return null;

  const filteredNotifs = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.isRead;
    if (filter === 'HIGH') return n.priority === 'CRITICAL' || n.priority === 'HIGH';
    return true;
  });

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">INFO</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 h-full border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Notifications</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onMarkAllRead}
              className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline flex items-center gap-1"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <button
            onClick={() => setFilter('ALL')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              filter === 'ALL'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('UNREAD')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              filter === 'UNREAD'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setFilter('HIGH')}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
              filter === 'HIGH'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
            }`}
          >
            High Priority
          </button>
        </div>

        {/* Notification List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredNotifs.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Bell className="w-12 h-12 stroke-1 mb-3 text-slate-300 dark:text-slate-700" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">No notifications found</p>
              <p className="text-xs text-slate-400 mt-1">You're all caught up with your affiliate workflow!</p>
            </div>
          ) : (
            filteredNotifs.map(n => (
              <div
                key={n.id}
                onClick={() => {
                  if (n.category === 'Review') onSelectTab('reviews');
                  else if (n.category === 'Outreach') onSelectTab('outreach');
                  else if (n.category === 'Campaign') onSelectTab('campaigns');
                  else if (n.category === 'Task') onSelectTab('tasks');
                  onClose();
                }}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                  !n.isRead
                    ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-900/60 shadow-2xs'
                    : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />}
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {n.title}
                    </h4>
                  </div>
                  {getPriorityBadge(n.priority)}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mb-2">
                  {n.description}
                </p>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <span className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                    View detail →
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-center text-xs text-slate-500">
          Showing real-time notifications for {filteredNotifs.length} items
        </div>
      </div>
    </div>
  );
};
