import React, { useEffect, useMemo, useState } from 'react';
import { addMonths, format } from 'date-fns';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrencyAmount } from '../constants';
import { Transaction } from '../types';
import { filterTransactionsByTag, getMonthTags, getMonthTransactions, getStatsByCurrency } from '../services/statsService';
import PageHeader from './PageHeader';

interface MonthlyStatsPageProps {
  transactions: Transaction[];
  initialDate: Date;
  defaultCurrency: string;
  onBack: () => void;
}

const MonthlyStatsPage: React.FC<MonthlyStatsPageProps> = ({
  transactions,
  initialDate,
  defaultCurrency,
  onBack,
}) => {
  const [selectedMonth, setSelectedMonth] = useState(initialDate);
  const [selectedTag, setSelectedTag] = useState('');

  useEffect(() => {
    setSelectedMonth(initialDate);
  }, [initialDate]);

  const monthTransactions = useMemo(
    () => getMonthTransactions(transactions, selectedMonth),
    [transactions, selectedMonth]
  );

  const monthTags = useMemo(
    () => getMonthTags(monthTransactions),
    [monthTransactions]
  );

  useEffect(() => {
    if (selectedTag && !monthTags.includes(selectedTag)) {
      setSelectedTag('');
    }
  }, [monthTags, selectedTag]);

  const filteredTransactions = useMemo(
    () => filterTransactionsByTag(monthTransactions, selectedTag),
    [monthTransactions, selectedTag]
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

  return (
    <div className="flex h-full w-full flex-col bg-[#1a1c2c] text-slate-200">
      <PageHeader
        title="月份統計"
        leftAction={<ArrowLeft size={26} />}
        onLeftAction={onBack}
      />

      <div className="border-b border-white/5 px-5 py-4">
        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#24273c]/80 px-3 py-3 shadow-lg">
          <button
            onClick={() => setSelectedMonth((prev) => addMonths(prev, -1))}
            className={monthNavButtonClassName}
            aria-label="切換到上個月"
            title="上個月"
          >
            <ChevronLeft size={18} />
          </button>
          <p className="text-center text-xl font-black tracking-tight text-white">{format(selectedMonth, 'yyyy 年 MM 月')}</p>
          <button
            onClick={() => setSelectedMonth((prev) => addMonths(prev, 1))}
            className={monthNavButtonClassName}
            aria-label="切換到下個月"
            title="下個月"
          >
            <ChevronRight size={18} />
          </button>
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
          {monthTags.map((tag) => (
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
              const net = stats.income - stats.expense;

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
                    <div className="rounded-2xl border border-rose-400/15 bg-rose-500/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-300/70">收入</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-rose-300">
                        +{formatStatAmount(stats.income, currency)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300/70">支出</p>
                      <p className="mt-2 text-3xl font-black tracking-tight text-emerald-300">
                        -{formatStatAmount(stats.expense, currency)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/10 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-cyan-300/70">淨額</p>
                      <p className={`mt-2 text-3xl font-black tracking-tight ${net >= 0 ? 'text-cyan-200' : 'text-amber-200'}`}>
                        {net >= 0 ? '+' : '-'}
                        {formatStatAmount(Math.abs(net), currency)}
                      </p>
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="flex min-h-full flex-col items-center justify-center px-8 text-center">
            <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-gray-500">
              {format(selectedMonth, 'yyyy 年 MM 月')}
            </div>
            <p className="mt-6 text-lg font-bold text-gray-300">
              {selectedTag ? `#${selectedTag} 在這個月份沒有資料` : '這個月份還沒有任何紀錄'}
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
