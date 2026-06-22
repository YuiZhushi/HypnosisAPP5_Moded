import React, { useState } from 'react';
import { CalendarEvent, EventColor } from '../mock/mockModels';
import { MockApi } from '../mock/mockApi';
import { Plus, Pencil, Trash2, X, CalendarIcon } from 'lucide-react';

/* --- 事件面板區塊 (Event Panel Section) --- */
interface EventPanelProps {
  date: Date;
  events: Record<string, CalendarEvent>;
  onClose: () => void;
  onEventsChange: () => Promise<void>;
}

const colorOptions: { value: EventColor; label: string; bgClass: string; borderClass: string }[] = [
  { value: 'red', label: '淺紅色', bgClass: 'bg-red-500/10 text-red-200', borderClass: 'border-red-400/30' },
  { value: 'blue', label: '淺藍色', bgClass: 'bg-blue-500/10 text-blue-200', borderClass: 'border-blue-400/30' },
  { value: 'purple', label: '紫色', bgClass: 'bg-purple-500/10 text-purple-200', borderClass: 'border-purple-400/30' },
  { value: 'gray', label: '淺灰色', bgClass: 'bg-white/5 text-white/55', borderClass: 'border-white/10' },
  { value: 'green', label: '綠色', bgClass: 'bg-green-500/10 text-green-200', borderClass: 'border-green-400/30' },
  { value: 'yellow', label: '黃色', bgClass: 'bg-yellow-500/10 text-yellow-200', borderClass: 'border-yellow-400/30' },
  { value: 'orange', label: '橘色', bgClass: 'bg-orange-500/10 text-orange-200', borderClass: 'border-orange-400/30' },
  { value: 'pink', label: '粉紅色', bgClass: 'bg-fuchsia-500/10 text-fuchsia-200', borderClass: 'border-fuchsia-400/30' },
  { value: 'teal', label: '藍綠色', bgClass: 'bg-teal-500/10 text-teal-200', borderClass: 'border-teal-400/30' },
  { value: 'indigo', label: '靛色', bgClass: 'bg-indigo-500/10 text-indigo-200', borderClass: 'border-indigo-400/30' },
];

