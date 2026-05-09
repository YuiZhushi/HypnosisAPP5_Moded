import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, RefreshCw, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { MockApiSettings } from '../mock/mockModels';

type SelectDropdownProps<T extends string> = {
  value: T | undefined;
  options: { label: string; value: T }[];
  onChange: (v: T) => void;
  placeholder?: string;
};

function SelectDropdown<T extends string>({
  value,
  options,
  onChange,
  placeholder = '— 選擇選項 —',
}: SelectDropdownProps<T>) {
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
        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
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
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/60 transition-colors"
      >
        <span className={value ? '' : 'text-white/40'}>{value || '— 選擇模型 —'}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

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

export type ApiSettingsSectionProps = {
  initialSettings: MockApiSettings;
  availableModels: string[];
  onSave: (settings: Partial<MockApiSettings>) => Promise<void>;
  onFetchModels: () => Promise<void>;
};

export function ApiSettingsSection({ initialSettings, availableModels, onSave, onFetchModels }: ApiSettingsSectionProps) {
  const [form, setForm] = useState<MockApiSettings>(initialSettings);
  const [showKey, setShowKey] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Sync form if initialSettings changes from parent
  useEffect(() => {
    setForm(initialSettings);
  }, [initialSettings]);

  const patch = useCallback(
    <K extends keyof MockApiSettings>(key: K, value: MockApiSettings[K]) => {
      setForm(prev => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleFetchModels = async () => {
    if (!form.apiEndpoint) return;
    setFetchStatus('loading');
    try {
      await onFetchModels();
      setFetchStatus('ok');
    } catch {
      setFetchStatus('error');
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await onSave(form);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-4">
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
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

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

      <div className="flex flex-col gap-1">
        <label className="text-xs text-white/60">模型名稱</label>
        <div className="flex gap-2">
          {availableModels.length > 0 ? (
            <ModelDropdown
              value={form.modelName ?? ''}
              options={availableModels}
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
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : fetchStatus === 'ok' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : fetchStatus === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
          </button>
        </div>
        {fetchStatus === 'error' && (
          <p className="text-xs text-red-400">無法獲取模型列表，請檢查端點和金鑰</p>
        )}
      </div>

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

      <div className="h-px bg-white/10" />

      <div className="flex flex-col gap-4">
        <SliderRow
          label={`溫度 (Temperature)`}
          value={form.temperature ?? 0.7}
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
          value={form.topP ?? 0.95}
          min={0}
          max={1}
          step={0.05}
          onChange={v => patch('topP', v)}
        />
        <SliderRow
          label="Presence Penalty"
          value={form.presencePenalty ?? 0.2}
          min={-2}
          max={2}
          step={0.1}
          onChange={v => patch('presencePenalty', parseFloat(v.toFixed(1)))}
        />
        <SliderRow
          label="Frequency Penalty"
          value={form.frequencyPenalty ?? 0.3}
          min={-2}
          max={2}
          step={0.1}
          onChange={v => patch('frequencyPenalty', parseFloat(v.toFixed(1)))}
        />
      </div>

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
