/**
 * AiRequestPipeline — 通用 LLM 請求管道
 *
 * 職責：
 * - 步驟 1+2：拼接提示詞模塊 + 替換佔位符
 * - 步驟 3：發送 API 請求（via generateRaw）
 * - 步驟 4：接收/後處理回應
 *
 * 純通用服務，不含任何業務語義。
 * 各 APP 的業務提示詞構造由各自 APP 自身的 backend/${APP_NAME}/promptBuilder.ts 負責。
 **/

import { logger } from '../debug/loggerService';

// ====== 類型 ======

export type PromptModule = { id: string; content: string };
export type PlaceholderValue = string | number | boolean | null | undefined;

export type ComposePromptParams = {
  modules: PromptModule[];
  moduleOrder?: string[];
  placeholders?: Record<string, PlaceholderValue>;
  escapeEjs?: boolean;
};

export type SendResult = {
  ok: boolean;
  responseText?: string;
  error?: string;
};

export type RequestResult = {
  ok: boolean;
  prompt: string;
  responseText?: string;
  error?: string;
};

// ====== API Settings 讀取（透過回調注入，避免直接依賴 DataService） ======

export type ApiSettingsProvider = () => {
  apiKey?: string;
  apiEndpoint?: string;
  modelName?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  streamMode?: string;
} | undefined;

let _apiSettingsProvider: ApiSettingsProvider | null = null;

/**
 * 在初始化時注入 API 設定提供者（由 App 入口呼叫一次）
 */
export function setApiSettingsProvider(provider: ApiSettingsProvider): void {
  _apiSettingsProvider = provider;
}

// ====== 內部工具 ======

const PLACEHOLDER_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

function normalizeText(text: string | undefined): string {
  return (text ?? '').replaceAll('\r\n', '\n');
}

function stringifyPlaceholderValue(value: PlaceholderValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function maskApiKey(value: string | undefined): string {
  if (!value) return '(empty)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function getRequiredApiSettings() {
  const api = _apiSettingsProvider?.();
  const endpoint = (api?.apiEndpoint ?? '').trim();
  const model = (api?.modelName ?? '').trim();
  if (!endpoint) throw new Error('AI API 設定缺少端點（apiEndpoint）');
  if (!model) throw new Error('AI API 設定缺少模型名稱（modelName）');
  return {
    endpoint, model,
    apiKey: api?.apiKey ?? '',
    streamMode: api?.streamMode ?? 'non_streaming',
    temperature: api?.temperature,
    maxTokens: api?.maxTokens,
    topP: api?.topP,
    topK: api?.topK,
    presencePenalty: api?.presencePenalty,
    frequencyPenalty: api?.frequencyPenalty,
  };
}

// ====== 公開 API ======

/**
 * 步驟 1+2：按模塊順序拼接提示詞，並替換佔位符
 */
export function composePrompt(params: ComposePromptParams): string {
  const { modules, moduleOrder = [], placeholders = {}, escapeEjs = false } = params;

  logger.debug('composePrompt start', { moduleCount: modules.length, placeholderCount: Object.keys(placeholders).length });

  const moduleMap = new Map(modules.map(m => [m.id, m]));
  const orderedModules = moduleOrder.length > 0
    ? moduleOrder.map(id => {
        const found = moduleMap.get(id);
        if (!found) throw new Error(`提示詞模組缺失：moduleOrder 指定了不存在的 id「${id}」`);
        return found;
      })
    : modules;

  let merged = orderedModules.map(m => normalizeText(m.content)).join('');

  if (escapeEjs) {
    merged = merged.replace(/<%/g, '⟪%').replace(/%>/g, '%⟫');
  }

  const customReplaced = merged.replace(PLACEHOLDER_REGEX, (raw, keyRaw: string) => {
    const key = keyRaw.trim();
    if (!Object.prototype.hasOwnProperty.call(placeholders, key)) return raw;
    let val = stringifyPlaceholderValue(placeholders[key]);
    if (escapeEjs) {
      val = val.replace(/<%/g, '⟪%').replace(/%>/g, '%⟫');
    }
    return val;
  });

  let finalPrompt = customReplaced;
  const substituteFn = (globalThis as { substituteMacros?: (text: string) => string }).substituteMacros;
  if (typeof substituteFn === 'function') {
    finalPrompt = substituteFn(finalPrompt);
  }

  logger.debug('composePrompt done', { finalLength: finalPrompt.length });
  return finalPrompt;
}

/**
 * 步驟 3：發送 API 請求
 */
export async function sendRequest(prompt: string): Promise<SendResult> {
  const startedAt = Date.now();
  const generateRawFn = (globalThis as { generateRaw?: (config: GenerateRawConfig) => Promise<string> }).generateRaw;

  if (typeof generateRawFn !== 'function') {
    const message = 'generateRaw 不可用，無法執行背景 AI 生成';
    logger.error(message);
    return { ok: false, error: message };
  }

  try {
    const api = getRequiredApiSettings();
    const shouldStream = api.streamMode === 'streaming';

    logger.info('開始背景生成', { model: api.model, promptLength: prompt.length, stream: shouldStream });

    const customApiPayload: CustomApiConfig = {
      apiurl: api.endpoint,
      key: api.apiKey || undefined,
      model: api.model,
      source: 'openai',
      temperature: api.temperature,
      max_tokens: api.maxTokens,
      top_p: api.topP,
      presence_penalty: api.presencePenalty,
      frequency_penalty: api.frequencyPenalty,
    };

    const responseText = await generateRawFn({
      user_input: prompt,
      should_stream: shouldStream,
      should_silence: true,
      custom_api: customApiPayload,
      ordered_prompts: ['user_input'],
    });

    logger.info('背景生成完成', { durationMs: Date.now() - startedAt, responseLength: responseText.length });
    return { ok: true, responseText };
  } catch (err: any) {
    logger.error('背景生成失敗', { durationMs: Date.now() - startedAt, error: err?.message });
    return { ok: false, error: err instanceof Error ? err.message : 'generateRaw 背景請求失敗' };
  }
}

/**
 * 步驟 4：接收回應（還原 EJS 標籤）
 */
export function receiveRawResponse(rawText: string, escapeEjs: boolean = false): string {
  if (escapeEjs) {
    return rawText.replace(/⟪%/g, '<%').replace(/%⟫/g, '%>');
  }
  return rawText;
}

/**
 * 便利函式：完整執行 compose → send → receive
 */
export async function request(params: ComposePromptParams): Promise<RequestResult> {
  const prompt = composePrompt(params);
  const sent = await sendRequest(prompt);
  if (!sent.ok) {
    return { ok: false, prompt, error: sent.error ?? '發送失敗：未連接酒館或傳輸異常' };
  }
  return { ok: true, prompt, responseText: receiveRawResponse(sent.responseText ?? '', params.escapeEjs) };
}

/**
 * 預覽便利函式：僅執行拼接 + 佔位符替換，不發送請求。
 *
 * 用途：
 * - 在 UI 中預覽最終生成的提示詞
 * - 調試佔位符替換結果
 * - 確認模塊拼接順序是否正確
 *
 * @returns 拼接並替換後的完整提示詞文本
 */
export function previewPrompt(params: ComposePromptParams): string {
  return composePrompt(params);
}
