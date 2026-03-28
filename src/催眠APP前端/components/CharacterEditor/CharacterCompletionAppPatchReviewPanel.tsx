import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Check, X, CheckSquare, Settings, ArrowRight, CornerDownRight, Box, ChevronRight, ChevronDown } from 'lucide-react';
import YAML from 'yaml';
import { 
  CharacterCompletionAppAiPatchResult, 
  CharacterCompletionAppDiffProposal, 
  CharacterCompletionAppReviewDecision,
  CharacterCompletionAppApplyResult,
  EditorNode,
  EDITOR_SECTIONS
} from '../../types';
import { CharacterCompletionAppDiffService } from '../../services/characterCompletionAppDiffService';
import { CharacterCompletionAppMergeService } from '../../services/characterCompletionAppMergeService';
import { yamlToTree } from '../../services/characterDataService';
import type { BehaviorBranch } from '../../services/characterDataService';

interface CharacterCompletionAppPatchReviewPanelProps {
  mode: 'current' | 'all';
  activeTab: string;
  activeBranchId?: string;
  patchResult: CharacterCompletionAppAiPatchResult;
  mainSectionData: Record<string, EditorNode[]>;
  mainBehaviorData: Record<string, BehaviorBranch[]>;
  onClose: () => void;
  onApply: (
    applyResult: CharacterCompletionAppApplyResult, 
    newSectionData: Record<string, EditorNode[]>, 
    newBehaviorData: Record<string, BehaviorBranch[]>
  ) => void;
}

