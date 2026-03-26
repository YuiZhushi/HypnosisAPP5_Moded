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
declare function updateWorldbookWith(
  worldbook_name: string,
  updater: (worldbook: any[]) => any[] | Promise<any[]>,
  options?: { render?: 'debounced' | 'immediate' },
): Promise<any[]>;

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
      if (Array.isArray(item)) {
        return {
          id: nextId(),
          key: '',
          type: 'list' as NodeType,
          value: '',
          children: yamlToTree(item),
          isLocked: false,
        };
      }
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
  const rootLooksLikeArray = nodes.length > 0 && nodes.every(n => n.key.trim() === '');
  if (rootLooksLikeArray) {
    return nodes.map(nodeToYamlValue);
  }

  const result: Record<string, unknown> = {};
  let unnamedCounter = 0;

  for (const node of nodes) {
    const rawKey = node.key?.trim() ?? '';
    const key = rawKey || `unnamed_${++unnamedCounter}`;
    result[key] = nodeToYamlValue(node);
  }

  return result;
}

function nodeToYamlValue(node: EditorNode): unknown {
  if (node.type === 'string') {
    return node.value;
  }

  if (node.type === 'list') {
    return node.children.map(nodeToYamlValue);
  }

  const result: Record<string, unknown> = {};
  let unnamedCounter = 0;

  for (const child of node.children) {
    const rawKey = child.key?.trim() ?? '';
    const key = rawKey || `unnamed_${++unnamedCounter}`;
    result[key] = nodeToYamlValue(child);
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
  behaviorData: Record<string, BehaviorBranch[]>;
  entryUid: string | null;
  rawContent: string;
};

export interface BehaviorBranch {
  branchId: string;
  label: string;
  kind: 'if' | 'else_if' | 'else';
  operator?: '<' | '<=' | '>' | '>=' | '==';
  threshold?: number;
  subjectExpr?: string;
  conditionRaw: string;
  openTagRaw: string;
  yamlRaw: string;
  nodes: EditorNode[] | null;
  parseError?: string;
}

type BehaviorOperator = '<' | '<=' | '>' | '>=' | '==';

function createDefaultGlobalRulesObject(): Record<string, unknown> {
  return {
    rules: [
      '行为指导优先于作为背景的`角色关键信息`和`角色详情`',
      '好感度和服从度行为可以混合',
      '角色的好感与服从度要优先于警戒度, 只要好感度或服从度大于警戒度, 就不会触发警戒',
    ],
  };
}

export function buildDefaultGlobalRulesNodes(): EditorNode[] {
  return yamlToTree(createDefaultGlobalRulesObject(), new Set(['rules']));
}

function resolveUpperBand(sectionId: string, threshold: number): number {
  const bands: Record<string, number[]> = {
    arousal: [20, 40, 60, 80, 95],
    alert: [20, 40, 60, 80, 100],
    affection: [20, 40, 60, 80],
    obedience: [20, 40, 60, 80],
  };
  const list = bands[sectionId] ?? [];
  if (list.length === 0) return 0;
  const idx = list.findIndex(v => threshold <= v);
  return idx >= 0 ? idx : list.length;
}

function resolveLowerBand(sectionId: string, threshold: number): number {
  const bands: Record<string, number[]> = {
    arousal: [95, 80, 60, 40, 20],
    alert: [100, 80, 60, 40, 20],
    affection: [80, 60, 40, 20],
    obedience: [80, 60, 40, 20],
  };
  const list = bands[sectionId] ?? [];
  if (list.length === 0) return 0;
  const idx = list.findIndex(v => threshold >= v);
  return idx >= 0 ? idx : list.length;
}

function isHighBand(sectionId: string, operator: BehaviorOperator | undefined, threshold: number | undefined, kind: BehaviorBranch['kind']): boolean {
  if (kind === 'else') return true;
  if (!operator || typeof threshold !== 'number' || !Number.isFinite(threshold)) return false;

  if (operator === '>' || operator === '>=') {
    return resolveLowerBand(sectionId, threshold) === 0;
  }

  const upperBand = resolveUpperBand(sectionId, threshold);
  if (sectionId === 'arousal') return upperBand >= 4;
  if (sectionId === 'alert') return upperBand >= 4;
  return upperBand >= 3;
}

function buildDefaultBehaviorBranchObject(
  sectionId: string,
  kind: BehaviorBranch['kind'],
  operator?: BehaviorOperator,
  threshold?: number,
): Record<string, unknown> {
  const high = isHighBand(sectionId, operator, threshold, kind);
  const statusText = buildDefaultStatusText(sectionId, kind, operator, threshold);

  if (sectionId === 'arousal') {
    if (high) {
      return {
        发情状态: {
          表现: [],
          生理反应: [],
          理智残存: '',
          出格行为: [],
        },
      };
    }
    return {
      发情状态: {
        表现: [],
      },
    };
  }

  if (sectionId === 'alert') {
    if (high) {
      return {
        '对{{user}}的态度': {
          状态: statusText,
          行为指导: [],
          敌意表现: [],
          接触禁忌: [],
        },
      };
    }
    return {
      '对{{user}}的态度': {
        状态: statusText,
        行为指导: [],
      },
    };
  }

  if (sectionId === 'affection') {
    if (high) {
      return {
        好感表现: {
          状态: statusText,
          行为指导: [],
          特殊互动: [],
          心理依赖: '',
          允许越界: [],
        },
      };
    }
    return {
      好感表现: {
        状态: statusText,
        行为指导: [],
        变化倾向: [],
      },
    };
  }

  if (high) {
    return {
      服从表现: {
        状态: statusText,
        行为指导: [],
        忠诚表现: [],
        自我认知: '',
        羞耻承受极限: [],
      },
    };
  }

  return {
    服从表现: {
      状态: statusText,
      行为指导: [],
    },
  };
}

function buildDefaultStatusText(
  sectionId: string,
  kind: BehaviorBranch['kind'],
  operator?: BehaviorOperator,
  threshold?: number,
): string {
  const stageIndex = resolveStageIndex(sectionId, kind, operator, threshold);

  if (sectionId === 'alert') {
    const labels = [
      '無警戒',
      '微弱的違和感',
      '低警戒',
      '普通警戒',
      '高警戒',
      '極高警戒',
    ];
    return labels[Math.min(Math.max(stageIndex, 0), labels.length - 1)] ?? labels[0];
  }

  if (sectionId === 'affection') {
    const labels = [
      '低好感度',
      '中低好感度',
      '普通好感度',
      '高好感度',
      '極高好感度',
    ];
    return labels[Math.min(Math.max(stageIndex, 0), labels.length - 1)] ?? labels[0];
  }

  if (sectionId === 'obedience') {
    const labels = [
      '低服從度',
      '較低服從度',
      '普通服從度',
      '高服從度',
      '極高服從度',
    ];
    return labels[Math.min(Math.max(stageIndex, 0), labels.length - 1)] ?? labels[0];
  }

  return '${狀態描述}';
}

function resolveStageIndex(
  sectionId: string,
  kind: BehaviorBranch['kind'],
  operator?: BehaviorOperator,
  threshold?: number,
): number {
  const boundariesBySection: Record<string, number[]> = {
    alert: [20, 40, 60, 80, 100],
    affection: [20, 40, 60, 80],
    obedience: [20, 40, 60, 80],
  };

  const boundaries = boundariesBySection[sectionId] ?? [];
  if (boundaries.length === 0) return 0;

  if (kind === 'else') return boundaries.length;
  if (!operator || typeof threshold !== 'number' || !Number.isFinite(threshold)) return 0;

  if (operator === '>' || operator === '>=') {
    const reversed = [...boundaries].reverse();
    const idx = reversed.findIndex(v => threshold >= v);
    if (idx < 0) return boundaries.length;
    return Math.max(0, boundaries.length - idx - 1);
  }

  const idx = boundaries.findIndex(v => threshold <= v);
  return idx >= 0 ? idx : boundaries.length;
}

export function buildDefaultBehaviorBranchNodes(
  sectionId: string,
  kind: BehaviorBranch['kind'],
  operator?: BehaviorOperator,
  threshold?: number,
): { nodes: EditorNode[]; yamlRaw: string } {
  const obj = buildDefaultBehaviorBranchObject(sectionId, kind, operator, threshold);
  return {
    nodes: yamlToTree(obj),
    yamlRaw: YAML.stringify(obj, { lineWidth: 0 }).trimEnd(),
  };
}

/**
 * 將分區原始 YAML 解析為樹狀節點（供原始碼模式切回解析模式）
 */
export function parseSectionYamlToNodes(sectionId: string, raw: string): EditorNode[] {
  const text = raw.trim();
  if (!text) return [];
  const parsed = YAML.parse(text);
  const lockKeys = new Set(SECTION_LOCKED_KEYS[sectionId] ?? []);
  return yamlToTree(parsed, lockKeys);
}

/**
 * 將樹狀節點序列化為 YAML 字串（供原始碼模式初始化內容）
 */
export function serializeSectionNodesToYaml(nodes: EditorNode[]): string {
  if (!nodes.length) return '';
  return YAML.stringify(treeToYaml(nodes), { lineWidth: 0 }).trimEnd();
}

/**
 * 將行為區原始 EJS+YAML 字串解析為分支列表
 */
export function parseBehaviorBranchesFromRaw(raw: string): BehaviorBranch[] {
  const text = raw.trim();
  if (!text) return [];
  const parsed = parseEjsBranches(text);
  return sortBehaviorBranches(parsed);
}

/**
 * 將行為分支序列化回 EJS+YAML 字串
 */
export function serializeBehaviorBranches(sectionId: string, branches: BehaviorBranch[], charName: string): string {
  if (!branches.length) return '';
  return rebuildBehaviorSection(sectionId, branches, charName);
}

function ensureDefaultGlobalSection(sectionData: Record<string, EditorNode[]>, rawFallbacks: Record<string, string>): void {
  if (rawFallbacks.global) return;
  if ((sectionData.global ?? []).length > 0) return;
  sectionData.global = buildDefaultGlobalRulesNodes();
}

function compareOperatorForLess(a: '<' | '<=' | '>' | '>=' | '==', b: '<' | '<=' | '>' | '>=' | '=='): number {
  const rank: Record<string, number> = { '<': 0, '<=': 1 };
  return (rank[a] ?? 99) - (rank[b] ?? 99);
}

function compareOperatorForGreater(a: '<' | '<=' | '>' | '>=' | '==', b: '<' | '<=' | '>' | '>=' | '=='): number {
  const rank: Record<string, number> = { '>': 0, '>=': 1 };
  return (rank[a] ?? 99) - (rank[b] ?? 99);
}

/**
 * 將 EJS 行為分支自動整理成穩定順序，避免條件鏈死區：
 * - if 永遠第一條
 * - else 永遠最後一條（最多保留一條）
 * - == 條件優先，再來 < / <=（由小到大），最後 > / >=（由大到小）
 */
export function sortBehaviorBranches(branches: BehaviorBranch[]): BehaviorBranch[] {
  if (branches.length <= 1) return branches;

  const decorated = branches.map((b, index) => ({ b, index }));
  const elseBranch = decorated.find(x => x.b.kind === 'else')?.b;
  const nonElse = decorated
    .filter(x => x.b.kind !== 'else')
    .sort((x, y) => {
      const a = x.b;
      const b = y.b;
      const aValid = !!a.operator && typeof a.threshold === 'number' && Number.isFinite(a.threshold);
      const bValid = !!b.operator && typeof b.threshold === 'number' && Number.isFinite(b.threshold);
      if (!aValid && !bValid) return x.index - y.index;
      if (!aValid) return 1;
      if (!bValid) return -1;

      const aOp = a.operator!;
      const bOp = b.operator!;
      const aTh = a.threshold!;
      const bTh = b.threshold!;

      const group = (op: '<' | '<=' | '>' | '>=' | '=='): number => {
        if (op === '==') return 0;
        if (op === '<' || op === '<=') return 1;
        if (op === '>' || op === '>=') return 2;
        return 9;
      };

      const gDiff = group(aOp) - group(bOp);
      if (gDiff !== 0) return gDiff;

      if (aOp === '==' && bOp === '==') {
        const tDiff = aTh - bTh;
        return tDiff !== 0 ? tDiff : x.index - y.index;
      }

      if ((aOp === '<' || aOp === '<=') && (bOp === '<' || bOp === '<=')) {
        const tDiff = aTh - bTh;
        if (tDiff !== 0) return tDiff;
        const oDiff = compareOperatorForLess(aOp, bOp);
        return oDiff !== 0 ? oDiff : x.index - y.index;
      }

      if ((aOp === '>' || aOp === '>=') && (bOp === '>' || bOp === '>=')) {
        const tDiff = bTh - aTh;
        if (tDiff !== 0) return tDiff;
        const oDiff = compareOperatorForGreater(aOp, bOp);
        return oDiff !== 0 ? oDiff : x.index - y.index;
      }

      return x.index - y.index;
    })
    .map(x => x.b);

  const normalizedNonElse = nonElse.map((b, idx) => ({
    ...b,
    kind: idx === 0 ? 'if' : 'else_if',
  }));

  if (elseBranch) {
    return [...normalizedNonElse, { ...elseBranch, kind: 'else' }];
  }
  return normalizedNonElse;
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
    // 1. 取得世界書
    const charWb = getCharWorldbookNames('current');
    const wbName = charWb.primary;
    if (!wbName) {
      console.warn('[HypnoOS] characterDataService: 角色卡未綁定世界書');
      ensureDefaultGlobalSection(sectionData, rawFallbacks);
      return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
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
      ensureDefaultGlobalSection(sectionData, rawFallbacks);
      return { sectionData, rawFallbacks, behaviorData, entryUid, rawContent };
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
      // 行為指導包含 EJS，先 Regex 分段再 YAML 解析
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
 * 解析行為指導區段（EJS 混合 YAML）
 */
function parseBehaviorSection(
  rawText: string,
  sectionData: Record<string, EditorNode[]>,
  rawFallbacks: Record<string, string>,
  behaviorData: Record<string, BehaviorBranch[]>,
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

function parseEjsBranches(sectionRaw: string): BehaviorBranch[] {
  const openTagRe = /<%[_-]?\s*}?\s*(if|else\s+if|else)\s*(?:\(([\s\S]*?)\))?\s*\{\s*[_-]?%>/gm;
  const closeTagRe = /<%[_-]?\s*}\s*[_-]?%>/gm;

  const closeMatches = Array.from(sectionRaw.matchAll(closeTagRe));
  const finalClose = closeMatches.length > 0 ? closeMatches[closeMatches.length - 1] : null;
  const chainEnd = finalClose ? finalClose.index ?? sectionRaw.length : sectionRaw.length;

  const openMatches = Array.from(sectionRaw.matchAll(openTagRe));
  if (openMatches.length === 0) return [];

  const branches: BehaviorBranch[] = [];

  for (let i = 0; i < openMatches.length; i += 1) {
    const m = openMatches[i];
    const openStart = m.index ?? 0;
    const openTagRaw = m[0];
    const kindRaw = (m[1] ?? '').replaceAll(/\s+/g, ' ').trim();
    const conditionRaw = (m[2] ?? '').trim();
    const kind = normalizeBranchKind(kindRaw);
    const parsedCond = parseBranchCondition(conditionRaw);
    const contentStart = openStart + openTagRaw.length;
    const contentEnd = i + 1 < openMatches.length
      ? (openMatches[i + 1].index ?? chainEnd)
      : chainEnd;

    const yamlRaw = sectionRaw.slice(contentStart, contentEnd).trim();
    const branchId = deriveBranchId(kind, conditionRaw, i);
    const label = buildBranchLabel(kind, parsedCond.operator, parsedCond.threshold, i);

    try {
      const parsed = YAML.parse(yamlRaw);
      branches.push({
        branchId,
        label,
        kind,
        operator: parsedCond.operator,
        threshold: parsedCond.threshold,
        subjectExpr: parsedCond.subjectExpr,
        conditionRaw,
        openTagRaw,
        yamlRaw,
        nodes: yamlToTree(parsed),
      });
    } catch (err) {
      branches.push({
        branchId,
        label,
        kind,
        operator: parsedCond.operator,
        threshold: parsedCond.threshold,
        subjectExpr: parsedCond.subjectExpr,
        conditionRaw,
        openTagRaw,
        yamlRaw,
        nodes: null,
        parseError: err instanceof Error ? err.message : 'YAML parse error',
      });
    }
  }

  return branches;
}

function deriveBranchId(kind: string, conditionRaw: string, idx: number): string {
  if (kind === 'else') return 'else';

  const compact = conditionRaw.replaceAll(/\s+/g, ' ');
  const cmp = compact.match(/(<=|>=|<|>|==)\s*(-?\d+(?:\.\d+)?)/);
  if (cmp) {
    const op = cmp[1] === '==' ? '=' : cmp[1];
    return `${op}${cmp[2]}`;
  }
  return `cond_${idx + 1}`;
}

function normalizeBranchKind(kindRaw: string): 'if' | 'else_if' | 'else' {
  if (kindRaw === 'if') return 'if';
  if (kindRaw === 'else if') return 'else_if';
  return 'else';
}

function parseBranchCondition(conditionRaw: string): {
  operator?: '<' | '<=' | '>' | '>=' | '==';
  threshold?: number;
  subjectExpr?: string;
} {
  const trimmed = conditionRaw.trim();
  if (!trimmed) return {};
  const m = trimmed.match(/^(.*?)(<=|>=|<|>|==)\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return {};
  const operator = m[2] as '<' | '<=' | '>' | '>=' | '==';
  const threshold = Number(m[3]);
  return {
    operator,
    threshold: Number.isFinite(threshold) ? threshold : undefined,
    subjectExpr: m[1].trim() || undefined,
  };
}

function buildBranchLabel(
  kind: 'if' | 'else_if' | 'else',
  operator?: '<' | '<=' | '>' | '>=' | '==',
  threshold?: number,
  idx = 0,
): string {
  if (kind === 'else') return 'else';
  if (operator !== undefined && typeof threshold === 'number') {
    const op = operator === '==' ? '=' : operator;
    return `${op}${threshold}`;
  }
  return kind === 'if' ? `if_${idx + 1}` : `elseif_${idx + 1}`;
}

function buildBranchCondition(branch: BehaviorBranch, sectionId: string, charName: string): string {
  if (branch.kind === 'else') return '';
  if (branch.operator && typeof branch.threshold === 'number') {
    const subject = normalizeSubjectExpr(sectionId, branch.subjectExpr, charName);
    return `${subject} ${branch.operator} ${branch.threshold}`;
  }
  return branch.conditionRaw || `${buildDefaultSubjectExpr(sectionId, charName)} < 0`;
}

function buildDefaultSubjectExpr(sectionId: string, charName: string): string {
  const safeName = charName || '角色名';
  const map: Record<string, string> = {
    arousal: `getvar('stat_data.角色.${safeName}.发情值')`,
    alert: `getvar('stat_data.角色.${safeName}.警戒度')`,
    affection: `getvar('stat_data.角色.${safeName}.好感度')`,
    obedience: `getvar('stat_data.角色.${safeName}.服从度')`,
  };
  return map[sectionId] ?? `getvar('stat_data.角色.${safeName}.数值')`;
}

function normalizeSubjectExpr(sectionId: string, subjectExpr: string | undefined, charName: string): string {
  const defaultExpr = buildDefaultSubjectExpr(sectionId, charName);
  const expr = (subjectExpr ?? '').trim();
  if (!expr) return defaultExpr;

  // 合法形式：getvar('...') / getvar("...")
  if (/^getvar\((['"]).+?\1\)$/.test(expr)) {
    return expr;
  }

  // 舊版 UI 會輸出裸中文變數，儲存時自動升級成 getvar(...)。
  const legacyAliases: Record<string, string[]> = {
    arousal: ['性欲', '性慾', '发情值', '發情值'],
    alert: ['警戒度'],
    affection: ['好感度'],
    obedience: ['服从度', '服從度'],
  };
  if ((legacyAliases[sectionId] ?? []).includes(expr)) {
    return defaultExpr;
  }

  // 其他裸變數（如 abc）視為無效：交給 validate 擋下
  if (/^[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*$/.test(expr)) {
    return '';
  }

  // 其他複雜表達式先保留（例如玩家手動輸入函式）
  return expr;
}

export function validateBehaviorBranches(
  sectionId: string,
  branches: BehaviorBranch[],
  charName = '',
): { ok: true } | { ok: false; message: string } {
  const ordered = sortBehaviorBranches(branches);

  if (ordered.length === 0) {
    return { ok: false, message: `分區「${sectionId}」至少需要 1 條分支` };
  }

  if (ordered[0].kind !== 'if') {
    return { ok: false, message: `分區「${sectionId}」第一條分支必須是 if` };
  }

  const elseIndexes = ordered
    .map((b, idx) => ({ b, idx }))
    .filter(({ b }) => b.kind === 'else')
    .map(({ idx }) => idx);

  if (elseIndexes.length > 1) {
    return { ok: false, message: `分區「${sectionId}」只能有一條 else 分支` };
  }

  if (elseIndexes.length === 1 && elseIndexes[0] !== ordered.length - 1) {
    return { ok: false, message: `分區「${sectionId}」的 else 分支必須在最後` };
  }

  for (const b of ordered) {
    if (b.kind === 'else') continue;
    if (!b.operator || typeof b.threshold !== 'number' || !Number.isFinite(b.threshold)) {
      return { ok: false, message: `分區「${sectionId}」存在未設定完整條件的分支（${b.label}）` };
    }
    const normalizedSubject = normalizeSubjectExpr(sectionId, b.subjectExpr, charName);
    if (!normalizedSubject) {
      return { ok: false, message: `分區「${sectionId}」存在不合法的條件變數（${b.label}），請使用 getvar('...')` };
    }
  }

  return { ok: true };
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
      const branches = behaviorData[secId];
      if (branches && branches.length > 0) {
        const validation = validateBehaviorBranches(secId, branches, charName);
        if (!validation.ok) {
          throw new Error(validation.message);
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
      let updated = false;
      await updateWorldbookWith(wbName, worldbook => {
        return worldbook.map((entry: any) => {
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

function rebuildBehaviorSection(sectionId: string, branches: BehaviorBranch[], charName: string): string {
  const ordered = sortBehaviorBranches(branches);
  const lines: string[] = [];
  ordered.forEach((branch, idx) => {
    if (branch.kind === 'if') {
      const cond = buildBranchCondition(branch, sectionId, charName);
      lines.push(`<%_ if (${cond}) { _%>`);
    } else if (branch.kind === 'else_if') {
      const cond = buildBranchCondition(branch, sectionId, charName);
      lines.push(`<%_ } else if (${cond}) { _%>`);
    } else {
      lines.push('<%_ } else { _%>');
    }

    if (branch.nodes && !branch.parseError) {
      const yaml = YAML.stringify(treeToYaml(branch.nodes), { lineWidth: 0 }).trimEnd();
      lines.push(yaml);
    } else {
      lines.push(branch.yamlRaw.trimEnd());
    }
    if (idx < ordered.length - 1) lines.push('');
  });
  lines.push('<%_ } _%>');
  return lines.join('\n');
}
