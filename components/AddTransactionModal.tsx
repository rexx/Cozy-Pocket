
import React, { useState } from 'react';
import { 
  X, Check, Camera, Star, Trash2,
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2,
  Hash, Calendar as CalendarIcon, Clock
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import { Transaction } from '../types';
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
  
  const [activeTab, setActiveTab] = useState('支出');
  const [amount, setAmount] = useState(editingTransaction?.amount.toString() || '0');
  const [categoryId, setCategoryId] = useState(editingTransaction?.categoryId || 'food');
  const [name, setName] = useState(editingTransaction?.name || ''); 
  const [note, setNote] = useState(editingTransaction?.note || ''); 
  const [merchant, setMerchant] = useState(editingTransaction?.merchant || ''); 
  const [tags, setTags] = useState(editingTransaction?.tags || '');
  const [paymentMethod, setPaymentMethod] = useState<string>(editingTransaction?.paymentMethod || '現金');
  const [currentDateStr, setCurrentDateStr] = useState(editingTransaction?.date || format(safeInitialDate, 'yyyy-MM-dd'));
  const [currentTime, setCurrentTime] = useState(editingTransaction?.time || format(new Date(), 'HH:mm'));

  const handleSubmit = () => {
    try {
      const parsedAmount = parseFloat(amount);
      if (isNaN(parsedAmount) || parsedAmount === 0) {
        alert("請輸入金額");
        return;
      }
      
      const data = {
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
        onUpdate({ ...data, id: editingTransaction.id });
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

  const tabs = ['支出', '收入', '轉帳', '應收', '應付'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#1e1e2d]">
        <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform">
          <X size={26} strokeWidth={2} />
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">{isEditing ? '修改紀錄' : '新增支出'}</h1>
        <button onClick={handleSubmit} className="p-2 text-cyan-400 active:scale-90 transition-transform">
          <Check size={26} strokeWidth={2.5} />
        </button>
      </div>

      {/* Tabs */}
      {!isEditing && (
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
                <div className="absolute bottom-0 left-4 right-4 h-1 bg-cyan-500 rounded-t-full shadow-[0_-2px_10px_rgba(34,211,238,0.3)]"></div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c]">
        {/* Category Grid */}
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

        {/* Input Area (Camera + Amount + Name) */}
        <div className="space-y-4">
          <div className="flex gap-4 items-end">
             <button className="w-16 h-16 rounded-2xl bg-[#252538] border border-white/5 flex items-center justify-center text-gray-600 active:bg-white/10 transition-colors flex-shrink-0">
                <Camera size={28} />
             </button>

             <div className="flex-1 space-y-4">
                <div className="relative group">
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] font-black text-gray-600 tracking-tighter bg-white/5 px-2 py-1 rounded">TWD</div>
                  <input 
                    type="number"
                    pattern="\d*"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    onFocus={() => amount === '0' && setAmount('')}
                    onBlur={() => amount === '' && setAmount('0')}
                    className="w-full bg-transparent border-b-2 border-white/5 focus:border-cyan-500 py-2 pl-12 text-right text-4xl font-light focus:outline-none text-white transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 border-b border-white/5 py-2 group focus-within:border-cyan-500/50 transition-colors">
                  <Star size={18} className="text-gray-600 group-focus-within:text-cyan-500" />
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

        {/* Info Grid (Payment, Merchant, Date, Time) */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={togglePaymentMethod} className="bg-[#252538] rounded-xl py-4 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 active:bg-[#2a2a3e] transition-colors">
            <span className="opacity-50">付款</span>
            <span className="text-white">{paymentMethod}</span>
          </button>
          
          <div className="bg-[#252538] rounded-xl py-3 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 group focus-within:border-cyan-500/30 transition-all">
            <span className="opacity-50 whitespace-nowrap">商家</span>
            <input 
              type="text"
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder="輸入商家..."
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

        {/* 標籤輸入區移動至備註框上方 */}
        <div className="flex items-center gap-3 px-2 py-1">
           <Hash size={18} className="text-cyan-500/60" />
           <input 
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="新增標籤 (例如：午餐、旅行)..."
              className="flex-1 bg-transparent text-base text-gray-400 focus:outline-none border-b border-white/5 py-1 placeholder-gray-700 font-medium"
            />
        </div>

        {/* Note Area */}
        <div className="relative bg-[#252538] rounded-2xl p-4 min-h-[140px] border border-white/5 group focus-within:border-cyan-500/30 transition-all">
          <textarea
            placeholder="點擊此處輸入備註..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-transparent resize-none text-base focus:outline-none h-full placeholder-gray-700 text-white font-light leading-relaxed"
          />
        </div>

        {/* Delete Button (Editing only) */}
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
