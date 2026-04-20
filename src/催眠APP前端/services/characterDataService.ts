/**
 * CharacterDataService — 角色世界書資料的解析與回寫
 *
 * 負責：
 *  1. 從世界書條目讀取角色的人設/行為指導 Markdown
 *  2. 拆出 XML 區段 → YAML.parse → EditorNode[]
 *  3. EditorNode[] → YAML.stringify → 回寫世界書條目
 */
import YAML from 'yaml';
import type { EditorNode } from '../types';
import { WorldBookRepository } from './repositories/worldBookRepository';
import { treeToYaml, yamlToTree } from './helpers/astYamlHelper';
import { BehaviorBranch, sortBehaviorBranches, validateBehaviorBranches, rebuildBehaviorSection, parseEjsBranches } from './helpers/behaviorBranchHelper';
import { DATA_KEY_TO_SECTION, SECTION_LOCKED_KEYS, buildDefaultGlobalRulesNodes } from './constants/characterDefaults';

export type LoadResult = {
  sectionData: Record<string, EditorNode[]>;
  rawFallbacks: Record<string, string>;
  behaviorData: Record<string, BehaviorBranch[]>;
  entryUid: string | null;
  rawContent: string;
};

// ========== Constants ==========

/** 人設條目名的正則：[mvu_plot]角色名人设 or 人設 */
const PLOT_ENTRY_RE = /^\[mvu_plot\](.+?)(?:人设|人設)$/;

/** 用於正則拆出人設/行為 XML 的模板工廠 */
function buildXmlBlockRegex(charName: string): { dataRe: RegExp; behaviorRe: RegExp } {
  const escaped = charName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    dataRe: new RegExp(`<${escaped}(?:人设|人設)>[\\s\\S]*?\`\`\`yaml\\n([\\s\\S]*?)\`\`\`[\\s\\S]*?<\\/${escaped}(?:人设|人設)>`, 'm'),
    behaviorRe: new RegExp(`<${escaped}(?:行为指导|行為指導)>[\\s\\S]*?\`\`\`yaml\\n([\\s\\S]*?)\`\`\`[\\s\\S]*?<\\/${escaped}(?:行为指导|行為指導)>`, 'm'),
  };
}

// ========== Load / Save ==========

function ensureDefaultGlobalSection(sectionData: Record<string, EditorNode[]>, rawFallbacks: Record<string, string>): void {
  if (rawFallbacks.global) return;
  if ((sectionData.global ?? []).length > 0) return;
  sectionData.global = buildDefaultGlobalRulesNodes();
}

/**
 * 解析行為指導區段（EJS 混合 YAML）
 */
function parseBehaviorSection(
  rawText: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
  behaviorData: Record<string, BehaviorBranch[]>,
): void {
  const sectionMap: Record<string, string> = {
    '发情状态指导': 'arousal',
    '發情狀態指導': 'arousal',
    '警戒度指导': 'alert',
    '警戒度指導': 'alert',
    '好感度指导': 'affection',
    '好感度指導': 'affection',
    '服从度指导': 'obedience',
    '服從度指導': 'obedience',
    '全局行为规则': 'global',
    '全局行為規則': 'global',
    '当前状态': '_status',
    '當前狀態': '_status',
  };

  const headingRe = /^###\s+(.+)$/gm;
  const blocks: { title: string; content: string }[] = [];
  let lastIndex = 0;
  let lastTitle = '';
  let match: RegExpExecArray | null;

  while ((match = headingRe.exec(rawText)) !== null) {
    if (lastTitle) {
      blocks.push({ title: lastTitle, content: rawText.slice(lastIndex, match.index).trim() });
    }
    lastTitle = match[1].trim();
    lastIndex = match.index + match[0].length;
  }
  if (lastTitle) {
    blocks.push({ title: lastTitle, content: rawText.slice(lastIndex).trim() });
  }

  for (const block of blocks) {
    const secId = sectionMap[block.title];
    if (!secId || secId === '_status') continue;

    if (secId === 'global') {
      try {
        const parsed = YAML.parse(block.content);
        sectionData.global = yamlToTree(parsed, new Set(['rules']));
        console.info('[HypnoOS] characterDataService: 全局行為規則解析為樹狀資料成功');
      } catch (err) {
        console.warn('[HypnoOS] characterDataService: 全局行為規則解析失敗，降級原始文字', err);
        rawFallbacks.global = block.content;
      }
      continue;
    }

    const branches = parseEjsBranches(block.content);
    if (branches.length === 0) {
      rawFallbacks[secId] = block.content;
      console.warn(`[HypnoOS] characterDataService: 行為區「${block.title}」未解析出分支，降級 raw`);
      continue;
    }
    behaviorData[secId] = sortBehaviorBranches(branches);
    console.info(`[HypnoOS] characterDataService: 行為區「${block.title}」→ ${secId}，分支數=${branches.length}`);
  }
}

