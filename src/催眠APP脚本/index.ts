// 催眠APP - 每日结算脚本
// 目标：
// 1) 当“系统.当前时间”跨天但“系统.当前日期”未更新时，自动推进日期
// 2) 按跨越天数恢复“系统._MC能量”（每天恢复“系统._MC能量上限”的 50%）
// 3) 每天降低“系统.主角可疑度”10点，降低每个“角色.*.警戒度”10点
// 4) 每个角色每 5 点“警戒度”，每天会增加 1 点“主角可疑度”

import _ from 'lodash';

const UPDATE_REASON = '催眠APP脚本：每日结算';

const PATHS = {
  system: '系统',
  roles: '角色',
  date: '系统.当前日期',
  time: '系统.当前时间',
  suspicion: '系统.主角可疑度',
  mcEnergy: ['系统._MC能量', '系统.MC能量'],
  mcEnergyMax: ['系统._MC能量上限', '系统.MC能量上限'],
} as const;

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;
const WEEKDAY_CHARS = ['一', '二', '三', '四', '五', '六', '日'] as const;

function toFiniteNumber(val: unknown, fallback: number | null = null): number | null {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function clampNumber(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function parseTimeToMinutes(time: unknown): number | null {
  if (typeof time !== 'string') return null;
  const m = /^(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?$/.exec(time.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

type ParsedDate = {
  month: number;
  day: number;
  weekdayIndex: number | null;
};

function parseDateText(text: unknown): ParsedDate | null {
  if (typeof text !== 'string') return null;
  const s = text.trim();
  const dateMatch = /(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(s);
  if (!dateMatch) return null;
  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;

  const weekdayMatch = /(星期|周)\s*([一二三四五六日天])/.exec(s);
  const weekdayChar = weekdayMatch ? weekdayMatch[2] : null;
  const normalized = weekdayChar === '天' ? '日' : weekdayChar;
  const weekdayIndex = normalized ? WEEKDAY_CHARS.indexOf(normalized as any) : -1;

  return {
    month: clampNumber(month, 1, 12),
    day: clampNumber(day, 1, MONTH_DAYS[clampNumber(month, 1, 12) - 1]),
    weekdayIndex: weekdayIndex >= 0 ? weekdayIndex : null,
  };
}

function toDayOfYear(d: ParsedDate): number {
  const mIndex = clampNumber(d.month, 1, 12) - 1;
  const dIndex = clampNumber(d.day, 1, MONTH_DAYS[mIndex]) - 1;
  const prefix = MONTH_DAYS.slice(0, mIndex).reduce((a, b) => a + b, 0);
  return prefix + dIndex;
}

function addDays(d: ParsedDate, deltaDays: number): ParsedDate {
  let month = clampNumber(d.month, 1, 12);
  let day = clampNumber(d.day, 1, MONTH_DAYS[month - 1]);
  let weekdayIndex = d.weekdayIndex;

  let remaining = Math.max(0, Math.floor(deltaDays));
  while (remaining > 0) {
    day += 1;
    if (day > MONTH_DAYS[month - 1]) {
      day = 1;
      month += 1;
      if (month > 12) month = 1;
    }
    if (weekdayIndex !== null) weekdayIndex = (weekdayIndex + 1) % WEEKDAY_CHARS.length;
    remaining -= 1;
  }

  return { month, day, weekdayIndex };
}

function formatDateText(d: ParsedDate): string {
  if (d.weekdayIndex === null) return `${d.month}月${d.day}日`;
  const weekdayChar = WEEKDAY_CHARS[clampNumber(d.weekdayIndex, 0, WEEKDAY_CHARS.length - 1)];
  return `${d.month}月${d.day}日 星期${weekdayChar}`;
}

function getMessageVariableOption(): VariableOption {
  try {
    return { type: 'message', message_id: getCurrentMessageId() };
  } catch {
    return { type: 'message', message_id: 'latest' };
  }
}

async function setIfChanged(
  mvu: Mvu.MvuData,
  path: string,
  nextValue: unknown,
  reason = UPDATE_REASON,
): Promise<boolean> {
  const prev = _.get(mvu.stat_data, path);
  if (_.isEqual(prev, nextValue)) return false;

  const setter = (Mvu as any).setMvuVariable as
    | ((mvuData: Mvu.MvuData, variablePath: string, value: unknown, options?: { reason?: string }) => Promise<boolean>)
    | undefined;

  if (typeof setter === 'function') {
    const ok = await setter(mvu, path, nextValue, { reason });
    if (ok) _.set(mvu.stat_data, path, nextValue);
    return ok;
  }

  _.set(mvu.stat_data, path, nextValue);
  return true;
}

function pickExistingPath(statData: Record<string, any>, paths: readonly string[]): string {
  for (const p of paths) {
    if (_.has(statData, p)) return p;
  }
  return paths[0];
}

function resolveDayDelta(
  beforeDate: unknown,
  afterDate: unknown,
  beforeTime: unknown,
  afterTime: unknown,
): { dayDelta: number; isDateMissingUpdate: boolean; nextDateText?: string } {
  const beforeParsed = parseDateText(beforeDate);
  const afterParsed = parseDateText(afterDate);
  const beforeMinutes = parseTimeToMinutes(beforeTime);
  const afterMinutes = parseTimeToMinutes(afterTime);
  const timeCrossed = beforeMinutes !== null && afterMinutes !== null && afterMinutes < beforeMinutes;

  if (!beforeParsed || !afterParsed) {
    const unchanged = typeof beforeDate === 'string' && typeof afterDate === 'string' && beforeDate === afterDate;
    const isDateMissingUpdate = unchanged && timeCrossed;
    return { dayDelta: isDateMissingUpdate ? 1 : 0, isDateMissingUpdate };
  }

  const beforeDay = toDayOfYear(beforeParsed);
  const afterDay = toDayOfYear(afterParsed);
  let delta = afterDay - beforeDay;
  if (delta < 0) delta += 365; // 允许跨年（简单按 365 天处理）

  const isSameDay = delta === 0;
  const isDateMissingUpdate = isSameDay && timeCrossed;
  if (!isDateMissingUpdate) return { dayDelta: Math.max(0, Math.floor(delta)), isDateMissingUpdate: false };

  const nextDate = addDays(afterParsed, 1);
  return { dayDelta: 1, isDateMissingUpdate: true, nextDateText: formatDateText(nextDate) };
}

async function applyDailySettlement(mvu: Mvu.MvuData, before: Mvu.MvuData): Promise<boolean> {
  const statAfter = mvu.stat_data ?? {};
  const statBefore = before?.stat_data ?? {};

  const beforeDate = _.get(statBefore, PATHS.date);
  const afterDate = _.get(statAfter, PATHS.date);
  const beforeTime = _.get(statBefore, PATHS.time);
  const afterTime = _.get(statAfter, PATHS.time);

  const { dayDelta, isDateMissingUpdate, nextDateText } = resolveDayDelta(beforeDate, afterDate, beforeTime, afterTime);
  if (dayDelta <= 0 && !isDateMissingUpdate) return false;

  let changed = false;

  if (isDateMissingUpdate && typeof nextDateText === 'string') {
    if (await setIfChanged(mvu, PATHS.date, nextDateText)) changed = true;
  }

  const energyPath = pickExistingPath(statAfter, PATHS.mcEnergy);
  const energyMaxPath = pickExistingPath(statAfter, PATHS.mcEnergyMax);
  const energy = toFiniteNumber(_.get(statAfter, energyPath), 0) ?? 0;
  const energyMax = toFiniteNumber(_.get(statAfter, energyMaxPath), null);

  if (energyMax !== null) {
    const safeMax = Math.max(0, energyMax);
    const regenPerDay = safeMax * 0.5;
    const nextEnergy = clampNumber(energy + regenPerDay * dayDelta, 0, safeMax);
    if (await setIfChanged(mvu, energyPath, nextEnergy)) changed = true;
    // 若别名字段也存在，保持一致
    for (const aliasPath of [...PATHS.mcEnergy, ...PATHS.mcEnergyMax]) {
      if (!_.has(statAfter, aliasPath)) continue;
      if (aliasPath === energyPath || aliasPath === energyMaxPath) continue;
      const aliasValue = aliasPath.includes('能量上限') ? safeMax : nextEnergy;
      if (await setIfChanged(mvu, aliasPath, aliasValue)) changed = true;
    }
  }

  const suspicion = toFiniteNumber(_.get(statAfter, PATHS.suspicion), null);
  const roles = _.get(statAfter, PATHS.roles);
  let dailySuspicionIncrease = 0;
  if (_.isPlainObject(roles)) {
    for (const [roleName, roleValue] of Object.entries<any>(roles)) {
      if (!roleName) continue;
      if (!_.isPlainObject(roleValue)) continue;
      const alertnessPath = `${PATHS.roles}.${roleName}.警戒度`;
      const alertness = toFiniteNumber(_.get(statAfter, alertnessPath), null);
      if (alertness === null) continue;

      // 警戒度影响可疑度：每 5 点警戒度每天 +1 可疑度（按天结算，警戒度每天还会自然下降）
      for (let i = 0; i < dayDelta; i += 1) {
        const alertnessAtStart = Math.max(0, alertness - 10 * i);
        dailySuspicionIncrease += Math.floor(alertnessAtStart / 5);
      }

      const nextAlertness = Math.max(0, alertness - 10 * dayDelta);
      if (await setIfChanged(mvu, alertnessPath, nextAlertness)) changed = true;
    }
  }

  if (suspicion !== null) {
    const nextSuspicion = Math.max(0, suspicion - 10 * dayDelta + dailySuspicionIncrease);
    if (await setIfChanged(mvu, PATHS.suspicion, nextSuspicion)) changed = true;
  }

  return changed;
}

$(() => {
  (async () => {
    try {
      await waitGlobalInitialized('Mvu');
    } catch (err) {
      console.warn('[催眠APP脚本] Mvu 未就绪，脚本不生效', err);
      return;
    }

    let isSelfApplying = false;

    eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, async (after: Mvu.MvuData, before: Mvu.MvuData) => {
      if (isSelfApplying) {
        isSelfApplying = false;
        return;
      }

      try {
        const changed = await applyDailySettlement(after, before);
        if (!changed) return;

        isSelfApplying = true;
        await Mvu.replaceMvuData(after, getMessageVariableOption());
      } catch (err) {
        console.error('[催眠APP脚本] 每日结算失败', err);
        isSelfApplying = false;
      }
    });
  })();
});
