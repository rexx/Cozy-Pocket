
import React, { useState, useRef, useLayoutEffect, useEffect, useMemo } from 'react';
import { 
  X, Check, Trash2, Plus, RotateCcw, Hash,
  MoreHorizontal, Calendar as CalendarIcon, Clock,
  Store, Tag, Banknote, CreditCard, SmartphoneNfc, ArrowLeftRight,
  Sparkles, Loader2, Globe
} from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SUPPORTED_CURRENCIES, getEnabledCurrencies, getPreferredCurrency } from '../constants';
import { SuggestionItem, SuggestionIndex, Transaction, TransactionType } from '../types';
import { format, isValid } from 'date-fns';
import { db } from '../db';
import { isOffline } from '../services/networkService';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from '../time';
import { categoryIconMap } from './categoryIcons';

const IconMap = categoryIconMap;

interface AddTransactionModalProps {
  onClose: () => void;
  onAdd: (transaction: Omit<Transaction, 'id'>) => Promise<boolean>;
  onUpdate?: (transaction: Transaction) => Promise<boolean>;
  onDelete?: (id: string) => void;
  initialDate: Date;
  editingTransaction?: Transaction | null;
  suggestions: SuggestionIndex;
}

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ 
  onClose, 
  onAdd, 
  onUpdate,
  onDelete,
  initialDate, 
  editingTransaction,
  suggestions
}) => {
  const isEditing = !!editingTransaction;
  const safeInitialDate = (initialDate && isValid(initialDate)) ? initialDate : new Date();
  
  const amountInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  
  const getInitialAmount = () => {
    if (!editingTransaction) return '';
    const multiplier = editingTransaction.type === '支出' ? -1 : 1;
    return (editingTransaction.amount * multiplier).toString();
  };

  const [activeTab, setActiveTab] = useState<TransactionType>(editingTransaction?.type || '支出');
  const [amount, setAmount] = useState(getInitialAmount());
  const [currency, setCurrency] = useState(editingTransaction?.currency || 'TWD');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);
  const [isSubView, setIsSubView] = useState(isEditing && editingTransaction?.type === '支出');
  const [categoryId, setCategoryId] = useState<string | undefined>(editingTransaction?.categoryId);
  const [subCategoryId, setSubCategoryId] = useState<string | undefined>(editingTransaction?.subCategoryId);
  const [name, setName] = useState(editingTransaction?.name || ''); 
  const [note, setNote] = useState(editingTransaction?.note || ''); 
  const [merchant, setMerchant] = useState(editingTransaction?.merchant || ''); 
  const [paymentMethod, setPaymentMethod] = useState<string>(editingTransaction?.paymentMethod || '現金');
  
  const [currentDateStr, setCurrentDateStr] = useState(
    editingTransaction ? format(new Date(toEpochMillis(editingTransaction.timestamp)), 'yyyy-MM-dd') : format(safeInitialDate, 'yyyy-MM-dd')
  );
  const [currentTime, setCurrentTime] = useState(
    editingTransaction ? format(new Date(toEpochMillis(editingTransaction.timestamp)), 'HH:mm') : format(new Date(), 'HH:mm')
  );

  const [tagList, setTagList] = useState<string[]>(
    editingTransaction?.tags ? editingTransaction.tags.split(/\s+/).filter(t => t.length > 0) : []
  );
  const [tagInput, setTagInput] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiError, setAiError] = useState('');
  const hasApiKey = !!process.env.API_KEY;
  const suggestionLimit = 6;

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      db.settings.get('defaultCurrency'),
      db.settings.get('enabledCurrencies')
    ]).then(([defaultCurrencySetting, enabledCurrenciesSetting]) => {
      if (!isMounted) return;
      const enabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
      setAvailableCurrencies(enabledCurrencies);
      if (!isEditing) {
        setCurrency(getPreferredCurrency(defaultCurrencySetting?.value, enabledCurrencies));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [isEditing]);

  useLayoutEffect(() => {
    if (amountInputRef.current && !isEditing) {
      amountInputRef.current.focus();
    }
  }, [isEditing]);

  const handleTabChange = (tab: TransactionType) => {
    setActiveTab(tab);
    setIsSubView(false);
    if (!isEditing) {
      setCategoryId(undefined);
      setSubCategoryId(undefined);
    }
  };

  const handleMainCategoryClick = (id: string) => {
    setCategoryId(id);
    if (activeTab === '支出') setIsSubView(true);
    else setSubCategoryId(undefined);
  };

  const handleSubCategoryClick = (id: string) => setSubCategoryId(id);
  const handleBackToMain = () => setIsSubView(false);

  const toggleCurrency = () => {
    const cyclingCurrencies = availableCurrencies.length > 0 ? availableCurrencies : [...SUPPORTED_CURRENCIES];
    const currentIndex = cyclingCurrencies.indexOf(currency);
    setCurrency(cyclingCurrencies[(currentIndex + 1 + cyclingCurrencies.length) % cyclingCurrencies.length]);
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiProcessing) return;

    setIsAiProcessing(true);
    setAiError('');
    try {
      const { parseTransactionWithAI } = await import('../services/geminiService');
      const result = await parseTransactionWithAI(aiInput);
      if (result) {
        if (result.type) setActiveTab(result.type as TransactionType);
        const normalizedCurrency = result.currency?.toUpperCase();
        if (normalizedCurrency && availableCurrencies.includes(normalizedCurrency)) {
          setCurrency(normalizedCurrency);
        }
        if (result.amount !== undefined && result.amount !== null) {
          setAmount(Math.abs(result.amount).toString());
        }
        if (result.categoryId) {
          setCategoryId(result.categoryId);
          if (result.type === '支出') setIsSubView(true);
        }
        if (result.subCategoryId) setSubCategoryId(result.subCategoryId);
        setName(result.name || result.merchant || "");
        setMerchant(result.merchant || "");
        setNote(result.note || "");
        setPaymentMethod(result.paymentMethod || "現金");
        setAiInput('');
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      setAiError(err?.message || 'AI 解析失敗，請稍後再試');
    } finally {
      setIsAiProcessing(false);
    }
  };

  const addTag = () => {
    const input = tagInput.trim();
    if (input) {
      const parts = input.split(/\s+/).map(p => p.replace(/#/g, ''));
      const newTags = [...tagList];
      let changed = false;
      parts.forEach(part => {
        if (part && !newTags.includes(part)) {
          newTags.push(part);
          changed = true;
        }
      });
      if (changed) setTagList(newTags);
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => setTagList(tagList.filter(t => t !== tagToRemove));

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag();
    } else if (e.key === 'Backspace' && !tagInput && tagList.length > 0) {
      removeTag(tagList[tagList.length - 1]);
    }
  };

  const handleSubmit = async () => {
    const parsedAmount = parseFloat(amount || '0');
    if (isNaN(parsedAmount)) return alert("請輸入有效的數字");
    if (!categoryId) return alert("請選擇類別");
    if (activeTab === '支出' && !subCategoryId) {
      alert("請選擇子類別");
      setIsSubView(true);
      return;
    }
    
    const multiplier = activeTab === '支出' ? -1 : 1;
    const finalAmount = parsedAmount * multiplier;

    let finalTagList = [...tagList];
    const input = tagInput.trim();
    if (input) {
      const parts = input.split(/\s+/).map(p => p.replace(/#/g, ''));
      parts.forEach(part => {
        if (part && !finalTagList.includes(part)) finalTagList.push(part);
      });
    }

    const baseDate = new Date(`${currentDateStr}T${currentTime}`);
    const timestamp = toEpochSeconds(baseDate.getTime());

    const data: Omit<Transaction, 'id'> = {
      type: activeTab,
      amount: finalAmount,
      currency,
      categoryId: categoryId!,
      subCategoryId,
      name: name || '',
      note,
      merchant,
      paymentMethod,
      timestamp,
      readableDateTime: formatReadableDateTime(timestamp),
      tags: finalTagList.join(' ')
    };

    if (isEditing && onUpdate && editingTransaction) {
      const saved = await onUpdate({ ...data, id: editingTransaction.id } as Transaction);
      if (saved) onClose();
    } else {
      const saved = await onAdd(data);
      if (saved) onClose();
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

  const getPaymentIcon = (method: string) => {
    switch (method) {
      case '現金': return Banknote;
      case '信用卡': return CreditCard;
      case '電子支付': return SmartphoneNfc;
      case '轉帳': return ArrowLeftRight;
      default: return Banknote;
    }
  };

  const PaymentIcon = getPaymentIcon(paymentMethod);
  const categoriesToDisplay = activeTab === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const currentMainCat = EXPENSE_CATEGORIES.find(c => c.id === categoryId);

  const getTextMatchRank = (value: string, rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    if (!query) return 0;
    const normalizedValue = value.trim().toLowerCase();
    if (normalizedValue === query) return 3;
    if (normalizedValue.startsWith(query)) return 2;
    if (normalizedValue.includes(query)) return 1;
    return 0;
  };

  const getRankedSuggestions = (
    items: SuggestionItem[],
    rawQuery: string,
    excludedValues: Set<string>
  ) => {
    return items
      .filter((item) => {
        const normalizedValue = item.value.trim();
        if (!normalizedValue) return false;
        if (excludedValues.has(normalizedValue.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => {
        const textMatchDiff = getTextMatchRank(b.value, rawQuery) - getTextMatchRank(a.value, rawQuery);
        if (textMatchDiff !== 0) return textMatchDiff;

        const subCategoryMatchA = !!subCategoryId && a.subCategoryIds.includes(subCategoryId);
        const subCategoryMatchB = !!subCategoryId && b.subCategoryIds.includes(subCategoryId);
        if (subCategoryMatchA !== subCategoryMatchB) return Number(subCategoryMatchB) - Number(subCategoryMatchA);

        const categoryMatchA = !!categoryId && a.categoryIds.includes(categoryId);
        const categoryMatchB = !!categoryId && b.categoryIds.includes(categoryId);
        if (categoryMatchA !== categoryMatchB) return Number(categoryMatchB) - Number(categoryMatchA);

        if (b.count !== a.count) return b.count - a.count;
        if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
        return a.value.localeCompare(b.value);
      })
      .slice(0, suggestionLimit);
  };

  const merchantSuggestions = useMemo(() => (
    getRankedSuggestions(
      suggestions.merchants,
      merchant,
      new Set()
    )
  ), [categoryId, merchant, subCategoryId, suggestions.merchants]);

  const nameSuggestions = useMemo(() => (
    getRankedSuggestions(
      suggestions.names,
      name,
      new Set()
    )
  ), [categoryId, name, subCategoryId, suggestions.names]);

  const tagSuggestions = useMemo(() => {
    const excluded = new Set(tagList.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
    return getRankedSuggestions(suggestions.tags, tagInput, excluded);
  }, [categoryId, subCategoryId, suggestions.tags, tagInput, tagList]);

  const SuggestionChips = ({
    items,
    onSelect,
    formatValue = (value: string) => value,
    tone = 'default',
  }: {
    items: SuggestionItem[];
    onSelect: (value: string) => void;
    formatValue?: (value: string) => string;
    tone?: 'default' | 'tag';
  }) => {
    if (items.length === 0) return null;

    const chipClassName = tone === 'tag'
      ? 'border border-cyan-500/20 bg-cyan-500/10 text-cyan-300 hover:border-cyan-400/40 hover:text-cyan-200'
      : 'border border-white/10 bg-white/5 text-gray-300 hover:border-white/20 hover:text-white';

    return (
      <div className="mt-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => onSelect(item.value)}
              className={`max-w-full shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all active:scale-95 ${chipClassName}`}
              title={item.value}
            >
              <span className="block truncate">{formatValue(item.value)}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#1a1c2c] animate-slide-up select-none overflow-hidden text-slate-200">
      <div className="flex-none">
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/5 bg-[#1e1e2d]">
          <button onClick={onClose} className="p-2 text-gray-400 active:scale-90 transition-transform"><X size={26} /></button>
          <h1 className="text-lg font-bold text-white tracking-wide">{isEditing ? '修改項目' : '新增項目'}</h1>
          <button onClick={handleSubmit} className="p-2 text-cyan-400 active:scale-90 transition-transform"><Check size={26} strokeWidth={2.5} /></button>
        </div>
        <div className="flex bg-[#1e1e2d] border-b border-white/5 no-scrollbar px-4">
          {['支出', '收入'].map((tab) => (
            <button key={tab} onClick={() => handleTabChange(tab as TransactionType)} className={`flex-1 py-4 text-xs font-bold tracking-widest transition-all relative ${activeTab === tab ? 'text-white' : 'text-gray-500'}`}>
              {tab}
              {activeTab === tab && <div className={`absolute bottom-0 left-4 right-4 h-1 rounded-t-full ${activeTab === '收入' ? 'bg-rose-500 shadow-rose-500/30' : 'bg-emerald-500 shadow-emerald-500/30'}`}></div>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c] overscroll-contain">
        <div className="min-h-[calc(100%+1px)] space-y-4 pb-10">
        {hasApiKey && !isEditing && (
          <div className="px-2 mb-2">
            <form onSubmit={handleAiSubmit} className="relative group">
              <div className="absolute inset-0 bg-cyan-500/5 rounded-2xl blur-lg group-focus-within:bg-cyan-500/10 transition-all"></div>
              <div className="relative flex items-center bg-[#252538]/60 border border-white/5 rounded-2xl px-4 py-3 focus-within:border-cyan-500/30 transition-all backdrop-blur-md">
                <div className="flex-shrink-0 mr-3 text-cyan-400">
                  {isAiProcessing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="animate-pulse" />}
                </div>
                <input 
                  type="text"
                  placeholder="AI 快速填寫，例：拉麵 1500日圓 現金..."
                  className="bg-transparent text-xs font-medium text-white w-full focus:outline-none placeholder-gray-600"
                  value={aiInput}
                  onChange={(e) => {
                    setAiInput(e.target.value);
                    if (aiError) setAiError('');
                  }}
                  disabled={isAiProcessing || isOffline()}
                />
                {aiInput && !isAiProcessing && (
                  <button type="submit" className="ml-2 text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-2 py-1 rounded-lg border border-cyan-500/20">
                    解析
                  </button>
                )}
              </div>
            </form>
            {isOffline() && (
              <p className="mt-2 px-1 text-[11px] font-bold text-amber-300">
                目前離線，AI 解析暫時不可用。
              </p>
            )}
            {!isOffline() && aiError && (
              <p className="mt-2 px-1 text-[11px] font-bold text-red-300">
                {aiError}
              </p>
            )}
          </div>
        )}

        <div className="px-2 min-h-[180px] mb-6">
          {activeTab === '支出' && isSubView && currentMainCat ? (
            <div className="grid grid-cols-5 gap-x-2 gap-y-6">
              <button onClick={handleBackToMain} className="flex flex-col items-center gap-2 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white/5">
                  <RotateCcw size={24} color="white" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-bold text-white">返回</span>
              </button>
              {currentMainCat.subcategories?.map(item => {
                const IconComp = IconMap[item.icon] || MoreHorizontal;
                return (
                  <button key={item.id} onClick={() => handleSubCategoryClick(item.id)} className="flex flex-col items-center gap-2 group">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${subCategoryId === item.id ? 'scale-110 ring-2 ring-white/20 shadow-lg' : ''}`} style={{ backgroundColor: currentMainCat.color }}>
                      <IconComp size={24} color="white" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[11px] font-bold ${subCategoryId === item.id ? 'text-white' : 'text-gray-400'} truncate w-full text-center px-1`}>{item.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-5 gap-x-2 gap-y-6">
              {categoriesToDisplay.map(cat => {
                const IconComp = IconMap[cat.icon] || MoreHorizontal;
                return (
                  <button key={cat.id} onClick={() => handleMainCategoryClick(cat.id)} className="flex flex-col items-center gap-2 group">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${categoryId === cat.id ? 'scale-110 ring-2 ring-white/20 shadow-lg' : ''}`} style={{ backgroundColor: cat.color }}>
                      <IconComp size={24} color="white" strokeWidth={2.5} />
                    </div>
                    <span className={`text-[11px] font-bold ${categoryId === cat.id ? 'text-white' : 'text-gray-400'} truncate w-full text-center px-1`}>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button onClick={togglePaymentMethod} className="bg-[#252538] rounded-2xl h-14 px-4 flex items-center border border-white/5 active:bg-[#2a2a3e] shadow-lg min-w-0">
            <PaymentIcon size={16} className="text-gray-500" />
            <span className="text-white truncate ml-2 text-right flex-1 text-sm font-bold">{paymentMethod}</span>
          </button>
          <div className="flex items-center bg-[#252538] rounded-2xl h-14 px-3 border border-white/5 shadow-lg min-w-0 overflow-hidden">
            <button onClick={toggleCurrency} className="flex items-center gap-1.5 pr-3 mr-3 border-r border-white/10 shrink-0 active:scale-95 transition-transform">
              <Globe size={14} className="text-gray-500" />
              <span className="text-[11px] text-gray-300 font-black tracking-widest">{currency}</span>
            </button>
            <input
              ref={amountInputRef}
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={`flex-1 min-w-0 w-0 bg-transparent text-right text-2xl font-black leading-none focus:outline-none placeholder-gray-600 ${activeTab === '收入' ? 'text-rose-400' : 'text-emerald-400'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="bg-[#252538] rounded-2xl h-14 px-4 flex items-center border border-white/5 shadow-lg overflow-hidden">
              <Store size={16} className="text-gray-500" />
              <input type="text" value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="商家" className="bg-transparent text-white text-right focus:outline-none w-full font-bold placeholder-gray-700 text-sm ml-2" />
            </div>
            <SuggestionChips items={merchantSuggestions} onSelect={setMerchant} />
          </div>
          <div>
            <div className="bg-[#252538] rounded-2xl h-14 px-4 flex items-center border border-white/5 shadow-lg overflow-hidden">
              <Tag size={16} className="text-gray-500" />
              <input type="text" placeholder="名稱" value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-transparent text-right text-sm font-bold focus:outline-none placeholder-gray-600 text-white ml-2" />
            </div>
            <SuggestionChips items={nameSuggestions} onSelect={setName} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#252538] h-14 px-4 rounded-2xl border border-white/5 shadow-lg flex items-center">
            <CalendarIcon size={16} className="text-gray-500" />
            <input type="date" value={currentDateStr} onChange={(e) => setCurrentDateStr(e.target.value)} className="bg-transparent text-white text-xs font-bold text-right w-full ml-2" style={{ colorScheme: 'dark' }} />
          </div>
          <div className="bg-[#252538] h-14 px-4 rounded-2xl border border-white/5 shadow-lg flex items-center">
            <Clock size={16} className="text-gray-500" />
            <input type="time" value={currentTime} onChange={(e) => setCurrentTime(e.target.value)} className="bg-transparent text-white text-xs font-bold text-right w-full ml-2" style={{ colorScheme: 'dark' }} />
          </div>
        </div>

        <div className="bg-[#252538] rounded-2xl p-4 border border-white/5 shadow-lg transition-all focus-within:border-white/20">
          <div className="flex flex-wrap gap-2 mb-2">
            {tagList.map(tag => (
              <span key={tag} className="flex items-center gap-1 bg-cyan-500/10 text-cyan-400 text-[10px] font-black px-2 py-1 rounded-lg border border-cyan-500/20">
                #{tag}
                <button onClick={() => removeTag(tag)} className="p-0.5 hover:text-white"><X size={10} /></button>
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Hash size={16} className="text-gray-500" />
            <input 
              ref={tagInputRef}
              type="text"
              placeholder="輸入標籤 (空格分隔) 按確認"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={addTag}
              className="flex-1 bg-transparent text-sm font-bold focus:outline-none placeholder-gray-600 text-white"
            />
          </div>
          <SuggestionChips
            items={tagSuggestions}
            onSelect={(value) => setTagList((prev) => prev.includes(value) ? prev : [...prev, value])}
            formatValue={(value) => `#${value}`}
            tone="tag"
          />
        </div>

        <div className="bg-[#252538] rounded-2xl p-5 min-h-[140px] border border-white/5 shadow-lg">
          <textarea placeholder="輸入備註..." value={note} onChange={(e) => setNote(e.target.value)} className="w-full bg-transparent resize-none text-sm focus:outline-none h-full placeholder-gray-700 text-white font-light leading-relaxed" />
        </div>

        {isEditing && (
          <button onClick={handleDelete} className="w-full py-5 text-red-500 text-sm font-bold flex items-center justify-center gap-2 bg-red-500/5 rounded-2xl border border-red-500/10 active:bg-red-500/20 transition-all mt-4">
            <Trash2 size={20} /><span>刪除這筆紀錄</span>
          </button>
        )}
        </div>
      </div>
    </div>
  );
};

export default AddTransactionModal;