/**
 * 從世界書載入角色資料
 */
export async function loadCharacter(charName: string): Promise<LoadResult> {
  console.info(`[HypnoOS] characterDataService.loadCharacter: 開始載入「${charName}」`);

  const sectionData: Record<string, EditorNode[]> = {};
  const rawFallbacks: Record<string, string> = {};
  const behaviorData: Record<string, BehaviorBranch[]> = {};
  let entryUid: string | null = null;
  let rawContent = '';

  try {
    const wbName = WorldBookRepository.getCurrentCharacterWorldbook();
    if (!wbName) {
      console.warn('[HypnoOS] characterDataService: 角色卡未綁定世界書');
      ensureDefaultGlobalSection(sectionData, rawFallbacks);
      return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
    }

    console.info(`[HypnoOS] characterDataService: 世界書名稱 = ${wbName}`);

	const entries = await WorldBookRepository.getEntries(wbName);
	const plotEntry = entries.find(e => {
		const m = PLOT_ENTRY_RE.exec(e.name);
		return m && m[1] === charName;
	});

    if (!plotEntry) {
      console.info(`[HypnoOS] characterDataService: 未找到「${charName}」的世界書條目`);
      ensureDefaultGlobalSection(sectionData, rawFallbacks);
      return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
    }

	entryUid = plotEntry.uid?.toString() ?? null;
	rawContent = plotEntry.content ?? '';
    console.info(`[HypnoOS] characterDataService: 找到條目 uid=${entryUid}, 內容長度=${rawContent.length}`);

    const { dataRe, behaviorRe } = buildXmlBlockRegex(charName);
    const dataMatch = rawContent.match(dataRe);
    const behaviorMatch = rawContent.match(behaviorRe);

    if (dataMatch?.[1]) {
      try {
        const parsed = YAML.parse(dataMatch[1]);
        const inner = typeof parsed === 'object' && parsed !== null
          ? (parsed[charName] ?? parsed)
          : parsed;

        if (typeof inner === 'object' && inner !== null) {
          for (const [yamlKey, value] of Object.entries(inner)) {
            const sectionId = DATA_KEY_TO_SECTION[yamlKey];
            if (!sectionId) continue;
            const locked = new Set(SECTION_LOCKED_KEYS[sectionId] ?? []);
            const nodes = yamlToTree({ [yamlKey]: value }, locked);
            sectionData[sectionId] = [...(sectionData[sectionId] ?? []), ...nodes];
          }
          console.info(`[HypnoOS] characterDataService: 人設區解析成功, 分派到 ${Object.keys(sectionData).length} 個分區`);
        }
      } catch (err) {
        console.warn('[HypnoOS] characterDataService: 人設 YAML 解析失敗，存入原始文字', err);
        for (const secId of ['info', 'social', 'personality', 'appearance', 'fetish']) {
          rawFallbacks[secId] = dataMatch[1];
        }
      }
    } else {
      console.info('[HypnoOS] characterDataService: 未找到人設 XML 區段');
    }

    if (behaviorMatch?.[1]) {
      const behaviorRaw = behaviorMatch[1];
      parseBehaviorSection(behaviorRaw, sectionData, rawFallbacks, behaviorData);
    } else {
      console.info('[HypnoOS] characterDataService: 未找到行為指導 XML 區段');
    }

    ensureDefaultGlobalSection(sectionData, rawFallbacks);

  } catch (err) {
    console.error('[HypnoOS] characterDataService.loadCharacter 失敗', err);
  }

  return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
}

