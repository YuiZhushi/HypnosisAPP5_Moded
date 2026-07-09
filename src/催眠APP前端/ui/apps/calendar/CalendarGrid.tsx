import React from 'react';
import { CalendarEvent, EventColor } from '../../../models';

/* --- 日曆網格區塊 (Calendar Grid Section) --- */
interface CalendarGridProps {
  currentDate: Date;
  selectedDate: Date;
  events: Record<string, CalendarEvent>;
  onDateSelect: (date: Date) => void;
}

const dotColorClasses: Record<EventColor, string> = {
  red: 'bg-red-400',
  blue: 'bg-blue-400',
  purple: 'bg-purple-400',
  gray: 'bg-slate-400',
  green: 'bg-green-400',
  yellow: 'bg-yellow-400',
  orange: 'bg-orange-400',
  pink: 'bg-pink-400',
  teal: 'bg-teal-400',
  indigo: 'bg-indigo-400',
};

const textColorClasses: Record<EventColor, string> = {
  red: 'text-red-400',
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  gray: 'text-slate-400',
  green: 'text-green-400',
  yellow: 'text-yellow-400',
  orange: 'text-orange-400',
  pink: 'text-pink-400',
  teal: 'text-teal-400',
  indigo: 'text-indigo-400',
};

const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, selectedDate, events, onDateSelect }) => {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
  const getFirstDayOfMonth = (y: number, m: number) => new Date(y, m, 1).getDay();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  while (days.length % 7 !== 0 || days.length < 42) {
    days.push(null);
  }

  const formatDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
  };

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-white/45 select-none mb-4">
        <div className="text-red-300/70">日</div>
        <div>一</div>
        <div>二</div>
        <div>三</div>
        <div>四</div>
        <div>五</div>
        <div className="text-red-300/70">六</div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {days.map((date, index) => {
          if (!date) {
            return (
              <div
                key={`empty-${index}`}
                className="aspect-3/4 sm:aspect-3/4 rounded-xl border border-white/5 bg-white/0"
              />
            );
          }

          const dateString = formatDateString(date);
          const dayEvents = Object.entries(events).filter(([_, e]) => {
            return dateString >= e.startDate && dateString <= e.endDate;
          });
          const isSelected = isSameDate(date, selectedDate);
          // 模擬的今天
          const isToday = isSameDate(date, new Date('2026-05-01'));

          const hasHoliday = dayEvents.some(([_, e]) => e.color === 'red' && e.type === 'system');
          const hasFestival = dayEvents.some(([_, e]) => e.color === 'pink' && e.type === 'system'); // 以 pink 模擬 festival
          const totalCount = dayEvents.length;

          const primary = dayEvents[0]
            ? dayEvents[0][1].title.length > 6
              ? dayEvents[0][1].title.slice(0, 6) + '…'
              : dayEvents[0][1].title
            : null;

          return (
            <button
              key={dateString}
              onClick={() => onDateSelect(date)}
              className={[
                'aspect-3/4 sm:aspect-3/4 rounded-xl border p-1.5 sm:p-2 flex flex-col items-start justify-between text-left transition-colors overflow-hidden',
                'bg-black/20 hover:bg-white/5',
                isSelected ? 'border-cyan-400/40' : 'border-white/10',
                isToday ? 'ring-2 ring-cyan-400/30 shadow-[0_0_0_4px_rgba(34,211,238,0.08)]' : '',
              ].join(' ')}
            >
              <div className="w-full flex items-start justify-between">
                <div
                  className={['text-xs font-bold tabular-nums', isToday ? 'text-cyan-200' : 'text-white/80'].join(' ')}
                >
                  {date.getDate()}
                </div>
                {(hasHoliday || hasFestival) && (
                  <div
                    className={[
                      'text-[10px] px-1 sm:px-1.5 py-0.5 rounded-full border transform scale-75 sm:scale-100 origin-top-right',
                      hasHoliday
                        ? 'bg-red-500/10 border-red-400/30 text-red-200'
                        : 'bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-200',
                    ].join(' ')}
                  >
                    {hasHoliday ? '祝' : '節'}
                  </div>
                )}
              </div>

              <div className="w-full">
                {primary && (
                  <div
                    className={[
                      'text-[10px] leading-tight truncate',
                      textColorClasses[dayEvents[0][1].color] || 'text-white/55',
                    ].join(' ')}
                  >
                    {primary}
                    {totalCount > 1 ? ` +${totalCount - 1}` : ''}
                  </div>
                )}
                {totalCount > 0 && (
                  <div className="mt-1 flex items-center gap-1 flex-wrap">
                    {dayEvents.slice(0, 3).map(([_, e], i) => (
                      <span
                        key={`p-${i}`}
                        className={`w-1.5 h-1.5 rounded-full ${dotColorClasses[e.color] || 'bg-white/25'}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
