import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, Settings, Cpu, ChevronRight, ChevronDown, CheckCircle, AlertCircle, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { DataService } from '../services/dataService';
import { ApiSettings } from '../types';

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

// Register the built-in API settings section (at module load time)
SETTINGS_SECTIONS.push({
  id: 'api',
  title: 'AI API 設定',
  icon: Cpu,
  Component: ApiSettingsSection,
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
