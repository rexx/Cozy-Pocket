
import React from 'react';
import {
  format, 
  endOfMonth, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  getDay,
  isValid,
  endOfDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Search, Settings, CloudOff } from 'lucide-react';
import { toEpochSeconds } from '../time';
import { useHorizontalSwipe } from './useHorizontalSwipe';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onSearchClick: () => void;
  onSettingsClick: () => void;
  onSyncProgressClick?: () => void;
  isSyncProgressVisible?: boolean;
  isOffline?: boolean;
  transactions: any[];
}

const Calendar: React.FC<CalendarProps> = ({
  selectedDate,
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
  
  const dayOfWeekForStart = monthStart.getDay();
  const diffToMonday = (dayOfWeekForStart === 0 ? -6 : 1) - dayOfWeekForStart;
  const startDate = new Date(monthStart);
  startDate.setDate(monthStart.getDate() + diffToMonday);
  startDate.setHours(0, 0, 0, 0);

  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const nextMonth = () => onDateSelect(addMonths(safeDate, 1));
  const prevMonth = () => onDateSelect(addMonths(safeDate, -1));
  const goToToday = () => onDateSelect(new Date());
  const monthNavButtonClassName = 'pointer-events-auto w-9 h-9 rounded-full bg-[#24273c]/80 border border-white/10 text-gray-300 flex items-center justify-center shadow-lg hover:text-white active:scale-90 transition-all';
  const { swipeHandlers, shouldSuppressClick } = useHorizontalSwipe({
    onSwipeLeft: nextMonth,
    onSwipeRight: prevMonth,
  });

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

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
      <div className="grid grid-cols-3 items-center mb-4 px-1">
        <div className="flex items-center gap-1 justify-self-start">
          <div className="w-9 flex justify-center">
            {!isCurrentlyToday && (
              <button 
                onClick={goToToday}
                className="flex items-center justify-center bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[10px] font-black px-2 py-1.5 rounded-lg active:scale-90 transition-all shadow-[0_0_10px_rgba(34,211,238,0.1)]"
              >
                今
              </button>
            )}
          </div>
        </div>

        <div className="flex justify-center">
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

        <div className="flex items-center gap-1 justify-self-end">
          {isOffline ? (
            <div
              className="text-amber-300 p-2"
              title="目前離線，雲端同步與 AI 暫停"
              aria-label="目前離線，雲端同步與 AI 暫停"
            >
              <CloudOff size={20} />
            </div>
          ) : isSyncProgressVisible && (
            <button
              onClick={onSyncProgressClick}
              className="relative text-gray-500 p-2 hover:text-cyan-400 active:scale-90 transition-all"
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
          )}
          <button 
            onClick={onSettingsClick}
            className="text-gray-500 p-2 hover:text-cyan-400 active:scale-90 transition-all"
            title="資料管理"
          >
            <Settings size={20} />
          </button>

          <button 
            onClick={onSearchClick}
            className="text-gray-500 p-2 hover:text-cyan-400 active:scale-90 transition-all"
          >
            <Search size={22} />
          </button>
        </div>
      </div>

      <div
        className="relative"
        style={{ touchAction: 'pan-y' }}
        {...swipeHandlers}
      >
        <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 z-10 flex items-center justify-between px-2">
          <button
            onClick={prevMonth}
            className={monthNavButtonClassName}
            aria-label="切換到上個月"
            title="上個月"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={nextMonth}
            className={monthNavButtonClassName}
            aria-label="切換到下個月"
            title="下個月"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-y-1 text-center">
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
                className="relative flex flex-col items-center justify-center cursor-pointer py-1"
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
