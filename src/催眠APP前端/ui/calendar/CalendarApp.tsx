import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import * as MvuBridge from '../../shared/mvu/mvuBridge';
import { waitForMvuReady } from '../../shared/mvu/mvuBridge';
import { getCalendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent, processAiCalendarOps } from '../../backend/calendar';
import { logger } from '../../shared/debug/loggerService';
import type { CustomCalendarEvent } from '../../constants/schemas/storeSchema';

export const CalendarApp = ({ onBack }: { onBack: () => void }) => <CalendarDarkApp onBack={onBack} />;

type CalendarEvent = {
  start: number;
  end: number;
  title: string;
  kind: 'holiday' | 'festival' | 'event';
};

const SCHOOL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;
const MONTH_LENGTHS: Record<number, number> = {
  1: 31,
  2: 28,
  3: 31,
  4: 30,
  5: 31,
  6: 30,
  7: 31,
  8: 31,
  9: 30,
  10: 31,
  11: 30,
  12: 31,
};

function inferEventKind(title: string): CalendarEvent['kind'] {
  if (title.includes('祝日') || title.includes('振替休日')) return 'holiday';
  const festivals = [
    '七夕',
    '万圣节',
    '元旦',
    '圣诞节',
    '平安夜',
    '大晦日',
    '盂兰盆节',
    '情人节',
    '白色情人节',
    '女儿节',
    '节分',
    '七五三节',
    '愚人节',
  ];
  if (festivals.some(key => title.includes(key))) return 'festival';
  return 'event';
}

function ev(start: number, end: number, title: string): CalendarEvent {
  return { start, end, title, kind: inferEventKind(title) };
}

const CALENDAR_EVENTS: Record<number, CalendarEvent[]> = {
  4: [
    ev(1, 1, '愚人节'),
    ev(8, 8, '入学式/始业式'),
    ev(10, 14, '社团招新周'),
    ev(15, 15, '社团说明会'),
    ev(20, 20, '身体检查'),
    ev(29, 29, '黄金周假期开始'),
  ],
  5: [ev(6, 6, '黄金周假期结束'), ev(20, 23, '第一学期中考'), ev(25, 25, '球技大会')],
  6: [ev(1, 1, '衣更(换夏装)'), ev(10, 10, '全校体力测验'), ev(25, 25, '学生会选举'), ev(30, 30, '夜间试胆大会')],
  7: [
    ev(7, 7, '七夕'),
    ev(14, 17, '第一学期末考'),
    ev(21, 21, '海之日(7月第3周一/祝日)'),
    ev(22, 22, '第一学期结业式'),
    ev(23, 23, '暑假开始'),
    ev(25, 28, '社团夏季合宿'),
  ],
  8: [
    ev(1, 1, '全校返校日'),
    ev(11, 11, '山之日(祝日)'),
    ev(13, 16, '盂兰盆节'),
    ev(16, 17, '夏Comi(同人展/东京BigSight)'),
    ev(25, 25, '补习/作业最后冲刺'),
    ev(31, 31, '暑假最后一日'),
  ],
  9: [
    ev(1, 1, '第二学期始业式'),
    ev(15, 15, '敬老之日(9月第3周一/祝日)'),
    ev(16, 16, '校庆执行委员会成立 / 班级展出项目决定'),
    ev(23, 23, '秋分之日(祝日)'),
    ev(29, 29, '体育祭(运动会)'),
  ],
  10: [
    ev(1, 1, '衣更(换冬装)'),
    ev(13, 13, '运动之日(10月第2周一/祝日)'),
    ev(21, 24, '第二学期中考'),
    ev(31, 31, '万圣节放学后的Cosplay派对'),
  ],
  11: [
    ev(1, 2, '文化祭(学园祭)'),
    ev(3, 3, '文化之日(祝日/文化祭后夜祭)'),
    ev(15, 15, '七五三节'),
    ev(23, 23, '勤劳感谢日(祝日)'),
    ev(24, 24, '振替休日(补假)'),
    ev(25, 28, '修学旅行'),
  ],
  12: [
    ev(9, 12, '第二学期末考'),
    ev(24, 24, '第二学期结业式/平安夜'),
    ev(25, 25, '圣诞节/寒假开始'),
    ev(30, 31, '冬Comi(同人展)'),
    ev(31, 31, '大晦日(除夕)'),
  ],
  1: [
    ev(1, 1, '元旦(祝日)'),
    ev(7, 7, '第三学期始业式'),
    ev(13, 13, '成人之日(1月第2周一/祝日)'),
    ev(17, 18, '大学入学共通测试(三年级/校内禁声)'),
    ev(25, 25, '马拉松大会/耐力跑'),
  ],
  2: [
    ev(3, 3, '节分(撒豆驱鬼)'),
    ev(11, 11, '建国纪念日(祝日)'),
    ev(14, 14, '情人节'),
    ev(23, 23, '天皇诞辰(祝日)'),
    ev(24, 24, '振替休日(补假)'),
    ev(25, 27, '学年末考试(一二年级)'),
  ],
  3: [
    ev(3, 3, '女儿节'),
    ev(14, 14, '白色情人节'),
    ev(20, 20, '春分之日(祝日)'),
    ev(24, 24, '修业式(年度结束)'),
    ev(25, 25, '春假开始'),
  ],
};

