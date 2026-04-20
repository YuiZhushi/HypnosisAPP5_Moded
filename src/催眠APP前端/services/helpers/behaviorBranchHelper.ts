import YAML from 'yaml';
import type { EditorNode } from '../../types';
import { yamlToTree, treeToYaml } from './astYamlHelper';

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

export function parseBehaviorBranchesFromRaw(raw: string): BehaviorBranch[] {
  const text = raw.trim();
  if (!text) return [];
  const parsed = parseEjsBranches(text);
  return sortBehaviorBranches(parsed);
}

export function serializeBehaviorBranches(sectionId: string, branches: BehaviorBranch[], charName: string): string {
  if (!branches.length) return '';
  return rebuildBehaviorSection(sectionId, branches, charName);
}

export function parseEjsBranches(sectionRaw: string): BehaviorBranch[] {
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

export function buildBranchCondition(branch: BehaviorBranch, sectionId: string, charName: string): string {
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

  if (/^getvar\((['"]).+?\1\)$/.test(expr)) {
    return expr;
  }

  const legacyAliases: Record<string, string[]> = {
    arousal: ['性欲', '性慾', '发情值', '發情值'],
    alert: ['警戒度'],
    affection: ['好感度'],
    obedience: ['服从度', '服從度'],
  };
  if ((legacyAliases[sectionId] ?? []).includes(expr)) {
    return defaultExpr;
  }

  if (/^[A-Za-z_\u4e00-\u9fff][A-Za-z0-9_\u4e00-\u9fff]*$/.test(expr)) {
    return '';
  }

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

function compareOperatorForLess(a: '<' | '<=' | '>' | '>=' | '==', b: '<' | '<=' | '>' | '>=' | '=='): number {
  const rank: Record<string, number> = { '<': 0, '<=': 1 };
  return (rank[a] ?? 99) - (rank[b] ?? 99);
}

function compareOperatorForGreater(a: '<' | '<=' | '>' | '>=' | '==', b: '<' | '<=' | '>' | '>=' | '=='): number {
  const rank: Record<string, number> = { '>': 0, '>=': 1 };
  return (rank[a] ?? 99) - (rank[b] ?? 99);
}

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

export function rebuildBehaviorSection(sectionId: string, branches: BehaviorBranch[], charName: string): string {
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
