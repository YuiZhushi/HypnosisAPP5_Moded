import { type QuestDefinition } from '../../data/questDb';
import { Achievement, QuestStatus, UserResources } from '../../types';
import { type PersistedStore } from '../types/persistedStore';

/**
 * 靜態成就模板：與角色無關，只取決於玩家資源。
 */
export const STATIC_ACHIEVEMENTS: Array<Omit<Achievement, 'isClaimed'>> = [
  {
    id: 'ach_newbie',
    title: '初次接触',
    description: '累计消耗超过 10 点 MC 能量。',
    rewardMcPoints: 5,
    checkCondition: u => u.totalConsumedMc >= 10,
  },
  {
    id: 'ach_vip2',
    title: '进阶会员',
    description: '解锁 VIP 2 权限 (累计消耗 100 MC)。',
    rewardMcPoints: 20,
    checkCondition: u => u.totalConsumedMc >= 100,
  },
  {
    id: 'ach_rich',
    title: '资金充裕',
    description: '持有金钱超过 50,000 円。',
    rewardMcPoints: 10,
    checkCondition: u => u.money >= 50000,
  },
  {
    id: 'ach_sus',
    title: '隐秘行动',
    description: '将可疑度控制在 5% 以下。',
    rewardMcPoints: 50,
    checkCondition: u => u.suspicion <= 5,
  },
];

export function validateQuestDb(db: QuestDefinition[]) {
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const q of db) {
    if (ids.has(q.id)) throw new Error(`[HypnoOS] QUEST_DB 重复 id: ${q.id}`);
    ids.add(q.id);
    if (names.has(q.name)) throw new Error(`[HypnoOS] QUEST_DB 重复 name: ${q.name}`);
    names.add(q.name);
  }
  return db;
}

/** Look up a quest definition from both predefined and custom sources. */
export function findQuestDef(id: string, store: PersistedStore, questDb: QuestDefinition[]): QuestDefinition | null {
  const predefined = questDb.find(q => q.id === id);
  if (predefined) return predefined;
  const custom = store.customQuests?.[id];
  if (custom) return { id, name: custom.name, condition: custom.condition, rewardMcPoints: custom.rewardMcPoints };
  return null;
}

/**
 * 任務狀態歸一化：優先已領取，其次從 MVU task 狀態推導。
 */
export function resolveQuestStatus(claimedStatus: QuestStatus | undefined, taskState: unknown): QuestStatus {
  if (claimedStatus === 'CLAIMED') return 'CLAIMED';
  const completed = Boolean(taskState && typeof taskState === 'object' && (taskState as any).已完成 === true);
  const active = Boolean(taskState && typeof taskState === 'object' && typeof (taskState as any).已完成 === 'boolean');
  return completed ? 'COMPLETED' : active ? 'ACTIVE' : 'AVAILABLE';
}

export async function buildRoleBasedAchievements(
  store: PersistedStore,
  deps: {
    getRolesAndSystemSnapshot: () => Promise<{ system: Record<string, any>; roles: Record<string, any> }>;
    toFiniteNumber: (value: unknown) => number | null;
    makeAchievementId: (prefix: string, ...parts: string[]) => string;
  },
): Promise<Array<Omit<Achievement, 'isClaimed'>>> {
  const { system, roles } = await deps.getRolesAndSystemSnapshot();

  const achievements: Array<Omit<Achievement, 'isClaimed'>> = [];

  achievements.push({
    id: 'ach_first_hypnosis',
    title: '首次使用催眠',
    description: '首次启动催眠流程。',
    rewardMcPoints: 15,
    checkCondition: () => Boolean(store.hasUsedHypnosis),
  });

  const suspicion = deps.toFiniteNumber(system?.主角可疑度) ?? 0;
  for (const t of [25, 50, 75, 100]) {
    achievements.push({
      id: deps.makeAchievementId('ach_suspicion', String(t)),
      title: `主角可疑度达到 ${t}`,
      description: `主角可疑度达到 ${t}%（系统.主角可疑度）`,
      rewardMcPoints: t,
      checkCondition: () => suspicion >= t,
    });
  }

  const energyMax = deps.toFiniteNumber(system?._MC能量上限) ?? 0;
  const energyMaxThresholds: Array<[number, number]> = [
    [100, 10],
    [300, 30],
    [1000, 50],
  ];
  for (const [t, reward] of energyMaxThresholds) {
    achievements.push({
      id: deps.makeAchievementId('ach_energy_max', String(t)),
      title: `MC能量上限达到 ${t}`,
      description: `MC能量上限达到 ${t}（系统._MC能量上限）`,
      rewardMcPoints: reward,
      checkCondition: () => energyMax >= t,
    });
  }

  const sensitivityThresholds = [200, 300, 400, 500];
  const orgasmThresholds = [1, 5, 25, 100];
  const percentThresholds = [25, 50, 75, 100];

  for (const [roleName, roleDataRaw] of Object.entries(roles ?? {})) {
    if (!roleName) continue;
    if (!roleDataRaw || typeof roleDataRaw !== 'object') continue;
    const roleData = roleDataRaw as Record<string, any>;

    const guard = deps.toFiniteNumber(roleData['警戒度']) ?? 0;
    const obey = deps.toFiniteNumber(roleData['服从度']) ?? 0;

    for (const t of percentThresholds) {
      achievements.push({
        id: deps.makeAchievementId('ach_role_guard', roleName, String(t)),
        title: `${roleName} 警戒度达到 ${t}`,
        description: `${roleName} 的警戒度达到 ${t}（角色.${roleName}.警戒度）`,
        rewardMcPoints: t,
        checkCondition: () => guard >= t,
      });
      achievements.push({
        id: deps.makeAchievementId('ach_role_obey', roleName, String(t)),
        title: `${roleName} 服从度达到 ${t}`,
        description: `${roleName} 的服从度达到 ${t}（角色.${roleName}.服从度）`,
        rewardMcPoints: t,
        checkCondition: () => obey >= t,
      });
    }

    const sensitivityKeys = Object.keys(roleData).filter(k => k.includes('敏感度'));
    for (const key of sensitivityKeys) {
      const value = deps.toFiniteNumber(roleData[key]);
      if (value === null) continue;
      for (const t of sensitivityThresholds) {
        achievements.push({
          id: deps.makeAchievementId('ach_sensitivity', roleName, key, String(t)),
          title: `${roleName}·${key} ≥ ${t}`,
          description: `${roleName} 的 ${key} 达到 ${t}（角色.${roleName}.${key}）`,
          rewardMcPoints: 20,
          checkCondition: () => value >= t,
        });
      }
    }

    const orgasmKeys = Object.keys(roleData).filter(k => k.includes('高潮次数'));
    for (const key of orgasmKeys) {
      const value = deps.toFiniteNumber(roleData[key]);
      if (value === null) continue;
      for (const t of orgasmThresholds) {
        achievements.push({
          id: deps.makeAchievementId('ach_orgasm', roleName, key, String(t)),
          title: `${roleName}·${key} ≥ ${t}`,
          description: `${roleName} 的 ${key} 达到 ${t}（角色.${roleName}.${key}）`,
          rewardMcPoints: 20,
          checkCondition: () => value >= t,
        });
      }
    }
  }

  return achievements;
}

export function mergeAchievementsWithClaimed(
  store: PersistedStore,
  dynamicAchievements: Array<Omit<Achievement, 'isClaimed'>>,
): Achievement[] {
  const all = [...STATIC_ACHIEVEMENTS, ...dynamicAchievements];
  return all.map(a => ({ ...a, isClaimed: store.achievements[a.id] ?? false }));
}
