
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isSameDay, isWithinInterval, endOfDay, addDays } from 'date-fns';
import { AlertCircle, X } from 'lucide-react';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal, { type TransactionSyncInfo } from './components/AddTransactionModal';
import SettingsPage, { type SettingsSectionPage } from './components/SettingsPage';
import SyncStatusPage from './components/SyncStatusPage';
import SearchPage from './components/SearchPage';
import HomePage from './components/HomePage';
import MonthlyStatsPage from './components/MonthlyStatsPage';
import PullReportsPage from './components/PullReportsPage';
import { CalendarViewMode, PaymentMethodDisplayMode, PullReport, SuggestionIndex, SuggestionItem, Transaction } from './types';
import { EXAMPLE_TRANSACTIONS, CATEGORIES, formatCurrencyAmount, getEnabledCurrencies, getPreferredCurrency } from './constants';
import { db } from './db';
import { pullTransactionsFromCloud, SyncProgress, syncCreateItems, syncPendingTransactions } from './services/cloudSyncService';
import { buildMerchantRenamePreview, getMerchantUsageSummaries, getTransactionsByMerchant, normalizeMerchantName, renameMerchantInTransactions } from './services/merchantService';
import { isOffline } from './services/networkService';
import { getMonthTransactions, getStatsByCurrency } from './services/statsService';
import { buildTagRenamePreview, getTagUsageSummaries, getTransactionsByTag, normalizeTag, renameTagInTransactions, splitTags } from './services/tagService';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from './time';
import { showAutoDismissToast } from './services/dialogService';
import { PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY, getPaymentMethodDisplayMode } from './preferences';

type AppView =
  | 'home'
  | 'search'
  | 'stats'
  | 'settings'
  | 'settings-preferences'
  | 'settings-ai'
  | 'settings-sync'
  | 'settings-tags'
  | 'settings-merchant'
  | 'settings-import-export'
  | 'settings-danger'
  | 'sync'
  | 'pull-reports';

interface AppHistoryState {
  view: AppView;
  syncReturnView?: 'home' | 'settings';
}

const SETTINGS_SECTION_VIEW_MAP: Record<SettingsSectionPage, AppView> = {
  preferences: 'settings-preferences',
  ai: 'settings-ai',
  sync: 'settings-sync',
  tags: 'settings-tags',
  merchant: 'settings-merchant',
  'import-export': 'settings-import-export',
  danger: 'settings-danger',
};

const SETTINGS_VIEW_SECTION_MAP: Partial<Record<AppView, SettingsSectionPage>> = {
  'settings-preferences': 'preferences',
  'settings-ai': 'ai',
  'settings-sync': 'sync',
  'settings-tags': 'tags',
  'settings-merchant': 'merchant',
  'settings-import-export': 'import-export',
  'settings-danger': 'danger',
};

const HOME_CALENDAR_VIEW_MODE_STORAGE_KEY = 'home-calendar-view-mode';

const SAMPLE_TRANSACTION_ID_PREFIX = 'sample-tx-';

const isSampleTransaction = (tx: Transaction): boolean => tx.id.startsWith(SAMPLE_TRANSACTION_ID_PREFIX);

const getInitialCalendarViewMode = (): CalendarViewMode => {
  if (typeof window === 'undefined') return 'month';

  const storedValue = window.localStorage.getItem(HOME_CALENDAR_VIEW_MODE_STORAGE_KEY);
  return storedValue === 'week' || storedValue === 'month' ? storedValue : 'month';
};

const ErrorDisplay: React.FC<{ errors: string[], onClear: () => void }> = ({ errors, onClear }) => {
  if (errors.length === 0) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-red-600/95 text-white p-4 text-xs font-mono max-h-[40vh] overflow-y-auto shadow-2xl backdrop-blur-md">
      <div className="flex justify-between items-center mb-2 sticky top-0 bg-red-600 py-1">
        <div className="flex items-center gap-2">
          <AlertCircle size={14} />
          <span className="font-bold">系統錯誤偵錯 (Total: {errors.length})</span>
        </div>
        <button onClick={onClear} className="p-1 hover:bg-white/20 rounded"><X size={16} /></button>
      </div>
      <ul className="space-y-2">
        {errors.map((err, i) => (
          <li key={i} className="border-b border-white/20 pb-1 break-all last:border-0">{err}</li>
        ))}
      </ul>
    </div>
  );
};

const SuccessToast: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="fixed left-1/2 z-[9998] -translate-x-1/2 animate-slide-up pointer-events-none"
    style={{ bottom: '7rem' }}
  >
    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-3 shadow-2xl backdrop-blur-md">
      <p className="text-sm font-bold text-emerald-200 whitespace-nowrap">{message}</p>
    </div>
  </div>
);

interface TriggerSyncResult {
  total: number;
  failed: number;
  skippedOffline: boolean;
}

