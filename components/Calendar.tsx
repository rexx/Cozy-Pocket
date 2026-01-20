
import React, { useRef } from 'react';
import { 
  format, 
  endOfMonth, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  getDay
} from 'date-fns';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface CalendarProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
  transactions: any[];
}

const Calendar: React.FC<CalendarProps> = ({ selectedDate, onDateSelect, transactions }) => {
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Replacing startOfMonth with native Date logic to fix missing export error
  const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
  const monthEnd = endOfMonth(monthStart);
  
  // Manual startOfWeek (Monday start) calculation to fix missing export error
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

  const nextMonth = () => onDateSelect(addMonths(selectedDate, 1));
  // Replacing subMonths with addMonths(..., -1) to fix missing export error
  const prevMonth = () => onDateSelect(addMonths(selectedDate, -1));

  const weekDays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

  // Helper to check if a day has transactions
  const hasTransactions = (day: Date) => {
    return transactions.some(t => {
      // Using robust local date parsing for comparison
      const [y, m, d] = t.date.split('-').map(Number);
      const txDate = new Date(y, m - 1, d);
      return isSameDay(txDate, day);
    });
  };

  const handleHeaderDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      // Replacing parse with native Date logic for yyyy-MM-dd string
      const [y, m, d] = val.split('-').map(Number);
      const newDate = new Date(y, m - 1, d);
      if (!isNaN(newDate.getTime())) {
        onDateSelect(newDate);
      }
    }
  };

  const triggerDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    
    try {
      if ('showPicker' in HTMLInputElement.prototype) {
        input.showPicker();
      } else {
        input.click();
      }
    } catch (error) {
      console.warn("Date picker trigger failed, falling back to manual click", error);
      input.click();
    }
  };

  return (
    <div className="bg-[#1a1c2c] p-4 pb-2 select-none">
      <div className="flex justify-between items-center mb-6 px-2">
        <button onClick={prevMonth} className="text-gray-400 p-1 active:scale-90 transition-transform">
          <ChevronLeft size={20} />
        </button>
        
        <div className="relative">
          {/* Hidden input but accessible for showPicker */}
          <input 
            type="date"
            ref={dateInputRef}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-0"
            style={{ colorScheme: 'dark' }}
            value={format(selectedDate, 'yyyy-MM-dd')}
            onChange={handleHeaderDateChange}
          />
          <h2 
            onClick={triggerDatePicker}
            className="relative z-10 text-xl font-medium tracking-wide cursor-pointer hover:text-cyan-400 active:opacity-70 transition-all flex items-center gap-1"
          >
            {format(selectedDate, 'yyyy/MM/dd')}
          </h2>
        </div>

        <div className="flex items-center gap-4">
          <button className="text-gray-400 hover:text-white transition-colors"><Search size={20} /></button>
          <button onClick={nextMonth} className="text-gray-400 p-1 active:scale-90 transition-transform">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-4 text-center">
        {weekDays.map(day => (
          <span key={day} className="text-xs text-gray-500 font-medium">{day}</span>
        ))}
        {calendarDays.map((day, i) => {
          const isSelected = isSameDay(day, selectedDate);
          const isCurrentMonth = isSameMonth(day, monthStart);
          const dayOfWeek = getDay(day); // 0 = Sun, 1 = Mon ... 6 = Sat
          
          let dayTextColor = 'text-gray-400';
          if (isCurrentMonth) {
            dayTextColor = 'text-gray-200';
            if (dayOfWeek === 6) dayTextColor = 'text-emerald-500'; // Saturday
            if (dayOfWeek === 0) dayTextColor = 'text-red-500'; // Sunday
          } else {
            dayTextColor = 'text-gray-700';
          }

          return (
            <div 
              key={i} 
              onClick={() => onDateSelect(day)}
              className="relative flex flex-col items-center justify-center cursor-pointer group"
            >
              <div className={`
                w-10 h-10 flex items-center justify-center rounded-full transition-all
                ${isSelected ? 'border-2 border-cyan-500 ring-2 ring-cyan-500/20 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : ''}
                ${!isSelected && isCurrentMonth && isSameDay(day, new Date()) ? 'bg-white/5' : ''}
              `}>
                <span className={`text-base font-medium ${dayTextColor}`}>
                  {format(day, 'd')}
                </span>
              </div>
              {hasTransactions(day) && !isSelected && (
                <div className="absolute bottom-1 w-1 h-1 bg-cyan-400 rounded-full shadow-[0_0_4px_rgba(34,211,238,0.8)]"></div>
              )}
            </div>
          );
        })}
      </div>
      <div className="w-12 h-1 bg-gray-800 mx-auto mt-6 rounded-full opacity-50"></div>
    </div>
  );
};

export default Calendar;
