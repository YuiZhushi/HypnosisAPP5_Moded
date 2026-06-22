/**
 * Body Stats APP 後端 — 統一入口
 *
 * 職責：
 * - 讀取 MVU 角色變量數據並格式化供 UI 顯示
 * - 權限判斷（bodyStatsUnlocked）代理自 backend/hypnosis
 *
 * 不包含：
 * - 世界書條目檢查/補入（歸入 backend/character-editor）
 */

import * as MvuBridge from '../../shared/mvu/mvuBridge';
import { logger } from '../../../催眠APP共用/debug/loggerService';

// ====== 類型 ======

export type RoleMap = Record<string, Record<string, unknown>>;

export interface RoleStatSnapshot {
  /** 所有角色名稱（已排序） */
  roleNames: string[];
  /** 角色名 → 角色屬性 */
  roles: RoleMap;
}

// ====== 常數 ======

/** 屬性排列順序（優先顯示） */
export const STAT_ORDER: string[] = [
  '警戒度',
  '服从度',
  '好感度',
  '性欲',
  '快感值',
  '阴蒂敏感度',
  '小穴敏感度',
  '菊穴敏感度',
  '尿道敏感度',
  '乳头敏感度',
  '阴蒂高潮次数',
  '小穴高潮次数',
  '菊穴高潮次数',
  '尿道高潮次数',
  '乳头高潮次数',
];

/** 以進度條方式顯示的屬性 */
export const BAR_STATS = new Set(['警戒度', '服从度', '好感度', '性欲', '快感值']);

// ====== 公開 API ======

/**
 * 讀取所有 MVU 角色的變量快照
 *
 * @returns 角色列表與數據，或 null 表示 MVU 未就緒
 */
export async function getRoleSnapshot(): Promise<RoleStatSnapshot | null> {
  const rolesRaw = await MvuBridge.getRoles();
  if (!rolesRaw) {
    logger.warn('MVU 未就緒或無角色數據');
    return null;
  }

  const roles: RoleMap = {};
  for (const [name, value] of Object.entries(rolesRaw)) {
    if (!name || typeof value !== 'object' || value === null) continue;
    roles[name] = value as Record<string, unknown>;
  }

  const roleNames = Object.keys(roles)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));

  return { roleNames, roles };
}

/**
 * 取得指定角色的屬性列表（已按 STAT_ORDER 排序，跳過 _ 開頭的內部欄位）
 */
export function getOrderedStatEntries(roleData: Record<string, unknown>): Array<[string, unknown]> {
  const seen = new Set<string>();
  const entries: Array<[string, unknown]> = [];

  // 按預定順序排列
  for (const k of STAT_ORDER) {
    if (Object.prototype.hasOwnProperty.call(roleData, k)) {
      entries.push([k, roleData[k]]);
      seen.add(k);
    }
  }

  // 剩餘欄位（跳過 _ 開頭的內部欄位）
  for (const [k, v] of Object.entries(roleData)) {
    if (seen.has(k)) continue;
    if (k.startsWith('_')) continue;
    entries.push([k, v]);
  }

  return entries;
}
