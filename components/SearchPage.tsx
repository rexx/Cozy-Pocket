import React from 'react';
import { ArrowLeft, Search as SearchIcon, X } from 'lucide-react';
import { format } from 'date-fns';
import { Transaction } from '../types';
import { toEpochMillis } from '../time';
import TransactionItem from './TransactionItem';
import PageHeader from './PageHeader';

interface SearchPageProps {
  searchQuery: string;
  filteredTransactions: Transaction[];
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  onBack: () => void;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onTransactionClick: (transaction: Transaction) => void;
}

const SearchPage: React.FC<SearchPageProps> = ({
  searchQuery,
  filteredTransactions,
  searchInputRef,
  onBack,
  onQueryChange,
  onClearQuery,
  onTransactionClick,
}) => {
  return (
    <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
      <div className="flex-none z-30 bg-[#1a1c2c] shadow-lg shadow-black/40">
        <PageHeader
          title="搜尋"
          leftAction={<ArrowLeft size={26} />}
          onLeftAction={onBack}
        />
        <div className="px-4 pb-4 pt-3">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="搜尋名稱、幣別、商家、標籤..."
              value={searchQuery}
              onChange={(e) => onQueryChange(e.target.value)}
              className="w-full bg-[#252538] text-white text-sm font-bold py-3 pl-10 pr-4 rounded-2xl border border-cyan-500/20 focus:outline-none focus:border-cyan-500 transition-all placeholder-gray-600"
            />
            <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            {searchQuery && <button onClick={onClearQuery} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={16} /></button>}
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar overscroll-contain">
        <div className="mt-2 min-h-[calc(100%+1px)] space-y-1">
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
                  <TransactionItem transaction={tx} onClick={onTransactionClick} />
                </div>
              ))}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-10 text-center opacity-40"><div className="text-6xl mb-4">🙊</div><p className="text-gray-400 font-medium">找不到符合「{searchQuery}」的紀錄</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
