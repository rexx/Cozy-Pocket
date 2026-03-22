import React, { useEffect, useMemo, useState } from 'react';
import { addMonths, addYears, format } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrencyAmount } from '../constants';
import { Transaction, TransactionType } from '../types';
import { filterTransactionsByTag, getMonthTags, getMonthTransactions, getStatsByCurrency, getYearTransactions } from '../services/statsService';
import PageHeader from './PageHeader';
import TransactionItem from './TransactionItem';

type StatsPeriodMode = 'month' | 'year';

interface MonthlyStatsPageProps {
  transactions: Transaction[];
  initialDate: Date;
  defaultCurrency: string;
  onBack: () => void;
  onTransactionClick: (transaction: Transaction) => void;
}

const MonthlyStatsPage: React.FC<MonthlyStatsPageProps> = ({
  transactions,
  initialDate,
  defaultCurrency,
  onBack,
  onTransactionClick,
}) => {
  const [periodMode, setPeriodMode] = useState<StatsPeriodMode>('month');
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [selectedTag, setSelectedTag] = useState('');
  const [expandedSectionKey, setExpandedSectionKey] = useState<string | null>(null);

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

  useEffect(() => {
    setExpandedSectionKey(null);
  }, [selectedDate, selectedTag, periodMode]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByTag(periodTransactions, selectedTag),
    [periodTransactions, selectedTag]
  );

  const statsByCurrency = useMemo(
    () => getStatsByCurrency(filteredTransactions),
    [filteredTransactions]
  );

  const currencies = Object.keys(statsByCurrency);

  const formatStatAmount = (value: number, currency: string) => (
    formatCurrencyAmount(value, currency, { withSpace: true })
  );
  const monthNavButtonClassName = 'pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#24273c]/80 text-gray-300 shadow-lg transition-all hover:text-white active:scale-90';
  const getSectionKey = (currency: string, type: TransactionType) => `${currency}:${type}`;
  const periodLabel = periodMode === 'month'
    ? format(selectedDate, 'yyyy 年 MM 月')
    : format(selectedDate, 'yyyy 年');
  const movePeriod = (direction: -1 | 1) => {
    setSelectedDate((prev) => (
      periodMode === 'month'
        ? addMonths(prev, direction)
        : addYears(prev, direction)
    ));
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] text-slate-200">
      <PageHeader
        title="統計"
        leftAction={<ArrowLeft size={26} />}
        onLeftAction={onBack}
      />

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
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">Tag 篩選</p>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
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

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {currencies.length > 0 ? (
          <div className="space-y-4">
            {currencies.map((currency) => {
              const stats = statsByCurrency[currency];
              const incomeTransactions = filteredTransactions
                .filter((tx) => tx.currency === currency && tx.type === '收入')
                .sort((a, b) => b.timestamp - a.timestamp);
              const expenseTransactions = filteredTransactions
                .filter((tx) => tx.currency === currency && tx.type === '支出')
                .sort((a, b) => b.timestamp - a.timestamp);
              const activeSectionKey = expandedSectionKey;

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
                      {selectedTag ? `#${selectedTag}` : '全部交易'}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3">
                    <button
                      type="button"
                      onClick={() => setExpandedSectionKey((prev) => prev === getSectionKey(currency, '收入') ? null : getSectionKey(currency, '收入'))}
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
                      onClick={() => setExpandedSectionKey((prev) => prev === getSectionKey(currency, '支出') ? null : getSectionKey(currency, '支出'))}
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
                          />
                        ))
                      ) : (
                        <div className="px-5 py-6 text-center text-sm font-bold text-gray-500">
                          沒有符合條件的支出項目
                        </div>
                      )}
                    </div>
                  )}
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
              {selectedTag
                ? `#${selectedTag} 在這個${periodMode === 'month' ? '月份' : '年份'}沒有資料`
                : `這個${periodMode === 'month' ? '月份' : '年份'}還沒有任何紀錄`}
            </p>
            <p className="mt-3 text-sm text-gray-500">
              目前摘要顯示為 {formatCurrencyAmount(0, defaultCurrency, { withSpace: true })}。
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyStatsPage;