export const CharacterCompletionAppPatchReviewPanel: React.FC<CharacterCompletionAppPatchReviewPanelProps> = ({
  mode,
  activeTab,
  activeBranchId,
  patchResult,
  mainSectionData,
  mainBehaviorData,
  onClose,
  onApply
}) => {
  const [proposals, setProposals] = useState<CharacterCompletionAppDiffProposal[]>([]);
  const [decisions, setDecisions] = useState<Record<string, CharacterCompletionAppReviewDecision>>({});
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // ===== Parser & Differ =====
  useEffect(() => {
    let newProposals: CharacterCompletionAppDiffProposal[] = [];

    const isBehavior = EDITOR_SECTIONS.find(s => s.id === activeTab)?.category === 'behavior';

    try {
      if (mode === 'current') {
        if (!isBehavior) {
          const parsed = YAML.parse(patchResult.yamlRaw || '{}');
          const newNodes = yamlToTree(parsed);
          const oldNodes = mainSectionData[activeTab] || [];
          newProposals = CharacterCompletionAppDiffService.characterCompletionAppBuildDiffProposals(oldNodes, newNodes, activeTab);
        } else {
          const parsed = YAML.parse(patchResult.ejsRaw || patchResult.yamlRaw || '{}');
          const newNodes = yamlToTree(parsed);
          const currentBranches = mainBehaviorData[activeTab] || [];
          const activeBranch = currentBranches.find(b => b.branchId === activeBranchId) || currentBranches[0];
          const oldNodes = activeBranch?.nodes || [];
          newProposals = CharacterCompletionAppDiffService.characterCompletionAppBuildDiffProposals(oldNodes, newNodes, activeTab, activeBranchId);
        }
      } else {
        // all mode - Best effort Data Sections mapping
        const parsed = YAML.parse(patchResult.yamlRaw || '{}');
        const DATA_KEY_TO_SECTION: Record<string, string> = {
          title: 'info', gender: 'info', age: 'info', identity: 'info',
          social_connection: 'social', personality: 'personality', habit: 'personality',
          hidden_behavior: 'personality', appearance: 'appearance', sexual_preference: 'fetish',
          weakness: 'fetish',
        };

        const sectionTempData: Record<string, any> = {};
        for (const [k, v] of Object.entries((parsed || {}) as any)) {
          let sec = DATA_KEY_TO_SECTION[k];
          if (!sec) {
            // Check if key is a section name
            const sDef = EDITOR_SECTIONS.find(s => s.id === k || s.name === k);
            if (sDef) {
              sec = sDef.id;
              if (typeof v === 'object' && v !== null) {
                for (const [ik, iv] of Object.entries(v as any)) {
                  sectionTempData[sec] = sectionTempData[sec] || {};
                  sectionTempData[sec][ik] = iv;
                }
                continue;
              }
            } else {
              sec = 'info'; // Fallback
            }
          }
          sectionTempData[sec] = sectionTempData[sec] || {};
          sectionTempData[sec][k] = v;
        }

        for (const [secId, dataObj] of Object.entries(sectionTempData)) {
          const newNodes = yamlToTree(dataObj);
          const oldNodes = mainSectionData[secId] || [];
          const p = CharacterCompletionAppDiffService.characterCompletionAppBuildDiffProposals(oldNodes, newNodes, secId);
          newProposals = newProposals.concat(p);
        }
      }

      setProposals(newProposals);
      
      // Initialize decisions
      const initDecisions: Record<string, CharacterCompletionAppReviewDecision> = {};
      for (const p of newProposals) {
         initDecisions[p.id] = p.defaultDecision;
      }
      setDecisions(initDecisions);

    } catch(e) {
      console.error('[HypnoOS] AiPatchReview: Parse error', e);
      // Just set empty
      setProposals([]);
    }
  }, [patchResult, mode, activeTab, activeBranchId, mainSectionData, mainBehaviorData]);

  // ===== Handlers =====
  const toggleDecision = (id: string, decision?: CharacterCompletionAppReviewDecision) => {
    setDecisions(prev => ({
      ...prev,
      [id]: decision || (prev[id] === 'accept' ? 'reject' : 'accept')
    }));
  };

  const setGroupDecision = (pathPrefix: string, decision: CharacterCompletionAppReviewDecision) => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const p of proposals) {
        if (p.path.join('.').startsWith(pathPrefix)) {
          next[p.id] = decision;
        }
      }
      return next;
    });
  };

  const acceptAll = () => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const p of proposals) next[p.id] = 'accept';
      return next;
    });
  };

  const acceptAllAddsOnly = () => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const p of proposals) {
        if (p.changeType === 'add') next[p.id] = 'accept';
      }
      return next;
    });
  };

  const rejectAll = () => {
    setDecisions(prev => {
      const next = { ...prev };
      for (const p of proposals) next[p.id] = 'reject';
      return next;
    });
  };

  const handleApply = useCallback(() => {
    const nextSectionData = { ...mainSectionData };
    const nextBehaviorData = { ...mainBehaviorData };

    const bySectionBranch: Record<string, CharacterCompletionAppDiffProposal[]> = {};
    for (const p of proposals) {
      const key = `${p.sectionId}::${p.branchId || ''}`;
      bySectionBranch[key] = bySectionBranch[key] || [];
      bySectionBranch[key].push(p);
    }

    const globalStats: CharacterCompletionAppApplyResult = {
      appliedCount: 0, rejectedCount: 0, skippedCount: 0, conflictCount: 0, updatedSections: []
    };

    const sectionsUpdated = new Set<string>();

    for (const [ks, ps] of Object.entries(bySectionBranch)) {
      const [secId, brId] = ks.split('::');
      const isBehavior = EDITOR_SECTIONS.find(s => s.id === secId)?.category === 'behavior';

      if (!isBehavior) {
        const out = CharacterCompletionAppMergeService.characterCompletionAppApplyApprovedProposals(
          ps, decisions, nextSectionData[secId] || []
        );
        nextSectionData[secId] = out.nodes;
        globalStats.appliedCount += out.stats.appliedCount;
        globalStats.rejectedCount += out.stats.rejectedCount;
        globalStats.conflictCount += out.stats.conflictCount;
        if (out.stats.appliedCount > 0) sectionsUpdated.add(secId);
      } else {
        const branches = nextBehaviorData[secId] || [];
        const bIdx = branches.findIndex(b => b.branchId === brId);
        if (bIdx >= 0) {
          const out = CharacterCompletionAppMergeService.characterCompletionAppApplyApprovedProposals(
            ps, decisions, branches[bIdx].nodes || []
          );
          branches[bIdx] = { ...branches[bIdx], nodes: out.nodes, yamlRaw: '' }; // invalidate yamlRaw
          nextBehaviorData[secId] = branches;
          globalStats.appliedCount += out.stats.appliedCount;
          globalStats.rejectedCount += out.stats.rejectedCount;
          globalStats.conflictCount += out.stats.conflictCount;
          if (out.stats.appliedCount > 0) sectionsUpdated.add(secId);
        }
      }
    }

    globalStats.updatedSections = Array.from(sectionsUpdated);

    onApply(globalStats, nextSectionData, nextBehaviorData);
  }, [proposals, decisions, mainSectionData, mainBehaviorData, onApply]);

  // ===== Tree Grouping =====
  // Group proposals by their parent path for the left tree view
  const treeNodes = useMemo(() => {
    const root: any = { _proposals: [], _children: {} };
    for (const p of proposals) {
      let current = root;
      const fullPath = p.sectionId + '.' + p.path.join('.');
      const steps = [p.sectionId, ...p.path.slice(0, -1)]; // Parent path
      
      for (const step of steps) {
        if (!current._children[step]) current._children[step] = { _proposals: [], _children: {} };
        current = current._children[step];
      }
      current._proposals.push(p);
    }
    return root;
  }, [proposals]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const n = new Set(prev);
      if (n.has(path)) {
        n.delete(path);
      } else {
        n.add(path);
      }
      return n;
    });
  };

  const renderTree = (node: any, pathParts: string[] = [], level = 0) => {
    return Object.entries(node._children).map(([k, child]: [string, any]) => {
      const pPath = [...pathParts, k];
      const pString = pPath.join('.');
      const isExpanded = expandedPaths.has(pString) || level < 1; // Auto expand level 0

      // Calculate stats for this subtree
      let total = 0, accepted = 0;
      const walk = (n: any) => {
        n._proposals.forEach((p: any) => {
          total++;
          if (decisions[p.id] === 'accept') accepted++;
        });
        Object.values(n._children).forEach(walk);
      };
      walk(child);

      if (total === 0) return null;

      return (
        <div key={pString} className="flex flex-col">
          <div 
            className={`flex items-center gap-1.5 px-2 py-1 hover:bg-neutral-800/50 cursor-pointer rounded text-[11px] ${selectedPath === pString ? 'bg-indigo-900/30 text-indigo-300' : 'text-neutral-400'}`}
            style={{ paddingLeft: `${ level * 12 + 8 }px` }}
          >
            <div onClick={(e) => { e.stopPropagation(); toggleExpand(pString); }} className="w-4 h-4 flex items-center justify-center hover:bg-neutral-700 rounded text-neutral-500">
               {Object.keys(child._children).length > 0 ? (isExpanded ? <ChevronDown size={12}/> : <ChevronRight size={12}/>) : <span className="w-3" />}
            </div>
            
            <span className="font-mono flex-1 overflow-hidden text-ellipsis whitespace-nowrap" onClick={() => setSelectedPath(selectedPath === pString ? null : pString)}>
              {k}
            </span>
            
            <span className={`text-[9px] px-1.5 rounded-full ${accepted === total ? 'bg-emerald-900/40 text-emerald-400' : accepted > 0 ? 'bg-amber-900/40 text-amber-400' : 'bg-neutral-800 text-neutral-500'}`}>
               {accepted}/{total}
            </span>
            
            <button 
              onClick={(e) => { e.stopPropagation(); setGroupDecision(pString, accepted === total ? 'reject' : 'accept'); }}
              className="ml-1 p-0.5 rounded bg-neutral-800 hover:bg-neutral-700 hover:text-white transition"
              title="一鍵接受/拒絕此群組下所有改變"
            >
              {accepted === total ? <X size={10} className="text-red-400"/> : <Check size={10} className="text-emerald-400"/>}
            </button>
          </div>
          
          {isExpanded && renderTree(child, pPath, level + 1)}
        </div>
      );
    });
  };

  // Filter proposals based on selected path
  const visibleProposals = proposals.filter(p => !selectedPath || (p.sectionId + '.' + p.path.join('.')).startsWith(selectedPath));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="w-full h-full max-w-6xl max-h-[90vh] flex flex-col bg-[#0c0c0c] border border-neutral-800 rounded-xl shadow-2xl overflow-hidden m-4">
        
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-neutral-800 bg-neutral-900/40 shrink-0">
          <div className="flex items-center gap-3">
            <Settings className="text-indigo-400 animate-pulse" size={18} />
            <div>
               <h2 className="text-sm font-bold text-white tracking-wide">AI 補全結果審核</h2>
               <p className="text-[10px] text-neutral-500">（保守審核模式：所有更改預設為拒絕，請手動確認要接受的項目）</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
               onClick={onClose}
               className="text-[11px] px-3 py-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
            >
               放棄變更
            </button>
            <button
               onClick={handleApply}
               disabled={Object.values(decisions).filter(d => d === 'accept').length === 0}
               className="flex items-center gap-1.5 text-[11px] font-bold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white shadow-lg transition"
            >
               完成並套用 <ArrowRight size={14} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-6 py-2 border-b border-neutral-800 bg-neutral-900/20 shrink-0">
           <button onClick={acceptAll} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700 transition">
              <CheckSquare size={12} className="text-emerald-400"/> 全部接受
           </button>
           <button onClick={rejectAll} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700 transition">
              <X size={12} className="text-red-400"/> 全部拒絕
           </button>
           <button onClick={acceptAllAddsOnly} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-white border border-neutral-700 transition">
              <Box size={12} className="text-blue-400"/> 僅接受新增的欄位
           </button>
           <div className="ml-auto text-[10px] text-neutral-500">
              共偵測到 {proposals.length} 項變更，目前接受 {Object.values(decisions).filter(d => d==='accept').length} 項
           </div>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Left Sidebar: Tree */}
          <div className="w-64 border-r border-neutral-800 bg-neutral-900/10 flex flex-col overflow-y-auto dark-scrollbar p-2">
            {!proposals.length && (
              <div className="text-[11px] text-neutral-500 text-center mt-10">（無解析出變更）</div>
            )}
            {renderTree(treeNodes)}
          </div>

          {/* Right Main Area: Cards */}
          <div className="flex-1 bg-[#101010] p-4 overflow-y-auto dark-scrollbar space-y-3">
             {visibleProposals.map(p => {
               const isAccepted = decisions[p.id] === 'accept';
               const pathHeader = p.sectionId + ' > ' + p.path.join(' > ');
               
               let icon = null;
               let bgColor = '';
               let borderColor = '';
               if (p.changeType === 'add') {
                 icon = <span className="text-[10px] font-bold text-emerald-400 bg-emerald-900/30 px-1.5 py-0.5 rounded">ADD</span>;
                 bgColor = isAccepted ? 'bg-emerald-900/10' : 'bg-neutral-900/40';
                 borderColor = isAccepted ? 'border-emerald-800/50' : 'border-neutral-800';
               } else if (p.changeType === 'update') {
                 icon = <span className="text-[10px] font-bold text-blue-400 bg-blue-900/30 px-1.5 py-0.5 rounded">UPD</span>;
                 bgColor = isAccepted ? 'bg-blue-900/10' : 'bg-neutral-900/40';
                 borderColor = isAccepted ? 'border-blue-800/50' : 'border-neutral-800';
               } else {
                 icon = <span className="text-[10px] font-bold text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded">WARN</span>;
                 bgColor = isAccepted ? 'bg-red-900/10' : 'bg-neutral-900/40';
                 borderColor = isAccepted ? 'border-red-800/50' : 'border-neutral-800';
               }

               return (
                 <div key={p.id} className={`flex flex-col rounded-xl border p-3 transition-colors ${bgColor} ${borderColor}`}>
                    
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                       <div className="flex items-center gap-2">
                         {icon}
                         <span className="font-mono text-[11px] text-neutral-300">{pathHeader}</span>
                         <span className="text-[10px] text-neutral-500 hidden sm:inline-block">({p.reason})</span>
                       </div>
                       
                       {/* Toggle */}
                       <div className="flex items-center gap-2 bg-black/40 rounded-lg p-1">
                          <button 
                            onClick={() => toggleDecision(p.id, 'reject')}
                            className={`flex items-center justify-center w-6 h-6 rounded-md transition ${!isAccepted ? 'bg-red-500/20 text-red-400' : 'text-neutral-600 hover:bg-neutral-800'}`}
                          >
                            <X size={12}/>
                          </button>
                          <button 
                            onClick={() => toggleDecision(p.id, 'accept')}
                            className={`flex items-center justify-center w-6 h-6 rounded-md transition ${isAccepted ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-600 hover:bg-neutral-800'}`}
                          >
                            <Check size={12}/>
                          </button>
                       </div>
                    </div>

                    {/* Diff Viewer */}
                    <div className="grid grid-cols-2 gap-3 mt-1 text-[11px] font-mono">
                       <div className="flex flex-col bg-[#080808] border border-neutral-800 rounded overflow-hidden">
                          <div className="px-2 py-1 bg-red-900/10 text-red-500 border-b border-neutral-800 flex items-center justify-between">
                            <span>原始資料 (Old)</span>
                          </div>
                          <div className="p-2 text-neutral-500 whitespace-pre-wrap break-all h-full opacity-60">
                             {p.oldValue !== undefined ? JSON.stringify(p.oldValue, null, 2) : <i className="text-neutral-700">(空 / 新增屬性)</i>}
                          </div>
                       </div>
                       <div className="flex flex-col bg-[#051008] border border-[#103015] rounded overflow-hidden">
                          <div className="px-2 py-1 bg-emerald-900/20 text-emerald-500 border-b border-[#103015] flex items-center justify-between">
                            <span>AI 提議 (New)</span>
                            <CornerDownRight size={10} />
                          </div>
                          <div className={`p-2 whitespace-pre-wrap break-all h-full ${isAccepted ? 'text-emerald-300' : 'text-neutral-400'}`}>
                             {JSON.stringify(p.newValue, null, 2)}
                          </div>
                       </div>
                    </div>

                 </div>
               );
             })}
             
             {visibleProposals.length === 0 && (
               <div className="flex flex-col items-center justify-center h-full text-neutral-500 gap-2 opacity-50">
                 <CheckSquare size={32} />
                 <p className="text-xs">請從左側選擇要檢視的分區路徑</p>
               </div>
             )}
          </div>

        </div>

      </div>
    </div>
  );
};
