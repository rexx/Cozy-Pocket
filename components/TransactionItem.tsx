
import React from 'react';
import { Transaction } from '../types';
import { CATEGORIES } from '../constants';
import * as Icons from 'lucide-react';

const IconMap: Record<string, any> = {
  ...Icons
};

interface TransactionItemProps {
  transaction: Transaction;
  onClick: (transaction: Transaction) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onClick }) => {
  const category = CATEGORIES.find(c => c.id === transaction.categoryId) || CATEGORIES[CATEGORIES.length - 1];
  const subCategory = category.subcategories?.find(s => s.id === transaction.subCategoryId);
  const IconComp = IconMap[category.icon] || Icons.MoreHorizontal;
  const isIncome = transaction.type === '收入';

  const subtextParts = [
    transaction.merchant,
    transaction.note,
    transaction.tags ? `#${transaction.tags}` : null
  ].filter(Boolean);

  const displayCategoryName = subCategory 
    ? `${category.name} · ${subCategory.name}`
    : category.name;

  return (
    <div 
      onClick={() => onClick(transaction)}
      className="flex items-center gap-4 py-4 px-5 active:bg-white/5 transition-all duration-200 cursor-pointer border-b border-white/5 last:border-0 group"
    >
      <div 
        className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg transform group-active:scale-90 transition-transform flex-shrink-0"
        style={{ backgroundColor: category.color }}
      >
        <IconComp size={22} color="white" strokeWidth={2.5} />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center mb-0.5">
          <div className="flex flex-col truncate">
             <h3 className="text-gray-100 font-bold truncate text-base tracking-tight leading-tight">
                {transaction.name || displayCategoryName}
             </h3>
             {transaction.name && (
               <span className="text-[10px] text-gray-500 font-medium">
                 {displayCategoryName}
               </span>
             )}
          </div>
          <span className={`font-black text-lg ml-2 tabular-nums ${isIncome ? 'text-rose-400' : 'text-emerald-400'}`}>
            ${transaction.amount.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-gray-500 text-xs truncate pr-4 font-medium">
            {subtextParts.join(' · ') || '無詳細說明'}
          </p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 font-black uppercase tracking-widest border border-white/5">
            {transaction.paymentMethod}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