function eventsForDay(month: number, day: number): CalendarEvent[] {
  const list = CALENDAR_EVENTS[month] ?? [];
  return list.filter(e => day >= e.start && day <= e.end);
}

function formatEventTitleForCell(e: CalendarEvent): string {
  const main = e.title.split('(')[0].split('/')[0].trim();
  return main.length > 6 ? main.slice(0, 6) + '…' : main;
}

function parseSystemDate(
  raw: unknown,
): { month: number; day: number; weekdayIndex: number | null; weekdayLabel: string | null } | null {
  if (typeof raw !== 'string') return null;
  const monthMatch = /(\d{1,2})\s*月/.exec(raw);
  const dayMatch = /(\d{1,2})\s*日/.exec(raw);
  if (!monthMatch || !dayMatch) return null;
  const month = Number(monthMatch[1]);
  const day = Number(dayMatch[1]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  const weekMatch = /(星期|周)\s*([一二三四五六日天])/.exec(raw);
  const weekdayLabel = weekMatch ? `${weekMatch[1]}${weekMatch[2]}` : null;
  const weekdayIndex = (() => {
    if (!weekMatch) return null;
    const map: Record<string, number> = { 日: 0, 天: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6 };
    return map[weekMatch[2]] ?? null;
  })();
  return { month, day, weekdayIndex, weekdayLabel };
}

function offsetFromApril1(month: number, day: number): number {
  const idx = SCHOOL_MONTHS.indexOf(month as any);
  if (idx < 0) return 0;
  let sum = 0;
  for (let i = 0; i < idx; i++) sum += MONTH_LENGTHS[SCHOOL_MONTHS[i]];
  sum += Math.max(0, day - 1);
  return sum;
}

function monthStartOffset(month: number): number {
  const idx = SCHOOL_MONTHS.indexOf(month as any);
  if (idx < 0) return 0;
  let sum = 0;
  for (let i = 0; i < idx; i++) sum += MONTH_LENGTHS[SCHOOL_MONTHS[i]];
  return sum;
}

function weekdayLabelFromIndex(idx: number): string {
  const map = ['日', '一', '二', '三', '四', '五', '六'];
  return `周${map[idx] ?? '·'}`;
}

const CalendarDarkApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [system, setSystem] = useState<Record<string, any> | null>(null);
  const [currentDate, setCurrentDate] = useState<ReturnType<typeof parseSystemDate> | null>(null);
  const [displayedMonth, setDisplayedMonth] = useState<number>(4);
  const [displayedYearOffset, setDisplayedYearOffset] = useState<number>(0);
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const didInitRef = useRef(false);

  // Custom events
  const [customEvents, setCustomEvents] = useState<CustomCalendarEvent[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const refreshCustomEvents = useCallback(() => {
    setCustomEvents(getCalendarEvents());
  }, []);

  const lastProcessedMsgRef = useRef<number>(-1);

  const processAiOps = useCallback(async () => {
    try {
      // 防重：只在新樓層時處理，回退時跳過
      // @ts-ignore - getCurrentMessageId from tavern
      const currentMsgId = typeof getCurrentMessageId === 'function' ? getCurrentMessageId() : -1;
      if (currentMsgId >= 0 && currentMsgId <= lastProcessedMsgRef.current) return;

      const { changed } = await processAiCalendarOps();

      if (currentMsgId >= 0) lastProcessedMsgRef.current = currentMsgId;
      if (changed) refreshCustomEvents();
    } catch (err) {
      logger.warn('AI日历操作处理失败', err);
    }
  }, [refreshCustomEvents]);

  const loadSystem = async () => {
    const sys = await MvuBridge.getSystem();
    setSystem(sys);
    setCurrentDate(parseSystemDate(sys?.当前日期));
    refreshCustomEvents();
    await processAiOps();
  };

  useEffect(() => {
    void loadSystem();
  }, []);

  useEffect(() => {
    let stops: Array<{ stop: () => void }> = [];
    void (async () => {
      try {
        const ready = await waitForMvuReady({ timeoutMs: 5000, pollMs: 150 });
        if (!ready) return;
        stops = [
          // @ts-ignore - eventOn from tavern
          eventOn(Mvu.events.VARIABLE_INITIALIZED, () => void loadSystem()),
          // @ts-ignore - eventOn from tavern
          eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, () => void loadSystem()),
        ];
      } catch {
        // ignore
      }
    })();
    return () => stops.forEach(s => s.stop());
  }, []);

  useEffect(() => {
    if (!currentDate || didInitRef.current) return;
    didInitRef.current = true;
    setDisplayedMonth(currentDate.month);
    setDisplayedYearOffset(0);
    setSelectedDay(currentDate.day);
  }, [currentDate]);

  const april1Weekday = useMemo(() => {
    if (!currentDate || currentDate.weekdayIndex === null) return 0;
    const off = offsetFromApril1(currentDate.month, currentDate.day) % 7;
    return (currentDate.weekdayIndex - off + 7) % 7;
  }, [currentDate]);

  const startWeekday = useMemo(() => {
    const yearShift = ((displayedYearOffset % 7) + 7) % 7; // 365 % 7 = 1
    return (april1Weekday + yearShift + (monthStartOffset(displayedMonth) % 7)) % 7;
  }, [april1Weekday, displayedMonth, displayedYearOffset]);

  const daysInMonth = MONTH_LENGTHS[displayedMonth] ?? 30;

  const gridCells = useMemo(() => {
    const cells: Array<number | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    while (cells.length < 42) cells.push(null);
    return cells;
  }, [startWeekday, daysInMonth]);

  const monthIdx = useMemo(() => SCHOOL_MONTHS.indexOf(displayedMonth as any), [displayedMonth]);
  const canSwitch = monthIdx >= 0;

  const goMonth = (delta: -1 | 1) => {
    if (!canSwitch) return;
    const yearDelta =
      delta === 1 && monthIdx === SCHOOL_MONTHS.length - 1 ? 1 : delta === -1 && monthIdx === 0 ? -1 : 0;
    const nextYearOffset = displayedYearOffset + yearDelta;
    const nextIdx = (monthIdx + delta + SCHOOL_MONTHS.length) % SCHOOL_MONTHS.length;
    const nextMonth = SCHOOL_MONTHS[nextIdx];
    setDisplayedYearOffset(nextYearOffset);
    setDisplayedMonth(nextMonth);
    if (currentDate && currentDate.month === nextMonth && nextYearOffset === 0) {
      setSelectedDay(currentDate.day);
    } else {
      setSelectedDay(1);
    }
  };

  const todayDay = currentDate?.day ?? null;
  const todayMonth = currentDate?.month ?? null;
  const todayWeek =
    currentDate?.weekdayLabel ??
    (currentDate?.weekdayIndex !== null && currentDate?.weekdayIndex !== undefined
      ? weekdayLabelFromIndex(currentDate.weekdayIndex)
      : null);
  const schedule = typeof system?.当前日程 === 'string' ? system.当前日程 : null;

  const selectedEvents = useMemo(() => {
    if (!selectedDay) return [];
    return eventsForDay(displayedMonth, selectedDay);
  }, [displayedMonth, selectedDay]);

  const selectedCustomEvents = useMemo(() => {
    return customEvents.filter(e => e.month === displayedMonth && e.day === selectedDay);
  }, [customEvents, displayedMonth, selectedDay]);

  const handleAddEvent = async () => {
    const trimmed = addTitle.trim();
    if (!trimmed) return;
    await addCalendarEvent({
      month: displayedMonth,
      day: selectedDay,
      title: trimmed,
      description: addDesc.trim() || undefined,
    });
    refreshCustomEvents();
    setAddTitle('');
    setAddDesc('');
    setShowAddForm(false);
  };

  const handleUpdateEvent = async (id: string) => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    await updateCalendarEvent(id, {
      title: trimmed,
      // 这里必须传原始输入：空字串代表「清空描述」，由 backend 统一 trim/null 处理
      description: editDesc,
    });
    refreshCustomEvents();
    setEditingId(null);
  };

  const handleDeleteEvent = async (id: string) => {
    await deleteCalendarEvent(id);
    refreshCustomEvents();
    setDeleteConfirmId(null);
  };

  return (
    <div className="h-full flex flex-col bg-linear-to-b from-slate-950 via-slate-950 to-black text-white overflow-hidden animate-fade-in">
      <div className="px-4 pt-6 pb-4 border-b border-white/10 bg-black/20 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft size={18} className="text-white/80" />
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goMonth(-1)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="上个月"
            >
              <ChevronLeft size={18} className="text-white/70" />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 rounded-2xl border border-white/10 bg-white/5">
              <CalendarIcon size={16} className="text-cyan-300" />
              <div className="text-sm font-bold tracking-wide">{displayedMonth}月</div>
            </div>
            <button
              onClick={() => goMonth(1)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
              aria-label="下个月"
            >
              <ChevronRight size={18} className="text-white/70" />
            </button>
          </div>

          <div className="w-9" />
        </div>

        {displayedYearOffset === 0 && todayMonth === displayedMonth && todayDay && (todayWeek || schedule) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {todayWeek && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                今日 {todayDay}日 · {todayWeek}
              </span>
            )}
            {schedule && (
              <span className="text-[10px] px-2 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-200">
                {schedule}
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
        <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-white/45 select-none">
          <div className="text-red-300/70">日</div>
          <div>一</div>
          <div>二</div>
          <div>三</div>
          <div>四</div>
          <div>五</div>
          <div className="text-red-300/70">六</div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {gridCells.map((day, idx) => {
            if (!day) {
              return <div key={idx} className="aspect-square rounded-xl border border-white/5 bg-white/0" />;
            }

            const isToday = displayedYearOffset === 0 && todayMonth === displayedMonth && todayDay === day;
            const isSelected = selectedDay === day;
            const events = eventsForDay(displayedMonth, day);
            const dayCustom = customEvents.filter(e => e.month === displayedMonth && e.day === day);
            const hasHoliday = events.some(e => e.kind === 'holiday');
            const hasFestival = events.some(e => e.kind === 'festival');
            const hasCustom = dayCustom.length > 0;
            const totalCount = events.length + dayCustom.length;
            const primary = events[0]
              ? formatEventTitleForCell(events[0])
              : dayCustom[0]
                ? (dayCustom[0].title.length > 6 ? dayCustom[0].title.slice(0, 6) + '…' : dayCustom[0].title)
                : null;

            return (
              <button
                key={idx}
                onClick={() => setSelectedDay(day)}
                className={[
                  'aspect-square rounded-xl border p-2 flex flex-col items-start justify-between text-left transition-colors',
                  'bg-black/20 hover:bg-white/5',
                  isSelected ? 'border-cyan-400/40' : 'border-white/10',
                  isToday ? 'ring-2 ring-cyan-400/30 shadow-[0_0_0_4px_rgba(34,211,238,0.08)]' : '',
                ].join(' ')}
              >
                <div className="w-full flex items-start justify-between">
                  <div
                    className={['text-[11px] font-bold tabular-nums', isToday ? 'text-cyan-200' : 'text-white/80'].join(
                      ' ',
                    )}
                  >
                    {day}
                  </div>
                  {(hasHoliday || hasFestival) && (
                    <div
                      className={[
                        'text-[9px] px-1.5 py-0.5 rounded-full border',
                        hasHoliday
                          ? 'bg-red-500/10 border-red-400/30 text-red-200'
                          : 'bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-200',
                      ].join(' ')}
                    >
                      {hasHoliday ? '祝' : '节'}
                    </div>
                  )}
                </div>

                <div className="w-full">
                  {primary && (
                    <div
                      className={[
                        'text-[9px] leading-tight truncate',
                        hasHoliday ? 'text-red-200/90' : hasFestival ? 'text-fuchsia-200/90' : hasCustom && !events[0] ? 'text-cyan-200/80' : 'text-white/55',
                      ].join(' ')}
                    >
                      {primary}
                      {totalCount > 1 ? ` +${totalCount - 1}` : ''}
                    </div>
                  )}
                  {totalCount > 0 && (
                    <div className="mt-1 flex items-center gap-1">
                      {events.slice(0, 3).map((e, i) => (
                        <span
                          key={`p-${i}`}
                          className={[
                            'w-1.5 h-1.5 rounded-full',
                            e.kind === 'holiday'
                              ? 'bg-red-400/80'
                              : e.kind === 'festival'
                                ? 'bg-fuchsia-400/80'
                                : 'bg-white/25',
                          ].join(' ')}
                        />
                      ))}
                      {dayCustom.slice(0, Math.max(0, 3 - events.length)).map((_, i) => (
                        <span key={`c-${i}`} className="w-1.5 h-1.5 rounded-full bg-cyan-400/80" />
                      ))}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="p-4 rounded-2xl border border-white/10 bg-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold text-white/80">
              {displayedMonth}月{selectedDay}日
              {todayMonth === displayedMonth && todayDay === selectedDay && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-200">
                  今日
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="text-[10px] text-white/40">{selectedEvents.length + selectedCustomEvents.length} 项</div>
              <button
                onClick={() => { setShowAddForm(v => !v); setAddTitle(''); setAddDesc(''); }}
                className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                aria-label="新增事件"
              >
                {showAddForm ? <X size={12} /> : <Plus size={12} />}
              </button>
            </div>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="mb-3 p-3 rounded-xl border border-cyan-500/20 bg-black/30 space-y-2">
              <input
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                placeholder="事件标题"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
              />
              <input
                value={addDesc}
                onChange={e => setAddDesc(e.target.value)}
                placeholder="描述（可选）"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
              />
              <button
                onClick={() => void handleAddEvent()}
                disabled={!addTitle.trim()}
                className="w-full py-2 rounded-lg text-xs font-bold bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                确认新增
              </button>
            </div>
          )}

          {selectedEvents.length === 0 && selectedCustomEvents.length === 0 ? (
            <div className="text-[11px] text-white/45">今日无记录事件</div>
          ) : (
            <div className="space-y-2">
              {/* Predefined events */}
              {selectedEvents.map((e, i) => (
                <div
                  key={`pre-${i}`}
                  className="p-3 rounded-xl border border-white/10 bg-black/20 flex items-start justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-semibold text-white/85 truncate">{e.title}</div>
                    {e.start !== e.end && (
                      <div className="text-[10px] text-white/45 mt-0.5">
                        {displayedMonth}月{e.start}-{e.end}日
                      </div>
                    )}
                  </div>
                  <div
                    className={[
                      'shrink-0 text-[10px] px-2 py-1 rounded-full border',
                      e.kind === 'holiday'
                        ? 'bg-red-500/10 border-red-400/30 text-red-200'
                        : e.kind === 'festival'
                          ? 'bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-200'
                          : 'bg-white/5 border-white/10 text-white/55',
                    ].join(' ')}
                  >
                    {e.kind === 'holiday' ? '祝日' : e.kind === 'festival' ? '节日' : '事件'}
                  </div>
                </div>
              ))}

              {/* Custom events */}
              {selectedCustomEvents.map(ce => (
                <div
                  key={ce.id}
                  className="p-3 rounded-xl border border-cyan-500/20 bg-black/20"
                >
                  {editingId === ce.id ? (
                    <div className="space-y-2">
                      <input
                        value={editTitle}
                        onChange={e => setEditTitle(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 focus:outline-none focus:border-cyan-400/40"
                      />
                      <input
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="描述（可选）"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/90 placeholder:text-white/30 focus:outline-none focus:border-cyan-400/40"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => void handleUpdateEvent(ce.id)}
                          disabled={!editTitle.trim()}
                          className="flex-1 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-40"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:bg-white/10"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-white/85 truncate">{ce.title}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-200">自订</span>
                        </div>
                        {ce.description && (
                          <div className="text-[10px] text-white/50 mt-0.5 truncate">{ce.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => { setEditingId(ce.id); setEditTitle(ce.title); setEditDesc(ce.description ?? ''); }}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
                        >
                          <Pencil size={12} />
                        </button>
                        {deleteConfirmId === ce.id ? (
                          <button
                            onClick={() => void handleDeleteEvent(ce.id)}
                            className="px-2 py-1 rounded-lg text-[10px] font-bold bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30"
                          >
                            确认
                          </button>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(ce.id)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-red-300 transition-colors"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
