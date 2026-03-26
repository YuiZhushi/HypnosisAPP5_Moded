import { AiAppId, AiRequestSpec, AiResponseEnvelope, PromptTemplate } from '../types';
import { AiPlaceholderService } from './aiPlaceholderService';

declare function createChatMessages(messages: Array<{ role: string; message: string }>, opts?: Record<string, unknown>): Promise<void>;
declare function triggerSlash(command: string): Promise<void>;

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

  async send(prompt: string, transport: 'chat_transport' | 'api_transport' = 'chat_transport'): Promise<boolean> {
    if (transport === 'api_transport') {
      console.warn('[HypnoOS] AiPromptService: 尚未實作 api_transport，回退 chat_transport');
    }

    if (typeof createChatMessages !== 'function') {
      console.error('[HypnoOS] AiPromptService: createChatMessages 未定義（未連接酒館）');
      return false;
    }

    try {
      await createChatMessages([{ role: 'user', message: prompt }], { refresh: 'affected' });
      if (typeof triggerSlash === 'function') {
        await triggerSlash('/trigger');
      }
      return true;
    } catch (err) {
      console.error('[HypnoOS] AiPromptService: 發送失敗', err);
      return false;
    }
  },

  async request(params: RequestParams): Promise<{ ok: boolean; prompt: string; error?: string }> {
    const prompt = await AiPromptService.buildFinalPrompt(params);
    const transport = params.requestSpec?.transport ?? 'chat_transport';
    const ok = await AiPromptService.send(prompt, transport);
    if (!ok) {
      return { ok: false, prompt, error: '發送失敗：未連接酒館或傳輸異常' };
    }
    return { ok: true, prompt };
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
