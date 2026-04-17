/**
 * 成就與任務 *Impl 函式實作（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { Achievement, Quest, QuestStatus } from '../../types';
import { QUEST_DB, type QuestDefinition } from '../../data/questDb';
import { MvuBridge } from '../mvuBridge';
import {
  buildRoleBasedAchievements,
  findQuestDef,
  mergeAchievementsWithClaimed,
  resolveQuestStatus,
  validateQuestDb,
} from './achievementQuestCore';
import type { PersistedStore } from '../types/persistedStore';

// 外部依賴類型定義
type NormalizeChatVariablesFn = (vars: any) => { system: any; store: PersistedStore };
type GetUserDataCoreFn = () => Promise<{ mcPoints: number; money: number }>;
type UpdateResourcesCoreFn = (patch: { money?: number }) => Promise<UserResources>;
type UpdateStoreWithFn = (callback: (store: PersistedStore) => PersistedStore) => Promise<PersistedStore>;

/**
 * 建立 Achievement/Quest *Impl 函式的工廠函式喵~
 */
export function createAchievementQuestImplFunctions(deps: {
  normalizeChatVariables: NormalizeChatVariablesFn;
  getVariables: (option?: any) => any;
  CHAT_OPTION: { type: 'chat' };
  getUserDataCore: GetUserDataCoreFn;
  updateResourcesCore: UpdateResourcesCoreFn;
  updateStoreWith: UpdateStoreWithFn;
  toFiniteNumber: (value: unknown) => number | null;
  makeAchievementId: (prefix: string, ...parts: string[]) => string;
  getRolesAndSystemSnapshot: () => Promise<{ system: Record<string, any>; roles: Record<string, any> }>;
}) {
  const { normalizeChatVariables, getVariables, CHAT_OPTION, getUserDataCore, updateResourcesCore, updateStoreWith } = deps;

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

  return {
    getAchievementsImpl,
    getQuestsImpl,
    acceptQuestImpl,
    cancelQuestImpl,
    publishCustomQuestImpl,
    deleteCustomQuestImpl,
    findQuestDefById,
    QUEST_DATABASE,
  };
}

// 匯出類型供外部使用喵~
export type AchievementQuestImplFns = ReturnType<typeof createAchievementQuestImplFunctions>;
