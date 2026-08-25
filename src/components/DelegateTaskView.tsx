import React, { useState, useMemo, useEffect } from 'react';
import { TaskItem, User, Department, TaskFrequency, TaskPriority, OnlinePresenceUser } from '../types';
import {
  PlusCircle,
  UserCheck,
  Calendar,
  Clock,
  Repeat,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Send,
  ListTodo,
  CheckSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { googleSheetSync } from '../services/googleSheetSync';
import { realtimeSync } from '../services/realtimeSync';
import { pushNotificationService } from '../services/pushNotificationService';
import { saveCloudTask } from '../services/firebaseClient';

interface DelegateTaskViewProps {
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  users: User[];
  activeUser: User;
  onNavigateToHub: () => void;
  onlineUsers?: OnlinePresenceUser[];
  initialTaskToEdit?: TaskItem | null;
  onClearEditTask?: () => void;
}

export const DelegateTaskView: React.FC<DelegateTaskViewProps> = ({
  tasks,
  setTasks,
  users,
  activeUser,
  onNavigateToHub,
  initialTaskToEdit = null,
  onClearEditTask,
}) => {
  // Form State
  const [taskName, setTaskName] = useState<string>('');
  const [assignedToEmail, setAssignedToEmail] = useState<string>(
    users[0]?.Email || 'amit.meena@malwaconcrete.com'
  );
  const [department, setDepartment] = useState<Department>('Factory Ops');
  const [frequency, setFrequency] = useState<TaskFrequency>('One-Time');
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [dueTime, setDueTime] = useState<string>('18:00');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  
  // Checklist Items State (defaults to empty so no unwanted auto steps appear)
  const [subtasks, setSubtasks] = useState<{ id: string; title: string }[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState<string>('');
  const [notice, setNotice] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load initial task to edit if provided
  useEffect(() => {
    if (initialTaskToEdit) {
      setTaskName(initialTaskToEdit.Task_Name);
      setAssignedToEmail(initialTaskToEdit.Assigned_To_Email);
      setDepartment(initialTaskToEdit.Department || 'Factory Ops');
      setFrequency(initialTaskToEdit.Frequency);
      setDueDate(initialTaskToEdit.Due_Date);
      setDueTime(initialTaskToEdit.Due_Time || '18:00');
      setPriority(initialTaskToEdit.Priority);
      if (initialTaskToEdit.Subtasks && initialTaskToEdit.Subtasks.length > 0) {
        setSubtasks(
          initialTaskToEdit.Subtasks.map((st) => ({
            id: st.id,
            title: st.title
          }))
        );
      } else {
        setSubtasks([]);
      }
    } else {
      setSubtasks([]);
    }
  }, [initialTaskToEdit]);

  // Selected Assignee User Object
  const assignedUser = useMemo(() => {
    return users.find((u) => u.Email.toLowerCase() === assignedToEmail.toLowerCase()) || users[0];
  }, [users, assignedToEmail]);

  // Update department automatically when assignee changes
  const handleAssigneeChange = (email: string) => {
    setAssignedToEmail(email);
    const user = users.find((u) => u.Email.toLowerCase() === email.toLowerCase());
    if (user && user.Department) {
      setDepartment(user.Department);
    }
  };

  // Checklist Item Management
  const handleAddSubtaskItem = () => {
    if (!newSubtaskInput.trim()) return;
    setSubtasks((prev) => [
      ...prev,
      { id: `${Date.now()}-${prev.length + 1}`, title: newSubtaskInput.trim() }
    ]);
    setNewSubtaskInput('');
  };

  const handleRemoveSubtaskItem = (id: string) => {
    setSubtasks((prev) => prev.filter((st) => st.id !== id));
  };

  const handleSubtaskKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddSubtaskItem();
    }
  };

  // Quick Date Setters
  const setQuickDate = (type: 'today' | 'tomorrow' | 'nextWeek') => {
    const d = new Date();
    if (type === 'tomorrow') {
      d.setDate(d.getDate() + 1);
    } else if (type === 'nextWeek') {
      d.setDate(d.getDate() + 7);
    }
    setDueDate(d.toISOString().split('T')[0]);
  };

  // Form Submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;

    setIsSubmitting(true);

    const assignedName = assignedUser ? assignedUser.Full_Name : assignedToEmail.split('@')[0];

    const formattedSubtasks = subtasks
      .filter((st) => st.title.trim().length > 0)
      .map((st, idx) => ({
        id: st.id || `${Date.now()}-${idx + 1}`,
        title: st.title.trim(),
        completed: false
      }));

    if (initialTaskToEdit) {
      // Update existing task
      const updatedList = tasks.map((t) => {
        if (t.Task_ID === initialTaskToEdit.Task_ID) {
          const updated: TaskItem = {
            ...t,
            Task_Name: taskName.trim(),
            Assigned_To_Email: assignedToEmail,
            Assigned_To_Name: assignedName,
            Assigned_To: assignedName,
            Department: department,
            Frequency: frequency,
            Due_Date: dueDate,
            Due_Time: dueTime,
            Priority: priority,
            Subtasks: formattedSubtasks.length > 0 ? formattedSubtasks : t.Subtasks
          };

          realtimeSync.broadcastTaskMutation('UPDATE', updated, activeUser);
          googleSheetSync.syncRecord('TASK_HUB', updated, activeUser.Email, 'UPSERT_RECORD');
          saveCloudTask(updated);
          return updated;
        }
        return t;
      });

      setTasks(updatedList);
      setIsSubmitting(false);
      if (onClearEditTask) onClearEditTask();
      setNotice(`Task ${initialTaskToEdit.Task_ID} updated successfully!`);
      setTimeout(() => {
        onNavigateToHub();
      }, 1000);
    } else {
      // Create new delegated task
      const newTaskId = `TSK-${Math.floor(300 + Math.random() * 699)}`;
      const newTask: TaskItem = {
        Task_ID: newTaskId,
        Task_Name: taskName.trim(),
        Assigned_To: assignedName,
        Assigned_To_Name: assignedName,
        Assigned_To_Email: assignedToEmail,
        Assigned_By_Email: activeUser.Email,
        Assigned_By_Name: activeUser.Full_Name,
        Department: department,
        Frequency: frequency,
        Due_Date: dueDate,
        Due_Time: dueTime,
        Priority: priority,
        Status: 'Pending',
        Progress_Percentage: 0,
        Subtasks: formattedSubtasks,
        Comments: [],
        Created_At: new Date().toISOString(),
        Tags: ['Delegated Task', frequency, department]
      };

      const updated = [newTask, ...tasks];
      setTasks(updated);

      // Realtime broadcast & Cloud sync & Google Sheets sync
      saveCloudTask(newTask);
      realtimeSync.broadcastTaskMutation('CREATE', newTask, activeUser);
      googleSheetSync.syncRecord('TASK_HUB', newTask, activeUser.Email, 'UPSERT_RECORD');

      // Send Push notification to assignee
      if (assignedToEmail.toLowerCase() !== activeUser.Email.toLowerCase()) {
        pushNotificationService.triggerPushNotification(
          `New Task Delegated: ${newTask.Task_ID}`,
          `${activeUser.Full_Name} assigned "${newTask.Task_Name}" to you (Due: ${newTask.Due_Date})`,
          'ASSIGNMENT',
          assignedToEmail,
          newTask.Task_ID
        );
        realtimeSync.broadcastPushNotification(
          `New Task Delegated: ${newTask.Task_ID}`,
          `${activeUser.Full_Name} assigned "${newTask.Task_Name}" to you (Due: ${newTask.Due_Date})`,
          'ASSIGNMENT',
          assignedToEmail,
          newTask.Task_ID
        );
      }

      // Celebratory animation
      confetti({
        particleCount: 60,
        spread: 60,
        origin: { y: 0.6 }
      });
      pushNotificationService.playNotificationChime(false);

      setIsSubmitting(false);
      setNotice(`Task ${newTask.Task_ID} delegated to ${assignedName}.`);
      
      // Reset form
      setTaskName('');
      setSubtasks([]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-200 pb-3">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
              {initialTaskToEdit ? `Edit Task (${initialTaskToEdit.Task_ID})` : 'Delegate Task & Routine'}
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign factory routines, deadlines, and step-by-step checklists to team members
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={onNavigateToHub}
            className="text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 px-3.5 py-2 rounded-xl transition flex items-center space-x-1.5 shadow-2xs cursor-pointer min-h-[38px]"
          >
            <ListTodo className="w-4 h-4 text-blue-600" />
            <span>Task Hub</span>
          </button>
        </div>
      </div>

      {/* Notice Banner */}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-medium rounded-xl flex items-center justify-between gap-2 animate-fadeIn shadow-2xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{notice}</span>
          </div>
          <button
            onClick={onNavigateToHub}
            className="font-bold underline text-emerald-800 hover:text-emerald-950 text-xs cursor-pointer"
          >
            Go to Task Hub →
          </button>
        </div>
      )}

      {/* Clean Form Card */}
      <div className="bg-white p-5 sm:p-7 rounded-2xl border border-slate-200 shadow-2xs">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Task Name / Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 block">
              Task Name / Activity *
            </label>
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="e.g., Calibrate Weighbridge Load Cells & Log Tolerance Certificate"
              required
              className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none text-slate-900 placeholder-slate-400 font-medium transition min-h-[42px]"
            />
          </div>

          {/* Row: Assignee */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Assign To *</span>
            </label>
            <select
              value={assignedToEmail}
              onChange={(e) => handleAssigneeChange(e.target.value)}
              className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none font-medium text-slate-800 cursor-pointer min-h-[44px]"
            >
              {users.map((u, idx) => (
                <option key={`assignee-${u.Email}-${u.User_ID || idx}`} value={u.Email}>
                  {u.Full_Name} ({u.Department} • {u.Role})
                </option>
              ))}
            </select>
          </div>

          {/* Grid Row: Recurrence Frequency & Priority Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recurrence Frequency Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <Repeat className="w-3.5 h-3.5 text-blue-600" />
                <span>Frequency *</span>
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as TaskFrequency)}
                className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none font-medium text-slate-800 cursor-pointer min-h-[44px]"
              >
                <option value="One-Time">One-Time (No Recurrence)</option>
                <option value="Daily">Daily Routine (Every 24 Hours)</option>
                <option value="Weekly">Weekly Routine (Every 7 Days)</option>
                <option value="Monthly">Monthly Routine (Every Month)</option>
                <option value="Yearly">Yearly Routine (Every Year)</option>
              </select>
            </div>

            {/* Priority Level Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <AlertTriangle className="w-3.5 h-3.5 text-blue-600" />
                <span>Priority *</span>
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs sm:text-sm p-3 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none font-medium text-slate-800 cursor-pointer min-h-[44px]"
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority (Urgent)</option>
              </select>
            </div>
          </div>

          {/* Grid Row: Due Date & Target Time */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-8 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  <span>Target Due Date *</span>
                </label>
                <div className="flex space-x-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setQuickDate('today')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('tomorrow')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    Tomorrow
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuickDate('nextWeek')}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition cursor-pointer"
                  >
                    +7 Days
                  </button>
                </div>
              </div>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none text-slate-900 font-medium min-h-[42px]"
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-blue-600" />
                <span>Target Time (HH:mm)</span>
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none text-slate-900 font-medium min-h-[42px]"
              />
            </div>
          </div>

          {/* Subtasks / Checklist Builder */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                <span>Checklist Steps ({subtasks.length})</span>
              </label>
              <span className="text-[11px] text-slate-400">
                Steps to be verified by assignee
              </span>
            </div>

            {/* Subtask list */}
            {subtasks.length > 0 ? (
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {subtasks.map((st, index) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs gap-2 group hover:border-slate-300 transition"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <span className="text-slate-800 font-medium break-words">{st.title}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveSubtaskItem(st.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition cursor-pointer shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                <p className="text-xs text-slate-400 font-medium">No checklist steps added yet (Optional).</p>
                <p className="text-[11px] text-slate-400">Type a custom step below and click "Add Step" or press Enter if needed.</p>
              </div>
            )}

            {/* Add new subtask row */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newSubtaskInput}
                onChange={(e) => setNewSubtaskInput(e.target.value)}
                onKeyDown={handleSubtaskKeyDown}
                placeholder="Add checklist verification step (Press Enter)..."
                className="flex-1 text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-blue-600 outline-none text-slate-900 placeholder-slate-400 min-h-[42px]"
              />
              <button
                type="button"
                onClick={handleAddSubtaskItem}
                className="bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold px-4 py-2 rounded-xl transition flex items-center space-x-1 cursor-pointer shrink-0 min-h-[42px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add Step</span>
              </button>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onNavigateToHub}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-4 py-2.5 rounded-xl transition cursor-pointer min-h-[40px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[40px]"
            >
              <Send className="w-4 h-4" />
              <span>{initialTaskToEdit ? 'Save Changes' : 'Delegate Task'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
