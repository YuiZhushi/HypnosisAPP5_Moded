import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, FlaskConical, MoveDown, MoveUp, Play, RefreshCw, Save, Send, XCircle } from 'lucide-react';
import { DataService } from '../services/dataService';
import { AiPromptService } from '../services/aiPromptService';
import type { PromptTemplate } from '../types';

const APP_ID = 'common' as const;
const CONTEXT_ID = 'debug_send';
const GLOBAL_RULE_CONTEXT_ID = 'global_output';

type DebugTemplate = PromptTemplate & {
  enabled: boolean;
};

const DEFAULT_TEMPLATE_PRESETS: Array<{ id: string; title: string; templates: DebugTemplate[] }> = [
  {
    id: 'basic',
    title: '一般測試',
    templates: [
      {
        id: 'dbg_basic_1',
        title: '任務說明',
        content: '你是測試助手。請先用 3 點條列總結收到的需求，再回覆「測試完成」。',
        isSystem: false,
        enabled: true,
      },
    ],
  },
  {
    id: 'json',
    title: 'JSON 結構測試',
    templates: [
      {
        id: 'dbg_json_1',
        title: 'JSON 輸出要求',
        content:
          '請依照以下格式輸出 JSON：{"summary": string, "action_items": string[]}。\n不要輸出任何 JSON 以外文字。',
        isSystem: false,
        enabled: true,
      },
    ],
  },
  {
    id: 'character',
    title: '角色資料補全測試',
    templates: [
      {
        id: 'dbg_char_1',
        title: '角色補全規則',
        content:
          '依據 {{裝配角色名字}} 與 {{當前狀態與內容}}，補齊以下欄位：\n1) 性格\n2) 動機\n3) 語氣\n每項 1~2 句。',
        isSystem: false,
        enabled: true,
      },
    ],
  },
];

function toDebugTemplate(template: PromptTemplate): DebugTemplate {
  return {
    ...template,
    enabled: true,
  };
}

function fromDebugTemplate(template: DebugTemplate): PromptTemplate {
  return {
    id: template.id,
    title: template.title,
    content: template.content,
    isSystem: template.isSystem,
  };
}