const buildSyncFailureSummary = (results: { id: string; status: string; message?: string }[], fallbackLabel: string) => {
  const failed = results.filter((result) => result.status === 'error');
  if (failed.length === 0) return null;

  const details = failed.slice(0, 3).map((result) => {
    const message = result.message?.trim() || fallbackLabel;
    return `${result.id}: ${message}`;
  });
  const extraCount = failed.length - details.length;
  return extraCount > 0
    ? `${details.join(' | ')} | 另外 ${extraCount} 筆失敗`
    : details.join(' | ');
};

const normalizeSuggestionValue = (value: string) => value.trim();

const buildSuggestions = (
  transactions: Transaction[],
  extractor: (tx: Transaction) => string[]
): SuggestionItem[] => {
  const map = new Map<string, SuggestionItem & {
    categoryIdSet: Set<string>;
    subCategoryIdSet: Set<string>;
  }>();

  for (const tx of transactions) {
    const values = extractor(tx);
    for (const rawValue of values) {
      const value = normalizeSuggestionValue(rawValue);
      if (!value) continue;

      const existing = map.get(value);
      if (existing) {
        existing.count += 1;
        existing.lastUsedAt = Math.max(existing.lastUsedAt, tx.timestamp);
        if (tx.categoryId) existing.categoryIdSet.add(tx.categoryId);
        if (tx.subCategoryId) existing.subCategoryIdSet.add(tx.subCategoryId);
      } else {
        map.set(value, {
          value,
          count: 1,
          lastUsedAt: tx.timestamp,
          categoryIds: tx.categoryId ? [tx.categoryId] : [],
          subCategoryIds: tx.subCategoryId ? [tx.subCategoryId] : [],
          categoryIdSet: new Set(tx.categoryId ? [tx.categoryId] : []),
          subCategoryIdSet: new Set(tx.subCategoryId ? [tx.subCategoryId] : []),
        });
      }
    }
  }

  return Array.from(map.values()).map((item) => ({
    value: item.value,
    count: item.count,
    lastUsedAt: item.lastUsedAt,
    categoryIds: Array.from(item.categoryIdSet).sort(),
    subCategoryIds: Array.from(item.subCategoryIdSet).sort(),
  })).sort((a, b) => {
    if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
    if (b.count !== a.count) return b.count - a.count;
    return a.value.localeCompare(b.value);
  });
};