const formatDateString = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const EventPanel: React.FC<EventPanelProps> = ({
  date,
  events,
  onClose,
  onEventsChange,
}) => {
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [color, setColor] = useState<EventColor>('purple');

  const dateString = formatDateString(date);
  const dayEvents = Object.entries(events).filter(([_, e]) => {
    return dateString >= e.startDate && dateString <= e.endDate;
  });

  const isToday = dateString === '2026-05-01'; // 模擬今天

  const handleOpenAddForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setStartDate(dateString);
    setEndDate(dateString);
    setColor('purple');
    setShowFormModal(true);
  };

  const handleOpenEditForm = (id: string, evt: CalendarEvent) => {
    setEditingId(id);
    setTitle(evt.title);
    setDescription(evt.description || '');
    setStartDate(evt.startDate);
    setEndDate(evt.endDate);
    setColor(evt.color);
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!title.trim() || !startDate || !endDate) return;
    if (startDate > endDate) {
      alert('開始日期不能大於結束日期');
      return;
    }

    if (editingId) {
      await MockApi.updateCalendarEvent(editingId, {
        ...events[editingId],
        title,
        description,
        startDate,
        endDate,
        color,
      });
      setEditingId(null);
    } else {
      const newEventId = `evt_custom_${Date.now()}`;
      await MockApi.createCalendarEvent(newEventId, {
        title,
        description,
        startDate,
        endDate,
        color,
        type: 'custom',
      });
    }
    setShowFormModal(false);
    await onEventsChange();
  };

  const handleDelete = async (id: string) => {
    await MockApi.deleteCalendarEvent(id);
    await onEventsChange();
    setDeleteConfirmId(null);
  };

  return (
    <>
      {/* 底部彈出面板 (Bottom Sheet) */}
      <div className="absolute inset-0 z-40 bg-black/80 backdrop-blur-sm flex items-end animate-fade-in" onClick={onClose}>
        <div
          className="w-full bg-[#0a0815] rounded-t-2xl border-t border-purple-900/50 flex flex-col min-h-[50vh] max-h-[85vh] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="shrink-0 flex items-center justify-between p-4 md:p-5 border-b border-purple-900/30">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="text-[15px] md:text-[16px] font-bold text-white tracking-widest">
                {date.getMonth() + 1}月{date.getDate()}日
                {isToday && (
                  <span className="ml-2 text-[10px] md:text-[11px] px-2 py-0.5 rounded-md bg-cyan-900/30 border border-cyan-500/30 text-cyan-400 align-middle">
                    今日
                  </span>
                )}
              </div>
              <div className="text-[11px] md:text-[12px] text-gray-500">{dayEvents.length} 項事件</div>
            </div>
            <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Event List */}
          <div className="flex-1 overflow-y-auto hypno-scrollbar p-4 md:p-5 flex flex-col gap-3 md:gap-4">
            {dayEvents.length === 0 ? (
              <div className="text-center text-gray-500 text-[12px] md:text-[13px] py-8">今日無記錄事件</div>
            ) : (
              dayEvents.map(([id, evt]) => {
                const colorStyle = colorOptions.find(c => c.value === evt.color) || colorOptions[2];
                const isSystem = evt.type === 'system';

                return (
                  <div
                    key={id}
                    className={`bg-[#0c0a1e] p-3.5 md:p-4 rounded-xl border border-purple-900/30 flex items-start justify-between gap-3 transition-colors`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] md:text-sm font-bold text-white tracking-wide truncate">{evt.title}</span>
                        </div>
                        {evt.startDate !== evt.endDate && (
                          <div className="text-[9px] md:text-[10px] text-gray-400 mt-1">
                            {evt.startDate} 至 {evt.endDate}
                          </div>
                        )}
                        {evt.description && (
                          <div className="text-[11px] md:text-[12px] text-gray-300 mt-2 whitespace-pre-wrap leading-relaxed bg-[#13102a] p-2.5 rounded-lg border border-purple-900/20">
                            {evt.description}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div
                          className={`text-[9px] md:text-[10px] font-medium px-2 py-0.5 rounded-md border ${colorStyle.borderClass} ${colorStyle.bgClass}`}
                        >
                          {evt.color === 'red' && isSystem ? '祝/節日' : isSystem ? '學校事件' : '自訂'}
                        </div>
                        {!isSystem && (
                          <div className="flex items-center gap-1 shrink-0 mt-1">
                            <button
                              onClick={() => handleOpenEditForm(id, evt)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                            >
                              <Pencil size={14} />
                            </button>
                            {deleteConfirmId === id ? (
                              <button
                                onClick={() => void handleDelete(id)}
                                className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-500/30 transition-colors"
                              >
                                確認
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(id)}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-red-400 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Add Button */}
          <div className="p-4 border-t border-purple-900/30">
            <button
              onClick={handleOpenAddForm}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-100 rounded-xl font-bold transition-colors text-[13px]"
            >
              <Plus size={16} />
              <span>新增事件</span>
            </button>
          </div>
        </div>
      </div>

      {/* 修改/新增表單 Modal */}
      {showFormModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 md:p-4 animate-fade-in">
          <div className="bg-[#0a0815] rounded-2xl border border-purple-900/30 w-full max-w-sm flex flex-col shadow-2xl overflow-hidden max-h-full">
            <div className="flex items-center justify-between p-3 md:p-4 border-b border-purple-900/30 shrink-0">
              <h3 className="text-sm md:text-base font-bold text-white tracking-widest flex items-center gap-2">
                <CalendarIcon size={18} className="text-purple-400" />
                {editingId ? '編輯事件' : '新增事件'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-3 md:p-4 flex flex-col gap-3 md:gap-4 overflow-y-auto hypno-scrollbar">
              <div>
                <label className="block text-xs text-gray-500 mb-1">標題</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="事件標題"
                  className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">開始日期</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">結束日期</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-sm text-white outline-none focus:border-purple-500/50 transition-colors"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5 md:mb-2">顏色</label>
                <div className="flex flex-wrap gap-2 md:gap-2.5">
                  {colorOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setColor(opt.value)}
                      className={`w-6 h-6 rounded-full border border-white/10 ${opt.bgClass.split(' ')[0]} transition-all ${
                        color === opt.value ? 'ring-2 ring-white ring-offset-2 ring-offset-[#13102a] scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={opt.label}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">描述</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="描述（可選）"
                  rows={3}
                  className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 md:px-3 py-1.5 md:py-2 text-sm text-white outline-none focus:border-purple-500/50 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="p-3 md:p-4 border-t border-purple-900/30 flex gap-2 md:gap-3 shrink-0">
              <button
                onClick={() => setShowFormModal(false)}
                className="flex-1 py-2 md:py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="flex-1 py-2 md:py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:bg-purple-900/50 disabled:text-white/30 text-white font-medium text-sm transition-colors shadow-lg shadow-purple-900/20"
              >
                儲存變更
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EventPanel;
