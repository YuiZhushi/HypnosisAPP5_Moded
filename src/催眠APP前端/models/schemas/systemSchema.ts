/**
 * SystemWithStore 的 Zod Schema
 *
 * 定義酒館聊天變量 `系統` 的結構，包含用戶資源欄位和 _hypnoos 子結構。
 */

import { z } from 'zod';
import type { PersistedStore } from './storeSchema';
import { STORE_SCHEMA } from './storeSchema';
import type { UserResources } from '..';

/** 系統變數結構（含 _hypnoos） */
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
 * 建立 SYSTEM_SCHEMA 的工廠函式
 * @param defaultUserData - 用戶資源預設值
 */
export function createSystemSchema(defaultUserData: UserResources): z.ZodType<SystemWithStore> {
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

export type SystemSchemaType = z.ZodType<SystemWithStore>;
