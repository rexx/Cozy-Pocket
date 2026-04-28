import React from 'react';
import { Plus, Globe, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react';
import Calendar from './Calendar';
import TransactionItem from './TransactionItem';
import { CalendarViewMode, Transaction } from '../types';
import { useHorizontalSwipe } from './useHorizontalSwipe';

interface HomePageProps {
  selectedDate: Date;
  calendarViewMode: CalendarViewMode;
  transactions: Transaction[];
  dailyTransactions: Transaction[];
  monthlyStatsByCurrency: Record<string, { income: number; expense: number }>;
  dailyStatsByCurrency: Record<string, { income: number; expense: number }>;
  defaultCurrency: string;
  isOffline: boolean;
  isSyncProgressVisible: boolean;
  onDateSelect: (date: Date) => void;
  onCalendarViewModeChange: (mode: CalendarViewMode) => void;
  onPrevDay: () => void;
  onNextDay: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  onOpenSyncStatus: () => void;
  onOpenStats: () => void;
  onOpenAddTransaction: () => void;
  onTransactionClick: (transaction: Transaction) => void;
  formatStatAmount: (value: number, currency: string) => string;
}

const HomePage: React.FC<HomePageProps> = ({
  selectedDate,
  calendarViewMode,
  transactions,
  dailyTransactions,
  monthlyStatsByCurrency,
  dailyStatsByCurrency,
  defaultCurrency,
  isOffline,
  isSyncProgressVisible,
  onDateSelect,
  onCalendarViewModeChange,
  onPrevDay,
  onNextDay,
  onOpenSearch,
  onOpenSettings,
  onOpenSyncStatus,
  onOpenStats,
  onOpenAddTransaction,
  onTransactionClick,
  formatStatAmount,
}) => {
  const dailyCurrencyCount = Object.keys(dailyStatsByCurrency).length;
  const monthlyCurrencyCount = Object.keys(monthlyStatsByCurrency).length;
  const nextCalendarViewMode: CalendarViewMode = calendarViewMode === 'week' ? 'month' : 'week';
  const CalendarToggleIcon = calendarViewMode === 'week' ? ChevronDown : ChevronUp;
  const calendarToggleLabel = calendarViewMode === 'week' ? '展開月曆' : '收合為週曆';
  const { swipeHandlers, shouldSuppressClick } = useHorizontalSwipe({
    onSwipeLeft: onNextDay,
    onSwipeRight: onPrevDay,
  });

  const buildVisibleStatLines = (stats: { income: number; expense: number }, currency: string) => {
    const lines: Array<{ key: 'income' | 'expense'; text: string; className: string }> = [];

    if (stats.income > 0) {
      lines.push({
        key: 'income',
        text: `+${formatStatAmount(stats.income, currency)}`,
        className: 'text-rose-400/80 font-bold text-[11px] tabular-nums truncate',
      });
    }

    if (stats.expense > 0) {
      lines.push({
        key: 'expense',
        text: `-${formatStatAmount(stats.expense, currency)}`,
        className: 'text-emerald-400/80 font-bold text-[11px] tabular-nums truncate',
      });
    }

    return lines;
  };

  const buildVisibleDailyStatLines = (stats: { income: number; expense: number }, currency: string) => {
    const lines: Array<{ key: 'income' | 'expense'; text: string; className: string }> = [];

    if (stats.income > 0) {
      lines.push({
        key: 'income',
        text: `+${formatStatAmount(stats.income, currency)}`,
        className: 'text-rose-400 font-black text-[11px] tabular-nums tracking-tighter leading-none truncate',
      });
    }

    if (stats.expense > 0) {
      lines.push({
        key: 'expense',
        text: `-${formatStatAmount(stats.expense, currency)}`,
        className: 'text-emerald-400 font-black text-[11px] tabular-nums tracking-tighter leading-none truncate',
      });
    }

    return lines;
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#1a1c2c] overflow-hidden relative font-sans text-slate-200">
      <div className="relative flex-none z-30 bg-[#1a1c2c] shadow-lg shadow-black/40">
        <Calendar 
          selectedDate={selectedDate}
          viewMode={calendarViewMode}
          onDateSelect={onDateSelect}
          onSearchClick={onOpenSearch}
          onSettingsClick={onOpenSettings}
          onSyncProgressClick={onOpenSyncStatus}
          isSyncProgressVisible={isSyncProgressVisible}
          isOffline={isOffline}
          transactions={transactions}
        />
        <button
          type="button"
          onClick={() => onCalendarViewModeChange(nextCalendarViewMode)}
          className="absolute bottom-0 left-1/2 z-50 inline-flex h-8 w-8 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#24273c] text-gray-300 shadow-[0_6px_18px_rgba(0,0,0,0.35)] ring-4 ring-[#1a1c2c] transition-all hover:text-white active:scale-95"
          aria-expanded={calendarViewMode === 'month'}
          aria-label={calendarToggleLabel}
          title={calendarToggleLabel}
        >
          <CalendarToggleIcon size={18} />
        </button>
      </div>
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-between px-6">
          <button
            onClick={onPrevDay}
            className="pointer-events-auto w-8 h-8 rounded-full bg-[#24273c]/80 border border-white/10 text-gray-300 flex items-center justify-center shadow-lg hover:text-white active:scale-90 transition-all"
            aria-label="切換到昨天"
            title="昨天"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={onNextDay}
            className="pointer-events-auto w-8 h-8 rounded-full bg-[#24273c]/80 border border-white/10 text-gray-300 flex items-center justify-center shadow-lg hover:text-white active:scale-90 transition-all"
            aria-label="切換到明天"
            title="明天"
          >
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="absolute right-8 bottom-[calc(2rem+env(safe-area-inset-bottom))] z-40">
          <button onClick={onOpenAddTransaction} className="w-16 h-16 bg-cyan-500 text-black rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(34,211,238,0.4)] active:scale-90 transition-all hover:brightness-110">
            <Plus size={36} strokeWidth={2.5} />
          </button>
        </div>
        <div
          className="overflow-y-auto no-scrollbar overscroll-contain h-full min-h-0"
          style={{ touchAction: 'pan-y' }}
          {...swipeHandlers}
        >
          <div className="mt-2 min-h-[calc(100%+1px)] space-y-1 pb-[calc(8.5rem+env(safe-area-inset-bottom))]">
            {dailyTransactions.length > 0 ? (
              dailyTransactions.map(tx => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onClick={onTransactionClick}
                  shouldSuppressClick={shouldSuppressClick}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-20 px-10 text-center">
                <div className="text-7xl mb-6 filter grayscale opacity-40">☕</div>
                <p className="text-gray-400 font-medium text-lg">今天還沒有任何紀錄</p>
              </div>
            )}

            <div className="px-6 pt-12">
              <button
                type="button"
                onClick={() => {
                  if (shouldSuppressClick()) return;
                  onOpenStats();
                }}
                className="w-full bg-[#24273c]/50 border border-white/5 rounded-[1.2rem] p-4 flex items-start shadow-xl text-left transition-all hover:border-cyan-500/20 hover:bg-[#2a2d44]/70 active:scale-[0.99]"
              >
                <div className="flex-1 self-stretch border-r border-white/5 pr-4 space-y-1.5 opacity-60">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-gray-500 text-[9px] font-black uppercase tracking-[0.1em]">本月</span>
                    {monthlyCurrencyCount > 1 && <Globe size={10} className="text-cyan-500" aria-hidden="true" />}
                  </div>
                  {Object.entries(monthlyStatsByCurrency).length > 0 ? (
                    Object.entries(monthlyStatsByCurrency).map(([curr, stats]) => (
                      <div key={curr} className="mb-2 last:mb-0">
                        {buildVisibleStatLines(stats, curr).map((line) => (
                          <div key={line.key} className={line.className}>{line.text}</div>
                        ))}
                      </div>
                    )).slice(0, 2)
                  ) : (
                    <div className="text-gray-700 font-bold text-[11px]">{formatStatAmount(0, defaultCurrency)}</div>
                  )}
                  {monthlyCurrencyCount > 2 && <div className="text-[8px] text-gray-600 font-black">+ 更多幣別</div>}
                </div>

                <div className="flex-[1.2] pl-4 space-y-1.5 text-right">
                  <div className="flex items-center justify-end gap-1 mb-1">
                    <span className="text-gray-400 text-[10px] font-black uppercase tracking-[0.2em]">本日</span>
                    {dailyCurrencyCount > 1 && <Globe size={10} className="text-cyan-500" aria-hidden="true" />}
                  </div>
                  {Object.entries(dailyStatsByCurrency).length > 0 ? (
                    Object.entries(dailyStatsByCurrency).map(([curr, stats]) => (
                      <div key={curr} className="mb-3 last:mb-0">
                        {buildVisibleDailyStatLines(stats, curr).map((line) => (
                          <div key={line.key} className={line.className}>{line.text}</div>
                        ))}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-700 font-black text-[11px]">{formatStatAmount(0, defaultCurrency)}</div>
                  )}
                </div>
              </button>
              <p className="text-center text-[10px] text-gray-700 font-bold uppercase tracking-[0.4em] mt-12 opacity-15">Cozy Pocket • Minimalism</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
