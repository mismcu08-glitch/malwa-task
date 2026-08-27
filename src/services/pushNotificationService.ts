import { NotificationItem, TaskItem, User } from '../types';

class PushNotificationService {
  private notifications: NotificationItem[] = [];
  private listeners: Set<(notifications: NotificationItem[]) => void> = new Set();
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('malwa_push_notifications');
        if (saved) {
          this.notifications = JSON.parse(saved);
        }
      } catch (e) {
        console.warn('Failed to load notifications from storage', e);
      }
    }
  }

  private saveToStorage() {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'malwa_push_notifications',
          JSON.stringify(this.notifications.slice(0, 100))
        );
      } catch (e) {
        console.warn('Failed to save notifications to storage', e);
      }
    }
  }

  public subscribe(cb: (notifications: NotificationItem[]) => void): () => void {
    this.listeners.add(cb);
    cb([...this.notifications]);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners() {
    this.saveToStorage();
    this.listeners.forEach((cb) => cb([...this.notifications]));
  }

  public async requestNotificationPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return false;
    }
    try {
      if (Notification.permission === 'granted') return true;
      if (Notification.permission !== 'denied') {
        const res = await Notification.requestPermission();
        return res === 'granted';
      }
    } catch (e) {
      console.warn('Notification permission error', e);
    }
    return false;
  }

  public isPermissionGranted(): boolean {
    if (typeof window === 'undefined' || !('Notification' in window)) return false;
    return Notification.permission === 'granted';
  }

  public playNotificationChime(isAlert: boolean = false) {
    if (this.isMuted) return;
    try {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
      if (this.audioCtx) {
        if (this.audioCtx.state === 'suspended') {
          this.audioCtx.resume();
        }
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = isAlert ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(isAlert ? 880 : 587.33, now); // A5 or D5
        osc.frequency.exponentialRampToValueAtTime(isAlert ? 440 : 880, now + 0.18);

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      // Audio autoplay policy or unavailable
    }
  }

  public triggerPushNotification(
    title: string,
    message: string,
    type: NotificationItem['type'],
    targetEmail: string,
    taskId?: string
  ) {
    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      title,
      message,
      type,
      taskId,
      targetEmail,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
    };

    this.notifications = [newNotif, ...this.notifications];
    this.notifyListeners();
    this.playNotificationChime(type === 'OVERDUE_ALERT');

    // Trigger Native Browser Web Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: taskId || newNotif.id,
        });
      } catch (e) {
        console.warn('Native notification trigger failed', e);
      }
    }
  }

  public notifyTaskAssigned(task: TaskItem, assignedBy: User | string) {
    const assignerName = typeof assignedBy === 'string' ? assignedBy : (assignedBy?.Full_Name || assignedBy?.Email || 'Manager');
    this.triggerPushNotification(
      `New Task Assigned: ${task.Task_ID}`,
      `${assignerName} assigned "${task.Task_Name}" (${task.Department}) to you. Due: ${task.Due_Date}.`,
      'ASSIGNMENT',
      task.Assigned_To_Email,
      task.Task_ID
    );
  }

  public notifyTaskStatusChanged(task: TaskItem, updater: User | string, newStatus: string) {
    const updaterName = typeof updater === 'string' ? updater : (updater?.Full_Name || updater?.Email || 'Team Member');
    // Notify the assigner/creator about status update
    if (task.Assigned_By_Email && task.Assigned_By_Email.toLowerCase() !== task.Assigned_To_Email.toLowerCase()) {
      this.triggerPushNotification(
        `Task Status Updated: ${task.Task_ID}`,
        `${updaterName} marked "${task.Task_Name}" as ${newStatus}.`,
        'UPDATE',
        task.Assigned_By_Email,
        task.Task_ID
      );
    }
  }

  /**
   * Returns notifications strictly filtered for the given user.
   * Standard users ONLY see notifications targeted directly to their email or global announcements ('ALL').
   */
  public filterNotificationsForUser(user: User | null | undefined): NotificationItem[] {
    if (!user) return [];
    const email = (user.Email || '').trim().toLowerCase();
    if (user.Role === 'Admin') {
      return this.notifications;
    }
    return this.notifications.filter(
      (n) => (n.targetEmail || '').trim().toLowerCase() === email || n.targetEmail === 'ALL'
    );
  }

  public markAllAsRead(userEmail?: string) {
    this.notifications = this.notifications.map((n) =>
      !userEmail || n.targetEmail.toLowerCase() === userEmail.toLowerCase() || n.targetEmail === 'ALL'
        ? { ...n, read: true }
        : n
    );
    this.notifyListeners();
  }

  public clearAll(userEmail?: string) {
    if (!userEmail) {
      this.notifications = [];
    } else {
      const email = userEmail.toLowerCase();
      this.notifications = this.notifications.filter(
        (n) => n.targetEmail.toLowerCase() !== email && n.targetEmail !== 'ALL'
      );
    }
    this.notifyListeners();
  }

  public checkUpcomingDeadlines(tasks: TaskItem[], activeUser: User) {
    const today = new Date().toISOString().split('T')[0];
    tasks.forEach((t) => {
      if (t.Status === 'Completed') return;

      const isForUser =
        t.Assigned_To_Email.toLowerCase() === activeUser.Email.toLowerCase() ||
        activeUser.Role === 'Admin';

      if (!isForUser) return;

      // Due today reminder
      if (t.Due_Date === today) {
        const alreadyNotified = this.notifications.some(
          (n) => n.taskId === t.Task_ID && n.type === 'DEADLINE_REMINDER'
        );
        if (!alreadyNotified) {
          this.triggerPushNotification(
            `⏰ Deadline Reminder: ${t.Task_ID}`,
            `Task "${t.Task_Name}" is due TODAY (${t.Due_Time || 'EOD'}). Checklist progress: ${t.Progress_Percentage}%.`,
            'DEADLINE_REMINDER',
            t.Assigned_To_Email,
            t.Task_ID
          );
        }
      }

      // Overdue alert
      if (t.Due_Date < today) {
        const alreadyNotified = this.notifications.some(
          (n) => n.taskId === t.Task_ID && n.type === 'OVERDUE_ALERT'
        );
        if (!alreadyNotified) {
          this.triggerPushNotification(
            `🚨 SLA Breach Alert: ${t.Task_ID}`,
            `Task "${t.Task_Name}" assigned to ${t.Assigned_To_Email} is OVERDUE since ${t.Due_Date}.`,
            'OVERDUE_ALERT',
            t.Assigned_To_Email,
            t.Task_ID
          );
        }
      }
    });
  }
}

export const pushNotificationService = new PushNotificationService();
