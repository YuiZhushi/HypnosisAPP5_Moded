import type { Achievement, Quest, QuestStatus, UserResources } from '../../types';
import { QUEST_DB, type QuestDefinition } from '../../data/questDb';
import { MvuBridge } from '../mvuBridge';
import type { PersistedStore } from '../types/persistedStore';

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

import {
  normalizeChatVariables,
  CHAT_OPTION,
  updateStoreWith,
  getUserDataCore,
  updateResourcesCore,
  getVariables,
} from './systemCoreManager';

/**
 * 撱箇? Achievement/Quest *Impl ?賢??極撱撘~
 */
export function createAchievementQuestImplFunctions(deps: {
  toFiniteNumber: (value: unknown) => number | null;
  makeAchievementId: (prefix: string, ...parts: string[]) => string;
  getRolesAndSystemSnapshot: () => Promise<{ system: Record<string, any>; roles: Record<string, any> }>;
}) {

  const QUEST_DATABASE = validateQuestDb(QUEST_DB);
  const findQuestDefById = (id: string, store: PersistedStore): QuestDefinition | null =>
    findQuestDef(id, store, QUEST_DATABASE);

  /**
   * 取得成就列表喵~
   */
  async function getAchievementsImpl(): Promise<Achievement[]> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const dynamic = await buildRoleBasedAchievements(store, {
      getRolesAndSystemSnapshot: deps.getRolesAndSystemSnapshot,
      toFiniteNumber: deps.toFiniteNumber,
      makeAchievementId: deps.makeAchievementId,
    });
    return mergeAchievementsWithClaimed(store, dynamic);
  }

  /**
   * 取得任務列表喵~
   */
  async function getQuestsImpl(): Promise<Quest[]> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const claimed = store.quests ?? {};
    const tasks = (await MvuBridge.getTasks().catch(() => null)) ?? {};

    const quests: Quest[] = QUEST_DATABASE.map(q => ({
      id: q.id,
      title: q.name,
      description: q.condition,
      rewardMcPoints: q.rewardMcPoints,
      status: resolveQuestStatus(claimed[q.id], (tasks as any)[q.name]),
    }));

    for (const [cid, cq] of Object.entries(store.customQuests ?? {})) {
      quests.push({
        id: cid,
        title: cq.name,
        description: cq.condition,
        rewardMcPoints: cq.rewardMcPoints,
        status: resolveQuestStatus(claimed[cid], (tasks as any)[cq.name]),
        isCustom: true,
      });
    }

    const order: Record<QuestStatus, number> = { COMPLETED: 0, ACTIVE: 1, AVAILABLE: 2, CLAIMED: 3 };
    quests.sort((a, b) => order[a.status] - order[b.status]);
    return quests;
  }

  /**
   * 接取任務喵~
   */
  async function acceptQuestImpl(id: string): Promise<{ success: boolean; message?: string }> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const def = findQuestDefById(id, store);
    if (!def) return { success: false, message: '未知任务' };
    if (def.name.includes('.')) return { success: false, message: '任务名不能包含"。"' };
    if (store.quests?.[id] === 'CLAIMED') return { success: false, message: '该任务已完成并锁定' };

    const tasks = await MvuBridge.getTasks();
    if (!tasks) return { success: false, message: 'MVU 未就绪，无法接取任务' };

    const activeTaskNames = Object.entries(tasks).filter(
      ([, v]) => v && typeof v === 'object' && typeof (v as any).已完成 === 'boolean',
    );
    if (activeTaskNames.length >= 3) return { success: false, message: '同时最多只能接取3个任务' };
    if ((tasks as any)[def.name]) return { success: false, message: '该任务已在进行中' };

    try {
      await MvuBridge.setTask(def.name, { 完成条件: def.condition, 已完成: false });
      const after = await MvuBridge.getTasks();
      if (!after || !(def.name in after)) {
        return { success: false, message: '接取失败：任务未写入 MVU（请确认 MVU schema 已包含"任务"）' };
      }
      return { success: true };
    } catch (err) {
      console.warn('[HypnoOS] 接取任务写入失败', err);
      return { success: false, message: '接取失败：写入 MVU 出错' };
    }
  }

  /**
   * 取消任務喵~
   */
  async function cancelQuestImpl(id: string): Promise<{ success: boolean; message?: string }> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const def = findQuestDefById(id, store);
    if (!def) return { success: false, message: '未知任务' };
    if (def.name.includes('.')) return { success: false, message: '任务名不能包含"。"' };
    if (store.quests?.[id] === 'CLAIMED') return { success: false, message: '该任务已完成并锁定' };

    const tasks = await MvuBridge.getTasks();
    if (!tasks) return { success: false, message: 'MVU 未就绪，无法取消任务' };
    if (!(def.name in (tasks as any))) return { success: false, message: '该任务未在进行中' };

    try {
      await MvuBridge.deleteTask(def.name);
      const after = await MvuBridge.getTasks();
      if (after && def.name in after) return { success: false, message: '取消失败：任务未从 MVU 删除' };
      return { success: true };
    } catch (err) {
      console.warn('[HypnoOS] 取消任务失败', err);
      return { success: false, message: '取消失败：写入 MVU 出错' };
    }
  }

  /**
   * 發布自定義任務喵~
   */
  async function publishCustomQuestImpl(params: {
    name: string;
    condition: string;
    rewardMcPoints: number;
  }): Promise<{ ok: boolean; message?: string }> {
    const { name, condition, rewardMcPoints } = params;
    const trimmedName = name.trim();
    if (!trimmedName) return { ok: false, message: '名称不能为空' };
    if (trimmedName.includes('.')) return { ok: false, message: '名称不能包含"."' };
    if (!Number.isFinite(rewardMcPoints) || rewardMcPoints <= 0 || !Number.isInteger(rewardMcPoints)) {
      return { ok: false, message: '奖励必须为正整数' };
    }
    if (!condition.trim()) return { ok: false, message: '完成条件不能为空' };

    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const predefinedNameExists = QUEST_DATABASE.some(q => q.name === trimmedName);
    const customNameExists = Object.values(store.customQuests ?? {}).some(q => q.name === trimmedName);
    if (predefinedNameExists || customNameExists) return { ok: false, message: '已存在同名任务' };

    const cost = rewardMcPoints * 800;
    const user = await getUserDataCore();
    if (user.money < cost) return { ok: false, message: `零花钱不足：需要 ¥${cost}，当前 ¥${user.money}` };

    await updateResourcesCore({ money: user.money - cost });

    const questId = `custom_quest_${Date.now()}`;
    await updateStoreWith(s => ({
      ...s,
      customQuests: {
        ...s.customQuests,
        [questId]: {
          name: trimmedName,
          condition: condition.trim(),
          rewardMcPoints,
          createdAt: Date.now(),
        },
      },
    }));

    console.info(`[HypnoOS] 发布自定义任务「${trimmedName}」(¥${cost})`);
    return { ok: true };
  }

  /**
   * 刪除自定義任務喵~
   */
  async function deleteCustomQuestImpl(id: string): Promise<{ ok: boolean; message?: string }> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const cq = store.customQuests?.[id];
    if (!cq) return { ok: false, message: '未找到该自定义任务' };

    try {
      const tasks = await MvuBridge.getTasks();
      if (tasks && cq.name in (tasks as any)) {
        await MvuBridge.deleteTask(cq.name);
      }
    } catch (err) {
      console.warn('[HypnoOS] 清理 MVU 任务失败', err);
    }

    const refund = cq.rewardMcPoints * 800;
    const user = await getUserDataCore();
    await updateResourcesCore({ money: user.money + refund });

    await updateStoreWith(s => {
      const nextCustom = { ...s.customQuests };
      delete nextCustom[id];
      const nextQuests = { ...s.quests };
      delete nextQuests[id];
      return { ...s, customQuests: nextCustom, quests: nextQuests };
    });

    console.info(`[HypnoOS] 删除自定义任务「${cq.name}」(退款 ¥${refund})`);
    return { ok: true };
  }

  async function claimAchievementImpl(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
    const achievements = await getAchievementsImpl();
    const ach = achievements.find(a => a.id === id);
    if (!ach) return { success: false, newPoints: currentPoints };

    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    if (store.achievements?.[id]) return { success: false, newPoints: currentPoints };

    const user = await getUserDataCore();
    if (!ach.checkCondition(user)) return { success: false, newPoints: currentPoints };

    const newPoints = currentPoints + ach.rewardMcPoints;
    await updateResourcesCore({ mcPoints: newPoints });
    await updateStoreWith(s => ({ ...s, achievements: { ...s.achievements, [id]: true } }));
    return { success: true, newPoints };
  }

  async function claimQuestImpl(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const def = findQuestDefById(id, store);
    if (!def) return { success: false, newPoints: currentPoints };

    const taskName = def.name;
    if (taskName.includes('.')) return { success: false, newPoints: currentPoints };

    const tasks = await MvuBridge.getTasks();
    if (!tasks) return { success: false, newPoints: currentPoints };
    const taskState = (tasks as any)[taskName];
    const taskDone =
      taskState &&
      typeof taskState === 'object' &&
      (taskState as { 已完成?: boolean }).已完成 === true;
    if (!taskDone)
      return { success: false, newPoints: currentPoints };

    const newPoints = currentPoints + def.rewardMcPoints;
    await updateResourcesCore({ mcPoints: newPoints });
    await updateStoreWith(s => ({ ...s, quests: { ...s.quests, [id]: 'CLAIMED' } }));
    await MvuBridge.deleteTask(taskName);
    return { success: true, newPoints };
  }

  return {
    getAchievementsImpl,
    getQuestsImpl,
    acceptQuestImpl,
    cancelQuestImpl,
    publishCustomQuestImpl,
    deleteCustomQuestImpl,
    claimAchievementImpl,
    claimQuestImpl,
    findQuestDefById,
    QUEST_DATABASE,
  };
}

export type AchievementQuestUsecaseFns = ReturnType<typeof createAchievementQuestImplFunctions>;
