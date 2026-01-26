
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
  isValid
} from 'date-fns';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  transactions: any[];
}

const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect, transactions }) => {
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

  const weekDays = ['一', '二', '三', '四', '五', '六', '日'];

  const hasTransactions = (day: Date) => {
    return transactions.some(t => {
      const [y, m, d] = t.date.split('-').map(Number);
      const txDate = new Date(y, m - 1, d);
      return isSameDay(txDate, day);
    });
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
    <div className="bg-[#1a1c2c] p-4 pb-4 select-none">
      {/* Header Layout: <, 今, [date], 🔍, > */}
      <div className="grid grid-cols-3 items-center mb-6 px-1">
        
        {/* Left Side Group: < and 今 */}
        <div className="flex items-center gap-1 justify-self-start">
          <button onClick={prevMonth} className="text-gray-500 p-2 active:scale-75 transition-transform">
            <ChevronLeft size={24} />
          </button>
          
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
        
        {/* Center: Date Picker - Perfectly Centered */}
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

        {/* Right Side Group: 🔍 and > */}
        <div className="flex items-center gap-1 justify-self-end">
          <button className="text-gray-500 p-2 hover:text-white transition-colors">
            <Search size={22} />
          </button>
          
          <button onClick={nextMonth} className="text-gray-500 p-2 active:scale-75 transition-transform">
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-3 text-center">
        {weekDays.map(day => (
          <span key={day} className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{day}</span>
        ))}
        {calendarDays.map((day, i) => {
          const isSelected = isSameDay(day, safeDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
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
              onClick={() => onDateSelect(day)}
              className="relative flex flex-col items-center justify-center cursor-pointer py-1"
            >
              <div className={`
                w-9 h-9 flex items-center justify-center rounded-full transition-all duration-300
                ${isSelected ? 'bg-cyan-500 text-black font-bold shadow-[0_0_12px_rgba(34,211,238,0.5)] scale-110' : ''}
                ${!isSelected && isCurrentMonth && isSameDay(day, new Date()) ? 'border border-white/20' : ''}
              `}>
                <span className={`text-sm ${isSelected ? 'text-black' : dayTextColor}`}>
                  {format(day, 'd')}
                </span>
              </div>
              {hasTransactions(day) && !isSelected && (
                <div className="absolute bottom-0 w-1 h-1 bg-cyan-400 rounded-full"></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Calendar;
