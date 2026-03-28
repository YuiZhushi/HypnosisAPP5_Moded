import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ChevronLeft,
  Settings,
  Cpu,
  ChevronRight,
  ChevronDown,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Eye,
  EyeOff,
  Bot,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Save,
  RotateCcw,
  Send,
  Plus,
  Trash2,
} from 'lucide-react';
import { DataService, type SettingsPromptTuningConfig } from '../services/dataService';
import { ApiSettings } from '../types';
import { AiRequestPipelineService } from '../services/aiRequestPipelineService';

// ─── Extensibility: Section Registry ───────────────────────────────────────
// To add a new settings section from another APP, push an entry to this array.
// Each entry needs: { id, title, icon (Lucide component), Component }
// The Component will receive { onDirty: () => void } as props.

export type SettingsSectionProps = {
  /** Call this when the section has unsaved changes, to let the parent know */
  onDirty?: () => void;
};

export type SettingsSectionDef = {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  Component: React.ComponentType<SettingsSectionProps>;
};

// Mutable registry — other modules can push into this before the component renders
export const SETTINGS_SECTIONS: SettingsSectionDef[] = [];

// ─── Default values ─────────────────────────────────────────────────────────
const DEFAULT_API: ApiSettings = {
  apiKey: '',
  apiEndpoint: '',
  modelName: '',
  temperature: 0.7,
  maxTokens: 2048,
  topP: 1,
  presencePenalty: 0,
  frequencyPenalty: 0,
  streamMode: 'non_streaming',
};

// ─── Custom dropdown (replaces native <select>) ─────────────────────────────
function ModelDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60 transition-colors"
      >
        <span className={value ? '' : 'text-white/40'}>{value || '— 選擇模型 —'}</span>
        <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Options list */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#1e1b2e] border border-white/10 rounded-lg shadow-xl max-h-48 overflow-y-auto dark-scrollbar">
          <button
            type="button"
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-purple-600/30 ${
              !value ? 'text-purple-300 bg-purple-600/15' : 'text-white/60'
            }`}
          >
            — 選擇模型 —
          </button>
          {options.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => { onChange(m); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-purple-600/30 ${
                m === value ? 'text-purple-300 bg-purple-600/15' : 'text-white/80'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Generic Select Dropdown ────────────────────────────────────────────────
function SelectDropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = '— 選擇選項 —',
}: {
  value: T | undefined;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const currentLabel = options.find(o => o.value === value)?.label;

  return (
    <div ref={containerRef} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60 transition-colors"
      >
        <span className={currentLabel ? '' : 'text-white/40'}>{currentLabel || placeholder}</span>
        <ChevronDown size={14} className={`text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-30 bg-[#1e1b2e] border border-white/10 rounded-lg shadow-xl overflow-y-auto dark-scrollbar">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-purple-600/30 ${
                o.value === value ? 'text-purple-300 bg-purple-600/15' : 'text-white/80'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Helper: Slider row ─────────────────────────────────────────────────────
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between items-center">
        <span className="text-xs text-white/60">{label}</span>
        <span className="text-xs font-mono text-purple-300">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full accent-purple-500 cursor-pointer"
      />
    </div>
  );
}

