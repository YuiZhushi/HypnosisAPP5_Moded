/**
 * StoreGateway — 聊天變量持久化的底層閘道
 *
 * 職責：
 * - 讀取/寫入酒館聊天變量中的 `系統._hypnoos`
 * - 透過 Zod Schema 進行校驗與歸一化
 * - 寫入後觸發 MVU 同步
 *
 * 依賴鏈：storeGateway → migrateStore（初始化時）
 *          storeGateway → mvuBridge（寫入後同步）
 */

import type { PersistedStore } from '../../constants/schemas/storeSchema';
import type { SystemWithStore } from '../../constants/schemas/systemSchema';
import { STORE_SCHEMA } from '../../constants/schemas/storeSchema';
import { createSystemSchema } from '../../constants/schemas/systemSchema';
import { DEFAULT_USER_DATA } from '../../constants/common/userDefaults';
import { migrateStore } from './migrateStore';

// ====== 全域函數（iframe 環境直接可用） ======

const CHAT_OPTION = { type: 'chat' } as const;
const SYSTEM_SCHEMA = createSystemSchema(DEFAULT_USER_DATA);

// ====== 輔助函數 ======

/** 正規化系統變數別名（處理舊版欄位名稱） */
function normalizeSystemAliases(systemRaw: Record<string, any>): Record<string, any> {
  const toFinite = (v: unknown) => { const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : null; };

  if (toFinite(systemRaw._MC能量) === null) {
    const v = toFinite(systemRaw.MC能量);
    if (v !== null) systemRaw._MC能量 = v;
  }
  if (toFinite(systemRaw._MC能量上限) === null) {
    const v = toFinite(systemRaw.MC能量上限);
    if (v !== null) systemRaw._MC能量上限 = v;
  }
  return systemRaw;
}

// ====== 核心閘道函式 ======

/**
 * 正規化聊天變量：讀取 → alias 校正 → Zod 解析 → 遷移
 */
export function normalizeChatVariables(variables: Record<string, unknown>) {
  const systemRaw = normalizeSystemAliases((variables?.系统 ?? {}) as Record<string, any>);
  const system = SYSTEM_SCHEMA.parse(systemRaw) as SystemWithStore & { _hypnoos?: PersistedStore };
  system._hypnoos = migrateStore(STORE_SCHEMA.parse(system._hypnoos ?? {}));
  variables.系统 = system;
  return { variables, system, store: system._hypnoos as PersistedStore };
}

/**
 * 更新 PersistedStore 並同步到 MVU
 */
export async function updateStoreWith(
  updater: (store: PersistedStore) => PersistedStore,
  syncFn?: (store: PersistedStore) => Promise<void>,
): Promise<PersistedStore> {
  let nextStore: PersistedStore | undefined;
  updateVariablesWith((vars: Record<string, unknown>) => {
    const { system, store } = normalizeChatVariables(vars);
    nextStore = STORE_SCHEMA.parse(updater(store));
    (system as SystemWithStore & { _hypnoos?: PersistedStore })._hypnoos = nextStore;
    vars.系统 = system;
    return vars;
  }, CHAT_OPTION);

  const result = nextStore ?? STORE_SCHEMA.parse({});
  if (syncFn) await syncFn(result);
  return result;
}

/**
 * 只讀快照：讀取當前 PersistedStore（不觸發寫入）
 */
export function readStoreSnapshot(): PersistedStore {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  return STORE_SCHEMA.parse(store);
}

// ====== 匯出常數 ======

export { CHAT_OPTION, SYSTEM_SCHEMA };
