import React, { useEffect, useMemo, useState } from 'react';
import { addMonths, addYears, format } from 'date-fns';
import { ArrowDownUp, ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Filter, MoreHorizontal } from 'lucide-react';
import { CATEGORIES, formatCurrencyAmount } from '../constants';
import { PaymentMethod, PaymentMethodDisplayMode, Transaction, TransactionType } from '../types';
import { CategoryStatsItem, filterTransactionsByTag, getCategoryStats, getMonthTags, getMonthTransactions, getStatsByCurrency, getYearTransactions } from '../services/statsService';
import PageHeader from './PageHeader';
import TransactionItem from './TransactionItem';
import { categoryIconMap } from './categoryIcons';

type StatsPeriodMode = 'month' | 'year';
type StatsSortMode = 'latest' | 'amount-desc';

interface MonthlyStatsPageProps {
  transactions: Transaction[];
  initialDate: Date;
  defaultCurrency: string;
  paymentMethodDisplayMode: PaymentMethodDisplayMode;
  onBack: () => void;
  onTransactionClick: (transaction: Transaction) => void;
}

interface CategoryStatsByCurrency {
  income: CategoryStatsItem[];
  expense: CategoryStatsItem[];
}

const CATEGORY_BY_ID = new Map(CATEGORIES.map((category) => [category.id, category]));
const UNKNOWN_CATEGORY_COLOR = '#64748b';

const getCategoryName = (categoryId: string) => (
  CATEGORY_BY_ID.get(categoryId)?.name || '未分類'
);

const getCategoryColor = (categoryId: string) => (
  CATEGORY_BY_ID.get(categoryId)?.color || UNKNOWN_CATEGORY_COLOR
);

const getCategoryIconName = (categoryId: string) => (
  String(CATEGORY_BY_ID.get(categoryId)?.icon || 'MoreHorizontal')
);

const getSubCategoryName = (categoryId: string, subCategoryId: string) => {
  if (!subCategoryId) return '未選子類別';

  const subCategory = CATEGORY_BY_ID
    .get(categoryId)
    ?.subcategories
    ?.find((item) => item.id === subCategoryId);

  return subCategory?.name || '未知子類別';
};

const compareCategoryStatsItems = (a: CategoryStatsItem, b: CategoryStatsItem) => {
  if (b.total !== a.total) return b.total - a.total;
  if (b.count !== a.count) return b.count - a.count;
  return getCategoryName(a.categoryId).localeCompare(getCategoryName(b.categoryId), 'zh-Hant');
};

