import type { PersistedStore } from '../types/persistedStore';
import type { EditorPromptModule } from '../../types';
import { DEFAULT_EDITOR_PROMPT_MODULES } from '../constants/editorPromptDefaults';
import { DEFAULT_SETTINGS_PROMPT_CONFIG, cloneSettingsPromptConfig, type SettingsPromptTuningConfig } from '../constants/settingsPromptDefaults';
import { normalizeSettingsPromptConfig } from '../helpers/settingsPromptHelpers';
import { normalizeEditorPromptModules as normalizeEditorPromptModulesHelper } from '../helpers/editorPromptModules';

import { readStoreSnapshot, updateStoreWith } from './systemCoreManager';

export function createSettingsManager() {

  function getApiSettingsImpl(): PersistedStore['apiSettings'] {
    return readStoreSnapshot().apiSettings;
  }

  async function updateApiSettingsImpl(patch: Partial<NonNullable<PersistedStore['apiSettings']>>): Promise<void> {
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

  async function fetchAvailableModelsImpl(endpoint: string, apiKey: string): Promise<string[]> {
    const url = endpoint.replace(/\/$/, '') + '/v1/models';
    try {
      const resp = await fetch(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = (await resp.json()) as { data?: Array<{ id: string }> };
      return (json.data ?? []).map(m => m.id).filter(Boolean);
    } catch {
      return [];
    }
  }

  function getSettingsPromptConfigImpl(): SettingsPromptTuningConfig {
    return normalizeSettingsPromptConfig(readStoreSnapshot().settingsPromptTuning);
  }

  function getDefaultSettingsPromptConfigImpl(): SettingsPromptTuningConfig {
    return cloneSettingsPromptConfig(DEFAULT_SETTINGS_PROMPT_CONFIG);
  }

  async function updateSettingsPromptConfigImpl(next: SettingsPromptTuningConfig): Promise<void> {
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
          scope: 'app',
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

  function getEditorPromptModulesImpl(): EditorPromptModule[] {
    return normalizeEditorPromptModulesHelper(readStoreSnapshot().editorPromptModules, DEFAULT_EDITOR_PROMPT_MODULES);
  }

  function getDefaultEditorPromptModulesImpl(): EditorPromptModule[] {
    return DEFAULT_EDITOR_PROMPT_MODULES.map(m => ({ ...m }));
  }

  async function saveEditorPromptModulesImpl(modules: EditorPromptModule[]): Promise<void> {
    await updateStoreWith(store => {
      const record: NonNullable<PersistedStore['editorPromptModules']> = {};
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

  return {
    getApiSettingsImpl,
    updateApiSettingsImpl,
    fetchAvailableModelsImpl,
    getSettingsPromptConfigImpl,
    getDefaultSettingsPromptConfigImpl,
    updateSettingsPromptConfigImpl,
    getEditorPromptModulesImpl,
    getDefaultEditorPromptModulesImpl,
    saveEditorPromptModulesImpl,
  };
}