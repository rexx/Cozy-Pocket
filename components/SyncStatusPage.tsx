import React, { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { Transaction } from '../types';
import { toEpochMillis } from '../time';
import TransactionItem from './TransactionItem';
import PageHeader from './PageHeader';

interface SyncStatusPageProps {
  transactions: Transaction[];
  onClose: () => void;
  onSyncNow: () => Promise<void>;
  isSyncing: boolean;
  isOffline: boolean;
}

type SyncStatusKey = 'pending' | 'syncing' | 'synced' | 'error';

const STATUS_META: Record<SyncStatusKey, { label: string }> = {
  pending: {
    label: '待同步',
  },
  syncing: {
    label: '同步中',
  },
  synced: {
    label: '已同步',
  },
  error: {
    label: '失敗',
  },
};

const getSyncStatusKey = (tx: Transaction): SyncStatusKey => (
  tx.syncStatus === 'syncing'
    ? 'syncing'
    : tx.syncStatus === 'synced'
      ? 'synced'
      : tx.syncStatus === 'error'
        ? 'error'
        : 'pending'
);

const SyncStatusPage: React.FC<SyncStatusPageProps> = ({ transactions, onClose, onSyncNow, isSyncing, isOffline }) => {
  const [hideSyncedItems, setHideSyncedItems] = useState(true);

  const groupedCounts = useMemo(() => {
    const buckets: Record<SyncStatusKey, Transaction[]> = {
      pending: [],
      syncing: [],
      synced: [],
      error: [],
    };

    for (const tx of transactions) {
      buckets[getSyncStatusKey(tx)].push(tx);
    }
    return {
      pending: buckets.pending.length,
      syncing: buckets.syncing.length,
      synced: buckets.synced.length,
      error: buckets.error.length,
    };
  }, [transactions]);

  const visibleTransactions = useMemo(() => {
    const filteredTransactions = hideSyncedItems
      ? transactions.filter((tx) => getSyncStatusKey(tx) !== 'synced')
      : transactions;

    return [...filteredTransactions].sort((a, b) => toEpochMillis(b.timestamp) - toEpochMillis(a.timestamp));
  }, [hideSyncedItems, transactions]);

  const statusOrder: SyncStatusKey[] = ['pending', 'syncing', 'error', 'synced'];

  return (
    <div className="h-full w-full bg-[#1a1c2c] text-slate-200">
      <div className="h-full flex flex-col">
        <PageHeader
          title="同步狀態"
          leftAction={<ArrowLeft size={26} />}
          onLeftAction={onClose}
          rightSlot={(
            <button
              onClick={onSyncNow}
              disabled={isSyncing || isOffline}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed"
              title={isSyncing ? '同步中' : isOffline ? '離線中' : '立即同步'}
              aria-label={isSyncing ? '同步中' : isOffline ? '離線中' : '立即同步'}
            >
              <RefreshCw size={15} className={isSyncing ? 'animate-spin' : ''} />
            </button>
          )}
        />
        <div className="px-4 py-2 border-b border-white/5 bg-[#1e1e2d]">
          <p className="text-[10px] font-bold text-gray-500">待同步與同步結果總覽</p>
        </div>
        {isOffline && (
          <div className="px-4 py-2 border-b border-amber-400/10 bg-amber-500/10 text-[11px] font-bold text-amber-200">
            目前離線，待同步資料會保留在本機，恢復連線後再手動或自動補送。
          </div>
        )}

        <div className="px-4 py-3 border-b border-white/5 grid grid-cols-4 gap-2 bg-[#1c1f30]">
          {statusOrder.map((statusKey) => (
            <div key={statusKey} className="rounded-xl border border-white/10 bg-[#24273c]/60 px-2 py-2 text-center">
              <p className="text-[10px] text-gray-400 font-bold">{STATUS_META[statusKey].label}</p>
              <p className="text-sm font-black text-white mt-1 tabular-nums">{groupedCounts[statusKey]}</p>
            </div>
          ))}
        </div>

        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => setHideSyncedItems((prev) => !prev)}
            aria-pressed={hideSyncedItems}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] font-bold transition-colors ${
              hideSyncedItems
                ? 'border-cyan-500/40 bg-cyan-500/15 text-cyan-200'
                : 'border-white/10 bg-[#24273c]/50 text-gray-300'
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                hideSyncedItems ? 'bg-cyan-300' : 'bg-gray-500'
              }`}
            />
            隱藏已成功項目
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-4">
          {visibleTransactions.length > 0 ? (
            <div className="rounded-2xl border border-white/10 bg-[#24273c]/40 overflow-hidden">
              {visibleTransactions.map((tx) => (
                <div key={tx.id} className="border-b border-white/5 last:border-0">
                  <TransactionItem
                    transaction={tx}
                    onClick={() => {}}
                    showDateTime
                  />
                  {tx.syncStatus === 'error' && tx.lastSyncError && (
                    <div className="px-4 py-4">
                      <div className="rounded-none border border-rose-400/20 bg-rose-500/10 px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-200">詳細錯誤</p>
                        <p className="mt-1 break-all text-[11px] font-medium leading-relaxed text-rose-100">
                          {tx.lastSyncError}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-[11px] text-gray-600 font-bold text-center">
              {transactions.length === 0 ? '目前沒有同步資料' : '目前沒有待處理或失敗的同步項目'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncStatusPage;