// ─── AI API Settings Section ─────────────────────────────────────────────────
function ApiSettingsSection({ onDirty }: SettingsSectionProps) {
  const [form, setForm] = useState<ApiSettings>(DEFAULT_API);
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Load saved settings on mount
  useEffect(() => {
    const saved = DataService.getApiSettings();
    if (saved) setForm({ ...DEFAULT_API, ...saved });
  }, []);

  const patch = useCallback(
    <K extends keyof ApiSettings>(key: K, value: ApiSettings[K]) => {
      setForm(prev => ({ ...prev, [key]: value }));
      onDirty?.();
    },
    [onDirty],
  );

  const handleFetchModels = async () => {
    if (!form.apiEndpoint) return;
    setFetchStatus('loading');
    try {
      const list = await DataService.fetchAvailableModels(form.apiEndpoint, form.apiKey);
      setModels(list);
      setFetchStatus(list.length > 0 ? 'ok' : 'error');
    } catch {
      setFetchStatus('error');
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await DataService.updateApiSettings(form);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* API Key */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">API 金鑰</label>
        <div className="flex gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={form.apiKey}
            onChange={e => patch('apiKey', e.target.value)}
            placeholder="sk-..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60"
          />
          <button
            onClick={() => setShowKey(v => !v)}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white transition-colors"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Endpoint */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">API 端點網址</label>
        <input
          type="url"
          value={form.apiEndpoint}
          onChange={e => patch('apiEndpoint', e.target.value)}
          placeholder="https://api.openai.com"
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60"
        />
      </div>

      {/* Model name + fetch */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">模型名稱</label>
        <div className="flex gap-2">
          {models.length > 0 ? (
              <ModelDropdown
                value={form.modelName}
                options={models}
                onChange={v => patch('modelName', v)}
              />
           ) : (
            <input
              type="text"
              value={form.modelName}
              onChange={e => patch('modelName', e.target.value)}
              placeholder="gpt-4o"
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/60"
            />
          )}
          <button
            onClick={handleFetchModels}
            disabled={!form.apiEndpoint || fetchStatus === 'loading'}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white disabled:opacity-40 transition-colors"
            title="從端點獲取可用模型"
          >
            {fetchStatus === 'loading' ? (
              <RefreshCw size={16} className="animate-spin" />
            ) : fetchStatus === 'ok' ? (
              <CheckCircle size={16} className="text-green-400" />
            ) : fetchStatus === 'error' ? (
              <AlertCircle size={16} className="text-red-400" />
            ) : (
              <RefreshCw size={16} />
            )}
          </button>
        </div>
        {fetchStatus === 'error' && (
          <p className="text-xs text-red-400">無法獲取模型列表，請檢查端點和金鑰</p>
        )}
      </div>

      {/* Stream Mode */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">輸出模式 (Streaming Compatibility)</label>
        <div className="flex gap-2">
          <SelectDropdown
            value={form.streamMode ?? 'non_streaming'}
            onChange={v => patch('streamMode', v)}
            options={[
              { value: 'streaming', label: '流式 (Streaming)' },
              { value: 'fake_streaming', label: '假流式 (Fake Streaming)' },
              { value: 'non_streaming', label: '非流式 (Non-Streaming)' },
            ]}
          />
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-white/10" />

      {/* Sliders */}
      <div className="flex flex-col gap-4">
        <SliderRow
          label={`溫度 (Temperature)`}
          value={form.temperature}
          min={0}
          max={2}
          step={0.05}
          onChange={v => patch('temperature', v)}
        />
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-white/60">最大輸出 Token</span>
            <input
              type="number"
              min={1}
              max={128000}
              value={form.maxTokens}
              onChange={e => patch('maxTokens', parseInt(e.target.value) || 1)}
              className="w-20 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-purple-300 font-mono text-right focus:outline-none focus:border-purple-500/60"
            />
          </div>
        </div>
        <SliderRow
          label="Top-p"
          value={form.topP}
          min={0}
          max={1}
          step={0.05}
          onChange={v => patch('topP', v)}
        />
        <SliderRow
          label="Top-k"
          value={form.topK ?? 0.2}
          min={0}
          max={1}
          step={0.05}
          onChange={v => patch('topK', v)}
        />
        <SliderRow
          label="Presence Penalty"
          value={form.presencePenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={v => patch('presencePenalty', parseFloat(v.toFixed(1)))}
        />
        <SliderRow
          label="Frequency Penalty"
          value={form.frequencyPenalty}
          min={-2}
          max={2}
          step={0.1}
          onChange={v => patch('frequencyPenalty', parseFloat(v.toFixed(1)))}
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saveStatus === 'saving'}
        className={`mt-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-all ${
          saveStatus === 'saved'
            ? 'bg-green-600/80 text-white'
            : saveStatus === 'error'
            ? 'bg-red-600/80 text-white'
            : 'bg-purple-600 hover:bg-purple-500 text-white'
        }`}
      >
        {saveStatus === 'saving'
          ? '保存中...'
          : saveStatus === 'saved'
          ? '✓ 已保存'
          : saveStatus === 'error'
          ? '保存失敗'
          : '保存設置'}
      </button>
    </div>
  );
}

type SettingsPromptTab = 'modules' | 'placeholders' | 'preview';

const PLACEHOLDER_KEY_REGEX = /^[a-zA-Z0-9_-]+$/;

// IDs of default (built-in) modules — cannot be deleted
const DEFAULT_MODULE_IDS = new Set(['mod_test_system', 'mod_test_user']);
// Keys of default (built-in) placeholders — cannot be deleted
const DEFAULT_PLACEHOLDER_KEYS = new Set(['target_name', 'scene', 'tone', 'user_goal']);

function SettingsPromptTuningSection({ onDirty }: SettingsSectionProps) {
  const [settings, setSettings] = useState<SettingsPromptTuningConfig | null>(null);
  const [activeTab, setActiveTab] = useState<SettingsPromptTab>('modules');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [sending, setSending] = useState(false);
  const [previewPrompt, setPreviewPrompt] = useState('');
  const [previewResponse, setPreviewResponse] = useState('');
  const [previewError, setPreviewError] = useState<string | null>(null);

  // -- New placeholder form state --
  const [showNewPlaceholder, setShowNewPlaceholder] = useState(false);
  const [newPlaceholderKey, setNewPlaceholderKey] = useState('');
  const [newPlaceholderError, setNewPlaceholderError] = useState<string | null>(null);

  useEffect(() => {
    const loaded = DataService.getSettingsPromptConfig();
    setSettings(loaded);
  }, []);

  const markDirty = () => onDirty?.();

  const patchSettings = (updater: (prev: SettingsPromptTuningConfig) => SettingsPromptTuningConfig) => {
    setSettings(prev => {
      if (!prev) return prev;
      const next = updater(prev);
      markDirty();
      return next;
    });
  };

  const updateModuleField = (moduleId: string, patch: Partial<{ title: string; content: string; enabled: boolean }>) => {
    patchSettings(prev => ({
      ...prev,
      modules: prev.modules.map(m => (m.id === moduleId ? { ...m, ...patch } : m)),
    }));
  };

  const moveModule = (moduleId: string, direction: -1 | 1) => {
    patchSettings(prev => {
      const order = [...prev.moduleOrder];
      const idx = order.indexOf(moduleId);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= order.length) return prev;
      [order[idx], order[nextIdx]] = [order[nextIdx], order[idx]];
      return { ...prev, moduleOrder: order };
    });
  };

  // -- Add custom module --
  const handleAddModule = () => {
    patchSettings(prev => {
      // Generate unique ID
      let newId: string;
      let counter = 0;
      do {
        newId = `settings_custom_${Date.now()}_${counter}`;
        counter++;
      } while (prev.modules.some(m => m.id === newId));

      const newModule = {
        id: newId,
        title: '新自訂模塊',
        content: '',
        enabled: true,
      };
      return {
        ...prev,
        modules: [...prev.modules, newModule],
        moduleOrder: [...prev.moduleOrder, newId],
      };
    });
  };

  // -- Delete custom module --
  const handleDeleteModule = (moduleId: string) => {
    if (DEFAULT_MODULE_IDS.has(moduleId)) return;
    patchSettings(prev => ({
      ...prev,
      modules: prev.modules.filter(m => m.id !== moduleId),
      moduleOrder: prev.moduleOrder.filter(id => id !== moduleId),
    }));
  };

  const updatePlaceholderValue = (key: string, patch: Partial<{ value: string; enabled: boolean }>) => {
    patchSettings(prev => ({
      ...prev,
      placeholders: prev.placeholders.map(p => (p.key === key ? { ...p, ...patch } : p)),
    }));
  };

  // -- Add custom placeholder --
  const handleAddPlaceholder = () => {
    const trimmed = newPlaceholderKey.trim();
    if (!trimmed) {
      setNewPlaceholderError('佔位符 key 不能為空');
      return;
    }
    if (!PLACEHOLDER_KEY_REGEX.test(trimmed)) {
      setNewPlaceholderError('只能包含英文字母、數字、底線（_）、減號（-）');
      return;
    }
    if (settings?.placeholders.some(p => p.key === trimmed)) {
      setNewPlaceholderError(`佔位符 "${trimmed}" 已存在`);
      return;
    }
    patchSettings(prev => ({
      ...prev,
      placeholders: [
        ...prev.placeholders,
        {
          key: trimmed,
          value: '',
          enabled: true,
          source: 'user' as const,
          resolverType: 'static' as const,
          scope: 'app' as const,
        },
      ],
    }));
    setNewPlaceholderKey('');
    setNewPlaceholderError(null);
    setShowNewPlaceholder(false);
  };

  // -- Delete custom placeholder --
  const handleDeletePlaceholder = (key: string) => {
    if (DEFAULT_PLACEHOLDER_KEYS.has(key)) return;
    patchSettings(prev => ({
      ...prev,
      placeholders: prev.placeholders.filter(p => p.key !== key),
    }));
  };

  const handleRestoreDefault = () => {
    setSettings(DataService.getDefaultSettingsPromptConfig());
    setPreviewError(null);
    setPreviewPrompt('');
    setPreviewResponse('');
    markDirty();
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaveStatus('saving');
    try {
      await DataService.updateSettingsPromptConfig(settings);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 1800);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 1800);
    }
  };

  const handleComposePreview = () => {
    if (!settings) return;
    try {
      const enabledModules = settings.moduleOrder
        .map(id => settings.modules.find(m => m.id === id))
        .filter(Boolean)
        .filter(m => m!.enabled)
        .map(m => ({ id: m!.id, content: m!.content }));
      const placeholders = Object.fromEntries(
        settings.placeholders.filter(p => p.enabled).map(p => [p.key, p.value]),
      );
      const composed = AiRequestPipelineService.composePrompt({
        modules: enabledModules,
        moduleOrder: enabledModules.map(m => m.id),
        placeholders,
      });
      setPreviewPrompt(composed);
      setPreviewError(null);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '預覽組合失敗');
      setPreviewPrompt('');
    }
  };

  const handleSendPreview = async () => {
    if (!settings) return;
    setSending(true);
    setPreviewError(null);
    setPreviewResponse('');
    try {
      const enabledModules = settings.moduleOrder
        .map(id => settings.modules.find(m => m.id === id))
        .filter(Boolean)
        .filter(m => m!.enabled)
        .map(m => ({ id: m!.id, content: m!.content }));
      const placeholders = Object.fromEntries(
        settings.placeholders.filter(p => p.enabled).map(p => [p.key, p.value]),
      );

      const result = await AiRequestPipelineService.request({
        modules: enabledModules,
        moduleOrder: enabledModules.map(m => m.id),
        placeholders,
      });

      setPreviewPrompt(result.prompt);
      if (!result.ok) {
        setPreviewError(result.error ?? '發送失敗');
        return;
      }
      setPreviewResponse(result.responseText ?? '');
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : '發送失敗');
    } finally {
      setSending(false);
    }
  };

  if (!settings) {
    return <div className="text-sm text-white/50">讀取調適設定中...</div>;
  }

  const orderedModules = settings.moduleOrder
    .map(id => settings.modules.find(m => m.id === id))
    .filter(Boolean) as SettingsPromptTuningConfig['modules'];

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'modules', label: '模塊', tab: 'modules' as const },
          { id: 'placeholders', label: '佔位符', tab: 'placeholders' as const },
          { id: 'preview', label: '預覽', tab: 'preview' as const },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.tab)}
            className={`py-2 rounded-lg text-xs transition-colors border ${
              activeTab === item.tab
                ? 'bg-cyan-600/20 border-cyan-500/40 text-cyan-200'
                : 'bg-white/5 border-white/10 text-white/60 hover:text-white/80'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {activeTab === 'modules' && (
        <div className="space-y-3">
          {orderedModules.map((module, idx) => (
            <div key={module.id} className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <GripVertical size={14} className="text-white/30" />
                <input
                  value={module.title}
                  onChange={e => updateModuleField(module.id, { title: e.target.value })}
                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
                />
                <label className="text-[11px] text-white/60 flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={module.enabled}
                    onChange={e => updateModuleField(module.id, { enabled: e.target.checked })}
                  />
                  啟用
                </label>
                {/* Delete button for custom modules only */}
                {!DEFAULT_MODULE_IDS.has(module.id) && (
                  <button
                    onClick={() => handleDeleteModule(module.id)}
                    className="p-1.5 rounded border border-red-500/30 text-red-400/70 hover:text-red-300 hover:border-red-400/50 transition-colors"
                    title="刪除此自訂模塊"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <textarea
                value={module.content}
                onChange={e => updateModuleField(module.id, { content: e.target.value })}
                className="w-full h-28 bg-black/30 border border-white/10 rounded p-2 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => moveModule(module.id, -1)}
                  disabled={idx === 0}
                  className="p-1.5 rounded border border-white/10 text-white/60 disabled:opacity-30"
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  onClick={() => moveModule(module.id, 1)}
                  disabled={idx === orderedModules.length - 1}
                  className="p-1.5 rounded border border-white/10 text-white/60 disabled:opacity-30"
                >
                  <ArrowDown size={12} />
                </button>
              </div>
            </div>
          ))}
          {/* Add custom module button */}
          <button
            onClick={handleAddModule}
            className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 text-cyan-300/80 text-xs hover:bg-cyan-600/10 hover:text-cyan-200 transition-colors flex items-center justify-center gap-1.5"
          >
            <Plus size={14} /> 新增自訂模塊
          </button>
        </div>
      )}

      {activeTab === 'placeholders' && (
        <div className="space-y-2">
          {settings.placeholders.map(ph => (
            <div key={ph.key} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs text-cyan-200 font-mono">{'{{'}{ph.key}{'}}'}</div>
                <div className="flex items-center gap-2">
                  <label className="text-[11px] text-white/60 flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={ph.enabled}
                      onChange={e => updatePlaceholderValue(ph.key, { enabled: e.target.checked })}
                    />
                    啟用
                  </label>
                  {/* Delete button for custom placeholders only */}
                  {!DEFAULT_PLACEHOLDER_KEYS.has(ph.key) && (
                    <button
                      onClick={() => handleDeletePlaceholder(ph.key)}
                      className="p-1 rounded border border-red-500/30 text-red-400/70 hover:text-red-300 hover:border-red-400/50 transition-colors"
                      title="刪除此自訂佔位符"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>
              <input
                value={ph.value}
                onChange={e => updatePlaceholderValue(ph.key, { value: e.target.value })}
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          ))}

          {/* Add custom placeholder */}
          {showNewPlaceholder ? (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-900/10 p-3 space-y-2">
              <div className="text-xs text-cyan-200 mb-1">新增自訂佔位符</div>
              <div className="flex gap-2">
                <input
                  value={newPlaceholderKey}
                  onChange={e => {
                    setNewPlaceholderKey(e.target.value);
                    setNewPlaceholderError(null);
                  }}
                  placeholder="輸入 key（英文、數字、_、-）"
                  className="flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-500/50"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddPlaceholder(); }}
                />
                <button
                  onClick={handleAddPlaceholder}
                  className="px-3 py-1.5 rounded-lg text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
                >
                  確認
                </button>
                <button
                  onClick={() => { setShowNewPlaceholder(false); setNewPlaceholderError(null); setNewPlaceholderKey(''); }}
                  className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/60 hover:text-white transition-colors"
                >
                  取消
                </button>
              </div>
              {newPlaceholderError && (
                <div className="text-xs text-red-400">{newPlaceholderError}</div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowNewPlaceholder(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-cyan-500/40 text-cyan-300/80 text-xs hover:bg-cyan-600/10 hover:text-cyan-200 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={14} /> 新增自訂佔位符
            </button>
          )}
        </div>
      )}

      {activeTab === 'preview' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              onClick={handleComposePreview}
              className="flex-1 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/80 hover:bg-white/10"
            >
              生成預覽 Prompt
            </button>
            <button
              onClick={() => void handleSendPreview()}
              disabled={sending}
              className="flex-1 py-2 rounded-lg text-xs bg-cyan-600/80 hover:bg-cyan-500 text-white disabled:opacity-50"
            >
              {sending ? '發送中...' : '預覽發送'}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[11px] text-white/50 mb-1">發送內容</div>
            <pre className="text-xs text-white/80 whitespace-pre-wrap break-words">{previewPrompt || '（尚未生成）'}</pre>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="text-[11px] text-white/50 mb-1">AI 回應</div>
            <pre className="text-xs text-white/80 whitespace-pre-wrap break-words">{previewResponse || '（尚無回應）'}</pre>
          </div>

          {previewError && <div className="text-xs text-red-400">{previewError}</div>}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleRestoreDefault}
          className="flex-1 py-2 rounded-lg text-xs bg-white/5 border border-white/10 text-white/70 hover:text-white"
        >
          <span className="inline-flex items-center gap-1">
            <RotateCcw size={12} /> 還原預設
          </span>
        </button>
        <button
          onClick={() => void handleSave()}
          disabled={saveStatus === 'saving'}
          className={`flex-1 py-2 rounded-lg text-xs text-white ${
            saveStatus === 'saved'
              ? 'bg-green-600/80'
              : saveStatus === 'error'
              ? 'bg-red-600/80'
              : 'bg-cyan-600 hover:bg-cyan-500'
          }`}
        >
          <span className="inline-flex items-center gap-1">
            <Save size={12} />
            {saveStatus === 'saving'
              ? '保存中...'
              : saveStatus === 'saved'
              ? '已保存'
              : saveStatus === 'error'
              ? '保存失敗'
              : '保存調適'}
          </span>
        </button>
      </div>
    </div>
  );
}

// Register the built-in API settings section (at module load time)
SETTINGS_SECTIONS.push({
  id: 'api',
  title: 'AI API 設定',
  icon: Cpu,
  Component: ApiSettingsSection,
});

SETTINGS_SECTIONS.push({
  id: 'settings_prompt_tuning',
  title: 'AI 發送調適',
  icon: Bot,
  Component: SettingsPromptTuningSection,
});

// ─── Main SettingsApp Component ──────────────────────────────────────────────
export function SettingsApp({ onBack }: { onBack: () => void }) {
  const allSections = SETTINGS_SECTIONS;
  const [activeId, setActiveId] = useState<string>(allSections[0]?.id ?? '');

  const activeSection = allSections.find(s => s.id === activeId);

  return (
    <div className="w-full h-full bg-gradient-to-b from-slate-900 to-black flex flex-col text-white overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-10 pb-4 border-b border-white/10">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors active:scale-95"
        >
          <ChevronLeft size={20} />
        </button>
        <Settings size={18} className="text-purple-400" />
        <h1 className="text-lg font-semibold">設置</h1>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar (section list) */}
        <nav className="flex-none w-28 border-r border-white/10 overflow-y-auto no-scrollbar py-2">
          {allSections.map(section => {
            const Icon = section.icon;
            const isActive = section.id === activeId;
            return (
              <button
                key={section.id}
                onClick={() => setActiveId(section.id)}
                className={`w-full flex flex-col items-center gap-1.5 py-3 px-2 transition-colors text-center ${
                  isActive ? 'bg-purple-600/20 text-purple-300' : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                }`}
              >
                <Icon size={20} />
                <span className="text-[10px] leading-tight">{section.title}</span>
                {isActive && <ChevronRight size={12} className="text-purple-400" />}
              </button>
            );
          })}
        </nav>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto dark-scrollbar px-4 py-4">
          {activeSection ? (
            <>
              <h2 className="text-sm font-semibold text-white/80 mb-4">{activeSection.title}</h2>
              <activeSection.Component />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-white/30 text-sm">
              請選擇一個設定項目
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
