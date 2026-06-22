/**
 * 設定提示詞預設配置
 *
 * 包含測試模塊與預設佔位符，用於設定頁面的提示詞調適功能（測試通用 LLM 服務正常性）。
 */

export type SettingsPromptModule = {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
};

export type SettingsPromptPlaceholder = {
  key: string;
  value: string;
  enabled: boolean;
  source: 'built_in' | 'user' | 'worldbook' | 'runtime';
  resolverType: 'static' | 'function';
  scope: 'app';
};

export type SettingsPromptTuningConfig = {
  modules: SettingsPromptModule[];
  moduleOrder: string[];
  placeholders: SettingsPromptPlaceholder[];
};

/** 預設設定提示詞配置 */
export const DEFAULT_SETTINGS_PROMPT_CONFIG: SettingsPromptTuningConfig = {
  modules: [
    {
      id: 'mod_test_system',
      title: '測試模塊A：系統規則',
      enabled: true,
      content: [
        '你是催眠APP的測試助手。',
        '請依照以下佔位符資訊輸出：',
        '- 目標：{{target_name}}',
        '- 場景：{{scene}}',
        '- 回應語氣：{{tone}}',
        '',
      ].join('\n'),
    },
    {
      id: 'mod_test_user',
      title: '測試模塊B：任務請求',
      enabled: true,
      content: ['請根據上方規則，生成一段簡短回應：', '{{user_goal}}', ''].join('\n'),
    },
  ],
  moduleOrder: ['mod_test_system', 'mod_test_user'],
  placeholders: [
    { key: 'target_name', value: '白鳥百合子', enabled: true, source: 'user', resolverType: 'static', scope: 'app' },
    { key: 'scene', value: '放學後教室', enabled: true, source: 'user', resolverType: 'static', scope: 'app' },
    { key: 'tone', value: '冷靜、簡潔', enabled: true, source: 'user', resolverType: 'static', scope: 'app' },
    {
      key: 'user_goal',
      value: '描述目標目前的心理變化。',
      enabled: true,
      source: 'user',
      resolverType: 'static',
      scope: 'app',
    },
  ],
};

/** 複製設定提示詞配置（深拷貝） */
export function cloneSettingsPromptConfig(input: SettingsPromptTuningConfig): SettingsPromptTuningConfig {
  return {
    modules: input.modules.map(m => ({ ...m })),
    moduleOrder: [...input.moduleOrder],
    placeholders: input.placeholders.map(p => ({ ...p })),
  };
}
