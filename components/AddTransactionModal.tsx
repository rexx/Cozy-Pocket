
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, Check, Trash2, Copy, RotateCcw, Hash,
  MoreHorizontal, Calendar as CalendarIcon, Clock,
  Store, Tag,
  Sparkles, Globe, AlertCircle, SendHorizontal,
  CircleAlert, CircleCheck, Clock3, LoaderCircle,
  type LucideIcon
} from 'lucide-react';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, SUPPORTED_CURRENCIES, getEnabledCurrencies, getPreferredCurrency } from '../constants';
import { PaymentMethod, SuggestionItem, SuggestionIndex, Transaction, TransactionType } from '../types';
import { format, isValid } from 'date-fns';
import { db } from '../db';
import { isOffline } from '../services/networkService';
import { formatReadableDateTime, toEpochMillis, toEpochSeconds } from '../time';
import { categoryIconMap } from './categoryIcons';
import PageHeader from './PageHeader';
import { confirmAction } from '../services/dialogService';
import { getPaymentMethodIconOrFallback } from './paymentMethodIcons';
import { GEMINI_API_KEY_SETTING_KEY, getGeminiApiKey } from '../preferences';

const IconMap = categoryIconMap;

interface ValidationErrors {
  amount?: string;
  category?: string;
  subCategory?: string;
}

type ModalTab = TransactionType | 'AI';
type AiFilledField = 'amount' | 'currency' | 'category' | 'paymentMethod' | 'merchant' | 'name' | 'note';
type AiFeedback = {
  type: 'success' | 'warning';
  message: string;
};
type AiBorderGradientAxis = 'x' | 'y';
type AiBorderGradientConfig = {
  id: string;
  clipId: string;
  axis: AiBorderGradientAxis;
  x1: string;
  y1: string;
  x2: string;
  y2: string;
  from1: string;
  from2: string;
  to1: string;
  to2: string;
  clipX: string;
  clipY: string;
  clipWidth: string;
  clipHeight: string;
};

const PAYMENT_METHODS: PaymentMethod[] = ['現金', '信用卡', '電子支付', '轉帳'];
const AI_BORDER_CLASS_NAME = 'border-cyan-300/60';
const AI_BORDER_GRADIENT_STOPS = [
  { offset: '0', color: 'rgb(34 211 238 / 0.18)' },
  { offset: '0.25', color: 'rgb(168 85 247 / 0.58)' },
  { offset: '0.5', color: 'rgb(125 249 255 / 1)' },
  { offset: '0.75', color: 'rgb(168 85 247 / 0.58)' },
  { offset: '1', color: 'rgb(34 211 238 / 0.18)' },
];
const AI_BORDER_GRADIENTS: AiBorderGradientConfig[] = [
  {
    id: 'ai-input-jira-gradient-top',
    clipId: 'ai-input-jira-clip-top',
    axis: 'x',
    x1: '0%',
    y1: '0',
    x2: '400%',
    y2: '0',
    from1: '0%',
    from2: '400%',
    to1: '400%',
    to2: '800%',
    clipX: '0',
    clipY: '0',
    clipWidth: '100%',
    clipHeight: '18',
  },
  {
    id: 'ai-input-jira-gradient-right',
    clipId: 'ai-input-jira-clip-right',
    axis: 'y',
    x1: '0',
    y1: '-100%',
    x2: '0',
    y2: '300%',
    from1: '-100%',
    from2: '300%',
    to1: '300%',
    to2: '700%',
    clipX: 'calc(100% - 18px)',
    clipY: '0',
    clipWidth: '18',
    clipHeight: '100%',
  },
  {
    id: 'ai-input-jira-gradient-bottom',
    clipId: 'ai-input-jira-clip-bottom',
    axis: 'x',
    x1: '300%',
    y1: '0',
    x2: '700%',
    y2: '0',
    from1: '300%',
    from2: '700%',
    to1: '-100%',
    to2: '300%',
    clipX: '0',
    clipY: 'calc(100% - 18px)',
    clipWidth: '100%',
    clipHeight: '18',
  },
  {
    id: 'ai-input-jira-gradient-left',
    clipId: 'ai-input-jira-clip-left',
    axis: 'y',
    x1: '0',
    y1: '0%',
    x2: '0',
    y2: '400%',
    from1: '0%',
    from2: '400%',
    to1: '-400%',
    to2: '0%',
    clipX: '0',
    clipY: '0',
    clipWidth: '18',
    clipHeight: '100%',
  },
];
const AI_FIELD_LABELS: Record<AiFilledField, string> = {
  amount: '金額',
  currency: '幣別',
  category: '類別',
  paymentMethod: '支付方式',
  merchant: '商家',
  name: '名稱',
  note: '備註',
};

