import React from 'react';
import { CalendarIcon, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react';

/* --- 頭部區塊 (Header Section) --- */
interface CalendarHeaderProps {
  currentDate: Date;
  selectedDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onBack: () => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  onBack,
}) => {
  const displayedMonth = currentDate.getMonth() + 1;
  const isToday = new Date('2026-05-01'); // 模擬今天

  const isSelectedToday =
    selectedDate.getFullYear() === isToday.getFullYear() &&
    selectedDate.getMonth() === isToday.getMonth() &&
    selectedDate.getDate() === isToday.getDate();

  return (
    <div className="px-4 pt-4 md:pt-6 pb-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
      <div className="relative flex items-center justify-center h-10">
        <div className="absolute left-0">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} className="text-white/80" />
          </button>
        </div>

        <div className="flex items-center gap-2 relative">
          <button
            onClick={onPrevMonth}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="上個月"
          >
            <ChevronLeft size={18} className="text-white/70" />
          </button>
          <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
            <CalendarIcon size={16} className="text-cyan-300" />
            <div className="text-sm font-bold tracking-wide whitespace-nowrap">{displayedMonth}月</div>
          </div>
          <button
            onClick={onNextMonth}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="下個月"
          >
            <ChevronRight size={18} className="text-white/70" />
          </button>
        </div>

        <div className="absolute right-0">
          <button
            onClick={onToday}
            className={`text-xs px-2 py-1 rounded-full transition-colors whitespace-nowrap ${
              isSelectedToday
                ? 'bg-cyan-500/20 border border-cyan-400/30 text-cyan-200'
                : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
            }`}
          >
            回到今日
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarHeader;
