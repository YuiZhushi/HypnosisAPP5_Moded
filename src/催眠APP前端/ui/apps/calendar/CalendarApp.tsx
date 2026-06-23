import React, { useState, useEffect } from 'react';
import { MockApi } from '../../../shared/api/mockApi';
import { CalendarEvent } from '../../../models';
import CalendarHeader from './CalendarHeader';
import CalendarGrid from './CalendarGrid';
import EventPanel from './EventPanel';
import { ChevronLeft, Bell, Box } from 'lucide-react';

/* --- 主應用程式容器 (Main App Container) --- */
interface CalendarAppProps {
  onBack: () => void;
}

const CalendarApp: React.FC<CalendarAppProps> = ({ onBack }) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date('2026-05-01'));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date('2026-05-01'));
  const [events, setEvents] = useState<Record<string, CalendarEvent>>({});
  const [systemTimeText, setSystemTimeText] = useState<string>('');
  const [isEventPanelOpen, setIsEventPanelOpen] = useState(false);

  useEffect(() => {
    const fetchEvents = async () => {
      const data = await MockApi.getCalendarEvents();
      setEvents(data);
    };
    fetchEvents();

    const fetchSystemData = async () => {
      const data = await MockApi.getSystemData();
      if (data.time) {
        const d = new Date(data.time);
        setSystemTimeText(d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true }));
        setCurrentDate(d);
        setSelectedDate(d);
      }
    };
    fetchSystemData();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleToday = async () => {
    const data = await MockApi.getSystemData();
    if (data.time) {
      const today = new Date(data.time);
      setCurrentDate(today);
      setSelectedDate(today);
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setIsEventPanelOpen(true);
  };

  const handleClosePanel = () => {
    setIsEventPanelOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-linear-to-b from-slate-950 via-slate-950 to-black text-white overflow-hidden animate-fade-in relative">
      {/* ============================================ */}
      {/* Top Bar (System Status Bar) */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-3 md:px-5 py-1 bg-black/40 text-white/40 text-xs font-medium shrink-0 w-full">
        <div className="flex items-center gap-2">
          <span>{systemTimeText || '10:30 AM'}</span>
          <Bell size={12} className="opacity-40" />
        </div>
        <div className="flex items-center gap-1.5">
          <Box size={12} />
        </div>
      </div>

      {/* ============================================ */}
      {/* Main Content Area */}
      {/* ============================================ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <CalendarHeader
          currentDate={currentDate}
          selectedDate={selectedDate}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
          onBack={onBack}
        />
        <div className="flex-1 p-3 md:p-4 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <CalendarGrid
              currentDate={currentDate}
              selectedDate={selectedDate}
              events={events}
              onDateSelect={handleDateSelect}
            />
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* Event Panel Overlay */}
      {/* ============================================ */}
      {isEventPanelOpen && (
        <EventPanel
          date={selectedDate}
          events={events}
          onClose={handleClosePanel}
          onEventsChange={async () => {
            const data = await MockApi.getCalendarEvents();
            setEvents(data);
          }}
        />
      )}
    </div>
  );
};

export default CalendarApp;
