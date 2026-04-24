/**
 * ResourceSync — 用戶資源讀寫 + 系統時鐘
 *
 * 從 systemCoreManager.ts 下沉的核心功能。
 * 職責：
 * - getUserData / updateResources（讀寫用戶資源）
 * - getSystemClock（虛擬時間）
 * - syncSubscriptionTierLabel（訂閱等級同步）
 *
 * 被 backend/* 各 APP 的 Manager 調用。
 */

import type { UserResources, SubscriptionState } from '../../constants/interfaces';
import type { SystemWithStore } from '../../constants/schemas/systemSchema';
import { DEFAULT_USER_DATA } from '../../constants/common/userDefaults';
import { getSubscriptionTierLabel } from '../../constants/hypnosis/subscription';
import { normalizeChatVariables, CHAT_OPTION, SYSTEM_SCHEMA } from './storeGateway';
import * as MvuBridge from '../mvu/mvuBridge';
import { logger } from '../debug/loggerService';

// ====== 輔助函式 ======

/** 從系統變數轉換為 UserResources */
export function systemToUserResources(system: SystemWithStore): UserResources {
  return {
    mcEnergy: system._MC能量,
    mcEnergyMax: system._MC能量上限,
    mcPoints: system.当前MC点,
    totalConsumedMc: system._累计消耗MC点,
    money: system.持有零花钱,
    suspicion: system.主角可疑度,
  };
}

function toFiniteNumber(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** 從系統變數取得時鐘資訊 */
function getSystemClockFrom(system: Record<string, any> | null | undefined) {
  const dateText = typeof system?.当前日期 === 'string' ? system.当前日期 : undefined;
  const timeText = typeof system?.当前时间 === 'string' ? system.当前时间 : undefined;
  return { dateText, timeText, virtualMinutes: parseVirtualMinutesFrom(dateText, timeText) };
}

/** 從日期和時間文字解析虛擬分鐘數 */
function parseVirtualMinutesFrom(dateText?: string, timeText?: string): number | null {
  if (!dateText || !timeText) return null;
  const dateMatch = dateText.match(/(\d+)\s*月\s*(\d+)\s*日/);
  const timeMatch = timeText.match(/(\d{1,2})\s*:\s*(\d{1,2})(?:\s*:\s*(\d{1,2}))?/);
  if (!dateMatch || !timeMatch) return null;

  const month = Number(dateMatch[1]);
  const day = Number(dateMatch[2]);
  const hours = Number(timeMatch[1]);
  const minutes = Number(timeMatch[2]);
  const seconds = timeMatch[3] === undefined ? 0 : Number(timeMatch[3]);
  if (![month, day, hours, minutes].every(Number.isFinite)) return null;
  if (!Number.isFinite(seconds)) return null;

  const monthDays = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const mIndex = Math.max(1, Math.min(12, month)) - 1;
  const dIndex = Math.max(1, Math.min(monthDays[mIndex], day)) - 1;
  const dayOfYear = monthDays.slice(0, mIndex).reduce((a, b) => a + b, 0) + dIndex;

  const h = Math.max(0, Math.min(23, hours));
  const min = Math.max(0, Math.min(59, minutes));
  const sec = Math.max(0, Math.min(59, seconds));
  return dayOfYear * 24 * 60 + h * 60 + min + sec / 60;
}

/** 正規化系統變數別名 */
function normalizeSystemAliases(systemRaw: Record<string, any>): Record<string, any> {
  if (toFiniteNumber(systemRaw._MC能量) === null) {
    const v = toFiniteNumber(systemRaw.MC能量);
    if (v !== null) systemRaw._MC能量 = v;
  }
  if (toFiniteNumber(systemRaw._MC能量上限) === null) {
    const v = toFiniteNumber(systemRaw.MC能量上限);
    if (v !== null) systemRaw._MC能量上限 = v;
  }
  return systemRaw;
}

// ====== 公開 API ======

/**
 * 讀取用戶資源數據（MVU 優先，回退到聊天變量）
 */
export async function getUserData(): Promise<UserResources> {
  let user: UserResources | undefined;

  try {
    const mvuSystem = await MvuBridge.getSystem();
    if (mvuSystem) {
      user = systemToUserResources(SYSTEM_SCHEMA.parse(normalizeSystemAliases(mvuSystem)));
    }
  } catch (err) {
    logger.warn('读取 MVU 系统变量失败，回退到聊天变量', err);
  }

  updateVariablesWith((vars: Record<string, unknown>) => {
    const { system } = normalizeChatVariables(vars);
    user ??= systemToUserResources(system);
    return vars;
  }, CHAT_OPTION);

  // 如果 MVU 數據可用，同步回聊天變量
  if (user) {
    updateVariablesWith((vars: Record<string, unknown>) => {
      const { system, store } = normalizeChatVariables(vars);
      system._MC能量 = user!.mcEnergy;
      system._MC能量上限 = user!.mcEnergyMax;
      system.当前MC点 = user!.mcPoints;
      system._累计消耗MC点 = user!.totalConsumedMc;
      system.持有零花钱 = user!.money;
      system.主角可疑度 = user!.suspicion;
      system._hypnoos = store;
      vars.系统 = system;
      return vars;
    }, CHAT_OPTION);
  }

  return user ?? DEFAULT_USER_DATA;
}

/**
 * 更新用戶資源（部分更新 → 聊天變量 + MVU 同步）
 */
export async function updateResources(newData: Partial<UserResources>): Promise<UserResources> {
  const merged: UserResources = { ...(await getUserData()), ...newData };

  updateVariablesWith((vars: Record<string, unknown>) => {
    const { system, store } = normalizeChatVariables(vars);
    system._MC能量 = merged.mcEnergy;
    system._MC能量上限 = merged.mcEnergyMax;
    system.当前MC点 = merged.mcPoints;
    system._累计消耗MC点 = merged.totalConsumedMc;
    system.持有零花钱 = merged.money;
    system.主角可疑度 = merged.suspicion;
    system._hypnoos = store;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncUserResources(merged);
  return merged;
}

/**
 * 取得系統時鐘（MVU 優先）+ 自動同步訂閱等級
 */
export async function getSystemClock(): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> {
  const maybeSync = async (clock: { virtualMinutes: number | null }) => {
    try { await syncSubscriptionTierLabel(clock.virtualMinutes); } catch (err) { logger.warn('同步订阅等级变量失败', err); }
    return clock;
  };

  try {
    const mvuSystem = await MvuBridge.getSystem();
    if (mvuSystem) return await maybeSync(getSystemClockFrom(mvuSystem));
  } catch (err) {
    logger.warn('读取 MVU 系统时间失败，回退到聊天变量', err);
  }

  const { system } = normalizeChatVariables(getVariables(CHAT_OPTION));
  return await maybeSync(getSystemClockFrom(system));
}

/**
 * 同步訂閱等級標籤到聊天變量 + MVU
 */
export async function syncSubscriptionTierLabel(nowVirtualMinutes: number | null): Promise<void> {
  const { system, store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
  const desired = getSubscriptionTierLabel(subscription, nowVirtualMinutes);
  if (desired === null) return;
  if (system._催眠APP订阅等级 === desired) return;

  updateVariablesWith((vars: Record<string, unknown>) => {
    const { system: nextSystem } = normalizeChatVariables(vars);
    nextSystem._催眠APP订阅等级 = desired;
    vars.系统 = nextSystem;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncSubscriptionTier(desired);
}

/**
 * 直接設定訂閱等級標籤
 */
export async function setSubscriptionTierLabel(tierLabel: string): Promise<void> {
  updateVariablesWith((vars: Record<string, unknown>) => {
    const { system } = normalizeChatVariables(vars);
    if (system._催眠APP订阅等级 === tierLabel) return vars;
    system._催眠APP订阅等级 = tierLabel;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncSubscriptionTier(tierLabel);
}
