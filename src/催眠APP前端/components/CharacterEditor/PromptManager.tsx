import React, { useMemo, useState } from 'react';
import { PromptTemplate } from '../../types';
import { Plus, Eye, EyeOff, Trash2, GripHorizontal, Book } from 'lucide-react';

// ========= PromptManager =========

export const PromptManager: React.FC<{
  promptsDb: Record<string, PromptTemplate[]>;
  setPromptsDb: React.Dispatch<React.SetStateAction<Record<string, PromptTemplate[]>>>;
  activeTab: string;
  getDefaultPrompts: (ctx: string) => PromptTemplate[];
}> = ({ promptsDb, setPromptsDb, activeTab, getDefaultPrompts }) => {
  const [currentContext, setCurrentContext] = useState<string>('sec_' + activeTab);
  const [showPreview, setShowPreview] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const ensureContext = (ctx: string): PromptTemplate[] => {
    if (promptsDb[ctx] && promptsDb[ctx].length > 0) return promptsDb[ctx];
    const defaults = getDefaultPrompts(ctx);
    setPromptsDb(prev => ({ ...prev, [ctx]: defaults }));
    return defaults;
  };

  const currentPrompts = useMemo(() => ensureContext(currentContext), [currentContext, promptsDb]);

  // ----- CRUD -----
  const addPrompt = () => {
    console.info(`[HypnoOS] PromptManager: 新增提示詞卡片 ctx=${currentContext}`);
    setPromptsDb(prev => ({
      ...prev,
      [currentContext]: [
        ...(prev[currentContext] ?? []),
        { id: `p_${Date.now()}`, title: '新建模板', content: '', isSystem: false },
      ],
    }));
  };

  const deletePrompt = (index: number) => {
    console.info(`[HypnoOS] PromptManager: 刪除提示詞 ctx=${currentContext} idx=${index}`);
    setPromptsDb(prev => ({
      ...prev,
      [currentContext]: (prev[currentContext] ?? []).filter((_, i) => i !== index),
    }));
  };

  const updatePrompt = (index: number, field: 'title' | 'content', value: string) => {
    setPromptsDb(prev => {
      const arr = [...(prev[currentContext] ?? [])];
      arr[index] = { ...arr[index], [field]: value };
      return { ...prev, [currentContext]: arr };
    });
  };

  const insertMacro = (index: number, macroText: string) => {
    const prompt = currentPrompts[index];
    if (!prompt || prompt.isSystem) return;
    const sep = prompt.content.length > 0 && !prompt.content.endsWith('\n') ? ' ' : '';
    updatePrompt(index, 'content', prompt.content + sep + macroText);
  };

  // ----- Drag & Drop -----
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (toIdx: number) => {
    if (dragIdx === null || dragIdx === toIdx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    console.info(`[HypnoOS] PromptManager: 拖曳排序 ${dragIdx} → ${toIdx}`);
    setPromptsDb(prev => {
      const arr = [...(prev[currentContext] ?? [])];
      const [moved] = arr.splice(dragIdx, 1);
      arr.splice(toIdx, 0, moved);
      return { ...prev, [currentContext]: arr };
    });
    setDragIdx(null);
    setDragOverIdx(null);
  };
  const handleDragEnd = () => {
    setDragIdx(null);
    setDragOverIdx(null);
  };

  // ----- Preview -----
  const generatePreviewString = (): string => {
    let str = '';
    const contextList = promptsDb[currentContext] ?? [];
    str += `// ======= [發送給 AI 的主要指令序列] =======\n\n`;
    contextList.forEach(p => {
      str += `--- [ 區塊: ${p.title} ] ---\n${p.content}\n\n`;
    });
    if (currentContext !== 'global_output' && promptsDb['global_output']) {
      str += `\n// ======= [全局輸出與解析強制規範 (底層)] =======\n\n`;
      promptsDb['global_output'].forEach(p => {
        str += `--- [ 區塊: ${p.title} ] ---\n${p.content}\n\n`;
      });
    }
    return str.trim();
  };

  // ----- Worldbook dropdown state (controlled, not CSS hover) -----
  const [wbDropdownIdx, setWbDropdownIdx] = useState<number | null>(null);

  return (
    <div className="flex flex-col flex-1 overflow-hidden bg-neutral-900/40 relative">
      {/* Context Selector */}
      <div className="px-3 py-2 border-b border-neutral-800 bg-neutral-900 shrink-0 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
        <span className="text-neutral-400 font-bold whitespace-nowrap shrink-0 ml-1">針對：</span>
        <select
          value={currentContext}
          onChange={e => setCurrentContext(e.target.value)}
          className="bg-neutral-800 text-indigo-300 font-bold px-3 py-1.5 rounded-lg border border-neutral-700 outline-none cursor-pointer w-full text-[11px] shadow-sm tracking-wide focus:border-indigo-500"
        >
          <option value="global_output">全局要求：輸出結構與解析規範</option>
          <option disabled>─────────────</option>
          <option value="full_fill">模式：全部填寫 (Full Fill)</option>
          <option value="sec_info">分區：基本資訊</option>
          <option value="sec_social">分區：社交網絡</option>
          <option value="sec_personality">分區：性格與興趣</option>
          <option value="sec_appearance">分區：外觀特點</option>
          <option value="sec_fetish">分區：性癖與弱點</option>
          <option value="sec_arousal">分區：發情行為</option>
          <option value="sec_alert">分區：警戒行為</option>
          <option value="sec_affection">分區：好感行為</option>
          <option value="sec_obedience">分區：服從行為</option>
          <option value="sec_global">分區：全局行為</option>
        </select>
      </div>

      {/* Prompt List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 dark-scrollbar">
        <p className="text-[10px] text-neutral-400 bg-neutral-800/50 p-2.5 rounded-lg border border-neutral-700/50 leading-relaxed shadow-inner">
          {currentContext === 'global_output'
            ? <><b>輸出規範</b>：強制墊底的 AI 回應格式限制。這是最重要的設定。拖曳 ☰ 來決定各指令先後順序。發送時，這份規範會加在個別分區指令的最後面。</>
            : <><b>模板清單</b>：在執行「<span className="text-indigo-400">{currentContext}</span>」時會發送的組合提示詞。支援拖曳排序、下方的 Macro 按鈕可快速引用變數。</>
          }
        </p>

        <div className="space-y-3">
          {currentPrompts.map((prompt, index) => (
            <div
              key={prompt.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={e => handleDragOver(e, index)}
              onDrop={() => handleDrop(index)}
              onDragEnd={handleDragEnd}
              className={`bg-[#141414] border rounded-lg group/prompt flex flex-col shadow transition-all ${
                prompt.isSystem ? 'border-pink-900/50' : 'border-neutral-700'
              } ${dragOverIdx === index ? 'ring-2 ring-indigo-500/50' : ''}`}
            >
              {/* Card Header */}
              <div className={`px-2 py-1.5 flex items-center gap-2 border-b ${
                prompt.isSystem ? 'bg-pink-900/20 border-pink-900/40' : 'bg-[#1e1e1e] border-neutral-800'
              }`}>
                <div className={`cursor-move p-0.5 rounded ${
                  prompt.isSystem ? 'text-pink-500 hover:bg-pink-900/50' : 'text-neutral-500 hover:bg-neutral-700 hover:text-white'
                }`}>
                  <GripHorizontal size={16} />
                </div>
                <input
                  type="text"
                  value={prompt.title}
                  disabled={prompt.isSystem}
                  onChange={e => updatePrompt(index, 'title', e.target.value)}
                  className={`text-[11px] font-semibold bg-transparent border-none outline-none w-full placeholder-neutral-600 focus:ring-0 ${
                    prompt.isSystem ? 'text-pink-300' : 'text-neutral-200 focus:text-white'
                  }`}
                />
                {!prompt.isSystem && (
                  <button onClick={() => deletePrompt(index)} className="text-neutral-500 hover:text-red-400 bg-neutral-800/50 hover:bg-neutral-700 px-1 py-1 rounded transition">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {/* Macro Bar */}
              {!prompt.isSystem && (
                <div className="px-2 py-1 bg-neutral-800/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-neutral-800 relative">
                  <span className="text-[9px] text-neutral-500 tracking-wider shrink-0">插入：</span>
                  <button onClick={() => insertMacro(index, '{{裝配角色名字}}')} className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 hover:text-white hover:bg-indigo-600 transition shrink-0">角色名稱</button>
                  <button onClick={() => insertMacro(index, '{{當前狀態與內容}}')} className="text-[9px] px-1.5 py-0.5 rounded bg-neutral-700 text-neutral-300 hover:text-white hover:bg-indigo-600 transition shrink-0">前置資料</button>

                  {/* Worldbook dropdown — controlled state, opens upward */}
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setWbDropdownIdx(wbDropdownIdx === index ? null : index)}
                      className="text-[9px] px-1.5 py-0.5 rounded border border-indigo-500/50 text-indigo-300 bg-indigo-900/30 hover:bg-indigo-600 hover:text-white transition flex items-center gap-1"
                    >
                      <Book size={10} /> 自世界書引入 ▾
                    </button>
                    {wbDropdownIdx === index && (
                      <div className="absolute bottom-full left-0 mb-1 flex-col bg-neutral-800 border border-indigo-500/50 rounded shadow-2xl z-50 w-36 overflow-hidden flex">
                        <button onClick={() => { insertMacro(index, '{{WI:學校背景與規則}}'); setWbDropdownIdx(null); }} className="text-[10px] text-left px-2 py-1.5 text-neutral-300 hover:bg-indigo-600 hover:text-white">引入: 學校背景</button>
                        <button onClick={() => { insertMacro(index, '{{WI:催眠等級常識}}'); setWbDropdownIdx(null); }} className="text-[10px] text-left px-2 py-1.5 text-neutral-300 hover:bg-indigo-600 hover:text-white">引入: 催眠等級</button>
                        <button onClick={() => { insertMacro(index, '{{WI:請輸入條目}}'); setWbDropdownIdx(null); }} className="text-[10px] text-left px-2 py-1.5 text-indigo-300 hover:bg-indigo-600 hover:text-white border-t border-neutral-700 bg-neutral-800">手動輸入...</button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Content textarea */}
              <div className="p-2">
                <textarea
                  value={prompt.content}
                  disabled={prompt.isSystem}
                  onChange={e => updatePrompt(index, 'content', e.target.value)}
                  className={`w-full bg-transparent border-none p-1 text-[11px] font-mono focus:outline-none focus:ring-0 resize-y leading-relaxed dark-scrollbar ${
                    prompt.isSystem ? 'text-neutral-500 cursor-not-allowed' : 'text-indigo-200 focus:bg-neutral-900/50 placeholder-neutral-700'
                  }`}
                  style={{ minHeight: '60px' }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Add + Reset buttons */}
        <div className="flex gap-2 mb-2">
          <button
            onClick={addPrompt}
            className="flex-1 py-2 border border-dashed border-indigo-700/50 rounded-lg text-xs font-bold text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/20 hover:border-indigo-500 transition-colors flex items-center justify-center gap-1 shadow-sm"
          >
            <Plus size={16} /> 新增卡片
          </button>
          <button
            onClick={() => {
              console.info(`[HypnoOS] PromptManager: 重置上下文「${currentContext}」為預設提示詞`);
              const defaults = getDefaultPrompts(currentContext);
              setPromptsDb(prev => ({ ...prev, [currentContext]: defaults }));
            }}
            className="px-3 py-2 border border-dashed border-amber-700/50 rounded-lg text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 hover:border-amber-500 transition-colors flex items-center justify-center gap-1 shadow-sm"
            title="將當前上下文的提示詞重置為預設值"
          >
            重置為預設
          </button>
        </div>
      </div>

      {/* Bottom Bar + Preview */}
      <div className="absolute bottom-0 left-0 right-0 z-30">
        {showPreview && (
          <div className="bg-black/95 border-t border-indigo-500/50 shadow-[0_-10px_20px_rgba(0,0,0,0.5)] p-4 overflow-y-auto flex flex-col dark-scrollbar" style={{ maxHeight: '400px' }}>
            <h3 className="text-xs font-bold text-indigo-400 mb-2 flex items-center justify-between">
              最終發送組裝預覽
              <button onClick={() => setShowPreview(false)} className="text-neutral-500 hover:text-white">
                <EyeOff size={16} />
              </button>
            </h3>
            <textarea
              readOnly
              className="w-full bg-transparent text-neutral-400 font-mono text-[10px] leading-relaxed resize-none focus:outline-none flex-1 dark-scrollbar"
              style={{ minHeight: '250px' }}
              value={generatePreviewString()}
            />
          </div>
        )}

        <div className="bg-neutral-900/90 backdrop-blur border-t border-neutral-800 p-3 pt-2 flex justify-between items-center px-4">
          <span className="text-[10px] text-neutral-500">組合順序自動整合了全域與分區規範</span>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/40 border border-indigo-500/30 rounded-lg text-[11px] font-bold shadow-sm transition"
          >
            <Eye size={14} />
            {showPreview ? '收起預覽' : '預覽結合結果'}
          </button>
        </div>
      </div>
    </div>
  );
};
