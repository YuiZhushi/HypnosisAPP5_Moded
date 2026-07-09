/**
 * Character Editor APP 後端 — AST Diff 引擎
 *
 * 從 helpers/astDiffService.ts 遷移。
 * 遞迴比較新舊 EditorNode 樹，產生 AstDiffProposal 列表。
 * 支援 SillyTavern 巨集（如 {{user}}）的模糊匹配。
 */

import type { AstDiffProposal, EditorNode } from '../../constants/interfaces';

// ====== ID 生成 ======

let _diffCounter = 0;
function nextDiffId(): string {
  return `diff_${Date.now()}_${++_diffCounter}`;
}

// ====== 巨集模糊匹配 ======

/**
 * 嘗試在 oldMap 中找到與 newKey 匹配的節點。
 * 先做精確匹配，失敗則嘗試巨集模糊匹配。
 * e.g. oldKey='对{{user}}的态度', newKey='对小明的态度' → 匹配成功
 */
function findOldNodeFuzzy(
  oldMap: Map<string, EditorNode>,
  newKey: string,
): { node: EditorNode; originalKey: string } | null {
  // 精確匹配
  const direct = oldMap.get(newKey);
  if (direct) return { node: direct, originalKey: newKey };

  // 巨集模糊匹配
  for (const [oldKey, oldNode] of oldMap.entries()) {
    if (!oldKey.includes('{{')) continue;
    const segments = oldKey.split(/\{\{[^}]+\}\}/);
    let pos = 0;
    let allFound = true;
    for (const seg of segments) {
      if (!seg) continue;
      const idx = newKey.indexOf(seg, pos);
      if (idx < 0) {
        allFound = false;
        break;
      }
      pos = idx + seg.length;
    }
    if (allFound && segments.some(s => s.length > 0)) {
      return { node: oldNode, originalKey: oldKey };
    }
  }
  return null;
}

// ====== 值提取 ======

function extractValue(node: EditorNode): unknown {
  if (node.type === 'string') return node.value;
  if (node.type === 'list') return node.children.map(extractValue);
  const obj: Record<string, unknown> = {};
  for (const c of node.children) {
    if (c.key) obj[c.key] = extractValue(c);
  }
  return obj;
}

// ====== 公開 API ======

/**
 * 遞迴比較新舊 EditorNode 樹，產生 diff proposals。
 * 每個 proposal 包含變更類型（add / update / empty_rejected / type_conflict）、
 * 路徑、新舊值、預設決策等。
 */
export function buildDiffProposals(
  oldNodes: EditorNode[],
  newNodes: EditorNode[],
  sectionId: string,
  branchId?: string,
): AstDiffProposal[] {
  const proposals: AstDiffProposal[] = [];

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

    // 比較具名節點
    for (const [key, newNode] of newMap.entries()) {
      const fuzzyResult = findOldNodeFuzzy(oldMap, key);
      const oldNode = fuzzyResult?.node ?? null;
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
      } else if (oldNode.type !== newNode.type) {
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
        // 遞迴比較子節點
        compareLevel(oldNode.children, newNode.children, path);
      }
    }

    // 比較匿名項目（列表元素）
    if (newUnnamed.length > 0) {
      const oldValues = new Set(oldUnnamed.map(n => JSON.stringify(extractValue(n))));
      for (let i = 0; i < newUnnamed.length; i++) {
        const valStr = JSON.stringify(extractValue(newUnnamed[i]));
        if (!oldValues.has(valStr)) {
          proposals.push({
            id: nextDiffId(),
            sectionId,
            branchId,
            path: [...currentPath, `[新增項目 #${i + 1}]`],
            changeType: 'add',
            oldValue: undefined,
            newValue: extractValue(newUnnamed[i]),
            defaultDecision: 'reject',
            reason: '新增了陣列項目',
          });
        }
      }
    }
  }

  compareLevel(oldNodes, newNodes, []);
  return proposals;
}
