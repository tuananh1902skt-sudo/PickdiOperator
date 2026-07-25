import React, { useState } from 'react';
import { CheckSquare, Plus, Clock, CheckCircle2, Trash2 } from 'lucide-react';
import { Task } from '../../types';

interface TasksViewProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onOpenCreateTask: () => void;
  onDeleteTask: (id: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  onToggleComplete,
  onOpenCreateTask,
  onDeleteTask
}) => {
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  const filteredTasks = tasks.filter(t => {
    if (filter === 'PENDING' && t.status !== 'Pending') return false;
    if (filter === 'COMPLETED' && t.status !== 'Completed') return false;
    return true;
  });

  const getPriorityBadge = (p: Task['priority']) => {
    switch (p) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">CRITICAL 🚨</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">LOW</span>;
    }
  };

  return (
    <div className="space-y-4 pb-12 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Operator Task Command
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational reminders for sample dispatching, follow-ups & contract signatures
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded-lg ${filter === 'ALL' ? 'bg-white dark:bg-slate-900 shadow-2xs font-bold text-indigo-600' : 'text-slate-500'}`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-3 py-1 rounded-lg ${filter === 'PENDING' ? 'bg-white dark:bg-slate-900 shadow-2xs font-bold text-indigo-600' : 'text-slate-500'}`}
            >
              Pending ({tasks.filter(t => t.status === 'Pending').length})
            </button>
            <button
              onClick={() => setFilter('COMPLETED')}
              className={`px-3 py-1 rounded-lg ${filter === 'COMPLETED' ? 'bg-white dark:bg-slate-900 shadow-2xs font-bold text-indigo-600' : 'text-slate-500'}`}
            >
              Completed ({tasks.filter(t => t.status === 'Completed').length})
            </button>
          </div>

          <button
            onClick={onOpenCreateTask}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Tasks Table / Cards */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredTasks.length === 0 ? (
            <div className="text-center py-12 text-xs text-slate-400">No tasks found.</div>
          ) : (
            filteredTasks.map(t => {
              const isCompleted = t.status === 'Completed';

              return (
                <div
                  key={t.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    isCompleted ? 'bg-slate-50/50 dark:bg-slate-800/20 opacity-70' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <button
                      onClick={() => onToggleComplete(t.id)}
                      className={`p-1 rounded-lg border transition-colors ${
                        isCompleted
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'border-slate-300 dark:border-slate-700 text-transparent hover:border-emerald-500'
                      }`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`font-bold text-xs ${isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                          {t.title}
                        </span>
                        {getPriorityBadge(t.priority)}
                      </div>

                      {t.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-1">{t.description}</p>
                      )}

                      <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Due {t.dueDate}
                        </span>
                        {t.relatedCreatorName && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                            • Creator: {t.relatedCreatorName}
                          </span>
                        )}
                        <span>• Assigned to {t.assignedTo}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => onDeleteTask(t.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
