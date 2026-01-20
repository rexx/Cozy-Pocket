
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
      className="flex items-center gap-4 py-4 px-4 group active:bg-white/5 transition-colors cursor-pointer border-b border-white/5 last:border-0"
    >
      <div 
        className="w-12 h-12 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
        style={{ backgroundColor: category.color }}
      >
        <IconComp size={24} color="white" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <h3 className="text-gray-100 font-semibold truncate text-lg leading-tight">
            {transaction.name || category.name}
          </h3>
          <span className="text-red-400 font-bold text-xl ml-2">
            ${transaction.amount.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-gray-500 text-xs truncate pr-4 leading-normal">
            {subtextParts.join(' • ') || '無備註'}
          </p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500 whitespace-nowrap uppercase tracking-wider">
            {transaction.paymentMethod}
          </span>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;
