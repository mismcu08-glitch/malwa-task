import React, { useMemo } from 'react';
import { TaskItem, User } from '../types';
import {
  X,
  TrendingUp,
  Award,
  ClockAlert,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  BarChart3,
  Calendar,
  Users,
  Activity
} from 'lucide-react';

interface AnalyticsDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: TaskItem[];
  users: User[];
}

export const AnalyticsDashboardModal: React.FC<AnalyticsDashboardModalProps> = ({
  isOpen,
  onClose,
  tasks,
  users,
}) => {
  if (!isOpen) return null;

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.Status === 'Completed').length;
  const pendingTasks = tasks.filter((t) => t.Status === 'Pending').length;
  const inProgressTasks = tasks.filter((t) => t.Status === 'In_Progress').length;
  const overdueTasks = tasks.filter(
    (t) =>
      (new Date(t.Due_Date) < new Date() && t.Status !== 'Completed') ||
      t.Status === 'Overdue'
  ).length;

  const completionRate =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Departmental breakdown
  const departmentStats = useMemo(() => {
    const map: { [dept: string]: { total: number; completed: number; overdue: number } } = {};
    tasks.forEach((t) => {
      const dept = t.Department || 'Operations';
      if (!map[dept]) map[dept] = { total: 0, completed: 0, overdue: 0 };
      map[dept].total += 1;
      if (t.Status === 'Completed') map[dept].completed += 1;
      if (
        (new Date(t.Due_Date) < new Date() && t.Status !== 'Completed') ||
        t.Status === 'Overdue'
      ) {
        map[dept].overdue += 1;
      }
    });
    return Object.entries(map).map(([name, stats]) => ({
      name,
      ...stats,
      rate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
    }));
  }, [tasks]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Task_ID',
      'Task_Name',
      'Assignee_Email',
      'Priority',
      'Frequency',
      'Due_Date',
      'Status',
      'Progress_%',
      'Created_At',
    ];
    const rows = tasks.map((t) => [
      t.Task_ID,
      `"${t.Task_Name.replace(/"/g, '""')}"`,
      t.Assigned_To_Email,
      t.Priority,
      t.Frequency,
      t.Due_Date,
      t.Status,
      t.Progress_Percentage,
      t.Created_At,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Malwa_Task_Analytics_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden my-6 animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Operational Analytics & Team Productivity Dashboard
              </h2>
              <p className="text-xs text-slate-500">
                On-time SLA adherence, departmental completion matrices, and exportable reports
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-1">
              <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider block">
                Total Delegated
              </span>
              <div className="text-2xl font-mono font-extrabold text-blue-950">{totalTasks}</div>
              <span className="text-[10px] text-blue-700">Active & recurring routines</span>
            </div>

            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-1">
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">
                Completed & Closed
              </span>
              <div className="text-2xl font-mono font-extrabold text-emerald-950">{completedTasks}</div>
              <span className="text-[10px] text-emerald-700 font-semibold">{completionRate}% fulfillment</span>
            </div>

            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                In Progress / Active
              </span>
              <div className="text-2xl font-mono font-extrabold text-amber-950">
                {inProgressTasks + pendingTasks}
              </div>
              <span className="text-[10px] text-amber-700">Under execution</span>
            </div>

            <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200 space-y-1">
              <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                SLA Breaches
              </span>
              <div className="text-2xl font-mono font-extrabold text-rose-950">{overdueTasks}</div>
              <span className="text-[10px] text-rose-700">Overdue follow-ups</span>
            </div>
          </div>

          {/* Departmental Performance Matrix */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center space-x-2">
              <Award className="w-4 h-4 text-blue-600" />
              <span>Departmental Task Completion Scores</span>
            </h4>
            <div className="space-y-2.5">
              {departmentStats.map((dept) => (
                <div key={dept.name} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-slate-800">{dept.name}</span>
                    <div className="flex items-center space-x-3 text-[11px]">
                      <span className="text-slate-500">{dept.completed}/{dept.total} tasks</span>
                      {dept.overdue > 0 && (
                        <span className="text-rose-600 font-bold font-mono">({dept.overdue} overdue)</span>
                      )}
                      <span className="font-mono font-bold text-blue-700">{dept.rate}%</span>
                    </div>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        dept.rate > 75
                          ? 'bg-emerald-500'
                          : dept.rate > 40
                          ? 'bg-blue-600'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${dept.rate}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Export and Reports Action */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h5 className="text-xs font-bold text-slate-900">Download Comprehensive Task Audit File</h5>
              <p className="text-[11px] text-slate-500">
                Export all task logs, assignees, checklist percentages, and due date records to standard CSV
              </p>
            </div>
            <button
              onClick={handleExportCSV}
              className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV Ledger</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-5 py-2 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
