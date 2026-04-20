/**
 * DataService 入口層（Phase D-2 重構後）
 * 
 * 這個檔案現在只負責：
 * 1. 組裝依賴
 * 2. 作為 facade 對外入口
 * 
 * 所有實作都已下沉到對應的 helper / constant / store 模組與 managers 喵~
 */

import { z } from 'zod';
import { QUEST_DB, type QuestDefinition } from '../data/questDb';
import {
  Achievement,
  CustomHypnosisDef,
  EditorPromptModule,
  HypnosisFeature,
  PlaceholderDefinition,
  PromptTemplateV2,
  Quest,
  QuestStatus,
  SessionStartPayload,
  UserResources,
} from '../types';
import {
  canSubscribeTier,
  getSubscriptionUnlockThreshold,
  isSubscriptionActive,
  SUBSCRIPTION_TIERS,
  type AccessContext,
  type SubscriptionState,
  type SubscriptionTier,
} from './access';
import { MvuBridge } from './mvuBridge';
import { createStoreGateway } from './store/storeGateway';

// === 常數模組 ===
import { CUSTOM_HYPNOSIS_TIER_BASE } from './constants/customHypnosis';
import {
  DEFAULT_EDITOR_PROMPT_MODULES,
  DEFAULT_SECTION_CONTENTS_MAP,
  DEFAULT_SECTION_FORMATS_MAP,
  DEFAULT_SECTION_INSTRUCTIONS_MAP,
} from './constants/editorPromptDefaults';
import { FEATURES as FEATURES_BASE, PERSISTENT_FEATURE_IDS } from './constants/features';
import {
  DEFAULT_SETTINGS_PROMPT_CONFIG,
  cloneSettingsPromptConfig,
  type SettingsPromptTuningConfig,
  type SettingsPromptModule,
  type SettingsPromptPlaceholder,
} from './constants/settingsPromptDefaults';
import { DEFAULT_USER_DATA } from './constants/userDefaults';
import {
  PURCHASE_PRICE_BY_TIER,
  SUBSCRIPTION_PRICES,
  SUBSCRIPTION_WEEK_MINUTES,
  SUBSCRIPTION_TIER_TRIAL_LABEL,
  getSubscriptionTierLabel,
} from './constants/subscriptionConstants';

// === Helper 模組 ===
import { calculateCustomHypnosisCostCore } from './helpers/customHypnosisCost';
import { normalizeEditorPromptModules as normalizeEditorPromptModulesHelper } from './helpers/editorPromptModules';
import { toFiniteNumber, normalizeSystemAliases } from './helpers/systemHelpers';
import { idSafe, makeAchievementId } from './helpers/idHelpers';
import { parseVirtualMinutesFrom, getSystemClockFrom } from './helpers/timeHelpers';
import { normalizeSettingsPromptConfig } from './helpers/settingsPromptHelpers';
import { createFirstFeatureIdByTier, isPurchaseRequired, getPurchasePricePoints } from './helpers/featureHelpers';
import { getRolesAndSystemSnapshot } from './helpers/mvuHelpers';
import { systemToUserResources } from './helpers/userResourceHelpers';

// === Managers & Usecases ===
import {
  buildRoleBasedAchievements,
  findQuestDef,
  mergeAchievementsWithClaimed,
  validateQuestDb,
  createAchievementQuestImplFunctions,
} from './managers/achievementQuestManager';
import {
  getCurrentFloorAndSwipe as getCurrentFloorAndSwipeFromStoreHelper,
  resolveCalendarStateAt as resolveCalendarStateAtStore,
  createCalendarEventImplFunctions,
} from './managers/calendarManager';
import { createSettingsManager } from './managers/settingsManager';
import { createResourceManager } from './managers/resourceManager';
import { createFeatureManager } from './managers/featureManager';
import { createCustomHypnosisManager } from './managers/customHypnosisManager';

// === Store 模組 ===
import { STORE_SCHEMA } from './store/storeSchema';
import { createSystemSchema, type SystemWithStore } from './store/systemSchema';
import { migrateStore } from './store/migrateStore';
import {
  type CalendarCrudNode,
  type CalendarCrudOp,
  type CalendarEventPatch,
  type CalendarResolvedState,
  type PersistedStore,
  DEFAULT_CALENDAR_CRUD,
  normalizeCalendarCrudStore,
  type CustomCalendarEvent as PersistedCustomCalendarEvent,
} from './types/persistedStore';

declare function getVariables(option?: any): any;
declare function updateVariablesWith(callback: (vars: any) => void, option?: any): any;
declare function getCurrentMessageId(): number;
declare function getChatMessages(floor?: number, options?: { include_swipes?: boolean }): unknown[] | undefined;

