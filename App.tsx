
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isSameDay, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, Calendar as CalendarIcon, AlertCircle, X, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
import Calendar from './components/Calendar';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal from './components/AddTransactionModal';
import { Transaction } from './types';
import { INITIAL_TRANSACTIONS } from './constants';

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
  
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('cozy-pocket-tx');
      const parsed = saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
      return parsed.map((t: any) => ({ ...t, type: t.type || '支出' }));
    } catch (e) {
      return INITIAL_TRANSACTIONS.map(t => ({ ...t, type: t.type || '支出' }));
    }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [capturedErrors, setCapturedErrors] = useState<string[]>([]);

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

  useEffect(() => {
    localStorage.setItem('cozy-pocket-tx', JSON.stringify(transactions));
  }, [transactions]);

  const dailyTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        const [y, m, d] = t.date.split('-').map(Number);
        const txDate = new Date(y, m - 1, d);
        return isSameDay(txDate, selectedDate);
      })
      .sort((a, b) => (a.time || '').localeCompare(b.time || ''));
  }, [transactions, selectedDate]);

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

  const addTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = { ...newTx, id: Date.now().toString() } as Transaction;
    setTransactions(prev => [transaction, ...prev]);
  };

  const updateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
    setEditingTransaction(null);
  };

  const deleteTransaction = (id: string) => {
    setTransactions(prev => prev.filter(t => t.id !== id));
    setEditingTransaction(null);
  };

  const handleOpenModal = () => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditItem = (tx: Transaction) => {
    setEditingTransaction(tx);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#1a1c2c] overflow-hidden relative font-sans">
      <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
      
      {/* 頂部日曆：固定在頂部 */}
      <div className="flex-none z-30 bg-[#1a1c2c] shadow-lg shadow-black/40">
        <Calendar 
          selectedDate={selectedDate} 
          onDateSelect={setSelectedDate}
          transactions={transactions}
        />
      </div>

      {/* 中間滾動內容區 */}
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain">
        <div className="mt-2 space-y-1 pb-32">
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

          {/* 本月總計卡片：放置在列表最下方，隨滾動顯示 */}
          <div className="px-5 pt-10 pb-4">
            <div className="bg-[#24273c] border border-white/5 rounded-3xl p-5 flex gap-4 shadow-2xl">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                  <ArrowDownLeft size={14} className="text-rose-500" />
                  <span>本月收入</span>
                </div>
                <div className="text-rose-400 font-black text-2xl tracking-tighter">
                  ${monthlyStats.income.toLocaleString()}
                </div>
              </div>
              
              <div className="w-px bg-white/5 self-stretch my-1"></div>

              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-1.5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                  <ArrowUpRight size={14} className="text-emerald-500" />
                  <span>本月支出</span>
                </div>
                <div className="text-emerald-400 font-black text-2xl tracking-tighter">
                  ${monthlyStats.expense.toLocaleString()}
                </div>
              </div>
            </div>
            <p className="text-center text-[10px] text-gray-700 font-bold uppercase tracking-[0.2em] mt-6 opacity-30">
              Cozy Pocket • End of List
            </p>
          </div>
        </div>
      </div>

      {/* 懸浮新增按鈕：固定於右下角 */}
      <div className="fixed bottom-8 right-8 z-50">
        <button 
          onClick={handleOpenModal}
          className="w-16 h-16 bg-cyan-500 text-black rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(34,211,238,0.4)] active:scale-90 transition-all hover:brightness-110"
        >
          <Plus size={36} strokeWidth={2.5} />
        </button>
      </div>

      {/* 底部漸層遮罩 */}
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
    </div>
  );
};

export default App;
