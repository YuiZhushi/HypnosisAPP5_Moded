import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, RotateCcw, Save, Eye, Send, Loader2, ChevronDown } from 'lucide-react';
import { DataService } from '../../services/dataService';
import { AiRequestPipelineService } from '../../services/aiRequestPipelineService';
import { buildEditorPipelineParams } from '../../prompts/characterEditorSend';
import {
  EditorPromptModule,
  EDITOR_PROMPT_PLACEHOLDERS,
  EDITOR_SECTIONS,
} from '../../types';

// ====== Toast (reuse pattern from CharacterEditorApp) ======

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

// ====== 分區下拉選項列表 ======

const SECTION_OPTIONS = [
  ...EDITOR_SECTIONS.map(s => ({ id: s.id, name: s.name })),
  { id: 'all', name: '全部分區' },
];

// ====== Main Component ======

interface PromptManagerPageProps {
  selectedCharacter: string;
  activeEditorTab: string;
  /** 取得某分區的 raw 文本 */
  getSectionRaw: (sectionId: string) => string;
  onBack: () => void;
}

export const PromptManagerPage: React.FC<PromptManagerPageProps> = ({
  selectedCharacter,
  activeEditorTab,
  getSectionRaw,
  onBack,
}) => {
  // ----- Module state -----
  const [modules, setModules] = useState<EditorPromptModule[]>([]);
  const [activeModuleId, setActiveModuleId] = useState<string>('');
  const [activeSectionId, setActiveSectionId] = useState<string>(activeEditorTab || 'info');
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [previewText, setPreviewText] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [worldbookContent, setWorldbookContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ----- Load modules -----
  useEffect(() => {
    const loaded = DataService.getEditorPromptModules();
    setModules(loaded);
    if (loaded.length > 0 && !activeModuleId) {
      setActiveModuleId(loaded[0].id);
    }
  }, []);

  // ----- Fetch worldbook entry content -----
  useEffect(() => {
    if (!selectedCharacter) {
      setWorldbookContent('');
      return;
    }
    let cancelled = false;
    const fetchWbContent = async () => {
      try {
        const charWb = getCharWorldbookNames('current');
        const wbName = charWb.primary;
        if (!wbName) {
          setWorldbookContent('(角色卡未綁定世界書)');
          return;
        }
        const entries = await getWorldbook(wbName);
        const plotPrefix = '[mvu_plot]';
        const entry = entries.find(
          (e: any) =>
            e.name === `${plotPrefix}${selectedCharacter}人设` ||
            e.name === `${plotPrefix}${selectedCharacter}人設`,
        );
        if (!cancelled) {
          setWorldbookContent(entry?.content ?? '(未找到角色世界書條目)');
        }
      } catch (err) {
        console.warn('[HypnoOS] PromptManager: 讀取世界書條目失敗', err);
        if (!cancelled) setWorldbookContent('(讀取失敗)');
      }
    };
    void fetchWbContent();
    return () => { cancelled = true; };
  }, [selectedCharacter]);

  // ----- Derived -----
  const fixedModules = useMemo(() => modules.filter(m => m.type === 'fixed'), [modules]);
  const sectionContentModules = useMemo(() => modules.filter(m => m.type === 'section_content'), [modules]);
  const sectionFormatModules = useMemo(() => modules.filter(m => m.type === 'section_format'), [modules]);
  const sectionInstructionModules = useMemo(() => modules.filter(m => m.type === 'section_instruction'), [modules]);

  const currentSectionContentModule = useMemo(
    () => sectionContentModules.find(m => m.sectionId === activeSectionId),
    [sectionContentModules, activeSectionId],
  );
  const currentSectionFormatModule = useMemo(
    () => sectionFormatModules.find(m => m.sectionId === activeSectionId),
    [sectionFormatModules, activeSectionId],
  );
  const currentSectionInstructionModule = useMemo(
    () => sectionInstructionModules.find(m => m.sectionId === activeSectionId),
    [sectionInstructionModules, activeSectionId],
  );

  // activeModule：如果選中的是分區 Tab，用 activeSectionId 對應的 module
  const activeModule = useMemo(() => {
    if (activeModuleId === '__section_content__') {
      return currentSectionContentModule ?? null;
    }
    if (activeModuleId === '__section_format__') {
      return currentSectionFormatModule ?? null;
    }
    if (activeModuleId === '__section_instruction__') {
      return currentSectionInstructionModule ?? null;
    }
    return modules.find(m => m.id === activeModuleId) ?? null;
  }, [activeModuleId, modules, currentSectionContentModule, currentSectionFormatModule, currentSectionInstructionModule]);

  // Tab 列表：固定 + 虛擬 Tab
  const tabs = useMemo(() => {
    const fixed = fixedModules.map(m => ({ id: m.id, label: m.title, isSectionTab: false }));
    fixed.push({ id: '__section_content__', label: '當前分區內容', isSectionTab: true });
    fixed.push({ id: '__section_instruction__', label: '寬泛生成要求', isSectionTab: true });
    fixed.push({ id: '__section_format__', label: '輸出格式規範', isSectionTab: true });
    return fixed;
  }, [fixedModules]);

  // ----- Handlers -----
  const updateModuleContent = useCallback((moduleId: string, content: string) => {
    setModules(prev =>
      prev.map(m => (m.id === moduleId ? { ...m, content } : m)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await DataService.saveEditorPromptModules(modules);
      setToast({ message: '✓ 提示詞模塊已儲存', type: 'success' });
    } catch (err) {
      console.error('[HypnoOS] PromptManager: 儲存失敗', err);
      setToast({ message: '儲存失敗', type: 'error' });
    } finally {
      setSaving(false);
    }
  }, [modules]);

  const handleResetModule = useCallback((moduleId: string) => {
    const defaults = DataService.getDefaultEditorPromptModules();
    const defaultModule = defaults.find(m => m.id === moduleId);
    if (!defaultModule) return;
    setModules(prev =>
      prev.map(m => (m.id === moduleId ? { ...m, content: defaultModule.content } : m)),
    );
    setToast({ message: `✓ 已重置「${defaultModule.title}」為預設值`, type: 'info' });
  }, []);

  const handleInsertPlaceholder = useCallback((key: string) => {
    const textarea = textareaRef.current;
    if (!textarea || !activeModule) return;
    const { selectionStart, selectionEnd } = textarea;
    const placeholder = `{{${key}}}`;
    const currentContent = activeModule.content;
    const newContent =
      currentContent.slice(0, selectionStart) +
      placeholder +
      currentContent.slice(selectionEnd);
    updateModuleContent(activeModule.id, newContent);
    // Restore cursor position
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = selectionStart + placeholder.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [activeModule, updateModuleContent]);

  const getCurrentSectionName = useCallback((): string => {
    const sec = EDITOR_SECTIONS.find(s => s.id === activeEditorTab);
    return sec?.name ?? activeEditorTab;
  }, [activeEditorTab]);

  const buildPipelineParams = useCallback(() => {
    const currentSectionYaml = getSectionRaw(activeEditorTab);
    const allSectionsContent = EDITOR_SECTIONS.map(
      s => `## ${s.name}\n${getSectionRaw(s.id)}\n`,
    ).join('\n');

    return buildEditorPipelineParams({
      modules,
      currentSectionId: activeEditorTab,
      characterName: selectedCharacter,
      userInput,
      currentSectionName: getCurrentSectionName(),
      currentSectionYaml,
      allSectionsContent,
      worldbookEntry: worldbookContent,
    });
  }, [modules, activeEditorTab, selectedCharacter, userInput, getCurrentSectionName, getSectionRaw, worldbookContent]);

  const handlePreview = useCallback(() => {
    try {
      const params = buildPipelineParams();
      const composed = AiRequestPipelineService.composePrompt(params);
      setPreviewText(composed);
    } catch (err) {
      console.error('[HypnoOS] PromptManager: 預覽失敗', err);
      setToast({ message: `預覽失敗: ${err instanceof Error ? err.message : '未知錯誤'}`, type: 'error' });
    }
  }, [buildPipelineParams]);

  const handleSend = useCallback(async () => {
    setSending(true);
    try {
      const params = buildPipelineParams();
      const result = await AiRequestPipelineService.request(params);
      if (result.ok) {
        setPreviewText(result.responseText ?? '（空回應）');
        setToast({ message: '✓ AI 回應已接收', type: 'success' });
      } else {
        setToast({ message: `✗ 發送失敗: ${result.error}`, type: 'error' });
      }
    } catch (err) {
      console.error('[HypnoOS] PromptManager: 發送失敗', err);
      setToast({ message: '發送失敗', type: 'error' });
    } finally {
      setSending(false);
    }
  }, [buildPipelineParams]);

  // ====== Render ======
  return (
    <div className="h-full w-full bg-[#0c0c0c] flex flex-col overflow-hidden text-neutral-200 relative">
      {toast && <Toast message={toast.message} type={toast.type} onDone={() => setToast(null)} />}

      {/* Header */}
      <div className="h-14 flex flex-col justify-end px-4 pb-2 border-b z-10 shrink-0 bg-neutral-900/80 border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="text-neutral-400 hover:text-white transition p-1">
              <ArrowLeft size={16} />
            </button>
            <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400">
              提示詞管理
            </h1>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-700 text-white rounded-lg px-3 py-1.5 text-[11px] font-bold transition"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            {saving ? '儲存中...' : '儲存全部'}
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex overflow-x-auto gap-2 px-3 py-2 bg-neutral-900/80 shrink-0 border-b border-neutral-800 no-scrollbar shadow-inner">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveModuleId(tab.id)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 ${
              activeModuleId === tab.id
                ? tab.isSectionTab
                  ? 'bg-amber-700/40 text-amber-200 shadow-sm ring-1 ring-amber-500/50'
                  : 'bg-neutral-700 text-white shadow-sm ring-1 ring-neutral-500'
                : 'bg-neutral-800/50 text-neutral-500 hover:bg-neutral-700/80 hover:text-neutral-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Section switcher (only visible when section tab is active) */}
      {(activeModuleId === '__section_content__' || activeModuleId === '__section_format__' || activeModuleId === '__section_instruction__') && (
        <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900/60 border-b border-neutral-800/50 shrink-0">
          <span className="text-[10px] text-neutral-500">分區：</span>
          <div className="relative">
            <select
              value={activeSectionId}
              onChange={e => setActiveSectionId(e.target.value)}
              className="appearance-none bg-neutral-800 text-[11px] px-3 py-1.5 pr-7 rounded-lg text-neutral-300 border border-neutral-700 outline-none cursor-pointer hover:bg-neutral-700 transition"
            >
              {SECTION_OPTIONS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          </div>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-28 dark-scrollbar">
        {activeModule ? (
          <>
            {/* Module title + reset */}
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-semibold text-neutral-300">{activeModule.title}</h2>
              <button
                onClick={() => handleResetModule(activeModule.id)}
                className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-red-400 transition"
                title="重置為預設值"
              >
                <RotateCcw size={10} />
                重置
              </button>
            </div>

            <div className="text-[10px] text-neutral-500 flex gap-3">
              <span>類型: {activeModule.type === 'fixed' ? '固定' : '分區'}</span>
              <span>順序: {activeModule.order}</span>
              {activeModule.sectionId && <span>分區ID: {activeModule.sectionId}</span>}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-mono text-neutral-300 p-3 focus:outline-none focus:border-amber-500/60 resize-y dark-scrollbar select-text"
              style={{ minHeight: '200px' }}
              value={activeModule.content}
              onChange={e => updateModuleContent(activeModule.id, e.target.value)}
              placeholder="在此輸入提示詞內容..."
            />

            {/* Placeholder panel */}
            <div className="space-y-1.5">
              <h3 className="text-[10px] text-neutral-500 font-semibold">可用佔位符（點擊插入）</h3>
              <div className="flex flex-wrap gap-1.5">
                {EDITOR_PROMPT_PLACEHOLDERS.map(ph => (
                  <button
                    key={ph.key}
                    onClick={() => handleInsertPlaceholder(ph.key)}
                    className="px-2 py-1 rounded-md text-[10px] bg-amber-900/20 text-amber-300 border border-amber-700/30 hover:bg-amber-800/30 transition"
                    title={ph.description}
                  >
                    {`{{${ph.key}}}`}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-neutral-600">也支援酒館內建宏，如 {'{{char}}'}, {'{{user}}'} 等</p>
            </div>

            {/* User input field */}
            <div className="space-y-1">
              <label className="text-[10px] text-neutral-500 font-semibold">用戶輸入（發送前填寫）</label>
              <textarea
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg text-xs text-neutral-300 p-2 focus:outline-none focus:border-amber-500/60 resize-y dark-scrollbar"
                style={{ minHeight: '60px' }}
                value={userInput}
                onChange={e => setUserInput(e.target.value)}
                placeholder="輸入你對 AI 的要求..."
              />
            </div>
          </>
        ) : (
          <div className="text-neutral-500 text-sm text-center py-8">選擇一個提示詞模塊</div>
        )}

        {/* Preview area */}
        {previewText !== null && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[10px] text-neutral-400 font-semibold">
                {sending ? '✦ AI 回應' : '✦ 拼接預覽'}
              </h3>
              <button
                onClick={() => setPreviewText(null)}
                className="text-[9px] text-neutral-600 hover:text-neutral-400 transition"
              >
                關閉
              </button>
            </div>
            <pre className="w-full bg-neutral-950 border border-neutral-700/50 rounded-lg text-[10px] font-mono text-neutral-400 p-3 overflow-x-auto whitespace-pre-wrap max-h-[300px] overflow-y-auto dark-scrollbar select-text">
              {previewText}
            </pre>
          </div>
        )}
      </div>

      {/* Floating Action Buttons */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-[#0c0c0c]/90 to-transparent pointer-events-none flex justify-end gap-2 z-20">
        <button
          onClick={handlePreview}
          className="pointer-events-auto bg-neutral-700 hover:bg-neutral-600 text-white rounded-full px-4 py-2 text-xs font-bold flex items-center gap-2 transition border border-neutral-600"
        >
          <Eye size={14} />
          預覽拼接
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="pointer-events-auto bg-amber-600 hover:bg-amber-500 disabled:bg-neutral-700 text-white shadow-[0_0_15px_rgba(245,158,11,0.3)] rounded-full px-4 py-2 text-xs font-bold flex items-center gap-2 transition-transform active:scale-95 border border-amber-400/50 disabled:border-neutral-600"
        >
          {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
          {sending ? '發送中...' : '發送到 AI'}
        </button>
      </div>
    </div>
  );
};