const CHAT_OPTION = { type: 'chat' } as const;

// CalendarCRUD 渲染路徑調適開關（預設關閉；需要時手動改為 true）
const CALENDAR_CRUD_RESOLVE_DEBUG = false;

const FEATURES: HypnosisFeature[] = FEATURES_BASE;
const FIRST_FEATURE_ID_BY_TIER = createFirstFeatureIdByTier(FEATURES);

// 匯出類型供外部使用
export type CustomCalendarEvent = PersistedCustomCalendarEvent;
export type { SettingsPromptTuningConfig } from './constants/settingsPromptDefaults';

// === SYSTEM_SCHEMA 建立 ===
const SYSTEM_SCHEMA = createSystemSchema(DEFAULT_USER_DATA);

// === Store Gateway 建立 ===
const storeGateway = createStoreGateway<SystemWithStore, PersistedStore>({
  chatOption: CHAT_OPTION,
  getVariables,
  updateVariablesWith,
  normalizeSystemAliases,
  systemSchema: SYSTEM_SCHEMA,
  storeSchema: STORE_SCHEMA,
  migrateStore,
  syncPersistedStore: store => MvuBridge.syncPersistedStore(store),
});

const normalizeChatVariables = storeGateway.normalizeChatVariables;
const updateStoreWith = storeGateway.updateStoreWith;
const readStoreSnapshot = storeGateway.readStoreSnapshot;

// === Core 函式 ===
function getCurrentFloorAndSwipe(): { floor: number; swipeId: number } {
  return getCurrentFloorAndSwipeFromStoreHelper({ getCurrentMessageId, getChatMessages });
}

function resolveCalendarStateAt(store: PersistedStore, targetFloor: number): CalendarResolvedState {
  return resolveCalendarStateAtStore(store, targetFloor, {
    debug: CALENDAR_CRUD_RESOLVE_DEBUG,
    logger: payload => {
      console.info('[HypnoOS][CalendarCRUD] resolve path', payload);
    },
  });
}

