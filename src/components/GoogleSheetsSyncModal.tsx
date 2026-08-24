import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  UploadCloud,
  DownloadCloud,
  AlertTriangle,
  LogIn,
  LogOut,
  Layers,
  Database,
  X,
  History,
  Sparkles,
  Link2,
} from 'lucide-react';
import { googleSignIn, googleLogout, getAccessToken, subscribeGoogleAuth, GoogleUserStub } from '../services/googleAuth';
import {
  getSpreadsheetDetails,
  createFmsMasterSpreadsheet,
  pushAllDataToGoogleSheets,
  pullAllDataFromGoogleSheets,
  extractSpreadsheetId,
  SpreadsheetMetadata,
  SHEET_SCHEMAS,
} from '../services/googleSheetsApi';
import { googleSheetSync, SyncLogEntry, SyncStatusType } from '../services/googleSheetSync';
import {
  User,
  InventoryItem,
  ApplicationItem,
  PurchaseIndent,
  TruckGateEntry,
  DispatchItem,
  TaskItem,
  TicketItem,
  StockTransaction,
} from '../types';

interface GoogleSheetsSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  inventory: InventoryItem[];
  setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  purchases: PurchaseIndent[];
  setPurchases: React.Dispatch<React.SetStateAction<PurchaseIndent[]>>;
  truckGate: TruckGateEntry[];
  setTruckGate: React.Dispatch<React.SetStateAction<TruckGateEntry[]>>;
  dispatches: DispatchItem[];
  setDispatches: React.Dispatch<React.SetStateAction<DispatchItem[]>>;
  tasks: TaskItem[];
  setTasks: React.Dispatch<React.SetStateAction<TaskItem[]>>;
  applications: ApplicationItem[];
  setApplications: React.Dispatch<React.SetStateAction<ApplicationItem[]>>;
  tickets: TicketItem[];
  setTickets: React.Dispatch<React.SetStateAction<TicketItem[]>>;
  ledger: StockTransaction[];
  setLedger: React.Dispatch<React.SetStateAction<StockTransaction[]>>;
  activeUser: User;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  isOpen,
  onClose,
  users,
  setUsers,
  inventory,
  setInventory,
  purchases,
  setPurchases,
  truckGate,
  setTruckGate,
  dispatches,
  setDispatches,
  tasks,
  setTasks,
  applications,
  setApplications,
  tickets,
  setTickets,
  ledger,
  setLedger,
  activeUser,
}) => {
  const [googleUser, setGoogleUser] = useState<GoogleUserStub | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>('');
  const [activeSheetMeta, setActiveSheetMeta] = useState<SpreadsheetMetadata | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusType>('IDLE');
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [syncLogs, setSyncLogs] = useState<SyncLogEntry[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [showConfirmPull, setShowConfirmPull] = useState<boolean>(false);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isPushing, setIsPushing] = useState<boolean>(false);

  useEffect(() => {
    const unsubAuth = subscribeGoogleAuth((u, t) => {
      setGoogleUser(u);
      setToken(t);
    });

    const unsubSync = googleSheetSync.subscribe((status, time) => {
      setSyncStatus(status);
      if (time) setLastSyncTime(time);
    });

    const unsubLogs = googleSheetSync.subscribeLogs((logs) => {
      setSyncLogs(logs);
    });

    const savedId = googleSheetSync.getSpreadsheetId();
    if (savedId) {
      setSpreadsheetInput(savedId);
    }

    return () => {
      unsubAuth();
      unsubSync();
      unsubLogs();
    };
  }, []);

  // Fetch sheet details when token and spreadsheet ID are present
  useEffect(() => {
    const checkCurrentSheet = async () => {
      const savedId = googleSheetSync.getSpreadsheetId();
      if (savedId && token) {
        try {
          const meta = await getSpreadsheetDetails(savedId, token);
          setActiveSheetMeta(meta);
        } catch (e) {
          console.warn('Could not auto-fetch sheet metadata', e);
        }
      }
    };
    checkCurrentSheet();
  }, [token]);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await googleSignIn();
      if (res) {
        setMessage({ type: 'success', text: `Successfully authenticated as ${res.user.email}` });
        const savedId = googleSheetSync.getSpreadsheetId();
        if (savedId && res.accessToken) {
          const meta = await getSpreadsheetDetails(savedId, res.accessToken);
          setActiveSheetMeta(meta);
        }
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Google authentication failed' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNewSheet = async () => {
    if (!token) {
      setMessage({ type: 'error', text: 'Please sign in with Google first to create a spreadsheet in your Drive.' });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const title = `Malwa Concrete FMS - Master DB (${new Date().toLocaleDateString('en-IN')})`;
      const meta = await createFmsMasterSpreadsheet(token, title);
      setActiveSheetMeta(meta);
      setSpreadsheetInput(meta.spreadsheetId);
      googleSheetSync.setSpreadsheetId(meta.spreadsheetId);

      // Immediately push current tasks and users to initialize
      await pushAllDataToGoogleSheets(
        meta.spreadsheetId,
        {
          users,
          tasks,
        },
        token
      );

      setMessage({
        type: 'success',
        text: `New FMS Spreadsheet created and formatted with TASK_HUB and USER_RBAC tabs.`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to create Google Spreadsheet' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectExistingSheet = async () => {
    const rawInput = spreadsheetInput.trim();
    if (!rawInput) {
      setMessage({ type: 'error', text: 'Please enter a valid Google Spreadsheet URL or ID.' });
      return;
    }
    const cleanId = extractSpreadsheetId(rawInput);
    if (!token) {
      googleSheetSync.setSpreadsheetId(cleanId);
      setMessage({
        type: 'info',
        text: `Spreadsheet ID saved (${cleanId}). Sign in with Google to enable live REST synchronization.`,
      });
      return;
    }

    setIsLoading(true);
    setMessage(null);
    try {
      const meta = await getSpreadsheetDetails(cleanId, token);
      setActiveSheetMeta(meta);
      googleSheetSync.setSpreadsheetId(cleanId);
      setMessage({
        type: 'success',
        text: `Connected to "${meta.title}". Realtime syncing is now active.`,
      });
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err?.message || 'Could not access spreadsheet. Ensure you have edit access in your Google Account.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePushAllData = async () => {
    const sId = activeSheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!sId || !token) {
      setMessage({ type: 'error', text: 'Requires active Google sign-in and connected Spreadsheet ID.' });
      return;
    }

    setIsPushing(true);
    setMessage(null);
    try {
      const result = await pushAllDataToGoogleSheets(
        sId,
        {
          users,
          tasks,
        },
        token
      );

      setMessage({
        type: 'success',
        text: `Successfully pushed ${result.rowsSynced} total records across TASK_HUB & USER_RBAC tabs!`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Push to Google Sheets failed' });
    } finally {
      setIsPushing(false);
    }
  };

  const handleConfirmPullData = async () => {
    const sId = activeSheetMeta?.spreadsheetId || extractSpreadsheetId(spreadsheetInput);
    if (!sId || !token) {
      setMessage({ type: 'error', text: 'Requires active Google sign-in and connected Spreadsheet ID.' });
      setShowConfirmPull(false);
      return;
    }

    setIsPulling(true);
    setMessage(null);
    try {
      const pulled = await pullAllDataFromGoogleSheets(sId, token);

      let counts = 0;
      if (pulled.tasks && pulled.tasks.length > 0) {
        setTasks(pulled.tasks);
        counts += pulled.tasks.length;
      }
      if (pulled.users && pulled.users.length > 0) {
        setUsers(pulled.users);
        counts += pulled.users.length;
      }

      setShowConfirmPull(false);
      setMessage({
        type: 'success',
        text: `Successfully pulled ${counts} records from Google Sheets and updated local application state!`,
      });
    } catch (err: any) {
      setMessage({ type: 'error', text: err?.message || 'Failed to pull data from Google Sheets' });
      setShowConfirmPull(false);
    } finally {
      setIsPulling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 text-slate-100 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col my-0 sm:my-6 animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h2 className="font-extrabold text-sm sm:text-base text-white">Google Sheets Realtime Database</h2>
                <span className="bg-emerald-950 text-emerald-300 border border-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  v4 REST Sync
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Bidirectional live synchronization between Malwa Concrete FMS & Google Drive Sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notification Toast */}
        {message && (
          <div
            className={`mx-4 sm:mx-5 mt-4 p-3 rounded-xl text-xs flex items-start space-x-2.5 shrink-0 ${
              message.type === 'success'
                ? 'bg-emerald-950/80 border border-emerald-700 text-emerald-200'
                : message.type === 'error'
                ? 'bg-rose-950/80 border border-rose-700 text-rose-200'
                : 'bg-blue-950/80 border border-blue-700 text-blue-200'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            )}
            <span className="flex-1">{message.text}</span>
          </div>
        )}

        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* SECTION 1: GOOGLE ACCOUNT AUTHENTICATION */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                Step 1: Google Account Connection
              </span>
              {googleUser && token ? (
                <span className="inline-flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-700 px-2 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>OAuth Authorized</span>
                </span>
              ) : (
                <span className="text-[11px] text-amber-400 bg-amber-950/70 border border-amber-800 px-2 py-0.5 rounded-full">
                  Not Signed In
                </span>
              )}
            </div>

            {googleUser ? (
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 p-3 bg-slate-900 rounded-lg border border-slate-800">
                <div className="flex items-center space-x-2.5 truncate">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shrink-0">
                    {googleUser.email?.charAt(0).toUpperCase()}
                  </div>
                  <div className="truncate text-left">
                    <div className="text-xs font-bold text-white truncate">{googleUser.displayName || 'Google User'}</div>
                    <div className="text-[11px] text-slate-400 truncate">{googleUser.email}</div>
                  </div>
                </div>
                <button
                  onClick={googleLogout}
                  className="flex items-center justify-center space-x-1 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/60 border border-rose-900/60 px-3 py-2 sm:py-1.5 rounded-lg transition cursor-pointer min-h-[40px] sm:min-h-0"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Disconnect</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3.5 bg-slate-900 rounded-lg border border-slate-800">
                <div className="text-xs text-slate-300">
                  Authenticate with Google to grant FMS permission to create and edit spreadsheets in your Google Drive.
                </div>
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isLoading}
                  className="w-full sm:w-auto shrink-0 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-semibold text-xs px-4 py-2.5 rounded-xl transition shadow-md flex items-center justify-center space-x-2.5 cursor-pointer disabled:opacity-50 min-h-[44px] border border-slate-300"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>{isLoading ? 'Authenticating...' : 'Sign in with Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* SECTION 2: SPREADSHEET SETUP & SELECTION */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              Step 2: Google Spreadsheet Target
            </span>

            <div className="space-y-2">
              <label className="text-xs text-slate-300 font-medium block">
                Spreadsheet URL or Spreadsheet ID:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XR... or 1BxiMVs0XR..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg p-3 sm:p-2.5 text-xs text-white placeholder-slate-500 font-mono outline-none focus:border-blue-500 min-h-[44px] sm:min-h-0"
                />
                <button
                  onClick={handleConnectExistingSheet}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs px-4 py-3 sm:py-2 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] sm:min-h-0"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>Connect Sheet</span>
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-700/60">
              <div className="text-[11px] text-slate-400">
                Create a new formatted FMS Database in your Drive with 1-click:
              </div>
              <button
                onClick={handleCreateNewSheet}
                disabled={isLoading || !token}
                className="w-full sm:w-auto shrink-0 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs px-4 py-3 sm:py-2 rounded-lg shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] sm:min-h-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Create New FMS Sheet</span>
              </button>
            </div>

            {activeSheetMeta && (
              <div className="p-3.5 bg-slate-950 rounded-xl border border-emerald-800/80 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-bold text-xs text-white">{activeSheetMeta.title}</span>
                  </div>
                  <a
                    href={activeSheetMeta.spreadsheetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-[11px] text-blue-400 hover:text-blue-300 underline font-medium"
                  >
                    <span>Open in Google Sheets</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="text-[11px] text-slate-400 font-mono break-all">
                  ID: {activeSheetMeta.spreadsheetId}
                </div>

                <div className="pt-1.5 border-t border-slate-800">
                  <span className="text-[10px] font-bold text-slate-400 block mb-1.5">
                    Synchronized Tabs ({activeSheetMeta.sheets.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(SHEET_SCHEMAS).map((name) => {
                      const exists = activeSheetMeta.sheets.some((s) => s.title === name);
                      return (
                        <span
                          key={name}
                          className={`text-[10px] px-2 py-0.5 rounded font-mono font-medium ${
                            exists
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-slate-800 text-slate-500 border border-slate-700'
                          }`}
                        >
                          {name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: BULK SYNC & RESTORATION CONTROLS */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
              Step 3: Bi-directional Synchronization
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <UploadCloud className="w-4 h-4 text-blue-400" />
                  <span>Push All to Google Sheets</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Uploads all local task delegation and operational registers to the connected Google Sheet.
                </p>
                <button
                  onClick={handlePushAllData}
                  disabled={isPushing || !token || !spreadsheetInput}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs py-3 sm:py-2 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] sm:min-h-0"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                  <span>{isPushing ? 'Pushing All Records...' : 'Push All Local Data'}</span>
                </button>
              </div>

              <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center space-x-2 text-white font-bold text-xs">
                  <DownloadCloud className="w-4 h-4 text-emerald-400" />
                  <span>Pull Data from Google Sheets</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Hydrates local application state directly from rows in your Google Sheet tabs.
                </p>
                <button
                  onClick={() => setShowConfirmPull(true)}
                  disabled={isPulling || !token || !spreadsheetInput}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs py-3 sm:py-2 rounded-lg transition flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50 min-h-[44px] sm:min-h-0"
                >
                  <DownloadCloud className="w-3.5 h-3.5" />
                  <span>Pull From Google Sheets</span>
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pt-2 border-t border-slate-700/60 text-xs gap-1.5">
              <div className="flex items-center space-x-2 text-slate-300">
                <span className="font-semibold">Live Pipeline:</span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  {syncStatus === 'SYNCING' ? 'Streaming...' : 'Active (Instant Auto-Commit)'}
                </span>
              </div>
              {lastSyncTime && (
                <span className="text-[11px] text-slate-500 font-mono">Last Sync: {lastSyncTime}</span>
              )}
            </div>
          </div>

          {/* SECTION 4: REAL-TIME SYNC LOG AUDIT */}
          <div className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <History className="w-3.5 h-3.5 text-slate-400" />
                Live Sync Activity Stream
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Recent 50 Mutations</span>
            </div>

            <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1 font-mono text-[11px]">
              {syncLogs.length === 0 ? (
                <div className="text-center py-4 text-slate-500 text-xs">No sync transactions recorded yet.</div>
              ) : (
                syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-2 rounded bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-400'
                            : log.status === 'QUEUED'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                        }`}
                      />
                      <span className="font-bold text-slate-200">{log.entity}</span>
                      <span className="text-slate-500">[{log.action}]</span>
                      <span className="text-slate-400 truncate hidden sm:inline">{log.details}</span>
                    </div>
                    <div className="text-slate-500 text-[10px] shrink-0">{log.timestamp}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-white font-semibold text-xs px-6 py-3 sm:py-2 rounded-lg transition cursor-pointer min-h-[44px] flex items-center justify-center"
          >
            Close
          </button>
        </div>
      </div>

      {showConfirmPull && (
        <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-600/80 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-scaleUp">
            <div className="flex items-center space-x-3 text-amber-400">
              <div className="p-2 bg-amber-950 rounded-xl border border-amber-800">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-white">Confirm Overwrite from Google Sheets</h3>
                <p className="text-xs text-slate-400">Destructive operation confirmation</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Pulling data from Google Sheets will overwrite current local registers with data fetched from the connected spreadsheet ({spreadsheetInput.substring(0, 16)}...).
            </p>

            <div className="flex flex-col sm:flex-row justify-end gap-2 pt-2">
              <button
                onClick={() => setShowConfirmPull(false)}
                disabled={isPulling}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs px-4 py-2.5 rounded-lg transition min-h-[44px] sm:min-h-0 flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmPullData}
                disabled={isPulling}
                className="bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold text-xs px-4 py-2.5 rounded-lg transition shadow-md flex items-center justify-center space-x-1.5 cursor-pointer min-h-[44px] sm:min-h-0"
              >
                {isPulling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <DownloadCloud className="w-3.5 h-3.5" />}
                <span>{isPulling ? 'Pulling Data...' : 'Confirm Overwrite'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
