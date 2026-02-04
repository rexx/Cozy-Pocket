
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { format, isSameDay, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, AlertCircle, X, Search as SearchIcon, ArrowLeft } from 'lucide-react';
import Calendar from './components/Calendar';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal from './components/AddTransactionModal';
import DataManagementModal from './components/DataManagementModal';
import { Transaction } from './types';
import { INITIAL_TRANSACTIONS, CATEGORIES } from './constants';
import { db } from './db';

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

const App: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [capturedErrors, setCapturedErrors] = useState<string[]>([]);

  // Search States
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Initialize and load data from Dexie
  const refreshData = async () => {
    try {
      const allTransactions = await db.transactions.toArray();
      setTransactions(allTransactions);
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `DB Load Error: ${err.message}`]);
    }
  };

  useEffect(() => {
    const initData = async () => {
      try {
        const count = await db.transactions.count();
        if (count === 0) {
          await db.transactions.bulkAdd(INITIAL_TRANSACTIONS as Transaction[]);
        }
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

  const clearErrors = useCallback(() => setCapturedErrors([]), []);

  const dailyTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const [y, m, d] = t.date.split('-').map(Number);
        const txDate = new Date(y, m - 1, d);
        return isSameDay(txDate, selectedDate);
      })
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
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
        subCategory?.name.toLowerCase().includes(query)
      );
    }).sort((a, b) => b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || ''));
  }, [transactions, searchQuery, isSearchMode]);

  const dailyStats = useMemo(() => {
    return dailyTransactions.reduce((acc, curr) => {
      if (curr.type === '收入') {
        acc.income += curr.amount;
      } else {
        acc.expense += curr.amount;
      }
      return acc;
    }, { income: 0, expense: 0 });
  }, [dailyTransactions]);

  const monthlyStats = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = endOfMonth(selectedDate);
    return transactions
      .filter(t => {
        const [y, m, d] = t.date.split('-').map(Number);
        const txDate = new Date(y, m - 1, d);
        return isWithinInterval(txDate, { start, end });
      })
      .reduce((acc, curr) => {
        if (curr.type === '收入') {
          acc.income += curr.amount;
        } else {
          acc.expense += curr.amount;
        }
        return acc;
      }, { income: 0, expense: 0 });
  }, [transactions, selectedDate]);

  const addTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    try {
      // 使用更安全的 UUID 替代 Date.now()
      const id = crypto.randomUUID();
      const transaction: Transaction = { ...newTx, id } as Transaction;
      await db.transactions.add(transaction);
      setTransactions(prev => [transaction, ...prev]);
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Add Error: ${err.message}`]);
    }
  };

  const updateTransaction = async (updatedTx: Transaction) => {
    try {
      await db.transactions.put(updatedTx);
      setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
      setEditingTransaction(null);
    } catch (err: any) {
      setCapturedErrors(prev => [...prev, `Update Error: ${err.message}`]);
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

  const handleOpenModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  const toggleSearchMode = () => {
    setIsSearchMode(!isSearchMode);
    setSearchQuery('');
    if (!isSearchMode) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-screen w-full bg-[#1a1c2c] items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-bold text-xs uppercase tracking-widest">載入中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
      <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
      
      {/* Header Area */}
      <div className="flex-none z-30 bg-[#1a1c2c] shadow-lg shadow-black/40">
        {!isSearchMode ? (
          <Calendar 
            selectedDate={selectedDate} 
            onDateSelect={setSelectedDate}
            onSearchClick={toggleSearchMode}
            onSettingsClick={() => setIsSettingsOpen(true)}
            transactions={transactions}
          />
        ) : (
          <div className="p-4 flex items-center gap-3 animate-slide-up">
            <button 
              onClick={toggleSearchMode} 
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex-1 relative">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜尋名稱、商家、備註或標籤..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#252538] text-white text-sm font-bold py-3 pl-10 pr-4 rounded-2xl border border-cyan-500/20 focus:outline-none focus:border-cyan-500 transition-all placeholder-gray-600"
              />
              <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain">
        <div className="mt-2 space-y-1 pb-32">
          {isSearchMode ? (
            /* Search Mode Content */
            <>
              {searchQuery.trim() === '' ? (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                  <div className="text-7xl mb-6 grayscale opacity-20 select-none">🔍</div>
                  <p className="text-gray-500 font-bold text-lg tracking-tight opacity-60">請輸入關鍵字開始搜尋</p>
                </div>
              ) : filteredTransactions.length > 0 ? (
                <>
                  <div className="px-5 py-2">
                    <span className="text-[10px] text-cyan-400 font-black uppercase tracking-widest">
                      搜尋結果 ({filteredTransactions.length})
                    </span>
                  </div>
                  {filteredTransactions.map(tx => (
                    <div key={tx.id}>
                      <div className="px-5 py-1 bg-white/5 border-l-2 border-cyan-500/50">
                        <span className="text-[10px] text-gray-500 font-bold">{tx.date}</span>
                      </div>
                      <TransactionItem 
                        transaction={tx} 
                        onClick={handleEditItem}
                      />
                    </div>
                  ))}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-40">
                  <div className="text-6xl mb-4">🙊</div>
                  <p className="text-gray-400 font-medium">找不到符合「{searchQuery}」的紀錄</p>
                </div>
              )}
            </>
          ) : (
            /* Normal Daily Content */
            <>
              {dailyTransactions.length > 0 ? (
                dailyTransactions.map(tx => (
                  <TransactionItem 
                    key={tx.id} 
                    transaction={tx} 
                    onClick={handleEditItem}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                  <div className="text-7xl mb-6 filter grayscale opacity-40">☕</div>
                  <p className="text-gray-400 font-medium text-lg">今天還沒有任何紀錄</p>
                </div>
              )}

              {/* Stats only in non-search mode */}
              <div className="px-6 pt-12 pb-16">
                <div className="bg-[#24273c]/50 border border-white/5 rounded-[1.2rem] p-4 flex items-center shadow-xl">
                  <div className="flex-1 opacity-30 border-r border-white/5 pr-4 space-y-1.5">
                    <div className="text-gray-500 text-[9px] font-black uppercase tracking-[0.1em] mb-1">
                      本月
                    </div>
                    <div className="text-rose-400 font-bold text-sm tabular-nums truncate">
                      +${monthlyStats.income.toLocaleString()}
                    </div>
                    <div className="text-emerald-400 font-bold text-sm tabular-nums truncate">
                      -${monthlyStats.expense.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex-[1.2] pl-4 space-y-1.5 text-right">
                    <div className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em] mb-1">
                      今日
                    </div>
                    <div className="text-rose-400 font-black text-xl tabular-nums tracking-tighter leading-none">
                      +${dailyStats.income.toLocaleString()}
                    </div>
                    <div className="text-emerald-400 font-black text-xl tabular-nums tracking-tighter leading-none">
                      -${dailyStats.expense.toLocaleString()}
                    </div>
                  </div>
                </div>

                <p className="text-center text-[10px] text-gray-700 font-bold uppercase tracking-[0.4em] mt-12 opacity-15">
                  Cozy Pocket • Minimalism 
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Floating Action Button */}
      {!isSearchMode && (
        <div className="fixed bottom-8 right-8 z-50">
          <button 
            onClick={handleOpenModal}
            className="w-16 h-16 bg-cyan-500 text-black rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(34,211,238,0.4)] active:scale-90 transition-all hover:brightness-110"
          >
            <Plus size={36} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#1a1c2c] to-transparent pointer-events-none z-40"></div>

      {isModalOpen && (
        <AddTransactionModal 
          initialDate={selectedDate}
          editingTransaction={editingTransaction}
          onClose={() => setIsModalOpen(false)}
          onAdd={addTransaction}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
        />
      )}

      {isSettingsOpen && (
        <DataManagementModal 
          onClose={() => setIsSettingsOpen(false)}
          onDataChange={refreshData}
        />
      )}
    </div>
  );
};

export default App;