/**
 * 將編輯後的資料回寫到世界書
 */
export async function saveCharacter(
  charName: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
  behaviorData: Record<string, BehaviorBranch[]>,
  entryUid: string | null,
): Promise<boolean> {
  console.info(`[HypnoOS] characterDataService.saveCharacter: 開始儲存「${charName}」`);

  try {
    const wbName = WorldBookRepository.getCurrentCharacterWorldbook();
    if (!wbName) {
      console.error('[HypnoOS] characterDataService: 角色卡未綁定世界書');
      return false;
    }

    const dataObj: Record<string, unknown> = {};
    for (const [secId, keys] of Object.entries(SECTION_LOCKED_KEYS)) {
      const nodes = sectionData[secId];
      if (!nodes || nodes.length === 0) continue;
      const sectionObj = treeToYaml(nodes);
      if (typeof sectionObj === 'object' && sectionObj !== null) {
        Object.assign(dataObj, sectionObj);
      }
    }

    const dataYaml = YAML.stringify({ [charName]: dataObj }, { lineWidth: 0 });
    console.info(`[HypnoOS] characterDataService: 人設 YAML 長度 = ${dataYaml.length}`);

    const behaviorParts: string[] = [];
    const behaviorSections = [
      { secId: 'arousal', title: '发情状态指导' },
      { secId: 'alert', title: '警戒度指导' },
      { secId: 'affection', title: '好感度指导' },
      { secId: 'obedience', title: '服从度指导' },
      { secId: 'global', title: '全局行为规则' },
    ];

    behaviorParts.push(`### 当前状态`);
    behaviorParts.push(`Variables:`);
    behaviorParts.push(`  性欲: {{get_message_variable::stat_data.角色.${charName}.发情值}}`);
    behaviorParts.push(`  警戒度: {{get_message_variable::stat_data.角色.${charName}.警戒度}}`);
    behaviorParts.push(`  好感度: {{get_message_variable::stat_data.角色.${charName}.好感度}}`);
    behaviorParts.push(`  服从度: {{get_message_variable::stat_data.角色.${charName}.服从度}}`);
    behaviorParts.push('');

    for (const { secId, title } of behaviorSections) {
      const branches = behaviorData[secId];
      if (branches && branches.length > 0) {
        const validation = validateBehaviorBranches(secId, branches, charName);
        if (!validation.ok) {
          throw new Error((validation as {message: string}).message);
        }
        const rebuilt = rebuildBehaviorSection(secId, branches, charName);
        behaviorParts.push(`### ${title}`);
        behaviorParts.push(rebuilt);
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
        const globalYaml = YAML.stringify(treeToYaml(globalNodes), { lineWidth: 0 }).trimEnd();
        behaviorParts.push(globalYaml);
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

    console.info(`[HypnoOS] characterDataService: 完整內容長度 = ${fullContent.length}`);

    if (entryUid) {
      let updated = false;
		await WorldBookRepository.updateEntries(wbName, worldbook => {
			return worldbook.map(entry => {
				const hit = String(entry?.uid) === String(entryUid);
          if (hit) {
            updated = true;
            return { ...entry, content: fullContent };
          }
          return entry;
        });
      });

      if (!updated) {
        throw new Error(`目標條目不存在: uid=${entryUid}`);
      }

      console.info(`[HypnoOS] characterDataService: 已更新世界書條目 uid=${entryUid}, wb=${wbName}`);
    } else {
      console.warn('[HypnoOS] characterDataService: 無 uid，無法更新。請先檢查世界書條目是否存在。');
      return false;
    }

    return true;
  } catch (err) {
    console.error('[HypnoOS] characterDataService.saveCharacter 失敗', err);
    return false;
  }
}
