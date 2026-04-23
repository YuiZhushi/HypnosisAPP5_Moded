/**
 * Achievement & Quest APP 後端 — 統一入口
 *
 * 職責：
 * - 成就列表生成（靜態 + 動態角色相關）
 * - 成就領取
 * - 任務列表生成（預定義 + 自定義）
 * - 任務接取/取消/領取
 * - 自定義任務發布/刪除
 *
 * 所有 MVU 操作透過 shared/mvu/mvuBridge，
 * 所有 Store 操作透過 shared/store/storeGateway。
 */

import type { Achievement, Quest, QuestStatus, UserResources } from '../../constants/interfaces';
import type { PersistedStore, CustomQuestDef } from '../../constants/schemas/storeSchema';
import { STATIC_ACHIEVEMENTS, ACHIEVEMENT_THRESHOLDS } from '../../constants/achievement/achievementDb';
import { QUEST_DB, type QuestDefinition } from '../../constants/achievement/questDb';
import { normalizeChatVariables, readStoreSnapshot, updateStoreWith, CHAT_OPTION } from '../../shared/store/storeGateway';
import { getUserData, updateResources } from '../../shared/store/resourceSync';
import * as MvuBridge from '../../shared/mvu/mvuBridge';
import { logger } from '../../shared/debug/loggerService';

// ====== 內部工具 ======

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function idSafe(part: string): string {
  return encodeURIComponent(part).replaceAll('%', '_');
}

function makeAchievementId(prefix: string, ...parts: string[]): string {
  return [prefix, ...parts.map(idSafe)].join('__');
}

// ====== 任務定義查找 ======

const QUEST_DATABASE = validateQuestDb(QUEST_DB);

