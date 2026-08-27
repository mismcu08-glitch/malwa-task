import React, { useState, useMemo } from 'react';
import { User, TaskItem, NotificationItem, TaskComment } from '../../types';
import {
  ArrowLeft,
  Menu,
  Search,
  Paperclip,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Send,
  Sparkles,
  UserCheck,
  ChevronRight,
  Filter
} from 'lucide-react';
import { UserAvatar } from './avatarUtils';
import { realtimeSync } from '../../services/realtimeSync';
import { googleSheetSync } from '../../services/googleSheetSync';
import { pushNotificationService } from '../../services/pushNotificationService';

interface MobileInboxViewProps {
  activeUser: User;
  users: User[];
  tasks: TaskItem[];
  notifications?: NotificationItem[];
  onBack: () => void;
  onToggleSidebar: () => void;
  onSelectTask: (task: TaskItem) => void;
}

interface ActivityMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  taskTitle: string;
  taskObj?: TaskItem;
  messageText: string;
  timestamp: string;
  hasAttachment?: boolean;
  isHighlighted?: boolean;
  priority?: string;
  isComment?: boolean;
}

export const MobileInboxView: React.FC<MobileInboxViewProps> = ({
  activeUser,
  users,
  tasks,
  notifications = [],
  onBack,
  onToggleSidebar,
  onSelectTask,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeThreadTask, setActiveThreadTask] = useState<TaskItem | null>(null);
  const [quickReplyText, setQuickReplyText] = useState('');

  // Synthesize rich inbox conversations and team updates strictly for tasks the user is involved in
  const messages: ActivityMessage[] = useMemo(() => {
    const list: ActivityMessage[] = [];
    const isUserAdmin = activeUser.Role === 'Admin';
    const myEmail = (activeUser.Email || '').toLowerCase();

    // Filter tasks to only those assigned to me, assigned by me, or if I am an Admin
    const relevantTasks = tasks.filter((t) => {
      if (isUserAdmin) return true;
      const toEmail = (t.Assigned_To_Email || '').toLowerCase();
      const byEmail = (t.Assigned_By_Email || '').toLowerCase();
      return toEmail === myEmail || byEmail === myEmail;
    });

    // 1. Gather relevant tasks with comments
    relevantTasks.forEach((t, idx) => {
      if (t.Comments && t.Comments.length > 0) {
        t.Comments.forEach((c) => {
          list.push({
            id: `msg-comment-${c.id}`,
            senderName: c.authorName,
            senderEmail: c.authorEmail,
            taskTitle: t.Task_Name,
            taskObj: t,
            messageText: c.text,
            timestamp: c.createdAt || 'Recent',
            hasAttachment: true,
            isHighlighted: idx === 0,
            priority: t.Priority,
            isComment: true,
          });
        });
      }

      // Add recent task assignment / status notification
      list.push({
        id: `msg-task-${t.Task_ID}`,
        senderName: t.Assigned_By_Name || t.Assigned_To_Name || 'Supervisor',
        senderEmail: t.Assigned_By_Email || t.Assigned_To_Email,
        taskTitle: t.Task_Name,
        taskObj: t,
        messageText:
          t.Notes ||
          `Task delegated to ${t.Assigned_To_Name || t.Assigned_To}. Checklist: ${
            t.Subtasks?.filter((s) => s.completed).length || 0
          }/${t.Subtasks?.length || 0} items verified.`,
        timestamp: idx === 0 ? '10m' : idx === 1 ? '57m' : idx === 2 ? '2h' : '1d',
        hasAttachment: (t.Subtasks?.length || 0) > 0,
        isHighlighted: idx === 0,
        priority: t.Priority,
        isComment: false,
      });
    });

    return list;
  }, [tasks, activeUser]);

  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return messages;
    const q = searchQuery.toLowerCase();
    return messages.filter(
      (m) =>
        m.senderName.toLowerCase().includes(q) ||
        m.taskTitle.toLowerCase().includes(q) ||
        m.messageText.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const activeHighlightedMsg = filteredMessages[0] || null;
  const standardMessages = filteredMessages.slice(1);

  // Send quick comment/reply
  const handleSendQuickReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickReplyText.trim() || !activeThreadTask) return;

    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      authorEmail: activeUser.Email,
      authorName: activeUser.Full_Name,
      text: quickReplyText.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedTask: TaskItem = {
      ...activeThreadTask,
      Comments: [...(activeThreadTask.Comments || []), newComment],
    };

    realtimeSync.broadcastTaskMutation('UPDATE', updatedTask, activeUser);
    googleSheetSync.syncRecord('TASK_HUB', updatedTask, activeUser.Email, 'ADD_COMMENT');

    // Notify other collaborator
    const targetEmail =
      activeThreadTask.Assigned_To_Email.toLowerCase() === activeUser.Email.toLowerCase()
        ? activeThreadTask.Assigned_By_Email
        : activeThreadTask.Assigned_To_Email;

    if (targetEmail && targetEmail.toLowerCase() !== activeUser.Email.toLowerCase()) {
      pushNotificationService.triggerPushNotification(
        `New Message on ${activeThreadTask.Task_ID}`,
        `${activeUser.Full_Name}: "${quickReplyText.trim()}"`,
        'UPDATE',
        targetEmail,
        activeThreadTask.Task_ID
      );
    }

    setActiveThreadTask(updatedTask);
    setQuickReplyText('');
  };

  return (
    <div className="min-h-screen bg-white pb-32 animate-fadeIn">
      {/* Top Header matching Screenshot 3 */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-slate-100">
        <button
          type="button"
          onClick={activeThreadTask ? () => setActiveThreadTask(null) : onBack}
          className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5 text-slate-800" />
        </button>

        <h1 className="text-base font-bold text-slate-900 tracking-tight">
          {activeThreadTask ? 'Task Conversation' : 'Inbox'}
        </h1>

        <button
          type="button"
          onClick={onToggleSidebar}
          className="p-2 -mr-2 rounded-xl text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5 text-slate-800" />
        </button>
      </div>

      {/* If a thread is selected, show conversational chat view */}
      {activeThreadTask ? (
        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* Thread Header Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <span className="text-[10px] font-mono font-bold text-[#6C70FF] uppercase">
                {activeThreadTask.Task_ID} • {activeThreadTask.Department || 'Operations'}
              </span>
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {activeThreadTask.Task_Name}
              </h3>
              <p className="text-xs text-slate-500">
                Assigned to: {activeThreadTask.Assigned_To_Name || activeThreadTask.Assigned_To}
              </p>
            </div>
            <button
              onClick={() => onSelectTask(activeThreadTask)}
              className="text-xs font-bold text-[#6C70FF] bg-white border border-[#6C70FF]/20 px-3 py-1.5 rounded-xl shadow-2xs cursor-pointer hover:bg-[#6C70FF] hover:text-white transition ml-2 shrink-0"
            >
              Open SOP
            </button>
          </div>

          {/* Messages list */}
          <div className="space-y-3 pt-2">
            {/* Initial assignment log */}
            <div className="flex items-start space-x-2.5">
              <UserAvatar
                name={activeThreadTask.Assigned_By_Name || 'Supervisor'}
                email={activeThreadTask.Assigned_By_Email}
                size="sm"
              />
              <div className="bg-slate-100 rounded-2xl p-3 max-w-[80%] space-y-1">
                <span className="text-[11px] font-bold text-slate-700 block">
                  {activeThreadTask.Assigned_By_Name || 'Supervisor'} (Delegator)
                </span>
                <p className="text-xs text-slate-700">
                  {activeThreadTask.Notes || 'Task routine initiated and scheduled.'}
                </p>
              </div>
            </div>

            {/* Comments thread */}
            {(activeThreadTask.Comments || []).map((c) => {
              const isMe = c.authorEmail?.toLowerCase() === activeUser.Email?.toLowerCase();
              return (
                <div
                  key={c.id}
                  className={`flex items-start space-x-2.5 ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}
                >
                  <UserAvatar name={c.authorName} email={c.authorEmail} size="sm" />
                  <div
                    className={`rounded-2xl p-3 max-w-[80%] space-y-1 ${
                      isMe ? 'bg-[#6C70FF] text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-bold ${isMe ? 'text-white/80' : 'text-slate-600'}`}>
                        {c.authorName}
                      </span>
                      <span className={`text-[9px] ${isMe ? 'text-white/70' : 'text-slate-400'}`}>
                        {c.createdAt}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed">{c.text}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Reply Form */}
          <form onSubmit={handleSendQuickReply} className="pt-4 flex items-center space-x-2">
            <input
              type="text"
              value={quickReplyText}
              onChange={(e) => setQuickReplyText(e.target.value)}
              placeholder="Write a message or update..."
              className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-[#6C70FF] transition shadow-2xs"
            />
            <button
              type="submit"
              disabled={!quickReplyText.trim()}
              className="w-10 h-10 rounded-2xl bg-[#6C70FF] text-white flex items-center justify-center disabled:opacity-50 shadow-md cursor-pointer hover:bg-[#5B5FF5] transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        /* Standard Inbox List */
        <div className="px-5 pt-4 space-y-4">
          {/* Rounded Pill Search Bar matching Screenshot 3 */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4 text-slate-400" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Type to search your conversation"
              className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200/90 rounded-2xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-[#6C70FF] focus:ring-1 focus:ring-[#6C70FF] shadow-2xs transition"
            />
          </div>

          {/* Highlighted Active Item in Vibrant Purple matching Screenshot 3 */}
          {activeHighlightedMsg && (
            <div
              onClick={() => {
                if (activeHighlightedMsg.taskObj) {
                  setActiveThreadTask(activeHighlightedMsg.taskObj);
                }
              }}
              className="bg-gradient-to-br from-[#6C70FF] to-[#7B7EFF] text-white p-4.5 rounded-3xl shadow-[0_8px_24px_rgba(108,112,255,0.3)] space-y-2.5 cursor-pointer hover:opacity-95 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserAvatar
                    name={activeHighlightedMsg.senderName}
                    email={activeHighlightedMsg.senderEmail}
                    size="md"
                    isOnline={true}
                    className="ring-2 ring-white/40"
                  />
                  <span className="text-sm font-bold text-white truncate">
                    {activeHighlightedMsg.senderName}
                  </span>
                </div>
                <span className="text-xs text-white/80 font-medium font-mono">
                  {activeHighlightedMsg.timestamp}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-white tracking-tight leading-snug">
                  {activeHighlightedMsg.taskTitle}
                </h3>
              </div>

              <div className="flex items-start space-x-2 text-white/85 text-xs font-normal">
                <Paperclip className="w-3.5 h-3.5 mt-0.5 shrink-0 rotate-45 opacity-90" />
                <p className="line-clamp-2 leading-relaxed opacity-90">
                  {activeHighlightedMsg.messageText}
                </p>
              </div>
            </div>
          )}

          {/* Standard Activity / Conversation Cards matching Screenshot 3 */}
          <div className="divide-y divide-slate-100 pt-1">
            {standardMessages.length === 0 && !activeHighlightedMsg ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <MessageSquare className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-xs font-medium">No conversations found</p>
              </div>
            ) : (
              standardMessages.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => {
                    if (msg.taskObj) {
                      setActiveThreadTask(msg.taskObj);
                    }
                  }}
                  className="py-4 space-y-2 cursor-pointer hover:bg-slate-50/80 -mx-2 px-2 rounded-2xl transition"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <UserAvatar
                        name={msg.senderName}
                        email={msg.senderEmail}
                        size="sm"
                        isOnline={true}
                      />
                      <span className="text-xs font-bold text-slate-700">
                        {msg.senderName}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {msg.timestamp}
                    </span>
                  </div>

                  <div className="pl-10 space-y-1">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">
                      {msg.taskTitle}
                    </h4>

                    <div className="flex items-start space-x-2 text-slate-500 text-xs">
                      {msg.hasAttachment && (
                        <Paperclip className="w-3.5 h-3.5 mt-0.5 shrink-0 rotate-45 text-slate-400" />
                      )}
                      <p className="line-clamp-2 text-slate-600 font-normal leading-relaxed">
                        {msg.messageText}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
