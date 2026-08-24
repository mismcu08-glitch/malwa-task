type SyncCallback = (event: string, data: any) => void;

class DataSyncBus {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<SyncCallback> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('malwa_task_fms_sync_bus');
        this.channel.onmessage = (e) => {
          if (e.data && e.data.type) {
            this.notify(e.data.type, e.data.payload);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel not supported or error initializing', err);
      }
    }
  }

  public subscribe(callback: SyncCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  public broadcast(type: string, payload: any) {
    // Notify local listeners
    this.notify(type, payload);

    // Broadcast across other browser tabs/windows
    if (this.channel) {
      try {
        this.channel.postMessage({ type, payload });
      } catch (e) {
        console.warn('Error broadcasting across channel', e);
      }
    }
  }

  private notify(type: string, payload: any) {
    this.listeners.forEach((cb) => {
      try {
        cb(type, payload);
      } catch (e) {
        console.error('Error in sync listener callback', e);
      }
    });
  }
}

export const dataSyncBus = new DataSyncBus();
