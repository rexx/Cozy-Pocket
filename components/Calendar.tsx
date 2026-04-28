
import React from 'react';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  isValid,
  isSameDay,
  isSameMonth,
  startOfWeek
} from 'date-fns';
import { ChevronLeft, ChevronRight, Search, Settings, CloudOff } from 'lucide-react';
import { toEpochSeconds } from '../time';
import { useHorizontalSwipe } from './useHorizontalSwipe';
import { CalendarViewMode, Transaction } from '../types';

interface CalendarProps {
  selectedDate: Date;
  viewMode: CalendarViewMode;
  onDateSelect: (date: Date) => void;
  onSearchClick: () => void;
  onSettingsClick: () => void;
  onSyncProgressClick?: () => void;
  isSyncProgressVisible?: boolean;
  isOffline?: boolean;
  transactions: Transaction[];
}

const Calendar: React.FC<CalendarProps> = ({
  selectedDate,
  viewMode,
  onDateSelect,
  onSearchClick,
  onSettingsClick,
  onSyncProgressClick,
  isSyncProgressVisible = false,
  isOffline = false,
  transactions
}) => {
  const safeDate = (selectedDate && isValid(selectedDate)) ? selectedDate : new Date();
  const today = new Date();
  const isCurrentlyToday = isSameDay(safeDate, today);
  const monthStart = new Date(safeDate.getFullYear(), safeDate.getMonth(), 1);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(safeDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(safeDate, { weekStartsOn: 1 });

  const dayOfWeekForStart = monthStart.getDay();
  const diffToMonday = (dayOfWeekForStart === 0 ? -6 : 1) - dayOfWeekForStart;
  const monthGridStart = new Date(monthStart);
  monthGridStart.setDate(monthStart.getDate() + diffToMonday);
  monthGridStart.setHours(0, 0, 0, 0);

  const startDate = viewMode === 'week' ? weekStart : monthGridStart;
  const endDate = viewMode === 'week' ? weekEnd : endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const goToNextPeriod = () => onDateSelect(viewMode === 'week' ? addDays(safeDate, 7) : addMonths(safeDate, 1));
  const goToPrevPeriod = () => onDateSelect(viewMode === 'week' ? addDays(safeDate, -7) : addMonths(safeDate, -1));
  const goToToday = () => onDateSelect(new Date());
  const monthNavButtonClassName = 'pointer-events-auto w-8 h-8 rounded-full bg-[#24273c]/80 border border-white/10 text-gray-300 flex items-center justify-center shadow-lg hover:text-white active:scale-90 transition-all';
  const iconButtonClassName = 'flex h-9 w-9 items-center justify-center text-gray-500 transition-all hover:text-cyan-400 active:scale-90';
  const actionSlotClassName = 'flex h-9 items-center justify-center';
  const { swipeHandlers, shouldSuppressClick } = useHorizontalSwipe({
    onSwipeLeft: goToNextPeriod,
    onSwipeRight: goToPrevPeriod,
  });

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];
  const previousPeriodLabel = viewMode === 'week' ? '上一週' : '上個月';
  const nextPeriodLabel = viewMode === 'week' ? '下一週' : '下個月';

  const hasTransactions = (day: Date) => {
    // Fix: replace missing startOfDay with manual date creation
    const dayStart = toEpochSeconds(new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime());
    const dayEnd = toEpochSeconds(endOfDay(day).getTime());
    return transactions.some(t => t.timestamp >= dayStart && t.timestamp <= dayEnd);
  };

  const handleHeaderDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      const [y, m, d] = val.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      if (isValid(newDate)) {
        onDateSelect(newDate);
      }
    }
  };

  return (
    <div className="bg-[#1a1c2c] p-4 pt-0 select-none">
      <div className="mb-3 flex w-full items-center gap-2 px-1">
        <div className="flex min-w-0 flex-1 items-center justify-between">
          <div className={actionSlotClassName}>
            <button
              onClick={onSearchClick}
              className={iconButtonClassName}
              title="搜尋"
              aria-label="搜尋"
            >
              <Search size={22} />
            </button>
          </div>

          <div className={`${actionSlotClassName} w-10`}>
            {!isCurrentlyToday && (
              <button
                onClick={goToToday}
                className="flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-black px-2 py-1.5 rounded-lg active:scale-90 transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)]"
                title="今天"
                aria-label="今天"
              >
                今
              </button>
            )}
          </div>
        </div>

        <div className="flex-none">
          <div className="relative">
            <input
              type="date"
              className="bg-[#252538] text-white text-xs font-bold px-3 py-2 rounded-full border border-white/10 appearance-none text-center cursor-pointer active:bg-white/5 transition-colors w-32"
              style={{ colorScheme: 'dark' }}
              value={format(safeDate, 'yyyy-MM-dd')}
              onChange={handleHeaderDateChange}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center">
          <div className="ml-auto flex items-center gap-1">
            <div className={actionSlotClassName}>
              {isOffline ? (
                <div
                  className="flex h-9 w-9 items-center justify-center text-amber-300"
                  title="目前離線，雲端同步與 AI 暫停"
                  aria-label="目前離線，雲端同步與 AI 暫停"
                >
                  <CloudOff size={20} />
                </div>
              ) : isSyncProgressVisible ? (
                <button
                  onClick={onSyncProgressClick}
                  className={`${iconButtonClassName} relative`}
                  title="開啟同步狀態頁"
                  aria-label="開啟同步狀態頁"
                >
                  <svg className="h-5 w-5 -rotate-90" viewBox="0 0 36 36" aria-hidden="true">
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      className="stroke-white/10"
                      strokeWidth="3"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="15.5"
                      fill="none"
                      className="stroke-cyan-400 animate-spin origin-center"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeDasharray="24 76"
                      pathLength="100"
                    />
                  </svg>
                </button>
              ) : null}
            </div>

            <div className={actionSlotClassName}>
              <button
                onClick={onSettingsClick}
                className={iconButtonClassName}
                title="資料管理"
                aria-label="資料管理"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        className="relative"
        style={{ touchAction: 'pan-y' }}
        {...swipeHandlers}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-between px-2">
          <button
            onClick={goToPrevPeriod}
            className={monthNavButtonClassName}
            aria-label={`切換到${previousPeriodLabel}`}
            title={previousPeriodLabel}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={goToNextPeriod}
            className={monthNavButtonClassName}
            aria-label={`切換到${nextPeriodLabel}`}
            title={nextPeriodLabel}
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className={`grid grid-cols-7 text-center ${viewMode === 'week' ? 'gap-y-2' : 'gap-y-1'}`}>
          {weekDays.map(day => (
            <span key={day} className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{day}</span>
          ))}
          {calendarDays.map((day, i) => {
            const isSelected = isSameDay(day, safeDate);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isRecordedDay = hasTransactions(day);
            const dayOfWeek = getDay(day); 
            
            let dayTextColor = 'text-gray-500';
            if (isCurrentMonth) {
              dayTextColor = 'text-gray-200';
              if (dayOfWeek === 6) dayTextColor = 'text-emerald-500/80';
              if (dayOfWeek === 0) dayTextColor = 'text-red-500/80';
            } else {
              dayTextColor = 'text-gray-700';
            }

            return (
              <div 
                key={i} 
                onClick={() => {
                  if (shouldSuppressClick()) return;
                  onDateSelect(day);
                }}
                className={`relative flex flex-col items-center justify-center cursor-pointer ${viewMode === 'week' ? 'py-2' : 'py-1'}`}
              >
                <div className={`
                  w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300
                  ${isSelected ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(34,211,238,0.5)] scale-110' : ''}
                  ${!isSelected && isRecordedDay ? 'bg-gray-500/15' : ''}
                  ${!isSelected && isCurrentMonth && isSameDay(day, new Date()) ? 'border border-white/20' : ''}
                `}>
                  <span className={`text-sm ${isSelected ? 'text-black' : dayTextColor}`}>
                    {format(day, 'd')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Calendar;