const MonthlyStatsPage: React.FC<MonthlyStatsPageProps> = ({
  transactions,
  initialDate,
  defaultCurrency,
  paymentMethodDisplayMode,
  onBack,
  onTransactionClick,
}) => {
  const [periodMode, setPeriodMode] = useState<StatsPeriodMode>('month');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | ''>('');
  const [sortMode, setSortMode] = useState<StatsSortMode>('latest');
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>(null);

  useEffect(() => {
    setSelectedDate(initialDate);
  }, [initialDate]);

  const periodTransactions = useMemo(
    () => (periodMode === 'month'
      ? getMonthTransactions(transactions, selectedDate)
      : getYearTransactions(transactions, selectedDate)),
    [transactions, selectedDate, periodMode]
  );

  const periodTags = useMemo(
    () => getMonthTags(periodTransactions),
    [periodTransactions]
  );

  useEffect(() => {
    if (selectedTag && !periodTags.includes(selectedTag)) {
      setSelectedTag('');
    }
  }, [periodTags, selectedTag]);

  const periodPaymentMethods = useMemo(() => {
    const methodSet = new Set<PaymentMethod>();
    periodTransactions.forEach((tx) => {
      if (tx.paymentMethod) {
        methodSet.add(tx.paymentMethod as PaymentMethod);
      }
    });
    return Array.from(methodSet);
  }, [periodTransactions]);

  useEffect(() => {
    if (selectedPaymentMethod && !periodPaymentMethods.includes(selectedPaymentMethod)) {
      setSelectedPaymentMethod('');
    }
  }, [periodPaymentMethods, selectedPaymentMethod]);

  useEffect(() => {
    setExpandedSectionKey(null);
    setExpandedCategoryKey(null);
  }, [selectedDate, selectedTag, selectedPaymentMethod, periodMode]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByTag(periodTransactions, selectedTag).filter((tx) => (
      selectedPaymentMethod ? tx.paymentMethod === selectedPaymentMethod : true
    )),
    [periodTransactions, selectedTag, selectedPaymentMethod]
  );

  const statsByCurrency = useMemo(
    () => getStatsByCurrency(filteredTransactions),
    [filteredTransactions]
  );

  const categoryStats = useMemo(
    () => getCategoryStats(filteredTransactions),
    [filteredTransactions]
  );

  const categoryStatsByCurrency = useMemo(() => {
    const grouped = categoryStats.reduce((acc, item) => {
      if (!acc[item.currency]) {
        acc[item.currency] = { income: [], expense: [] };
      }

      if (item.type === '收入') {
        acc[item.currency].income.push(item);
      } else {
        acc[item.currency].expense.push(item);
      }

      return acc;
    }, {} as Record<string, CategoryStatsByCurrency>);

    Object.values(grouped).forEach((item) => {
      item.income.sort(compareCategoryStatsItems);
      item.expense.sort(compareCategoryStatsItems);
    });

    return grouped;
  }, [categoryStats]);

  const currencies = Object.keys(statsByCurrency);

  const formatStatAmount = (value: number, currency: string) => (
    formatCurrencyAmount(value, currency, { withSpace: true })
  );
  const sortTransactions = (items: Transaction[]) => [...items].sort((a, b) => {
    if (sortMode === 'amount-desc') {
      const amountOrder = a.type === '支出'
        ? a.amount - b.amount
        : b.amount - a.amount;
      if (amountOrder !== 0) return amountOrder;
    }
    return b.timestamp - a.timestamp;
  });
  const monthNavButtonClassName = 'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#24273c]/80 text-gray-300 shadow-lg transition-all hover:text-white active:scale-90';
  const getSectionKey = (currency: string, type: TransactionType) => `${currency}:${type}`;
  const getCategoryKey = (item: CategoryStatsItem) => `${item.currency}:${item.type}:${item.categoryId}`;
  const periodLabel = periodMode === 'month'
    ? format(selectedDate, 'yyyy 年 MM 月')
    : format(selectedDate, 'yyyy 年');
  const selectedSortLabel = sortMode === 'latest' ? '日期' : '金額';
  const hasActiveFilters = Boolean(selectedTag || selectedPaymentMethod);
  const activeFilterBadgeLabel = hasActiveFilters
    ? [selectedTag ? `#${selectedTag}` : null, selectedPaymentMethod || null].filter(Boolean).join(' · ')
    : '全部交易';
  const movePeriod = (direction: -1 | 1) => {
    setSelectedDate((prev) => (
      periodMode === 'month'
        ? addMonths(prev, direction)
        : addYears(prev, direction)
    ));
  };
  const toggleSortMode = () => {
    setSortMode((prev) => (prev === 'latest' ? 'amount-desc' : 'latest'));
  };
  const renderCategoryStatsGroup = (
    type: TransactionType,
    items: CategoryStatsItem[],
    typeTotal: number,
    currency: string
  ) => {
    const isIncome = type === '收入';
    const groupCount = items.reduce((sum, item) => sum + item.count, 0);
    const emptyMessage = isIncome ? '沒有收入類別資料' : '沒有支出類別資料';

    return (
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isIncome ? 'text-rose-300/70' : 'text-emerald-300/70'}`}>
            {type}類別
          </p>
          <p className="shrink-0 text-[10px] font-black text-gray-500">
            {groupCount} 筆
          </p>
        </div>

        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item) => {
              const categoryKey = getCategoryKey(item);
              const categoryName = getCategoryName(item.categoryId);
              const categoryColor = getCategoryColor(item.categoryId);
              const IconComp = categoryIconMap[getCategoryIconName(item.categoryId)] || MoreHorizontal;
              const isExpanded = expandedCategoryKey === categoryKey;
              const percentage = typeTotal > 0
                ? Math.round((item.total / typeTotal) * 100)
                : 0;
              const sortedItemTransactions = sortTransactions(item.transactions);

              return (
                <div key={categoryKey}>
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedSectionKey(null);
                      setExpandedCategoryKey((prev) => (prev === categoryKey ? null : categoryKey));
                    }}
                    className={`w-full rounded-2xl border p-3 text-left transition-all active:scale-[0.99] ${
                      isExpanded
                        ? 'border-cyan-300/25 bg-cyan-500/10'
                        : 'border-white/8 bg-white/[0.035] hover:border-white/15 hover:bg-white/[0.055]'
                    }`}
                    aria-expanded={isExpanded}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl shadow-lg"
                        style={{ backgroundColor: categoryColor }}
                      >
                        <IconComp size={20} color="white" strokeWidth={2.5} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-black text-gray-100">{categoryName}</p>
                          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-black ${
                            isIncome
                              ? 'border-rose-400/20 bg-rose-500/10 text-rose-200'
                              : 'border-emerald-400/20 bg-emerald-500/10 text-emerald-200'
                          }`}>
                            {type}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] font-bold text-gray-500">
                          {item.count} 筆 · {percentage}%
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <div className="text-right">
                          <p className={`text-sm font-black tabular-nums ${isIncome ? 'text-rose-300' : 'text-emerald-300'}`}>
                            {isIncome ? '+' : '-'}{formatStatAmount(item.total, currency)}
                          </p>
                          <p className="mt-1 text-[9px] font-black text-gray-600">
                            {formatStatAmount(typeTotal, currency)}
                          </p>
                        </div>
                        <ChevronDown
                          size={16}
                          className={`text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          strokeWidth={2.4}
                        />
                      </div>
                    </div>

                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, percentage)}%`,
                          backgroundColor: categoryColor,
                        }}
                      />
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 space-y-3">
                      {item.subcategories.length > 0 && (
                        <div className="space-y-2">
                          {item.subcategories.map((subItem) => (
                            <div
                              key={`${categoryKey}:${subItem.subCategoryId || 'none'}`}
                              className="flex items-center justify-between gap-3 rounded-2xl bg-white/[0.045] px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-black text-gray-100">
                                  {getSubCategoryName(item.categoryId, subItem.subCategoryId)}
                                </p>
                                <p className="mt-1 text-xs font-bold text-gray-500">
                                  {subItem.count} 筆
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-black tabular-nums text-gray-200">
                                {formatStatAmount(subItem.total, currency)}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="overflow-hidden rounded-[1.2rem] border border-white/8 bg-[#1b1f31]/85">
                        {sortedItemTransactions.length > 0 ? (
                          sortedItemTransactions.map((transaction) => (
                            <TransactionItem
                              key={transaction.id}
                              transaction={transaction}
                              onClick={onTransactionClick}
                              paymentMethodDisplayMode={paymentMethodDisplayMode}
                              showDateTime
                            />
                          ))
                        ) : (
                          <div className="px-5 py-6 text-center text-sm font-bold text-gray-500">
                            沒有符合條件的交易項目
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-4 py-5 text-center text-xs font-bold text-gray-500">
            {emptyMessage}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] text-slate-200">
      <PageHeader
        title="統計"
        leftAction={<ArrowLeft size={26} />}
        onLeftAction={onBack}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="border-b border-white/5 px-5 py-4">
          <div className="rounded-2xl border border-white/10 bg-[#24273c]/80 p-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#1f2334]/80 p-1">
              {[
                { id: 'month', label: '月份' },
                { id: 'year', label: '年份' },
              ].map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setPeriodMode(option.id as StatsPeriodMode)}
                  className={`rounded-[0.9rem] px-3 py-2 text-sm font-black transition-all ${
                    periodMode === option.id
                      ? 'bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="my-3 h-px bg-white/8" />

            <div className="flex items-center justify-between">
              <button
                onClick={() => movePeriod(-1)}
                className={monthNavButtonClassName}
                aria-label={periodMode === 'month' ? '切換到上個月' : '切換到上一年'}
                title={periodMode === 'month' ? '上個月' : '上一年'}
              >
                <ChevronLeft size={18} />
              </button>
              <p className="text-center text-xl font-black tracking-tight text-white">{periodLabel}</p>
              <button
                onClick={() => movePeriod(1)}
                className={monthNavButtonClassName}
                aria-label={periodMode === 'month' ? '切換到下個月' : '切換到下一年'}
                title={periodMode === 'month' ? '下個月' : '下一年'}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        <div className="border-b border-white/5 px-5 py-4">
          <div className="flex items-center justify-end gap-2">
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setIsFilterPanelOpen((prev) => !prev)}
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-full border border-white/10 bg-white/5 text-gray-300 shadow-lg transition-all hover:text-white active:scale-[0.99]"
                aria-expanded={isFilterPanelOpen}
                aria-label={isFilterPanelOpen ? '收合篩選' : '展開篩選'}
              >
                <Filter size={14} strokeWidth={2.3} />
              </button>
            </div>

            <div className="flex items-center">
              <button
                type="button"
                onClick={toggleSortMode}
                className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 text-[10px] font-black text-gray-300 shadow-lg transition-all hover:text-white active:scale-[0.99]"
                aria-label={`切換排序，目前為${selectedSortLabel}`}
              >
                <ArrowDownUp size={12} strokeWidth={2.3} />
                {selectedSortLabel}
              </button>
            </div>
          </div>

          {isFilterPanelOpen && (
            <div className="mt-3 rounded-2xl border border-white/10 bg-[#24273c]/70 px-4 py-4 shadow-lg">
              <div className="space-y-4">
                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">TAG</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedTag('')}
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition-all ${
                        selectedTag === ''
                          ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      全部
                    </button>
                    {periodTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(tag)}
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition-all ${
                          selectedTag === tag
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">支付方式</p>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod('')}
                      className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition-all ${
                        selectedPaymentMethod === ''
                          ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                          : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                      }`}
                    >
                      全部
                    </button>
                    {periodPaymentMethods.map((paymentMethod) => (
                      <button
                        key={paymentMethod}
                        type="button"
                        onClick={() => setSelectedPaymentMethod(paymentMethod)}
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition-all ${
                          selectedPaymentMethod === paymentMethod
                            ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200 shadow-[0_0_16px_rgba(34,211,238,0.12)]'
                            : 'border-white/10 bg-white/5 text-gray-400 hover:text-white'
                        }`}
                      >
                        {paymentMethod}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-5">
          {currencies.length > 0 ? (
            <div className="space-y-4">
              {currencies.map((currency) => {
                const stats = statsByCurrency[currency];
                const incomeTransactions = sortTransactions(
                  filteredTransactions.filter((tx) => tx.currency === currency && tx.type === '收入')
                );
                const expenseTransactions = sortTransactions(
                  filteredTransactions.filter((tx) => tx.currency === currency && tx.type === '支出')
                );
                const activeSectionKey = expandedSectionKey;
                const currencyCategoryStats = categoryStatsByCurrency[currency] || { income: [], expense: [] };
                const categoryCount = currencyCategoryStats.income.length + currencyCategoryStats.expense.length;

                return (
                  <section
                    key={currency}
                    className="rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(36,39,60,0.95),rgba(20,24,39,0.95))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.28)]"
                  >
                    <div className="mb-5 flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">幣別</p>
                        <h2 className="mt-1 text-2xl font-black tracking-tight text-white">{currency}</h2>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-gray-400">
                        {activeFilterBadgeLabel}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setExpandedCategoryKey(null);
                          setExpandedSectionKey((prev) => prev === getSectionKey(currency, '收入') ? null : getSectionKey(currency, '收入'));
                        }}
                        className={`rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                          activeSectionKey === getSectionKey(currency, '收入')
                            ? 'border-rose-300/30 bg-rose-500/15'
                            : 'border-rose-400/15 bg-rose-500/10'
                        }`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-300/70">收入</p>
                        <p className="mt-2 text-3xl font-black tracking-tight text-rose-300">
                          +{formatStatAmount(stats.income, currency)}
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setExpandedCategoryKey(null);
                          setExpandedSectionKey((prev) => prev === getSectionKey(currency, '支出') ? null : getSectionKey(currency, '支出'));
                        }}
                        className={`rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                          activeSectionKey === getSectionKey(currency, '支出')
                            ? 'border-emerald-300/30 bg-emerald-500/15'
                            : 'border-emerald-400/15 bg-emerald-500/10'
                        }`}
                      >
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300/70">支出</p>
                        <p className="mt-2 text-3xl font-black tracking-tight text-emerald-300">
                          -{formatStatAmount(stats.expense, currency)}
                        </p>
                      </button>
                    </div>

                    {activeSectionKey === getSectionKey(currency, '收入') && (
                      <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/8 bg-[#1b1f31]/85">
                        {incomeTransactions.length > 0 ? (
                          incomeTransactions.map((transaction) => (
                            <TransactionItem
                              key={transaction.id}
                              transaction={transaction}
                              onClick={onTransactionClick}
                              paymentMethodDisplayMode={paymentMethodDisplayMode}
                              showDateTime
                            />
                          ))
                        ) : (
                          <div className="px-5 py-6 text-center text-sm font-bold text-gray-500">
                            沒有符合條件的收入項目
                          </div>
                        )}
                      </div>
                    )}

                    {activeSectionKey === getSectionKey(currency, '支出') && (
                      <div className="mt-4 overflow-hidden rounded-[1.2rem] border border-white/8 bg-[#1b1f31]/85">
                        {expenseTransactions.length > 0 ? (
                          expenseTransactions.map((transaction) => (
                            <TransactionItem
                              key={transaction.id}
                              transaction={transaction}
                              onClick={onTransactionClick}
                              paymentMethodDisplayMode={paymentMethodDisplayMode}
                              showDateTime
                            />
                          ))
                        ) : (
                          <div className="px-5 py-6 text-center text-sm font-bold text-gray-500">
                            沒有符合條件的支出項目
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-5 border-t border-white/8 pt-5">
                      <div className="mb-4 flex items-end justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">分析</p>
                          <h3 className="mt-1 truncate text-lg font-black text-white">依類別彙整</h3>
                        </div>
                        <div className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-black text-gray-400">
                          {categoryCount} 類別
                        </div>
                      </div>

                      <div className="space-y-5">
                        {renderCategoryStatsGroup('支出', currencyCategoryStats.expense, stats.expense, currency)}
                        {renderCategoryStatsGroup('收入', currencyCategoryStats.income, stats.income, currency)}
                      </div>
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
              <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">
                {periodLabel}
              </div>
              <p className="mt-6 text-lg font-bold text-gray-300">
                {hasActiveFilters
                  ? `目前篩選在這個${periodMode === 'month' ? '月份' : '年份'}沒有資料`
                  : `這個${periodMode === 'month' ? '月份' : '年份'}還沒有任何紀錄`}
              </p>
              <p className="mt-3 text-sm text-gray-500">
                目前摘要顯示為 {formatCurrencyAmount(0, defaultCurrency, { withSpace: true })}。
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonthlyStatsPage;
