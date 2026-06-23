import React, { useState, useMemo } from 'react';
import { RuntimeData, HypnoModuleDef } from '../../../models';
import { MockApi } from '../../../shared/api/mockApi';
import {
  Wrench,
  ShoppingCart,
  X,
  AlertTriangle,
  Monitor,
  Activity,
  FileText,
  ImageIcon,
  AlignCenter,
  Volume2,
  Music,
  Smartphone,
  Coffee,
  Box,
  Wind,
  Cloud,
  Maximize,
  Radio,
  Wifi,
  Cpu,
} from 'lucide-react';

const IconMap: Record<string, React.FC<any>> = {
  monitor: Monitor,
  activity: Activity,
  'file-text': FileText,
  image: ImageIcon,
  'align-center': AlignCenter,
  'volume-2': Volume2,
  music: Music,
  smartphone: Smartphone,
  coffee: Coffee,
  box: Box,
  wind: Wind,
  cloud: Cloud,
  maximize: Maximize,
  radio: Radio,
  wifi: Wifi,
  cpu: Cpu,
};

type HypnoModuleSubTab = 'installed' | 'shop';

export const HypnosisEquipmentTab: React.FC<{
  data: RuntimeData | null;
  reload: () => void;
}> = ({ data, reload }) => {
  const [activeSubTab, setActiveSubTab] = useState<HypnoModuleSubTab>('installed');

  if (!data) return null;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* ============================================ */}
      {/* 內部導航列 (Sub-navigation) */}
      {/* ============================================ */}
      <div className="px-3 md:px-4 pt-3 md:pt-4 py-2 md:py-2 shrink-0">
        <div className="flex bg-[#13102a] rounded-xl border border-purple-900/30 p-0.5 md:p-1">
          <SubTabButton
            active={activeSubTab === 'installed'}
            onClick={() => setActiveSubTab('installed')}
            icon={<Wrench className="w-[13px] h-[13px] md:w-3.5 md:h-3.5" />}
            label="已啟用模組"
          />
          <SubTabButton
            active={activeSubTab === 'shop'}
            onClick={() => setActiveSubTab('shop')}
            icon={<ShoppingCart className="w-[13px] h-[13px] md:w-3.5 md:h-3.5" />}
            label="模組商店"
          />
        </div>
      </div>

      {/* ============================================ */}
      {/* 內容區塊 */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto px-3 md:px-4 pb-20 md:pb-24 flex flex-col gap-3 md:gap-4 no-scrollbar">
        {activeSubTab === 'installed' && <InstalledHypnoModuleSection data={data} reload={reload} />}
        {activeSubTab === 'shop' && <HypnoModuleShopSection data={data} reload={reload} />}
      </div>
    </div>
  );
};

