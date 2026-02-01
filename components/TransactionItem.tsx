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
  const subtitleParts: string[] = [];
  
  // 1. 名稱 (若非標題)
  if (transaction.name && title !== transaction.name) {
    subtitleParts.push(transaction.name);
  }
  
  // 2. 商家 (若非標題)
  if (transaction.merchant && title !== transaction.merchant) {
    subtitleParts.push(transaction.merchant);
  }
  
  // 3. 類別資訊 (只用小類別，且若小類別非標題才顯示)
  if (subCategory) {
    if (title !== subCategory.name) {
      subtitleParts.push(subCategory.name); // 不再加入父類別名稱
    }
  } else {
    // 若無子類別（如收入類別），且標題不是分類名稱，才顯示分類名稱
    if (title !== category.name) {
      subtitleParts.push(category.name);
    }
  }

  // 4. 備註與標籤
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
        {/* 第一行：標題 + 時間 */}
        <div className="flex justify-between items-center mb-0.5">
          <h3 className="text-gray-100 font-bold truncate text-base tracking-tight leading-tight">
            {title}
          </h3>
          {transaction.time && (
            <span className="text-[10px] text-gray-600 font-bold tabular-nums flex-shrink-0 ml-4">
              {transaction.time}
            </span>
          )}
        </div>
        
        {/* 第二行：副標題 + (支付方式與金額) */}
        <div className="flex justify-between items-center">
          <p className="text-gray-500 text-xs truncate pr-4 font-medium">
            {subtitleParts.join(' · ') || '無詳細說明'}
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 font-black uppercase tracking-widest border border-white/5">
              {transaction.paymentMethod}
            </span>
            <span className={`font-black text-lg tabular-nums ${isIncome ? 'text-rose-400' : 'text-emerald-400'}`}>
              ${transaction.amount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionItem;