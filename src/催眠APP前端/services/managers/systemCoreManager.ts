import { z } from 'zod';
import { UserResources } from '../../types';
import { MvuBridge } from '../mvuBridge';
import { createStoreGateway } from '../store/storeGateway';
import { DEFAULT_USER_DATA } from '../constants/userDefaults';
import { createSystemSchema, type SystemWithStore } from '../store/systemSchema';
import { STORE_SCHEMA } from '../store/storeSchema';
import { migrateStore } from '../store/migrateStore';
import { normalizeSystemAliases } from '../helpers/systemHelpers';
import { systemToUserResources } from '../helpers/userResourceHelpers';
import { getSystemClockFrom } from '../helpers/timeHelpers';
import { getSubscriptionTierLabel } from '../constants/subscriptionConstants';
import type { SubscriptionState } from '../access';
import type { PersistedStore } from '../types/persistedStore';

declare function getVariables(option?: any): any;
declare function updateVariablesWith(callback: (vars: any) => void, option?: any): any;
declare function getCurrentMessageId(): number;
declare function getChatMessages(floor?: number, options?: { include_swipes?: boolean }): unknown[] | undefined;

export const CHAT_OPTION = { type: 'chat' } as const;

const SYSTEM_SCHEMA = createSystemSchema(DEFAULT_USER_DATA);

export const storeGateway = createStoreGateway<SystemWithStore, PersistedStore>({
  chatOption: CHAT_OPTION,
  getVariables,
  updateVariablesWith,
  normalizeSystemAliases,
  systemSchema: SYSTEM_SCHEMA,
  storeSchema: STORE_SCHEMA,
  migrateStore,
  syncPersistedStore: store => MvuBridge.syncPersistedStore(store),
});

export function normalizeChatVariables(vars: any) {
  return storeGateway.normalizeChatVariables(vars);
}

export function updateStoreWith(updater: any) {
  return storeGateway.updateStoreWith(updater);
}

export function readStoreSnapshot() {
  return storeGateway.readStoreSnapshot();
}

const _getVariables = (option?: any) => getVariables(option);
const _updateVariablesWith = (callback: (vars: any) => void, option?: any) => updateVariablesWith(callback, option);
const _getCurrentMessageId = () => getCurrentMessageId();
const _getChatMessages = (floor?: number, options?: { include_swipes?: boolean }) => getChatMessages(floor, options);

export { _getVariables as getVariables, _updateVariablesWith as updateVariablesWith, _getCurrentMessageId as getCurrentMessageId, _getChatMessages as getChatMessages };

export async function setSubscriptionTierLabel(tierLabel: string): Promise<void> {
  updateVariablesWith(vars => {
    const { system } = normalizeChatVariables(vars);
    if (system._催眠APP订阅等级 === tierLabel) return vars;
    system._催眠APP订阅等级 = tierLabel;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);
  await MvuBridge.syncSubscriptionTier(tierLabel);
}

export async function getUserDataCore(): Promise<UserResources> {
  let user: UserResources | undefined;
  try {
    const mvuSystem = await MvuBridge.getSystem();
    if (mvuSystem) {
      user = systemToUserResources(SYSTEM_SCHEMA.parse(normalizeSystemAliases(mvuSystem)));
    }
  } catch (err) {
    console.warn('[HypnoOS] 读取 MVU 系统变量失败，回退到聊天变量', err);
  }

  updateVariablesWith(vars => {
    const { system } = normalizeChatVariables(vars);
    user ??= systemToUserResources(system);
    return vars;
  }, CHAT_OPTION);

  if (user) {
    updateVariablesWith(vars => {
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

export async function updateResourcesCore(newData: Partial<UserResources>): Promise<UserResources> {
  const merged: UserResources = { ...(await getUserDataCore()), ...newData };
  updateVariablesWith(vars => {
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

export async function syncSubscriptionTierLabel(nowVirtualMinutes: number | null): Promise<void> {
  const { system, store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const subscription = (store.subscription as SubscriptionState | undefined) ?? null;
  const desired = getSubscriptionTierLabel(subscription, nowVirtualMinutes);
  if (desired === null) return;
  if (system._催眠APP订阅等级 === desired) return;

  updateVariablesWith(vars => {
    const { system: nextSystem } = normalizeChatVariables(vars);
    nextSystem._催眠APP订阅等级 = desired;
    vars.系统 = nextSystem;
    return vars;
  }, CHAT_OPTION);

  await MvuBridge.syncSubscriptionTier(desired);
}

export async function getSystemClockCore(): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> {
  const maybeSync = async (clock: { virtualMinutes: number | null }) => {
    try {
      await syncSubscriptionTierLabel(clock.virtualMinutes);
    } catch (err) {
      console.warn('[HypnoOS] 同步订阅等级变量失败', err);
    }
    return clock;
  };

  try {
    const mvuSystem = await MvuBridge.getSystem();
    if (mvuSystem) return await maybeSync(getSystemClockFrom(mvuSystem));
  } catch (err) {
    console.warn('[HypnoOS] 读取 MVU 系统时间失败，回退到聊天变量', err);
  }

  const { system } = normalizeChatVariables(getVariables(CHAT_OPTION));
  return await maybeSync(getSystemClockFrom(system));
}
