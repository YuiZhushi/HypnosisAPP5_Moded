import React, { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Settings, Cpu } from 'lucide-react';
import { ApiSettingsSection } from './components/ApiSettingsSection';
import { MockApi } from '../mock/mockApi';
import { MockApiSettings } from '../mock/mockModels';

export const useSettingsRuntimeData = () => {
  const [apiSettings, setApiSettings] = useState<MockApiSettings | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    setError(null);
    try {
      const [settingsData, modelsData] = await Promise.all([
        MockApi.getApiSettings(),
        MockApi.fetchAvailableModels()
      ]);
      setApiSettings(settingsData);
      setAvailableModels(modelsData);
    } catch (err) {
      console.error('[useSettingsRuntimeData] Error fetching settings:', err);
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  const saveApiSettings = useCallback(async (newSettings: Partial<MockApiSettings>) => {
    try {
      await MockApi.updateApiSettings(newSettings);
      await fetchSettings(false); // Refresh local state in background
    } catch (err) {
      console.error('[useSettingsRuntimeData] Error saving settings:', err);
      throw err;
    }
  }, [fetchSettings]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    apiSettings,
    availableModels,
    isLoading,
    error,
    refresh: fetchSettings,
    saveApiSettings
  };
};

export type SettingsSectionDef = {
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  Component: React.ComponentType<any>;
};

export const SETTINGS_SECTIONS: SettingsSectionDef[] = [];

SETTINGS_SECTIONS.push({
  id: 'api',
  title: 'AI API 設定',
  icon: Cpu,
  Component: ApiSettingsSection,
});

export function SettingsApp({ onBack }: { onBack: () => void }) {
  const { apiSettings, availableModels, isLoading, error, refresh, saveApiSettings } = useSettingsRuntimeData();

  const allSections = SETTINGS_SECTIONS;
  const [activeId, setActiveId] = useState<string>(allSections[0]?.id ?? '');

  const activeSection = allSections.find(s => s.id === activeId);

  if (isLoading) {
    return (
      <div className="flex h-full w-full flex-col bg-gray-950 text-white items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        </div>
        <div className="text-sm text-gray-400 mt-4">載入設定中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col bg-gray-950 text-white items-center justify-center px-6">
        <div className="text-lg text-red-400 font-medium mb-2">載入失敗</div>
        <div className="text-sm text-gray-500 mb-4">{error}</div>
        <div className="flex gap-3">
          <button className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors" onClick={() => refresh(true)}>重試</button>
          <button className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors" onClick={onBack}>返回</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-[#0d0a1a] text-white font-sans overflow-hidden">
      <div className="relative flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 bg-[#0d0a1a] shrink-0 w-full border-b border-white/5">
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 text-gray-300 hover:text-white transition-colors group shrink-0"
          aria-label="返回OS"
        >
          <ChevronLeft className="w-4 h-4 md:w-5 md:h-5 group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-xs md:text-sm">返回 OS</span>
        </button>

        <span className="absolute left-1/2 -translate-x-1/2 font-bold text-sm md:text-base tracking-widest text-white flex items-center gap-1.5">
          <Settings className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-400" />
          設置
        </span>

        <div className="w-14"></div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <nav className="flex-none w-16 md:w-20 border-r border-white/5 overflow-y-auto no-scrollbar py-2 bg-[#0c0a1e]">
          {allSections.map(section => {
            const Icon = section.icon;
            const isActive = section.id === activeId;
            return (
              <button
                key={section.id}
                onClick={() => setActiveId(section.id)}
                className={`w-full flex flex-col items-center gap-1 py-3 px-1 transition-colors text-center border-l-2 ${
                  isActive ? 'bg-purple-600/10 text-purple-300 border-purple-500' : 'text-white/50 hover:text-white/80 hover:bg-white/5 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4 md:w-5 md:h-5" />
                <span className="text-[10px] leading-tight mt-0.5">{section.title}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto hypno-scrollbar px-3 py-4 md:px-4">
          {activeSection ? (
            <>
              <h2 className="text-sm font-semibold text-white/80 mb-4">{activeSection.title}</h2>
              {activeSection.id === 'api' && apiSettings && (
                <ApiSettingsSection
                  initialSettings={apiSettings}
                  availableModels={availableModels}
                  onSave={saveApiSettings}
                  onFetchModels={() => refresh(false)}
                />
              )}
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
