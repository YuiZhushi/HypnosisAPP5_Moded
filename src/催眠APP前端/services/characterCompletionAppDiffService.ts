import { CharacterCompletionAppDiffProposal, EditorNode } from '../types';

let _diffCounter = 0;
function nextDiffId(): string {
  return `diff_${Date.now()}_${++_diffCounter}`;
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
        const oldNode = oldMap.get(key);
        const path = [...currentPath, key];

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
