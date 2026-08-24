import React, { useState, useMemo } from 'react';
import { TaskItem, User } from '../../types';
import { Search, Building2, Calendar, Check, X, Filter } from 'lucide-react';
import { UserAvatar } from './avatarUtils';

interface MobileSearchViewProps {
  tasks: TaskItem[];
  users: User[];
  activeUser: User;
  onOpenTaskDetails: (task: TaskItem) => void;
  onBack: () => void;
}

export const MobileSearchView: React.FC<MobileSearchViewProps> = ({
  tasks,
  users,
  activeUser,
  onOpenTaskDetails,
  onBack,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [selectedPriority, setSelectedPriority] = useState<string>('ALL');

  // Role visibility: Admin sees all; non-admin sees only their tasks
  const visibleTasks = useMemo(() => {
    if (activeUser.Role === 'Admin') return tasks;
    return tasks.filter((t) => {
      const emailMatch =
        t.Assigned_To_Email?.toLowerCase() === activeUser.Email.toLowerCase() ||
        t.Assigned_By_Email?.toLowerCase() === activeUser.Email.toLowerCase();
      const nameMatch =
        t.Assigned_To?.toLowerCase() === activeUser.Full_Name.toLowerCase() ||
        t.Assigned_To_Name?.toLowerCase() === activeUser.Full_Name.toLowerCase();
      return emailMatch || nameMatch;
    });
  }, [tasks, activeUser]);

  const searchResults = useMemo(() => {
    return visibleTasks.filter((t) => {
      // Dept filter
      if (selectedDept !== 'ALL' && t.Department !== selectedDept) return false;

      // Priority filter
      if (selectedPriority !== 'ALL' && t.Priority !== selectedPriority) return false;

      // Query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchTitle = t.Task_Name.toLowerCase().includes(q);
      const matchDept = t.Department?.toLowerCase().includes(q);
      const matchAssignee = (t.Assigned_To || t.Assigned_To_Name || '').toLowerCase().includes(q);
      const matchId = t.Task_ID.toLowerCase().includes(q);
      const matchSubtasks = t.Subtasks?.some((s) => s.title.toLowerCase().includes(q));

      return matchTitle || matchDept || matchAssignee || matchId || matchSubtasks;
    });
  }, [visibleTasks, searchQuery, selectedDept, selectedPriority]);

  return (
    <div className="bg-slate-50 min-h-screen pb-32 pt-4 px-4 space-y-4 animate-fadeIn">
      {/* Search Header */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <Search className="w-4 h-4 text-[#6C70FF]" />
            <span>Search Tasks & Operations</span>
          </h2>
          <span className="text-[11px] text-slate-400 font-mono">
            {searchResults.length} results
          </span>
        </div>

        {/* Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by keyword, SOP, employee or ID..."
            autoFocus
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-9 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#6C70FF] transition min-h-[44px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
            Priority:
          </span>
          {['ALL', 'High', 'Medium', 'Low'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setSelectedPriority(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer min-h-[32px] ${
                selectedPriority === p
                  ? 'bg-[#6C70FF] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Results List */}
      <div className="space-y-2.5">
        {searchResults.length === 0 ? (
          <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 text-slate-400 text-xs space-y-1">
            <Search className="w-8 h-8 mx-auto text-slate-300 mb-2" />
            <p className="font-bold text-slate-700">No matching tasks found</p>
            <p className="text-[11px]">Try modifying your search keywords or priority filter.</p>
          </div>
        ) : (
          searchResults.map((t) => {
            const subDone = t.Subtasks?.filter((s) => s.completed).length || 0;
            const subTotal = t.Subtasks?.length || 0;

            return (
              <div
                key={t.Task_ID}
                onClick={() => onOpenTaskDetails(t)}
                className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs hover:border-[#6C70FF]/50 transition cursor-pointer space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-[10px] font-bold font-mono text-[#6C70FF] bg-indigo-50 px-1.5 py-0.5 rounded">
                      {t.Task_ID}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        t.Priority === 'High'
                          ? 'bg-rose-100 text-rose-700'
                          : t.Priority === 'Medium'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {t.Priority}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate">
                      {t.Department}
                    </span>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                      t.Status === 'Completed'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {t.Status}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                  {t.Task_Name}
                </h4>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center space-x-1.5">
                    <UserAvatar
                      name={t.Assigned_To_Name || t.Assigned_To || 'User'}
                      email={t.Assigned_To_Email}
                      size="sm"
                    />
                    <span className="text-[11px] text-slate-700 font-medium">
                      {t.Assigned_To_Name || t.Assigned_To}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {subTotal > 0 && (
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100 flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" />
                        {subDone}/{subTotal}
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 font-mono">
                      Due: {t.Due_Date}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
