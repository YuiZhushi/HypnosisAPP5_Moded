import { PromptTemplateV2 } from '../types';
import { DataService } from './dataService';

type PromptModule = Pick<PromptTemplateV2, 'id' | 'content'>;

type PlaceholderValue = string | number | boolean | null | undefined;

type ComposePromptParams = {
  modules: PromptModule[];
  moduleOrder?: string[];
  placeholders?: Record<string, PlaceholderValue>;
};

type SendResult = {
  ok: boolean;
  responseText?: string;
  error?: string;
};

function maskApiKey(value: string | undefined): string {
  if (!value) return '(empty)';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

function getRequiredApiSettings() {
  const api = DataService.getApiSettings();
  const endpoint = (api?.apiEndpoint ?? '').trim();
  const model = (api?.modelName ?? '').trim();

  if (!endpoint) {
    throw new Error('AI API 設定缺少端點（apiEndpoint）');
  }
  if (!model) {
    throw new Error('AI API 設定缺少模型名稱（modelName）');
  }

  return {
    endpoint,
    model,
    apiKey: api?.apiKey ?? '',
    streamMode: api?.streamMode ?? 'non_streaming',
    temperature: api?.temperature,
    maxTokens: api?.maxTokens,
    topP: api?.topP,
    presencePenalty: api?.presencePenalty,
    frequencyPenalty: api?.frequencyPenalty,
  };
}

const PLACEHOLDER_REGEX = /\{\{\s*([^{}]+?)\s*\}\}/g;

function normalizeText(text: string | undefined): string {
  return (text ?? '').replaceAll('\r\n', '\n');
}

function stringifyPlaceholderValue(value: PlaceholderValue): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export const AiRequestPipelineService = {
  /**
   * 步驟 1+2：按模塊順序拼接提示詞，並替換佔位符。
   * - 僅做文本處理，不注入任何額外標題/包裝。
   * - 若提供 moduleOrder，嚴格依照 moduleOrder 拼接。
   */
  composePrompt(params: ComposePromptParams): string {
    const { modules, moduleOrder = [], placeholders = {} } = params;

    const moduleMap = new Map(modules.map(m => [m.id, m]));
    const orderedModules = moduleOrder.length > 0
      ? moduleOrder.map(id => {
          const found = moduleMap.get(id);
          if (!found) {
            throw new Error(`提示詞模組缺失：moduleOrder 指定了不存在的 id「${id}」`);
          }
          return found;
        })
      : modules;

    const merged = orderedModules.map(m => normalizeText(m.content)).join('');

    return merged.replace(PLACEHOLDER_REGEX, (raw, keyRaw: string) => {
      const key = keyRaw.trim();
      if (!Object.prototype.hasOwnProperty.call(placeholders, key)) return raw;
      return stringifyPlaceholderValue(placeholders[key]);
    });
  },

  /** 步驟 3：發送請求 */
  async sendRequest(prompt: string): Promise<SendResult> {
    const startedAt = Date.now();
    const generateRawFn = (globalThis as { generateRaw?: (config: GenerateRawConfig) => Promise<string> }).generateRaw;

    if (typeof generateRawFn !== 'function') {
      const message = 'generateRaw 不可用，無法執行背景 AI 生成';
      console.error('[HypnoOS] AiRequestPipelineService: %s', message);
      return { ok: false, error: message };
    }

    try {
      const api = getRequiredApiSettings();
      const shouldStream = api.streamMode === 'streaming';

      console.info('[HypnoOS] AiRequestPipelineService: 開始背景生成', {
        transport: 'api_transport',
        promptLength: prompt.length,
        shouldStream,
        shouldSilence: true,
        api: {
          endpoint: api.endpoint,
          model: api.model,
          keyMasked: maskApiKey(api.apiKey),
          temperature: api.temperature,
          maxTokens: api.maxTokens,
          topP: api.topP,
          presencePenalty: api.presencePenalty,
          frequencyPenalty: api.frequencyPenalty,
        },
      });

      const responseText = await generateRawFn({
        user_input: prompt,
        should_stream: shouldStream,
        should_silence: true,
        custom_api: {
          apiurl: api.endpoint,
          key: api.apiKey || undefined,
          model: api.model,
          source: 'openai',
          temperature: api.temperature,
          max_tokens: api.maxTokens,
          top_p: api.topP,
          presence_penalty: api.presencePenalty,
          frequency_penalty: api.frequencyPenalty,
        },
        ordered_prompts: ['user_input'],
      });

      console.info('[HypnoOS] AiRequestPipelineService: 背景生成完成', {
        durationMs: Date.now() - startedAt,
        responseLength: responseText.length,
      });
      return { ok: true, responseText };
    } catch (err) {
      console.error('[HypnoOS] AiRequestPipelineService: 背景生成失敗', {
        durationMs: Date.now() - startedAt,
        error: err,
      });
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'generateRaw 背景請求失敗',
      };
    }
  },

  /**
   * 便利函式：完整執行四步中的前 3 步
   * 1) 拼接提示詞 2) 替換佔位符 3) 發送請求
   */
  async request(params: ComposePromptParams): Promise<{ ok: boolean; prompt: string; responseText?: string; error?: string }> {
    const prompt = AiRequestPipelineService.composePrompt(params);

    const sent = await AiRequestPipelineService.sendRequest(prompt);
    if (!sent.ok) {
      return {
        ok: false,
        prompt,
        error: sent.error ?? '發送失敗：未連接酒館或傳輸異常',
      };
    }
    return {
      ok: true,
      prompt,
      responseText: AiRequestPipelineService.receiveRawResponse(sent.responseText ?? ''),
    };
  },

  /** 步驟 4：接收回應（原樣返回，解析交由 APP 端） */
  receiveRawResponse(rawText: string): string {
    return rawText;
  },
};
