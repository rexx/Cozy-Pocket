
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isSameDay, endOfMonth, isWithinInterval, endOfDay, addDays } from 'date-fns';
import { Plus, AlertCircle, X, Search as SearchIcon, ArrowLeft, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import Calendar from './components/Calendar';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal from './components/AddTransactionModal';
import DataManagementModal from './components/DataManagementModal';
import SyncProgressPage from './components/SyncProgressPage';
import { SuggestionIndex, SuggestionItem, Transaction } from './types';
import { EXAMPLE_TRANSACTIONS, CATEGORIES, formatCurrencyAmount, getEnabledCurrencies, getPreferredCurrency } from './constants';
import { db } from './db';
import { SyncProgress, syncCreateItems, syncPendingTransactions } from './services/cloudSyncService';
import { isOffline } from './services/networkService';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from './time';

const ErrorDisplay: React.FC<{ errors: string[], onClear: () => void }> = ({ errors, onClear }) => {
  if (errors.length === 0) return null;
  return (
    <div className="safe-area-top fixed top-0 left-0 right-0 z-[9999] bg-red-600/95 text-white p-4 text-xs font-mono max-h-[40vh] overflow-y-auto shadow-2xl backdrop-blur-md">
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
    style={{ bottom: 'calc(7rem + var(--safe-area-bottom))' }}
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
      tx.tags
        ? tx.tags.split(/\s+/).map((tag) => tag.replace(/^#+/, '')).filter(Boolean)
        : []
    )),
  };
};

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSyncProgressPageOpen, setIsSyncProgressPageOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [capturedErrors, setCapturedErrors] = useState<string[]>([]);
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
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
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [toastMessage, setToastMessage] = useState('');
  const [isOfflineMode, setIsOfflineMode] = useState(isOffline());
  const toastHideTimerRef = useRef<number | null>(null);
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
      const allTransactions = await db.transactions.toArray();
      setTransactions(allTransactions);
      const [defaultCurrencySetting, enabledCurrenciesSetting] = await Promise.all([
        db.settings.get('defaultCurrency'),
        db.settings.get('enabledCurrencies')
      ]);
      const enabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
      setDefaultCurrency(getPreferredCurrency(defaultCurrencySetting?.value, enabledCurrencies));
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
        id: `${now}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
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
        const failedCount = results.filter(r => r.status === 'error').length;
        if (failedCount > 0) {
          setCapturedErrors(prev => [...prev, `Sync Error: 範例資料有 ${failedCount} 筆同步失敗`]);
        }
        await refreshData();
      })();

      return examples.length;
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Insert Example Error: ${err.message}`]);
      throw err;
    }
  };

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
        const [defaultCurrencySetting, enabledCurrenciesSetting] = await Promise.all([
          db.settings.get('defaultCurrency'),
          db.settings.get('enabledCurrencies')
        ]);
        const enabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
        const safeDefaultCurrency = getPreferredCurrency(defaultCurrencySetting?.value, enabledCurrencies);
        await db.settings.bulkPut([
          { key: 'enabledCurrencies', value: enabledCurrencies },
          { key: 'defaultCurrency', value: safeDefaultCurrency }
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
    const failed = results.filter((r) => r.status === 'error');
    if (failed.length > 0) {
      setCapturedErrors(prev => [...prev, `Sync Pending Error: ${failed.length} 筆待同步資料上傳失敗`]);
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
    if (!isSearchMode || !searchQuery.trim()) return [];
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
  }, [transactions, searchQuery, isSearchMode]);

  const getStatsByCurrency = (txs: Transaction[]) => {
    return txs.reduce((acc, curr) => {
      const cur = curr.currency || 'TWD';
      if (!acc[cur]) acc[cur] = { income: 0, expense: 0 };
      if (curr.type === '收入') acc[cur].income += Math.abs(curr.amount);
      else acc[cur].expense += Math.abs(curr.amount);
      return acc;
    }, {} as Record<string, { income: number, expense: number }>);
  };

  const dailyStatsByCurrency = useMemo(() => getStatsByCurrency(dailyTransactions), [dailyTransactions]);

  const monthlyStatsByCurrency = useMemo(() => {
    const start = toEpochSeconds(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getTime());
    const end = toEpochSeconds(endOfMonth(selectedDate).getTime());
    const monthTxs = transactions.filter(t => t.timestamp >= start && t.timestamp <= end);
    return getStatsByCurrency(monthTxs);
  }, [transactions, selectedDate]);

  const suggestionIndex = useMemo<SuggestionIndex>(() => buildSuggestionIndex(transactions), [transactions]);

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
        showToast('已儲存新紀錄');

      void (async () => {
        if (isOffline()) {
          return;
        }
        const results = await runSyncWithProgress('同步新交易', (onProgress) => syncCreateItems([transaction], onProgress));
        const failed = results.find(r => r.id === transaction.id && r.status === 'error');
        if (failed) {
            setCapturedErrors(prev => [...prev, `Sync Error: ${failed.message || 'Create sync failed'}`]);
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
      setEditingTransaction(null);
      showToast('已儲存修改');

      void (async () => {
        if (isOffline()) {
          return;
        }
        const results = await runSyncWithProgress('同步更新交易', (onProgress) => syncCreateItems([merged], onProgress));
        const failed = results.find(r => r.id === merged.id && r.status === 'error');
        if (failed) {
          setCapturedErrors(prev => [...prev, `Sync Error: ${failed.message || 'Update sync failed'}`]);
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
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Delete Error: ${err.message}`]);
    }
  };

  const handleEditItem = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const toggleSearchMode = () => {
    setIsSearchMode(!isSearchMode);
    setSearchQuery('');
    if (!isSearchMode) setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const formatStatAmount = (val: number, currency: string) => {
    return formatCurrencyAmount(val, currency, { withSpace: true });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-bold text-xs uppercase tracking-widest">載入中...</p>
      </div>
    );
  }

  const dailyCurrencyCount = Object.keys(dailyStatsByCurrency).length;
  const monthlyCurrencyCount = Object.keys(monthlyStatsByCurrency).length;
  const syncProgressPercent = syncProgressUI.total > 0
    ? Math.round((syncProgressUI.processed / syncProgressUI.total) * 100)
    : 0;

  return (
    <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
      <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
      {toastMessage && <SuccessToast message={toastMessage} />}
      <div className="flex-none z-30 bg-[#1a1c2c] shadow-lg shadow-black/40">
        {!isSearchMode ? (
          <Calendar 
            selectedDate={selectedDate} 
            onDateSelect={setSelectedDate}
            onSearchClick={toggleSearchMode}
            onSettingsClick={() => setIsSettingsOpen(true)}
            onSyncProgressClick={() => setIsSyncProgressPageOpen(true)}
            isSyncProgressVisible={syncProgressUI.visible}
            isOffline={isOfflineMode}
            transactions={transactions}
          />
        ) : (
          <div className="p-4 flex items-center gap-3 animate-slide-up">
            <button onClick={toggleSearchMode} className="p-2 text-gray-400 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜尋名稱、幣別、商家、標籤..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#252538] text-white text-sm font-bold py-3 pl-10 pr-4 rounded-2xl border border-cyan-500/20 focus:outline-none focus:border-cyan-500 transition-all placeholder-gray-600"
              />
              <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16} /></button>}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {!isSearchMode && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-between px-6">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="pointer-events-auto w-9 h-9 rounded-full bg-[#24273c]/80 border border-white/10 text-gray-300 flex items-center justify-center shadow-lg hover:text-white active:scale-90 transition-all"
              aria-label="切換到昨天"
              title="昨天"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="pointer-events-auto w-9 h-9 rounded-full bg-[#24273c]/80 border border-white/10 text-gray-300 flex items-center justify-center shadow-lg hover:text-white active:scale-90 transition-all"
              aria-label="切換到明天"
              title="明天"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
        {!isSearchMode && (
          <div className="absolute right-8 bottom-8 z-40">
            <button onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }} className="w-16 h-16 bg-cyan-500 text-black rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(34,211,238,0.4)] active:scale-90 transition-all hover:brightness-110">
              <Plus size={36} strokeWidth={2.5} />
            </button>
          </div>
        )}
        <div className="overflow-y-auto no-scrollbar overscroll-contain h-full min-h-0">
          <div className="mt-2 space-y-1">
          {isSearchMode ? (
            <>
              {searchQuery.trim() === '' ? (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                  <div className="text-7xl mb-6 grayscale opacity-20 select-none">🔍</div>
                  <p className="text-gray-500 font-bold text-lg tracking-tight opacity-60">請輸入關鍵字開始搜尋</p>
                </div>
              ) : filteredTransactions.length > 0 ? (
                <>
                  <div className="px-5 py-2"><span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">搜尋結果 ({filteredTransactions.length})</span></div>
                  {filteredTransactions.map(tx => (
                    <div key={tx.id}>
                      <div className="px-5 py-1 bg-white/5 border-l-2 border-cyan-500/50"><span className="text-[10px] text-gray-500 font-bold">{format(new Date(toEpochMillis(tx.timestamp)), 'yyyy-MM-dd')}</span></div>
                      <TransactionItem transaction={tx} onClick={handleEditItem} />
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-40"><div className="text-6xl mb-4">🙊</div><p className="text-gray-400 font-medium">找不到符合「{searchQuery}」的紀錄</p></div>
              )}
            </>
          ) : (
            <>
              {dailyTransactions.length > 0 ? (
                dailyTransactions.map(tx => <TransactionItem key={tx.id} transaction={tx} onClick={handleEditItem} />)
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                  <div className="text-7xl mb-6 filter grayscale opacity-40">☕</div>
                  <p className="text-gray-400 font-medium text-lg">今天還沒有任何紀錄</p>
                </div>
              )}

              <div className="px-6 pt-12">
                <div className="bg-[#24273c]/50 border border-white/5 rounded-[1.2rem] p-4 flex items-center shadow-xl">
                  <div className="flex-1 border-r border-white/5 pr-4 space-y-1.5 opacity-60">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-gray-500 text-[9px] font-black uppercase tracking-[0.1em]">本月</span>
                      {monthlyCurrencyCount > 1 && <Layers size={10} className="text-cyan-500" />}
                    </div>
                    {Object.entries(monthlyStatsByCurrency).length > 0 ? (
                      Object.entries(monthlyStatsByCurrency).map(([curr, stats]: [string, any]) => (
                        <div key={curr} className="mb-2 last:mb-0">
                          <div className="text-rose-400/80 font-bold text-[11px] tabular-nums truncate">+{formatStatAmount(stats.income, curr)}</div>
                          <div className="text-emerald-400/80 font-bold text-[11px] tabular-nums truncate">-{formatStatAmount(stats.expense, curr)}</div>
                        </div>
                      )).slice(0, 2)
                    ) : (
                      <div className="text-gray-700 font-bold text-[11px]">{formatStatAmount(0, defaultCurrency)}</div>
                    )}
                    {monthlyCurrencyCount > 2 && <div className="text-[8px] text-gray-600 font-black">+ 更多幣別</div>}
                  </div>

                  <div className="flex-[1.2] pl-4 space-y-1.5 text-right">
                    <div className="flex items-center justify-end gap-1 mb-1">
                      {dailyCurrencyCount > 1 && <span className="text-[8px] text-cyan-400 font-black uppercase">📦 多幣別</span>}
                      <span className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">今日</span>
                    </div>
                    {Object.entries(dailyStatsByCurrency).length > 0 ? (
                      Object.entries(dailyStatsByCurrency).map(([curr, stats]: [string, any]) => (
                        <div key={curr} className="mb-3 last:mb-0">
                          <div className="text-rose-400 font-black text-lg tabular-nums tracking-tighter leading-none">+{formatStatAmount(stats.income, curr)}</div>
                          <div className="text-emerald-400 font-black text-lg tabular-nums tracking-tighter leading-none">-{formatStatAmount(stats.expense, curr)}</div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-700 font-black text-xl">{formatStatAmount(0, defaultCurrency)}</div>
                    )}
                  </div>
                </div>
                <p className="text-center text-[10px] text-gray-700 font-bold uppercase tracking-[0.4em] mt-12 opacity-15">Cozy Pocket • Minimalism</p>
              </div>
            </>
          )}
          </div>
        </div>
      </div>
      {isModalOpen && (
        <AddTransactionModal
          initialDate={selectedDate}
          editingTransaction={editingTransaction}
          onClose={() => setIsModalOpen(false)}
          onAdd={addTransaction}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
          suggestions={suggestionIndex}
        />
      )}
      {isSettingsOpen && (
        <DataManagementModal
          onClose={() => setIsSettingsOpen(false)}
          onDataChange={refreshData}
          onInsertExamples={insertExampleTransactions}
          onTriggerSync={triggerPendingSync}
          onOpenSyncProgress={() => setIsSyncProgressPageOpen(true)}
          onNotify={showToast}
          isOffline={isOfflineMode}
        />
      )}
      {isSyncProgressPageOpen && (
        <SyncProgressPage
          transactions={transactions}
          onClose={() => setIsSyncProgressPageOpen(false)}
          onSyncNow={async () => {
            await triggerPendingSync('同步狀態頁手動同步');
          }}
          isSyncing={syncProgressUI.visible}
          isOffline={isOfflineMode}
        />
      )}
    </div>
  );
};

export default App;