async function setSubscriptionTierLabel(tierLabel: string): Promise<void> {
  updateVariablesWith(vars => {
    const { system } = normalizeChatVariables(vars);
    if (system._催眠APP订阅等级 === tierLabel) return vars;
    system._催眠APP订阅等级 = tierLabel;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);
  await MvuBridge.syncSubscriptionTier(tierLabel);
}

// === Core 函式（getUserDataCore, updateResourcesCore, getSystemClockCore）===
async function getUserDataCore(): Promise<UserResources> {
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

async function updateResourcesCore(newData: Partial<UserResources>): Promise<UserResources> {
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

async function syncSubscriptionTierLabel(nowVirtualMinutes: number | null): Promise<void> {
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

async function getSystemClockCore(): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> {
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

// === Managers Initialization ===
const settingsManager = createSettingsManager({
  readStoreSnapshot,
  updateStoreWith,
});

const resourceManager = createResourceManager({
  readStoreSnapshot,
  updateStoreWith,
  setSubscriptionTierLabel,
  getSystemClockCore,
  normalizeChatVariables,
  getVariables,
  CHAT_OPTION,
  getUserDataCore,
  updateResourcesCore,
});

const featureManager = createFeatureManager({
  readStoreSnapshot,
  updateStoreWith,
  normalizeChatVariables,
  getVariables,
  CHAT_OPTION,
  FIRST_FEATURE_ID_BY_TIER,
  getUserDataCore,
  updateResourcesCore,
});

const achievementQuestImplFns = createAchievementQuestImplFunctions({
  normalizeChatVariables,
  getVariables,
  CHAT_OPTION,
  getUserDataCore,
  updateResourcesCore,
  updateStoreWith,
  toFiniteNumber,
  makeAchievementId,
  getRolesAndSystemSnapshot: () => getRolesAndSystemSnapshot(normalizeChatVariables, getVariables, CHAT_OPTION),
});

const calendarEventImplFns = createCalendarEventImplFunctions({
  normalizeChatVariables,
  getVariables,
  CHAT_OPTION,
  getCurrentFloorAndSwipe,
  resolveCalendarStateAt,
  updateStoreWith,
  getChatMessages: (floor, options) => getChatMessages(floor, options),
  CALENDAR_CRUD_RESOLVE_DEBUG,
});

const customHypnosisManager = createCustomHypnosisManager({
  readStoreSnapshot,
  updateStoreWith,
  getUserDataCore,
  updateResourcesCore,
});

// === DataService Facade ===
export const DataService = {
  getUnlocks: async (): Promise<{ debugEnabled: boolean; bodyStatsUnlocked: boolean }> => {
    return await resourceManager.getUnlocksImpl();
  },

  getSubscriptionUnlockThreshold: (tier: SubscriptionTier): number => getSubscriptionUnlockThreshold(tier),

  canSubscribeTier: (tier: SubscriptionTier, ctx: { debugEnabled: boolean; totalConsumedMc: number }): boolean =>
    canSubscribeTier({ tier, debugEnabled: ctx.debugEnabled, totalConsumedMc: ctx.totalConsumedMc }),

  isSubscriptionActive: (ctx: AccessContext): boolean => isSubscriptionActive(ctx),

  canUseFeature: (feature: HypnosisFeature, ctx: AccessContext): boolean => featureManager.canUseFeatureImpl(feature, ctx),

  getSubscriptionTiers: (): readonly SubscriptionTier[] => SUBSCRIPTION_TIERS,

  getUserData: async (): Promise<UserResources> => {
    return await getUserDataCore();
  },

  getSystemClock: async (): Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }> => {
    return await getSystemClockCore();
  },

  getSessionEnd: async (): Promise<{ endVirtualMinutes: number | null; endAtMs: number | null }> => {
    return resourceManager.getSessionEndImpl();
  },

  setSessionEnd: async (payload: {
    endVirtualMinutes: number | null;
    endAtMs: number | null;
  }) => {
    await resourceManager.setSessionEndImpl(payload);
  },

  clearSessionEnd: async () => {
    await resourceManager.setSessionEndImpl({ endVirtualMinutes: null, endAtMs: null });
  },

  getSubscription: async (): Promise<SubscriptionState | null> => {
    return await resourceManager.getSubscriptionImpl();
  },

  setSubscriptionAutoRenew: async (autoRenew: boolean) => {
    await resourceManager.setSubscriptionAutoRenewImpl(autoRenew);
  },

  clearSubscription: async () => {
    await resourceManager.clearSubscriptionImpl();
  },

  subscribeOrRenew: async ({
    tier,
    nowVirtualMinutes,
    extendFromExistingIfActive = true,
  }: {
    tier: SubscriptionTier;
    nowVirtualMinutes: number | null;
    extendFromExistingIfActive?: boolean;
  }): Promise<{ ok: boolean; message?: string; subscription?: SubscriptionState | null }> => {
    return await resourceManager.subscribeOrRenewImpl({ tier, nowVirtualMinutes, extendFromExistingIfActive });
  },

  maybeAutoRenewSubscription: async (
    nowVirtualMinutes: number | null,
  ): Promise<{ renewed: boolean; message?: string }> => {
    return await resourceManager.maybeAutoRenewSubscriptionImpl(nowVirtualMinutes);
  },

  getFeatures: async (): Promise<HypnosisFeature[]> => {
    return await featureManager.getFeaturesImpl();
  },

  purchaseFeature: async (id: string): Promise<{ ok: boolean; message?: string; user?: UserResources }> => {
    return await featureManager.purchaseFeatureImpl(id);
  },

  getDebugEnabled: async (): Promise<boolean> => {
    return resourceManager.getDebugEnabledImpl();
  },

  setDebugEnabled: async (enabled: boolean) => {
    await resourceManager.setDebugEnabledImpl(enabled);
  },

  updateResources: async (newData: Partial<UserResources>): Promise<UserResources> => {
    return await updateResourcesCore(newData);
  },

  startSession: async (payload: SessionStartPayload): Promise<boolean> => {
    return await resourceManager.startSessionImpl(payload);
  },

  updateFeature: async (id: string, patch: { isEnabled?: boolean; userNote?: string; userNumber?: number }) => {
    await featureManager.updateFeatureImpl(id, patch);
  },

  resetFeatures: async () => {
    await featureManager.resetFeaturesImpl();
  },

  getAchievements: async (): Promise<Achievement[]> => {
    return await achievementQuestImplFns.getAchievementsImpl();
  },

  getQuests: async (): Promise<Quest[]> => {
    return await achievementQuestImplFns.getQuestsImpl();
  },

  claimAchievement: async (id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> => {
    return await achievementQuestImplFns.claimAchievementImpl(id, currentPoints);
  },

  acceptQuest: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return await achievementQuestImplFns.acceptQuestImpl(id);
  },

  cancelQuest: async (id: string): Promise<{ success: boolean; message?: string }> => {
    return await achievementQuestImplFns.cancelQuestImpl(id);
  },

  claimQuest: async (id: string, currentPoints: number): Promise<{ success: boolean; newPoints: number }> => {
    return await achievementQuestImplFns.claimQuestImpl(id, currentPoints);
  },

  publishCustomQuest: async (params: {
    name: string;
    condition: string;
    rewardMcPoints: number;
  }): Promise<{ ok: boolean; message?: string }> => {
    return await achievementQuestImplFns.publishCustomQuestImpl(params);
  },

  deleteCustomQuest: async (id: string): Promise<{ ok: boolean; message?: string }> => {
    return await achievementQuestImplFns.deleteCustomQuestImpl(id);
  },

  // ─── Calendar Events ────────────────────────────────────────

  getCalendarEvents: (): CustomCalendarEvent[] => {
    return calendarEventImplFns.getCalendarEventsImpl();
  },

  processCalendarBridgeEventsOnLoad: async (): Promise<void> => {
    await calendarEventImplFns.processCalendarBridgeEventsOnLoadImpl();
  },

  addCalendarEvent: async (params: {
    month: number;
    day: number;
    title: string;
    description?: string;
  }): Promise<{ ok: boolean; id?: string; message?: string }> => {
    return await calendarEventImplFns.addCalendarEventImpl(params);
  },

  updateCalendarEvent: async (
    id: string,
    patch: { title?: string; description?: string; month?: number; day?: number },
  ): Promise<{ ok: boolean; message?: string }> => {
    return await calendarEventImplFns.updateCalendarEventImpl(id, patch);
  },

  deleteCalendarEvent: async (id: string): Promise<{ ok: boolean; message?: string }> => {
    return await calendarEventImplFns.deleteCalendarEventImpl(id);
  },

  findCalendarEventByTitleAndDate: (title: string, month: number, day: number): CustomCalendarEvent | undefined => {
    return calendarEventImplFns.findCalendarEventByTitleAndDateImpl(title, month, day);
  },

  // --- Custom Hypnosis ---

  CUSTOM_HYPNOSIS_TIER_BASE: {
    ...CUSTOM_HYPNOSIS_TIER_BASE,
  } as Record<string, number>,

  calculateCustomHypnosisCost: (
    tier: HypnosisFeature['tier'],
    costType: 'ONE_TIME' | 'PER_MINUTE',
    costValue: number,
  ): number => {
    return customHypnosisManager.calculateCustomHypnosisCostImpl(tier, costType, costValue);
  },

  getCustomHypnosis: (): CustomHypnosisDef[] => {
    return customHypnosisManager.getCustomHypnosisImpl();
  },

  addCustomHypnosis: async (
    def: Omit<CustomHypnosisDef, 'id' | 'createdAt' | 'researchCost'>,
  ): Promise<{ ok: boolean; message?: string; id?: string }> => {
    return await customHypnosisManager.addCustomHypnosisImpl(def);
  },

  deleteCustomHypnosis: async (id: string): Promise<{ ok: boolean; message?: string; refund?: number }> => {
    return await customHypnosisManager.deleteCustomHypnosisImpl(id);
  },

  // --- API Settings (shared across all apps) ---

  getApiSettings: (): PersistedStore['apiSettings'] => {
    return settingsManager.getApiSettingsImpl();
  },

  getSettingsPromptConfig: (): SettingsPromptTuningConfig => {
    return settingsManager.getSettingsPromptConfigImpl();
  },

  getDefaultSettingsPromptConfig: (): SettingsPromptTuningConfig => {
    return settingsManager.getDefaultSettingsPromptConfigImpl();
  },

  updateSettingsPromptConfig: async (next: SettingsPromptTuningConfig): Promise<void> => {
    await settingsManager.updateSettingsPromptConfigImpl(next);
  },

  updateApiSettings: async (patch: Partial<NonNullable<PersistedStore['apiSettings']>>): Promise<void> => {
    await settingsManager.updateApiSettingsImpl(patch);
  },

  fetchAvailableModels: async (endpoint: string, apiKey: string): Promise<string[]> => {
    return await settingsManager.fetchAvailableModelsImpl(endpoint, apiKey);
  },

  // --- Editor Prompt Modules (Character Editor) ---

  getEditorPromptModules: (): EditorPromptModule[] => {
    return settingsManager.getEditorPromptModulesImpl();
  },

  getDefaultEditorPromptModules: (): EditorPromptModule[] => {
    return settingsManager.getDefaultEditorPromptModulesImpl();
  },

  saveEditorPromptModules: async (modules: EditorPromptModule[]): Promise<void> => {
    await settingsManager.saveEditorPromptModulesImpl(modules);
  },
};
