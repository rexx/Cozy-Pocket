
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isSameDay, isWithinInterval, endOfDay, addDays } from 'date-fns';
import { AlertCircle, X } from 'lucide-react';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal from './components/AddTransactionModal';
import SettingsPage from './components/SettingsPage';
import SyncStatusPage from './components/SyncStatusPage';
import SearchPage from './components/SearchPage';
import HomePage from './components/HomePage';
import MonthlyStatsPage from './components/MonthlyStatsPage';
import { SuggestionIndex, SuggestionItem, Transaction } from './types';
import { EXAMPLE_TRANSACTIONS, CATEGORIES, formatCurrencyAmount, getEnabledCurrencies, getPreferredCurrency } from './constants';
import { db } from './db';
import { SyncProgress, syncCreateItems, syncPendingTransactions } from './services/cloudSyncService';
import { isOffline } from './services/networkService';
import { getMonthTransactions, getStatsByCurrency } from './services/statsService';
import { buildTagRenamePreview, getTagUsageSummaries, getTransactionsByTag, normalizeTag, renameTagInTransactions, splitTags } from './services/tagService';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from './time';

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
  const [activeView, setActiveView] = useState<'home' | 'search' | 'stats' | 'settings' | 'sync'>('home');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
      setEditingTransaction(null);
      showToast('已儲存修改');

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
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Delete Error: ${err.message}`]);
    }
  };

  const previewTagRename = useCallback(async (oldTag: string, newTag: string) => {
    return buildTagRenamePreview(transactions, oldTag, newTag);
  }, [transactions]);

  const getTagTransactions = useCallback(async (tag: string) => {
    return getTransactionsByTag(transactions, tag);
  }, [transactions]);

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
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const openSearchPage = () => {
    setActiveView('search');
    window.setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const closeSearchPage = () => {
    setActiveView('home');
    setSearchQuery('');
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

  const syncProgressPercent = syncProgressUI.total > 0
    ? Math.round((syncProgressUI.processed / syncProgressUI.total) * 100)
    : 0;

  if (activeView === 'stats') {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <MonthlyStatsPage
          transactions={transactions}
          initialDate={selectedDate}
          defaultCurrency={defaultCurrency}
          onBack={() => setActiveView('home')}
          onTransactionClick={handleEditItem}
        />
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
      </div>
    );
  }

  if (activeView === 'settings') {
    return (
      <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
        <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
        {toastMessage && <SuccessToast message={toastMessage} />}
        <SettingsPage
          onClose={() => setActiveView('home')}
          onDataChange={refreshData}
          onInsertExamples={insertExampleTransactions}
          onTriggerSync={triggerPendingSync}
          onOpenSyncProgress={() => setActiveView('sync')}
          onNotify={showToast}
          isOffline={isOfflineMode}
          tagSummaries={tagUsageSummaries}
          onPreviewTagRename={previewTagRename}
          onRenameTag={renameTag}
          onGetTagTransactions={getTagTransactions}
          onTagTransactionClick={handleEditItem}
        />
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
          onClose={() => setActiveView('home')}
          onSyncNow={async () => {
            await triggerPendingSync('同步狀態頁手動同步');
          }}
          isSyncing={syncProgressUI.visible}
          isOffline={isOfflineMode}
        />
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
          onBack={closeSearchPage}
          onQueryChange={setSearchQuery}
          onClearQuery={() => setSearchQuery('')}
          onTransactionClick={handleEditItem}
        />
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
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
      <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
      {toastMessage && <SuccessToast message={toastMessage} />}
      <HomePage
        selectedDate={selectedDate}
        transactions={transactions}
        dailyTransactions={dailyTransactions}
        monthlyStatsByCurrency={monthlyStatsByCurrency}
        dailyStatsByCurrency={dailyStatsByCurrency}
        defaultCurrency={defaultCurrency}
        isOffline={isOfflineMode}
        isSyncProgressVisible={syncProgressUI.visible}
        onDateSelect={setSelectedDate}
        onPrevDay={() => setSelectedDate(addDays(selectedDate, -1))}
        onNextDay={() => setSelectedDate(addDays(selectedDate, 1))}
        onOpenSearch={openSearchPage}
        onOpenSettings={() => setActiveView('settings')}
        onOpenSyncStatus={() => setActiveView('sync')}
        onOpenStats={() => setActiveView('stats')}
        onOpenAddTransaction={() => { setEditingTransaction(null); setIsModalOpen(true); }}
        onTransactionClick={handleEditItem}
        formatStatAmount={formatStatAmount}
      />
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
    </div>
  );
};

export default App;
