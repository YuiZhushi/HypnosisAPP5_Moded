/**
 * Character Editor APP 後端 — 統一入口
 *
 * 職責：
 * - 從世界書載入角色資料（人設 YAML + 行為分支 EJS）
 * - 將編輯後的資料回寫到世界書
 * - 世界書條目檢查/建立（mvu_update + mvu_plot）
 * - AI 填寫：解析 AI 回應 → Diff 比對 → 用戶審核 → Merge 套用
 * - 提示詞構造：篩選模塊 + 佔位符注入
 *
 * 子模塊：
 * - astYamlHelper: EditorNode[] ↔ YAML 轉換
 * - behaviorBranchHelper: EJS 行為分支解析/序列化
 * - worldBookEntryManager: 世界書條目 CRUD
 * - aiPatchParser: AI 回應 → AiPatchResult
 * - astDiffEngine: 新舊樹比對 → AstDiffProposal[]
 * - astMergeEngine: 審核結果 → 套用回樹
 * - editorPromptBuilder: AI 請求參數構造
 */

import YAML from 'yaml';
import type { EditorNode } from '../../constants/interfaces';
import { DATA_KEY_TO_SECTION, SECTION_LOCKED_KEYS } from '../../constants/character-editor/characterConstants';
import { buildDefaultGlobalRulesNodes } from '../../constants/character-editor/characterDefaults';
import * as WBRepo from '../../shared/worldbook/worldBookRepository';
import { logger } from '../../shared/debug/loggerService';

import { yamlToTree, treeToYaml } from './astYamlHelper';
import {
  type BehaviorBranch,
  parseEjsBranches,
  sortBehaviorBranches,
  validateBehaviorBranches,
  rebuildBehaviorSection,
} from './behaviorBranchHelper';

// ====== Re-export 子模塊 ======

// AST YAML 轉換
export type { BehaviorBranch } from './behaviorBranchHelper';
export { yamlToTree, treeToYaml, parseSectionYamlToNodes, serializeSectionNodesToYaml } from './astYamlHelper';

// 行為分支
export {
  parseEjsBranches,
  parseBehaviorBranchesFromRaw,
  serializeBehaviorBranches,
  sortBehaviorBranches,
  validateBehaviorBranches,
  rebuildBehaviorSection,
  buildBranchCondition,
} from './behaviorBranchHelper';

// 世界書條目
export {
  checkAndEnsureEntry,
  checkAndEnsurePlotEntry,
  type WbCheckResult,
} from './worldBookEntryManager';

// AI 填寫流程
export { parseAiResponse } from './aiPatchParser';
export { buildDiffProposals } from './astDiffEngine';
export { applyApprovedProposals, summarizeApplyResult } from './astMergeEngine';

// 提示詞構造
export { buildEditorPipelineParams } from './editorPromptBuilder';

// ====== 類型 ======

export type LoadResult = {
  sectionData: Record<string, EditorNode[]>;
  rawFallbacks: Record<string, string>;
  behaviorData: Record<string, BehaviorBranch[]>;
  entryUid: string | null;
  rawContent: string;
};

// ====== 常數 ======

const PLOT_ENTRY_RE = /^\[mvu_plot\](.+?)(?:人设|人設)$/;

function buildXmlBlockRegex(charName: string): { dataRe: RegExp; behaviorRe: RegExp } {
  const escaped = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    dataRe: new RegExp(`<${escaped}(?:人设|人設)>[\\s\\S]*?\`\`\`yaml\\n([\\s\\S]*?)\`\`\`[\\s\\S]*?<\\/${escaped}(?:人设|人設)>`, 'm'),
    behaviorRe: new RegExp(`<${escaped}(?:行为指导|行為指導)>[\\s\\S]*?\`\`\`yaml\\n([\\s\\S]*?)\`\`\`[\\s\\S]*?<\\/${escaped}(?:行为指导|行為指導)>`, 'm'),
  };
}

// ====== 行為區段解析 ======

const BEHAVIOR_SECTION_MAP: Record<string, string> = {
  '发情状态指导': 'arousal', '發情狀態指導': 'arousal',
  '警戒度指导': 'alert', '警戒度指導': 'alert',
  '好感度指导': 'affection', '好感度指導': 'affection',
  '服从度指导': 'obedience', '服從度指導': 'obedience',
  '全局行为规则': 'global', '全局行為規則': 'global',
  '当前状态': '_status', '當前狀態': '_status',
};

