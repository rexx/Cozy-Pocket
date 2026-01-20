
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Check, Camera, Plus, Star, Sparkles, Loader2, Trash2,
  Utensils, Car, Hospital, Home, Users, User, Building, Gift, Mic2, Flower2,
  Hash
} from 'lucide-react';
import { CATEGORIES } from '../constants';
import { Transaction } from '../types';
import { parseTransactionWithAI } from '../services/geminiService';
import { format } from 'date-fns';

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
  const [currentDateStr, setCurrentDateStr] = useState(editingTransaction?.date || format(initialDate, 'yyyy-MM-dd'));
  const [currentTime, setCurrentTime] = useState(editingTransaction?.time || format(new Date(), 'HH:mm'));
  
  const [showTagInput, setShowTagInput] = useState(!!editingTransaction?.tags);
  const [isEditingMerchant, setIsEditingMerchant] = useState(false);

  const dateInputRef = useRef<HTMLInputElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (parseFloat(amount) === 0) return;
    
    const data = {
      amount: parseFloat(amount),
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
    const result = await parseTransactionWithAI(textToParse);
    if (result) {
      if (result.amount) setAmount(result.amount.toString());
      if (result.categoryId) setCategoryId(result.categoryId);
      if (result.note) {
          setName(result.note);
      }
      if (result.merchant) setMerchant(result.merchant);
      if (result.paymentMethod) setPaymentMethod(result.paymentMethod);
    }
    setIsAiLoading(false);
  };

  const togglePaymentMethod = () => {
    const methods = ['現金', '信用卡', '電子支付', '轉帳'];
    const currentIndex = methods.indexOf(paymentMethod);
    setPaymentMethod(methods[(currentIndex + 1) % methods.length]);
  };

  const tabs = ['支出', '收入', '轉帳', '應收款項', '應付款項', '系統'];
  
  // Replacing parse with native Date logic for yyyy-MM-dd string
  const [y, m, d] = currentDateStr.split('-').map(Number);
  const displayDate = new Date(y, m - 1, d);
  const weekDayStr = `週${['日','一','二','三','四','五','六'][displayDate.getDay()]}`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1e1e2d] animate-slide-up select-none">
      <input 
        type="date" 
        ref={dateInputRef}
        value={currentDateStr}
        onChange={(e) => setCurrentDateStr(e.target.value)}
        className="absolute opacity-0 pointer-events-none"
      />
      <input 
        type="time" 
        ref={timeInputRef}
        value={currentTime}
        onChange={(e) => setCurrentTime(e.target.value)}
        className="absolute opacity-0 pointer-events-none"
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform">
          <X size={28} strokeWidth={1.5} />
        </button>
        <h1 className="text-xl font-medium text-white">{isEditing ? '編輯記錄' : '新增記錄'}</h1>
        <button onClick={handleSubmit} className="p-2 text-cyan-400 active:scale-90 transition-transform">
          <Check size={28} strokeWidth={1.5} />
        </button>
      </div>

      {/* Tabs */}
      {!isEditing && (
        <div className="flex overflow-x-auto border-b border-white/5 no-scrollbar px-4">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab ? 'text-white' : 'text-gray-500'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-4 right-4 h-0.5 bg-cyan-400"></div>
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 pt-6 space-y-6 pb-20">
        {/* Categories Grid */}
        <div className="grid grid-cols-5 gap-y-6">
          {CATEGORIES.map(cat => {
            const IconComp = IconMap[cat.icon];
            const isSelected = categoryId === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryId(cat.id)}
                className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
              >
                <div 
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                    isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[#1e1e2d]' : 'opacity-80'
                  }`}
                  style={{ backgroundColor: cat.color }}
                >
                  <IconComp size={28} color="white" strokeWidth={2} />
                </div>
                <span className={`text-xs ${isSelected ? 'text-white font-medium' : 'text-gray-400'}`}>
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Input Rows Area */}
        <div className="flex gap-4">
          <div className="w-24 h-24 rounded-2xl border border-white/10 bg-white/5 flex items-center justify-center text-gray-600 active:bg-white/10 transition-colors cursor-pointer">
            <Camera size={32} />
          </div>
          
          <div className="flex-1 space-y-3">
            {/* Amount Input */}
            <div className="flex items-center gap-2 bg-[#252538] rounded-xl p-3 border border-white/5 focus-within:ring-1 ring-cyan-500/30">
              <span className="text-xs text-gray-500 px-2 py-1 bg-white/5 rounded font-mono">TWD</span>
              <input 
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onFocus={() => amount === '0' && setAmount('')}
                onBlur={() => amount === '' && setAmount('0')}
                className="flex-1 bg-transparent text-right text-2xl font-light focus:outline-none text-white"
              />
              <Plus size={18} className="text-gray-500" />
            </div>

            {/* Name Input */}
            <div className="flex items-center gap-2 bg-[#252538] rounded-xl p-3 border border-white/5 focus-within:ring-1 ring-cyan-500/30">
              <input 
                type="text"
                placeholder="名稱"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1 bg-transparent text-sm focus:outline-none text-right placeholder-gray-600 text-white"
              />
              <Star size={18} className="text-gray-500" />
            </div>
          </div>
        </div>

        {/* Quick Grid Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={togglePaymentMethod}
            className="bg-[#252538] border border-white/5 rounded-2xl py-4 px-4 text-center text-sm font-light text-gray-200 active:bg-[#2a2a3e]"
          >
            {paymentMethod}
          </button>
          
          <button className="bg-[#252538] border border-white/5 rounded-2xl py-4 px-4 text-center text-sm font-light text-gray-200 active:bg-[#2a2a3e]">
            {projectName}
          </button>

          <div className="relative">
            {isEditingMerchant ? (
              <input 
                autoFocus
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                onBlur={() => setIsEditingMerchant(false)}
                className="w-full bg-[#252538] border border-cyan-500/50 rounded-2xl py-4 px-4 text-center text-sm font-light text-white focus:outline-none"
                placeholder="輸入商家..."
              />
            ) : (
              <button
                onClick={() => setIsEditingMerchant(true)}
                className="w-full bg-[#252538] border border-white/5 rounded-2xl py-4 px-4 text-center text-sm font-light text-gray-200 active:bg-[#2a2a3e]"
              >
                {merchant || '商家'}
              </button>
            )}
          </div>

          <button className="bg-[#252538] border border-white/5 rounded-2xl py-4 px-4 text-center text-sm font-light text-gray-200 active:bg-[#2a2a3e]">
            單次
          </button>

          <button
            onClick={() => dateInputRef.current?.showPicker()}
            className="bg-[#252538] border border-white/5 rounded-2xl py-4 px-4 text-center text-sm font-light text-gray-200 active:bg-[#2a2a3e]"
          >
            {format(displayDate, 'yyyy/MM/dd')} ({weekDayStr})
          </button>

          <button
            onClick={() => timeInputRef.current?.showPicker()}
            className="bg-[#252538] border border-white/5 rounded-2xl py-4 px-4 text-center text-sm font-light text-gray-200 active:bg-[#2a2a3e]"
          >
            {currentTime}
          </button>
        </div>

        {/* Tags Row */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowTagInput(!showTagInput)}
            className="flex items-center gap-1 text-xs text-gray-600 font-light hover:text-cyan-500 transition-colors"
          >
            <Hash size={14} />
            <span>標籤 / 紅利回饋</span>
          </button>
          {(showTagInput || tags) && (
            <input 
              autoFocus
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="輸入標籤..."
              className="flex-1 bg-transparent border-b border-white/10 text-xs text-gray-400 focus:outline-none focus:border-cyan-500 pb-0.5"
            />
          )}
        </div>

        {/* Note Area */}
        <div className="relative bg-[#252538] border border-white/5 rounded-2xl p-4 min-h-[160px] focus-within:ring-1 ring-white/5">
          <textarea
            placeholder="備註"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full bg-transparent resize-none text-sm focus:outline-none h-full placeholder-gray-600 text-white"
          />
          <button 
            onClick={handleAiParse}
            disabled={isAiLoading || (!name.trim() && !note.trim())}
            className={`absolute top-3 right-3 transition-all ${
              (name.trim() || note.trim()) ? 'text-cyan-500 opacity-100' : 'text-gray-700 opacity-0 pointer-events-none'
            } hover:text-cyan-400`}
            title="AI 助手解析"
          >
            {isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          </button>
        </div>

        {isEditing && (
          <button 
            onClick={handleDelete}
            className="w-full py-4 text-red-500 text-sm font-medium flex items-center justify-center gap-2 bg-red-500/10 rounded-2xl border border-red-500/20 active:bg-red-500/20"
          >
            <Trash2 size={18} />
            <span>刪除這筆紀錄</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default AddTransactionModal;
