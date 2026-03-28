import { CharacterCompletionAppDiffProposal, EditorNode } from '../types';

let _diffCounter = 0;
function nextDiffId(): string {
  return `diff_${Date.now()}_${++_diffCounter}`;
}

/**
 * Strip SillyTavern macros like {{user}}, {{char}} etc from a key to enable
 * fuzzy matching against keys where macros have been resolved by the AI.
 * e.g. '对{{user}}的态度' -> '对___的态度' pattern
 */
function stripMacrosFromKey(key: string): string {
  return key.replace(/\{\{[^}]+\}\}/g, '');
}

/** Try to find an old node whose key matches the new key, accounting for macro substitution */
function findOldNodeFuzzy(oldMap: Map<string, EditorNode>, newKey: string): { node: EditorNode; originalKey: string } | null {
  // Direct match first
  const direct = oldMap.get(newKey);
  if (direct) return { node: direct, originalKey: newKey };
  
  // Fuzzy: for each old key containing {{...}}, strip macros and check if the new key
  // contains the same non-macro text segments in the same order
  for (const [oldKey, oldNode] of oldMap.entries()) {
    if (!oldKey.includes('{{')) continue;
    // Split old key by macro placeholders to get text segments
    const segments = oldKey.split(/\{\{[^}]+\}\}/);
    // Check if new key contains all segments in order
    let pos = 0;
    let allFound = true;
    for (const seg of segments) {
      if (!seg) continue; // skip empty segments from leading/trailing macros
      const idx = newKey.indexOf(seg, pos);
      if (idx < 0) { allFound = false; break; }
      pos = idx + seg.length;
    }
    if (allFound && segments.some(s => s.length > 0)) {
      return { node: oldNode, originalKey: oldKey };
    }
  }
  return null;
}

export const CharacterCompletionAppDiffService = {
  /**
   * Recursively compares old and new EditorNode arrays to build a list of diff proposals.
   */
  characterCompletionAppBuildDiffProposals(
    oldNodes: EditorNode[],
    newNodes: EditorNode[],
    sectionId: string,
    branchId?: string
  ): CharacterCompletionAppDiffProposal[] {
    const proposals: CharacterCompletionAppDiffProposal[] = [];

    function extractValue(node: EditorNode): any {
      if (node.type === 'string') return node.value;
      if (node.type === 'list') return node.children.map(extractValue);
      const obj: Record<string, any> = {};
      for (const c of node.children) {
        if (c.key) obj[c.key] = extractValue(c);
      }
      return obj;
    }

    function compareLevel(oldList: EditorNode[], newList: EditorNode[], currentPath: string[]) {
      const oldMap = new Map<string, EditorNode>();
      const oldUnnamed: EditorNode[] = [];

      for (const node of oldList) {
        if (node.key) oldMap.set(node.key, node);
        else oldUnnamed.push(node);
      }

      const newMap = new Map<string, EditorNode>();
      const newUnnamed: EditorNode[] = [];

      for (const node of newList) {
        if (node.key) newMap.set(node.key, node);
        else newUnnamed.push(node);
      }

      // 1. Compare Keyed Objects
      for (const [key, newNode] of newMap.entries()) {
        const fuzzyResult = findOldNodeFuzzy(oldMap, key);
        const oldNode = fuzzyResult?.node ?? null;
        // Use the ORIGINAL key (with macros) for path if fuzzy matched, so merge targets correctly
        const resolvedKey = fuzzyResult?.originalKey ?? key;
        const path = [...currentPath, resolvedKey];

        if (!oldNode) {
          proposals.push({
            id: nextDiffId(),
            sectionId,
            branchId,
            path,
            changeType: 'add',
            oldValue: undefined,
            newValue: extractValue(newNode),
            defaultDecision: 'reject',
            reason: '新增了屬性',
          });
        } else {
          // Compare types
          if (oldNode.type !== newNode.type) {
            proposals.push({
              id: nextDiffId(),
              sectionId,
              branchId,
              path,
              changeType: 'type_conflict',
              oldValue: extractValue(oldNode),
              newValue: extractValue(newNode),
              defaultDecision: 'reject',
              reason: '型別衝突（例如從文字變成陣列）',
            });
          } else if (newNode.type === 'string') {
            if (oldNode.value !== newNode.value) {
              if (!newNode.value && oldNode.value) {
                // AI cleared a value
                proposals.push({
                  id: nextDiffId(),
                  sectionId,
                  branchId,
                  path,
                  changeType: 'empty_rejected',
                  oldValue: oldNode.value,
                  newValue: newNode.value,
                  defaultDecision: 'reject',
                  reason: 'AI 企圖清空原數值',
                });
              } else {
                proposals.push({
                  id: nextDiffId(),
                  sectionId,
                  branchId,
                  path,
                  changeType: 'update',
                  oldValue: oldNode.value,
                  newValue: newNode.value,
                  defaultDecision: 'reject',
                  reason: 'AI 修改了內容',
                });
              }
            }
          } else {
            // Recursive diff for objects and lists
            compareLevel(oldNode.children, newNode.children, path);
          }
        }
      }

      // 2. Compare Unnamed Items (List items)
      if (newUnnamed.length > 0) {
        // Stringify values for simple deduplication
        const oldValues = new Set(oldUnnamed.map((n) => JSON.stringify(extractValue(n))));

        for (let i = 0; i < newUnnamed.length; i++) {
          const newNode = newUnnamed[i];
          const valStr = JSON.stringify(extractValue(newNode));
          if (!oldValues.has(valStr)) {
            proposals.push({
              id: nextDiffId(),
              sectionId,
              branchId,
              // virtual path representing an array addition
              path: [...currentPath, `[新增項目 #${i + 1}]`],
              changeType: 'add',
              oldValue: undefined,
              newValue: extractValue(newNode),
              defaultDecision: 'reject',
              reason: '新增了陣列項目',
            });
          }
        }
      }
    }

    compareLevel(oldNodes, newNodes, []);

    return proposals;
  },
};
