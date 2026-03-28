import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EDITOR_SECTIONS, EditorNode, CharacterCompletionAppAiPatchResult, CharacterCompletionAppApplyResult } from '../../types';
import { MvuBridge } from '../../services/mvuBridge';
import { WorldBookService } from '../../services/worldBookService';
import type { BehaviorBranch } from '../../services/characterDataService';
import {
  buildDefaultBehaviorBranchNodes,
  loadCharacter,
  parseBehaviorBranchesFromRaw,
  parseSectionYamlToNodes,
  saveCharacter,
  serializeBehaviorBranches,
  serializeSectionNodesToYaml,
  sortBehaviorBranches,
  validateBehaviorBranches,
} from '../../services/characterDataService';
import { ArrowLeft, CheckCircle, RotateCcw, Save, Loader2, RefreshCw, Wand2, Sparkles } from 'lucide-react';
import { NodeTree, treeReducer, TreeAction } from './NodeTree';
import { PromptManagerPage } from './PromptManagerPage';
import { CharacterCompletionAppAiRequestModal } from './CharacterCompletionAppAiRequestModal';
import { CharacterCompletionAppPatchReviewPanel } from './CharacterCompletionAppPatchReviewPanel';

// ========= Toast =========

const Toast: React.FC<{ message: string; type: 'success' | 'error' | 'info'; onDone: () => void }> = ({ message, type, onDone }) => {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  const bg = type === 'success' ? 'bg-emerald-600/90' : type === 'error' ? 'bg-red-600/90' : 'bg-indigo-600/90';
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-100 ${bg} text-white text-xs px-4 py-2 rounded-xl shadow-2xl backdrop-blur pointer-events-none animate-pulse`}>
      {message}
    </div>
  );
};


// ========= Main CharacterEditorApp =========

export const CharacterEditorApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const BEHAVIOR_TABS = new Set(['arousal', 'alert', 'affection', 'obedience']);
  const CONDITION_OPERATORS: Array<'<' | '<=' | '>' | '>=' | '=='> = ['<', '<=', '>', '>=', '=='];
  type EditMode = 'parsed' | 'raw';

  const buildBranchLabel = useCallback((branch: BehaviorBranch, idx: number): string => {
    if (branch.kind === 'else') return 'else';
    if (branch.operator && typeof branch.threshold === 'number' && Number.isFinite(branch.threshold)) {
      const op = branch.operator === '==' ? '=' : branch.operator;
      return `${op}${branch.threshold}`;
    }
    return branch.kind === 'if' ? `if_${idx + 1}` : `elseif_${idx + 1}`;
  }, []);

  const normalizeBranchForUi = useCallback((branch: BehaviorBranch, idx: number): BehaviorBranch => ({
    ...branch,
    label: buildBranchLabel(branch, idx),
  }), [buildBranchLabel]);

  // ----- Character List -----
  const [characters, setCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const getDefaultSubjectExpr = useCallback((sectionId: string): string => {
    const safeName = selectedCharacter || '角色名';
    const map: Record<string, string> = {
      arousal: `getvar('stat_data.角色.${safeName}.发情值')`,
      alert: `getvar('stat_data.角色.${safeName}.警戒度')`,
      affection: `getvar('stat_data.角色.${safeName}.好感度')`,
      obedience: `getvar('stat_data.角色.${safeName}.服从度')`,
    };
    return map[sectionId] ?? `getvar('stat_data.角色.${safeName}.数值')`;
  }, [selectedCharacter]);

  // ----- UI State -----
  const [activeTab, setActiveTab] = useState<string>('info');
  const [editModeBySection, setEditModeBySection] = useState<Record<string, EditMode>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [editorView, setEditorView] = useState<'main' | 'prompts'>('main');

  // ----- Data State -----
  const [sectionData, setSectionData] = useState<Record<string, EditorNode[]>>({});
  const [rawFallbacks, setRawFallbacks] = useState<Record<string, string>>({});
  const [rawDraftBySection, setRawDraftBySection] = useState<Record<string, string>>({});
  const [behaviorData, setBehaviorData] = useState<Record<string, BehaviorBranch[]>>({});
  const [activeBehaviorBranchBySection, setActiveBehaviorBranchBySection] = useState<Record<string, string>>({});
  const [entryUid, setEntryUid] = useState<string | null>(null);
  const [worldbookContent, setWorldbookContent] = useState<string>('');

  // ----- AI Patch State -----
  const [aiRequestMode, setAiRequestMode] = useState<'current' | 'all' | null>(null);
  const [patchResult, setPatchResult] = useState<CharacterCompletionAppAiPatchResult | null>(null);

  // ----- Snapshot for reset -----
  const snapshotRef = useRef<{
    sectionData: Record<string, EditorNode[]>;
    rawFallbacks: Record<string, string>;
    behaviorData: Record<string, BehaviorBranch[]>;
  } | null>(null);

  // ----- Tree reducer for current section -----
  const isBehaviorTab = BEHAVIOR_TABS.has(activeTab);
  const currentBranches = useMemo(() => behaviorData[activeTab] ?? [], [behaviorData, activeTab]);
  const activeBranchId = activeBehaviorBranchBySection[activeTab] ?? currentBranches[0]?.branchId ?? '';
  const activeBranch = useMemo(
    () => currentBranches.find(b => b.branchId === activeBranchId) ?? currentBranches[0] ?? null,
    [currentBranches, activeBranchId],
  );

  const currentNodes = useMemo(() => {
    if (isBehaviorTab) return activeBranch?.nodes ?? [];
    return sectionData[activeTab] ?? [];
  }, [isBehaviorTab, activeBranch, sectionData, activeTab]);

  const dispatchTree = useCallback((action: TreeAction) => {
    if (isBehaviorTab) {
      if (!activeBranch) return;
      setBehaviorData(prev => {
        const list = prev[activeTab] ?? [];
        const idx = list.findIndex(b => b.branchId === activeBranch.branchId);
        if (idx < 0) return prev;
        const target = list[idx];
        if (!target.nodes) return prev;
        const nextNodes = treeReducer(target.nodes, action);
        const nextList = [...list];
        nextList[idx] = { ...target, nodes: nextNodes, yamlRaw: '' };
        return { ...prev, [activeTab]: nextList };
      });
      return;
    }

    setSectionData(prev => {
      const nodes = prev[activeTab] ?? [];
      const next = treeReducer(nodes, action);
      return { ...prev, [activeTab]: next };
    });
  }, [isBehaviorTab, activeBranch, activeTab]);

  const activeSection = useMemo(
    () => EDITOR_SECTIONS.find(s => s.id === activeTab) ?? EDITOR_SECTIONS[0],
    [activeTab],
  );
  const currentEditMode = editModeBySection[activeTab] ?? 'parsed';

  const buildCanonicalSectionRaw = useCallback((sectionId: string): string => {
    const rawFallback = rawFallbacks[sectionId];
    if (rawFallback !== undefined) return rawFallback;

    if (BEHAVIOR_TABS.has(sectionId)) {
      const branches = behaviorData[sectionId] ?? [];
      if (branches.length === 0) return '';
      return serializeBehaviorBranches(sectionId, branches, selectedCharacter);
    }

    const nodes = sectionData[sectionId] ?? [];
    if (nodes.length === 0) return '';
    return serializeSectionNodesToYaml(nodes);
  }, [BEHAVIOR_TABS, rawFallbacks, behaviorData, sectionData, selectedCharacter]);

  const getSectionRawText = useCallback((sectionId: string): string => {
    if (rawDraftBySection[sectionId] !== undefined) {
      return rawDraftBySection[sectionId] ?? '';
    }
    return buildCanonicalSectionRaw(sectionId);
  }, [rawDraftBySection, buildCanonicalSectionRaw]);

  const getAllSectionsContent = useCallback(() => {
    return EDITOR_SECTIONS.map(s => `## ${s.name}\n${buildCanonicalSectionRaw(s.id)}`).join('\n\n');
  }, [buildCanonicalSectionRaw]);

  const applyRawSectionToParsed = useCallback((sectionId: string): { ok: boolean; message?: string } => {
    const raw = getSectionRawText(sectionId).trim();

    try {
      if (BEHAVIOR_TABS.has(sectionId)) {
        const parsedBranches = parseBehaviorBranchesFromRaw(raw);
        if (parsedBranches.length === 0) {
          return { ok: false, message: '未解析出任何 EJS 分支，請檢查 if / else if / else 區塊格式' };
        }
        setBehaviorData(prev => {
          const nextList = sortBehaviorBranches(parsedBranches).map((b, idx) => normalizeBranchForUi(b, idx));
          return { ...prev, [sectionId]: nextList };
        });
        setActiveBehaviorBranchBySection(prev => {
          const current = behaviorData[sectionId] ?? [];
          const next = sortBehaviorBranches(parsedBranches);
          const prevId = prev[sectionId];
          const keep = prevId && next.some(b => b.branchId === prevId) ? prevId : next[0]?.branchId ?? '';
          return { ...prev, [sectionId]: keep };
        });
      } else {
        const parsedNodes = parseSectionYamlToNodes(sectionId, raw);
        setSectionData(prev => ({ ...prev, [sectionId]: parsedNodes }));
      }

      setRawFallbacks(prev => {
        if (!(sectionId in prev)) return prev;
        const next = { ...prev };
        delete next[sectionId];
        return next;
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, message: err instanceof Error ? err.message : '解析失敗' };
    }
  }, [BEHAVIOR_TABS, behaviorData, getSectionRawText, normalizeBranchForUi]);

  const toggleCurrentSectionEditMode = useCallback((mode: EditMode) => {
    if (mode === currentEditMode) return;

    if (mode === 'raw') {
      // 切到原始碼模式時，優先以「當前解析資料」重建 raw，確保已改動內容被繼承
      const raw = buildCanonicalSectionRaw(activeTab);
      setRawDraftBySection(prev => ({ ...prev, [activeTab]: raw }));
      setEditModeBySection(prev => ({ ...prev, [activeTab]: 'raw' }));
      return;
    }

    const result = applyRawSectionToParsed(activeTab);
    if (result.ok === false) {
      setToast({ message: `✗ 解析失敗：${result.message}`, type: 'error' });
      return;
    }

    // 套用成功後保留最新 raw draft，避免再次切換時內容回退
    setRawDraftBySection(prev => ({ ...prev, [activeTab]: getSectionRawText(activeTab) }));
    setEditModeBySection(prev => ({ ...prev, [activeTab]: 'parsed' }));
    setToast({ message: '✓ 已套用原始碼並切回解析模式', type: 'success' });
  }, [activeTab, applyRawSectionToParsed, buildCanonicalSectionRaw, currentEditMode, getSectionRawText]);

  // ----- AI Patch Handlers -----
  const openAiRequestModal = useCallback((mode: 'current' | 'all') => {
    console.info(`[HypnoOS][CharacterCompletionApp] Opening AI Request Modal, mode: ${mode}`);
    setAiRequestMode(mode);
  }, []);

  const handleAiRequestSuccess = useCallback((result: CharacterCompletionAppAiPatchResult) => {
    setPatchResult(result);
  }, []);

  const handleAiReviewApply = useCallback((
    applyResult: CharacterCompletionAppApplyResult,
    newSectionData: Record<string, EditorNode[]>,
    newBehaviorData: Record<string, BehaviorBranch[]>
  ) => {
    setSectionData(newSectionData);
    setBehaviorData(newBehaviorData);
    setPatchResult(null);
    setAiRequestMode(null);
    setToast({
      message: `套用成功！修改了 ${applyResult.appliedCount} 個欄位。`,
      type: 'success'
    });
  }, []);

  const updateBehaviorBranches = useCallback((sectionId: string, updater: (list: BehaviorBranch[]) => BehaviorBranch[]) => {
    setBehaviorData(prev => {
      const oldList = prev[sectionId] ?? [];
      const nextList = sortBehaviorBranches(updater(oldList)).map((b, idx) => normalizeBranchForUi(b, idx));
      return { ...prev, [sectionId]: nextList };
    });
  }, [normalizeBranchForUi]);

  const deepClone = <T,>(val: T): T => JSON.parse(JSON.stringify(val));

  const hasUnsavedChanges = useMemo(() => {
    if (!snapshotRef.current) return false;
    return (
      JSON.stringify(sectionData) !== JSON.stringify(snapshotRef.current.sectionData)
      || JSON.stringify(rawFallbacks) !== JSON.stringify(snapshotRef.current.rawFallbacks)
      || JSON.stringify(behaviorData) !== JSON.stringify(snapshotRef.current.behaviorData)
    );
  }, [sectionData, rawFallbacks, behaviorData]);

  const reloadCharacterData = useCallback(async (
    charName: string,
    options?: {
      setGlobalLoading?: boolean;
      preserveActiveBehaviorBranch?: boolean;
      refreshSnapshot?: boolean;
      showNotFoundToast?: boolean;
    },
  ) => {
    const {
      setGlobalLoading = false,
      preserveActiveBehaviorBranch = true,
      refreshSnapshot = true,
      showNotFoundToast = true,
    } = options ?? {};

    const prevActiveBranchBySection = activeBehaviorBranchBySection;

    if (setGlobalLoading) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    console.info(`[HypnoOS] CharacterEditor: 重新載入角色「${charName}」資料`);
    const result = await loadCharacter(charName);
    setSectionData(result.sectionData);
    setRawFallbacks(result.rawFallbacks);
    setRawDraftBySection({});
    setEditModeBySection({});
    setBehaviorData(result.behaviorData);
    setActiveBehaviorBranchBySection(() => {
      const next: Record<string, string> = {};
      for (const [secId, branches] of Object.entries(result.behaviorData)) {
        if (branches.length === 0) continue;
        const prevBranchId = preserveActiveBehaviorBranch ? prevActiveBranchBySection[secId] : undefined;
        const keep = prevBranchId && branches.some(b => b.branchId === prevBranchId)
          ? prevBranchId
          : branches[0].branchId;
        next[secId] = keep;
      }
      return next;
    });
    setEntryUid(result.entryUid);
    setWorldbookContent(result.rawContent || '');

    if (refreshSnapshot) {
      snapshotRef.current = {
        sectionData: deepClone(result.sectionData),
        rawFallbacks: { ...result.rawFallbacks },
        behaviorData: deepClone(result.behaviorData),
      };
    }

    const secCount = Object.keys(result.sectionData).length;
    const rawCount = Object.keys(result.rawFallbacks).length;
    const branchCount = Object.values(result.behaviorData).reduce((sum, arr) => sum + arr.length, 0);
    console.info(`[HypnoOS] CharacterEditor: 重新載入完成 - ${secCount} 個分區有樹資料, ${rawCount} 個分區有原始文字, 行為分支=${branchCount}`);

    if (showNotFoundToast && secCount === 0 && rawCount === 0 && !result.entryUid) {
      setToast({ message: `未找到「${charName}」的世界書條目`, type: 'info' });
    }

    if (setGlobalLoading) {
      setLoading(false);
    } else {
      setRefreshing(false);
    }
  }, [activeBehaviorBranchBySection]);

  // ----- Load character list from MVU -----
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        console.info('[HypnoOS] CharacterEditor: 開始載入角色清單');
        const roles = await MvuBridge.getRoles();
        if (cancelled) return;
        const names = roles ? Object.keys(roles) : [];
        console.info(`[HypnoOS] CharacterEditor: 找到 ${names.length} 個角色`);
        setCharacters(names);
        if (names.length > 0 && !selectedCharacter) {
          setSelectedCharacter(names[0]);
        }
      } catch (err) {
        console.warn('[HypnoOS] CharacterEditor: 載入角色清單失敗', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // ----- Load worldbook data when character changes -----
  useEffect(() => {
    if (!selectedCharacter || selectedCharacter === '__new__') return;
    let cancelled = false;

    const loadData = async () => {
      try {
        await reloadCharacterData(selectedCharacter, {
          setGlobalLoading: true,
          preserveActiveBehaviorBranch: false,
          refreshSnapshot: true,
          showNotFoundToast: true,
        });
        if (cancelled) return;
      } catch (err) {
        console.error('[HypnoOS] CharacterEditor: 載入角色資料失敗', err);
        setToast({ message: '載入失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), type: 'error' });
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [selectedCharacter]);

  // ----- Handlers -----
  const handleCheckWorldbook = async () => {
    if (!selectedCharacter) return;
    console.info(`[HypnoOS] CharacterEditor: 檢查世界書條目「${selectedCharacter}」`);
    try {
      const result = await WorldBookService.checkAndEnsurePlotEntry(selectedCharacter);
      console.info(`[HypnoOS] CharacterEditor: 檢查結果 status=${result.status}`);
      if (result.status === 'pass') {
        setToast({ message: `✓ 條目已存在`, type: 'success' });
      } else if (result.status === 'created') {
        setToast({ message: `✓ 已自動建立條目`, type: 'success' });
        await reloadCharacterData(selectedCharacter, {
          setGlobalLoading: false,
          preserveActiveBehaviorBranch: true,
          refreshSnapshot: true,
          showNotFoundToast: false,
        });
      } else {
        setToast({ message: `✗ ${result.message}`, type: 'error' });
      }
    } catch (err) {
      console.error('[HypnoOS] CharacterEditor: 檢查世界書失敗', err);
      setToast({ message: '檢查失敗', type: 'error' });
    }
  };

  const handleSave = async () => {
    if (!selectedCharacter) return;
    setSaving(true);
    console.info(`[HypnoOS] CharacterEditor: 儲存世界書條目「${selectedCharacter}」`);
    try {
      for (const secId of ['arousal', 'alert', 'affection', 'obedience']) {
        const list = behaviorData[secId] ?? [];
        if (list.length === 0) continue;
        const validation = validateBehaviorBranches(secId, list, selectedCharacter);
        if (!validation.ok) {
          setToast({ message: `✗ ${validation.message}`, type: 'error' });
          setSaving(false);
          return;
        }
      }

      // 安全策略：只要分區存在 raw fallback 或處於 raw 模式，就必須先嘗試解析。
      // 若解析失敗則中止儲存，避免 saveCharacter 以重建資料覆蓋掉原始內容。
      const sectionsNeedApply = new Set<string>();
      for (const [secId, mode] of Object.entries(editModeBySection)) {
        if (mode === 'raw') sectionsNeedApply.add(secId);
      }
      for (const secId of Object.keys(rawFallbacks)) {
        sectionsNeedApply.add(secId);
      }

      for (const secId of sectionsNeedApply) {
        const parsed = applyRawSectionToParsed(secId);
        if (!parsed.ok) {
          setToast({ message: `✗ ${EDITOR_SECTIONS.find(s => s.id === secId)?.name ?? secId} 原始碼解析失敗：${parsed.message}（已中止儲存，避免資料遺失）`, type: 'error' });
          setSaving(false);
          return;
        }
      }

      const ok = await saveCharacter(selectedCharacter, sectionData, rawFallbacks, behaviorData, entryUid);
      if (ok) {
        console.info('[HypnoOS] CharacterEditor: 儲存成功，開始重新解析最新資料');
        try {
          await reloadCharacterData(selectedCharacter, {
            setGlobalLoading: false,
            preserveActiveBehaviorBranch: true,
            refreshSnapshot: true,
            showNotFoundToast: false,
          });
          setToast({ message: '✓ 已儲存並重新解析', type: 'success' });
        } catch (reloadErr) {
          console.error('[HypnoOS] CharacterEditor: 儲存後重新解析失敗', reloadErr);
          setToast({ message: '已儲存，但重新解析失敗', type: 'error' });
        }
      } else {
        setToast({ message: '儲存失敗：條目不存在，請先檢查世界書', type: 'error' });
      }
    } catch (err) {
      console.error('[HypnoOS] CharacterEditor: 儲存失敗', err);
      setToast({ message: '儲存失敗', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddBehaviorBranch = () => {
    if (!isBehaviorTab || !activeTab) return;
    if (currentEditMode === 'raw' || rawFallbacks[activeTab]) {
      setToast({ message: '原始碼模式下不可新增分支', type: 'info' });
      return;
    }
    const currentList = behaviorData[activeTab] ?? [];
    if (currentList.length === 0) {
      setToast({ message: '此分區目前無可新增的分支鏈', type: 'error' });
      return;
    }

    const typeInput = window.prompt('新增分支類型：1=else if, 2=else', '1')?.trim();
    if (!typeInput) return;

    if (typeInput === '2') {
      if (currentList.some(b => b.kind === 'else')) {
        setToast({ message: '此分區已存在 else 分支', type: 'error' });
        return;
      }

      const branchId = `branch_${Date.now()}`;
      const defaultBranch = buildDefaultBehaviorBranchNodes(activeTab, 'else');

      const newBranch: BehaviorBranch = {
        branchId,
        label: 'else',
        kind: 'else',
        conditionRaw: '',
        openTagRaw: '',
        yamlRaw: defaultBranch.yamlRaw,
        nodes: defaultBranch.nodes,
      };

      const insertIndex = currentList.length;
      updateBehaviorBranches(activeTab, list => {
        const next = [...list, newBranch];
        return next;
      });
      setActiveBehaviorBranchBySection(prev => ({ ...prev, [activeTab]: branchId }));
      setToast({ message: `已新增 else 分支（位置 ${insertIndex + 1}）`, type: 'success' });
      return;
    }

    if (typeInput !== '1') {
      setToast({ message: '輸入無效，請輸入 1 或 2', type: 'error' });
      return;
    }

    const opInput = window.prompt('請輸入比較符（<, <=, >, >=, ==）', '<')?.trim() as BehaviorBranch['operator'];
    if (!opInput) return;
    if (!CONDITION_OPERATORS.includes(opInput)) {
      setToast({ message: '比較符不合法', type: 'error' });
      return;
    }
    const thresholdInput = window.prompt('請輸入閾值（數字）', '50')?.trim();
    if (!thresholdInput) return;
    const threshold = Number(thresholdInput);
    if (!Number.isFinite(threshold)) {
      setToast({ message: '閾值必須是數字', type: 'error' });
      return;
    }

    const subjectExpr = getDefaultSubjectExpr(activeTab);
    const branchId = `branch_${Date.now()}`;
    const defaultBranch = buildDefaultBehaviorBranchNodes(activeTab, 'else_if', opInput, threshold);
    const newBranch: BehaviorBranch = {
      branchId,
      label: '',
      kind: 'else_if',
      operator: opInput,
      threshold,
      subjectExpr,
      conditionRaw: `${subjectExpr} ${opInput} ${threshold}`,
      openTagRaw: '',
      yamlRaw: defaultBranch.yamlRaw,
      nodes: defaultBranch.nodes,
    };

    updateBehaviorBranches(activeTab, list => {
      const elseIdx = list.findIndex(b => b.kind === 'else');
      if (elseIdx >= 0) {
        return [...list.slice(0, elseIdx), newBranch, ...list.slice(elseIdx)];
      }
      return [...list, newBranch];
    });
    setActiveBehaviorBranchBySection(prev => ({ ...prev, [activeTab]: branchId }));
    setToast({ message: '已新增 else if 分支', type: 'success' });
  };

  const handleEditBehaviorBranchCondition = () => {
    if (!isBehaviorTab || !activeBranch) return;
    if (currentEditMode === 'raw' || rawFallbacks[activeTab]) {
      setToast({ message: '原始碼模式下不可編輯分支條件', type: 'info' });
      return;
    }
    if (activeBranch.kind === 'else') {
      setToast({ message: 'else 分支沒有條件可編輯', type: 'info' });
      return;
    }

    const defaultOp = activeBranch.operator ?? '<';
    const opInput = window.prompt('請輸入比較符（<, <=, >, >=, ==）', defaultOp)?.trim() as BehaviorBranch['operator'];
    if (!opInput) return;
    if (!CONDITION_OPERATORS.includes(opInput)) {
      setToast({ message: '比較符不合法', type: 'error' });
      return;
    }

    const thresholdDefault = typeof activeBranch.threshold === 'number' ? String(activeBranch.threshold) : '50';
    const thresholdInput = window.prompt('請輸入閾值（數字）', thresholdDefault)?.trim();
    if (!thresholdInput) return;
    const threshold = Number(thresholdInput);
    if (!Number.isFinite(threshold)) {
      setToast({ message: '閾值必須是數字', type: 'error' });
      return;
    }

    const subjectExpr = activeBranch.subjectExpr ?? getDefaultSubjectExpr(activeTab);
    updateBehaviorBranches(activeTab, list => list.map(b => {
      if (b.branchId !== activeBranch.branchId) return b;
      return {
        ...b,
        operator: opInput,
        threshold,
        subjectExpr,
        conditionRaw: `${subjectExpr} ${opInput} ${threshold}`,
      };
    }));
    setToast({ message: '已更新分支條件', type: 'success' });
  };

  const handleDeleteBehaviorBranch = () => {
    if (!isBehaviorTab || !activeBranch) return;
    if (currentEditMode === 'raw' || rawFallbacks[activeTab]) {
      setToast({ message: '原始碼模式下不可刪除分支', type: 'info' });
      return;
    }
    const currentList = behaviorData[activeTab] ?? [];
    if (currentList.length <= 1) {
      setToast({ message: '至少需保留 1 條分支，無法刪除', type: 'error' });
      return;
    }

    const idx = currentList.findIndex(b => b.branchId === activeBranch.branchId);
    if (idx < 0) return;

    const ok = window.confirm(`確定刪除分支「${activeBranch.label}」？`);
    if (!ok) return;

    const next = [...currentList];
    const removing = next[idx];
    next.splice(idx, 1);

    if (idx === 0) {
      if (next[0]?.kind === 'else') {
        setToast({ message: '第一條分支後方為 else，無法刪除首個 if', type: 'error' });
        return;
      }
      if (next[0]) {
        next[0] = { ...next[0], kind: 'if' };
      }
    }

    const elseCount = next.filter(b => b.kind === 'else').length;
    if (elseCount > 1) {
      setToast({ message: '刪除後產生多個 else，操作已取消', type: 'error' });
      return;
    }

    updateBehaviorBranches(activeTab, () => next);

    const fallback = next[Math.max(0, idx - 1)] ?? next[0];
    if (fallback) {
      setActiveBehaviorBranchBySection(prev => ({ ...prev, [activeTab]: fallback.branchId }));
    }

    setToast({ message: `已刪除分支「${removing.label}」`, type: 'info' });
  };

  const handleRefreshParse = async () => {
    if (!selectedCharacter || selectedCharacter === '__new__') return;
    if (saving || refreshing) return;

    if (hasUnsavedChanges) {
      const ok = window.confirm('重新解析將丟失未儲存修改，是否繼續？');
      if (!ok) return;
    }

    try {
      await reloadCharacterData(selectedCharacter, {
        setGlobalLoading: false,
        preserveActiveBehaviorBranch: true,
        refreshSnapshot: true,
        showNotFoundToast: true,
      });
      setToast({ message: '✓ 已重新解析最新資料', type: 'success' });
    } catch (err) {
      console.error('[HypnoOS] CharacterEditor: 手動刷新解析失敗', err);
      setToast({ message: '✗ 重新解析失敗', type: 'error' });
    }
  };

  // F4: 重置本區
  const handleResetSection = () => {
    if (!snapshotRef.current) {
      console.warn('[HypnoOS] CharacterEditor: 無快照可供重置');
      setToast({ message: '無法重置：缺少原始資料快照', type: 'info' });
      return;
    }
    console.info(`[HypnoOS] CharacterEditor: 重置分區「${activeTab}」`);
    if (isBehaviorTab) {
      setBehaviorData(prev => ({
        ...prev,
        [activeTab]: snapshotRef.current!.behaviorData[activeTab]
          ? JSON.parse(JSON.stringify(snapshotRef.current!.behaviorData[activeTab]))
          : [],
      }));
      const resetBranches = snapshotRef.current!.behaviorData[activeTab] ?? [];
      setActiveBehaviorBranchBySection(prev => ({
        ...prev,
        [activeTab]: resetBranches[0]?.branchId ?? '',
      }));
    } else {
      setSectionData(prev => ({
        ...prev,
        [activeTab]: snapshotRef.current!.sectionData[activeTab] ?? [],
      }));
    }

    setRawFallbacks(prev => {
      const next = { ...prev };
      if (snapshotRef.current!.rawFallbacks[activeTab]) {
        next[activeTab] = snapshotRef.current!.rawFallbacks[activeTab];
      } else {
        delete next[activeTab];
      }
      return next;
    });
    setToast({ message: `已重置「${activeSection.name}」`, type: 'info' });
  };

  const isRawEditingActive = currentEditMode === 'raw' || Boolean(rawFallbacks[activeTab]);

  // ========= Render =========
  if (loading) {
    return (
      <div className="h-full bg-black flex items-center justify-center text-neutral-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> 載入角色資料中...
      </div>
    );
  }

  // ----- Prompt Manager view -----
  if (editorView === 'prompts') {
    return (
      <PromptManagerPage
        selectedCharacter={selectedCharacter}
        activeEditorTab={activeTab}
        getSectionRaw={getSectionRawText}
        onBack={() => setEditorView('main')}
      />
    );
  }

  return (
    <div className="h-full w-full bg-[#0c0c0c] flex flex-col overflow-hidden text-neutral-200 relative">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* === Header === */}
      <div className="h-14 flex flex-col justify-end px-4 pb-2 border-b z-10 shrink-0 transition-colors duration-300 bg-neutral-900/80 border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-neutral-400 hover:text-white transition p-1">
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-400 to-indigo-400">
              Character Editor
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedCharacter}
              onChange={e => setSelectedCharacter(e.target.value)}
              className="bg-neutral-800 text-[11px] px-2 py-1 rounded text-neutral-300 border-none outline-none cursor-pointer hover:bg-neutral-700 transition max-w-[120px]"
            >
              {characters.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
              <option value="__new__">+ 新增角色</option>
            </select>
          </div>
        </div>
      </div>

      {/* === Screen A: Editor Main View === */}
      <div className="flex flex-col flex-1 overflow-hidden">

          {/* Toolbar */}
          <div className="bg-neutral-900 px-3 py-2 flex items-center justify-between shadow-sm shrink-0 border-b border-neutral-800/50">
            <div className="flex gap-1.5 relative">
              <button
                onClick={handleCheckWorldbook}
                className="flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.1)] text-indigo-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                title="檢查關聯的世界書條目狀態"
              >
                <CheckCircle size={12} /> 檢查世界書
              </button>
              <button
                onClick={() => void handleRefreshParse()}
                disabled={saving || refreshing}
                className="flex items-center gap-1 bg-cyan-500/10 hover:bg-cyan-500/20 disabled:bg-neutral-800/60 disabled:text-neutral-500 shadow-[0_0_8px_rgba(34,211,238,0.1)] text-cyan-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                title="從世界書重新讀取並解析當前角色資料"
              >
                <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
                {refreshing ? '刷新中...' : '重新解析'}
              </button>
              <button
                onClick={handleResetSection}
                className="flex items-center p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                title="重置本分區（還原到上次載入）"
              >
                <RotateCcw size={16} />
              </button>
              <button
                onClick={() => setEditorView('prompts')}
                className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 shadow-[0_0_8px_rgba(245,158,11,0.1)] text-amber-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                title="管理 AI 生成提示詞模塊"
              >
                <Wand2 size={12} /> 提示詞管理
              </button>
              <button
                onClick={() => openAiRequestModal('current')}
                className="flex items-center gap-1 bg-purple-500/10 hover:bg-purple-500/20 shadow-[0_0_8px_rgba(168,85,247,0.1)] text-purple-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                title="AI 填補目前的資料分區"
              >
                <Sparkles size={12} /> AI 當前分區
              </button>
              <button
                onClick={() => openAiRequestModal('all')}
                className="flex items-center gap-1 bg-pink-500/10 hover:bg-pink-500/20 shadow-[0_0_8px_rgba(236,72,153,0.1)] text-pink-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                title="AI 填滿並改寫所有資料分區"
              >
                <Sparkles size={12} /> AI 全部分區
              </button>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/80 p-0.5">
              <button
                onClick={() => toggleCurrentSectionEditMode('parsed')}
                className={`px-2 py-1 text-[10px] rounded transition ${
                  currentEditMode === 'parsed'
                    ? 'bg-indigo-600/40 text-indigo-200'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/70'
                }`}
                title="使用解析後的樹狀資料編輯"
              >
                解析模式
              </button>
              <button
                onClick={() => toggleCurrentSectionEditMode('raw')}
                className={`px-2 py-1 text-[10px] rounded transition ${
                  currentEditMode === 'raw'
                    ? 'bg-amber-600/35 text-amber-200'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/70'
                }`}
                title="直接編輯分區原始碼"
              >
                原始碼模式
              </button>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex overflow-x-auto gap-2 px-3 py-2 bg-neutral-900/80 shrink-0 border-b border-neutral-800 no-scrollbar shadow-inner">
            {EDITOR_SECTIONS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-neutral-700 text-white shadow-sm ring-1 ring-neutral-500'
                    : 'bg-neutral-800/50 text-neutral-500 hover:bg-neutral-700/80 hover:text-neutral-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 dark-scrollbar">
            {isBehaviorTab && currentBranches.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-indigo-300/80 bg-indigo-900/20 p-2 rounded border border-indigo-700/30">
                  已解析 EJS 分支，請切換條件節點進行編輯。
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleAddBehaviorBranch}
                    disabled={isRawEditingActive}
                    className="px-2.5 py-1 rounded-lg text-[11px] border border-emerald-500/50 text-emerald-300 bg-emerald-900/20 hover:bg-emerald-800/30 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-emerald-900/20 transition"
                    title="新增 else if / else 分支"
                  >
                    + 分支
                  </button>
                  <button
                    onClick={handleEditBehaviorBranchCondition}
                    disabled={isRawEditingActive || !activeBranch || activeBranch.kind === 'else'}
                    className="px-2.5 py-1 rounded-lg text-[11px] border border-cyan-500/50 text-cyan-300 bg-cyan-900/20 hover:bg-cyan-800/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="修改目前分支條件"
                  >
                    編輯條件
                  </button>
                  <button
                    onClick={handleDeleteBehaviorBranch}
                    disabled={isRawEditingActive || !activeBranch}
                    className="px-2.5 py-1 rounded-lg text-[11px] border border-red-500/50 text-red-300 bg-red-900/20 hover:bg-red-800/30 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    title="刪除目前分支"
                  >
                    刪除分支
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {currentBranches.map(branch => {
                    const active = (activeBehaviorBranchBySection[activeTab] ?? currentBranches[0]?.branchId) === branch.branchId;
                    return (
                      <button
                        key={branch.branchId}
                        onClick={() => setActiveBehaviorBranchBySection(prev => ({ ...prev, [activeTab]: branch.branchId }))}
                        className={`px-2.5 py-1 rounded-lg text-[11px] border transition ${
                          active
                            ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/60'
                            : 'bg-neutral-800/70 text-neutral-400 border-neutral-700 hover:border-indigo-500/40 hover:text-neutral-200'
                        }`}
                        title={branch.conditionRaw || 'else'}
                      >
                        {branch.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(currentEditMode === 'raw' || rawFallbacks[activeTab]) ? (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-400/80 bg-amber-900/20 p-2 rounded border border-amber-700/30">
                  ⚠ 目前為原始碼模式。你可以直接編輯本分區的 YAML / EJS 內容，切回解析模式時會重新解析。
                </p>
                <textarea
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-mono text-neutral-300 p-3 focus:outline-none focus:border-indigo-500 resize-y dark-scrollbar select-text"
                  style={{ minHeight: '300px' }}
                  value={getSectionRawText(activeTab)}
                  onChange={e => setRawDraftBySection(prev => ({ ...prev, [activeTab]: e.target.value }))}
                />
              </div>
            ) : isBehaviorTab && activeBranch && !activeBranch.nodes ? (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-400/80 bg-amber-900/20 p-2 rounded border border-amber-700/30">
                  ⚠ 分支 YAML 解析失敗（{activeBranch.label}），目前使用原始文字模式編輯。
                </p>
                <textarea
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-mono text-neutral-300 p-3 focus:outline-none focus:border-indigo-500 resize-y dark-scrollbar select-text"
                  style={{ minHeight: '300px' }}
                  value={activeBranch.yamlRaw}
                  onChange={e => {
                    const nextRaw = e.target.value;
                    setBehaviorData(prev => {
                      const list = prev[activeTab] ?? [];
                      const idx = list.findIndex(b => b.branchId === activeBranch.branchId);
                      if (idx < 0) return prev;
                      const nextList = [...list];
                      nextList[idx] = { ...nextList[idx], yamlRaw: nextRaw };
                      return { ...prev, [activeTab]: nextList };
                    });
                  }}
                />
              </div>
            ) : (
              <>
                <p className="text-[10px] text-neutral-500 mb-2 leading-relaxed">
                  {activeSection.category === 'data'
                    ? '此區為動態樹狀結構。🔒 欄位無法修改 Key 和刪除，內部子欄位可自由新增、更改類型(T)。移至每一行右側顯示操作面板。'
                    : activeTab === 'global'
                      ? '此區為全局行為規則（rules 陣列）。'
                      : '此區為 EJS 行為邏輯分支，已轉換為可編輯樹狀節點。'
                  }
                </p>
                <NodeTree
                  nodes={currentNodes}
                  dispatch={dispatchTree}
                  depth={0}
                />
              </>
            )}
          </div>

          {/* Floating Save Button */}
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-[#0c0c0c]/90 to-transparent pointer-events-none flex justify-end z-20">
            <button
              onClick={handleSave}
              disabled={saving}
              className="pointer-events-auto bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white shadow-[0_0_15px_rgba(79,70,229,0.4)] rounded-full px-5 py-2 text-xs font-bold flex items-center gap-2 transition-transform active:scale-95 border border-indigo-400/50 disabled:border-neutral-600"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? '儲存中...' : '產生 / 儲存世界書'}
            </button>
          </div>
        </div>

      {/* AI Request Modal */}
      {aiRequestMode && !patchResult && (
        <CharacterCompletionAppAiRequestModal
          mode={aiRequestMode}
          activeTab={activeTab}
          activeBranchLabel={activeBranch ? activeBranch.label : undefined}
          characterName={selectedCharacter}
          contextName={aiRequestMode === 'all' ? '所有分區' : (isBehaviorTab ? `${activeSection.name} (${activeBranch?.label || ''})` : activeSection.name)}
          contextRaw={aiRequestMode === 'all' ? getAllSectionsContent() : getSectionRawText(activeTab)}
          allSectionsContent={getAllSectionsContent()}
          worldbookContent={worldbookContent}
          onClose={() => setAiRequestMode(null)}
          onSuccess={handleAiRequestSuccess}
        />
      )}

      {/* AI Patch Review Panel */}
      {patchResult && aiRequestMode && (
        <CharacterCompletionAppPatchReviewPanel
          mode={aiRequestMode} 
          activeTab={activeTab}
          activeBranchId={activeBranch?.branchId}
          patchResult={patchResult}
          mainSectionData={sectionData}
          mainBehaviorData={behaviorData}
          onClose={() => setPatchResult(null)}
          onApply={handleAiReviewApply}
        />
      )}

    </div>
  );
};