function parseBehaviorSection(
  rawText: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
  behaviorData: Record<string, BehaviorBranch[]>,
): void {
  const headingRe = /^###\s+(.+)$/gm;
  const blocks: { title: string; content: string }[] = [];
  let lastIndex = 0, lastTitle = '';
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(rawText)) !== null) {
    if (lastTitle) blocks.push({ title: lastTitle, content: rawText.slice(lastIndex, match.index).trim() });
    lastTitle = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastTitle) blocks.push({ title: lastTitle, content: rawText.slice(lastIndex).trim() });

  for (const block of blocks) {
    const secId = BEHAVIOR_SECTION_MAP[block.title];
    if (!secId || secId === '_status') continue;

    if (secId === 'global') {
      try {
        sectionData.global = yamlToTree(YAML.parse(block.content), new Set(['rules']));
        logger.info('全局行為規則解析為樹狀資料成功');
      } catch (err) {
        logger.warn('全局行為規則解析失敗，降級原始文字', err);
        rawFallbacks.global = block.content;
      }
      continue;
    }

    const branches = parseEjsBranches(block.content);
    if (branches.length === 0) {
      rawFallbacks[secId] = block.content;
      logger.warn(`行為區「${block.title}」未解析出分支，降級 raw`);
      continue;
    }
    behaviorData[secId] = sortBehaviorBranches(branches);
    logger.info(`行為區「${block.title}」→ ${secId}，分支數=${branches.length}`);
  }
}

function ensureDefaultGlobalSection(sectionData: Record<string, EditorNode[]>, rawFallbacks: Record<string, string>): void {
  if (rawFallbacks.global) return;
  if ((sectionData.global ?? []).length > 0) return;
  sectionData.global = buildDefaultGlobalRulesNodes();
}

// ====== 公開 API：載入 ======

/** 從世界書載入指定角色的人設與行為資料 */
export async function loadCharacter(charName: string): Promise<LoadResult> {
  logger.info(`loadCharacter: 開始載入「${charName}」`);

  const sectionData: Record<string, EditorNode[]> = {};
  const rawFallbacks: Record<string, string> = {};
  const behaviorData: Record<string, BehaviorBranch[]> = {};
  let entryUid: string | null = null;
  let rawContent = '';

  try {
    const wbName = WBRepo.getCurrentCharacterWorldbook();
    if (!wbName) {
      logger.warn('角色卡未綁定世界書');
      ensureDefaultGlobalSection(sectionData, rawFallbacks);
      return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
    }

    const entries = await WBRepo.getEntries(wbName);
    const plotEntry = entries.find(e => {
      const m = PLOT_ENTRY_RE.exec(e.name);
      return m && m[1] === charName;
    });

    if (!plotEntry) {
      logger.info(`未找到「${charName}」的世界書條目`);
      ensureDefaultGlobalSection(sectionData, rawFallbacks);
      return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
    }

    entryUid = plotEntry.uid?.toString() ?? null;
    rawContent = plotEntry.content ?? '';
    logger.info(`找到條目 uid=${entryUid}, 內容長度=${rawContent.length}`);

    const { dataRe, behaviorRe } = buildXmlBlockRegex(charName);
    const dataMatch = rawContent.match(dataRe);
    const behaviorMatch = rawContent.match(behaviorRe);

    // 解析人設區
    if (dataMatch?.[1]) {
      try {
        const parsed = YAML.parse(dataMatch[1]);
        const inner = typeof parsed === 'object' && parsed !== null ? (parsed[charName] ?? parsed) : parsed;
        if (typeof inner === 'object' && inner !== null) {
          for (const [yamlKey, value] of Object.entries(inner)) {
            const sectionId = DATA_KEY_TO_SECTION[yamlKey];
            if (!sectionId) continue;
            const locked = new Set(SECTION_LOCKED_KEYS[sectionId] ?? []);
            const nodes = yamlToTree({ [yamlKey]: value }, locked);
            sectionData[sectionId] = [...(sectionData[sectionId] ?? []), ...nodes];
          }
          logger.info(`人設區解析成功, 分派到 ${Object.keys(sectionData).length} 個分區`);
        }
      } catch (err) {
        logger.warn('人設 YAML 解析失敗，存入原始文字', err);
        for (const secId of ['info', 'social', 'personality', 'appearance', 'fetish']) {
          rawFallbacks[secId] = dataMatch[1];
        }
      }
    }

    // 解析行為區
    if (behaviorMatch?.[1]) {
      parseBehaviorSection(behaviorMatch[1], sectionData, rawFallbacks, behaviorData);
    }

    ensureDefaultGlobalSection(sectionData, rawFallbacks);
  } catch (err) {
    logger.error('loadCharacter 失敗', err);
  }

  return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
}

