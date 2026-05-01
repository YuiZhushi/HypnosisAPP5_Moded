import React, { useState, useEffect } from 'react';
import { MockApi, RuntimeData } from './mockData';
import { HypnosisUseTab } from './HypnosisUseTab';
import {
  Zap, Coins, Star, Crown, ChevronLeft, Bell,
  Monitor, Activity, FileText, Image as ImageIcon, AlignCenter,
  Volume2, Music, Smartphone, Coffee, Box, Wind, Cloud,
  Maximize, Radio, Wifi, Cpu, Eye, Settings, Wrench, User
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

  const loadData = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return { data, loading, error, reload: loadData };
};

export const HypnosisApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { data, loading, error, reload } = useHypnosisRuntimeData();
  const [activeTab, setActiveTab] = useState<BottomTab>('use');

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
    return `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
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
      <div className="flex items-center justify-between px-5 py-1 bg-[#080612] text-gray-400 text-[11px] font-medium shrink-0 w-full">
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
      <div className="relative flex items-center justify-between px-4 py-2 bg-[#0d0a1a] shrink-0 w-full">
        {/* 返回按鈕 */}
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 text-gray-300 hover:text-white transition-colors group shrink-0"
          aria-label="返回OS"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[13px]">返回 OS</span>
        </button>

        {/* APP 標題 */}
        <span className="absolute left-1/2 -translate-x-1/2 font-bold text-[16px] tracking-widest text-white">
          催眠 APP
        </span>

        {/* VIP Badge */}
        {data && (
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-amber-500/50 bg-amber-900/20 shrink-0">
            <Crown size={12} className="text-amber-400" />
            <span className="text-[11px] font-bold text-amber-400">VIP {data.user.vipTier}</span>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* Main Content Area (根據當前 Tab 渲染) */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto hypno-scrollbar relative">
        {activeTab === 'use' && <HypnosisUseTab data={data} reload={reload} vipEndDate={vipEndDate} mcPercent={mcPercent} formatMoney={formatMoney} />}
        {activeTab === 'manage' && <PlaceholderTab title="催眠管理區" />}
        {activeTab === 'equipment' && <PlaceholderTab title="設備管理區" />}
        {activeTab === 'profile' && <PlaceholderTab title="詳細用戶資料區" />}
      </div>

      {/* ============================================ */}
      {/* Bottom Tab Bar (底部頁面切換區) */}
      {/* ============================================ */}
      <div className="shrink-0 bg-[#100d1e] border-t border-purple-900/30 w-full">
        <div className="flex items-stretch justify-around px-1 pt-2 pb-5.5">
          <BottomTabButton
            icon={<Eye size={20} strokeWidth={activeTab === 'use' ? 2.2 : 1.5} />}
            label="催眠使用區"
            active={activeTab === 'use'}
            onClick={() => setActiveTab('use')}
          />
          <BottomTabButton
            icon={<Settings size={20} strokeWidth={activeTab === 'manage' ? 2.2 : 1.5} />}
            label="催眠管理區"
            active={activeTab === 'manage'}
            onClick={() => setActiveTab('manage')}
          />
          <BottomTabButton
            icon={<Wrench size={20} strokeWidth={activeTab === 'equipment' ? 2.2 : 1.5} />}
            label="設備管理區"
            active={activeTab === 'equipment'}
            onClick={() => setActiveTab('equipment')}
          />
          <BottomTabButton
            icon={<User size={20} strokeWidth={activeTab === 'profile' ? 2.2 : 1.5} />}
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



// ==========================================
// Placeholder Tab (佔位用)
// ==========================================
const PlaceholderTab: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
    <div className="w-14 h-14 rounded-full bg-[#13102a] border border-purple-800/30 flex items-center justify-center mb-3">
      <Settings size={22} className="text-purple-900" />
    </div>
    <h3 className="text-base font-semibold text-gray-400 mb-1">{title}</h3>
    <p className="text-sm text-gray-600">此區域尚未實作</p>
  </div>
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
