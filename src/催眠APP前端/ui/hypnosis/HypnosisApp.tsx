import React, { useState, useEffect } from 'react';
import { RuntimeData } from '../mock/mockModels';
import { MockApi } from '../mock/mockApi';
import { HypnosisUseTab } from './HypnosisUseTab';
import { HypnosisManageTab } from './HypnosisManageTab';
import { HypnosisEquipmentTab } from './HypnosisEquipmentTab';
import { HypnosisProfileTab } from './HypnosisProfileTab';
import {
  ChevronLeft, Bell, ChevronDown, ChevronUp, Zap, Coins, Star,
  Monitor, Activity, FileText, Image as ImageIcon, AlignCenter,
  Volume2, Music, Smartphone, Coffee, Box, Wind, Cloud,
  Maximize, Radio, Wifi, Cpu, Eye, Settings, Wrench, User, Crown
} from 'lucide-react';

const IconMap: Record<string, React.FC<any>> = {
  'monitor': Monitor,
  'activity': Activity,
  'file-text': FileText,
  'image': ImageIcon,
  'align-center': AlignCenter,
  'volume-2': Volume2,
  'music': Music,
  'smartphone': Smartphone,
  'coffee': Coffee,
  'box': Box,
  'wind': Wind,
  'cloud': Cloud,
  'maximize': Maximize,
  'radio': Radio,
  'wifi': Wifi,
  'cpu': Cpu
};

// ==========================================
// 底部導航頁籤枚舉
// ==========================================
type BottomTab = 'use' | 'manage' | 'equipment' | 'profile';

