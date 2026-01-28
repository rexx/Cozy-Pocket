
import React, { useState, useRef, useLayoutEffect, useMemo } from 'react';
import { 
  X, Check, Star, Trash2, Plus, RotateCcw,
  MoreHorizontal, Calendar as CalendarIcon, Clock
} from 'lucide-react';
import * as Icons from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import { Transaction, TransactionType } from '../types';
import { format, isValid } from 'date-fns';

const IconMap: Record<string, any> = {
  ...Icons,
  Back: RotateCcw,
  Add: Plus
};

// 定義格狀選單項目的統一介面
interface GridItem {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

interface AddTransactionModalProps {
  onClose: () => void;
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  onUpdate?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  initialDate: Date;
  editingTransaction?: Transaction | null;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ 
  onClose, 
  onAdd, 
  onUpdate,
  onDelete,
  initialDate, 
  editingTransaction 
}) => {
  const isEditing = !!editingTransaction;
  const safeInitialDate = (initialDate && isValid(initialDate)) ? initialDate : new Date();
  
  const amountInputRef = useRef<HTMLInputElement>(null);
  
  const [activeTab, setActiveTab] = useState<TransactionType>(editingTransaction?.type || '支出');
  const [amount, setAmount] = useState(editingTransaction?.amount.toString() || '');
  const [isSubView, setIsSubView] = useState(isEditing && editingTransaction?.type === '支出');
  
  const categoriesToDisplay = useMemo(() => {
    return activeTab === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  }, [activeTab]);

  const [categoryId, setCategoryId] = useState(() => {
    if (editingTransaction) return editingTransaction.categoryId;
    return activeTab === '支出' ? 'food' : 'salary';
  });

  const [subCategoryId, setSubCategoryId] = useState(() => {
    if (editingTransaction) return editingTransaction.subCategoryId;
    return undefined;
  });

  const [name, setName] = useState(editingTransaction?.name || ''); 
  const [note, setNote] = useState(editingTransaction?.note || ''); 
  const [merchant, setMerchant] = useState(editingTransaction?.merchant || ''); 
  const [tags, setTags] = useState(editingTransaction?.tags || '');
  const [paymentMethod, setPaymentMethod] = useState<string>(editingTransaction?.paymentMethod || '現金');
  const [currentDateStr, setCurrentDateStr] = useState(editingTransaction?.date || format(safeInitialDate, 'yyyy-MM-dd'));
  const [currentTime, setCurrentTime] = useState(editingTransaction?.time || format(new Date(), 'HH:mm'));

  useLayoutEffect(() => {
    if (amountInputRef.current) {
      amountInputRef.current.focus();
    }
  }, []);

  const handleTabChange = (tab: TransactionType) => {
    setActiveTab(tab);
    setIsSubView(false);
    if (!isEditing) {
      const defaultId = tab === '支出' ? 'food' : 'salary';
      setCategoryId(defaultId);
      setSubCategoryId(undefined);
    }
  };

  const handleMainCategoryClick = (id: string) => {
    setCategoryId(id);
    if (activeTab === '支出') {
      setIsSubView(true);
    } else {
      setSubCategoryId(undefined);
    }
  };

  const handleSubCategoryClick = (id: string) => {
    setSubCategoryId(id);
  };

  const handleBackToMain = () => {
    setIsSubView(false);
  };

  const handleSubmit = () => {
    try {
      const parsedAmount = parseFloat(amount || '0');
      if (isNaN(parsedAmount) || parsedAmount === 0) {
        alert("請輸入金額");
        return;
      }
      
      const data: Omit<Transaction, 'id'> = {
        type: activeTab,
        amount: parsedAmount,
        categoryId,
        subCategoryId,
        name: name || '',
        note,
        merchant,
        paymentMethod,
        date: currentDateStr,
        time: currentTime,
        tags
      };

      if (isEditing && onUpdate && editingTransaction) {
        onUpdate({ ...data, id: editingTransaction.id } as Transaction);
      } else {
        onAdd(data);
      }
      onClose();
    } catch (err) {
      console.error("Submit Error:", err);
      alert("儲存失敗: " + (err as Error).message);
    }
  };

  const handleDelete = () => {
    if (isEditing && onDelete && editingTransaction) {
      if (confirm('確定要刪除這筆紀錄嗎？')) {
        onDelete(editingTransaction.id);
        onClose();
      }
    }
  };

  const togglePaymentMethod = () => {
    const methods = ['現金', '信用卡', '電子支付', '轉帳'];
    const currentIndex = methods.indexOf(paymentMethod);
    setPaymentMethod(methods[(currentIndex + 1) % methods.length]);
  };

  const tabs: TransactionType[] = ['支出', '收入'];

  const currentMainCat = useMemo(() => {
    return EXPENSE_CATEGORIES.find(c => c.id === categoryId);
  }, [categoryId]);

  const renderGrid = () => {
    if (activeTab === '支出' && isSubView && currentMainCat) {
      const items: GridItem[] = [
        { id: 'back', name: '返回', icon: 'Back', color: 'rgba(255,255,255,0.08)' },
        ...(currentMainCat.subcategories || []),
        { id: 'add', name: '新增', icon: 'Add', color: 'rgba(255,255,255,0.08)' }
      ];

      return (
        <div className="grid grid-cols-5 gap-x-2 gap-y-6">
          {items.map((item, idx) => {
            const isSelected = subCategoryId === item.id;
            const IconComp = IconMap[item.icon] || MoreHorizontal;
            const isControl = item.id === 'back' || item.id === 'add';
            const bgColor = isControl ? (item.color || 'rgba(255,255,255,0.08)') : currentMainCat.color;

            return (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => {
                  if (item.id === 'back') handleBackToMain();
                  else if (item.id === 'add') { /* 新增邏輯 */ }
                  else handleSubCategoryClick(item.id);
                }}
                className="flex flex-col items-center gap-2 group transition-all"
              >
                <div 
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isSelected ? 'scale-110 shadow-lg ring-2 ring-white/20' : ''
                  }`}
                  style={{ 
                    backgroundColor: bgColor,
                    opacity: 1 
                  }}
                >
                  <IconComp size={24} color="white" strokeWidth={2.5} />
                </div>
                <span className={`text-[11px] font-bold ${isSelected || item.id === 'back' ? 'text-white' : 'text-gray-400'} text-center truncate w-full px-1`}>
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-5 gap-x-2 gap-y-6">
        {categoriesToDisplay.map(cat => {
          const IconComp = IconMap[cat.icon] || MoreHorizontal;
          const isSelected = categoryId === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => handleMainCategoryClick(cat.id)}
              className="flex flex-col items-center gap-2 group"
            >
              <div 
                className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                  isSelected ? 'scale-110 shadow-lg ring-2 ring-white/20' : ''
                }`}
                style={{ backgroundColor: cat.color, opacity: 1 }}
              >
                <IconComp size={24} color="white" strokeWidth={2.5} />
              </div>
              <span className={`text-[11px] font-bold ${isSelected ? 'text-white' : 'text-gray-400'} text-center truncate w-full px-1`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#1e1e2d]">
          <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform">
            <X size={26} strokeWidth={2} />
          </button>
          <h1 className="text-lg font-bold text-white tracking-wide">{isEditing ? `修改${activeTab}` : '新增項目'}</h1>
          <button onClick={handleSubmit} className="p-2 text-cyan-400 active:scale-90 transition-transform">
            <Check size={26} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex bg-[#1e1e2d] border-b border-white/5 no-scrollbar px-4">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-4 text-xs font-bold tracking-widest transition-all relative ${
                activeTab === tab ? 'text-white' : 'text-gray-500'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className={`absolute bottom-0 left-4 right-4 h-1 rounded-t-full shadow-lg ${
                  activeTab === '收入' ? 'bg-rose-500 shadow-rose-500/30' : 'bg-emerald-500 shadow-emerald-500/30'
                }`}></div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-8 space-y-4 pb-32 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c] overscroll-contain">
        
        {/* 分類選擇區 */}
        <div className="px-2 min-h-[180px] mb-6">
          {renderGrid()}
        </div>

        {/* 併排輸入區 Row 1: 支付 / 金額 */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={togglePaymentMethod} 
            className="bg-[#252538] rounded-2xl h-14 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 active:bg-[#2a2a3e] transition-colors shadow-lg min-w-0"
          >
            <span className="opacity-50 flex-shrink-0">支付方式</span>
            <span className="text-white truncate ml-2 text-right flex-1">{paymentMethod}</span>
          </button>
          
          <div className="flex items-center bg-[#252538] rounded-2xl h-14 px-4 border border-white/5 group focus-within:border-white/20 transition-all shadow-lg min-w-0 overflow-hidden">
            <input 
              ref={amountInputRef}
              type="number"
              pattern="\d*"
              inputMode="decimal"
              placeholder="輸入金額"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`w-full min-w-0 bg-transparent text-right text-lg font-black focus:outline-none placeholder-gray-600 ${activeTab === '收入' ? 'text-rose-400' : 'text-emerald-400'}`}
            />
          </div>
        </div>

        {/* 併排輸入區 Row 2: 商家 / 名稱 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#252538] rounded-2xl h-14 px-4 flex items-center border border-white/5 group focus-within:border-white/20 transition-all shadow-lg min-w-0 overflow-hidden">
            <input 
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="商家"
              className="bg-transparent text-white text-right focus:outline-none w-full min-w-0 font-bold placeholder-gray-700 text-sm"
            />
          </div>
          
          <div className="bg-[#252538] rounded-2xl h-14 px-4 flex items-center border border-white/5 group focus-within:border-white/20 transition-all shadow-lg min-w-0 overflow-hidden">
            <input 
              type="text"
              placeholder="名稱"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-w-0 bg-transparent text-right text-sm font-bold focus:outline-none placeholder-gray-600 text-white"
            />
          </div>
        </div>

        {/* 併排輸入區 Row 3: 日期 / 時間 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between bg-[#252538] h-14 px-4 rounded-2xl border border-white/5 active:bg-[#2a2a3e] relative shadow-lg min-w-0 overflow-hidden">
            <CalendarIcon size={16} className="text-gray-500 flex-shrink-0" />
            <input 
              type="date" 
              value={currentDateStr}
              onChange={(e) => setCurrentDateStr(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none text-right w-full min-w-0 cursor-pointer ml-2"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          <div className="flex items-center justify-between bg-[#252538] h-14 px-4 rounded-2xl border border-white/5 active:bg-[#2a2a3e] relative shadow-lg min-w-0 overflow-hidden">
            <Clock size={16} className="text-gray-500 flex-shrink-0" />
            <input 
              type="time" 
              value={currentTime}
              onChange={(e) => setCurrentTime(e.target.value)}
              className="bg-transparent text-white text-xs font-bold focus:outline-none text-right w-full min-w-0 cursor-pointer ml-2"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        {/* 備註輸入區 */}
        <div className="relative bg-[#252538] rounded-2xl p-5 min-h-[140px] border border-white/5 group focus-within:border-cyan-500/30 transition-all shadow-lg">
          <textarea
            placeholder="點擊輸入備註..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-transparent resize-none text-sm focus:outline-none h-full placeholder-gray-700 text-white font-light leading-relaxed"
          />
        </div>

        {isEditing && (
          <button 
            onClick={handleDelete}
            className="w-full py-5 text-red-500 text-sm font-bold flex items-center justify-center gap-2 bg-red-500/5 rounded-2xl border border-red-500/10 active:bg-red-500/20 transition-all mt-4"
          >
            <Trash2 size={20} />
            <span>刪除這筆紀錄</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AddTransactionModal;