// ====== 公開 API：儲存 ======

/** 將編輯後的角色資料回寫到世界書 */
export async function saveCharacter(
  charName: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
  behaviorData: Record<string, BehaviorBranch[]>,
  entryUid: string | null,
): Promise<boolean> {
  logger.info(`saveCharacter: 開始儲存「${charName}」`);

  try {
    const wbName = WBRepo.getCurrentCharacterWorldbook();
    if (!wbName) {
      logger.error('角色卡未綁定世界書');
      return false;
    }

    // 組裝人設 YAML
    const dataObj: Record<string, unknown> = {};
    for (const [secId] of Object.entries(SECTION_LOCKED_KEYS)) {
      const nodes = sectionData[secId];
      if (!nodes || nodes.length === 0) continue;
      const sectionObj = treeToYaml(nodes);
      if (typeof sectionObj === 'object' && sectionObj !== null) {
        Object.assign(dataObj, sectionObj);
      }
    }

    const dataYaml = YAML.stringify({ [charName]: dataObj }, { lineWidth: 0 });

    // 組裝行為指導
    const behaviorParts: string[] = [];
    const behaviorSections = [
      { secId: 'arousal', title: '发情状态指导' },
      { secId: 'alert', title: '警戒度指导' },
      { secId: 'affection', title: '好感度指导' },
      { secId: 'obedience', title: '服从度指导' },
      { secId: 'global', title: '全局行为规则' },
    ];

    behaviorParts.push('### 当前状态');
    behaviorParts.push('Variables:');
    behaviorParts.push(`  性欲: {{get_message_variable::stat_data.角色.${charName}.发情值}}`);
    behaviorParts.push(`  警戒度: {{get_message_variable::stat_data.角色.${charName}.警戒度}}`);
    behaviorParts.push(`  好感度: {{get_message_variable::stat_data.角色.${charName}.好感度}}`);
    behaviorParts.push(`  服从度: {{get_message_variable::stat_data.角色.${charName}.服从度}}`);
    behaviorParts.push('');

    for (const { secId, title } of behaviorSections) {
      const branches = behaviorData[secId];
      if (branches && branches.length > 0) {
        const validation = validateBehaviorBranches(secId, branches, charName);
        if (!validation.ok) throw new Error((validation as { message: string }).message);
        behaviorParts.push(`### ${title}`);
        behaviorParts.push(rebuildBehaviorSection(secId, branches, charName));
        behaviorParts.push('');
        continue;
      }

      const raw = rawFallbacks[secId];
      if (raw) {
        behaviorParts.push(`### ${title}`);
        behaviorParts.push(raw);
        behaviorParts.push('');
      }
    }

    if (!rawFallbacks.global) {
      const globalNodes = sectionData.global;
      if (globalNodes && globalNodes.length > 0) {
        behaviorParts.push('### 全局行为规则');
        behaviorParts.push(YAML.stringify(treeToYaml(globalNodes), { lineWidth: 0 }).trimEnd());
        behaviorParts.push('');
      }
    }

    const behaviorYaml = behaviorParts.join('\n');

    const fullContent = [
      `<${charName}人设>`,
      '```yaml',
      dataYaml.trimEnd(),
      '```',
      `</${charName}人设>`,
      '',
      `<${charName}行为指导>`,
      '```yaml',
      behaviorYaml.trimEnd(),
      '```',
      `</${charName}行为指导>`,
    ].join('\n');

    logger.info(`完整內容長度 = ${fullContent.length}`);

    if (!entryUid) {
      logger.warn('無 uid，無法更新。請先檢查世界書條目是否存在。');
      return false;
    }

    let updated = false;
    await WBRepo.updateEntries(wbName, worldbook => worldbook.map(entry => {
      if (String(entry?.uid) !== String(entryUid)) return entry;
      updated = true;
      return { ...entry, content: fullContent };
    }));

    if (!updated) throw new Error(`目標條目不存在: uid=${entryUid}`);

    logger.info(`已更新世界書條目 uid=${entryUid}, wb=${wbName}`);
    return true;
  } catch (err) {
    logger.error('saveCharacter 失敗', err);
    return false;
  }
}