export const useHypnosisRuntimeData = () => {
  const [data, setData] = useState<RuntimeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadData = async (isReload = false) => {
    if (!isReload) setLoading(true);
    try {
      const [user, system, equipment, hypnosis, combos, chars] = await Promise.all([
        MockApi.getUserInfo(),
        MockApi.getSystemData(),
        MockApi.getAllEquipment(),
        MockApi.getAllHypnosis(),
        MockApi.getAllCombos(),
        MockApi.getCharData()
      ]);

      setData({
        system,
        user,
        chars,
        hypnosis,
        equipment,
        combos
      });
    } catch (err) {
      setError(err as Error);
    } finally {
      if (!isReload) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return { data, loading, error, reload: () => loadData(true) };
};

export const HypnosisApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { data, loading, error, reload } = useHypnosisRuntimeData();
  const [activeTab, setActiveTab] = useState<BottomTab>('use');
  const [isProfileExpanded, setIsProfileExpanded] = useState(false);

  if (loading) {
    return (
      <div className="flex h-full w-full flex-col bg-gray-950 text-white items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        </div>
        <div className="text-sm text-gray-400 mt-4">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full flex-col bg-gray-950 text-white items-center justify-center px-6">
        <div className="text-lg text-red-400 font-medium mb-2">載入失敗</div>
        <div className="text-sm text-gray-500 mb-4">{error.message}</div>
        <div className="flex gap-3">
          <button className="px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-medium transition-colors" onClick={reload}>重試</button>
          <button className="px-5 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-medium transition-colors" onClick={onBack}>返回</button>
        </div>
      </div>
    );
  }

  // Format time
  const timeString = data?.system.time
    ? new Date(data.system.time).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '00:00';

  // Calculate VIP expiry date
  const vipEndDate = (() => {
    if (!data?.user.vipEndVirtualMinutes) return '---';
    const now = new Date();
    const endDate = new Date(now.getTime() + data.user.vipEndVirtualMinutes * 60 * 1000);
    return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')} ${String(endDate.getHours()).padStart(2, '0')}:${String(endDate.getMinutes()).padStart(2, '0')}`;
  })();

  // MC energy percentage
  const mcPercent = data ? Math.round((data.user.mcEnergy / data.user.mcEnergyMax) * 100) : 0;

  // Format money
  const formatMoney = (val: number) => {
    if (val >= 100000) return `¥${(val / 10000).toFixed(2)}萬`;

    return `¥${val.toLocaleString()}`;
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#0d0a1a] text-white font-sans">
      {/* ============================================ */}
      {/* Top Bar (System Status Bar) */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-3 md:px-5 py-1 bg-[#080612] text-gray-400 text-[11px] font-medium shrink-0 w-full">
        <div className="flex items-center gap-2">
          <span>{timeString}</span>
          <Bell size={11} className="opacity-40" />
        </div>
        <div className="flex items-center gap-1.5">
          {data && Object.entries(data.user.ownedEquipments)
            .filter(([_, state]) => state.enabled)
            .slice(0, 7)
            .map(([id]) => {
              const eq = data.equipment[id];
              if (!eq) return null;
              const IconComp = IconMap[eq.icon] || Box;
              return <IconComp key={id} size={12} />;
            })}
        </div>
      </div>

      {/* ============================================ */}
      {/* App Title Bar (標題欄) */}
      {/* ============================================ */}
      <div className="relative flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 bg-[#0d0a1a] shrink-0 w-full">
        {/* 返回按鈕 */}
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 text-gray-300 hover:text-white transition-colors group shrink-0"
          aria-label="返回OS"
        >
          <ChevronLeft className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] md:text-[13px]">返回 OS</span>
        </button>

        {/* APP 標題 */}
        <span className="absolute left-1/2 -translate-x-1/2 font-bold text-[14px] md:text-[16px] tracking-widest text-white">
          催眠 APP
        </span>

        {/* VIP Badge */}
        {data && (
          <div className="flex items-center gap-1 px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-md border border-amber-500/50 bg-amber-900/20 shrink-0">
            <Crown className="w-[10px] h-[10px] md:w-[12px] md:h-[12px] text-amber-400" />
            <span className="text-[10px] md:text-[11px] font-bold text-amber-400">VIP {data.user.vipTier}</span>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* Main Content Area (根據當前 Tab 渲染) */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto hypno-scrollbar relative flex flex-col">
        {/* Global Quick User Profile Card (Hidden on profile tab) */}
        {activeTab !== 'profile' && data && (
          <QuickUserProfileCard
            data={data}
            vipEndDate={vipEndDate}
            mcPercent={mcPercent}
            formatMoney={formatMoney}
            isExpanded={isProfileExpanded}
            onToggle={() => setIsProfileExpanded(!isProfileExpanded)}
          />
        )}

        {/* Tab Content */}
        {activeTab === 'use' && <HypnosisUseTab data={data} reload={reload} />}
        {activeTab === 'manage' && <HypnosisManageTab data={data} reload={reload} />}
        {activeTab === 'equipment' && <HypnosisEquipmentTab data={data} reload={reload} />}
        {activeTab === 'profile' && <HypnosisProfileTab data={data} reload={reload} vipEndDate={vipEndDate} mcPercent={mcPercent} formatMoney={formatMoney} />}
      </div>

      {/* ============================================ */}
      {/* Bottom Tab Bar (底部頁面切換區) */}
      {/* ============================================ */}
      <div className="shrink-0 bg-[#100d1e] border-t border-purple-900/30 w-full">
        <div className="flex items-stretch justify-around px-1 pt-1.5 md:pt-2 pb-3 md:pb-5.5">
          <BottomTabButton
            icon={<Eye className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={activeTab === 'use' ? 2.2 : 1.5} />}
            label="催眠使用區"
            active={activeTab === 'use'}
            onClick={() => setActiveTab('use')}
          />
          <BottomTabButton
            icon={<Settings className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={activeTab === 'manage' ? 2.2 : 1.5} />}
            label="催眠管理區"
            active={activeTab === 'manage'}
            onClick={() => setActiveTab('manage')}
          />
          <BottomTabButton
            icon={<Wrench className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={activeTab === 'equipment' ? 2.2 : 1.5} />}
            label="設備管理區"
            active={activeTab === 'equipment'}
            onClick={() => setActiveTab('equipment')}
          />
          <BottomTabButton
            icon={<User className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={activeTab === 'profile' ? 2.2 : 1.5} />}
            label="詳細用戶資料區"
            active={activeTab === 'profile'}
            onClick={() => setActiveTab('profile')}
          />
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 快捷用戶資料卡 (Global)
// ==========================================
const QuickUserProfileCard: React.FC<{
  data: RuntimeData;
  vipEndDate: string;
  mcPercent: number;
  formatMoney: (val: number) => string;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ data, vipEndDate, mcPercent, formatMoney, isExpanded, onToggle }) => {
  return (
    <>
      {/* Desktop View (Static) */}
      <div className="hidden md:block px-4 pt-3 pb-1 shrink-0">
        <div className="bg-[#13102a] rounded-xl border border-purple-800/30 px-3 py-2.5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#1a1530] flex items-center justify-center border border-gray-600/40 overflow-hidden shrink-0">
              <Eye className="w-[18px] h-[18px] text-gray-400" />
            </div>
            <span className="font-bold text-white text-sm leading-tight truncate">
              {data.user.userName || '催眠大師'}
            </span>
            <div className="ml-auto flex flex-col items-end gap-px text-right shrink-0">
              <span className="text-[10px] text-gray-500 leading-tight">到期: {vipEndDate}</span>
              {data.user.vipAutoRenew ? (
                <span className="text-[10px] text-emerald-400 font-medium underline decoration-emerald-400/50">自動續訂開啟</span>
              ) : (
                <span className="text-[10px] text-gray-500 font-medium">自動續訂關閉</span>
              )}
            </div>
          </div>
          <div className="flex items-stretch gap-1.5">
            <div className="flex-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
              <div className="flex items-center gap-1">
                <Zap className="w-[11px] h-[11px] text-cyan-400 shrink-0" />
                <span className="text-[9px] text-gray-500">MC 能量</span>
                <span className="text-[10px] font-mono text-white font-semibold ml-auto">{data.user.mcEnergy}/{data.user.mcEnergyMax}</span>
              </div>
              <div className="mt-1 w-full h-[3px] bg-[#1a1530] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${mcPercent}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }} />
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
              <Coins className="w-[11px] h-[11px] text-yellow-400 shrink-0" />
              <span className="text-[9px] text-gray-500">金幣</span>
              <span className="text-[10px] font-mono text-white font-semibold ml-0.5">{formatMoney(data.user.money || 0)}</span>
            </div>
            <div className="flex items-center gap-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
              <Star className="w-[11px] h-[11px] text-purple-400 shrink-0" />
              <span className="text-[9px] text-gray-500">催眠點</span>
              <span className="text-[10px] font-mono text-white font-semibold ml-0.5">{data.user.mcPoints} PT</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View (Toggle Bar + Dropdown) */}
      <div className="md:hidden px-3 pt-2 pb-1 shrink-0 z-20 relative">
        <div
          onClick={onToggle}
          className="bg-[#13102a] rounded-xl border border-purple-800/30 px-2.5 py-1.5 flex items-center justify-between cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-[#1a1530] flex items-center justify-center border border-gray-600/40 overflow-hidden shrink-0">
              <Eye className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <span className="font-bold text-white text-xs truncate max-w-[80px]">
              {data.user.userName || '催眠大師'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[#0c0a1e] rounded-md border border-purple-900/30 px-1.5 py-0.5">
              <Zap className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
              <span className="text-[9px] font-mono text-white">{data.user.mcEnergy}</span>
            </div>
            {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </div>

        {/* Dropdown Content */}
        {isExpanded && (
          <div className="absolute top-[calc(100%+4px)] left-3 right-3 bg-[#13102a] rounded-xl border border-purple-800/30 px-2.5 py-2.5 shadow-2xl z-50">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-900/30">
              <span className="text-[10px] text-gray-400">VIP 到期時間</span>
              <div className="flex flex-col items-end gap-px text-right">
                <span className="text-[10px] text-gray-300 leading-tight">{vipEndDate}</span>
                {data.user.vipAutoRenew ? (
                  <span className="text-[9px] text-emerald-400 font-medium underline decoration-emerald-400/50">自動續訂開啟</span>
                ) : (
                  <span className="text-[9px] text-gray-500 font-medium">自動續訂關閉</span>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1">
                    <Zap className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="text-[10px] text-gray-400">MC 能量</span>
                  </div>
                  <span className="text-[11px] font-mono text-white font-semibold">{data.user.mcEnergy}/{data.user.mcEnergyMax}</span>
                </div>
                <div className="w-full h-[4px] bg-[#1a1530] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${mcPercent}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <div className="flex items-center justify-between bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Coins className="w-3 h-3 text-yellow-400 shrink-0" />
                    <span className="text-[10px] text-gray-400">金幣</span>
                  </div>
                  <span className="text-[11px] font-mono text-white font-semibold">{formatMoney(data.user.money || 0)}</span>
                </div>
                <div className="flex items-center justify-between bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="text-[10px] text-gray-400">催眠點</span>
                  </div>
                  <span className="text-[11px] font-mono text-white font-semibold">{data.user.mcPoints}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Backdrop for mobile dropdown */}
      {isExpanded && (
        <div
          className="md:hidden fixed inset-0 z-10 bg-black/40 backdrop-blur-[1px]"
          onClick={onToggle}
        />
      )}
    </>
  );
};

// ==========================================
// 底部頁籤按鈕組件
// ==========================================
const BottomTabButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors duration-200 ${
      active
        ? 'text-purple-400'
        : 'text-gray-600 hover:text-gray-400'
    }`}
  >
    {icon}
    <span className={`text-[9px] font-medium leading-none ${
      active ? 'text-purple-400' : 'text-gray-600'
    }`}>
      {label}
    </span>
  </button>
);



// ====== ICON ======
// --- SVG Logo Component ---
export const HypnoLogoSVG = ({
  className,
  size = 24,
  ...props
}: {
  className?: string;
  size?: number | string;
  [key: string]: any;
}) => (
  <svg viewBox="0 0 200 200" className={className} width={size} height={size} {...props}>
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g fill="currentColor" filter="url(#glow)">
      {/* Top Left Spike */}
      <path d="M 45 60 L 40 20 L 75 65" />
      {/* Top Middle Spike */}
      <path d="M 85 55 L 100 5 L 115 55" />
      {/* Top Right Spike */}
      <path d="M 155 60 L 160 20 L 125 65" />

      {/* Main Body (Oval-ish) */}
      <path d="M 10 100 C 10 40 190 40 190 100 C 190 160 10 160 10 100 Z" />

      {/* Bottom Spike */}
      <path d="M 70 145 L 100 195 L 130 145" />
    </g>

    {/* Inner Eye (Cutout via black fill) */}
    <ellipse cx="100" cy="100" rx="55" ry="28" fill="#0f0518" />

    {/* Pupil */}
    <circle cx="100" cy="100" r="18" fill="currentColor" filter="url(#glow)" />
  </svg>
);
