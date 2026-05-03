import React, { useState, useMemo, useEffect } from 'react';
import { RuntimeData, HypnosisDef, MockApi } from './mockData';
import {
  List, Bookmark, ShoppingCart, Hammer, Check, X,
  AlertTriangle, ChevronDown, Play, Zap, Coins, Star, Eye, Crown
} from 'lucide-react';

type ManageSubTab = 'owned' | 'combos' | 'shop' | 'craft';

export const HypnosisManageTab: React.FC<{
  data: RuntimeData | null;
  reload: () => void;
  vipEndDate: string;
  mcPercent: number;
  formatMoney: (val: number) => string;
}> = ({ data, reload, vipEndDate, mcPercent, formatMoney }) => {
  const [activeSubTab, setActiveSubTab] = useState<ManageSubTab>('owned');

  if (!data) return null;

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* ============================================ */}
      {/* 快捷用戶資料卡 */}
      {/* ============================================ */}
      <div className="px-4.5 pt-2 pb-2">
        <div className="bg-[#13102a] rounded-xl border border-purple-800/30 px-3 py-2.5">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-9 h-9 rounded-full bg-[#1a1530] flex items-center justify-center border border-gray-600/40 overflow-hidden shrink-0">
              <Eye size={18} className="text-gray-400" />
            </div>
            <span className="font-bold text-white text-sm leading-tight truncate">
              {data.user.userName || '催眠大師'}
            </span>
            <div className="ml-auto flex flex-col items-end gap-px shrink-0">
              <span className="text-[10px] text-gray-500">到期: {vipEndDate}</span>
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
                <Zap size={11} className="text-cyan-400 shrink-0" />
                <span className="text-[9px] text-gray-500">MC 能量</span>
                <span className="text-[10px] font-mono text-white font-semibold ml-auto">{data.user.mcEnergy}/{data.user.mcEnergyMax}</span>
              </div>
              <div className="mt-1 w-full h-[3px] bg-[#1a1530] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${mcPercent}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }} />
              </div>
            </div>
            <div className="flex items-center gap-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
              <Coins size={11} className="text-yellow-400 shrink-0" />
              <span className="text-[9px] text-gray-500">金幣</span>
              <span className="text-[10px] font-mono text-white font-semibold ml-0.5">{formatMoney(data.user.money || 0)}</span>
            </div>
            <div className="flex items-center gap-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
              <Star size={11} className="text-purple-400 shrink-0" />
              <span className="text-[9px] text-gray-500">催眠點</span>
              <span className="text-[10px] font-mono text-white font-semibold ml-0.5">{data.user.mcPoints} PT</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* 內部導航列 (Sub-navigation) */}
      {/* ============================================ */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="flex bg-[#13102a] rounded-xl border border-purple-900/30 p-1">
          <SubTabButton
            active={activeSubTab === 'owned'}
            onClick={() => setActiveSubTab('owned')}
            icon={<List size={14} />}
            label="已擁有"
          />
          <SubTabButton
            active={activeSubTab === 'combos'}
            onClick={() => setActiveSubTab('combos')}
            icon={<Bookmark size={14} />}
            label="組合"
          />
          <SubTabButton
            active={activeSubTab === 'shop'}
            onClick={() => setActiveSubTab('shop')}
            icon={<ShoppingCart size={14} />}
            label="商店"
          />
          <SubTabButton
            active={activeSubTab === 'craft'}
            onClick={() => setActiveSubTab('craft')}
            icon={<Hammer size={14} />}
            label="製作"
          />
        </div>
      </div>

      {/* ============================================ */}
      {/* 內容區塊 */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 no-scrollbar">
        {activeSubTab === 'owned' && (
          <OwnedHypnosisSection data={data} reload={reload} />
        )}
        {activeSubTab === 'combos' && (
          <SavedCombosSection data={data} reload={reload} />
        )}
        {activeSubTab === 'shop' && (
          <HypnosisShopSection data={data} reload={reload} />
        )}
        {activeSubTab === 'craft' && (
          <HypnosisCraftSection data={data} reload={reload} />
        )}
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
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold transition-all ${
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
// 已擁有的催眠區塊
// ==========================================
const OwnedHypnosisSection: React.FC<{
  data: RuntimeData;
  reload: () => void;
}> = ({ data, reload }) => {
  const [activeVipTab, setActiveVipTab] = useState(0);
  const [selectedHypnosis, setSelectedHypnosis] = useState<{ id: string; def: HypnosisDef } | null>(null);

  // 過濾出擁有的催眠並按 VIP 等級分組
  const ownedByTier = useMemo(() => {
    const groups: Record<number, Array<{ id: string; def: HypnosisDef; enabled: boolean }>> = {};
    for (const [id, state] of Object.entries(data.user.ownedHypnosis)) {
      const def = data.hypnosis[id];
      if (!def) continue;
      const t = def.tier;
      if (!groups[t]) groups[t] = [];
      groups[t].push({ id, def, enabled: state.enabled });
    }
    return groups;
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {/* VIP 等級頁籤 */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {[0, 1, 2, 3, 4, 5].map(tier => (
          <button
            key={tier}
            onClick={() => setActiveVipTab(tier)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
              activeVipTab === tier
                ? 'bg-purple-600 text-white'
                : 'bg-[#13102a] text-gray-500 hover:text-gray-300 border border-purple-900/20'
            }`}
          >
            VIP {tier}
          </button>
        ))}
      </div>

      {/* 列表 */}
      <div className="flex flex-col gap-2">
        {(ownedByTier[activeVipTab] || []).map(({ id, def, enabled }) => (
          <div
            key={id}
            onClick={() => setSelectedHypnosis({ id, def })}
            className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3.5 py-3 cursor-pointer hover:border-purple-500/40 transition-colors flex items-center justify-between"
          >
            <div>
              <div className="font-semibold text-sm text-white mb-0.5">{def.name}</div>
              <div className="text-[11px] text-gray-400">
                {def.isPermanent ? '永久性' : def.isOneTime ? '一次性' : '持續性'} | 消耗: {def.energyCost} MC
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md ${
                enabled ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-gray-800 text-gray-400 border border-gray-600/30'
              }`}>
                {enabled ? '顯示中' : '已隱藏'}
              </span>
            </div>
          </div>
        ))}
        {!(ownedByTier[activeVipTab]?.length) && (
          <div className="text-center py-8 text-gray-600 text-sm">
            此等級下沒有擁有的催眠
          </div>
        )}
      </div>

      {/* 詳細資訊 Modal */}
      {selectedHypnosis && (
        <OwnedHypnosisDetailModal
          id={selectedHypnosis.id}
          def={selectedHypnosis.def}
          data={data}
          reload={reload}
          initialEnabled={data.user.ownedHypnosis[selectedHypnosis.id]?.enabled || false}
          onClose={() => setSelectedHypnosis(null)}
          onToggleVisibility={async (enabled) => {
            await MockApi.updateUserOwnedHypnosis(selectedHypnosis.id, enabled);
            reload();
          }}
        />
      )}
    </div>
  );
};

const OwnedHypnosisDetailModal: React.FC<{
  id: string;
  def: HypnosisDef;
  data: RuntimeData;
  reload: () => void;
  initialEnabled: boolean;
  onClose: () => void;
  onToggleVisibility: (enabled: boolean) => void;
}> = ({ id, def, data, reload, initialEnabled, onClose, onToggleVisibility }) => {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { modifiedCombos, deletedCombos } = useMemo(() => {
    const modified: string[] = [];
    const deleted: string[] = [];
    for (const [comboId, comboDef] of Object.entries(data.combos)) {
      if (comboDef.includedHypnosis[id]) {
        if (Object.keys(comboDef.includedHypnosis).length === 1) {
          deleted.push(comboDef.name);
        } else {
          modified.push(comboDef.name);
        }
      }
    }
    return { modifiedCombos: modified, deletedCombos: deleted };
  }, [data.combos, id]);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    onToggleVisibility(next);
    onClose();
  };

  const handleDelete = async () => {
    await MockApi.deleteHypnosis(id);
    reload();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <List size={18} className="text-purple-400" />
            <span className="text-base font-bold text-white">催眠詳細資訊</span>
          </div>
          <div className="flex items-center gap-3">
            {def.isCustom && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors"
              >
                刪除
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-4 flex flex-col gap-3">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">催眠名稱</div>
            <div className="text-sm text-white font-bold">{def.name}</div>
          </div>

          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">效果描述</div>
            <div className="text-[12px] text-gray-300 leading-relaxed bg-[#0c0a1e] p-2.5 rounded-lg border border-purple-900/20">
              {def.description}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">類型</div>
              <div className="text-xs text-white">{def.isPermanent ? '永久性' : def.isOneTime ? '一次性' : '持續性'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">消耗</div>
              <div className="text-xs text-amber-400 font-semibold">{def.energyCost} MC {def.isOneTime || def.isPermanent ? '(單次)' : '(每分鐘)'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">自製催眠</div>
              <div className="text-xs text-white">{def.isCustom ? '是' : '否'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">需求 VIP</div>
              <div className="text-xs text-white">VIP {def.tier}</div>
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-purple-900/20 flex items-center justify-between">
            <div>
              <div className="text-sm text-white font-semibold">顯示於使用區</div>
              <div className="text-[10px] text-gray-500">開啟後將可在催眠使用區中選擇此催眠</div>
            </div>
            <button
              onClick={handleToggle}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                enabled ? 'bg-purple-500' : 'bg-gray-700'
              }`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      </div>

      {/* 刪除確認 Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-[#13102a] rounded-xl border border-red-900/50 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-lg mb-2">
              <AlertTriangle size={20} />
              刪除自訂催眠
            </div>
            <div className="text-sm text-gray-300">
              確定要刪除自訂催眠 <span className="text-white font-bold">「{def.name}」</span> 嗎？此操作無法還原。
              {(modifiedCombos.length > 0 || deletedCombos.length > 0) && (
                <div className="mt-3 p-3 bg-red-900/20 rounded-lg border border-red-500/30 text-red-300">
                  <div className="font-bold text-red-400 mb-1">注意：</div>
                  此催眠正在被以下組合使用：
                  {modifiedCombos.length > 0 && (
                    <div className="mt-1">
                      將從以下組合中移除：
                      <ul className="list-disc pl-5">
                        {modifiedCombos.map((comboName, idx) => (
                          <li key={idx}>{comboName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deletedCombos.length > 0 && (
                    <div className="mt-2 text-red-400">
                      <span className="font-bold">將會連同以下組合一併刪除</span> (因其為組合中最後一個項目)：
                      <ul className="list-disc pl-5 text-red-300">
                        {deletedCombos.map((comboName, idx) => (
                          <li key={idx}>{comboName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 收藏的催眠組合區塊
// ==========================================
const SavedCombosSection: React.FC<{
  data: RuntimeData;
  reload: () => void;
}> = ({ data, reload }) => {
  const [selectedComboId, setSelectedComboId] = useState<string | null>(null);

  const ownedCombos = Object.entries(data.combos).filter(([id]) => {
    const owned = data.user.ownedCombos[id];
    return owned && owned.enabled;
  });

  return (
    <div className="flex flex-col gap-3">
      {ownedCombos.length === 0 ? (
        <div className="text-center py-8 text-gray-500 text-sm">
          尚未收藏任何催眠組合
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ownedCombos.map(([id, combo]) => (
            <div
              key={id}
              onClick={() => setSelectedComboId(id)}
              className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3.5 py-3 cursor-pointer hover:border-purple-500/40 transition-colors"
            >
              <div className="font-semibold text-sm text-white mb-0.5">{combo.name}</div>
              <div className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed mb-2">
                {combo.description}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.keys(combo.includedHypnosis).slice(0, 5).map(hypId => {
                  const def = data.hypnosis[hypId];
                  if (!def) return null;
                  return (
                    <span key={hypId} className="px-2 py-0.5 rounded-md bg-[#0c0a1e] border border-purple-900/30 text-[10px] text-gray-300">
                      {def.name}
                    </span>
                  );
                })}
                {Object.keys(combo.includedHypnosis).length > 5 && (
                  <span className="px-2 py-0.5 rounded-md bg-[#0c0a1e] border border-purple-900/30 text-[10px] text-gray-500">
                    +{Object.keys(combo.includedHypnosis).length - 5}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedComboId && data.combos[selectedComboId] && (
        <SavedComboDetailModal
          comboId={selectedComboId}
          combo={data.combos[selectedComboId]}
          data={data}
          onClose={() => setSelectedComboId(null)}
          onUpdate={async (newCombo) => {
            await MockApi.updateCombo(selectedComboId, newCombo);
            reload();
          }}
          onDelete={async () => {
            await MockApi.deleteCombo(selectedComboId);
            reload();
            setSelectedComboId(null);
          }}
        />
      )}
    </div>
  );
};

const SavedComboDetailModal: React.FC<{
  comboId: string;
  combo: any;
  data: RuntimeData;
  onClose: () => void;
  onUpdate: (newCombo: any) => void;
  onDelete: () => void;
}> = ({ comboId, combo, data, onClose, onUpdate, onDelete }) => {
  const [localCombo, setLocalCombo] = useState(combo);
  const [isDirty, setIsDirty] = useState(false);

  // Custom confirmation modals state
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLastItemConfirm, setShowLastItemConfirm] = useState(false);
  const [lastItemToRemove, setLastItemToRemove] = useState<string | null>(null);

  useEffect(() => {
    setLocalCombo(combo);
    setIsDirty(false);
  }, [combo]);

  const handleRemoveItem = (hypId: string) => {
    const newIncluded = { ...localCombo.includedHypnosis };
    delete newIncluded[hypId];

    if (Object.keys(newIncluded).length === 0) {
      setLastItemToRemove(hypId);
      setShowLastItemConfirm(true);
    } else {
      setLocalCombo({ ...localCombo, includedHypnosis: newIncluded });
      setIsDirty(true);
    }
  };

  const handleUpdateItemConfig = (hypId: string, key: string, value: any) => {
    const newIncluded = { ...localCombo.includedHypnosis };
    if (newIncluded[hypId]) {
      newIncluded[hypId] = { ...newIncluded[hypId], [key]: value };
      setLocalCombo({ ...localCombo, includedHypnosis: newIncluded });
      setIsDirty(true);
    }
  };

  const handleClose = () => {
    if (isDirty) {
      setShowCloseConfirm(true);
      return;
    }
    onClose();
  };

  const handleSave = () => {
    onUpdate(localCombo);
    setIsDirty(false);
    onClose();
  };

  const totalCost = Object.entries(localCombo.includedHypnosis).reduce((sum, [hypId, config]: [string, any]) => {
    const def = data.hypnosis[hypId];
    if (!def) return sum;
    if (def.isOneTime) return sum + def.energyCost;
    const dur = typeof config.duration === 'number' ? config.duration : 10;
    return sum + def.energyCost * (def.isPermanent ? 1 : dur);
  }, 0);

  const APPLY_METHODS = [
    '直接輸入-圖像',
    '直接輸入-聲音',
    '直接輸入-文字',
    '間接輸入-圖像',
    '間接輸入-聲音',
    '間接輸入-文字',
    '間接輸入-氣體',
    '間接輸入-電磁波',
  ];

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-purple-400" />
            <span className="text-base font-bold text-white">組合詳細資訊</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors"
            >
              刪除組合
            </button>
            <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-4 flex flex-col gap-3 mb-4">
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">組合名稱</label>
            <input
              type="text"
              value={localCombo.name}
              onChange={e => {
                setLocalCombo({ ...localCombo, name: e.target.value });
                setIsDirty(true);
              }}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white font-bold outline-none focus:border-purple-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">組合描述</label>
            <textarea
              value={localCombo.description || ''}
              onChange={e => {
                setLocalCombo({ ...localCombo, description: e.target.value });
                setIsDirty(true);
              }}
              rows={2}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-[12px] text-gray-300 leading-relaxed outline-none focus:border-purple-500/50 resize-none"
            />
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">預估總消耗</div>
            <div className="text-sm text-amber-400 font-bold">{totalCost} MC</div>
          </div>
        </div>

        <div className="text-sm font-bold text-white mb-2">包含的催眠項目 ({Object.keys(localCombo.includedHypnosis).length})</div>
        <div className="flex flex-col gap-2">
          {Object.entries(localCombo.includedHypnosis).map(([hypId, config]: [string, any]) => {
            const def = data.hypnosis[hypId];
            if (!def) return null;

            return (
              <div key={hypId} className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-semibold text-sm text-white flex items-center gap-1.5">
                    <Check size={14} className="text-purple-400" />
                    {def.name}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(hypId)}
                    className="shrink-0 bg-red-900/30 hover:bg-red-900/50 text-red-400 text-[10px] font-medium px-2 py-1 rounded transition-colors border border-red-500/30"
                  >
                    移除
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-gray-400 pl-5">
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5">施加方式</label>
                    <select
                      value={config.applyMethod || ''}
                      onChange={e => handleUpdateItemConfig(hypId, 'applyMethod', e.target.value)}
                      className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded px-2 py-1 text-white outline-none focus:border-purple-500/50 appearance-none"
                    >
                      <option value="">請選擇</option>
                      {APPLY_METHODS.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5">對象</label>
                    <input
                      type="text"
                      value={config.target || ''}
                      onChange={e => handleUpdateItemConfig(hypId, 'target', e.target.value)}
                      placeholder="未設定"
                      className={`w-full bg-[#0c0a1e] border rounded px-2 py-1 text-white outline-none focus:border-purple-500/50 ${!config.target ? 'border-red-500/30 placeholder:text-red-400/50' : 'border-purple-900/30'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] text-gray-500 mb-0.5">持續時間</label>
                    <input
                      type={def.isPermanent || def.isOneTime ? "text" : "number"}
                      min={1}
                      value={def.isPermanent ? '永久' : def.isOneTime ? '一次性' : (config.duration || 10)}
                      disabled={def.isPermanent || def.isOneTime}
                      onChange={e => handleUpdateItemConfig(hypId, 'duration', parseInt(e.target.value) || 10)}
                      className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded px-2 py-1 text-white outline-none focus:border-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[9px] text-gray-500 mb-0.5">備註</label>
                    <input
                      type="text"
                      value={config.note || ''}
                      onChange={e => handleUpdateItemConfig(hypId, 'note', e.target.value)}
                      placeholder="無"
                      className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded px-2 py-1 text-white outline-none focus:border-purple-500/50"
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部按鈕 */}
      <div className="px-4 pb-4 flex gap-3 shrink-0">
        <button
          onClick={handleClose}
          className="flex-1 py-3 rounded-xl border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
        >
          關閉
        </button>
        <button
          onClick={handleSave}
          disabled={!isDirty}
          className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
        >
          儲存變更
        </button>
      </div>

      {/* 關閉確認 Modal */}
      {showCloseConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-lg mb-2">
              <AlertTriangle size={20} />
              未儲存的變更
            </div>
            <div className="text-sm text-gray-300">
              您有尚未儲存的變更，確定要放棄這些變更並關閉嗎？
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowCloseConfirm(false)}
                className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors"
              >
                返回編輯
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                放棄變更
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除組合確認 Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-[#13102a] rounded-xl border border-red-900/50 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-lg mb-2">
              <AlertTriangle size={20} />
              刪除組合
            </div>
            <div className="text-sm text-gray-300">
              確定要刪除催眠組合 <span className="text-white font-bold">「{combo.name}」</span> 嗎？此操作無法還原。
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={onDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除最後一個項目確認 Modal */}
      {showLastItemConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-[#13102a] rounded-xl border border-red-900/50 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-lg mb-2">
              <AlertTriangle size={20} />
              刪除組合警告
            </div>
            <div className="text-sm text-gray-300">
              這是組合中的最後一個催眠項目，移除後將會<span className="text-red-400 font-bold">刪除整個組合</span>。確定要繼續嗎？
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => {
                  setShowLastItemConfirm(false);
                  setLastItemToRemove(null);
                }}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => {
                  if (lastItemToRemove) {
                    onDelete();
                  }
                }}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 催眠購買區塊 (商店)
// ==========================================
const HypnosisShopSection: React.FC<{
  data: RuntimeData;
  reload: () => void;
}> = ({ data, reload }) => {
  const [activeVipTab, setActiveVipTab] = useState(0);
  const [selectedHypnosis, setSelectedHypnosis] = useState<{ id: string; def: HypnosisDef } | null>(null);

  // 過濾出未擁有的催眠並按 VIP 等級分組
  const shopByTier = useMemo(() => {
    const groups: Record<number, Array<{ id: string; def: HypnosisDef }>> = {};
    for (const [id, def] of Object.entries(data.hypnosis)) {
      // 隱藏已擁有的
      if (data.user.ownedHypnosis[id]) continue;

      const t = def.tier;
      if (!groups[t]) groups[t] = [];
      groups[t].push({ id, def });
    }
    return groups;
  }, [data]);

  return (
    <div className="flex flex-col gap-3">
      {/* VIP 等級頁籤 */}
      <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1">
        {[0, 1, 2, 3, 4, 5].map(tier => (
          <button
            key={tier}
            onClick={() => setActiveVipTab(tier)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all shrink-0 ${
              activeVipTab === tier
                ? 'bg-purple-600 text-white'
                : 'bg-[#13102a] text-gray-500 hover:text-gray-300 border border-purple-900/20'
            }`}
          >
            VIP {tier}
          </button>
        ))}
      </div>

      {/* 權限不足提示 */}
      {activeVipTab > data.user.vipTier && (
        <div className="bg-red-900/20 rounded-xl border border-red-500/30 px-3.5 py-2.5 flex items-center gap-2 mb-2">
          <AlertTriangle size={14} className="text-red-400 shrink-0" />
          <span className="text-[11px] text-red-400 font-semibold">您的 VIP 等級不足，無法購買此區的催眠</span>
        </div>
      )}

      {/* 列表 */}
      <div className="flex flex-col gap-2 relative">
        {/* 霧化遮罩 */}
        {activeVipTab > data.user.vipTier && (
          <div className="absolute inset-0 z-10 backdrop-blur-[2px] bg-black/20 rounded-xl flex items-center justify-center">
            <div className="bg-black/60 px-4 py-2 rounded-lg border border-red-500/30 flex items-center gap-2 shadow-xl">
              <Crown size={16} className="text-red-400" />
              <span className="text-sm font-bold text-red-400 tracking-widest">VIP 等級不足</span>
            </div>
          </div>
        )}

        {(shopByTier[activeVipTab] || []).map(({ id, def }) => {
          const isLocked = activeVipTab > data.user.vipTier;
          const canAffordMoney = def.cost.money === undefined || data.user.money >= def.cost.money;
          const canAffordPts = def.cost.pts === undefined || data.user.mcPoints >= def.cost.pts;
          const canAffordMc = def.cost.mc === undefined || data.user.mcEnergy >= def.cost.mc;
          const canAfford = canAffordMoney && canAffordPts && canAffordMc;
          const isGrayOut = isLocked || !canAfford;

          return (
            <div
              key={id}
              onClick={() => !isLocked && setSelectedHypnosis({ id, def })}
              className={`bg-[#13102a] rounded-xl border px-3.5 py-3 flex items-center justify-between transition-colors ${
                isLocked ? 'border-gray-800 opacity-50 cursor-not-allowed pointer-events-none' : 'border-purple-900/25 cursor-pointer hover:border-purple-500/40'
              }`}
            >
              <div className="flex-1 min-w-0 pr-4">
                <div className="font-semibold text-sm text-white mb-0.5">{def.name}</div>
                <div className="text-[11px] text-gray-400 line-clamp-1">
                  {def.description}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {def.cost.pts !== undefined && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                    canAffordPts ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'
                  }`}>
                    {def.cost.pts} PTS
                  </span>
                )}
                {def.cost.money !== undefined && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                    canAffordMoney ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'
                  }`}>
                    ¥{def.cost.money.toLocaleString()}
                  </span>
                )}
                {def.cost.mc !== undefined && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${
                    canAffordMc ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'
                  }`}>
                    {def.cost.mc} MC
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {!(shopByTier[activeVipTab]?.length) && (
          <div className="text-center py-8 text-gray-600 text-sm">
            此等級下沒有可購買的催眠
          </div>
        )}
      </div>

      {/* 詳細資訊與購買 Modal */}
      {selectedHypnosis && (
        <HypnosisShopDetailModal
          id={selectedHypnosis.id}
          def={selectedHypnosis.def}
          data={data}
          reload={reload}
          onClose={() => setSelectedHypnosis(null)}
          onPurchase={async () => {
            const def = selectedHypnosis.def;
            const patch: any = {};
            if (def.cost.money !== undefined) patch.money = data.user.money - def.cost.money;
            if (def.cost.pts !== undefined) patch.mcPoints = data.user.mcPoints - def.cost.pts;
            if (def.cost.mc !== undefined) patch.mcEnergy = data.user.mcEnergy - def.cost.mc;

            await MockApi.updateUserResource(patch);
            await MockApi.updateUserOwnedHypnosis(selectedHypnosis.id, true);
            reload();
            setSelectedHypnosis(null);
          }}
        />
      )}
    </div>
  );
};

const HypnosisShopDetailModal: React.FC<{
  id: string;
  def: HypnosisDef;
  data: RuntimeData;
  reload: () => void;
  onClose: () => void;
  onPurchase: () => void;
}> = ({ id, def, data, reload, onClose, onPurchase }) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { modifiedCombos, deletedCombos } = useMemo(() => {
    const modified: string[] = [];
    const deleted: string[] = [];
    for (const [comboId, comboDef] of Object.entries(data.combos)) {
      if (comboDef.includedHypnosis[id]) {
        if (Object.keys(comboDef.includedHypnosis).length === 1) {
          deleted.push(comboDef.name);
        } else {
          modified.push(comboDef.name);
        }
      }
    }
    return { modifiedCombos: modified, deletedCombos: deleted };
  }, [data.combos, id]);

  const handleDelete = async () => {
    await MockApi.deleteHypnosis(id);
    reload();
    onClose();
  };

  const canAffordMoney = def.cost.money === undefined || data.user.money >= def.cost.money;
  const canAffordPts = def.cost.pts === undefined || data.user.mcPoints >= def.cost.pts;
  const canAffordMc = def.cost.mc === undefined || data.user.mcEnergy >= def.cost.mc;
  const canAfford = canAffordMoney && canAffordPts && canAffordMc;

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-purple-400" />
            <span className="text-base font-bold text-white">購買催眠</span>
          </div>
          <div className="flex items-center gap-3">
            {def.isCustom && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs font-medium bg-red-900/30 hover:bg-red-900/50 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/30 transition-colors"
              >
                刪除
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-4 flex flex-col gap-3">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">催眠名稱</div>
            <div className="text-sm text-white font-bold">{def.name}</div>
          </div>

          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">效果描述</div>
            <div className="text-[12px] text-gray-300 leading-relaxed bg-[#0c0a1e] p-2.5 rounded-lg border border-purple-900/20">
              {def.description}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">類型</div>
              <div className="text-xs text-white">{def.isPermanent ? '永久性' : def.isOneTime ? '一次性' : '持續性'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">消耗</div>
              <div className="text-xs text-amber-400 font-semibold">{def.energyCost} MC {def.isOneTime || def.isPermanent ? '(單次)' : '(每分鐘)'}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-0.5">需求 VIP</div>
              <div className="text-xs text-white">VIP {def.tier}</div>
            </div>
          </div>

          <div className="mt-2 pt-3 border-t border-purple-900/20">
            <div className="text-[10px] text-gray-500 mb-2">購買花費</div>
            <div className="flex flex-wrap gap-2">
              {def.cost.pts !== undefined && (
                <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                  canAffordPts ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'
                }`}>
                  {def.cost.pts} PTS
                </div>
              )}
              {def.cost.money !== undefined && (
                <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                  canAffordMoney ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'
                }`}>
                  ¥{def.cost.money.toLocaleString()}
                </div>
              )}
              {def.cost.mc !== undefined && (
                <div className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border ${
                  canAffordMc ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30' : 'bg-red-900/30 text-red-400 border-red-500/30'
                }`}>
                  {def.cost.mc} MC
                </div>
              )}
              {Object.keys(def.cost).length === 0 && (
                <div className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border bg-emerald-900/30 text-emerald-400 border-emerald-500/30">
                  免費
                </div>
              )}
            </div>
            {!canAfford && (
              <div className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                資源不足，無法購買
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部按鈕 */}
      <div className="px-4 pb-4 flex gap-3 shrink-0">
        <button
          onClick={onClose}
          className="flex-1 py-3 rounded-xl border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
        >
          取消
        </button>
        <button
          onClick={onPurchase}
          disabled={!canAfford}
          className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
        >
          <ShoppingCart size={14} className="text-white" />
          確認購買
        </button>
      </div>

      {/* 刪除確認 Modal */}
      {showDeleteConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
          <div className="bg-[#13102a] rounded-xl border border-red-900/50 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-2 text-red-400 font-bold text-lg mb-2">
              <AlertTriangle size={20} />
              刪除自訂催眠
            </div>
            <div className="text-sm text-gray-300">
              確定要刪除自訂催眠 <span className="text-white font-bold">「{def.name}」</span> 嗎？此操作無法還原。
              {(modifiedCombos.length > 0 || deletedCombos.length > 0) && (
                <div className="mt-3 p-3 bg-red-900/20 rounded-lg border border-red-500/30 text-red-300">
                  <div className="font-bold text-red-400 mb-1">注意：</div>
                  此催眠正在被以下組合使用：
                  {modifiedCombos.length > 0 && (
                    <div className="mt-1">
                      將從以下組合中移除：
                      <ul className="list-disc pl-5">
                        {modifiedCombos.map((comboName: string, idx: number) => (
                          <li key={idx}>{comboName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {deletedCombos.length > 0 && (
                    <div className="mt-2 text-red-400">
                      <span className="font-bold">將會連同以下組合一併刪除</span> (因其為組合中最後一個項目)：
                      <ul className="list-disc pl-5 text-red-300">
                        {deletedCombos.map((comboName: string, idx: number) => (
                          <li key={idx}>{comboName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-colors"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 計算催眠自製與購買成本
// ==========================================
const calculateCosts = (
  tier: number,
  mcCost: number,
  isPermanent: boolean,
  isOneTime: boolean,
  selectedCostTypes: string[]
) => {
  // 步驟 A: 定義各 VIP 等級的標準 MC 消耗區間
  const EXPECTED_MC_RANGES = {
    normal: [ [1,5], [1,5], [5,12], [25,30], [40,60], [90,150] ],
    onetime: [ [1,10], [1,12], [10,30], [50,150], [240,360], [400,540] ],
    permanent: [ [900,1500], [900,1500], [900,1500], [900,1500], [900,1500], [900,1500] ]
  };

  // 步驟 B: 計算綜合乘數
  const typeKey: 'permanent' | 'onetime' | 'normal' = isPermanent ? 'permanent' : (isOneTime ? 'onetime' : 'normal');
  const [minExpected, maxExpected] = EXPECTED_MC_RANGES[typeKey][tier];

  // 等級懲罰(自製)
  let tierPenalty = 1.0;
  if (isPermanent && tier < 5) {
    tierPenalty = 1 + (5 - tier) * 5;
  }

  // mc能量消耗量偏移懲罰
  let usageMultiplier = 1.0;
  const expectedMiddle = (minExpected + maxExpected) / 2;

  if (mcCost < minExpected) {
    usageMultiplier = Math.pow(minExpected / Math.max(1, mcCost), 1.5);
  } else if (mcCost > maxExpected) {
    usageMultiplier = Math.max(0.1, maxExpected / mcCost);
  } else {
    const deviation = (expectedMiddle - mcCost) / expectedMiddle;
    usageMultiplier = 1.0 + deviation * 0.5;
  }

  // 消耗類型乘數
  let durationMultiplier = 1.0;
  if (isPermanent) durationMultiplier = 1.0;
  else if (isOneTime) durationMultiplier = 0.5;

  const totalMultiplier = tierPenalty * usageMultiplier * durationMultiplier;

  // 步驟 C: 決定購買與製作比例的浮動率
  const costTypeCount = Math.max(1, selectedCostTypes.length);
  let defaultTypeCount = 3;
  if (tier === 0) defaultTypeCount = 1;
  else if (tier === 1) defaultTypeCount = 2;

  let purchaseRatio = 1.0;
  let craftRatio = 1.0;
  const diff = costTypeCount - defaultTypeCount;

  if (diff > 0) {
    purchaseRatio = Math.max(0.5, 1.0 - diff * 0.2);
    craftRatio = 1.0 + diff * 0.2;
  } else if (diff < 0) {
    purchaseRatio = 1.0 + Math.abs(diff) * 0.2;
    craftRatio = Math.max(0.5, 1.0 - Math.abs(diff) * 0.2);
  }

  // 步驟 D: 計算基礎資源分配
  const BASE_UNITS = [500, 20, 10];
  const VIP_RATIOS = [
    [1, 0, 0],
    [0, 1, 1],
    [3, 3, 3],
    [4, 9, 8],
    [5, 48, 20],
    [6, 120, 48]
  ];
  const VIP_CONV_RATIOS = [
    [1, 0.7, 0.3],
    [1, 0.5, 0.5],
    [1, 1, 1],
    [0.44, 1, 0.88],
    [0.1, 1, 0.41],
    [0.05, 1, 0.4]
  ];

  const [a, b, c] = VIP_RATIOS[tier];
  const [rawD, rawE, rawF] = VIP_CONV_RATIOS[tier];

  const d = selectedCostTypes.includes('money') ? rawD : 0;
  const e = selectedCostTypes.includes('mc') ? rawE : 0;
  const f = selectedCostTypes.includes('pts') ? rawF : 0;

  const sumABC = a + b + c;
  const sumDEF = d + e + f;

  let newA, newB, newC;
  const defaultTypes = tier === 0 ? ['money'] : (tier === 1 ? ['mc', 'pts'] : ['money', 'mc', 'pts']);
  const isSameAsDefault = selectedCostTypes.length === defaultTypes.length &&
                          selectedCostTypes.every(t => defaultTypes.includes(t));

  if (isSameAsDefault) {
    newA = a;
    newB = b;
    newC = c;
  } else {
    // 避免除以 0
    const safeSumDEF = sumDEF === 0 ? 1 : sumDEF;
    newA = sumABC * (d / safeSumDEF);
    newB = sumABC * (e / safeSumDEF);
    newC = sumABC * (f / safeSumDEF);
  }

  const unfloatedCost = {
    money: newA * BASE_UNITS[0],
    mc: newB * BASE_UNITS[1],
    pts: newC * BASE_UNITS[2]
  };

  // 步驟 E: 計算最終預估成本
  const finalPurchaseMultiplier = totalMultiplier * purchaseRatio;
  const purchaseCost = {
    money: Math.round(unfloatedCost.money * finalPurchaseMultiplier),
    mc: Math.round(unfloatedCost.mc * finalPurchaseMultiplier),
    pts: Math.round(unfloatedCost.pts * finalPurchaseMultiplier)
  };

  const baseCraftMultiplier = 0.5;
  const finalCraftMultiplier = totalMultiplier * craftRatio * baseCraftMultiplier;
  const craftCost = {
    money: Math.round(unfloatedCost.money * finalCraftMultiplier),
    mc: Math.round(unfloatedCost.mc * finalCraftMultiplier),
    pts: Math.round(unfloatedCost.pts * finalCraftMultiplier)
  };

  return {
    purchaseCost,
    craftCost,
    multipliers: {
      usage: usageMultiplier,
      tier: tierPenalty,
      duration: durationMultiplier,
      total: totalMultiplier,
      purchase: purchaseRatio,
      craft: craftRatio
    }
  };
};

// ==========================================
// 催眠製作區塊 (Crafting)
// ==========================================
const HypnosisCraftSection: React.FC<{
  data: RuntimeData;
  reload: () => void;
}> = ({ data, reload }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tier, setTier] = useState(4);
  const [costTypes, setCostTypes] = useState<string[]>(['money', 'mc', 'pts']);
  const [isPermanent, setIsPermanent] = useState(false);
  const [isOneTime, setIsOneTime] = useState(false);
  const [energyCost, setEnergyCost] = useState(50);
  const [note, setNote] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // 權限檢查
  if (data.user.vipTier < 4) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertTriangle size={32} className="text-red-400 mb-3 opacity-80" />
        <div className="text-base font-bold text-white mb-1">權限不足</div>
        <div className="text-xs text-gray-400">催眠製作功能僅開放給 VIP 4 以上的玩家</div>
      </div>
    );
  }

  // 處理 VIP 等級與持續時間變更時，自動帶入預設值
  const handleTierOrDurationChange = (newTier: number, newPermanent: boolean, newOneTime: boolean) => {
    // 更新狀態
    setTier(newTier);
    setIsPermanent(newPermanent);
    setIsOneTime(newOneTime);

    // 1. 自動帶入預設 costTypes
    if (newTier === 0) setCostTypes(['money']);
    else if (newTier === 1) setCostTypes(['mc', 'pts']);
    else setCostTypes(['money', 'mc', 'pts']);

    // 2. 自動帶入預設 MC 消耗 (中位數)
    const EXPECTED_MC_RANGES = {
      normal: [ [1,5], [1,5], [5,12], [25,30], [40,60], [90,150] ],
      onetime: [ [1,10], [1,12], [10,30], [50,150], [240,360], [400,540] ],
      permanent: [ [900,1500], [900,1500], [900,1500], [900,1500], [900,1500], [900,1500] ]
    };
    const typeKey = newPermanent ? 'permanent' : (newOneTime ? 'onetime' : 'normal');
    const [minExp, maxExp] = EXPECTED_MC_RANGES[typeKey][newTier];
    setEnergyCost(Math.round((minExp + maxExp) / 2));
  };

  // 處理是否永久與一次性的連動
  const handlePermanentChange = (val: boolean) => {
    handleTierOrDurationChange(tier, val, val ? true : isOneTime);
  };

  const handleOneTimeChange = (val: boolean) => {
    if (isPermanent) return; // 永久必定是一次性
    handleTierOrDurationChange(tier, isPermanent, val);
  };

  const handleTierChange = (newTier: number) => {
    handleTierOrDurationChange(newTier, isPermanent, isOneTime);
  };

  const handleCostTypeToggle = (type: string) => {
    setCostTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  // 實時計算成本
  const { purchaseCost, craftCost, multipliers } = useMemo(() => {
    return calculateCosts(tier, energyCost, isPermanent, isOneTime, costTypes);
  }, [tier, energyCost, isPermanent, isOneTime, costTypes]);

  const canAffordCraft = data.user.money >= (craftCost.money || 0) &&
                         data.user.mcEnergy >= (craftCost.mc || 0) &&
                         data.user.mcPoints >= (craftCost.pts || 0);

  const canCraft = name.trim().length > 0 && description.trim().length > 0 && costTypes.length > 0 && canAffordCraft;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-4 flex flex-col gap-4">
        {/* 名稱 */}
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">催眠名稱 <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="請輸入催眠名稱..."
            className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">催眠效果描述 <span className="text-red-400">*</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="請輸入詳細的效果描述..."
            rows={3}
            className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* 需求 VIP 等級 */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">需求 VIP 等級</label>
            <select
              value={tier}
              onChange={e => handleTierChange(Number(e.target.value))}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50 appearance-none"
            >
              {[0, 1, 2, 3, 4, 5].map(t => (
                <option key={t} value={t}>
                  VIP {t}
                  {t === 0 && ' (微弱)'}
                  {t === 2 && ' (中等)'}
                  {t === 4 && ' (強烈)'}
                  {t === 5 && ' (極端/永久)'}
                </option>
              ))}
            </select>
          </div>

          {/* MC 能量消耗 */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">MC 能量消耗</label>
            <input
              type="number"
              min={0}
              value={energyCost}
              onChange={e => setEnergyCost(Number(e.target.value) || 0)}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            />
          </div>
        </div>

        {/* 屬性切換 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-gray-500 mb-2 block">是否為永久催眠</label>
            <button
              onClick={() => handlePermanentChange(!isPermanent)}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                isPermanent ? 'bg-purple-600 text-white border-purple-500' : 'bg-[#0c0a1e] text-gray-400 border-purple-900/30'
              }`}
            >
              {isPermanent ? '是' : '否'}
            </button>
          </div>
          <div>
            <label className="text-[10px] text-gray-500 mb-2 block">是否為一次性催眠</label>
            <button
              onClick={() => handleOneTimeChange(!isOneTime)}
              disabled={isPermanent}
              className={`w-full py-2 rounded-lg text-xs font-semibold transition-colors border ${
                isOneTime ? 'bg-purple-600 text-white border-purple-500' : 'bg-[#0c0a1e] text-gray-400 border-purple-900/30'
              } ${isPermanent ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isOneTime ? '是' : '否'}
            </button>
          </div>
        </div>

        {/* 購買所需花費類型 */}
        <div>
          <label className="text-[10px] text-gray-500 mb-2 block">購買所需花費類型 (可多選) <span className="text-red-400">*</span></label>
          <div className="flex gap-2">
            <button
              onClick={() => handleCostTypeToggle('money')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                costTypes.includes('money') ? 'bg-yellow-900/30 text-yellow-400 border-yellow-500/30' : 'bg-[#0c0a1e] text-gray-500 border-purple-900/30'
              }`}
            >
              金錢
            </button>
            <button
              onClick={() => handleCostTypeToggle('pts')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                costTypes.includes('pts') ? 'bg-purple-900/30 text-purple-400 border-purple-500/30' : 'bg-[#0c0a1e] text-gray-500 border-purple-900/30'
              }`}
            >
              PTS
            </button>
            <button
              onClick={() => handleCostTypeToggle('mc')}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors border ${
                costTypes.includes('mc') ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500/30' : 'bg-[#0c0a1e] text-gray-500 border-purple-900/30'
              }`}
            >
              MC 能量
            </button>
          </div>
        </div>

        {/* 備註提示 */}
        <div>
          <label className="text-[10px] text-gray-500 mb-1 block">備註欄位提示</label>
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="例如: 請填入觸發關鍵字..."
            className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
          />
        </div>

        {/* 預估成本 (實時顯示) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0c0a1e] rounded-lg p-3 border border-purple-900/30 flex flex-col">
            <div className="text-[10px] text-gray-500 mb-1">預估製作成本</div>
            <div className="flex flex-col gap-1 mb-2">
              {craftCost.money !== undefined && craftCost.money > 0 && (
                <div className={`text-xs font-semibold ${data.user.money >= craftCost.money ? 'text-yellow-400' : 'text-red-400'}`}>
                  ¥{craftCost.money.toLocaleString()}
                </div>
              )}
              {craftCost.mc !== undefined && craftCost.mc > 0 && (
                <div className={`text-xs font-semibold ${data.user.mcEnergy >= craftCost.mc ? 'text-cyan-400' : 'text-red-400'}`}>
                  {craftCost.mc.toLocaleString()} MC
                </div>
              )}
              {craftCost.pts !== undefined && craftCost.pts > 0 && (
                <div className={`text-xs font-semibold ${data.user.mcPoints >= craftCost.pts ? 'text-purple-400' : 'text-red-400'}`}>
                  {craftCost.pts.toLocaleString()} PTS
                </div>
              )}
              {(!craftCost.money && !craftCost.mc && !craftCost.pts) && (
                <div className="text-xs text-emerald-400 font-semibold">免費</div>
              )}
            </div>
            <div className="mt-auto border-t border-purple-900/20 pt-2 grid grid-cols-2 gap-x-2 gap-y-1">
              <div className="text-[9px] text-gray-500 flex justify-between">消耗: <span className={multipliers.usage > 1 ? 'text-red-400' : 'text-emerald-400'}>x{multipliers.usage.toFixed(2)}</span></div>
              <div className="text-[9px] text-gray-500 flex justify-between">越級: <span className={multipliers.tier > 1 ? 'text-red-400' : 'text-gray-400'}>x{multipliers.tier.toFixed(1)}</span></div>
              <div className="text-[9px] text-gray-500 flex justify-between">類型: <span className="text-gray-400">x{multipliers.duration.toFixed(1)}</span></div>
              <div className="text-[9px] text-gray-500 flex justify-between">種類: <span className={multipliers.craft > 1 ? 'text-red-400' : 'text-emerald-400'}>x{multipliers.craft.toFixed(1)}</span></div>
              <div className="col-span-2 text-[9px] font-semibold text-gray-400 flex justify-between pt-1">總浮動: <span className="text-purple-400">x{multipliers.total.toFixed(2)}</span></div>
            </div>
            {!canAffordCraft && (
              <div className="text-[10px] text-red-400 mt-2 flex items-center gap-1">
                <AlertTriangle size={12} />
                資源不足，無法製作
              </div>
            )}
          </div>

          <div className="bg-[#0c0a1e] rounded-lg p-3 border border-purple-900/30 flex flex-col">
            <div className="text-[10px] text-gray-500 mb-1">預估購買成本</div>
            <div className="flex flex-col gap-1 mb-2">
              {purchaseCost.money !== undefined && purchaseCost.money > 0 && (
                <div className="text-xs font-semibold text-yellow-400">
                  ¥{purchaseCost.money.toLocaleString()}
                </div>
              )}
              {purchaseCost.mc !== undefined && purchaseCost.mc > 0 && (
                <div className="text-xs font-semibold text-cyan-400">
                  {purchaseCost.mc.toLocaleString()} MC
                </div>
              )}
              {purchaseCost.pts !== undefined && purchaseCost.pts > 0 && (
                <div className="text-xs font-semibold text-purple-400">
                  {purchaseCost.pts.toLocaleString()} PTS
                </div>
              )}
              {(!purchaseCost.money && !purchaseCost.mc && !purchaseCost.pts) && (
                <div className="text-xs text-emerald-400 font-semibold">免費</div>
              )}
            </div>
            <div className="mt-auto border-t border-purple-900/20 pt-2 flex flex-col gap-1">
              <div className="text-[9px] text-gray-500 flex justify-between">種類影響: <span className={multipliers.purchase > 1 ? 'text-red-400' : 'text-emerald-400'}>x{multipliers.purchase.toFixed(1)}</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* 製作按鈕 */}
      <button
        onClick={() => setShowConfirm(true)}
        disabled={!canCraft}
        className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale flex items-center justify-center gap-2 shadow-lg shadow-purple-900/20"
      >
        <Hammer size={16} />
        製作催眠
      </button>

      {/* 確認製作 Modal */}
      {showConfirm && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4 flex flex-col justify-center">
            <div className="bg-[#13102a] rounded-xl border border-purple-900/25 p-5 flex flex-col gap-4 shadow-2xl">
              <div className="flex items-center gap-2 text-purple-400 font-bold text-lg mb-2">
                <Hammer size={20} />
                確認製作催眠
              </div>

              <div className="text-sm text-gray-300">
                即將製作自訂催眠 <span className="text-white font-bold">「{name}」</span>。
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#0c0a1e] rounded-lg p-3 border border-purple-900/30">
                  <div className="text-[10px] text-gray-500 mb-1">預估製作成本</div>
                  <div className="flex flex-col gap-1">
                    {craftCost.money !== undefined && craftCost.money > 0 && (
                      <div className="text-xs text-yellow-400 font-semibold">¥{craftCost.money.toLocaleString()}</div>
                    )}
                    {craftCost.mc !== undefined && craftCost.mc > 0 && (
                      <div className="text-xs text-cyan-400 font-semibold">{craftCost.mc.toLocaleString()} MC</div>
                    )}
                    {craftCost.pts !== undefined && craftCost.pts > 0 && (
                      <div className="text-xs text-purple-400 font-semibold">{craftCost.pts.toLocaleString()} PTS</div>
                    )}
                    {(!craftCost.money && !craftCost.mc && !craftCost.pts) && (
                      <div className="text-xs text-emerald-400 font-semibold">免費</div>
                    )}
                  </div>
                </div>

                <div className="bg-[#0c0a1e] rounded-lg p-3 border border-purple-900/30">
                  <div className="text-[10px] text-gray-500 mb-1">未來購買成本</div>
                  <div className="flex flex-col gap-1">
                    {purchaseCost.money !== undefined && purchaseCost.money > 0 && (
                      <div className="text-xs text-yellow-400 font-semibold">¥{purchaseCost.money.toLocaleString()}</div>
                    )}
                    {purchaseCost.mc !== undefined && purchaseCost.mc > 0 && (
                      <div className="text-xs text-cyan-400 font-semibold">{purchaseCost.mc.toLocaleString()} MC</div>
                    )}
                    {purchaseCost.pts !== undefined && purchaseCost.pts > 0 && (
                      <div className="text-xs text-purple-400 font-semibold">{purchaseCost.pts.toLocaleString()} PTS</div>
                    )}
                    {(!purchaseCost.money && !purchaseCost.mc && !purchaseCost.pts) && (
                      <div className="text-xs text-emerald-400 font-semibold">免費</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={async () => {
                    const id = `ch_${new Date().toISOString().replace(/\D/g, '')}`;
                    const def: HypnosisDef = {
                      name,
                      description,
                      tier,
                      cost: {
                        money: purchaseCost.money && purchaseCost.money > 0 ? purchaseCost.money : undefined,
                        pts: purchaseCost.pts && purchaseCost.pts > 0 ? purchaseCost.pts : undefined,
                        mc: purchaseCost.mc && purchaseCost.mc > 0 ? purchaseCost.mc : undefined
                      },
                      isCustom: true,
                      isPermanent,
                      isOneTime,
                      energyCost,
                      defaultNote: note || undefined
                    };

                    // 扣除資源
                    const patch: any = {};
                    if (craftCost.money) patch.money = data.user.money - craftCost.money;
                    if (craftCost.pts) patch.mcPoints = data.user.mcPoints - craftCost.pts;
                    if (craftCost.mc) patch.mcEnergy = data.user.mcEnergy - craftCost.mc;

                    await MockApi.updateUserResource(patch);
                    await MockApi.saveNewHypnosis(id, def);
                    reload();
                    setShowConfirm(false);
                    setName('');
                    setDescription('');
                    setTier(4);
                    setCostTypes(['money', 'mc', 'pts']);
                    setIsPermanent(false);
                    setIsOneTime(false);
                    setEnergyCost(50);
                    setNote('');
                  }}
                  className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors"
                >
                  確認製作
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
