/**
 * characterEditorSend.ts — 角色編輯器專用的提示詞構建與發送
 *
 * 與催眠發送完全獨立，有自己的 XML 包裝格式和發送邏輯。
 */
import { PromptTemplate } from '../types';

// iframe 全域函數
declare function createChatMessages(messages: Array<{ role: string; message: string }>, opts?: Record<string, unknown>): Promise<void>;
declare function triggerSlash(command: string): Promise<void>;

function normalizeText(text: string | undefined): string {
  return (text ?? '').replaceAll('\r\n', '\n').trimEnd();
}

/**
 * 替換模板中的巨集佔位符
 */
function resolveMacros(
  text: string,
  characterName: string,
  currentSectionData: string,
  playerDirection: string,
): string {
  return text
    .replaceAll('{{裝配角色名字}}', characterName)
    .replaceAll('{{當前狀態與內容}}', currentSectionData || '(此分區尚無資料)')
    .replaceAll('{{玩家輸入}}', playerDirection || '(無特殊要求)')
    .replaceAll('{{玩家特殊指示}}', playerDirection || '(無特殊要求)');
  // Note: {{WI:xxx}} macros are resolved separately via worldbook API
}

/**
 * 構造角色編輯器發送給 AI 的完整提示詞
 */
export function buildEditorPrompt(params: {
  mode: 'full_fill' | 'section';
  sectionId: string;
  sectionName: string;
  templates: PromptTemplate[];
  globalRules: PromptTemplate[];
  currentData: string;
  characterName: string;
  playerDirection: string;
}): string {
  const { mode, sectionId, sectionName, templates, globalRules, currentData, characterName, playerDirection } = params;

  const lines: string[] = [];
  lines.push('<角色編輯>');
  lines.push(`模式: ${mode === 'full_fill' ? '全部填寫' : `分區填寫 (${sectionName})`}`);
  lines.push(`角色名稱: ${characterName}`);
  lines.push(`目標分區: ${sectionId}`);
  lines.push('');

  // Section templates
  lines.push('--- 指令序列 ---');
  for (const t of templates) {
    const content = resolveMacros(normalizeText(t.content), characterName, currentData, playerDirection);
    lines.push(`[${t.title}]`);
    lines.push(content);
    lines.push('');
  }

  // Global output rules
  if (globalRules.length > 0) {
    lines.push('--- 全局輸出與解析規範 ---');
    for (const r of globalRules) {
      const content = resolveMacros(normalizeText(r.content), characterName, currentData, playerDirection);
      lines.push(`[${r.title}]`);
      lines.push(content);
      lines.push('');
    }
  }

  // Current section data
  if (currentData) {
    lines.push('--- 當前分區已有內容 ---');
    lines.push(currentData);
    lines.push('');
  }

  lines.push('</角色編輯>');
  return lines.join('\n');
}

/**
 * 角色編輯器專用的發送函數
 * 遵循酒館助手 API 規範：[{role, message}] 陣列格式
 */
export async function sendEditorPrompt(prompt: string): Promise<boolean> {
  console.info(`[HypnoOS] characterEditorSend: 準備發送提示詞, 長度=${prompt.length}`);

  if (typeof createChatMessages !== 'function') {
    console.error('[HypnoOS] characterEditorSend: createChatMessages 未定義（未連接酒館）');
    return false;
  }

  try {
    await createChatMessages(
      [{ role: 'user', message: prompt }],
      { refresh: 'affected' },
    );
    console.info('[HypnoOS] characterEditorSend: createChatMessages 成功');

    if (typeof triggerSlash === 'function') {
      await triggerSlash('/trigger');
      console.info('[HypnoOS] characterEditorSend: triggerSlash 成功');
    } else {
      console.warn('[HypnoOS] characterEditorSend: triggerSlash 未定義');
    }

    return true;
  } catch (err) {
    console.error('[HypnoOS] characterEditorSend: 發送失敗', err);
    return false;
  }
}