const SubTabButton: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}> = ({ active, onClick, icon, label }) => {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 md:py-2 rounded-lg text-[10px] md:text-[11px] font-semibold transition-all ${
        active
          ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
      }`}
    >
      {icon}
      {label}
    </button>
  );
};

// ==========================================
// 已啟用的模組區塊
// ==========================================
const InstalledHypnoModuleSection: React.FC<{
  data: RuntimeData;
  reload: () => void;
}> = ({ data, reload }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const installedModules = useMemo(() => {
    const list: Array<{ id: string; def: HypnoModuleDef; enabled: boolean }> = [];
    for (const [id, state] of Object.entries(data.user.ownedHypnoModules)) {
      const def = data.hypnoModules[id];
      if (def) {
        list.push({ id, def, enabled: state.enabled });
      }
    }
    return list.sort((a, b) => a.def.tier - b.def.tier);
  }, [data]);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    if (isProcessing) return;
    setIsProcessing(true);
    await MockApi.updateUserOwnedHypnoModules(id, !currentEnabled);
    reload();
    setIsProcessing(false);
  };

  return (
    <div className="flex flex-col gap-3">
      {installedModules.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">尚未啟用任何催眠模組</div>
      ) : (
        <div className="flex flex-col gap-1.5 md:gap-2">
          {installedModules.map(({ id, def, enabled }) => {
            const IconComp = IconMap[def.icon] || Box;
            return (
              <div
                key={id}
                className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3 md:px-3.5 py-2.5 md:py-3 flex flex-col gap-1.5 md:gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 md:gap-2.5">
                    <div
                      className={`w-7 md:w-8 h-7 md:h-8 rounded-lg flex items-center justify-center border ${enabled ? 'bg-purple-900/30 border-purple-500/50 text-purple-400' : 'bg-[#0c0a1e] border-gray-700 text-gray-500'}`}
                    >
                      <IconComp className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-[13px] md:text-sm text-white leading-none mb-1">
                        {def.name}
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[9px] md:text-[10px] text-gray-400 bg-[#0c0a1e] px-1 md:px-1.5 py-0.5 rounded border border-gray-800">
                          {def.type === 'technology' ? '技術' : '硬體'}
                        </span>
                        <span className="text-[9px] md:text-[10px] text-gray-400 bg-[#0c0a1e] px-1 md:px-1.5 py-0.5 rounded border border-gray-800">
                          VIP {def.tier}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggle(id, enabled)}
                    disabled={isProcessing}
                    className={`relative w-10 md:w-11 h-5 md:h-6 rounded-full transition-colors shrink-0 ${
                      enabled ? 'bg-purple-500' : 'bg-gray-700'
                    } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div
                      className={`absolute top-[2px] w-4 h-4 md:w-5 md:h-5 rounded-full bg-white shadow transition-transform ${
                        enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <div className="text-[10px] md:text-[11px] text-gray-400 bg-[#0c0a1e] p-1.5 md:p-2 rounded-lg border border-purple-900/10 leading-relaxed">
                  {def.description}
                  {def.usageCostRate > 0 && (
                    <div className="mt-1 text-amber-400/80 font-medium">
                      啟動消耗: {def.usageCostRate} {def.usageCostType.join('/')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// 模組商店區塊
// ==========================================
const HypnoModuleShopSection: React.FC<{
  data: RuntimeData;
  reload: () => void;
}> = ({ data, reload }) => {
  const [selectedModule, setSelectedModule] = useState<{ id: string; def: HypnoModuleDef } | null>(null);

  const availableModules = useMemo(() => {
    const list: Array<{ id: string; def: HypnoModuleDef }> = [];
    for (const [id, def] of Object.entries(data.hypnoModules)) {
      if (!data.user.ownedHypnoModules[id]) {
        list.push({ id, def });
      }
    }
    return list.sort((a, b) => a.def.tier - b.def.tier);
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {availableModules.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">沒有可購買的模組</div>
      ) : (
        <div className="flex flex-col gap-1.5 md:gap-2">
          {availableModules.map(({ id, def }) => {
            const IconComp = IconMap[def.icon] || Box;
            const isLocked = def.tier > (data.user.effectiveVipTier ?? data.user.vipTier);

            const canAffordMoney = def.cost.money === undefined || data.user.money >= def.cost.money;
            const canAffordPts = def.cost.pts === undefined || data.user.mcPoints >= def.cost.pts;
            const canAffordMc = def.cost.mc === undefined || data.user.mcEnergy >= def.cost.mc;

            return (
              <div
                key={id}
                onClick={() => !isLocked && setSelectedModule({ id, def })}
                className={`bg-[#13102a] rounded-xl border px-3 md:px-3.5 py-2.5 md:py-3 flex items-center justify-between transition-colors ${
                  isLocked
                    ? 'border-gray-800 opacity-50 cursor-not-allowed'
                    : 'border-purple-900/25 cursor-pointer hover:border-purple-500/40'
                }`}
              >
                <div className="flex items-center gap-2 md:gap-3 min-w-0 pr-2">
                  <div
                    className={`w-8 md:w-9 h-8 md:h-9 rounded-lg flex items-center justify-center shrink-0 border ${isLocked ? 'bg-[#0c0a1e] border-gray-800 text-gray-600' : 'bg-purple-900/20 border-purple-500/30 text-purple-400'}`}
                  >
                    <IconComp className="w-[14px] h-[14px] md:w-[18px] md:h-[18px]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-[13px] md:text-sm text-white mb-0.5">{def.name}</div>
                    <div className="flex gap-1 md:gap-1.5 items-center">
                      <span
                        className={`text-[8px] md:text-[9px] px-1 md:px-1.5 py-0.5 rounded border ${isLocked ? 'bg-red-900/20 border-red-800 text-red-500' : 'bg-[#0c0a1e] border-gray-800 text-gray-400'}`}
                      >
                        VIP {def.tier}
                      </span>
                      {isLocked && <span className="text-[8px] md:text-[9px] text-red-500 font-medium">權限不足</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {def.cost.pts !== undefined && (
                    <span
                      className={`text-[9px] md:text-[10px] font-medium px-1.5 md:px-2 py-0.5 rounded-md border ${
                        canAffordPts
                          ? 'bg-purple-900/30 text-purple-400 border-purple-500/30'
                          : 'bg-red-900/30 text-red-400 border-red-500/30'
                      }`}
                    >
                      {def.cost.pts} PTS
                    </span>
                  )}
                  {def.cost.money !== undefined && (
                    <span
                      className={`text-[9px] md:text-[10px] font-medium px-1.5 md:px-2 py-0.5 rounded-md border ${
                        canAffordMoney
                          ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30'
                          : 'bg-red-900/30 text-red-400 border-red-500/30'
                      }`}
                    >
                      ¥{def.cost.money.toLocaleString()}
                    </span>
                  )}
                  {def.cost.mc !== undefined && (
                    <span
                      className={`text-[9px] md:text-[10px] font-medium px-1.5 md:px-2 py-0.5 rounded-md border ${
                        canAffordMc
                          ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
                          : 'bg-red-900/30 text-red-400 border-red-500/30'
                      }`}
                    >
                      {def.cost.mc} MC
                    </span>
                  )}
                  {Object.keys(def.cost).length === 0 && (
                    <span className="text-[9px] md:text-[10px] font-medium px-1.5 md:px-2 py-0.5 rounded-md border bg-emerald-900/30 text-emerald-400 border-emerald-500/30">
                      免費
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedModule && (
        <HypnoModuleShopDetailModal
          id={selectedModule.id}
          def={selectedModule.def}
          data={data}
          reload={reload}
          onClose={() => setSelectedModule(null)}
          onPurchase={async () => {
            const def = selectedModule.def;
            const patch: any = {};
            if (def.cost.money !== undefined) patch.money = data.user.money - def.cost.money;
            if (def.cost.pts !== undefined) patch.mcPoints = data.user.mcPoints - def.cost.pts;
            if (def.cost.mc !== undefined) patch.mcEnergy = data.user.mcEnergy - def.cost.mc;

            await MockApi.updateUserResource(patch);
            await MockApi.updateUserOwnedHypnoModules(selectedModule.id, true);
            reload();
            setSelectedModule(null);
          }}
        />
      )}
    </div>
  );
};

const HypnoModuleShopDetailModal: React.FC<{
  id: string;
  def: HypnoModuleDef;
  data: RuntimeData;
  reload: () => void;
  onClose: () => void;
  onPurchase: () => void;
}> = ({ def, data, onClose, onPurchase }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const IconComp = IconMap[def.icon] || Box;

  const canAffordMoney = def.cost.money === undefined || data.user.money >= def.cost.money;
  const canAffordPts = def.cost.pts === undefined || data.user.mcPoints >= def.cost.pts;
  const canAffordMc = def.cost.mc === undefined || data.user.mcEnergy >= def.cost.mc;
  const canAfford = canAffordMoney && canAffordPts && canAffordMc;

  const handlePurchase = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    onPurchase();
    setIsProcessing(false);
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-3 md:pt-4 pb-3 md:pb-4">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-purple-400" />
            <span className="text-[14px] md:text-base font-bold text-white">購買催眠模組</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-4 md:p-5 flex flex-col gap-3 md:gap-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 md:w-14 h-12 md:h-14 rounded-xl bg-purple-900/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
              <IconComp className="w-6 h-6 md:w-7 md:h-7" />
            </div>
            <div>
              <div className="text-base md:text-lg text-white font-bold mb-1">{def.name}</div>
              <div className="flex gap-1.5 md:gap-2 items-center">
                <span className="text-[10px] md:text-[11px] text-gray-400 bg-[#0c0a1e] px-1.5 md:px-2 py-0.5 rounded border border-gray-800">
                  {def.type === 'technology' ? '技術' : '硬體'}
                </span>
                <span className="text-[10px] md:text-[11px] text-gray-400 bg-[#0c0a1e] px-1.5 md:px-2 py-0.5 rounded border border-gray-800">
                  VIP {def.tier}
                </span>
              </div>
            </div>
          </div>

          <div>
            <div className="text-[9px] md:text-[10px] text-gray-500 mb-1">模組描述</div>
            <div className="text-[11px] md:text-[12px] text-gray-300 leading-relaxed bg-[#0c0a1e] p-2.5 md:p-3 rounded-lg border border-purple-900/20">
              {def.description}
            </div>
          </div>

          {def.usageCostRate > 0 && (
            <div>
              <div className="text-[9px] md:text-[10px] text-gray-500 mb-1">啟用消耗</div>
              <div className="text-[11px] md:text-xs text-amber-400 font-semibold bg-amber-900/10 border border-amber-900/30 p-1.5 md:p-2 rounded-lg inline-block">
                每次/每分鐘消耗 {def.usageCostRate} {def.usageCostType.join('/')}
              </div>
            </div>
          )}

          <div className="mt-1.5 md:mt-2 pt-3 md:pt-4 border-t border-purple-900/20">
            <div className="text-[9px] md:text-[10px] text-gray-500 mb-1.5 md:mb-2">購買花費</div>
            <div className="flex flex-wrap gap-1.5 md:gap-2">
              {def.cost.pts !== undefined && (
                <div
                  className={`text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border ${
                    canAffordPts
                      ? 'bg-purple-900/30 text-purple-400 border-purple-500/30'
                      : 'bg-red-900/30 text-red-400 border-red-500/30'
                  }`}
                >
                  {def.cost.pts} PTS
                </div>
              )}
              {def.cost.money !== undefined && (
                <div
                  className={`text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border ${
                    canAffordMoney
                      ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30'
                      : 'bg-red-900/30 text-red-400 border-red-500/30'
                  }`}
                >
                  ¥{def.cost.money.toLocaleString()}
                </div>
              )}
              {def.cost.mc !== undefined && (
                <div
                  className={`text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border ${
                    canAffordMc
                      ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30'
                      : 'bg-red-900/30 text-red-400 border-red-500/30'
                  }`}
                >
                  {def.cost.mc} MC
                </div>
              )}
              {Object.keys(def.cost).length === 0 && (
                <div className="text-[11px] md:text-xs font-semibold px-2.5 md:px-3 py-1.5 md:py-2 rounded-lg border bg-emerald-900/30 text-emerald-400 border-emerald-500/30">
                  免費
                </div>
              )}
            </div>
            {!canAfford && (
              <div className="text-[10px] md:text-[11px] text-red-400 mt-2 md:mt-3 flex items-center gap-1 md:gap-1.5">
                <AlertTriangle size={14} />
                您的資源不足，無法購買此模組。
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="px-3 md:px-4 pb-3 md:pb-4 flex gap-2 md:gap-3 shrink-0">
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="flex-1 py-2.5 md:py-3 rounded-xl border border-gray-600/50 text-gray-300 font-medium text-[13px] md:text-sm hover:bg-gray-800/50 transition-colors disabled:opacity-50"
        >
          取消
        </button>
        <button
          onClick={handlePurchase}
          disabled={!canAfford || isProcessing}
          className="flex-1 py-2.5 md:py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-[13px] md:text-sm flex items-center justify-center gap-1.5 md:gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale relative overflow-hidden"
        >
          {isProcessing ? (
            <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <>
              <ShoppingCart size={16} className="text-white" />
              確認購買
            </>
          )}
        </button>
      </div>
    </div>
  );
};
