/**
 * SystemWithStore 的 Zod Schema（Phase D-2）
 * 
 * 這個 schema 原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import { z } from 'zod';
import type { PersistedStore } from '../types/persistedStore';
import { STORE_SCHEMA } from './storeSchema';

/**
 * 系統變數中的用戶資源類型喵~
 * 包含 MC 能量、MC 點數、零花錢等欄位
 */
export type SystemWithStore = {
  _MC能量: number;
  _MC能量上限: number;
  当前MC点: number;
  _累计消耗MC点: number;
  持有零花钱: number;
  主角可疑度: number;
  _hypnoos?: PersistedStore;
} & Record<string, unknown>;

/**
 * 用戶資源預設值喵~
 * 這個需要從外部傳入，因為 userDefaults.ts 尚未建立
 */
export type UserResourcesDefaults = {
  mcEnergy: number;
  mcEnergyMax: number;
  mcPoints: number;
  totalConsumedMc: number;
  money: number;
  suspicion: number;
};

/**
 * 建立 SYSTEM_SCHEMA 的工廠函式喵~
 * @param defaultUserData - 用戶資源預設值
 */
export function createSystemSchema(defaultUserData: UserResourcesDefaults): z.ZodType<SystemWithStore> {
  return z
    .object({
      _MC能量: z.coerce.number().default(defaultUserData.mcEnergy),
      _MC能量上限: z.coerce.number().default(defaultUserData.mcEnergyMax),
      当前MC点: z.coerce.number().default(defaultUserData.mcPoints),
      _累计消耗MC点: z.coerce.number().default(defaultUserData.totalConsumedMc),
      持有零花钱: z.coerce.number().default(defaultUserData.money),
      主角可疑度: z.coerce.number().default(defaultUserData.suspicion),
      _hypnoos: STORE_SCHEMA.optional(),
    })
    .passthrough()
    .default({} as SystemWithStore);
}

// 匯出類型供外部使用喵~
export type SystemSchemaType = z.ZodType<SystemWithStore>;