const buildSuggestionIndex = (transactions: Transaction[]): SuggestionIndex => {
  return {
    merchants: buildSuggestions(transactions, (tx) => tx.merchant ? [tx.merchant] : []),
    names: buildSuggestions(transactions, (tx) => tx.name ? [tx.name] : []),
    tags: buildSuggestions(transactions, (tx) => (
      splitTags(tx.tags)
    )),
  };
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<AppView>('home');
  const [syncReturnView, setSyncReturnView] = useState<'home' | 'settings'>('home');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarViewMode, setCalendarViewMode] = useState<CalendarViewMode>(getInitialCalendarViewMode);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pullReports, setPullReports] = useState<PullReport[]>([]);
  const [focusedPullReportId, setFocusedPullReportId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalInstanceKey, setModalInstanceKey] = useState(0);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefilledTransaction, setPrefilledTransaction] = useState<Omit<Transaction, 'id'> | null>(null);
  const [capturedErrors, setCapturedErrors] = useState<string[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [paymentMethodDisplayMode, setPaymentMethodDisplayMode] = useState<PaymentMethodDisplayMode>('text');
  const [syncProgressUI, setSyncProgressUI] = useState<{
    visible: boolean;
    label: string;
    processed: number;
    total: number;
    failed: number;
  }>({
    visible: false,
    label: '',
    processed: 0,
    total: 0,
    failed: 0,
  });
  const activeSyncTaskRef = useRef(0);
  const syncHideTimerRef = useRef<number | null>(null);
  const duplicateReopenTimerRef = useRef<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(isOffline());
  const [isSyncConfigured, setIsSyncConfigured] = useState(false);
  const toastHideTimerRef = useRef<number | null>(null);
  const isApplyingHistoryRef = useRef(false);
  const clearErrors = useCallback(() => setCapturedErrors([]), []);
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    if (toastHideTimerRef.current !== null) {
      window.clearTimeout(toastHideTimerRef.current);
    }
    toastHideTimerRef.current = window.setTimeout(() => {
      setToastMessage('');
      toastHideTimerRef.current = null;
    }, 1800);
  }, []);

  const normalizeTransactionTime = (tx: Transaction): Transaction => {
    const normalizedTimestamp = toEpochSeconds(tx.timestamp);
    return {
      ...tx,
      timestamp: normalizedTimestamp,
      readableDateTime: tx.readableDateTime || formatReadableDateTime(normalizedTimestamp),
    };
  };

  const refreshData = useCallback(async () => {
    try {
      const [allTransactions, allPullReports] = await Promise.all([
        db.transactions.toArray(),
        db.pullReports.orderBy('createdAt').reverse().toArray(),
      ]);
      setTransactions(allTransactions);
      setPullReports(allPullReports);
      const [
        defaultCurrencySetting,
        enabledCurrenciesSetting,
        paymentMethodDisplayModeSetting,
        syncApiUrlSetting,
        syncTokenSetting,
      ] = await Promise.all([
        db.settings.get('defaultCurrency'),
        db.settings.get('enabledCurrencies'),
        db.settings.get(PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY),
        db.settings.get('syncApiUrl'),
        db.settings.get('syncToken'),
      ]);
      const enabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
      setDefaultCurrency(getPreferredCurrency(defaultCurrencySetting?.value, enabledCurrencies));
      setPaymentMethodDisplayMode(getPaymentMethodDisplayMode(paymentMethodDisplayModeSetting?.value));
      setIsSyncConfigured(Boolean((syncApiUrlSetting?.value || '').trim() && (syncTokenSetting?.value || '').trim()));
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `DB Load Error: ${err.message}`]);
    }
  }, []);

  const buildExampleTransactions = (): Transaction[] => {
    const now = Date.now();
    return EXAMPLE_TRANSACTIONS.map((t, idx) => {
      const normalizedTimestamp = toEpochSeconds(t.timestamp);
      return {
        ...t,
        id: `${SAMPLE_TRANSACTION_ID_PREFIX}${now}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
        currency: t.currency || 'TWD',
        amount: t.type === '支出' ? -Math.abs(t.amount) : Math.abs(t.amount),
        timestamp: normalizedTimestamp,
        readableDateTime: t.readableDateTime || formatReadableDateTime(normalizedTimestamp),
        updatedAt: now + idx,
        version: 1,
        syncStatus: 'pending'
      };
    });
  };

  const insertExampleTransactions = async () => {
    try {
      const examples = buildExampleTransactions();
      await db.transactions.bulkAdd(examples);
      setTransactions(prev => [...examples, ...prev]);

      void (async () => {
        if (isOffline()) {
          return;
        }
        const results = await runSyncWithProgress('同步範例資料', (onProgress) => syncCreateItems(examples, onProgress));
        const summary = buildSyncFailureSummary(results, 'Example sync failed');
        if (summary) {
          setCapturedErrors(prev => [...prev, `Sync Error: ${summary}`]);
        }
        await refreshData();
      })();

      return examples.length;
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Insert Example Error: ${err.message}`]);
      throw err;
    }
  };

  const previewSampleTransactions = async (): Promise<Transaction[]> => {
    try {
      const all = await db.transactions.toArray();
      return all.filter(isSampleTransaction);
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Preview Sample Error: ${err.message}`]);
      throw err;
    }
  };

  const deleteSampleTransactions = async (ids: string[]): Promise<number> => {
    try {
      const sampleIds = ids.filter(id => id.startsWith(SAMPLE_TRANSACTION_ID_PREFIX));
      if (sampleIds.length === 0) return 0;
      const existing = await db.transactions.bulkGet(sampleIds);
      const existingIds = existing
        .filter((tx): tx is Transaction => Boolean(tx) && isSampleTransaction(tx as Transaction))
        .map(tx => tx.id);
      if (existingIds.length === 0) return 0;
      await db.transactions.bulkDelete(existingIds);
      setTransactions(prev => prev.filter(t => !existingIds.includes(t.id)));
      return existingIds.length;
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Delete Sample Error: ${err.message}`]);
      throw err;
    }
  };

  useEffect(() => {
    window.localStorage.setItem(HOME_CALENDAR_VIEW_MODE_STORAGE_KEY, calendarViewMode);
  }, [calendarViewMode]);

  useEffect(() => {
    const initData = async () => {
      try {
        const count = await db.transactions.count();
        if (count > 0) {
          const existing = await db.transactions.toArray();
          const normalized = existing.map(normalizeTransactionTime);
          const hasChanged = normalized.some((tx, idx) => (
            tx.timestamp !== existing[idx].timestamp ||
            tx.readableDateTime !== existing[idx].readableDateTime
          ));
          if (hasChanged) {
            await db.transactions.bulkPut(normalized);
          }
        }
        const [defaultCurrencySetting, enabledCurrenciesSetting, paymentMethodDisplayModeSetting] = await Promise.all([
          db.settings.get('defaultCurrency'),
          db.settings.get('enabledCurrencies'),
          db.settings.get(PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY)
        ]);
        const enabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
        const safeDefaultCurrency = getPreferredCurrency(defaultCurrencySetting?.value, enabledCurrencies);
        const safePaymentMethodDisplayMode = getPaymentMethodDisplayMode(paymentMethodDisplayModeSetting?.value);
        await db.settings.bulkPut([
          { key: 'enabledCurrencies', value: enabledCurrencies },
          { key: 'defaultCurrency', value: safeDefaultCurrency },
          { key: PAYMENT_METHOD_DISPLAY_MODE_SETTING_KEY, value: safePaymentMethodDisplayMode }
        ]);
        await refreshData();
      } catch (err: any) {
        setCapturedErrors(prev => [...prev, `DB Init Error: ${err.message}`]);
      } finally {
        setIsLoading(false);
      }
    };
    initData();
  }, []);

  useEffect(() => {
    const currentState = window.history.state as AppHistoryState | null;
    if (!currentState || !currentState.view) {
      window.history.replaceState({ view: 'home', syncReturnView: 'home' } satisfies AppHistoryState, '');
      return;
    }

    setActiveView(currentState.view);
    setSyncReturnView(currentState.syncReturnView === 'settings' ? 'settings' : 'home');
  }, []);

  useEffect(() => {
    if (isOffline()) {
      showToast('目前為離線模式，雲端同步與 AI 暫停');
    }

    const handleOnlineStateChange = () => {
      const offline = isOffline();
      setIsOfflineMode(offline);
      showToast(offline ? '目前為離線模式，雲端同步與 AI 暫停' : '已恢復連線，可再次同步');
    };

    window.addEventListener('online', handleOnlineStateChange);
    window.addEventListener('offline', handleOnlineStateChange);

    return () => {
      window.removeEventListener('online', handleOnlineStateChange);
      window.removeEventListener('offline', handleOnlineStateChange);
    };
  }, [showToast]);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = `Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      setCapturedErrors(prev => [...prev, msg]);
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const msg = `Promise Rejected: ${event.reason?.message || JSON.stringify(event.reason)}`;
      setCapturedErrors(prev => [...prev, msg]);
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  const runSyncWithProgress = useCallback(async <T,>(
    label: string,
    runner: (onProgress: (progress: SyncProgress) => void) => Promise<T>
  ): Promise<T> => {
    const taskId = Date.now();
    activeSyncTaskRef.current = taskId;
    if (syncHideTimerRef.current !== null) {
      window.clearTimeout(syncHideTimerRef.current);
      syncHideTimerRef.current = null;
    }

    const handleProgress = (progress: SyncProgress) => {
      if (activeSyncTaskRef.current !== taskId) return;
      void refreshData();
      setSyncProgressUI({
        visible: true,
        label,
        processed: progress.processed,
        total: progress.total,
        failed: progress.failed,
      });
    };

    try {
      return await runner(handleProgress);
    } finally {
      if (activeSyncTaskRef.current === taskId) {
        syncHideTimerRef.current = window.setTimeout(() => {
          if (activeSyncTaskRef.current !== taskId) return;
          setSyncProgressUI(prev => ({ ...prev, visible: false }));
        }, 1800);
      }
    }
  }, [refreshData]);
  const triggerPendingSync = useCallback(async (
    label: string
  ): Promise<TriggerSyncResult> => {
    if (isOffline()) {
      return { total: 0, failed: 0, skippedOffline: true };
    }

    const results = await runSyncWithProgress(label, (onProgress) => syncPendingTransactions(onProgress));
    const summary = buildSyncFailureSummary(results, 'Pending sync failed');
    const failed = results.filter((r) => r.status === 'error');
    if (summary) {
      setCapturedErrors(prev => [...prev, `Sync Pending Error: ${summary}`]);
    }
    if (results.length > 0) {
      await refreshData();
    }
    return { total: results.length, failed: failed.length, skippedOffline: false };
  }, [refreshData, runSyncWithProgress]);
  useEffect(() => {
    if (isLoading) return;
    void triggerPendingSync('啟動補送同步');
  }, [isLoading, triggerPendingSync]);
  useEffect(() => {
    return () => {
      if (syncHideTimerRef.current !== null) {
        window.clearTimeout(syncHideTimerRef.current);
      }
      if (toastHideTimerRef.current !== null) {
        window.clearTimeout(toastHideTimerRef.current);
      }
      if (duplicateReopenTimerRef.current !== null) {
        window.clearTimeout(duplicateReopenTimerRef.current);
      }
    };
  }, []);

  const dailyTransactions = useMemo(() => {
    const dayStart = toEpochSeconds(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()).getTime());
    const dayEnd = toEpochSeconds(endOfDay(selectedDate).getTime());
    return transactions
      .filter(t => t.timestamp >= dayStart && t.timestamp <= dayEnd)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [transactions, selectedDate]);

  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = searchQuery.toLowerCase().trim();
    return transactions.filter(t => {
      const category = CATEGORIES.find(c => c.id === t.categoryId);
      const subCategory = category?.subcategories?.find(s => s.id === t.subCategoryId);
      return (
        t.name?.toLowerCase().includes(query) ||
        t.merchant?.toLowerCase().includes(query) ||
        t.note?.toLowerCase().includes(query) ||
        t.tags?.toLowerCase().includes(query) ||
        category?.name.toLowerCase().includes(query) ||
        subCategory?.name.toLowerCase().includes(query) ||
        t.currency.toLowerCase().includes(query)
      );
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, searchQuery]);

  const dailyStatsByCurrency = useMemo(() => getStatsByCurrency(dailyTransactions), [dailyTransactions]);

  const monthlyStatsByCurrency = useMemo(() => {
    return getStatsByCurrency(getMonthTransactions(transactions, selectedDate));
  }, [transactions, selectedDate]);

  const suggestionIndex = useMemo<SuggestionIndex>(() => buildSuggestionIndex(transactions), [transactions]);
  const tagUsageSummaries = useMemo(() => getTagUsageSummaries(transactions), [transactions]);
  const merchantUsageSummaries = useMemo(() => getMerchantUsageSummaries(transactions), [transactions]);
  const pullYearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = new Set<string>([
      String(currentYear - 1),
      String(currentYear),
      String(currentYear + 1),
    ]);

    for (const tx of transactions) {
      years.add(String(new Date(toEpochMillis(tx.timestamp)).getFullYear()));
    }

    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [transactions]);

  const openSyncStatusFrom = useCallback((origin: 'home' | 'settings') => {
    setSyncReturnView(origin);
    setActiveView('sync');
  }, []);

  const openPullReportsPage = useCallback((reportId?: string) => {
    if (reportId) {
      setFocusedPullReportId(reportId);
    }
    setActiveView('pull-reports');
  }, []);

  const navigateBack = useCallback((fallbackView: AppView, fallbackSyncReturnView?: 'home' | 'settings') => {
    const currentState = window.history.state as AppHistoryState | null;
    const hasAppHistory = Boolean(currentState && currentState.view && currentState.view !== fallbackView);

    if (hasAppHistory && window.history.length > 1) {
      window.history.back();
      return;
    }

    if (fallbackSyncReturnView) {
      setSyncReturnView(fallbackSyncReturnView);
    }
    setActiveView(fallbackView);
  }, []);

  const closeSyncStatusPage = useCallback(() => {
    navigateBack(syncReturnView, syncReturnView);
  }, [navigateBack, syncReturnView]);

  const selectTransactionDate = useCallback((transaction: Pick<Transaction, 'timestamp'>) => {
    setSelectedDate(new Date(toEpochMillis(transaction.timestamp)));
  }, []);

  const pullYearFromCloud = useCallback(async (year: string) => {
    const result = await pullTransactionsFromCloud(year);
    await refreshData();
    return result;
  }, [refreshData]);

  const deletePullReport = useCallback(async (reportId: string) => {
    await db.pullReports.delete(reportId);
    await refreshData();
  }, [refreshData]);

  const addTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    let attempts = 0;
    const maxAttempts = 10;
    let baseTime = Date.now();
    while (attempts < maxAttempts) {
      try {
        const id = (baseTime + attempts).toString();
        const transaction: Transaction = {
          ...newTx,
          id,
          updatedAt: Date.now(),
          version: 1,
          syncStatus: 'pending'
        } as Transaction;
        await db.transactions.add(transaction);
        setTransactions(prev => [transaction, ...prev]);
        selectTransactionDate(transaction);
        void showAutoDismissToast({ title: '已儲存新紀錄' });

      void (async () => {
        if (isOffline()) {
          return;
        }
        const results = await runSyncWithProgress('同步新交易', (onProgress) => syncCreateItems([transaction], onProgress));
        const failed = results.find(r => r.id === transaction.id && r.status === 'error');
        if (failed) {
            setCapturedErrors(prev => [...prev, `Sync Error [${transaction.id}]: ${failed.message || 'Create sync failed'}`]);
        }
        await refreshData();
      })();
        return true;
      } catch (err: any) {
        if (err.name === 'ConstraintError' || err.message.includes('already exists')) {
          attempts++;
          continue;
        }
        setCapturedErrors(prev => [...prev, `Add Error: ${err.message}`]);
        break;
      }
    }
    return false;
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    try {
      const existing = transactions.find(t => t.id === updatedTx.id);
      const nextVersion = (existing?.version || 0) + 1;
      const merged: Transaction = {
        ...existing,
        ...updatedTx,
        updatedAt: Date.now(),
        version: nextVersion,
        syncStatus: 'pending',
        lastSyncError: undefined,
      };
      await db.transactions.put(merged);
      setTransactions(prev => prev.map(t => t.id === updatedTx.id ? merged : t));
      selectTransactionDate(merged);
      setEditingTransaction(null);
      void showAutoDismissToast({ title: '已儲存修改' });

      void (async () => {
        if (isOffline()) {
          return;
        }
        const results = await runSyncWithProgress('同步更新交易', (onProgress) => syncCreateItems([merged], onProgress));
        const failed = results.find(r => r.id === merged.id && r.status === 'error');
        if (failed) {
          setCapturedErrors(prev => [...prev, `Sync Error [${merged.id}]: ${failed.message || 'Update sync failed'}`]);
        }
        await refreshData();
      })();
      return true;
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Update Error: ${err.message}`]);
      return false;
    }
  };

  const deleteTransaction = async (id: string) => {
    try {
      await db.transactions.delete(id);
      setTransactions(prev => prev.filter(t => t.id !== id));
      setEditingTransaction(null);
      void showAutoDismissToast({ title: '已刪除紀錄' });
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Delete Error: ${err.message}`]);
    }
  };

  const retrySyncTransaction = useCallback(async (id: string) => {
    if (isOffline()) {
      return;
    }

    try {
      const transaction = await db.transactions.get(id);
      if (!transaction) {
        setCapturedErrors(prev => [...prev, `Retry Sync Error [${id}]: Transaction not found`]);
        await refreshData();
        return;
      }

      const results = await runSyncWithProgress('重新上傳交易', (onProgress) => syncCreateItems([transaction], onProgress));
      const failed = results.find((result) => result.id === id && result.status === 'error');
      if (failed) {
        setCapturedErrors(prev => [...prev, `Retry Sync Error [${id}]: ${failed.message || 'Retry sync failed'}`]);
      } else {
        showToast('重新上傳完成');
      }
      await refreshData();
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Retry Sync Error [${id}]: ${err.message || 'Retry sync failed'}`]);
      await refreshData();
    }
  }, [refreshData, runSyncWithProgress, showToast]);

  const closeTransactionModal = useCallback(() => {
    setIsModalOpen(false);
    setEditingTransaction(null);
    setPrefilledTransaction(null);
  }, []);

  const previewTagRename = useCallback(async (oldTag: string, newTag: string) => {
    return buildTagRenamePreview(transactions, oldTag, newTag);
  }, [transactions]);

  const previewMerchantRename = useCallback(async (oldMerchant: string, newMerchant: string) => {
    return buildMerchantRenamePreview(transactions, oldMerchant, newMerchant);
  }, [transactions]);

  const getMerchantTransactions = useCallback(async (merchant: string) => {
    return getTransactionsByMerchant(transactions, merchant);
  }, [transactions]);

  const getTagTransactions = useCallback(async (tag: string) => {
    return getTransactionsByTag(transactions, tag);
  }, [transactions]);

  const renameMerchant = useCallback(async (oldMerchant: string, newMerchant: string) => {
    try {
      const { preview, updatedTransactions } = renameMerchantInTransactions(transactions, oldMerchant, newMerchant);

      if (preview.affectedCount === 0 || updatedTransactions.length === 0) {
        throw new Error('找不到會受影響的交易');
      }

      const timestamp = Date.now();
      const transactionsToPersist = updatedTransactions.map((tx, index) => ({
        ...tx,
        merchant: preview.newMerchant,
        updatedAt: timestamp + index,
        version: (tx.version || 0) + 1,
        syncStatus: 'pending' as const,
        lastSyncError: undefined,
      }));

      await db.transactions.bulkPut(transactionsToPersist);

      const updatedById = new Map(transactionsToPersist.map((tx) => [tx.id, tx]));
      setTransactions((prev) => prev.map((tx) => updatedById.get(tx.id) || tx));

      const renameSummary = preview.willMerge
        ? `已將 ${preview.oldMerchant} 合併到 ${preview.newMerchant}`
        : `已將 ${preview.oldMerchant} 更名為 ${preview.newMerchant}`;

      if (isOffline()) {
        showToast(renameSummary);
        return { ...preview, skippedOffline: true };
      }

      const syncResult = await triggerPendingSync('商家更名後同步');
      await refreshData();
      showToast(
        syncResult.failed > 0
          ? `商家更名完成，但有 ${syncResult.failed} 筆同步失敗`
          : renameSummary
      );
      return { ...preview, skippedOffline: false, syncResult };
    } catch (err: any) {
      setCapturedErrors((prev) => [...prev, `Merchant Rename Error: ${err.message}`]);
      throw err;
    }
  }, [refreshData, showToast, transactions, triggerPendingSync]);

  const renameTag = useCallback(async (oldTag: string, newTag: string) => {
    try {
      const { preview, updatedTransactions } = renameTagInTransactions(transactions, oldTag, newTag);

      if (preview.affectedCount === 0 || updatedTransactions.length === 0) {
        throw new Error('找不到會受影響的交易');
      }

      const timestamp = Date.now();
      const transactionsToPersist = updatedTransactions.map((tx, index) => ({
        ...tx,
        updatedAt: timestamp + index,
        version: (tx.version || 0) + 1,
        syncStatus: 'pending' as const,
        lastSyncError: undefined,
      }));

      await db.transactions.bulkPut(transactionsToPersist);

      const updatedById = new Map(transactionsToPersist.map((tx) => [tx.id, tx]));
      setTransactions((prev) => prev.map((tx) => updatedById.get(tx.id) || tx));

      const normalizedOldTag = normalizeTag(oldTag);
      const normalizedNewTag = normalizeTag(newTag);
      const renameSummary = `已將 #${normalizedOldTag} 更名為 #${normalizedNewTag}`;

      if (isOffline()) {
        showToast(renameSummary);
        return { ...preview, skippedOffline: true };
      }

      const syncResult = await triggerPendingSync('tag 更名後同步');
      await refreshData();
      showToast(
        syncResult.failed > 0
          ? `Tag 更名完成，但有 ${syncResult.failed} 筆同步失敗`
          : renameSummary
      );
      return { ...preview, skippedOffline: false, syncResult };
    } catch (err: any) {
      setCapturedErrors((prev) => [...prev, `Tag Rename Error: ${err.message}`]);
      throw err;
    }
  }, [refreshData, showToast, transactions, triggerPendingSync]);

  const handleEditItem = (tx: Transaction) => {
    if (duplicateReopenTimerRef.current !== null) {
      window.clearTimeout(duplicateReopenTimerRef.current);
      duplicateReopenTimerRef.current = null;
    }
    setPrefilledTransaction(null);
    setEditingTransaction(tx);
    setModalInstanceKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleDuplicateItem = useCallback((tx: Transaction) => {
    const timestamp = toEpochSeconds(Date.now());
    if (duplicateReopenTimerRef.current !== null) {
      window.clearTimeout(duplicateReopenTimerRef.current);
    }
    setIsModalOpen(false);
    setEditingTransaction(null);
    setPrefilledTransaction(null);
    duplicateReopenTimerRef.current = window.setTimeout(() => {
      setPrefilledTransaction({
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        categoryId: tx.categoryId,
        subCategoryId: tx.subCategoryId,
        name: tx.name,
        note: tx.note,
        merchant: tx.merchant,
        paymentMethod: tx.paymentMethod,
        timestamp,
        readableDateTime: formatReadableDateTime(timestamp),
        tags: tx.tags
      });
      setModalInstanceKey((prev) => prev + 1);
      setIsModalOpen(true);
      duplicateReopenTimerRef.current = null;
    }, 30);
  }, []);

  const openNewTransactionModal = useCallback(() => {
    if (duplicateReopenTimerRef.current !== null) {
      window.clearTimeout(duplicateReopenTimerRef.current);
      duplicateReopenTimerRef.current = null;
    }
    setEditingTransaction(null);
    setPrefilledTransaction(null);
    setModalInstanceKey((prev) => prev + 1);
    setIsModalOpen(true);
  }, []);

  const openSearchPage = () => {
    setActiveView('search');
    window.setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearchPage = () => {
    navigateBack('home');
    setSearchQuery('');
  };

  const formatStatAmount = (val: number, currency: string) => {
    return formatCurrencyAmount(val, currency, { withSpace: true });
  };

  const editingTransactionSyncInfo = useMemo<TransactionSyncInfo | null>(() => {
    if (!editingTransaction) return null;

    const latestTransaction = transactions.find((tx) => tx.id === editingTransaction.id);
    if (!latestTransaction) {
      return {
        id: editingTransaction.id,
        syncStatus: editingTransaction.syncStatus,
        lastSyncError: editingTransaction.lastSyncError,
        exists: false,
      };
    }

    return {
      id: latestTransaction.id,
      syncStatus: latestTransaction.syncStatus,
      lastSyncError: latestTransaction.lastSyncError,
      exists: true,
    };
  }, [editingTransaction, transactions]);

  useEffect(() => {
    const nextState: AppHistoryState = {
      view: activeView,
      syncReturnView,
    };

    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      window.history.replaceState(nextState, '');
      return;
    }

    const currentState = window.history.state as AppHistoryState | null;
    if (currentState?.view === activeView && currentState?.syncReturnView === syncReturnView) {
      return;
    }

    if (activeView === 'home') {
      window.history.replaceState(nextState, '');
      return;
    }

    window.history.pushState(nextState, '');
  }, [activeView, syncReturnView]);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as AppHistoryState | null;
      const nextView = state?.view ?? 'home';
      const nextSyncReturnView = state?.syncReturnView === 'settings' ? 'settings' : 'home';

      isApplyingHistoryRef.current = true;
      setActiveView(nextView);
      setSyncReturnView(nextSyncReturnView);

      if (nextView !== 'search') {
        setSearchQuery('');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-bold text-xs uppercase tracking-widest">載入中...</p>
      </div>
    );
  }

  const syncProgressPercent = syncProgressUI.total > 0
    ? Math.round((syncProgressUI.processed / syncProgressUI.total) * 100)
    : 0;
  const settingsSection = SETTINGS_VIEW_SECTION_MAP[activeView] ?? null;
  const transactionModalProps = {
    initialDate: selectedDate,
    editingTransaction,
    prefilledTransaction,
    onClose: closeTransactionModal,
    onAdd: addTransaction,
    onUpdate: updateTransaction,
    onDelete: deleteTransaction,
    onDuplicate: handleDuplicateItem,
    onRetrySyncTransaction: retrySyncTransaction,
    syncInfo: editingTransactionSyncInfo,
    isOffline: isOfflineMode,
    isSyncConfigured,
    isSyncing: syncProgressUI.visible,
    suggestions: suggestionIndex,
  };

  if (activeView === 'stats') {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <MonthlyStatsPage
          transactions={transactions}
          initialDate={selectedDate}
          defaultCurrency={defaultCurrency}
          paymentMethodDisplayMode={paymentMethodDisplayMode}
          onBack={() => navigateBack('home')}
          onTransactionClick={handleEditItem}
        />
        {isModalOpen && (
          <AddTransactionModal key={modalInstanceKey} {...transactionModalProps} />
        )}
      </div>
    );
  }

  if (activeView === 'settings' || settingsSection) {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <SettingsPage
          section={settingsSection}
          onClose={() => navigateBack('home')}
          onCloseSection={() => navigateBack('settings')}
          onOpenSection={(section) => setActiveView(SETTINGS_SECTION_VIEW_MAP[section])}
          onDataChange={refreshData}
          onInsertExamples={insertExampleTransactions}
          onPreviewDeleteExamples={previewSampleTransactions}
          onDeleteExamples={deleteSampleTransactions}
          onTriggerSync={triggerPendingSync}
          onOpenSyncProgress={() => openSyncStatusFrom('settings')}
          onOpenPullReports={openPullReportsPage}
          onPullFromCloud={pullYearFromCloud}
          pullYearOptions={pullYearOptions}
          onNotify={showToast}
          isOffline={isOfflineMode}
          paymentMethodDisplayMode={paymentMethodDisplayMode}
          onPaymentMethodDisplayModeChange={setPaymentMethodDisplayMode}
          tagSummaries={tagUsageSummaries}
          merchantSummaries={merchantUsageSummaries}
          onPreviewTagRename={previewTagRename}
          onRenameTag={renameTag}
          onGetTagTransactions={getTagTransactions}
          onTagTransactionClick={handleEditItem}
          onPreviewMerchantRename={previewMerchantRename}
          onRenameMerchant={renameMerchant}
          onGetMerchantTransactions={getMerchantTransactions}
          onMerchantTransactionClick={handleEditItem}
        />
        {isModalOpen && (
          <AddTransactionModal key={modalInstanceKey} {...transactionModalProps} />
        )}
      </div>
    );
  }

  if (activeView === 'pull-reports') {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <PullReportsPage
          reports={pullReports}
          focusReportId={focusedPullReportId}
          onClose={() => navigateBack('settings')}
          onDeleteReport={deletePullReport}
        />
        {isModalOpen && (
          <AddTransactionModal key={modalInstanceKey} {...transactionModalProps} />
        )}
      </div>
    );
  }

  if (activeView === 'sync') {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <SyncStatusPage
          transactions={transactions}
          onClose={closeSyncStatusPage}
          onSyncNow={async () => {
            await triggerPendingSync('同步狀態頁手動同步');
          }}
          isSyncing={syncProgressUI.visible}
          isOffline={isOfflineMode}
          paymentMethodDisplayMode={paymentMethodDisplayMode}
          onTransactionClick={handleEditItem}
        />
        {isModalOpen && (
          <AddTransactionModal key={modalInstanceKey} {...transactionModalProps} />
        )}
      </div>
    );
  }

  if (activeView === 'search') {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <SearchPage
          searchQuery={searchQuery}
          filteredTransactions={filteredTransactions}
          searchInputRef={searchInputRef}
          paymentMethodDisplayMode={paymentMethodDisplayMode}
          onBack={closeSearchPage}
          onQueryChange={setSearchQuery}
          onClearQuery={() => setSearchQuery('')}
          onTransactionClick={handleEditItem}
        />
        {isModalOpen && (
          <AddTransactionModal key={modalInstanceKey} {...transactionModalProps} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
      <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
      {toastMessage && <SuccessToast message={toastMessage} />}
      <HomePage
        selectedDate={selectedDate}
        calendarViewMode={calendarViewMode}
        transactions={transactions}
        dailyTransactions={dailyTransactions}
        monthlyStatsByCurrency={monthlyStatsByCurrency}
        dailyStatsByCurrency={dailyStatsByCurrency}
        defaultCurrency={defaultCurrency}
        isOffline={isOfflineMode}
        isSyncProgressVisible={syncProgressUI.visible}
        paymentMethodDisplayMode={paymentMethodDisplayMode}
        onDateSelect={setSelectedDate}
        onCalendarViewModeChange={setCalendarViewMode}
        onPrevDay={() => setSelectedDate(addDays(selectedDate, -1))}
        onNextDay={() => setSelectedDate(addDays(selectedDate, 1))}
        onOpenSearch={openSearchPage}
        onOpenSettings={() => setActiveView('settings')}
        onOpenSyncStatus={() => openSyncStatusFrom('home')}
        onOpenStats={() => setActiveView('stats')}
        onOpenAddTransaction={openNewTransactionModal}
        onTransactionClick={handleEditItem}
        formatStatAmount={formatStatAmount}
      />
      {isModalOpen && (
        <AddTransactionModal key={modalInstanceKey} {...transactionModalProps} />
      )}
    </div>
  );
};

export default App;
