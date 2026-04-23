/**
 * Settings APP 後端 — 統一入口
 *
 * 職責：
 * - API 設定讀寫（apiKey / endpoint / model / temperature 等）
 * - 可用模型列表查詢
 * - 設定提示詞配置讀寫（modules / placeholders）
 * - 角色編輯器提示詞模塊讀寫
 *
 * 所有 Store 操作透過 shared/store/storeGateway。
 */

import type { EditorPromptModule } from '../../constants/interfaces';
import type { PersistedStore, PersistedEditorPromptRecord } from '../../constants/schemas/storeSchema';
import {
  DEFAULT_SETTINGS_PROMPT_CONFIG,
  cloneSettingsPromptConfig,
  type SettingsPromptTuningConfig,
  type SettingsPromptModule,
  type SettingsPromptPlaceholder,
} from '../../constants/settings/settingsPromptDefaults';
import { DEFAULT_EDITOR_PROMPT_MODULES } from '../../constants/character-editor/editorPromptDefaults';
import { readStoreSnapshot, updateStoreWith } from '../../shared/store/storeGateway';
import { logger } from '../../shared/debug/loggerService';

// ====== 內部工具 ======

/** 正規化設定提示詞配置 */
function normalizeSettingsPromptConfig(
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

  return {
    modules: orderedModules,
    moduleOrder,
    placeholders: Array.from(placeholderMap.values()),
  };
}

/** 正規化角色編輯器提示詞模塊 */
function normalizeEditorPromptModules(
  raw: PersistedStore['editorPromptModules'] | undefined,
  defaults: EditorPromptModule[],
): EditorPromptModule[] {
  const defaultMap = new Map(defaults.map(m => [m.id, m]));
  if (raw) {
    for (const [id, persisted] of Object.entries(raw)) {
      if (!persisted?.id) continue;
      const base = defaultMap.get(id);
      defaultMap.set(id, {
        id: persisted.id,
        title: persisted.title ?? base?.title ?? id,
        content: persisted.content ?? base?.content ?? '',
        type: (['fixed', 'section_content', 'section_format', 'section_instruction'].includes(persisted.type as string)
          ? persisted.type
          : (base?.type ?? 'fixed')) as EditorPromptModule['type'],
        sectionId: persisted.sectionId ?? base?.sectionId,
        order: persisted.order ?? base?.order ?? 99,
      });
    }
  }
  return Array.from(defaultMap.values()).sort((a, b) => a.order - b.order);
}

// ====== 公開 API：API 設定 ======

/** 讀取 API 設定 */
export function getApiSettings(): PersistedStore['apiSettings'] {
  return readStoreSnapshot().apiSettings;
}

/** 更新 API 設定（部分更新） */
export async function updateApiSettings(patch: Partial<NonNullable<PersistedStore['apiSettings']>>): Promise<void> {
  await updateStoreWith(store => {
    const current = store.apiSettings ?? {
      apiKey: '',
      apiEndpoint: '',
      modelName: '',
      temperature: 0.7,
      maxTokens: 8192,
      topP: 1,
      presencePenalty: 0,
      frequencyPenalty: 0,
      streamMode: 'non_streaming' as const,
    };
    return { ...store, apiSettings: { ...current, ...patch } };
  });
}

/** 查詢可用模型列表 */
export async function fetchAvailableModels(endpoint: string, apiKey: string): Promise<string[]> {
  const url = endpoint.replace(/\/$/, '') + '/v1/models';
  try {
    const resp = await fetch(url, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = (await resp.json()) as { data?: Array<{ id: string }> };
    return (json.data ?? []).map(m => m.id).filter(Boolean);
  } catch (err) {
    logger.warn('获取模型列表失败', err);
    return [];
  }
}

// ====== 公開 API：設定提示詞 ======

/** 讀取設定提示詞配置 */
export function getSettingsPromptConfig(): SettingsPromptTuningConfig {
  return normalizeSettingsPromptConfig(readStoreSnapshot().settingsPromptTuning);
}

/** 取得預設設定提示詞配置 */
export function getDefaultSettingsPromptConfig(): SettingsPromptTuningConfig {
  return cloneSettingsPromptConfig(DEFAULT_SETTINGS_PROMPT_CONFIG);
}

/** 儲存設定提示詞配置 */
export async function updateSettingsPromptConfig(next: SettingsPromptTuningConfig): Promise<void> {
  await updateStoreWith(store => {
    const normalized: SettingsPromptTuningConfig = {
      modules: next.modules.map(m => ({
        id: String(m.id),
        title: String(m.title || m.id),
        content: String(m.content ?? ''),
        enabled: m.enabled !== false,
      })),
      moduleOrder: next.moduleOrder.map(String),
      placeholders: next.placeholders.map(p => ({
        key: String(p.key),
        value: String(p.value ?? ''),
        enabled: p.enabled !== false,
        source: p.source ?? 'user',
        resolverType: p.resolverType ?? 'static',
        scope: 'app' as const,
      })),
    };

    const modulesRecord: NonNullable<PersistedStore['settingsPromptTuning']>['modules'] = {};
    for (const module of normalized.modules) {
      modulesRecord[module.id] = { ...module };
    }

    const placeholdersRecord: NonNullable<PersistedStore['settingsPromptTuning']>['placeholders'] = {};
    for (const placeholder of normalized.placeholders) {
      placeholdersRecord[placeholder.key] = { ...placeholder };
    }

    return {
      ...store,
      settingsPromptTuning: {
        modules: modulesRecord,
        moduleOrder: normalized.moduleOrder,
        placeholders: placeholdersRecord,
      },
    };
  });
}

// ====== 公開 API：角色編輯器提示詞模塊 ======

/** 讀取角色編輯器提示詞模塊列表 */
export function getEditorPromptModules(): EditorPromptModule[] {
  return normalizeEditorPromptModules(readStoreSnapshot().editorPromptModules, DEFAULT_EDITOR_PROMPT_MODULES);
}

/** 取得預設角色編輯器提示詞模塊 */
export function getDefaultEditorPromptModules(): EditorPromptModule[] {
  return DEFAULT_EDITOR_PROMPT_MODULES.map(m => ({ ...m }));
}

/** 儲存角色編輯器提示詞模塊 */
export async function saveEditorPromptModules(modules: EditorPromptModule[]): Promise<void> {
  await updateStoreWith(store => {
    const record: PersistedEditorPromptRecord = {};
    for (const m of modules) {
      record[m.id] = {
        id: m.id,
        title: m.title,
        content: m.content,
        type: m.type,
        sectionId: m.sectionId,
        order: m.order,
      };
    }
    return { ...store, editorPromptModules: record };
  });
}
