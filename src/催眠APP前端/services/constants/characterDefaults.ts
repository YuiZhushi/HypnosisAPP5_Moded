import { EditorNode } from '../../types';
import { yamlToTree } from '../helpers/astYamlHelper';
import YAML from 'yaml';

/** 人設區段的 YAML key → section id 映射 */
export const DATA_KEY_TO_SECTION: Record<string, string> = {
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
export const SECTION_LOCKED_KEYS: Record<string, string[]> = {
  info: ['title', 'gender', 'age', 'identity'],
  social: ['social_connection'],
  personality: ['personality', 'habit', 'hidden_behavior'],
  appearance: ['appearance'],
  fetish: ['sexual_preference', 'weakness'],
};

export function createDefaultGlobalRulesObject(): Record<string, unknown> {
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

type BehaviorOperator = '<' | '<=' | '>' | '>=' | '==';

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

function isHighBand(sectionId: string, operator: BehaviorOperator | undefined, threshold: number | undefined, kind: 'if' | 'else_if' | 'else'): boolean {
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
  kind: 'if' | 'else_if' | 'else',
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
  kind: 'if' | 'else_if' | 'else',
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
  kind: 'if' | 'else_if' | 'else',
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
  kind: 'if' | 'else_if' | 'else',
  operator?: BehaviorOperator,
  threshold?: number,
): { nodes: EditorNode[]; yamlRaw: string } {
  const obj = buildDefaultBehaviorBranchObject(sectionId, kind, operator, threshold);
  return {
    nodes: yamlToTree(obj),
    yamlRaw: YAML.stringify(obj, { lineWidth: 0 }).trimEnd(),
  };
}
