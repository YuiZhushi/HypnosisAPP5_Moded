import { CharacterCompletionAppDiffProposal, CharacterCompletionAppReviewDecision, CharacterCompletionAppApplyResult, EditorNode } from '../types';
import { yamlToTree } from './characterDataService';

export const CharacterCompletionAppMergeService = {
  /**
   * Applies accepted proposals to an EditorNode tree. Returns a mutated clone of the tree.
   */
  characterCompletionAppApplyApprovedProposals(
    proposals: CharacterCompletionAppDiffProposal[],
    decisions: Record<string, CharacterCompletionAppReviewDecision>,
    originalNodes: EditorNode[]
  ): { nodes: EditorNode[]; stats: CharacterCompletionAppApplyResult } {
    const clonedNodes = JSON.parse(JSON.stringify(originalNodes)) as EditorNode[];
    const resultStats: CharacterCompletionAppApplyResult = {
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
        resultStats.rejectedCount++;
        continue;
      }

      const success = applyProposalToTree(clonedNodes, proposal);
      if (success) {
        resultStats.appliedCount++;
        sectionsUpdated.add(proposal.sectionId);
      } else {
        resultStats.conflictCount++;
      }
    }

    resultStats.updatedSections = Array.from(sectionsUpdated);

    return { nodes: clonedNodes, stats: resultStats };
  },

  characterCompletionAppSummarizeApplyResult(stats: CharacterCompletionAppApplyResult): string {
    if (stats.appliedCount === 0) {
      return `未套用任何變更 (拒絕 ${stats.rejectedCount} 項)`;
    }
    return `成功套用 ${stats.appliedCount} 項變更！(拒絕 ${stats.rejectedCount} 項, 錯誤 ${stats.conflictCount} 項)`;
  }
};

/**
 * Mutates the tree by applying the proposal. Returns true if successful.
 */
function applyProposalToTree(tree: EditorNode[], proposal: CharacterCompletionAppDiffProposal): boolean {
  if (proposal.path.length === 0) return false;

  const targetPath = [...proposal.path];
  const leafKeyOrArrayMark = targetPath.pop()!;
  
  // Navigate to parent node
  let currentList = tree;
  let parentNode: EditorNode | null = null;

  for (const step of targetPath) {
    const found = currentList.find(n => n.key === step);
    if (!found) return false; // Parent path not found!
    if (found.type === 'string') return false; // Parent is not an object or list!
    
    currentList = found.children;
    parentNode = found;
  }

  // Handle List Addition
  if (leafKeyOrArrayMark.startsWith('[新增項目 #')) {
    if (parentNode && parentNode.type !== 'list') return false;
    
    // Clean up empty placeholder items before adding real content
    // If the list only has empty-string children, remove them first
    const allEmpty = currentList.length > 0 && currentList.every(
      n => n.type === 'string' && (!n.value || n.value.trim() === '')
    );
    if (allEmpty) {
      currentList.length = 0;
    }
    
    const newItemsNodes = yamlToTree([proposal.newValue]);
    if (newItemsNodes.length > 0) {
      const newNode = newItemsNodes[0];
      delete newNode.key;
      currentList.push(newNode);
    }
    return true;
  }

  // Handle Object Field (Add or Update or Empty Rejected)
  const targetNode = currentList.find(n => n.key === leafKeyOrArrayMark);

  if (proposal.changeType === 'add') {
    if (targetNode) return false; // Target already exists, shouldn't be 'add'
    
    // Create new node using yamlToTree
    const newNodes = yamlToTree({ [leafKeyOrArrayMark]: proposal.newValue });
    if (newNodes.length > 0) {
      currentList.push(newNodes[0]);
      return true;
    }
    return false;
  }

  if (proposal.changeType === 'update' || proposal.changeType === 'empty_rejected') {
    if (!targetNode) return false; // Cannot update missing node
    if (targetNode.type !== 'string') return false; // Update only supports primitive replacements in basic diff

    targetNode.value = String(proposal.newValue ?? '');
    return true;
  }

  if (proposal.changeType === 'type_conflict') {
    // Replace the entire node
    const idx = currentList.findIndex(n => n.id === targetNode?.id);
    if (idx < 0) return false;
    
    const newNodes = yamlToTree({ [leafKeyOrArrayMark]: proposal.newValue });
    if (newNodes.length > 0) {
      // Maintain ID if possible? Maybe not needed as it's a structural replacement
      const replacement = newNodes[0];
      // Note: retaining old isLocked state might be important
      replacement.isLocked = targetNode?.isLocked ?? false;
      
      currentList[idx] = replacement;
      return true;
    }
    return false;
  }

  return false;
}
