/**
 * Character Editor APP 後端 — AST Merge 引擎
 *
 * 從 helpers/astMergeService.ts 遷移。
 * 將用戶審核過的 AstDiffProposal 套用回 EditorNode 樹。
 */

import type { AstDiffProposal, AstApplyResult, EditorNode } from '../../constants/interfaces';
import type { ReviewDecision } from '../../constants/types';
import { yamlToTree } from './astYamlHelper';

// ====== 公開 API ======

/**
 * 將已審核的 proposals 套用到原始 EditorNode 樹。
 * 返回修改後的樹（深拷貝）及統計結果。
 */
export function applyApprovedProposals(
  proposals: AstDiffProposal[],
  decisions: Record<string, ReviewDecision>,
  originalNodes: EditorNode[],
): { nodes: EditorNode[]; stats: AstApplyResult } {
  const clonedNodes = JSON.parse(JSON.stringify(originalNodes)) as EditorNode[];
  const stats: AstApplyResult = {
    appliedCount: 0,
    rejectedCount: 0,
    skippedCount: 0,
    conflictCount: 0,
    updatedSections: [],
  };

  const sectionsUpdated = new Set<string>();

  for (const proposal of proposals) {
    const decision = decisions[proposal.id] ?? proposal.defaultDecision;
    if (decision !== 'accept') {
      stats.rejectedCount++;
      continue;
    }

    const success = applyProposalToTree(clonedNodes, proposal);
    if (success) {
      stats.appliedCount++;
      sectionsUpdated.add(proposal.sectionId);
    } else {
      stats.conflictCount++;
    }
  }

  stats.updatedSections = Array.from(sectionsUpdated);
  return { nodes: clonedNodes, stats };
}

/** 產生套用結果的摘要文字 */
export function summarizeApplyResult(stats: AstApplyResult): string {
  if (stats.appliedCount === 0) {
    return `未套用任何變更 (拒絕 ${stats.rejectedCount} 項)`;
  }
  return `成功套用 ${stats.appliedCount} 項變更！(拒絕 ${stats.rejectedCount} 項, 錯誤 ${stats.conflictCount} 項)`;
}

// ====== 內部：套用單一 proposal ======

function applyProposalToTree(tree: EditorNode[], proposal: AstDiffProposal): boolean {
  if (proposal.path.length === 0) return false;

  const targetPath = [...proposal.path];
  const leafKeyOrArrayMark = targetPath.pop()!;

  // 導航到父節點
  let currentList = tree;
  let parentNode: EditorNode | null = null;

  for (const step of targetPath) {
    const found = currentList.find(n => n.key === step);
    if (!found) return false;
    if (found.type === 'string') return false;
    currentList = found.children;
    parentNode = found;
  }

  // 處理列表新增
  if (leafKeyOrArrayMark.startsWith('[新增項目 #')) {
    if (parentNode && parentNode.type !== 'list') return false;

    // 清理空白佔位項目
    const allEmpty = currentList.length > 0 && currentList.every(
      n => n.type === 'string' && (!n.value || n.value.trim() === ''),
    );
    if (allEmpty) currentList.length = 0;

    const newItemsNodes = yamlToTree([proposal.newValue]);
    if (newItemsNodes.length > 0) {
      const newNode = newItemsNodes[0];
      delete (newNode as unknown as Record<string, unknown>).key;
      currentList.push(newNode);
    }
    return true;
  }

  // 處理物件欄位（新增/更新/空值拒絕）
  const targetNode = currentList.find(n => n.key === leafKeyOrArrayMark);

  if (proposal.changeType === 'add') {
    if (targetNode) return false;
    const newNodes = yamlToTree({ [leafKeyOrArrayMark]: proposal.newValue });
    if (newNodes.length > 0) {
      currentList.push(newNodes[0]);
      return true;
    }
    return false;
  }

  if (proposal.changeType === 'update' || proposal.changeType === 'empty_rejected') {
    if (!targetNode) return false;
    if (targetNode.type !== 'string') return false;
    targetNode.value = String(proposal.newValue ?? '');
    return true;
  }

  if (proposal.changeType === 'type_conflict') {
    const idx = currentList.findIndex(n => n.id === targetNode?.id);
    if (idx < 0) return false;
    const newNodes = yamlToTree({ [leafKeyOrArrayMark]: proposal.newValue });
    if (newNodes.length > 0) {
      const replacement = newNodes[0];
      replacement.isLocked = targetNode?.isLocked ?? false;
      currentList[idx] = replacement;
      return true;
    }
    return false;
  }

  return false;
}