interface AddTransactionModalProps {
  onClose: () => void;
  onAdd: (transaction: Omit<Transaction, 'id'>) => Promise<boolean>;
  onUpdate?: (transaction: Transaction) => Promise<boolean>;
  onDelete?: (id: string) => void;
  onDuplicate?: (transaction: Transaction) => void;
  onRetrySyncTransaction?: (id: string) => Promise<void>;
  initialDate: Date;
  editingTransaction?: Transaction | null;
  prefilledTransaction?: Omit<Transaction, 'id'> | null;
  syncInfo?: TransactionSyncInfo | null;
  isOffline?: boolean;
  isSyncConfigured?: boolean;
  isSyncing?: boolean;
  suggestions: SuggestionIndex;
}

export interface TransactionSyncInfo {
  id: string;
  syncStatus?: Transaction['syncStatus'];
  lastSyncError?: string;
  exists?: boolean;
}

type TransactionSyncStatus = NonNullable<Transaction['syncStatus']>;

interface SyncStatusMeta {
  label: string;
  description: string;
  Icon: LucideIcon;
  panelClassName: string;
  iconClassName: string;
}

const SYNC_STATUS_META: Record<TransactionSyncStatus, SyncStatusMeta> = {
  pending: {
    label: '待同步',
    description: '等待背景同步補送。',
    Icon: Clock3,
    panelClassName: 'border-amber-400/20 bg-amber-500/10',
    iconClassName: 'text-amber-200',
  },
  syncing: {
    label: '同步中',
    description: '正在上傳這筆交易。',
    Icon: LoaderCircle,
    panelClassName: 'border-cyan-400/20 bg-cyan-500/10',
    iconClassName: 'text-cyan-200',
  },
  synced: {
    label: '已同步',
    description: '這筆交易已完成上傳。',
    Icon: CircleCheck,
    panelClassName: 'border-emerald-400/20 bg-emerald-500/10',
    iconClassName: 'text-emerald-200',
  },
  error: {
    label: '同步失敗',
    description: '最近一次上傳失敗。',
    Icon: CircleAlert,
    panelClassName: 'border-rose-400/25 bg-rose-500/10',
    iconClassName: 'text-rose-200',
  },
};

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ 
  onClose, 
  onAdd, 
  onUpdate,
  onDelete,
  onDuplicate,
  onRetrySyncTransaction,
  initialDate, 
  editingTransaction,
  prefilledTransaction,
  syncInfo,
  isOffline: isOfflineProp,
  isSyncConfigured = true,
  isSyncing = false,
  suggestions
}) => {
  const isEditing = !!editingTransaction;
  const sourceTransaction = editingTransaction ?? prefilledTransaction ?? null;
  const safeInitialDate = (initialDate && isValid(initialDate)) ? initialDate : new Date();
  
  const tagInputRef = useRef<HTMLInputElement>(null);
  const aiInputRef = useRef<HTMLInputElement>(null);
  
  const getInitialAmount = () => {
    if (!sourceTransaction) return '';
    const multiplier = sourceTransaction.type === '支出' ? -1 : 1;
    return (sourceTransaction.amount * multiplier).toString();
  };

  const getSourceDate = () => (
    sourceTransaction ? format(new Date(toEpochMillis(sourceTransaction.timestamp)), 'yyyy-MM-dd') : format(safeInitialDate, 'yyyy-MM-dd')
  );

  const getSourceTime = () => (
    sourceTransaction ? format(new Date(toEpochMillis(sourceTransaction.timestamp)), 'HH:mm') : format(new Date(), 'HH:mm')
  );

  const [activeTab, setActiveTab] = useState<ModalTab>(sourceTransaction?.type || '支出');
  const [amount, setAmount] = useState(getInitialAmount());
  const [currency, setCurrency] = useState(sourceTransaction?.currency || 'TWD');
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>([...SUPPORTED_CURRENCIES]);
  const [isSubView, setIsSubView] = useState(false);
  const [categoryId, setCategoryId] = useState<string | undefined>(sourceTransaction?.categoryId);
  const [subCategoryId, setSubCategoryId] = useState<string | undefined>(sourceTransaction?.subCategoryId);
  const [isCategoryCollapsed, setIsCategoryCollapsed] = useState(
    sourceTransaction?.type === '支出'
      ? !!(sourceTransaction?.categoryId && sourceTransaction?.subCategoryId)
      : !!sourceTransaction?.categoryId
  );
  const [name, setName] = useState(sourceTransaction?.name || ''); 
  const [note, setNote] = useState(sourceTransaction?.note || ''); 
  const [merchant, setMerchant] = useState(sourceTransaction?.merchant || ''); 
  const [paymentMethod, setPaymentMethod] = useState<string>(sourceTransaction?.paymentMethod || '現金');
  
  const [currentDateStr, setCurrentDateStr] = useState(getSourceDate());
  const [currentTime, setCurrentTime] = useState(getSourceTime());

  const [tagList, setTagList] = useState<string[]>(
    sourceTransaction?.tags ? sourceTransaction.tags.split(/\s+/).filter(t => t.length > 0) : []
  );
  const [tagInput, setTagInput] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [aiInput, setAiInput] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiFeedback, setAiFeedback] = useState<AiFeedback | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<AiFilledField>>(() => new Set<AiFilledField>());
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [errorPulseKey, setErrorPulseKey] = useState(0);
  const [isRetryingSync, setIsRetryingSync] = useState(false);
  const hasApiKey = geminiApiKey.length > 0;
  const suggestionLimit = 6;
  const isOfflineMode = isOfflineProp ?? isOffline();

  useEffect(() => {
    setActiveTab(sourceTransaction?.type || '支出');
    setAmount(getInitialAmount());
    setCategoryId(sourceTransaction?.categoryId);
    setSubCategoryId(sourceTransaction?.subCategoryId);
    setIsSubView(false);
    setIsCategoryCollapsed(
      sourceTransaction?.type === '支出'
        ? !!(sourceTransaction?.categoryId && sourceTransaction?.subCategoryId)
        : !!sourceTransaction?.categoryId
    );
    setName(sourceTransaction?.name || '');
    setNote(sourceTransaction?.note || '');
    setMerchant(sourceTransaction?.merchant || '');
    setPaymentMethod(sourceTransaction?.paymentMethod || '現金');
    setCurrentDateStr(getSourceDate());
    setCurrentTime(getSourceTime());
    setTagList(sourceTransaction?.tags ? sourceTransaction.tags.split(/\s+/).filter(t => t.length > 0) : []);
    setTagInput('');
    setAiInput('');
    setAiError('');
    setAiFeedback(null);
    setAiFilledFields(new Set<AiFilledField>());
    setValidationErrors({});
    setErrorPulseKey(0);
  }, [sourceTransaction]);

  useEffect(() => {
    setIsRetryingSync(false);
  }, [syncInfo?.id]);

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      db.settings.get('defaultCurrency'),
      db.settings.get('enabledCurrencies'),
      db.settings.get(GEMINI_API_KEY_SETTING_KEY)
    ]).then(([defaultCurrencySetting, enabledCurrenciesSetting, geminiApiKeySetting]) => {
      if (!isMounted) return;
      const enabledCurrencies = getEnabledCurrencies(enabledCurrenciesSetting?.value);
      setAvailableCurrencies(enabledCurrencies);
      setGeminiApiKey(getGeminiApiKey(geminiApiKeySetting?.value));
      if (!sourceTransaction) {
        setCurrency(getPreferredCurrency(defaultCurrencySetting?.value, enabledCurrencies));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [sourceTransaction]);

  useEffect(() => {
    if (activeTab === 'AI') {
      aiInputRef.current?.focus();
    }
  }, [activeTab]);

  const clearAiField = (field: AiFilledField) => {
    setAiFilledFields((prev) => {
      if (!prev.has(field)) return prev;
      const next = new Set(prev);
      next.delete(field);
      return next;
    });
  };

  const getAiBorderClass = (fields: AiFilledField | AiFilledField[], fallback = 'border-white/5') => {
    const candidates = Array.isArray(fields) ? fields : [fields];
    return candidates.some((field) => aiFilledFields.has(field)) ? AI_BORDER_CLASS_NAME : fallback;
  };

  const isSupportedCurrency = (value: string) => (
    SUPPORTED_CURRENCIES.includes(value as typeof SUPPORTED_CURRENCIES[number])
  );

  const getCategoryByType = (type: TransactionType, id: string) => (
    (type === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).find((category) => category.id === id)
  );

  const buildAiFeedbackMessage = (filledFields: Set<AiFilledField>, warnings: string[]) => {
    const labels = Array.from(filledFields).map((field) => AI_FIELD_LABELS[field]);
    const baseMessage = labels.length > 0
      ? `AI 已填入：${labels.join('、')}`
      : 'AI 已解析，但沒有可直接套用的欄位';

    return warnings.length > 0
      ? `${baseMessage}\n${warnings.join('\n')}`
      : baseMessage;
  };

  const handleTabChange = (tab: ModalTab) => {
    const previousTab = activeTab;
    if (tab === previousTab) return;
    setActiveTab(tab);
    if (tab === 'AI') return;
    if (previousTab === 'AI') return;
    setIsSubView(false);
    setIsCategoryCollapsed(false);
    setValidationErrors((prev) => ({ ...prev, category: undefined, subCategory: undefined }));
    clearAiField('category');
    if (!isEditing) {
      setCategoryId(undefined);
      setSubCategoryId(undefined);
    }
  };

  const handleMainCategoryClick = (id: string) => {
    setCategoryId(id);
    setValidationErrors((prev) => ({ ...prev, category: undefined, subCategory: undefined }));
    clearAiField('category');
    if (activeTab === '支出') {
      setSubCategoryId(undefined);
      setIsSubView(true);
      setIsCategoryCollapsed(false);
    } else {
      setSubCategoryId(undefined);
      setIsSubView(false);
      setIsCategoryCollapsed(true);
    }
  };

  const handleSubCategoryClick = (id: string) => {
    setSubCategoryId(id);
    setIsSubView(false);
    setIsCategoryCollapsed(true);
    clearAiField('category');
    setValidationErrors((prev) => ({ ...prev, subCategory: undefined }));
  };

  const handleBackToMain = () => {
    setIsSubView(false);
    setIsCategoryCollapsed(false);
  };

  const handleExpandCategoryPicker = () => {
    setIsCategoryCollapsed(false);
    setIsSubView(activeTab === '支出' && !!categoryId);
  };

  const toggleCurrency = () => {
    const cyclingCurrencies = availableCurrencies.length > 0 ? availableCurrencies : [...SUPPORTED_CURRENCIES];
    const currentIndex = cyclingCurrencies.indexOf(currency);
    setCurrency(cyclingCurrencies[(currentIndex + 1 + cyclingCurrencies.length) % cyclingCurrencies.length]);
    clearAiField('currency');
  };

  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim() || isAiProcessing) return;
    if (!hasApiKey) {
      setAiFeedback(null);
      setAiError('請先到資料與設定儲存 Gemini API key');
      return;
    }
    if (isOffline()) {
      setAiFeedback(null);
      setAiError('目前離線，AI 解析需要網路連線');
      return;
    }

    setIsAiProcessing(true);
    setAiError('');
    setAiFeedback(null);
    try {
      const { parseTransactionWithAI } = await import('../services/geminiService');
      const result = await parseTransactionWithAI(aiInput, geminiApiKey);
      if (result) {
        const nextFilledFields = new Set<AiFilledField>();
        const warnings: string[] = [];
        const fallbackType: TransactionType = activeTab === 'AI' ? '支出' : activeTab;
        const nextType: TransactionType = result.type === '支出' || result.type === '收入' ? result.type : fallbackType;
        const didChangeType = nextType !== activeTab;

        if (result.type && result.type !== nextType) {
          warnings.push('AI 回傳的交易類型無法辨識，已保留目前類型');
        }
        if (didChangeType) {
          setActiveTab(nextType);
          setIsSubView(false);
          setIsCategoryCollapsed(false);
          setValidationErrors((prev) => ({ ...prev, category: undefined, subCategory: undefined }));
        }

        const normalizedCurrency = result.currency?.toUpperCase();
        if (normalizedCurrency) {
          if (isSupportedCurrency(normalizedCurrency)) {
            setCurrency(normalizedCurrency);
            nextFilledFields.add('currency');
            if (!availableCurrencies.includes(normalizedCurrency)) {
              warnings.push(`${normalizedCurrency} 尚未在偏好設定啟用，但已套用到本筆交易`);
            }
          } else {
            warnings.push(`AI 回傳的幣別 ${normalizedCurrency} 不支援，已保留目前幣別`);
          }
        }

        if (result.amount !== undefined && result.amount !== null) {
          if (Number.isFinite(result.amount)) {
            setAmount(Math.abs(result.amount).toString());
            nextFilledFields.add('amount');
            setValidationErrors((prev) => ({ ...prev, amount: undefined }));
          } else {
            warnings.push('AI 回傳的金額無法使用，已保留目前金額');
          }
        }

        let didApplyCategory = false;
        if (result.categoryId) {
          const matchedCategory = getCategoryByType(nextType, result.categoryId);
          if (matchedCategory) {
            didApplyCategory = true;
            setCategoryId(matchedCategory.id);
            nextFilledFields.add('category');
            setValidationErrors((prev) => ({ ...prev, category: undefined, subCategory: undefined }));
            if (nextType === '支出') {
              const matchedSubCategory = matchedCategory.subcategories?.find((item) => item.id === result.subCategoryId);
              if (result.subCategoryId && !matchedSubCategory) {
                warnings.push(`AI 回傳的子類別 ${result.subCategoryId} 不屬於 ${matchedCategory.name}，請手動選擇`);
              }
              if (matchedSubCategory) {
                setSubCategoryId(matchedSubCategory.id);
                setIsSubView(false);
                setIsCategoryCollapsed(true);
              } else {
                setSubCategoryId(undefined);
                setIsSubView(true);
                setIsCategoryCollapsed(false);
              }
            } else {
              setSubCategoryId(undefined);
              setIsSubView(false);
              setIsCategoryCollapsed(true);
            }
          } else {
            warnings.push(`AI 回傳的類別 ${result.categoryId} 不在可用類別中，已保留目前類別`);
          }
        }

        if (didChangeType && !didApplyCategory) {
          setCategoryId(undefined);
          setSubCategoryId(undefined);
          setIsSubView(false);
          setIsCategoryCollapsed(false);
        }

        if (result.paymentMethod) {
          if ((PAYMENT_METHODS as string[]).includes(result.paymentMethod)) {
            setPaymentMethod(result.paymentMethod);
            nextFilledFields.add('paymentMethod');
          } else {
            warnings.push(`AI 回傳的支付方式 ${result.paymentMethod} 不支援，已保留目前支付方式`);
          }
        }

        if (result.merchant) {
          setMerchant(result.merchant);
          nextFilledFields.add('merchant');
        }
        if (result.name) {
          setName(result.name);
          nextFilledFields.add('name');
        }
        if (result.note) {
          setNote(result.note);
          nextFilledFields.add('note');
        }

        setAiFilledFields(nextFilledFields);
        setAiFeedback({
          type: warnings.length > 0 ? 'warning' : 'success',
          message: buildAiFeedbackMessage(nextFilledFields, warnings),
        });
        setAiInput('');
      }
    } catch (err: any) {
      console.error("AI Error:", err);
      setAiFilledFields(new Set<AiFilledField>());
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
    if (activeTab === 'AI') return;
    const transactionType: TransactionType = activeTab;
    const normalizedAmount = amount.trim();
    const parsedAmount = Number(normalizedAmount);
    const nextErrors: ValidationErrors = {};

    if (!normalizedAmount || !Number.isFinite(parsedAmount)) {
      nextErrors.amount = '請輸入有效的數字';
    }
    if (!categoryId) {
      nextErrors.category = '請選擇類別';
    } else if (transactionType === '支出' && !subCategoryId) {
      nextErrors.subCategory = '請選擇子類別';
    }

    if (Object.keys(nextErrors).length > 0) {
      setValidationErrors(nextErrors);
      setErrorPulseKey((prev) => prev + 1);
      if (categoryId && transactionType === '支出' && !subCategoryId) {
        setIsSubView(true);
        setIsCategoryCollapsed(false);
      }
      return;
    }

    setValidationErrors({});
    setErrorPulseKey(0);

    const multiplier = transactionType === '支出' ? -1 : 1;
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
      type: transactionType,
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

  const handleDelete = async () => {
    if (isEditing && onDelete && editingTransaction) {
      const confirmed = await confirmAction({
        title: '刪除這筆紀錄？',
        text: '這筆交易會立即從本機資料中移除。',
        confirmButtonText: '刪除',
        cancelButtonText: '保留',
        tone: 'danger',
        icon: 'warning',
      });
      if (confirmed) {
        onDelete(editingTransaction.id);
        onClose();
      }
    }
  };

  const handleDuplicate = () => {
    if (isEditing && onDuplicate && editingTransaction) {
      onDuplicate(editingTransaction);
    }
  };

  const handleRetrySync = async () => {
    if (
      !syncInfo?.id ||
      !onRetrySyncTransaction ||
      syncInfo.exists === false ||
      isOfflineMode ||
      !isSyncConfigured ||
      isSyncing ||
      isRetryingSync
    ) {
      return;
    }

    setIsRetryingSync(true);
    try {
      await onRetrySyncTransaction(syncInfo.id);
    } finally {
      setIsRetryingSync(false);
    }
  };

  const togglePaymentMethod = () => {
    const currentIndex = PAYMENT_METHODS.indexOf(paymentMethod as PaymentMethod);
    setPaymentMethod(PAYMENT_METHODS[(currentIndex + 1) % PAYMENT_METHODS.length]);
    clearAiField('paymentMethod');
  };

  const PaymentIcon = getPaymentMethodIconOrFallback(paymentMethod);
  const categoriesToDisplay = activeTab === '支出' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
  const currentMainCat = categoriesToDisplay.find(c => c.id === categoryId);
  const currentSubCategory = currentMainCat?.subcategories?.find(item => item.id === subCategoryId);
  const validationMessages = Object.values(validationErrors).filter(Boolean);
  const errorPulseSuffix = errorPulseKey > 0 ? (errorPulseKey % 2 === 0 ? 'a' : 'b') : null;
  const errorShakeClass = errorPulseSuffix ? `validation-error-shake-${errorPulseSuffix}` : '';
  const errorPulseClass = errorPulseSuffix ? `validation-error-pulse-${errorPulseSuffix}` : '';
  const collapsedCategoryIcon = activeTab === '支出' && currentSubCategory
    ? currentSubCategory.icon
    : currentMainCat?.icon;
  const categoryHasValidationError = !!(validationErrors.category || validationErrors.subCategory);
  const categoryContainerClassName = [
    isCategoryCollapsed ? 'mb-3' : 'px-2 mb-6 min-h-[180px]',
    categoryHasValidationError
      ? `rounded-3xl border border-red-400/20 p-3 ${errorPulseClass}`
      : aiFilledFields.has('category') && !isCategoryCollapsed
        ? `rounded-3xl border ${AI_BORDER_CLASS_NAME} p-3`
        : '',
  ].filter(Boolean).join(' ');
  const collapsedCategoryBorderClassName = categoryHasValidationError
    ? `border-red-400/20 ${errorPulseClass}`.trim()
    : getAiBorderClass('category', 'border-white/10');
  const amountCurrencyBorderClassName = validationErrors.amount
    ? `border-red-400/40 ${errorPulseClass}`.trim()
    : getAiBorderClass(['amount', 'currency']);
  const isAiAnimationVisible = isAiProcessing;
  const syncStatus: TransactionSyncStatus = syncInfo?.syncStatus || 'pending';
  const syncStatusMeta = SYNC_STATUS_META[syncStatus];
  const SyncStatusIcon = syncStatusMeta.Icon;
  const isSyncRecordMissing = syncInfo?.exists === false;
  const hasSyncError = syncStatus === 'error';
  const hasManualSyncAction = syncStatus === 'pending' || syncStatus === 'error';
  const syncStatusDescription = isSyncRecordMissing
    ? '這筆交易已不存在，無法重新上傳。'
    : !isSyncConfigured && syncStatus !== 'synced'
      ? '尚未設定雲端同步，請先儲存 Sync API URL 與 Token。'
      : isOfflineMode && syncStatus !== 'synced'
        ? '目前離線，恢復連線後可重新上傳。'
        : isSyncing && syncStatus !== 'synced'
          ? '同步處理中，請稍候。'
          : syncStatusMeta.description;
  const isRetryDisabled = (
    isRetryingSync ||
    isSyncing ||
    isSyncRecordMissing ||
    isOfflineMode ||
    !isSyncConfigured ||
    !onRetrySyncTransaction
  );
  const retryButtonTitle = isRetryingSync || isSyncing
    ? '同步中'
    : isSyncRecordMissing
      ? '找不到交易'
      : isOfflineMode
        ? '目前離線'
        : !isSyncConfigured
          ? '尚未設定同步'
          : syncStatus === 'pending'
            ? '立即上傳'
            : '重新上傳';

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
        <PageHeader
          title={isEditing ? '修改項目' : '新增項目'}
          leftAction={<X size={26} />}
          onLeftAction={onClose}
          rightSlot={activeTab === 'AI' ? null : (
            <button onClick={handleSubmit} className="p-2 text-cyan-400 active:scale-90 transition-transform">
              <Check size={26} strokeWidth={2.5} />
            </button>
          )}
        />
        {!isCategoryCollapsed && (
          <div className="flex bg-[#1e1e2d] border-b border-white/5 no-scrollbar px-4">
            {(((hasApiKey && !isEditing) ? ['支出', 'AI', '收入'] : ['支出', '收入']) as ModalTab[]).map((tab) => {
              const isActive = activeTab === tab;
              const underlineClass = tab === 'AI'
                ? 'bg-cyan-400 shadow-cyan-400/30'
                : tab === '收入'
                  ? 'bg-rose-500 shadow-rose-500/30'
                  : 'bg-emerald-500 shadow-emerald-500/30';
              const isAiTab = tab === 'AI';
              return (
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  aria-label={isAiTab ? 'AI 快速填寫' : tab}
                  className={`py-4 text-xs font-bold tracking-widest transition-all relative ${isAiTab ? 'flex-none px-6 flex items-center justify-center' : 'flex-1'} ${isActive ? (isAiTab ? 'text-cyan-300' : 'text-white') : 'text-gray-500'}`}
                >
                  {isAiTab ? (
                    <Sparkles size={18} strokeWidth={2.5} />
                  ) : tab}
                  {isActive && <div className={`absolute bottom-0 left-4 right-4 h-1 rounded-t-full ${underlineClass}`}></div>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 no-scrollbar bg-gradient-to-b from-[#1e1e2d] to-[#1a1c2c] overscroll-contain">
        <div className="min-h-[calc(100%+1px)] space-y-4 pb-10">
        {aiFeedback && !aiError && (
          <p className={`px-1 text-[11px] font-bold whitespace-pre-line ${aiFeedback.type === 'success' ? 'text-cyan-200' : 'text-amber-200'}`}>
            {aiFeedback.message}
          </p>
        )}
        {activeTab !== 'AI' && validationMessages.length > 0 && (
          <div
            role="alert"
            aria-live="assertive"
            className={`flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-red-100 shadow-lg ${errorShakeClass}`.trim()}
          >
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-300" />
            <div className="space-y-1 text-sm font-bold leading-relaxed">
              {validationMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'AI' && (
          <div className="px-2 mb-5 pt-1 pb-3">
            <form onSubmit={handleAiSubmit} className="relative group h-12 rounded-2xl" aria-busy={isAiAnimationVisible}>
              <div className={`relative flex h-12 items-center rounded-2xl px-4 backdrop-blur-md transition-all ${isAiAnimationVisible ? 'ai-input-pulse-glow bg-[#252538]' : 'bg-[#252538]/60'}`}>
                <svg className="ai-input-svg-border" aria-hidden="true">
                  <defs>
                    {isAiAnimationVisible && (
                      <>
                        {AI_BORDER_GRADIENTS.map(({ id, axis, x1, y1, x2, y2, from1, from2, to1, to2 }) => (
                          <linearGradient key={id} id={id} gradientUnits="userSpaceOnUse" x1={x1} y1={y1} x2={x2} y2={y2} spreadMethod="reflect">
                            <animate attributeName={axis === 'x' ? 'x1' : 'y1'} from={from1} to={to1} repeatCount="indefinite" dur="3s" />
                            <animate attributeName={axis === 'x' ? 'x2' : 'y2'} from={from2} to={to2} repeatCount="indefinite" dur="3s" />
                            {AI_BORDER_GRADIENT_STOPS.map(({ offset, color }) => (
                              <stop key={offset} offset={offset} stopColor={color} />
                            ))}
                          </linearGradient>
                        ))}
                        {AI_BORDER_GRADIENTS.map(({ clipId, clipX, clipY, clipWidth, clipHeight }) => (
                          <clipPath key={clipId} id={clipId}>
                            <rect x={clipX} y={clipY} width={clipWidth} height={clipHeight} />
                          </clipPath>
                        ))}
                      </>
                    )}
                  </defs>
                  <rect className="ai-input-svg-border-base" x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="16" ry="16" pathLength="100" />
                  {isAiAnimationVisible && (
                    <>
                      {AI_BORDER_GRADIENTS.map(({ id, clipId }) => (
                        <rect key={id} className="ai-input-svg-border-flow" x="1" y="1" width="calc(100% - 2px)" height="calc(100% - 2px)" rx="16" ry="16" pathLength="100" stroke={`url(#${id})`} clipPath={`url(#${clipId})`} />
                      ))}
                    </>
                  )}
                </svg>
                <div className="flex-shrink-0 mr-3 text-cyan-400">
                  <Sparkles size={16} className={isAiAnimationVisible ? 'animate-pulse' : undefined} />
                </div>
                <input
                  ref={aiInputRef}
                  type="text"
                  placeholder="AI 快速填寫，例：拉麵 1500日圓 現金..."
                  className="bg-transparent text-xs font-medium text-white w-full focus:outline-none placeholder-gray-600"
                  value={aiInput}
                  onChange={(e) => {
                    setAiInput(e.target.value);
                    if (aiError) setAiError('');
                    if (aiFeedback) setAiFeedback(null);
                  }}
                  disabled={isAiProcessing || isOffline()}
                />
                {aiInput && !isAiProcessing && !isOffline() && (
                  <button
                    type="submit"
                    aria-label="解析 AI 快速填寫"
                    title="解析 AI 快速填寫"
                    className="ml-2 flex h-7 w-7 shrink-0 items-center justify-center text-cyan-300 transition-all active:scale-95"
                  >
                    <SendHorizontal size={15} strokeWidth={2.5} />
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

        {activeTab !== 'AI' && (
        <>
        <div className={categoryContainerClassName}>
          {isCategoryCollapsed && currentMainCat ? (
            <button
              type="button"
              onClick={handleExpandCategoryPicker}
              className={`w-full rounded-3xl border bg-[#252538] px-3 py-3 shadow-lg transition-all active:scale-[0.99] ${collapsedCategoryBorderClassName}`}
            >
              <div className="flex items-center gap-4">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
                  style={{ backgroundColor: currentMainCat.color }}
                >
                  {(() => {
                    const IconComp = (collapsedCategoryIcon && IconMap[collapsedCategoryIcon]) || MoreHorizontal;
                    return <IconComp size={22} color="white" strokeWidth={2.5} />;
                  })()}
                </div>
                <div className="min-w-0 text-left">
                  {activeTab === '支出' && currentSubCategory ? (
                    <div className="flex items-baseline gap-3 text-left">
                      <div className="truncate text-xl font-black leading-none text-white">{currentSubCategory.name}</div>
                      <div className="truncate text-sm font-bold leading-none text-gray-400">{currentMainCat.name}</div>
                    </div>
                  ) : (
                    <div className="truncate text-xl font-black leading-none text-white">{currentMainCat.name}</div>
                  )}
                </div>
              </div>
            </button>
          ) : activeTab === '支出' && isSubView && currentMainCat ? (
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
          <button onClick={togglePaymentMethod} className={`bg-[#252538] rounded-2xl h-14 px-4 flex items-center border active:bg-[#2a2a3e] shadow-lg min-w-0 ${getAiBorderClass('paymentMethod')}`}>
            <PaymentIcon size={16} className="text-gray-500" />
            <span className="text-white truncate ml-2 text-right flex-1 text-sm font-bold">{paymentMethod}</span>
          </button>
          <div className={`flex items-center bg-[#252538] rounded-2xl h-14 px-3 border shadow-lg min-w-0 overflow-hidden ${amountCurrencyBorderClassName}`}>
            <button onClick={toggleCurrency} className="flex items-center gap-1.5 pr-3 mr-3 border-r border-white/10 shrink-0 active:scale-95 transition-transform">
              <Globe size={14} className="text-gray-500" />
              <span className="text-[11px] text-gray-300 font-black tracking-widest">{currency}</span>
            </button>
            <input
              type="number"
              step="any"
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                clearAiField('amount');
                if (validationErrors.amount) {
                  setValidationErrors((prev) => ({ ...prev, amount: undefined }));
                }
              }}
              className={`flex-1 min-w-0 w-0 bg-transparent text-right text-2xl font-black leading-none focus:outline-none placeholder-gray-600 ${activeTab === '收入' ? 'text-rose-400' : 'text-emerald-400'}`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={`bg-[#252538] rounded-2xl h-14 px-4 flex items-center border shadow-lg overflow-hidden ${getAiBorderClass('merchant')}`}>
              <Store size={16} className="text-gray-500" />
              <input
                type="text"
                value={merchant}
                onChange={(e) => {
                  setMerchant(e.target.value);
                  clearAiField('merchant');
                }}
                placeholder="商家"
                className="bg-transparent text-white text-right focus:outline-none w-full font-bold placeholder-gray-700 text-sm ml-2"
              />
            </div>
            <SuggestionChips
              items={merchantSuggestions}
              onSelect={(value) => {
                setMerchant(value);
                clearAiField('merchant');
              }}
            />
          </div>
          <div>
            <div className={`bg-[#252538] rounded-2xl h-14 px-4 flex items-center border shadow-lg overflow-hidden ${getAiBorderClass('name')}`}>
              <Tag size={16} className="text-gray-500" />
              <input
                type="text"
                placeholder="名稱"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearAiField('name');
                }}
                className="w-full bg-transparent text-right text-sm font-bold focus:outline-none placeholder-gray-600 text-white ml-2"
              />
            </div>
            <SuggestionChips
              items={nameSuggestions}
              onSelect={(value) => {
                setName(value);
                clearAiField('name');
              }}
            />
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

        <div className={`bg-[#252538] rounded-2xl px-4 py-2 min-h-[156px] border shadow-lg transition-all focus-within:border-white/20 ${getAiBorderClass('note')}`}>
          <textarea
            rows={4}
            placeholder="輸入備註..."
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              clearAiField('note');
            }}
            className="w-full h-full min-h-[140px] bg-transparent resize-none text-sm focus:outline-none placeholder-gray-700 text-white font-light leading-relaxed"
          />
        </div>

        {isEditing && (
          <>
            <button onClick={handleDuplicate} className="w-full py-5 text-cyan-400 text-sm font-bold flex items-center justify-center gap-2 bg-cyan-500/5 rounded-2xl border border-cyan-500/10 active:bg-cyan-500/20 transition-all mt-4">
              <Copy size={20} /><span>複製項目</span>
            </button>
            <button onClick={handleDelete} className="w-full py-5 text-red-500 text-sm font-bold flex items-center justify-center gap-2 bg-red-500/5 rounded-2xl border border-red-500/10 active:bg-red-500/20 transition-all">
              <Trash2 size={20} /><span>刪除這筆紀錄</span>
            </button>
            <div className={`rounded-2xl border px-4 py-4 shadow-lg ${syncStatusMeta.panelClassName}`}>
              <div className="flex items-start gap-3">
                {hasManualSyncAction ? (
                  <button
                    type="button"
                    onClick={handleRetrySync}
                    disabled={isRetryDisabled}
                    title={retryButtonTitle}
                    aria-label={retryButtonTitle}
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${syncStatusMeta.iconClassName}`}
                  >
                    <SyncStatusIcon size={18} />
                  </button>
                ) : (
                  <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 ${syncStatusMeta.iconClassName}`}>
                    <SyncStatusIcon size={18} className={syncStatus === 'syncing' ? 'animate-spin' : undefined} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-white">{syncStatusMeta.label}</p>
                  <p className="mt-2 text-xs font-bold leading-relaxed text-slate-300">{syncStatusDescription}</p>
                  {hasSyncError && syncInfo?.lastSyncError && (
                    <p className="mt-3 break-all rounded-xl border border-rose-300/15 bg-rose-950/20 px-3 py-2 text-[11px] font-medium leading-relaxed text-rose-100">
                      {syncInfo.lastSyncError}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        </>
        )}
        </div>
      </div>
    </div>
  );
};

export default AddTransactionModal;
