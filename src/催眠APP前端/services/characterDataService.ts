/**
 * CharacterDataService — 角色世界書資料的解析與回寫
 *
 * 負責：
 *  1. 從世界書條目讀取角色的人設/行為指導 Markdown
 *  2. 拆出 XML 區段 → YAML.parse → EditorNode[]
 *  3. EditorNode[] → YAML.stringify → 回寫世界書條目
 */
import YAML from 'yaml';
import type { EditorNode, NodeType } from '../types';

// iframe 全域函數宣告
declare function getCharWorldbookNames(target: string): { primary: string | null };
declare function getWorldbook(name: string): Promise<any[]>;
declare function updateWorldbookEntries(name: string, entries: any[]): Promise<void>;

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

// ========== ID Generator ==========

let _counter = 0;
function nextId(): string {
  return `cdn_${Date.now()}_${++_counter}`;
}

// ========== YAML ↔ EditorNode ==========

/**
 * 將任意 JS 值轉換為 EditorNode[]
 */
export function yamlToTree(obj: unknown, lockedKeys?: Set<string>): EditorNode[] {
  if (obj === null || obj === undefined) return [];

  if (typeof obj === 'string' || typeof obj === 'number' || typeof obj === 'boolean') {
    return [{ id: nextId(), key: '', type: 'string', value: String(obj), children: [], isLocked: false }];
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        return {
          id: nextId(),
          key: '',
          type: 'object' as NodeType,
          value: '',
          children: yamlToTree(item),
          isLocked: false,
        };
      }
      return {
        id: nextId(),
        key: '',
        type: 'string' as NodeType,
        value: String(item ?? ''),
        children: [],
        isLocked: false,
      };
    });
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    return entries.map(([key, val]) => {
      const isLocked = lockedKeys?.has(key) ?? false;
      if (Array.isArray(val)) {
        return {
          id: nextId(),
          key,
          type: 'list' as NodeType,
          value: '',
          children: yamlToTree(val),
          isLocked,
        };
      }
      if (typeof val === 'object' && val !== null) {
        return {
          id: nextId(),
          key,
          type: 'object' as NodeType,
          value: '',
          children: yamlToTree(val),
          isLocked,
        };
      }
      return {
        id: nextId(),
        key,
        type: 'string' as NodeType,
        value: String(val ?? ''),
        children: [],
        isLocked,
      };
    });
  }

  return [];
}

/**
 * 將 EditorNode[] 轉回 YAML 可序列化的物件
 */
export function treeToYaml(nodes: EditorNode[]): unknown {
  // 如果所有 node 的 key 都為空，視為陣列
  const isArray = nodes.length > 0 && nodes.every(n => n.key === '');

  if (isArray) {
    return nodes.map(n => {
      if (n.type === 'string') return n.value;
      return treeToYaml(n.children);
    });
  }

  const result: Record<string, unknown> = {};
  for (const n of nodes) {
    if (n.type === 'string') {
      result[n.key || '_unnamed'] = n.value;
    } else {
      result[n.key || '_unnamed'] = treeToYaml(n.children);
    }
  }
  return result;
}

// ========== Section Mapping ==========

/** 人設區段的 YAML key → section id 映射 */
const DATA_KEY_TO_SECTION: Record<string, string> = {
  title: 'info',
  gender: 'info',
  age: 'info',
  identity: 'info',
  social_connection: 'social',
  personality: 'personality',
  habit: 'personality',
  hidden_behavior: 'personality',
  appearance: 'appearance',
  sexual_preference: 'fetish',
  weakness: 'fetish',
};

/** 每個分區內預設鎖定的 key（頂層不可刪除/改名） */
const SECTION_LOCKED_KEYS: Record<string, string[]> = {
  info: ['title', 'gender', 'age', 'identity'],
  social: ['social_connection'],
  personality: ['personality', 'habit', 'hidden_behavior'],
  appearance: ['appearance'],
  fetish: ['sexual_preference', 'weakness'],
};

// ========== Load / Save ==========

export type LoadResult = {
  sectionData: Record<string, EditorNode[]>;
  rawFallbacks: Record<string, string>;
  entryUid: string | null;
  rawContent: string;
};

/**
 * 從世界書載入角色資料
 */
