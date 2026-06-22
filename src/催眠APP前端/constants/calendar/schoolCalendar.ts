/**
 * 學校日曆常數 — 預設學年行事曆
 *
 * 按日本學校制度（4月開學）排列的靜態行事曆數據。
 * 僅供 UI 層使用，不涉及持久化。
 */

// ====== 類型 ======

export type SchoolCalendarEvent = {
  start: number;
  end: number;
  title: string;
  kind: 'holiday' | 'festival' | 'event';
};

// ====== 常數 ======

/** 學年月份順序（4月開學） */
export const SCHOOL_MONTHS = [4, 5, 6, 7, 8, 9, 10, 11, 12, 1, 2, 3] as const;

/** 每月天數 */
export const MONTH_LENGTHS: Record<number, number> = {
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

// ====== 工具函數 ======

function inferEventKind(title: string): SchoolCalendarEvent['kind'] {
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

function ev(start: number, end: number, title: string): SchoolCalendarEvent {
  return { start, end, title, kind: inferEventKind(title) };
}

// ====== 行事曆數據 ======

export const SCHOOL_CALENDAR_EVENTS: Record<number, SchoolCalendarEvent[]> = {
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

// ====== 查詢工具 ======

/** 查詢指定日期的學校行事曆事件 */
export function getSchoolEventsForDay(month: number, day: number): SchoolCalendarEvent[] {
  const list = SCHOOL_CALENDAR_EVENTS[month] ?? [];
  return list.filter(e => day >= e.start && day <= e.end);
}

/** 格式化事件標題（用於日曆格子內顯示） */
export function formatEventTitleForCell(e: SchoolCalendarEvent): string {
  const main = e.title.split('(')[0].split('/')[0].trim();
  return main.length > 6 ? main.slice(0, 6) + '…' : main;
}
