import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EDITOR_SECTIONS, EditorNode, PromptTemplate } from '../../types';
import { MvuBridge } from '../../services/mvuBridge';
import { WorldBookService } from '../../services/worldBookService';
import { loadCharacter, saveCharacter, treeToYaml } from '../../services/characterDataService';
import { buildEditorPrompt, sendEditorPrompt } from '../../prompts/characterEditorSend';
import { ArrowLeft, Zap, CheckCircle, RotateCcw, Save, X, Loader2, Settings as SettingsIcon } from 'lucide-react';
import { NodeTree, treeReducer, TreeAction } from './NodeTree';
import { PromptManager } from './PromptManager';
import { DataService } from '../../services/dataService';

// ========= Default prompt templates (per context) =========

const SECTION_DEFAULT_PROMPTS: Record<string, PromptTemplate[]> = {
  global_output: [
    { id: 'go_1', title: 'AI 輸出嚴格格式限制', content: '所有的回復絕對不能包含 markdown code block (如 ```yaml)。必須以純 YAML 格式返回結果。不要輸出與 YAML 無關的解釋性文字。', isSystem: false },
    { id: 'go_2', title: '插入或替換規則', content: '請只針對新增刪除的節點輸出。若陣列原本就有值，請保留它們並接續補寫。不要輸出無關內容。保留原有的 key 結構。', isSystem: false },
    { id: 'go_3', title: '輸出結構規範', content: '輸出必須遵守以下格式：\n- 頂層 key 為角色名稱\n- 保留所有原有的 YAML key 名稱不變\n- 字串值使用雙引號\n- 列表項目使用 `- "..."` 格式\n- 嵌套物件保持正確縮排', isSystem: false },
  ],
  full_fill: [
    { id: 'ff_1', title: '全部填寫指令', content: '這是自動全部填寫模式。針對 {{裝配角色名字}} 發想所有空白值，保持角色設定風格一致。', isSystem: false },
    { id: 'ff_2', title: '當前內容注入', content: '以下是此角色現有的設定內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'ff_sys', title: '玩家自訂方向 (系統保留)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_info: [
    { id: 'si_1', title: '基本資訊填寫', content: '請為 {{裝配角色名字}} 發想基本資訊欄位（稱號/性別/年齡/公開身份/隱藏身份），符合日式校園背景。', isSystem: false },
    { id: 'si_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'si_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_social: [
    { id: 'ss_1', title: '社交網絡填寫', content: '請為 {{裝配角色名字}} 發想社交關係（家人、朋友、敵人），每個關係者需有名稱和關係描述。', isSystem: false },
    { id: 'ss_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'ss_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_personality: [
    { id: 'sp_1', title: '性格填寫', content: '請為 {{裝配角色名字}} 發想核心性格、條件性格、隱藏性格、日常習慣和隱密行為。', isSystem: false },
    { id: 'sp_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sp_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_appearance: [
    { id: 'sa_1', title: '外觀填寫', content: '請為 {{裝配角色名字}} 發想身高/體重/三圍/穿搭風格/外貌概述/制服與便服裝束/身體小特徵。', isSystem: false },
    { id: 'sa_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sa_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_fetish: [
    { id: 'sf_1', title: '性癖與弱點填寫', content: '請為 {{裝配角色名字}} 發想自慰頻率、高潮反應、敏感帶、隱藏性癖、特殊性特徵、弱點。', isSystem: false },
    { id: 'sf_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sf_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_arousal: [
    { id: 'sar_1', title: '發情行為填寫', content: '請根據發情值閾值（0-19/20-39/40-59/60-79/80-94/95+），為 {{裝配角色名字}} 發想各階段發情反應、生理反應、渴望程度。', isSystem: false },
    { id: 'sar_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sar_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_alert: [
    { id: 'sal_1', title: '警戒行為填寫', content: '請根據警戒度閾值（0-19/20-39/40-59/60-79/80+），為 {{裝配角色名字}} 發想各階段對{{user}}的態度和行為指導。', isSystem: false },
    { id: 'sal_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sal_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_affection: [
    { id: 'saf_1', title: '好感行為填寫', content: '請根據好感度閾值（0-19/20-39/40-59/60-79/80+），為 {{裝配角色名字}} 發想各階段的好感表現。', isSystem: false },
    { id: 'saf_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'saf_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_obedience: [
    { id: 'sob_1', title: '服從行為填寫', content: '請根據服從度閾值（0-19/20-39/40-59/60-79/80+），為 {{裝配角色名字}} 發想各階段的服從表現。', isSystem: false },
    { id: 'sob_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sob_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
  sec_global: [
    { id: 'sg_1', title: '全局行為規則填寫', content: '請為 {{裝配角色名字}} 發想在所有數值狀態下通用的行為準則（rules 陣列）。', isSystem: false },
    { id: 'sg_2', title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: 'sg_sys', title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ],
};

function getDefaultPrompts(ctx: string): PromptTemplate[] {
  if (SECTION_DEFAULT_PROMPTS[ctx]) {
    return SECTION_DEFAULT_PROMPTS[ctx].map(p => ({ ...p, id: `${p.id}_${Date.now()}` }));
  }
  return [
    { id: `${ctx}_d1_${Date.now()}`, title: '自訂指令', content: '針對此區域發想。', isSystem: false },
    { id: `${ctx}_d2_${Date.now()}`, title: '當前內容', content: '以下是此分區的當前內容：\n{{當前狀態與內容}}', isSystem: false },
    { id: `${ctx}_sys_${Date.now()}`, title: '玩家自訂方向 (系統)', content: '{{玩家輸入}}', isSystem: true },
  ];
}


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
  // ----- Character List -----
  const [characters, setCharacters] = useState<string[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ----- UI State -----
  const [activeTab, setActiveTab] = useState<string>('info');
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiDropdownOpen, setAiDropdownOpen] = useState(false);
  const [fillMode, setFillMode] = useState<'all' | 'section'>('all');
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // ----- Data State -----
  const [sectionData, setSectionData] = useState<Record<string, EditorNode[]>>({});
  const [promptsDb, setPromptsDb] = useState<Record<string, PromptTemplate[]>>(() => {
    try {
      const stored = DataService.getEditorPrompts() as Record<string, PromptTemplate[]> | undefined;
      if (stored && Object.keys(stored).length > 0) {
        console.info('[HypnoOS] CharacterEditor: 從 PersistedStore 讀取提示詞成功');
        return stored;
      }
    } catch (err) {
      console.warn('[HypnoOS] CharacterEditor: 讀取提示詞失敗', err);
    }
    console.info('[HypnoOS] CharacterEditor: 使用預設提示詞');
    return { ...SECTION_DEFAULT_PROMPTS };
  });
  const [rawFallbacks, setRawFallbacks] = useState<Record<string, string>>({});
  const [entryUid, setEntryUid] = useState<string | null>(null);

  // ----- Snapshot for reset -----
  const snapshotRef = useRef<{ sectionData: Record<string, EditorNode[]>; rawFallbacks: Record<string, string> } | null>(null);

  // ----- Tree reducer for current section -----
  const currentNodes = useMemo(() => sectionData[activeTab] ?? [], [sectionData, activeTab]);
  const dispatchTree = useCallback((action: TreeAction) => {
    setSectionData(prev => {
      const nodes = prev[activeTab] ?? [];
      const next = treeReducer(nodes, action);
      return { ...prev, [activeTab]: next };
    });
  }, [activeTab]);

  const activeSection = useMemo(
    () => EDITOR_SECTIONS.find(s => s.id === activeTab) ?? EDITOR_SECTIONS[0],
    [activeTab],
  );

  // ----- Persist prompts on change (debounced) -----
  const promptsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (promptsSaveTimerRef.current) clearTimeout(promptsSaveTimerRef.current);
    promptsSaveTimerRef.current = setTimeout(() => {
      void DataService.saveEditorPrompts(promptsDb);
    }, 1000);
    return () => { if (promptsSaveTimerRef.current) clearTimeout(promptsSaveTimerRef.current); };
  }, [promptsDb]);

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
      setLoading(true);
      console.info(`[HypnoOS] CharacterEditor: 載入角色「${selectedCharacter}」的世界書資料`);
      try {
        const result = await loadCharacter(selectedCharacter);
        if (cancelled) return;
        setSectionData(result.sectionData);
        setRawFallbacks(result.rawFallbacks);
        setEntryUid(result.entryUid);
        // Save snapshot for reset
        snapshotRef.current = {
          sectionData: JSON.parse(JSON.stringify(result.sectionData)),
          rawFallbacks: { ...result.rawFallbacks },
        };
        const secCount = Object.keys(result.sectionData).length;
        const rawCount = Object.keys(result.rawFallbacks).length;
        console.info(`[HypnoOS] CharacterEditor: 載入完成 - ${secCount} 個分區有樹資料, ${rawCount} 個分區有原始文字`);
        if (secCount === 0 && rawCount === 0 && !result.entryUid) {
          setToast({ message: `未找到「${selectedCharacter}」的世界書條目`, type: 'info' });
        }
      } catch (err) {
        console.error('[HypnoOS] CharacterEditor: 載入角色資料失敗', err);
        setToast({ message: '載入失敗: ' + (err instanceof Error ? err.message : '未知錯誤'), type: 'error' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => { cancelled = true; };
  }, [selectedCharacter]);

  // ----- Handlers -----
  const triggerAiFill = (mode: 'all' | 'section') => {
    setAiDropdownOpen(false);
    setFillMode(mode);
    setAiPromptInput('');
    setShowAiModal(true);
    console.info(`[HypnoOS] CharacterEditor: 打開 AI 填寫面板 mode=${mode}`);
  };

  const submitAiFill = async () => {
    console.info(`[HypnoOS] CharacterEditor: AI 填寫 mode=${fillMode}, tab=${activeTab}`);
    try {
      const contextKey = fillMode === 'all' ? 'full_fill' : `sec_${activeTab}`;
      const templates = promptsDb[contextKey] ?? getDefaultPrompts(contextKey);
      const globalRules = promptsDb['global_output'] ?? SECTION_DEFAULT_PROMPTS['global_output'] ?? [];

      // Build current section data as YAML string
      const currentData = currentNodes.length > 0
        ? JSON.stringify(treeToYaml(currentNodes), null, 2)
        : rawFallbacks[activeTab] ?? '';

      console.info(`[HypnoOS] CharacterEditor: 使用 ${templates.length} 個分區模板 + ${globalRules.length} 個全局規則`);

      const prompt = buildEditorPrompt({
        mode: fillMode === 'all' ? 'full_fill' : 'section',
        sectionId: activeTab,
        sectionName: activeSection.name,
        templates,
        globalRules,
        currentData,
        characterName: selectedCharacter,
        playerDirection: aiPromptInput,
      });

      console.info(`[HypnoOS] CharacterEditor: 提示詞構建完成, 長度=${prompt.length}`);

      // 使用專用的發送函數
      const ok = await sendEditorPrompt(prompt);
      if (ok) {
        setToast({ message: 'AI 提示詞已發送', type: 'success' });
      } else {
        setToast({ message: '發送失敗: 未連接酒館', type: 'error' });
      }
    } catch (err) {
      console.error('[HypnoOS] CharacterEditor: AI 填寫失敗', err);
      setToast({ message: 'AI 填寫失敗: ' + (err instanceof Error ? err.message : '未知'), type: 'error' });
    }
    setShowAiModal(false);
  };

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
        // Reload data
        const data = await loadCharacter(selectedCharacter);
        setSectionData(data.sectionData);
        setRawFallbacks(data.rawFallbacks);
        setEntryUid(data.entryUid);
        snapshotRef.current = {
          sectionData: JSON.parse(JSON.stringify(data.sectionData)),
          rawFallbacks: { ...data.rawFallbacks },
        };
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
      const ok = await saveCharacter(selectedCharacter, sectionData, rawFallbacks, entryUid);
      if (ok) {
        setToast({ message: '✓ 已儲存至世界書', type: 'success' });
        console.info('[HypnoOS] CharacterEditor: 儲存成功');
        // Update snapshot after successful save
        snapshotRef.current = {
          sectionData: JSON.parse(JSON.stringify(sectionData)),
          rawFallbacks: { ...rawFallbacks },
        };
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

  // F4: 重置本區
  const handleResetSection = () => {
    if (!snapshotRef.current) {
      console.warn('[HypnoOS] CharacterEditor: 無快照可供重置');
      setToast({ message: '無法重置：缺少原始資料快照', type: 'info' });
      return;
    }
    console.info(`[HypnoOS] CharacterEditor: 重置分區「${activeTab}」`);
    setSectionData(prev => ({
      ...prev,
      [activeTab]: snapshotRef.current!.sectionData[activeTab] ?? [],
    }));
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

  // ========= Render =========
  if (loading) {
    return (
      <div className="h-full bg-black flex items-center justify-center text-neutral-500 text-sm gap-2">
        <Loader2 size={16} className="animate-spin" /> 載入角色資料中...
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#0c0c0c] flex flex-col overflow-hidden text-neutral-200 select-none relative">

      {/* Toast */}
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* === Header === */}
      <div className={`h-14 flex flex-col justify-end px-4 pb-2 border-b z-10 shrink-0 transition-colors duration-300 ${
        showPromptSettings
          ? 'bg-indigo-900/50 border-indigo-900/40'
          : 'bg-neutral-900/80 border-neutral-800'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-neutral-400 hover:text-white transition p-1">
              <ArrowLeft size={16} />
            </button>
            <h1 className={`text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r ${
              showPromptSettings
                ? 'from-blue-400 to-indigo-400'
                : 'from-pink-400 to-indigo-400'
            }`}>
              {showPromptSettings ? '提示詞管理 (Prompts)' : 'Character Editor'}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPromptSettings(!showPromptSettings)}
              className="text-neutral-400 hover:text-white transition"
              title="AI 提示詞設定"
            >
              {showPromptSettings
                ? <X size={18} className="text-indigo-400" />
                : <SettingsIcon size={18} className="drop-shadow-[0_0_5px_rgba(99,102,241,0.5)]" />
              }
            </button>
            {!showPromptSettings && (
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
            )}
          </div>
        </div>
      </div>

      {/* === Screen A: Editor Main View === */}
      {!showPromptSettings && (
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Toolbar */}
          <div className="bg-neutral-900 px-3 py-2 flex items-center justify-between shadow-sm shrink-0 border-b border-neutral-800/50">
            <div className="flex gap-1.5 relative">
              <div className="relative">
                <button
                  onClick={() => setAiDropdownOpen(!aiDropdownOpen)}
                  className="flex items-center gap-1 bg-pink-500/10 hover:bg-pink-500/20 shadow-[0_0_10px_rgba(236,72,153,0.1)] text-pink-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                >
                  <Zap size={12} /> AI 填寫 ▾
                </button>
                {aiDropdownOpen && (
                  <div className="absolute top-10 left-0 bg-neutral-800 border border-neutral-700 shadow-xl rounded-lg py-1 w-32 z-50 text-xs">
                    <button onClick={() => triggerAiFill('all')} className="w-full text-left px-3 py-1.5 hover:bg-neutral-700 text-neutral-200">全部填寫 (Full)</button>
                    <button onClick={() => triggerAiFill('section')} className="w-full text-left px-3 py-1.5 hover:bg-neutral-700 text-neutral-200">填寫當前分區</button>
                  </div>
                )}
              </div>
              <button
                onClick={handleCheckWorldbook}
                className="flex items-center gap-1 bg-indigo-500/10 hover:bg-indigo-500/20 shadow-[0_0_8px_rgba(99,102,241,0.1)] text-indigo-400 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                title="檢查關聯的世界書條目狀態"
              >
                <CheckCircle size={12} /> 檢查世界書
              </button>
              <button
                onClick={handleResetSection}
                className="flex items-center p-1.5 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-900/30 transition-colors"
                title="重置本分區（還原到上次載入）"
              >
                <RotateCcw size={16} />
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
            {rawFallbacks[activeTab] ? (
              <div className="space-y-2">
                <p className="text-[10px] text-amber-400/80 bg-amber-900/20 p-2 rounded border border-amber-700/30">
                  ⚠ 此分區包含 EJS 條件邏輯（動態行為區），以原始文字模式編輯。請直接修改下方內容。
                </p>
                <textarea
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-mono text-neutral-300 p-3 focus:outline-none focus:border-indigo-500 resize-y dark-scrollbar"
                  style={{ minHeight: '300px' }}
                  value={rawFallbacks[activeTab]}
                  onChange={e => setRawFallbacks(prev => ({ ...prev, [activeTab]: e.target.value }))}
                />
              </div>
            ) : (
              <>
                <p className="text-[10px] text-neutral-500 mb-2 leading-relaxed">
                  {activeSection.category === 'data'
                    ? '此區為動態樹狀結構。🔒 欄位無法修改 Key 和刪除，內部子欄位可自由新增、更改類型(T)。移至每一行右側顯示操作面板。'
                    : activeTab === 'global'
                      ? '此區為全局行為規則（rules 陣列）。'
                      : '此區為 EJS 行為邏輯區，切換到分區 tab 後以原始文字編輯。'
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
      )}

      {/* === Screen B: Prompt Manager === */}
      {showPromptSettings && (
        <PromptManager
          promptsDb={promptsDb}
          setPromptsDb={setPromptsDb}
          activeTab={activeTab}
          getDefaultPrompts={getDefaultPrompts}
        />
      )}

      {/* === AI Fill Modal === */}
      {showAiModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-[#16161a] border border-neutral-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden relative border-t-pink-500 border-t-[3px]">
            <div className="px-4 py-3 border-b border-neutral-800 flex justify-between items-center">
              <h2 className="text-sm font-bold text-neutral-200 flex items-center gap-1.5">
                <Zap size={16} className="text-pink-400" />
                {fillMode === 'all' ? 'AI 全部填寫 (Full Fill)' : `AI 分區填寫 (${activeSection.name})`}
              </h2>
              <button onClick={() => setShowAiModal(false)} className="text-neutral-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-[11px] text-neutral-400">
                請輸入希望 AI 發展或修改的方向。留空則使用預設規則。<br />
                <span className="text-indigo-400">將使用 [{fillMode === 'all' ? '全部填寫' : activeSection.name}] 的提示詞模板。</span>
              </p>
              <textarea
                value={aiPromptInput}
                onChange={e => setAiPromptInput(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 text-sm text-neutral-200 focus:outline-none focus:border-pink-500 resize-none dark-scrollbar"
                style={{ minHeight: '80px' }}
                placeholder="例如：變得更傲嬌... (選填)"
              />
            </div>
            <div className="px-4 py-3 bg-neutral-800/50 flex justify-end gap-2 border-t border-neutral-800">
              <button onClick={() => setShowAiModal(false)} className="px-4 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800 rounded-lg">取消</button>
              <button onClick={() => void submitAiFill()} className="px-4 py-1.5 text-xs font-bold bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-all">送出至 AI</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
