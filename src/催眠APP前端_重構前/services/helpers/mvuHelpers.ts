/**
 * MVU 相關輔助函式（Phase D-2）
 * 
 * 這個函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import { MvuBridge } from '../mvuBridge';
import { normalizeSystemAliases } from './systemHelpers';

/**
 * 取得角色和系統快照喵~
 * 優先從 MVU 取得，失敗時回退到聊天變數
 */
export async function getRolesAndSystemSnapshot(
  normalizeChatVariables: (vars: any) => { system: any; store: any },
  getVariables: (option?: any) => any,
  CHAT_OPTION: { type: 'chat' },
): Promise<{ system: Record<string, any>; roles: Record<string, any> }> {
  let system: Record<string, any> | null = null;
  let roles: Record<string, any> | null = null;
  try {
    system = await MvuBridge.getSystem();
    if (system) normalizeSystemAliases(system);
    roles = await MvuBridge.getRoles();
  } catch {
    // ignore
  }

  if (system && roles) return { system, roles };

  const vars = getVariables(CHAT_OPTION);
  const normalized = normalizeChatVariables(vars);
  return {
    system: system ?? (normalized.system as any),
    roles: roles ?? (vars as any)?.角色 ?? {},
  };
}
