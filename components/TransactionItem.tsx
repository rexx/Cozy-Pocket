
import React from 'react';
import { Transaction } from '../types';
import { CATEGORIES } from '../constants';
import { 
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2 
} from 'lucide-react';

const IconMap: Record<string, any> = {
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2
};

interface TransactionItemProps {
  transaction: Transaction;
  onClick: (transaction: Transaction) => void;
}

const TransactionItem: React.FC<TransactionItemProps> = ({ transaction, onClick }) => {
  const category = CATEGORIES.find(c => c.id === transaction.categoryId) || CATEGORIES[CATEGORIES.length - 1];
  const IconComp = IconMap[category.icon] || Gift;

  const subtextParts = [
    transaction.merchant,
    transaction.note,
    transaction.tags ? `#${transaction.tags}` : null
  ].filter(Boolean);

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
          <h3 className="text-gray-100 font-bold truncate text-base tracking-tight leading-tight">
            {transaction.name || category.name}
          </h3>
          <span className="text-white font-black text-lg ml-2 tabular-nums">
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
