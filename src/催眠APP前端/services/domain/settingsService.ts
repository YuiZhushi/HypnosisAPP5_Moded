/**
 * 設定領域服務（Phase B-3）
 *
 * 含 API 設定、模型發現、Settings Prompt 調適、角色編輯器模塊設定。
 */
export type SettingsServiceDeps<
  TStore,
  TPromptConfig,
  TEditorModule,
  TApiSettings extends Record<string, unknown>,
> = {
  readStoreSnapshot: () => TStore;
  updateStoreWith: (updater: (store: TStore) => TStore) => Promise<TStore>;
  getApiSettingsFromStore: (store: TStore) => TApiSettings | undefined;
  mergeApiSettings: (store: TStore, patch: Partial<TApiSettings>) => TStore;
  normalizePromptConfigFromStore: (store: TStore) => TPromptConfig;
  getDefaultPromptConfig: () => TPromptConfig;
  toPromptStorePatch: (config: TPromptConfig, store: TStore) => TStore;
  normalizeEditorModulesFromStore: (store: TStore) => TEditorModule[];
  getDefaultEditorModules: () => TEditorModule[];
  toEditorModulesStorePatch: (modules: TEditorModule[], store: TStore) => TStore;
};

export function createSettingsService<
  TStore,
  TPromptConfig,
  TEditorModule,
  TApiSettings extends Record<string, unknown>,
>(
  deps: SettingsServiceDeps<TStore, TPromptConfig, TEditorModule, TApiSettings>,
) {
  return {
    getApiSettings() {
      const store = deps.readStoreSnapshot();
      return deps.getApiSettingsFromStore(store);
    },

    async updateApiSettings(patch: Partial<TApiSettings>): Promise<void> {
      await deps.updateStoreWith(store => deps.mergeApiSettings(store, patch));
    },

    async fetchAvailableModels(endpoint: string, apiKey: string): Promise<string[]> {
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
    },

    getSettingsPromptConfig(): TPromptConfig {
      return deps.normalizePromptConfigFromStore(deps.readStoreSnapshot());
    },

    getDefaultSettingsPromptConfig(): TPromptConfig {
      return deps.getDefaultPromptConfig();
    },

    async updateSettingsPromptConfig(next: TPromptConfig): Promise<void> {
      await deps.updateStoreWith(store => deps.toPromptStorePatch(next, store));
    },

    getEditorPromptModules(): TEditorModule[] {
      return deps.normalizeEditorModulesFromStore(deps.readStoreSnapshot());
    },

    getDefaultEditorPromptModules(): TEditorModule[] {
      return deps.getDefaultEditorModules();
    },

    async saveEditorPromptModules(modules: TEditorModule[]): Promise<void> {
      await deps.updateStoreWith(store => deps.toEditorModulesStorePatch(modules, store));
    },
  };
}