function createEmptyTemplate(): DebugTemplate {
  return {
    id: `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    title: '新模板',
    content: '',
    isSystem: false,
    enabled: true,
  };
}

export function SettingsAIDebugSection() {
  const [templates, setTemplates] = useState<DebugTemplate[]>([]);
  const [globalRules, setGlobalRules] = useState<PromptTemplate[]>([]);
  const [contextId, setContextId] = useState(CONTEXT_ID);
  const [mode, setMode] = useState('debug');
  const [xmlTag, setXmlTag] = useState('通用AI調試');
  const [appName, setAppName] = useState('Settings Debug');
  const [sectionName, setSectionName] = useState('AI 發送調適');
  const [characterName, setCharacterName] = useState('');
  const [currentData, setCurrentData] = useState('');
  const [playerDirection, setPlayerDirection] = useState('');

  const [builtPrompt, setBuiltPrompt] = useState('');
  const [rawTemplatePreview, setRawTemplatePreview] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const [responseRaw, setResponseRaw] = useState('');
  const [responseCleaned, setResponseCleaned] = useState('');

  useEffect(() => {
    const profile = DataService.getAiPromptProfile(APP_ID) ?? {};
    const loadedTemplates = (profile[CONTEXT_ID] ?? []).map(toDebugTemplate);
    const loadedRules = profile[GLOBAL_RULE_CONTEXT_ID] ?? [];

    setTemplates(loadedTemplates.length > 0 ? loadedTemplates : DEFAULT_TEMPLATE_PRESETS[0].templates);
    setGlobalRules(loadedRules);
  }, []);

  const enabledTemplates = useMemo(() => templates.filter(t => t.enabled), [templates]);

  const buildRawTemplatePreview = (): string => {
    const lines: string[] = [];
    lines.push('// ====== 啟用中的模板塊 ======');
    for (const t of enabledTemplates) {
      lines.push(`\n--- [${t.title}] ---`);
      lines.push(t.content || '(空內容)');
    }
    if (globalRules.length > 0) {
      lines.push('\n// ====== 全局輸出規範 ======');
      for (const rule of globalRules) {
        lines.push(`\n--- [${rule.title}] ---`);
        lines.push(rule.content || '(空內容)');
      }
    }
    return lines.join('\n').trim();
  };

  const updateTemplate = (index: number, patch: Partial<DebugTemplate>) => {
    setTemplates(prev => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const removeTemplate = (index: number) => {
    setTemplates(prev => prev.filter((_, idx) => idx !== index));
  };

  const moveTemplate = (index: number, direction: -1 | 1) => {
    setTemplates(prev => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= prev.length) return prev;
      const arr = [...prev];
      const [moved] = arr.splice(index, 1);
      arr.splice(nextIndex, 0, moved);
      return arr;
    });
  };

  const handleSaveTemplates = async () => {
    const profile = DataService.getAiPromptProfile(APP_ID) ?? {};
    const nextProfile: Record<string, PromptTemplate[]> = {
      ...profile,
      [CONTEXT_ID]: templates.map(fromDebugTemplate),
      [GLOBAL_RULE_CONTEXT_ID]: globalRules,
    };
    await DataService.saveAiPromptProfile(APP_ID, nextProfile);
    setStatus({ ok: true, message: '模板設定已保存' });
    console.info('[HypnoOS] SettingsAIDebugSection: 已保存 common/debug_send 模板');
  };

  const handleLoadPreset = (presetId: string) => {
    const preset = DEFAULT_TEMPLATE_PRESETS.find(v => v.id === presetId);
    if (!preset) return;
    setTemplates(
      preset.templates.map(t => ({
        ...t,
        id: `preset_${preset.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      })),
    );
    setStatus({ ok: true, message: `已套用模板組：${preset.title}` });
  };

  const buildPrompt = async () => {
    setLoadingPreview(true);
    try {
      const rawText = buildRawTemplatePreview();
      setRawTemplatePreview(rawText);
      const prompt = await AiPromptService.buildFinalPrompt({
        appId: APP_ID,
        contextId,
        mode,
        sectionName,
        templates: enabledTemplates.map(fromDebugTemplate),
        globalRules,
        currentData,
        characterName,
        playerDirection,
        appName,
        xmlTag,
      });
      setBuiltPrompt(prompt);
      setStatus({ ok: true, message: '已產生最終 Prompt 預覽' });
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : '產生 Prompt 失敗' });
    } finally {
      setLoadingPreview(false);
    }
  };

  const sendRequest = async () => {
    setSending(true);
    try {
      const result = await AiPromptService.request({
        appId: APP_ID,
        contextId,
        mode,
        sectionName,
        templates: enabledTemplates.map(fromDebugTemplate),
        globalRules,
        currentData,
        characterName,
        playerDirection,
        appName,
        xmlTag,
      });

      setBuiltPrompt(result.prompt);
      if (result.ok) {
        const rawText = result.responseText ?? '';
        const envelope = AiPromptService.receiveAndParse(rawText);
        const cleanedText = typeof envelope.meta?.cleanedText === 'string' ? envelope.meta.cleanedText : '';

        setResponseRaw(rawText);
        setResponseCleaned(cleanedText);
        setStatus({ ok: true, message: '已以背景請求送出並取得模型回應（未寫入聊天欄）' });
      } else {
        setStatus({ ok: false, message: result.error ?? '發送失敗' });
      }
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error ? err.message : '發送失敗' });
    } finally {
      setSending(false);
    }
  };

  const renderReadonlyPreview = (value: string, placeholder: string, minHeightClass: string) => (
    <div className={`w-full bg-black/20 border border-white/10 rounded px-2 py-1 ${minHeightClass} overflow-y-auto`}>
      <pre className="font-mono text-[11px] whitespace-pre-wrap break-words text-white/85">
        {value || <span className="text-white/35">{placeholder}</span>}
      </pre>
    </div>
  );

  return (
    <div className="flex flex-col gap-4 text-xs text-white/80">
      <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 flex items-start gap-2">
        <FlaskConical size={14} className="text-cyan-300 mt-0.5" />
        <p className="leading-relaxed text-cyan-100/80">
          這裡是通用 AI 發送調適頁。可配置模板塊、預覽最終 Prompt、送出背景測試，並直接顯示 AI 回應。
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-white">模板塊</h3>
          <div className="flex gap-2">
            {DEFAULT_TEMPLATE_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handleLoadPreset(preset.id)}
                className="px-2 py-1 rounded-md bg-indigo-600/20 text-indigo-200 hover:bg-indigo-600/35"
              >
                套用：{preset.title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {templates.map((template, index) => (
            <div key={template.id} className="rounded-lg border border-white/10 bg-black/20 p-2 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={template.title}
                  onChange={e => updateTemplate(index, { title: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs"
                  placeholder="模板標題"
                />
                <label className="flex items-center gap-1 text-[11px] text-white/60">
                  <input
                    type="checkbox"
                    checked={template.enabled}
                    onChange={e => updateTemplate(index, { enabled: e.target.checked })}
                  />
                  啟用
                </label>
                <button
                  onClick={() => moveTemplate(index, -1)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10"
                  title="上移"
                >
                  <MoveUp size={13} />
                </button>
                <button
                  onClick={() => moveTemplate(index, 1)}
                  className="p-1 rounded bg-white/5 hover:bg-white/10"
                  title="下移"
                >
                  <MoveDown size={13} />
                </button>
                <button
                  onClick={() => removeTemplate(index)}
                  className="p-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                  title="刪除"
                >
                  <XCircle size={13} />
                </button>
              </div>
              <textarea
                value={template.content}
                onChange={e => updateTemplate(index, { content: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 h-24 text-[11px] font-mono resize-y"
                placeholder="模板內容..."
                spellCheck={false}
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTemplates(prev => [...prev, createEmptyTemplate()])}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15"
          >
            新增模板
          </button>
          <button
            onClick={() => void handleSaveTemplates()}
            className="px-3 py-1.5 rounded-lg bg-emerald-600/30 text-emerald-100 hover:bg-emerald-600/45 flex items-center gap-1"
          >
            <Save size={13} /> 保存模板
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
        <h3 className="font-semibold text-white">預覽發送參數</h3>
        <div className="grid grid-cols-2 gap-2">
          <input value={contextId} onChange={e => setContextId(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="contextId" />
          <input value={mode} onChange={e => setMode(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="mode" />
          <input value={xmlTag} onChange={e => setXmlTag(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="xmlTag" />
          <input value={appName} onChange={e => setAppName(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="appName" />
          <input value={sectionName} onChange={e => setSectionName(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="sectionName" />
          <input value={characterName} onChange={e => setCharacterName(e.target.value)} className="bg-white/5 border border-white/10 rounded px-2 py-1" placeholder="characterName" />
        </div>
        <textarea
          value={currentData}
          onChange={e => setCurrentData(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 h-24 font-mono text-[11px] resize-y"
          placeholder="currentData"
          spellCheck={false}
        />
        <textarea
          value={playerDirection}
          onChange={e => setPlayerDirection(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded px-2 py-1 h-20 font-mono text-[11px] resize-y"
          placeholder="playerDirection"
          spellCheck={false}
        />

        <div className="flex gap-2">
          <button
            onClick={() => void buildPrompt()}
            disabled={loadingPreview}
            className="px-3 py-1.5 rounded-lg bg-indigo-600/35 text-indigo-100 hover:bg-indigo-600/50 flex items-center gap-1 disabled:opacity-50"
          >
            {loadingPreview ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
            產生最終 Prompt
          </button>
          <button
            onClick={() => void sendRequest()}
            disabled={sending}
            className="px-3 py-1.5 rounded-lg bg-cyan-600/35 text-cyan-100 hover:bg-cyan-600/50 flex items-center gap-1 disabled:opacity-50"
          >
            {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
            送出測試
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <h3 className="font-semibold text-white">預覽結果</h3>
        {renderReadonlyPreview(rawTemplatePreview, '原始模板組合預覽', 'min-h-20 max-h-48')}
        {renderReadonlyPreview(builtPrompt, '最終 Prompt（placeholder 解析後）', 'min-h-28 max-h-56')}
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <h3 className="font-semibold text-white">回應顯示（背景請求結果）</h3>
        {renderReadonlyPreview(responseRaw, 'raw response', 'min-h-20 max-h-48')}
        {renderReadonlyPreview(responseCleaned, 'cleaned response（移除 code block 包裹）', 'min-h-20 max-h-48')}
      </div>

      {status && (
        <div className={`rounded-lg border px-3 py-2 flex items-center gap-2 ${status.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
          {status.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          <span>{status.message}</span>
        </div>
      )}
    </div>
  );
}
