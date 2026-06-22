/**
 * Character Editor APP 後端 — AI 回應解析器
 *
 * 從 helpers/aiPatchParser.ts 遷移。
 * 解析 AI 生成的原始文字中的 <yaml_patch> / <ejs_patch> 標籤，
 * 提取結構化的 YAML 與 EJS 補全內容。
 */

import type { AiPatchResult } from '../../constants/interfaces';

/**
 * 解析 AI 回應，提取 YAML/EJS patch 內容。
 * 容忍拼寫錯誤（如 esj_patch），並自動清理 markdown 偽影。
 */
export function parseAiResponse(rawText: string, expectedType: 'yaml' | 'ejs' | 'mixed'): AiPatchResult {
  const result: AiPatchResult = {
    yamlRaw: '',
    ejsRaw: '',
    warnings: [],
    rawText,
  };

  if (!rawText) {
    result.warnings.push('AI 傳回了空內容。');
    return result;
  }

  // 匹配 <yaml_patch>...</yaml_patch>
  const yamlRegex = /<yaml_patch>([\s\S]*?)<\/yaml_patch>/gi;
  // 匹配 <ejs_patch> 或拼寫錯誤 <esj_patch>
  const ejsRegex = /<(?:ejs_patch|esj_patch)>([\s\S]*?)<\/(?:ejs_patch|esj_patch)>/gi;

  const yamlContents: string[] = [];
  let yamlMatch;
  while ((yamlMatch = yamlRegex.exec(rawText)) !== null) {
    yamlContents.push(yamlMatch[1].trim());
  }

  const ejsContents: string[] = [];
  let ejsMatch;
  while ((ejsMatch = ejsRegex.exec(rawText)) !== null) {
    ejsContents.push(ejsMatch[1].trim());
  }

  if (yamlContents.length > 0) result.yamlRaw = yamlContents.join('\n\n');
  if (ejsContents.length > 0) result.ejsRaw = ejsContents.join('\n\n');

  // 依照 expectedType 做驗證
  if (expectedType === 'yaml') {
    if (ejsContents.length > 0 && yamlContents.length === 0) {
      result.warnings.push('預期收到 YAML 補全，但 AI 給出了 EJS。');
    }
    result.ejsRaw = '';
  } else if (expectedType === 'ejs') {
    if (yamlContents.length > 0 && ejsContents.length === 0) {
      result.warnings.push('預期收到 EJS 補全，但 AI 給出了 YAML。');
    }
    result.yamlRaw = '';
  }

  if (!result.yamlRaw && !result.ejsRaw) {
    result.warnings.push('無法從 AI 回應中解析出有效的 <yaml_patch> 或 <ejs_patch> 標籤！');
  } else {
    // 清理 YAML 中的 markdown 標題偽影（## / ### 等，但保留 YAML 註釋 #）
    if (result.yamlRaw) {
      result.yamlRaw = result.yamlRaw
        .split('\n')
        .filter(line => !/^\s*#{2,}\s+/.test(line))
        .join('\n');
    }
  }

  return result;
}
