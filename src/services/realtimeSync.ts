import { TaskItem, User, OnlinePresenceUser } from '../types';
import { dataSyncBus } from './dataSyncBus';
import { pushNotificationService } from './pushNotificationService';

type RealtimeCallback = (event: string, payload: any) => void;

class RealtimeSyncService {
  private socket: WebSocket | null = null;
  private listeners: Set<RealtimeCallback> = new Set();
  private onlineUsers: OnlinePresenceUser[] = [];
  private presenceListeners: Set<(users: OnlinePresenceUser[]) => void> = new Set();
  private isConnected: boolean = false;
  private reconnectTimeout: any = null;
  private currentUser: User | null = null;

  private reconnectAttempts = 0;
  private maxReconnectDelay = 15000;
  private pingInterval: any = null;

  constructor() {
    this.initWebSocket();

    // Listen to local tab sync bus
    dataSyncBus.subscribe((event, data) => {
      this.notifyListeners(event, data);
    });

    // Client-side heartbeat ping to keep connection live and detect dropped connections
    if (typeof window !== 'undefined') {
      this.pingInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          try {
            this.socket.send(JSON.stringify({ type: 'PING' }));
          } catch (e) {
            // Socket drop handled in onerror
          }
        }
      }, 25000);
    }
  }

  public init(user: User) {
    this.currentUser = user;
    this.sendPresence();
  }

  private initWebSocket() {
    if (typeof window === 'undefined') return;

    try {
      if (this.socket) {
        try {
          this.socket.onopen = null;
          this.socket.onmessage = null;
          this.socket.onclose = null;
          this.socket.onerror = null;
          this.socket.close();
        } catch (e) {
          // ignore
        }
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;

      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
        this.sendPresence();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'PONG') {
            // Heartbeat response acknowledged
            return;
          }
          if (data.type === 'PRESENCE_UPDATE') {
            this.onlineUsers = data.users || [];
            this.presenceListeners.forEach((cb) => cb(this.onlineUsers));
          } else if (data.type === 'TASK_MUTATION') {
            this.notifyListeners('REMOTE_TASK_MUTATION', data.payload);
          } else if (data.type === 'PUSH_NOTIFICATION') {
            const { title, message, notifType, targetEmail, taskId } = data.payload;
            pushNotificationService.triggerPushNotification(
              title,
              message,
              notifType,
              targetEmail,
              taskId
            );
          } else {
            this.notifyListeners(data.type, data.payload);
          }
        } catch (e) {
          console.warn('Malformed websocket payload dropped');
        }
      };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected = false;
      };
    } catch (e) {
      console.warn('WebSocket fallback to local bus sync');
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectAttempts++;
    // Exponential backoff: 2s, 4s, 8s ... up to 15s
    const delay = Math.min(2000 * Math.pow(1.5, this.reconnectAttempts - 1), this.maxReconnectDelay);
    this.reconnectTimeout = setTimeout(() => {
      this.initWebSocket();
    }, delay);
  }

  public sendPresence(viewName: string = 'Task Hub') {
    if (!this.currentUser) return;
    const presenceData: OnlinePresenceUser = {
      email: this.currentUser.Email,
      fullName: this.currentUser.Full_Name,
      role: this.currentUser.Role,
      department: this.currentUser.Department,
      lastActive: new Date().toLocaleTimeString(),
      currentView: viewName,
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'PRESENCE_JOIN',
          user: presenceData,
        })
      );
    }

    // Local presence fallback
    this.onlineUsers = [
      presenceData,
      ...this.onlineUsers.filter((u) => u.email !== presenceData.email),
    ];
    this.presenceListeners.forEach((cb) => cb(this.onlineUsers));
  }

  public broadcastTaskMutation(action: 'CREATE' | 'UPDATE' | 'DELETE' | 'SUBTASK_TOGGLE' | 'COMPLETE', task: TaskItem, byUser: User) {
    const payload = { action, task, byUserEmail: byUser.Email, byUserName: byUser.Full_Name };

    // Broadcast across local browser tabs
    dataSyncBus.broadcast('TASK_MUTATION', payload);

    // Send over WebSocket to other devices
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'TASK_MUTATION',
          payload,
        })
      );
    }
  }

  public broadcastPushNotification(title: string, message: string, notifType: any, targetEmail: string, taskId?: string) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          type: 'PUSH_NOTIFICATION',
          payload: { title, message, notifType, targetEmail, taskId },
        })
      );
    }
  }

  public subscribe(cb: RealtimeCallback): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  public subscribePresence(cb: (users: OnlinePresenceUser[]) => void): () => void {
    this.presenceListeners.add(cb);
    cb(this.onlineUsers);
    return () => {
      this.presenceListeners.delete(cb);
    };
  }

  private notifyListeners(event: string, payload: any) {
    this.listeners.forEach((cb) => {
      try {
        cb(event, payload);
      } catch (e) {
        console.error('Error in realtime callback', e);
      }
    });
  }

  public getOnlineUsers(): OnlinePresenceUser[] {
    return this.onlineUsers;
  }
}

export const realtimeSync = new RealtimeSyncService();
