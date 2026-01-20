
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, isSameDay, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, Calendar as CalendarIcon, AlertCircle, X } from 'lucide-react';
import Calendar from './components/Calendar';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal from './components/AddTransactionModal';
import { Transaction } from './types';
import { INITIAL_TRANSACTIONS } from './constants';

// 錯誤顯示組件：用於偵錯 iOS/Preview 的 Uncaught Error
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 0, 17));
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('cozy-pocket-tx');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch (e) {
      return INITIAL_TRANSACTIONS;
    }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [capturedErrors, setCapturedErrors] = useState<string[]>([]);

  // 錯誤擷取邏輯
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
      .sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  }, [transactions, selectedDate]);

  const monthlyTotal = useMemo(() => {
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = endOfMonth(selectedDate);
    return transactions
      .filter(t => {
        const [y, m, d] = t.date.split('-').map(Number);
        const txDate = new Date(y, m - 1, d);
        return isWithinInterval(txDate, { start, end });
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions, selectedDate]);

  const addTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = { ...newTx, id: Date.now().toString() };
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
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-[#1a1c2c] overflow-hidden relative font-sans">
      <ErrorDisplay errors={capturedErrors} onClear={clearErrors} />
      
      <div className="sticky top-0 z-30 bg-[#1a1c2c] shadow-lg shadow-black/40">
        <Calendar 
          selectedDate={selectedDate} 
          onDateSelect={setSelectedDate}
          transactions={transactions}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-32 no-scrollbar">
        <div className="px-4 py-2 mt-4">
          <div className="bg-[#24273c] border border-white/5 rounded-2xl p-4 flex justify-between items-center shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                <CalendarIcon size={20} />
              </div>
              <span className="text-gray-300 font-medium">本月支出統計</span>
            </div>
            <span className="text-white font-bold text-2xl tracking-tight">
              ${monthlyTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-2 space-y-1">
          {dailyTransactions.length > 0 ? (
            dailyTransactions.map(tx => (
              <TransactionItem 
                key={tx.id} 
                transaction={tx} 
                onClick={handleEditItem}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-24 px-10 text-center">
              <div className="text-7xl mb-6 filter grayscale opacity-40">☕</div>
              <p className="text-gray-400 font-medium text-lg">今天還沒有任何紀錄</p>
              <p className="text-sm text-gray-500 mt-2">點擊下方按鈕，隨手記下一筆吧！</p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button 
          onClick={handleOpenModal}
          className="w-16 h-16 bg-cyan-500 text-black rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.4)] active:scale-95 transition-transform hover:brightness-110"
        >
          <Plus size={36} strokeWidth={2.5} />
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#1a1c2c] to-transparent pointer-events-none"></div>

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
