
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  X, Check, Camera, Star, Trash2,
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2,
  Hash, Calendar as CalendarIcon, Clock
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import { Transaction, TransactionType } from '../types';
import { format, isValid } from 'date-fns';

const IconMap: Record<string, any> = {
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2
};

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
  // 如果是新增，預設為空字串，避免 0 -> 空字串的轉換導致重新渲染中斷鍵盤
  const [amount, setAmount] = useState(editingTransaction?.amount.toString() || '');
  const [categoryId, setCategoryId] = useState(editingTransaction?.categoryId || 'food');
  const [name, setName] = useState(editingTransaction?.name || ''); 
  const [note, setNote] = useState(editingTransaction?.note || ''); 
  const [merchant, setMerchant] = useState(editingTransaction?.merchant || ''); 
  const [tags, setTags] = useState(editingTransaction?.tags || '');
  const [paymentMethod, setPaymentMethod] = useState<string>(editingTransaction?.paymentMethod || '現金');
  const [currentDateStr, setCurrentDateStr] = useState(editingTransaction?.date || format(safeInitialDate, 'yyyy-MM-dd'));
  const [currentTime, setCurrentTime] = useState(editingTransaction?.time || format(new Date(), 'HH:mm'));

  // iOS Safari 強制要求同步聚焦。在 React 組件掛載時立即呼叫。
  useLayoutEffect(() => {
    if (amountInputRef.current) {
      // 雙重嘗試：立即聚焦並觸發點擊，以最大限度模擬使用者行為
      amountInputRef.current.focus();
      // 對於某些 iOS 版本，click() 有助於喚醒鍵盤
      amountInputRef.current.click();
    }
  }, []);

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
        name: name || '未命名項目',
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
              onClick={() => setActiveTab(tab)}
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

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c] overscroll-contain">
        <div className="grid grid-cols-5 gap-x-2 gap-y-6">
          {CATEGORIES.map(cat => {
            const IconComp = IconMap[cat.icon];
            const isSelected = categoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className="flex flex-col items-center gap-2 group"
              >
                <div 
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
                    isSelected ? 'scale-110 shadow-lg ring-2 ring-white/20' : 'opacity-40 grayscale-[0.5]'
                  }`}
                  style={{ backgroundColor: isSelected ? cat.color : '#252538' }}
                >
                  <IconComp size={24} color={isSelected ? "white" : cat.color} strokeWidth={2.5} />
                </div>
                <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          <div className="flex gap-4 items-end">
             <button className="w-16 h-16 rounded-2xl bg-[#252538] border border-white/5 flex items-center justify-center text-gray-600 active:bg-white/10 transition-colors flex-shrink-0">
                <Camera size={28} />
             </button>

             <div className="flex-1 space-y-4">
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 tracking-tighter bg-white/5 px-2 py-1 rounded">TWD</div>
                  <input 
                    ref={amountInputRef}
                    autoFocus
                    type="number"
                    pattern="\d*"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full bg-transparent border-b-2 border-white/5 py-2 pl-12 text-right text-4xl font-light focus:outline-none transition-all ${
                      activeTab === '收入' ? 'focus:border-rose-500 text-rose-400' : 'focus:border-emerald-500 text-emerald-400'
                    }`}
                  />
                </div>

                <div className={`flex items-center gap-3 border-b border-white/5 py-2 group transition-colors ${
                   activeTab === '收入' ? 'focus-within:border-rose-500/50' : 'focus-within:border-emerald-500/50'
                }`}>
                  <Star size={18} className={`text-gray-600 ${activeTab === '收入' ? 'group-focus-within:text-rose-500' : 'group-focus-within:text-emerald-500'}`} />
                  <input 
                    type="text"
                    placeholder="輸入項目名稱..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="flex-1 bg-transparent text-base focus:outline-none placeholder-gray-700 text-white font-medium"
                  />
                </div>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={togglePaymentMethod} className="bg-[#252538] rounded-xl py-4 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 active:bg-[#2a2a3e] transition-colors">
            <span className="opacity-50">方式</span>
            <span className="text-white">{paymentMethod}</span>
          </button>
          
          <div className="bg-[#252538] rounded-xl py-3 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 group focus-within:border-cyan-500/30 transition-all">
            <span className="opacity-50 whitespace-nowrap">商家</span>
            <input 
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="輸入..."
              className="bg-transparent text-white text-right focus:outline-none w-full ml-2 font-bold placeholder-gray-700 text-sm"
            />
          </div>

          <div className="flex items-center justify-between bg-[#252538] p-4 rounded-xl border border-white/5 active:bg-[#2a2a3e] relative">
            <CalendarIcon size={16} className="text-gray-500" />
            <input 
              type="date" 
              value={currentDateStr}
              onChange={(e) => setCurrentDateStr(e.target.value)}
              className="bg-transparent text-white text-sm font-bold focus:outline-none text-right flex-1 cursor-pointer"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          <div className="flex items-center justify-between bg-[#252538] p-4 rounded-xl border border-white/5 active:bg-[#2a2a3e] relative">
            <Clock size={16} className="text-gray-500" />
            <input 
              type="time" 
              value={currentTime}
              onChange={(e) => setCurrentTime(e.target.value)}
              className="bg-transparent text-white text-sm font-bold focus:outline-none text-right flex-1 cursor-pointer"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 px-2 py-1">
           <Hash size={18} className={activeTab === '收入' ? 'text-rose-500/60' : 'text-emerald-500/60'} />
           <input 
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="標籤 (例如：獎金、旅行)..."
              className="flex-1 bg-transparent text-base text-gray-400 focus:outline-none border-b border-white/5 py-1 placeholder-gray-700 font-medium"
            />
        </div>

        <div className="relative bg-[#252538] rounded-2xl p-4 min-h-[140px] border border-white/5 group focus-within:border-cyan-500/30 transition-all">
          <textarea
            placeholder="點擊此處輸入備註..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-transparent resize-none text-base focus:outline-none h-full placeholder-gray-700 text-white font-light leading-relaxed"
          />
        </div>

        {isEditing && (
          <button 
            onClick={handleDelete}
            className="w-full py-5 text-red-500 text-sm font-bold flex items-center justify-center gap-2 bg-red-500/5 rounded-2xl border border-red-500/10 active:bg-red-500/20 transition-all"
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
