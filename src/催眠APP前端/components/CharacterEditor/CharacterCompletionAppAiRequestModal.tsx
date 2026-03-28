import React, { useState, useCallback, useEffect } from 'react';
import { X, Send, Loader2, Info } from 'lucide-react';
import { DataService } from '../../services/dataService';
import { AiRequestPipelineService } from '../../services/aiRequestPipelineService';
import { buildEditorPipelineParams } from '../../prompts/characterEditorSend';
import { CharacterCompletionAppAiPatchService } from '../../services/characterCompletionAppAiPatchService';
import { CharacterCompletionAppAiPatchResult, EDITOR_SECTIONS } from '../../types';

interface CharacterCompletionAppAiRequestModalProps {
  mode: 'current' | 'all';
  activeTab: string;
  activeBranchLabel?: string;
  characterName: string;
  contextName: string; // e.g., '基本資訊' or '發情行為 (if > 80)'
  contextRaw: string;  // Only the yaml raw of the current section or branch
  allSectionsContent: string;
  worldbookContent: string;
  onClose: () => void;
  onSuccess: (result: CharacterCompletionAppAiPatchResult) => void;
}

export const CharacterCompletionAppAiRequestModal: React.FC<CharacterCompletionAppAiRequestModalProps> = ({
  mode,
  activeTab,
  activeBranchLabel,
  characterName,
  contextName,
  contextRaw,
  allSectionsContent,
  worldbookContent,
  onClose,
  onSuccess,
}) => {
  const [generationMode, setGenerationMode] = useState<'completion' | 'rewrite' | 'rebuild'>('completion');
  const [includeAllSnapshots, setIncludeAllSnapshots] = useState(mode === 'all');
  const [userInput, setUserInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSend = useCallback(async () => {
    setSending(true);
    setErrorMsg('');
    try {
      const modules = DataService.getEditorPromptModules();
      
      // Determine expected format
      const isBehavior = EDITOR_SECTIONS.find(s => s.id === activeTab)?.category === 'behavior';
      const expectedType = mode === 'all' ? 'mixed' : (isBehavior ? 'ejs' : 'yaml');

      // Build specific AI instructions
      let modeDesc = '';
      if (generationMode === 'completion') modeDesc = '【補全】(保留原有設定並補充細節)';
      else if (generationMode === 'rewrite') modeDesc = '【改寫】(基於原有設定，允許修改與最佳化細節)';
      else if (generationMode === 'rebuild') modeDesc = '【重建】(完全忽略原有設定，從頭生成)';

      let formatReq = '';
      if (mode === 'all') {
         formatReq = `請務必使用 <yaml_patch> 包裝 data 分區，使用 <ejs_patch> 包裝 behavior 分區的內容。`;
      } else if (expectedType === 'ejs') {
         formatReq = `這是行為分區的其中一個邏輯分支 payload。請務必使用 <ejs_patch> 包裝回傳的 YAML 資料，絕對不要回傳任何 \`<% if ... %>\` 等ＥＪＳ控制碼邏輯骨架！僅針對 payload 屬性進行擴寫。`;
      } else {
         formatReq = `這是靜態資料分區。請務必使用 <yaml_patch> 包裝回傳的 YAML 資料。`;
      }

      const injectedUserInput = `
=== AI 補全系統自動注入 ===
生成目標：${mode === 'all' ? '全部分區 (含所有邏輯分支)' : contextName}
生成策略：${modeDesc}
格式要求：${formatReq}
===========================
${userInput ? `使用者額外指示：\n${userInput}` : ''}
`.trim();

      const params = buildEditorPipelineParams({
        modules,
        currentSectionId: mode === 'all' ? 'all' : activeTab,
        characterName,
        userInput: injectedUserInput,
        currentSectionName: contextName,
        currentSectionYaml: contextRaw,
        allSectionsContent: includeAllSnapshots ? allSectionsContent : '',
        worldbookEntry: worldbookContent,
      });

      const response = await AiRequestPipelineService.request(params);

      if (response.ok && response.responseText) {
        const patchResult = CharacterCompletionAppAiPatchService.characterCompletionAppParseAiResponse(
          response.responseText,
          expectedType
        );
        onSuccess(patchResult);
      } else {
        setErrorMsg(`AI 請求失敗：${response.error || '空回應'}`);
      }

    } catch (err) {
      console.error('[HypnoOS] AiRequestModal: 發送失敗', err);
      setErrorMsg(`發生例外錯誤：${err instanceof Error ? err.message : '未知錯誤'}`);
    } finally {
      setSending(false);
    }
  }, [generationMode, includeAllSnapshots, userInput, mode, activeTab, characterName, contextName, contextRaw, allSectionsContent, worldbookContent, onSuccess]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#121212] border border-neutral-800 rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
          <div className="flex items-center gap-2">
            <span className="text-amber-400">✨</span>
            <h2 className="text-[13px] font-bold text-neutral-200">AI 智能補全請求</h2>
          </div>
          <button onClick={onClose} disabled={sending} className="text-neutral-500 hover:text-white transition">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 text-xs">
          
          <div className="bg-neutral-900/80 rounded-lg p-3 space-y-1.5 border border-amber-900/30">
            <div className="flex items-center gap-1.5 text-amber-500 font-medium">
              <Info size={12} /> 目標對象
            </div>
            <div className="text-neutral-300 font-mono text-[11px] bg-black/30 px-2 py-1 rounded">
              {mode === 'all' ? '全部分區 (完整角色設定)' : contextName}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div>
              <label className="text-neutral-500 mb-1.5 block">生成策略</label>
              <div className="flex gap-2">
                {[
                  { value: 'completion', label: '補全 (預設)', desc: '保留現有資料，僅填充缺失項目' },
                  { value: 'rewrite', label: '改寫', desc: '允許 AI 修改現有資料' },
                  { value: 'rebuild', label: '重建', desc: '無底線全盤重寫 (高風險)' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGenerationMode(opt.value as any)}
                    className={`flex-1 py-1.5 px-2 rounded-lg border text-center transition ${
                      generationMode === opt.value
                        ? opt.value === 'rebuild' ? 'border-red-500/50 bg-red-500/10 text-red-200' : 'border-indigo-500/50 bg-indigo-500/10 text-indigo-200'
                        : 'border-neutral-800 bg-neutral-900 text-neutral-500 hover:text-neutral-300'
                    }`}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {generationMode === 'rebuild' && (
                <div className="text-[10px] text-red-400 mt-1">警告：重建模式會讓 AI 大幅覆寫內容。</div>
              )}
            </div>

            <div>
              <label className="text-neutral-500 mb-1.5 block">擴展上下文</label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={includeAllSnapshots}
                  onChange={e => setIncludeAllSnapshots(e.target.checked)}
                  disabled={mode === 'all'} // always true for 'all' mode
                  className="rounded border-neutral-700 bg-neutral-900 text-indigo-500 focus:ring-0 focus:ring-offset-0 disabled:opacity-50"
                />
                <span className={`text-[11px] ${mode === 'all' ? 'text-neutral-600' : 'text-neutral-300 group-hover:text-white transition'}`}>
                  附帶全部分區快照供 AI 參考 {mode === 'all' && '(已鎖定開啟)'}
                </span>
              </label>
            </div>
          </div>

          {/* User Input */}
          <div className="space-y-1.5">
            <label className="text-neutral-500 flex justify-between">
              <span>額外指示 (選填)</span>
            </label>
            <textarea
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-neutral-300 placeholder-neutral-600 focus:outline-none focus:border-indigo-500/50 resize-y dark-scrollbar"
              rows={3}
              placeholder="例如：請讓角色的語氣更傲嬌一點、在發情時會更主動..."
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
            />
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="text-red-400 bg-red-500/10 border border-red-500/20 p-2 rounded-lg text-[10px]">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-neutral-900/50 border-t border-neutral-800 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-1.5 rounded-lg text-neutral-400 hover:bg-neutral-800 hover:text-white transition disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-[0_0_10px_rgba(79,70,229,0.3)] transition disabled:opacity-50"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {sending ? '處理中...' : '送出請求'}
          </button>
        </div>

      </div>
    </div>
  );
};
