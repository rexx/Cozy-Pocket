
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
  const isIncome = transaction.type === '收入';

  // 圖示選擇邏輯
  const iconName = (!isIncome && subCategory) ? subCategory.icon : category.icon;
  const IconComp = IconMap[iconName] || Icons.MoreHorizontal;

  // 標題顯示邏輯：名稱 > 商家 > 子類別 > 分類
  let title = '';
  if (transaction.name) {
    title = transaction.name;
  } else if (transaction.merchant) {
    title = transaction.merchant;
  } else if (subCategory) {
    title = subCategory.name;
  } else {
    title = category.name;
  }

  // 副標題顯示邏輯：收納所有「非標題」且「有內容」的資訊
  const displayCategoryName = subCategory 
    ? `${category.name} · ${subCategory.name}`
    : category.name;

  const subtitleParts: string[] = [];
  
  // 如果標題不是名稱，且名稱有值，放入副標題
  if (title !== transaction.name && transaction.name) subtitleParts.push(transaction.name);
  
  // 如果標題不是商家，且商家有值，放入副標題
  if (title !== transaction.merchant && transaction.merchant) subtitleParts.push(transaction.merchant);
  
  // 如果標題不是分類/子類別名稱，放入分類資訊
  if (title !== subCategory?.name && title !== category.name) {
    subtitleParts.push(displayCategoryName);
  } else if (subCategory && title === subCategory.name) {
    // 如果標題是子類別，副標題放父類別名稱
    subtitleParts.push(category.name);
  }

  if (transaction.note) subtitleParts.push(transaction.note);
  if (transaction.tags) subtitleParts.push(`#${transaction.tags}`);

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
                {title}
             </h3>
          </div>
          <span className={`font-black text-lg ml-2 tabular-nums ${isIncome ? 'text-rose-400' : 'text-emerald-400'}`}>
            ${transaction.amount.toLocaleString()}
          </span>
        </div>
        
        <div className="flex justify-between items-center">
          <p className="text-gray-500 text-xs truncate pr-4 font-medium">
            {subtitleParts.join(' · ') || '無詳細說明'}
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
