import { AiAppId, AiRequestSpec, AiResponseEnvelope, PromptTemplate } from '../types';
import { AiPlaceholderService } from './aiPlaceholderService';
import { DataService } from './dataService';

type BuildFinalPromptParams = {
  appId: AiAppId;
  contextId: string;
  mode: string;
  sectionId?: string;
  sectionName?: string;
  templates: PromptTemplate[];
  globalRules?: PromptTemplate[];
  currentData?: string;
  characterName?: string;
  playerDirection?: string;
  appName?: string;
  xmlTag?: string;
};

type RequestParams = BuildFinalPromptParams & {
  requestSpec?: Partial<AiRequestSpec>;
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

function normalizeText(text: string | undefined): string {
  return (text ?? '').replaceAll('\r\n', '\n').trimEnd();
}

export const AiPromptService = {
  composeBlocks(templates: PromptTemplate[], globalRules: PromptTemplate[] = []): PromptTemplate[] {
    return [...templates, ...globalRules];
  },

  async buildFinalPrompt(params: BuildFinalPromptParams): Promise<string> {
    const {
      appId,
      contextId,
      mode,
      sectionId,
      sectionName,
      templates,
      globalRules = [],
      currentData = '',
      characterName = '',
      playerDirection = '',
      appName,
      xmlTag = '角色編輯',
    } = params;

    const lines: string[] = [];
    lines.push(`<${xmlTag}>`);
    lines.push(`APP: ${appId}`);
    lines.push(`Context: ${contextId}`);
    lines.push(`Mode: ${mode}`);
    if (sectionId) lines.push(`SectionId: ${sectionId}`);
    if (sectionName) lines.push(`SectionName: ${sectionName}`);
    if (characterName) lines.push(`角色名稱: ${characterName}`);
    lines.push('');

    lines.push('--- 指令序列 ---');
    for (const block of templates) {
      const resolved = await AiPlaceholderService.resolveText(normalizeText(block.content), {
        appId,
        characterName,
        currentData,
        playerDirection,
        sectionName,
        appName,
      });
      lines.push(`[${block.title}]`);
      lines.push(resolved);
      lines.push('');
    }

    if (globalRules.length > 0) {
      lines.push('--- 全局輸出與解析規範 ---');
      for (const rule of globalRules) {
        const resolved = await AiPlaceholderService.resolveText(normalizeText(rule.content), {
          appId,
          characterName,
          currentData,
          playerDirection,
          sectionName,
          appName,
        });
        lines.push(`[${rule.title}]`);
        lines.push(resolved);
        lines.push('');
      }
    }

    if (currentData) {
      lines.push('--- 當前狀態與內容 ---');
      lines.push(currentData);
      lines.push('');
    }

    lines.push(`</${xmlTag}>`);
    return lines.join('\n');
  },

  async send(prompt: string): Promise<SendResult> {
    const startedAt = Date.now();

    if (typeof generateRaw !== 'function') {
      const message = 'generateRaw 不可用，無法執行背景 AI 生成';
      console.error('[HypnoOS] AiPromptService: %s', message);
      return { ok: false, error: message };
    }

    try {
      const api = getRequiredApiSettings();
      const shouldStream = api.streamMode === 'streaming';

      console.info('[HypnoOS] AiPromptService: 開始背景生成', {
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

      const responseText = await generateRaw({
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

      console.info('[HypnoOS] AiPromptService: 背景生成完成', {
        durationMs: Date.now() - startedAt,
        responseLength: responseText.length,
      });
      return { ok: true, responseText };
    } catch (err) {
      console.error('[HypnoOS] AiPromptService: 背景生成失敗', {
        durationMs: Date.now() - startedAt,
        error: err,
      });
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'generateRaw 背景請求失敗',
      };
    }
  },

  async request(params: RequestParams): Promise<{ ok: boolean; prompt: string; responseText?: string; error?: string }> {
    const prompt = await AiPromptService.buildFinalPrompt(params);
    const sent = await AiPromptService.send(prompt);
    if (!sent.ok) {
      return {
        ok: false,
        prompt,
        error: sent.error ?? '發送失敗：未連接酒館或傳輸異常',
      };
    }
    return { ok: true, prompt, responseText: sent.responseText };
  },

  receiveAndParse<T = unknown>(rawText: string, parser?: (text: string) => T): AiResponseEnvelope<T> {
    const cleaned = rawText.replace(/```[\s\S]*?```/g, v => v.replace(/```\w*\n?|```/g, '')).trim();
    if (!parser) {
      return {
        rawText,
        parsed: null,
        result: 'ok',
        meta: { cleanedText: cleaned },
      };
    }

    try {
      const parsed = parser(cleaned);
      return { rawText, parsed, result: 'ok' };
    } catch (err) {
      return {
        rawText,
        parsed: null,
        result: 'error',
        error: err instanceof Error ? err.message : '解析失敗',
      };
    }
  },
};
