import _ from 'lodash';
import { toFiniteNumber, clampNumber } from '../../util/mathUtils';
import { resolveDayDelta } from '../../util/dateUtils';
import { setIfChanged, pickExistingPath } from '../../催眠APP前端/shared/mvu/mvuBridge';

const PATHS = {
  system: '系统',
  roles: '角色',
  date: '系统.当前日期',
  time: '系统.当前时间',
  suspicion: '系统.主角可疑度',
  mcEnergy: ['系统._MC能量', '系统.MC能量'],
  mcEnergyMax: ['系统._MC能量上限', '系统.MC能量上限'],
} as const;

export async function applyDailySettlement(mvu: Mvu.MvuData, before: Mvu.MvuData): Promise<boolean> {
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
