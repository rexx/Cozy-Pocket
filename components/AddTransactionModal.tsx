import React, { useState } from 'react';
import { 
  X, Check, Camera, Star, Sparkles, Loader2, Trash2,
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2,
  Hash
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import { Transaction } from '../types';
import { parseTransactionWithAI } from '../services/geminiService';
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
  const [projectName, setProjectName] = useState(editingTransaction?.projectName || '無專案');
  const [paymentMethod, setPaymentMethod] = useState<string>(editingTransaction?.paymentMethod || '現金');
  const [isAiLoading, setIsAiLoading] = useState(false);
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
        projectName,
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

  const handleAiParse = async () => {
    const textToParse = name || merchant || note;
    if (!textToParse.trim()) return;
    
    setIsAiLoading(true);
    try {
      const result = await parseTransactionWithAI(textToParse);
      if (result) {
        if (result.amount) setAmount(result.amount.toString());
        if (result.categoryId) setCategoryId(result.categoryId);
        if (result.note) setName(result.note);
        if (result.merchant) setMerchant(result.merchant);
        if (result.paymentMethod) setPaymentMethod(result.paymentMethod);
      }
    } catch (err) {
      console.error("AI Parse Error:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const togglePaymentMethod = () => {
    const methods = ['現金', '信用卡', '電子支付', '轉帳'];
    const currentIndex = methods.indexOf(paymentMethod);
    setPaymentMethod(methods[(currentIndex + 1) % methods.length]);
  };

  const tabs = ['支出', '收入', '轉帳', '應收', '應付'];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden">
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#1e1e2d]">
        <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform">
          <X size={26} strokeWidth={2} />
        </button>
        <h1 className="text-lg font-bold text-white tracking-wide">{isEditing ? '修改紀錄' : '新增支出'}</h1>
        <button onClick={handleSubmit} className="p-2 text-cyan-400 active:scale-90 transition-transform">
          <Check size={26} strokeWidth={2.5} />
        </button>
      </div>

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

      <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 pb-32 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c]">
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
             
             <button className="w-16 h-16 rounded-2xl bg-[#252538] border border-white/5 flex items-center justify-center text-gray-600 active:bg-white/10 transition-colors">
                <Camera size={28} />
             </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={togglePaymentMethod} className="bg-[#252538] rounded-xl py-4 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 active:bg-[#2a2a3e]">
            <span className="opacity-50">付款</span>
            <span className="text-white">{paymentMethod}</span>
          </button>
          
          <button className="bg-[#252538] rounded-xl py-4 px-4 text-left text-xs font-bold text-gray-400 flex items-center justify-between border border-white/5 active:bg-[#2a2a3e]">
            <span className="opacity-50">專案</span>
            <span className="text-white truncate max-w-[60px]">{projectName}</span>
          </button>

          {/* 直接顯示原生日期選擇器 - 確保字體為 16px 以防 iOS 縮放 */}
          <div className="flex flex-col gap-1 bg-[#252538] p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-500 font-bold uppercase">日期</span>
            <input 
              type="date" 
              value={currentDateStr}
              onChange={(e) => setCurrentDateStr(e.target.value)}
              className="bg-transparent text-white text-base focus:outline-none w-full"
              style={{ colorScheme: 'dark' }}
            />
          </div>

          {/* 直接顯示原生時間選擇器 - 確保字體為 16px 以防 iOS 縮放 */}
          <div className="flex flex-col gap-1 bg-[#252538] p-3 rounded-xl border border-white/5">
            <span className="text-[10px] text-gray-500 font-bold uppercase">時間</span>
            <input 
              type="time" 
              value={currentTime}
              onChange={(e) => setCurrentTime(e.target.value)}
              className="bg-transparent text-white text-base focus:outline-none w-full"
              style={{ colorScheme: 'dark' }}
            />
          </div>
        </div>

        <div className="relative bg-[#252538] rounded-2xl p-4 min-h-[140px] border border-white/5 group focus-within:border-cyan-500/30 transition-all">
          <textarea
            placeholder="點擊此處輸入備註，或使用 AI 助手解析..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-transparent resize-none text-base focus:outline-none h-full placeholder-gray-700 text-white font-light leading-relaxed"
          />
          <button 
            onClick={handleAiParse}
            disabled={isAiLoading || (!name.trim() && !note.trim())}
            className={`absolute bottom-3 right-3 p-3 rounded-xl transition-all ${
              (name.trim() || note.trim()) ? 'bg-cyan-500 text-black opacity-100 shadow-lg' : 'bg-gray-800 text-gray-600 opacity-50 pointer-events-none'
            } active:scale-90`}
          >
            {isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
        </div>

        <div className="flex items-center gap-3 px-2">
           <Hash size={16} className="text-gray-600" />
           <input 
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="新增標籤..."
              className="flex-1 bg-transparent text-base text-gray-400 focus:outline-none border-b border-white/5 py-1"
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