export async function loadCharacter(charName: string): Promise<LoadResult> {
  console.info(`[HypnoOS] characterDataService.loadCharacter: 開始載入「${charName}」`);

  const sectionData: Record<string, EditorNode[]> = {};
  const rawFallbacks: Record<string, string> = {};
  let entryUid: string | null = null;
  let rawContent = '';

  try {
    // 1. 取得世界書
    const charWb = getCharWorldbookNames('current');
    const wbName = charWb.primary;
    if (!wbName) {
      console.warn('[HypnoOS] characterDataService: 角色卡未綁定世界書');
      return { sectionData, rawFallbacks, entryUid, rawContent };
    }

    console.info(`[HypnoOS] characterDataService: 世界書名稱 = ${wbName}`);

    // 2. 讀取所有條目，找到角色條目
    const entries = await getWorldbook(wbName);
    const plotEntry = entries.find((e: any) => {
      const m = PLOT_ENTRY_RE.exec(e.name);
      return m && m[1] === charName;
    });

    if (!plotEntry) {
      console.info(`[HypnoOS] characterDataService: 未找到「${charName}」的世界書條目`);
      return { sectionData, rawFallbacks, entryUid, rawContent };
    }

    entryUid = (plotEntry as any).uid ?? null;
    rawContent = (plotEntry as any).content ?? '';
    console.info(`[HypnoOS] characterDataService: 找到條目 uid=${entryUid}, 內容長度=${rawContent.length}`);

    // 3. 拆出人設 XML 區段
    const { dataRe, behaviorRe } = buildXmlBlockRegex(charName);
    const dataMatch = rawContent.match(dataRe);
    const behaviorMatch = rawContent.match(behaviorRe);

    // 4. 解析人設區段
    if (dataMatch?.[1]) {
      try {
        const parsed = YAML.parse(dataMatch[1]);
        // 人設內容通常包在角色名 key 下
        const inner = typeof parsed === 'object' && parsed !== null
          ? (parsed[charName] ?? parsed)
          : parsed;

        if (typeof inner === 'object' && inner !== null) {
          // 分派到各分區
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
        // 各分區都顯示原始文字
        for (const secId of ['info', 'social', 'personality', 'appearance', 'fetish']) {
          rawFallbacks[secId] = dataMatch[1];
        }
      }
    } else {
      console.info('[HypnoOS] characterDataService: 未找到人設 XML 區段');
    }

    // 5. 解析行為指導區段（整體存入各 behavior 分區）
    if (behaviorMatch?.[1]) {
      const behaviorRaw = behaviorMatch[1];
      // 行為指導包含 EJS，按區塊分割
      parseBehaviorSection(behaviorRaw, charName, sectionData, rawFallbacks);
    } else {
      console.info('[HypnoOS] characterDataService: 未找到行為指導 XML 區段');
    }

  } catch (err) {
    console.error('[HypnoOS] characterDataService.loadCharacter 失敗', err);
  }

  return { sectionData, rawFallbacks, entryUid, rawContent };
}

/**
 * 解析行為指導區段（EJS 混合 YAML）
 */
function parseBehaviorSection(
  rawText: string,
  charName: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
): void {
  // 簡易方式：將整個行為指導的 raw 按 ### 標題分段
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

  // Split by ### headings
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

    // 行為區段包含 EJS，整體存為原始文字（由使用者透過 EJS 分支編輯器處理）
    rawFallbacks[secId] = block.content;
    console.info(`[HypnoOS] characterDataService: 行為區「${block.title}」→ ${secId} (raw, ${block.content.length} chars)`);
  }
}

/**
 * 將編輯後的資料回寫到世界書
 */
export async function saveCharacter(
  charName: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
  entryUid: string | null,
): Promise<boolean> {
  console.info(`[HypnoOS] characterDataService.saveCharacter: 開始儲存「${charName}」`);

  try {
    const charWb = getCharWorldbookNames('current');
    const wbName = charWb.primary;
    if (!wbName) {
      console.error('[HypnoOS] characterDataService: 角色卡未綁定世界書');
      return false;
    }

    // 1. 組合人設 YAML
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

    // 2. 組合行為指導（保留 raw EJS 文本）
    const behaviorParts: string[] = [];
    const behaviorSections = [
      { secId: 'arousal', title: '发情状态指导' },
      { secId: 'alert', title: '警戒度指导' },
      { secId: 'affection', title: '好感度指导' },
      { secId: 'obedience', title: '服从度指导' },
      { secId: 'global', title: '全局行为规则' },
    ];

    // 狀態變量引用頭
    behaviorParts.push(`### 当前状态`);
    behaviorParts.push(`Variables:`);
    behaviorParts.push(`  性欲: {{get_message_variable::stat_data.角色.${charName}.发情值}}`);
    behaviorParts.push(`  警戒度: {{get_message_variable::stat_data.角色.${charName}.警戒度}}`);
    behaviorParts.push(`  好感度: {{get_message_variable::stat_data.角色.${charName}.好感度}}`);
    behaviorParts.push(`  服从度: {{get_message_variable::stat_data.角色.${charName}.服从度}}`);
    behaviorParts.push('');

    for (const { secId, title } of behaviorSections) {
      const raw = rawFallbacks[secId];
      if (raw) {
        behaviorParts.push(`### ${title}`);
        behaviorParts.push(raw);
        behaviorParts.push('');
      }
    }

    const behaviorYaml = behaviorParts.join('\n');

    // 3. 組合完整內容
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

    // 4. 回寫世界書
    if (entryUid) {
      await updateWorldbookEntries(wbName, [{ uid: entryUid, content: fullContent }]);
      console.info(`[HypnoOS] characterDataService: 已更新世界書條目 uid=${entryUid}`);
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
