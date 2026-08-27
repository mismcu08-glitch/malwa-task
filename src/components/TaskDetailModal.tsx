import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { TaskItem, User, TaskComment } from '../types';
import {
  X,
  CheckCircle2,
  Clock,
  UserCheck,
  Send,
  Plus,
  Trash2,
  MessageSquare,
  History,
  FileText,
  Calendar,
  AlertCircle,
  Smartphone,
  Share2,
  Check,
  Repeat,
  Lock
} from 'lucide-react';
import { realtimeSync } from '../services/realtimeSync';
import { googleSheetSync } from '../services/googleSheetSync';
import { pushNotificationService } from '../services/pushNotificationService';
import { computeNextDueDate } from '../utils/recurringTaskManager';
import {
  canUserDeleteTask,
  canUserModifyChecklistStructure,
  canUserUpdateTaskStatus,
} from '../utils/rbac';

interface TaskDetailModalProps {
  task: TaskItem | null;
  onClose: () => void;
  users: User[];
  activeUser: User;
  onUpdateTask: (updatedTask: TaskItem) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  onClose,
  users,
  activeUser,
  onUpdateTask,
  onDeleteTask,
}) => {
  const [commentText, setCommentText] = useState<string>('');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'CHECKLIST' | 'COMMENTS' | 'AUDIT'>('CHECKLIST');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState<boolean>(false);

  if (!task) return null;

  // RBAC Security Permissions for this specific task & user
  const isAllowedToDelete = canUserDeleteTask(activeUser, task);
  const isAllowedToModifyChecklist = canUserModifyChecklistStructure(activeUser, task);
  const isAllowedToUpdateStatus = canUserUpdateTaskStatus(activeUser, task);

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      authorEmail: activeUser.Email,
      authorName: activeUser.Full_Name,
      text: commentText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedComments = [...(task.Comments || []), newComment];
    const updated: TaskItem = {
      ...task,
      Comments: updatedComments,
    };

    onUpdateTask(updated);
    realtimeSync.broadcastTaskMutation('UPDATE', updated, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', updated, activeUser.Email, 'ADD_COMMENT');

    // Notify other collaborator if not self
    const otherEmail =
      task.Assigned_To_Email.toLowerCase() === activeUser.Email.toLowerCase()
        ? task.Assigned_By_Email
        : task.Assigned_To_Email;

    if (otherEmail && otherEmail.toLowerCase() !== activeUser.Email.toLowerCase()) {
      pushNotificationService.triggerPushNotification(
        `New Comment on ${task.Task_ID}`,
        `${activeUser.Full_Name}: "${commentText.trim().slice(0, 50)}..."`,
        'UPDATE',
        otherEmail,
        task.Task_ID
      );
    }

    setCommentText('');
  };

  const handleAddSubtask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAllowedToModifyChecklist) {
      alert('Security Restriction: Only the Task Assigner (Creator) or an Administrator can add subtasks.');
      return;
    }
    if (!newSubtaskTitle.trim()) return;

    const newSubtask = {
      id: `${Date.now()}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };

    const updatedSubtasks = [...task.Subtasks, newSubtask];
    const completedCount = updatedSubtasks.filter((st) => st.completed).length;
    const progress = Math.round((completedCount / updatedSubtasks.length) * 100);

    const updated: TaskItem = {
      ...task,
      Subtasks: updatedSubtasks,
      Progress_Percentage: progress,
    };

    onUpdateTask(updated);
    realtimeSync.broadcastTaskMutation('UPDATE', updated, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', updated, activeUser.Email, 'ADD_SUBTASK');
    setNewSubtaskTitle('');
  };

  const handleToggleSubtaskInModal = (subtaskId: string) => {
    if (!isAllowedToUpdateStatus) {
      alert('Security Restriction: Only the Assignee, Assigner, or Administrator can update task progress.');
      return;
    }

    const updatedSubtasks = task.Subtasks.map((st) =>
      st.id === subtaskId
        ? {
            ...st,
            completed: !st.completed,
            completedAt: !st.completed ? new Date().toLocaleString() : undefined,
            completedBy: !st.completed ? activeUser.Email : undefined,
          }
        : st
    );

    const completedCount = updatedSubtasks.filter((st) => st.completed).length;
    const progress = Math.round((completedCount / updatedSubtasks.length) * 100);
    // DO NOT automatically complete the task - user must click Complete button and confirm in popup
    const newStatus = task.Status === 'Completed' ? 'Completed' : progress > 0 ? 'In_Progress' : 'Pending';

    const updated: TaskItem = {
      ...task,
      Subtasks: updatedSubtasks,
      Progress_Percentage: progress,
      Status: newStatus,
      Completed_At: newStatus === 'Completed' ? task.Completed_At : undefined,
    };

    onUpdateTask(updated);
    realtimeSync.broadcastTaskMutation('SUBTASK_TOGGLE', updated, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', updated, activeUser.Email, 'UPSERT_RECORD');
  };

  const handleConfirmComplete = () => {
    if (!isAllowedToUpdateStatus) {
      alert('Security Restriction: You do not have permission to mark this task as completed.');
      return;
    }

    const now = new Date().toLocaleString();
    const completedSubtasks = task.Subtasks.map((st) => ({
      ...st,
      completed: true,
      completedAt: st.completedAt || now,
      completedBy: st.completedBy || activeUser.Email,
    }));

    const completedTask: TaskItem = {
      ...task,
      Status: 'Completed',
      Progress_Percentage: 100,
      Completed_At: now,
      Subtasks: completedSubtasks,
    };

    confetti({
      particleCount: 60,
      spread: 60,
      origin: { y: 0.6 },
    });
    pushNotificationService.playNotificationChime(false);

    onUpdateTask(completedTask);
    realtimeSync.broadcastTaskMutation('COMPLETE', completedTask, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', completedTask, activeUser.Email, 'ARCHIVE_COMPLETED');
    pushNotificationService.notifyTaskStatusChanged(completedTask, activeUser, 'Completed');
    
    setShowCompleteConfirm(false);
    onClose();
  };

  const handleDeleteSubtask = (subtaskId: string) => {
    if (!isAllowedToModifyChecklist) {
      alert('Security Restriction: Only the Task Assigner (Creator) or an Administrator can delete checklist items.');
      return;
    }

    const updatedSubtasks = task.Subtasks.filter((st) => st.id !== subtaskId);
    const completedCount = updatedSubtasks.filter((st) => st.completed).length;
    const progress =
      updatedSubtasks.length > 0
        ? Math.round((completedCount / updatedSubtasks.length) * 100)
        : 0;

    const updated: TaskItem = {
      ...task,
      Subtasks: updatedSubtasks,
      Progress_Percentage: progress,
    };

    onUpdateTask(updated);
    realtimeSync.broadcastTaskMutation('UPDATE', updated, activeUser);
  };

  const handleConfirmDelete = () => {
    if (!isAllowedToDelete) {
      alert('Security Restriction: You do not have permission to delete this task.');
      return;
    }
    if (onDeleteTask) {
      onDeleteTask(task.Task_ID);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col my-0 sm:my-6 animate-scaleUp">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2 flex-wrap gap-y-1">
              <span className="font-mono text-xs font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-0.5 rounded">
                {task.Task_ID}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  task.Priority === 'High'
                    ? 'bg-rose-100 text-rose-800'
                    : task.Priority === 'Medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-700'
                }`}
              >
                {task.Priority} Priority
              </span>
              {task.Frequency && task.Frequency !== 'One-Time' ? (
                <span className="text-[11px] font-bold text-purple-700 bg-purple-50 border border-purple-200/80 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                  <Repeat className="w-3 h-3" />
                  <span>{task.Frequency} Routine</span>
                </span>
              ) : (
                <span className="text-[11px] font-medium text-slate-600 bg-slate-200 px-2 py-0.5 rounded-full">
                  One-Time
                </span>
              )}
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1.5 break-words">{task.Task_Name}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-lg hover:bg-slate-200 active:bg-slate-300 transition cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-2 sm:px-5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('CHECKLIST')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer min-h-[44px] ${
              activeTab === 'CHECKLIST'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Checklist ({task.Subtasks.length})
          </button>
          <button
            onClick={() => setActiveTab('COMMENTS')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer min-h-[44px] ${
              activeTab === 'COMMENTS'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Comments ({(task.Comments || []).length})
          </button>
          <button
            onClick={() => setActiveTab('AUDIT')}
            className={`py-3 px-3.5 text-xs font-bold border-b-2 whitespace-nowrap transition cursor-pointer min-h-[44px] ${
              activeTab === 'AUDIT'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Audit History
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
          {/* TAB 1: CHECKLIST */}
          {activeTab === 'CHECKLIST' && (
            <div className="space-y-4">
              {task.Frequency && task.Frequency !== 'One-Time' && (
                <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-xl flex items-start space-x-2.5 text-xs text-purple-900">
                  <Repeat className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold">Recurring Routine ({task.Frequency})</span>
                    <p className="text-[11px] text-purple-700">
                      When this cycle is marked 100% complete, the system automatically spawns the next routine task for{' '}
                      <span className="font-bold underline">{computeNextDueDate(task.Due_Date, task.Frequency)}</span>.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="space-y-0.5">
                  <span className="text-xs font-bold text-slate-700">Checklist Completion</span>
                  <p className="text-[11px] text-slate-500">
                    {task.Subtasks.filter((s) => s.completed).length} of {task.Subtasks.length} subtasks completed
                  </p>
                </div>
                <span className="text-sm font-mono font-bold text-blue-700">{task.Progress_Percentage}%</span>
              </div>

              {/* Checklist Items */}
              <div className="space-y-2">
                {task.Subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl hover:border-slate-300 transition gap-2"
                  >
                    <label className={`flex items-start space-x-2.5 flex-1 select-none ${isAllowedToUpdateStatus ? 'cursor-pointer' : 'cursor-not-allowed opacity-90'}`}>
                      <input
                        type="checkbox"
                        checked={st.completed}
                        disabled={!isAllowedToUpdateStatus}
                        onChange={() => handleToggleSubtaskInModal(st.id)}
                        className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed shrink-0"
                      />
                      <div className="text-xs">
                        <span className={`break-words ${st.completed ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}`}>
                          {st.title}
                        </span>
                        {st.completedAt && (
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            Completed at {st.completedAt} by {st.completedBy || 'Assignee'}
                          </div>
                        )}
                      </div>
                    </label>
                    {isAllowedToModifyChecklist && (
                      <button
                        onClick={() => handleDeleteSubtask(st.id)}
                        className="text-slate-400 hover:text-rose-600 p-2 rounded-lg hover:bg-rose-50 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0 cursor-pointer"
                        title="Remove checklist item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Complete Task Action Card if not completed and user is authorized */}
              {task.Status !== 'Completed' && isAllowedToUpdateStatus && (
                <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                  task.Progress_Percentage === 100
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs animate-pulse'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                }`}>
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className={`w-4 h-4 ${task.Progress_Percentage === 100 ? 'text-emerald-600' : 'text-slate-400'}`} />
                      {task.Progress_Percentage === 100 ? 'All Checklist Steps Complete!' : 'Ready to Finalize & Sign-Off?'}
                    </span>
                    <p className="text-[11px] text-slate-500">
                      {task.Progress_Percentage === 100
                        ? 'Click below to submit completion sign-off to the database.'
                        : 'You can sign off and mark this task completed once all activities are verified.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCompleteConfirm(true)}
                    className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer shrink-0 min-h-[38px]"
                  >
                    <Check className="w-4 h-4" />
                    <span>Complete Task</span>
                  </button>
                </div>
              )}

              {/* Add New Subtask Form - Only for Creator / Admin */}
              {isAllowedToModifyChecklist ? (
                <form onSubmit={handleAddSubtask} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                  <input
                    type="text"
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add another checklist item..."
                    className="flex-1 text-xs p-3 sm:p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white outline-none min-h-[44px] sm:min-h-0"
                  />
                  <button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-4 py-3 sm:py-2.5 rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Item</span>
                  </button>
                </form>
              ) : (
                <div className="pt-2 text-[11px] text-slate-400 flex items-center space-x-1.5 border-t border-slate-100">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  <span>Checklist structure managed by Task Assigner ({task.Assigned_By_Email}) and Admin.</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: COMMENTS & SHIFT HANDOVER */}
          {activeTab === 'COMMENTS' && (
            <div className="space-y-4">
              <div className="space-y-3">
                {(!task.Comments || task.Comments.length === 0) ? (
                  <div className="p-6 text-center text-slate-400 text-xs italic bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No comments or handover notes posted yet. Add a message below to coordinate with team members.
                  </div>
                ) : (
                  task.Comments.map((c) => (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs"
                    >
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="font-bold text-slate-800">{c.authorName}</span>
                        <span className="text-slate-400 font-mono">{c.createdAt}</span>
                      </div>
                      <p className="text-slate-700 leading-relaxed break-words">{c.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Post Comment Input */}
              <form onSubmit={handleAddComment} className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a collaborative note or shift handover..."
                  className="flex-1 text-xs p-3 sm:p-2.5 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white outline-none min-h-[44px] sm:min-h-0"
                />
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs px-4 py-3 sm:py-2.5 rounded-lg transition flex items-center justify-center space-x-1 cursor-pointer min-h-[44px]"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: AUDIT HISTORY */}
          {activeTab === 'AUDIT' && (
            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5">
                  <span className="text-slate-500 font-medium">Assigned Assignee:</span>
                  <span className="font-bold text-slate-900 font-mono break-all">{task.Assigned_To_Email}</span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-0.5">
                  <span className="text-slate-500 font-medium">Delegated By:</span>
                  <span className="font-bold text-slate-900 font-mono break-all">{task.Assigned_By_Email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Department:</span>
                  <span className="font-bold text-slate-900">{task.Department || 'Quality & Compliance'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Due Date:</span>
                  <span className="font-bold text-blue-700 font-mono">
                    {task.Due_Date} {task.Due_Time || '18:00'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Creation Timestamp:</span>
                  <span className="text-slate-600 font-mono text-[11px]">{task.Created_At}</span>
                </div>
                {task.Completed_At && (
                  <div className="flex justify-between items-center text-emerald-700 font-semibold">
                    <span>Completed Timestamp:</span>
                    <span className="font-mono text-[11px]">{task.Completed_At}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Complete Confirmation Alert Banner (within modal) */}
        {showCompleteConfirm ? (
          <div className="p-4 bg-emerald-50 border-t border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-2.5 text-emerald-900 text-xs font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-slate-900">Confirm Task Completion?</p>
                <p className="text-[11px] text-emerald-700 font-normal">This will sign off all steps and save the completed record to the database.</p>
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowCompleteConfirm(false)}
                className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center space-x-1.5 shadow-xs"
              >
                <Check className="w-4 h-4" />
                <span>Yes, Complete Task</span>
              </button>
            </div>
          </div>
        ) : showDeleteConfirm ? (
          <div className="p-3.5 bg-rose-50 border-t border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center space-x-2 text-rose-800 text-xs font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Are you sure you want to permanently delete this task?</span>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirm Delete</span>
              </button>
            </div>
          </div>
        ) : (
          /* Modal Footer */
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
            {onDeleteTask && isAllowedToDelete ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold text-rose-600 hover:text-rose-800 hover:bg-rose-50 px-3 py-2 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Task</span>
              </button>
            ) : <div />}
            
            <div className="flex items-center space-x-2">
              <button
                onClick={onClose}
                className="bg-slate-200 hover:bg-slate-300 active:bg-slate-400 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition min-h-[40px] flex items-center justify-center cursor-pointer"
              >
                Close
              </button>
              {task.Status !== 'Completed' && isAllowedToUpdateStatus && (
                <button
                  type="button"
                  onClick={() => setShowCompleteConfirm(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition min-h-[40px] flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Check className="w-4 h-4" />
                  <span>Complete Task</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
