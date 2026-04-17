/**
 * 設定提示詞相關輔助函式（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { PersistedStore } from '../types/persistedStore';
import type { SettingsPromptTuningConfig, SettingsPromptModule, SettingsPromptPlaceholder } from '../constants/settingsPromptDefaults';
import { cloneSettingsPromptConfig, DEFAULT_SETTINGS_PROMPT_CONFIG } from '../constants/settingsPromptDefaults';

/**
 * 正規化設定提示詞配置喵~
 * 將存儲的配置與預設配置合併，確保所有欄位都有值
 */
export function normalizeSettingsPromptConfig(
  raw: PersistedStore['settingsPromptTuning'] | undefined,
): SettingsPromptTuningConfig {
  const defaults = cloneSettingsPromptConfig(DEFAULT_SETTINGS_PROMPT_CONFIG);

  const moduleMap = new Map<string, SettingsPromptModule>(defaults.modules.map(m => [m.id, m]));
  for (const persisted of Object.values(raw?.modules ?? {})) {
    if (!persisted?.id) continue;
    moduleMap.set(persisted.id, {
      id: persisted.id,
      title: persisted.title ?? persisted.id,
      content: persisted.content ?? '',
      enabled: persisted.enabled !== false,
    });
  }

  const allModuleIds = new Set(moduleMap.keys());
  const orderFromStore = (raw?.moduleOrder ?? []).filter(id => allModuleIds.has(id));
  const fallbackOrder = defaults.moduleOrder.filter(id => allModuleIds.has(id));
  const moduleOrder = Array.from(new Set([...orderFromStore, ...fallbackOrder, ...Array.from(allModuleIds)]));
  const orderedModules = moduleOrder.map(id => moduleMap.get(id)).filter(Boolean) as SettingsPromptModule[];

  const placeholderMap = new Map<string, SettingsPromptPlaceholder>(defaults.placeholders.map(p => [p.key, p]));
  for (const persisted of Object.values(raw?.placeholders ?? {})) {
    if (!persisted?.key) continue;
    placeholderMap.set(persisted.key, {
      key: persisted.key,
      value: persisted.value ?? '',
      enabled: persisted.enabled !== false,
      source: persisted.source ?? 'user',
      resolverType: persisted.resolverType ?? 'static',
      scope: 'app',
    });
  }

  const placeholders = Array.from(placeholderMap.values());

  return {
    modules: orderedModules,
    moduleOrder,
    placeholders,
  };
}