function validateQuestDb(db: QuestDefinition[]): QuestDefinition[] {
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

function findQuestDef(id: string, store: PersistedStore): QuestDefinition | null {
  const predefined = QUEST_DATABASE.find(q => q.id === id);
  if (predefined) return predefined;
  const custom = store.customQuests?.[id];
  if (custom) return { id, name: custom.name, condition: custom.condition, rewardMcPoints: custom.rewardMcPoints };
  return null;
}

// ====== 任務狀態解析 ======

function resolveQuestStatus(claimedStatus: QuestStatus | undefined, taskState: unknown): QuestStatus {
  if (claimedStatus === 'CLAIMED') return 'CLAIMED';
  const completed = Boolean(taskState && typeof taskState === 'object' && (taskState as any).已完成 === true);
  const active = Boolean(taskState && typeof taskState === 'object' && typeof (taskState as any).已完成 === 'boolean');
  return completed ? 'COMPLETED' : active ? 'ACTIVE' : 'AVAILABLE';
}

// ====== MVU 快照 ======

async function getRolesAndSystemSnapshot(): Promise<{ system: Record<string, any>; roles: Record<string, any> }> {
  let system: Record<string, any> | null = null;
  let roles: Record<string, any> | null = null;
  try {
    system = await MvuBridge.getSystem();
    roles = await MvuBridge.getRoles();
  } catch { /* ignore */ }

  if (system && roles) return { system, roles };

  const vars = getVariables(CHAT_OPTION);
  const normalized = normalizeChatVariables(vars);
  return {
    system: system ?? (normalized.system as any),
    roles: roles ?? (vars as any)?.角色 ?? {},
  };
}

// ====== 動態成就生成 ======

async function buildRoleBasedAchievements(store: PersistedStore): Promise<Array<Omit<Achievement, 'isClaimed'>>> {
  const { system, roles } = await getRolesAndSystemSnapshot();
  const achievements: Array<Omit<Achievement, 'isClaimed'>> = [];

  // 首次催眠
  achievements.push({
    id: 'ach_first_hypnosis',
    title: '首次使用催眠',
    description: '首次启动催眠流程。',
    rewardMcPoints: 15,
    checkCondition: () => Boolean(store.hasUsedHypnosis),
  });

  // 可疑度
  const suspicion = toFiniteNumber(system?.主角可疑度) ?? 0;
  for (const t of ACHIEVEMENT_THRESHOLDS.suspicion) {
    achievements.push({
      id: makeAchievementId('ach_suspicion', String(t)),
      title: `主角可疑度达到 ${t}`,
      description: `主角可疑度达到 ${t}%（系统.主角可疑度）`,
      rewardMcPoints: t,
      checkCondition: () => suspicion >= t,
    });
  }

  // MC 能量上限
  const energyMax = toFiniteNumber(system?._MC能量上限) ?? 0;
  for (const [t, reward] of ACHIEVEMENT_THRESHOLDS.energyMax) {
    achievements.push({
      id: makeAchievementId('ach_energy_max', String(t)),
      title: `MC能量上限达到 ${t}`,
      description: `MC能量上限达到 ${t}（系统._MC能量上限）`,
      rewardMcPoints: reward,
      checkCondition: () => energyMax >= t,
    });
  }

  // 角色相關成就
  for (const [roleName, roleDataRaw] of Object.entries(roles ?? {})) {
    if (!roleName || !roleDataRaw || typeof roleDataRaw !== 'object') continue;
    const roleData = roleDataRaw as Record<string, any>;

    const guard = toFiniteNumber(roleData['警戒度']) ?? 0;
    const obey = toFiniteNumber(roleData['服从度']) ?? 0;

    for (const t of ACHIEVEMENT_THRESHOLDS.percent) {
      achievements.push({
        id: makeAchievementId('ach_role_guard', roleName, String(t)),
        title: `${roleName} 警戒度达到 ${t}`,
        description: `${roleName} 的警戒度达到 ${t}（角色.${roleName}.警戒度）`,
        rewardMcPoints: t,
        checkCondition: () => guard >= t,
      });
      achievements.push({
        id: makeAchievementId('ach_role_obey', roleName, String(t)),
        title: `${roleName} 服从度达到 ${t}`,
        description: `${roleName} 的服从度达到 ${t}（角色.${roleName}.服从度）`,
        rewardMcPoints: t,
        checkCondition: () => obey >= t,
      });
    }

    // 敏感度
    const sensitivityKeys = Object.keys(roleData).filter(k => k.includes('敏感度'));
    for (const key of sensitivityKeys) {
      const value = toFiniteNumber(roleData[key]);
      if (value === null) continue;
      for (const t of ACHIEVEMENT_THRESHOLDS.sensitivity) {
        achievements.push({
          id: makeAchievementId('ach_sensitivity', roleName, key, String(t)),
          title: `${roleName}·${key} ≥ ${t}`,
          description: `${roleName} 的 ${key} 达到 ${t}（角色.${roleName}.${key}）`,
          rewardMcPoints: 20,
          checkCondition: () => value >= t,
        });
      }
    }

    // 高潮次數
    const orgasmKeys = Object.keys(roleData).filter(k => k.includes('高潮次数'));
    for (const key of orgasmKeys) {
      const value = toFiniteNumber(roleData[key]);
      if (value === null) continue;
      for (const t of ACHIEVEMENT_THRESHOLDS.orgasm) {
        achievements.push({
          id: makeAchievementId('ach_orgasm', roleName, key, String(t)),
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

function mergeAchievementsWithClaimed(
  store: PersistedStore,
  dynamicAchievements: Array<Omit<Achievement, 'isClaimed'>>,
): Achievement[] {
  const all = [...STATIC_ACHIEVEMENTS, ...dynamicAchievements];
  return all.map(a => ({ ...a, isClaimed: store.achievements[a.id] ?? false }));
}

// ====== 公開 API：成就 ======

/** 取得所有成就列表（含領取狀態） */
export async function getAchievements(): Promise<Achievement[]> {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const dynamic = await buildRoleBasedAchievements(store);
  return mergeAchievementsWithClaimed(store, dynamic);
}

/** 領取成就獎勵 */
export async function claimAchievement(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
  const achievements = await getAchievements();
  const ach = achievements.find(a => a.id === id);
  if (!ach) return { success: false, newPoints: currentPoints };

  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  if (store.achievements?.[id]) return { success: false, newPoints: currentPoints };

  const user = await getUserData();
  if (!ach.checkCondition(user)) return { success: false, newPoints: currentPoints };

  const newPoints = currentPoints + ach.rewardMcPoints;
  await updateResources({ mcPoints: newPoints });
  await updateStoreWith(s => ({ ...s, achievements: { ...s.achievements, [id]: true } }));
  return { success: true, newPoints };
}

// ====== 公開 API：任務 ======

/** 取得所有任務列表（含狀態） */
export async function getQuests(): Promise<Quest[]> {
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

/** 接取任務 */
export async function acceptQuest(id: string): Promise<{ success: boolean; message?: string }> {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const def = findQuestDef(id, store);
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
    logger.warn('接取任务写入失败', err);
    return { success: false, message: '接取失败：写入 MVU 出错' };
  }
}

/** 取消任務 */
export async function cancelQuest(id: string): Promise<{ success: boolean; message?: string }> {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const def = findQuestDef(id, store);
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
    logger.warn('取消任务失败', err);
    return { success: false, message: '取消失败：写入 MVU 出错' };
  }
}

/** 領取任務獎勵 */
export async function claimQuest(id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const def = findQuestDef(id, store);
  if (!def) return { success: false, newPoints: currentPoints };

  const taskName = def.name;
  if (taskName.includes('.')) return { success: false, newPoints: currentPoints };

  const tasks = await MvuBridge.getTasks();
  if (!tasks) return { success: false, newPoints: currentPoints };
  const taskState = (tasks as any)[taskName];
  const taskDone = taskState && typeof taskState === 'object' && (taskState as { 已完成?: boolean }).已完成 === true;
  if (!taskDone) return { success: false, newPoints: currentPoints };

  const newPoints = currentPoints + def.rewardMcPoints;
  await updateResources({ mcPoints: newPoints });
  await updateStoreWith(s => ({ ...s, quests: { ...s.quests, [id]: 'CLAIMED' as QuestStatus } }));
  await MvuBridge.deleteTask(taskName);
  return { success: true, newPoints };
}

// ====== 公開 API：自定義任務 ======

/** 發布自定義任務 */
export async function publishCustomQuest(params: {
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
  const user = await getUserData();
  if (user.money < cost) return { ok: false, message: `零花钱不足：需要 ¥${cost}，当前 ¥${user.money}` };

  await updateResources({ money: user.money - cost });

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

  logger.info(`发布自定义任务「${trimmedName}」(¥${cost})`);
  return { ok: true };
}

/** 刪除自定義任務（退款） */
export async function deleteCustomQuest(id: string): Promise<{ ok: boolean; message?: string }> {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const cq = store.customQuests?.[id];
  if (!cq) return { ok: false, message: '未找到该自定义任务' };

  // 清理 MVU 中的任務
  try {
    const tasks = await MvuBridge.getTasks();
    if (tasks && cq.name in (tasks as any)) {
      await MvuBridge.deleteTask(cq.name);
    }
  } catch (err) {
    logger.warn('清理 MVU 任务失败', err);
  }

  // 退款
  const refund = cq.rewardMcPoints * 800;
  const user = await getUserData();
  await updateResources({ money: user.money + refund });

  await updateStoreWith(s => {
    const nextCustom = { ...s.customQuests };
    delete nextCustom[id];
    const nextQuests = { ...s.quests };
    delete nextQuests[id];
    return { ...s, customQuests: nextCustom, quests: nextQuests };
  });

  logger.info(`删除自定义任务「${cq.name}」(退款 ¥${refund})`);
  return { ok: true };
}
