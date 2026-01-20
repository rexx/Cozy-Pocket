
import React, { useState, useEffect, useMemo } from 'react';
import { format, isSameDay, endOfMonth, isWithinInterval } from 'date-fns';
import { Plus, Calendar as CalendarIcon } from 'lucide-react';
import Calendar from './components/Calendar';
import TransactionItem from './components/TransactionItem';
import AddTransactionModal from './components/AddTransactionModal';
import { Transaction } from './types';
import { INITIAL_TRANSACTIONS } from './constants';

const App: React.FC = () => {
  // Use explicit local date to avoid timezone issues with string constructor
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(2026, 0, 17));
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    try {
      const saved = localStorage.getItem('cozy-pocket-tx');
      return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
    } catch (e) {
      console.error("Failed to parse transactions from localStorage", e);
      return INITIAL_TRANSACTIONS;
    }
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    localStorage.setItem('cozy-pocket-tx', JSON.stringify(transactions));
  }, [transactions]);

  const dailyTransactions = useMemo(() => {
    return transactions
      .filter(t => {
        // Replacing parseISO with native local Date logic to fix missing export error
        const [y, m, d] = t.date.split('-').map(Number);
        const txDate = new Date(y, m - 1, d);
        return isSameDay(txDate, selectedDate);
      })
      .sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  }, [transactions, selectedDate]);

  const monthlyTotal = useMemo(() => {
    // Replacing startOfMonth with native Date logic to fix missing export error
    const start = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const end = endOfMonth(selectedDate);
    return transactions
      .filter(t => {
        // Replacing parseISO with native local Date logic
        const [y, m, d] = t.date.split('-').map(Number);
        const txDate = new Date(y, m - 1, d);
        return isWithinInterval(txDate, { start, end });
      })
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [transactions, selectedDate]);

  const addTransaction = (newTx: Omit<Transaction, 'id'>) => {
    const transaction: Transaction = {
      ...newTx,
      id: Date.now().toString()
    };
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTransaction(null);
  };

  return (
    <div className="flex flex-col h-screen max-w-lg mx-auto bg-[#1a1c2c] overflow-hidden relative">
      <div className="sticky top-0 z-30 bg-[#1a1c2c] shadow-md shadow-black/20">
        <Calendar 
          selectedDate={selectedDate} 
          onDateSelect={setSelectedDate}
          transactions={transactions}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-32">
        <div className="px-4 py-2 mt-4">
          <div className="bg-[#24273c] rounded-2xl p-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                <CalendarIcon size={20} />
              </div>
              <span className="text-gray-200 font-medium">每月統計</span>
            </div>
            <span className="text-red-400 font-bold text-xl">
              ${monthlyTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="mt-2">
          {dailyTransactions.length > 0 ? (
            dailyTransactions.map(tx => (
              <TransactionItem 
                key={tx.id} 
                transaction={tx} 
                onClick={handleEditItem}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-30">
              <div className="text-6xl mb-4">🌙</div>
              <p className="text-gray-400 font-medium">這天還沒有紀錄唷</p>
              <p className="text-sm text-gray-500 mt-1">點擊下方按鈕開始記帳吧！</p>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40">
        <button 
          onClick={handleOpenModal}
          className="w-16 h-16 bg-[#1a1c2c] border-[3px] border-cyan-500 rounded-full flex items-center justify-center text-cyan-500 shadow-2xl shadow-cyan-500/30 active:scale-90 transition-transform hover:bg-cyan-500 hover:text-black"
        >
          <Plus size={32} />
        </button>
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-16 bg-black/40 backdrop-blur-lg border-t border-white/5 pointer-events-none"></div>

      {isModalOpen && (
        <AddTransactionModal 
          initialDate={selectedDate}
          editingTransaction={editingTransaction}
          onClose={handleCloseModal}
          onAdd={addTransaction}
          onUpdate={updateTransaction}
          onDelete={deleteTransaction}
        />
      )}

      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;
