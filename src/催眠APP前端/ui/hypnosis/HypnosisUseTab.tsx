import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RuntimeData, HypnosisDef, MockApi } from './mockData';
import {
  Zap, Coins, Star, Eye, List, Play, ChevronDown,
  X, AlertTriangle, Bookmark, Check
} from 'lucide-react';

// ==========================================
// 施加方式選項
// ==========================================
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

// ==========================================
// 施加方式 → 所需設備 ID 映射
// ==========================================
const APPLY_METHOD_REQUIRED_EQUIPMENT: Record<string, string[]> = {
  '直接輸入-圖像': ['eq_screen'],
  '直接輸入-聲音': ['eq_audio_modulator'],
  '直接輸入-文字': ['eq_text_compiler'],
  '間接輸入-圖像': ['eq_screen', 'eq_img_mix'],
  '間接輸入-聲音': ['eq_audio_modulator', 'eq_audio_mix'],
  '間接輸入-文字': ['eq_text_compiler', 'eq_text_mix'],
  '間接輸入-氣體': ['eq_gas_modulator', 'eq_gas_maker', 'eq_gas_diffuser'],
  '間接輸入-電磁波': ['eq_em_modulator', 'eq_em_transmitter', 'eq_em_receiver'],
};

/** 檢查施加方式所需的設備，回傳缺少的設備名稱列表 */
function getMissingEquipment(
  method: string,
  ownedEquipments: Record<string, { enabled: boolean }>,
  equipmentDefs: Record<string, { name: string }>
): string[] {
  const required = APPLY_METHOD_REQUIRED_EQUIPMENT[method] || [];
  return required
    .filter(eqId => !ownedEquipments[eqId] || !ownedEquipments[eqId].enabled)
    .map(eqId => equipmentDefs[eqId]?.name || eqId);
}

// ==========================================
// 每個催眠項目的啟用狀態
// ==========================================
interface HypnosisItemState {
  enabled: boolean;
  duration: number | 'onetime' | 'permanent';
  applyMethod: string;
  targets: string[];
  customTarget: string;
  note: string;
}

// ==========================================
// 催眠使用區 Tab
// ==========================================
export const HypnosisUseTab: React.FC<{
  data: RuntimeData | null;
  reload: () => void;
  vipEndDate: string;
  mcPercent: number;
  formatMoney: (val: number) => string;
}> = ({ data, reload, vipEndDate, mcPercent, formatMoney }) => {
  const [activeVipTab, setActiveVipTab] = useState(0);
  const [itemStates, setItemStates] = useState<Record<string, HypnosisItemState>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [showSavedCombos, setShowSavedCombos] = useState(false);
  const [showAddComboConfirm, setShowAddComboConfirm] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // 當確認面板或收藏面板開啟時，鎖定父層滾動容器
  useEffect(() => {
    const scrollParent = rootRef.current?.parentElement;
    if (!scrollParent) return;
    if (showConfirm || showSavedCombos || showAddComboConfirm) {
      scrollParent.style.overflow = 'hidden';
    } else {
      scrollParent.style.overflow = '';
    }
    return () => { scrollParent.style.overflow = ''; };
  }, [showConfirm, showSavedCombos, showAddComboConfirm]);

  // 按 VIP 等級分組催眠列表 (只顯示 enabled=true 即「可見」的項目)
  const hypnosisByTier = useMemo(() => {
    if (!data) return {};
    const groups: Record<number, Array<{ id: string; def: HypnosisDef }>> = {};
    for (const [id, def] of Object.entries(data.hypnosis)) {
      const owned = data.user.ownedHypnosis[id];
      if (!owned || !owned.enabled) continue; // enabled=false 代表用戶隱藏了此催眠
      const t = def.tier;
      if (!groups[t]) groups[t] = [];
      groups[t].push({ id, def });
    }
    return groups;
  }, [data]);

  // 取得或初始化項目狀態 (enabled 此處是「本次啟用」，預設 false)
  const getState = (id: string, def: HypnosisDef): HypnosisItemState => {
    if (itemStates[id]) return itemStates[id];
    return {
      enabled: false, // 預設未啟用 (需要用戶手動 toggle 開啟)
      duration: def.isPermanent ? 'permanent' : def.isOneTime ? 'onetime' : 10,
      applyMethod: '',
      targets: [],
      customTarget: '',
      note: '',
    };
  };

  const updateState = (id: string, patch: Partial<HypnosisItemState>) => {
    setItemStates(prev => ({
      ...prev,
      [id]: { ...getState(id, data!.hypnosis[id]), ...prev[id], ...patch },
    }));
  };

  const toggleItem = (id: string, def: HypnosisDef) => {
    const cur = getState(id, def);
    updateState(id, { enabled: !cur.enabled });
  };

  // 計算已啟用的催眠 (只看 itemStates 中 enabled=true 的，且必須是擁有的)
  const enabledItems = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.hypnosis)
      .filter(([id]) => {
        const owned = data.user.ownedHypnosis[id];
        if (!owned || !owned.enabled) return false; // 必須擁有且可見
        return itemStates[id]?.enabled === true; // 且本次 session 手動 toggle 開啟
      })
      .map(([id, def]) => ({ id, def, state: getState(id, def) }));
  }, [data, itemStates]);

  const totalMcCost = enabledItems.reduce((sum, { def, state }) => {
    if (def.isOneTime) return sum + def.energyCost;
    const dur = typeof state.duration === 'number' ? state.duration : 10;
    return sum + def.energyCost * (def.isPermanent ? 1 : dur);
  }, 0);

  const handleLaunchHypnosis = () => {
    const launchData = enabledItems.map(({ id, state, def }) => {
      const targets = [...state.targets, state.customTarget].filter(Boolean);
      return {
        id,
        applyMethod: state.applyMethod || '直接輸入-圖像',
        target: targets.join(', '),
        duration: def.isPermanent ? 'permanent' : def.isOneTime ? 'onetime' : state.duration,
        note: state.note
      };
    });
    console.log('[HypnoOS] 啟動催眠，選中項目:', launchData, '總消耗:', totalMcCost);
    // TODO: 之後在這裡接上實際發送功能
    setShowConfirm(false);
  };

  if (!data) return null;

  return (
    <div ref={rootRef} className="flex flex-col h-full relative overflow-hidden">
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
      {/* 標題行: 目前擁有的催眠 + 催眠啟動按鈕 */}
      {/* ============================================ */}
      <div className="flex items-center justify-between px-5 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <List size={16} className="text-gray-400" />
          <span className="text-[15px] font-bold text-white">目前擁有的催眠</span>
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
        >
          <Play size={12} fill="currentColor" />
          催眠啟動
        </button>
      </div>

      {/* ============================================ */}
      {/* VIP 等級頁籤 */}
      {/* ============================================ */}
      <div className="px-4 pb-2">
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
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
      </div>

      {/* ============================================ */}
      {/* 催眠列表 */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 flex flex-col gap-2 no-scrollbar">
        {(hypnosisByTier[activeVipTab] || []).map(({ id, def }) => {
          const state = getState(id, def);
          return (
            <HypnosisItemCard
              key={id}
              id={id}
              def={def}
              state={state}
              charNames={Object.keys(data.chars)}
              onToggle={() => toggleItem(id, def)}
              onUpdate={(patch) => updateState(id, patch)}
            />
          );
        })}
        {!(hypnosisByTier[activeVipTab]?.length) && (
          <div className="text-center py-8 text-gray-600 text-sm">
            此等級下沒有擁有的催眠
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* 收藏組合懸浮按鈕 */}
      {/* ============================================ */}
      <button
        onClick={() => setShowSavedCombos(true)}
        className="absolute bottom-6 right-4 w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-900/40 flex items-center justify-center transition-colors z-30"
      >
        <Bookmark size={20} className="text-white" />
      </button>

      {/* ============================================ */}
      {/* 確認啟動催眠 Modal */}
      {/* ============================================ */}
      {showConfirm && (
        <ConfirmModal
          enabledItems={enabledItems}
          totalMcCost={totalMcCost}
          userEnergy={data.user.mcEnergy}
          ownedEquipments={data.user.ownedEquipments}
          equipmentDefs={data.equipment}
          onClose={() => setShowConfirm(false)}
          onConfirm={handleLaunchHypnosis}
        />
      )}

      {/* ============================================ */}
      {/* 收藏組合列表 Modal */}
      {/* ============================================ */}
      {showSavedCombos && (
        <SavedCombosModal
          data={data}
          onClose={() => setShowSavedCombos(false)}
          onAddComboClick={() => setShowAddComboConfirm(true)}
          onLoadCombo={(comboId) => {
            console.log('[HypnoOS] 載入組合:', comboId);
            const combo = data.combos[comboId];
            if (combo) {
              const newStates = { ...itemStates };

              // 1. 先將所有項目設為未啟用
              Object.keys(newStates).forEach(id => {
                newStates[id] = { ...newStates[id], enabled: false };
              });

              // 2. 載入組合中的設定
              Object.entries(combo.includedHypnosis).forEach(([hypId, config]) => {
                const def = data.hypnosis[hypId];
                if (!def) return;

                // 必須是玩家擁有的且未被隱藏的項目才能啟用
                const owned = data.user.ownedHypnosis[hypId];
                if (!owned || !owned.enabled) return;

                // 解析 duration，處理 'onetime' 和 'permanent'
                let parsedDuration = 10; // 預設值
                if (config.duration === 'onetime' || config.duration === 'permanent') {
                  parsedDuration = -1;
                } else if (typeof config.duration === 'number') {
                  parsedDuration = config.duration;
                }

                newStates[hypId] = {
                  enabled: true,
                  duration: parsedDuration,
                  applyMethod: config.applyMethod,
                  targets: [], // 組合中只有單一 target 字串
                  customTarget: config.target || '',
                  note: config.note || '',
                };
              });

              setItemStates(newStates);
            }
            setShowSavedCombos(false);
          }}
        />
      )}

      {/* ============================================ */}
      {/* 確認新增催眠組合 Modal */}
      {/* ============================================ */}
      {showAddComboConfirm && (
        <AddComboConfirmModal
          enabledItems={enabledItems}
          onClose={() => setShowAddComboConfirm(false)}
          onConfirm={async (name, description) => {
            const includedHypnosis: Record<string, any> = {};
            enabledItems.forEach(({ id, state, def }) => {
              const targets = [...state.targets, state.customTarget].filter(Boolean);
              includedHypnosis[id] = {
                applyMethod: state.applyMethod || '直接輸入-圖像',
                target: targets.join(', '),
                duration: def.isPermanent ? 'permanent' : def.isOneTime ? 'onetime' : state.duration,
                note: state.note
              };
            });
            console.log('[HypnoOS] 新增催眠組合:', { name, description, includedHypnosis });

            const comboId = `chc_${new Date().toISOString().replace(/\D/g, '')}`;
            await MockApi.saveNewCombo(comboId, {
              name,
              description,
              includedHypnosis
            });

            if (reload) reload();

            setShowAddComboConfirm(false);
            setShowSavedCombos(false); // 也可以選擇關閉列表
          }}
        />
      )}
    </div>
  );
};

// ==========================================
// 催眠項目卡片
// ==========================================
const HypnosisItemCard: React.FC<{
  id: string;
  def: HypnosisDef;
  state: HypnosisItemState;
  charNames: string[];
  onToggle: () => void;
  onUpdate: (patch: Partial<HypnosisItemState>) => void;
}> = ({ id, def, state, charNames, onToggle, onUpdate }) => {
  const costLabel = def.isOneTime
    ? `總計: ${def.energyCost} MC`
    : `消耗: ${def.energyCost} MC / 分鐘`;

  return (
    <div className={`rounded-xl border transition-colors ${
      state.enabled
        ? 'bg-[#1a1035] border-purple-500/40'
        : 'bg-[#13102a] border-purple-900/25'
    }`}>
      {/* 頂部行: 名稱 + 消耗 + 開關 */}
      <div className="flex items-center gap-3 px-3.5 py-3">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm text-white truncate">{def.name}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            {costLabel}
            {state.enabled && !def.isOneTime && !def.isPermanent && (
              <span className="ml-2 text-amber-400 font-semibold">總計: {def.energyCost * (typeof state.duration === 'number' ? state.duration : 10)} MC</span>
            )}
          </div>
        </div>
        {/* Toggle Switch */}
        <button
          onClick={onToggle}
          className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
            state.enabled ? 'bg-purple-500' : 'bg-gray-700'
          }`}
        >
          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            state.enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`} />
        </button>
      </div>

      {/* 展開區: 啟用後顯示 */}
      {state.enabled && (
        <div className="px-3.5 pb-3 border-t border-purple-800/20 pt-2.5">
          {/* 效果描述 */}
          <div className="text-[11px] text-gray-400 leading-relaxed mb-3 bg-[#0c0a1e] rounded-lg p-2.5 border border-purple-900/20">
            <span className="text-purple-400 font-medium">效果與強度: </span>
            {def.description}
          </div>

          {/* 輸入區 */}
          <div className="grid grid-cols-2 gap-2.5 mb-2.5">
            {/* 持續時間 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">持續時間 (分鐘)</label>
              <input
                type={def.isPermanent || def.isOneTime ? "text" : "number"}
                min={1}
                value={def.isPermanent ? '永久' : def.isOneTime ? '一次性' : state.duration}
                disabled={def.isPermanent || def.isOneTime}
                onChange={e => onUpdate({ duration: parseInt(e.target.value) || 10 })}
                className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-purple-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="10"
              />
            </div>
            {/* 施加方式 */}
            <div>
              <label className="text-[10px] text-gray-500 mb-1 block">施加方式</label>
              <select
                value={state.applyMethod}
                onChange={e => onUpdate({ applyMethod: e.target.value })}
                className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-purple-500/50 appearance-none"
              >
                <option value="">請選擇</option>
                {APPLY_METHODS.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 施加對象 */}
          <div className="mb-2.5">
            <label className="text-[10px] text-gray-500 mb-1 block">施加對象 (可多選或自填)</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {charNames.map(t => {
                const selected = state.targets.includes(t);
                return (
                  <button
                    key={t}
                    onClick={() => {
                      const next = selected
                        ? state.targets.filter(x => x !== t)
                        : [...state.targets, t];
                      onUpdate({ targets: next });
                    }}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors border ${
                      selected
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-[#0c0a1e] border-purple-900/30 text-gray-400 hover:border-purple-500/40'
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={state.customTarget}
              onChange={e => onUpdate({ customTarget: e.target.value })}
              placeholder="其他自訂對象..."
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-gray-600"
            />
          </div>

          {/* 備註 */}
          <div>
            <label className="text-[10px] text-purple-400 font-medium mb-1 block">備註</label>
            <textarea
              value={state.note}
              onChange={e => onUpdate({ note: e.target.value })}
              placeholder={def.defaultNote || '輸入詳細指令或設定...'}
              rows={2}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-2.5 py-2 text-sm text-white outline-none focus:border-purple-500/50 placeholder:text-gray-600 resize-none"
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ==========================================
// 收藏組合列表 Modal
// ==========================================
const SavedCombosModal: React.FC<{
  data: RuntimeData;
  onClose: () => void;
  onAddComboClick: () => void;
  onLoadCombo: (comboId: string) => void;
}> = ({ data, onClose, onAddComboClick, onLoadCombo }) => {
  // 過濾出用戶擁有的組合
  const ownedCombos = Object.entries(data.combos).filter(([id]) => {
    const owned = data.user.ownedCombos[id];
    return owned && owned.enabled;
  });

  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-purple-400" />
            <span className="text-base font-bold text-white">收藏的催眠組合</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 組合列表 */}
        {ownedCombos.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            尚未收藏任何催眠組合
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ownedCombos.map(([id, combo]) => (
              <div key={id} className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3.5 py-3">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div className="font-semibold text-sm text-white mb-0.5">{combo.name}</div>
                    <div className="text-[11px] text-gray-400 leading-relaxed">{combo.description}</div>
                  </div>
                  <button
                    onClick={() => onLoadCombo(id)}
                    className="shrink-0 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    載入組合
                  </button>
                </div>

                {/* 包含的催眠項目 */}
                <div className="mt-2 pt-2 border-t border-purple-900/20">
                  <div className="text-[10px] text-purple-400 font-medium mb-1.5">包含項目:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(combo.includedHypnosis).map(hypId => {
                      const def = data.hypnosis[hypId];
                      if (!def) return null;
                      return (
                        <span key={hypId} className="px-2 py-0.5 rounded-md bg-[#0c0a1e] border border-purple-900/30 text-[10px] text-gray-300">
                          {def.name}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部按鈕 */}
      <div className="px-4 pb-4 flex gap-3 shrink-0">
        <button
          onClick={onAddComboClick}
          className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Bookmark size={14} className="text-white" />
          收藏當前選擇的催眠成組合
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 確認新增催眠組合 Modal
// ==========================================
const AddComboConfirmModal: React.FC<{
  enabledItems: Array<{ id: string; def: HypnosisDef; state: HypnosisItemState }>;
  onClose: () => void;
  onConfirm: (name: string, description: string) => void;
}> = ({ enabledItems, onClose, onConfirm }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const canSave = name.trim().length > 0 && enabledItems.length > 0;

  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bookmark size={18} className="text-purple-400" />
            <span className="text-base font-bold text-white">新增催眠組合</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 內容區 */}
        <div className="flex flex-col gap-4">
          {/* 名稱輸入 */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">組合名稱 <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="請輸入組合名稱..."
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50"
            />
          </div>

          {/* 描述輸入 */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">組合描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="請輸入組合描述 (選填)..."
              rows={3}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          {/* 包含項目列表 */}
          <div>
            <label className="text-[10px] text-gray-500 mb-1 block">包含項目 ({enabledItems.length})</label>
            {enabledItems.length === 0 ? (
              <div className="text-center py-4 text-sm bg-[#13102a] rounded-xl border border-red-500/40 text-red-400">
                請先在列表中選擇要加入組合的催眠項目
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {enabledItems.map(({ id, def, state }) => {
                  const targets = [...state.targets, state.customTarget].filter(Boolean);
                  const durationLabel = def.isPermanent ? '永久性' : def.isOneTime ? '一次性' : `${state.duration} 分鐘`;
                  return (
                    <div key={id} className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3 py-2">
                      <div className="text-sm text-white font-semibold flex items-center gap-2 mb-1.5">
                        <Check size={14} className="text-purple-400" />
                        {def.name}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-400 pl-5">
                        <span>施加方式: {state.applyMethod || '直接輸入-圖像'}</span>
                        <span className={targets.length === 0 ? 'text-red-400' : ''}>
                          對象: {targets.length > 0 ? targets.join(', ') : '⚠ 未設定'}
                        </span>
                        <span>持續時間: {durationLabel}</span>
                        <span>備註: {state.note || '無'}</span>
                      </div>
                    </div>
                  );
                })}
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
          onClick={() => onConfirm(name, description)}
          disabled={!canSave}
          className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Bookmark size={14} className="text-white" />
          確認儲存
        </button>
      </div>
    </div>
  );
};

// ==========================================
// 確認啟動催眠 Modal
// ==========================================
const ConfirmModal: React.FC<{
  enabledItems: Array<{ id: string; def: HypnosisDef; state: HypnosisItemState }>;
  totalMcCost: number;
  userEnergy: number;
  ownedEquipments: Record<string, { enabled: boolean }>;
  equipmentDefs: Record<string, { name: string }>;
  onClose: () => void;
  onConfirm: () => void;
}> = ({ enabledItems, totalMcCost, userEnergy, ownedEquipments, equipmentDefs, onClose, onConfirm }) => {
  // 對每個催眠項目做驗證
  const itemChecks = enabledItems.map(({ id, def, state }) => {
    const method = state.applyMethod || '直接輸入-圖像'; // 預設施加方式
    const missing = getMissingEquipment(method, ownedEquipments, equipmentDefs);
    const targets = [...state.targets, state.customTarget].filter(Boolean);
    const hasTarget = targets.length > 0;
    const cost = def.isOneTime ? def.energyCost : def.energyCost * (state.duration || 10);
    return { id, def, state, method, missing, hasTarget, targets, cost };
  });

  const allMissingEquipment = itemChecks.flatMap(c => c.missing);
  const uniqueMissing = [...new Set(allMissingEquipment)];
  const hasTargetIssue = itemChecks.some(c => !c.hasTarget);
  const energyOk = userEnergy >= totalMcCost;
  const canLaunch = enabledItems.length > 0 && energyOk && uniqueMissing.length === 0 && !hasTargetIssue;

  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {/* 標題 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle size={18} className="text-amber-400" />
            <span className="text-base font-bold text-white">確認啟動催眠</span>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* 已啟用列表 */}
        <div className="text-amber-400 text-sm font-semibold mb-3">目前啟用了哪些催眠:</div>
        {enabledItems.length === 0 ? (
          <div className="text-gray-500 text-sm py-4 text-center">尚未啟用任何催眠</div>
        ) : (
          <div className="flex flex-col gap-2.5 mb-4">
            {itemChecks.map(({ id, def, state, method, missing, hasTarget, targets, cost }) => {
              const hasIssue = missing.length > 0 || !hasTarget;
              return (
                <div key={id} className={`bg-[#13102a] rounded-xl border px-3.5 py-3 ${
                  hasIssue ? 'border-red-500/40' : 'border-purple-900/25'
                }`}>
                  <div className="font-semibold text-sm text-white mb-1.5">{def.name}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[11px] text-gray-400">
                    <span>持續時間: {def.isPermanent ? '永久性' : def.isOneTime ? '一次性' : `${state.duration} 分鐘`}</span>
                    <span>施加方式: {method}</span>
                    <span className={!hasTarget ? 'text-red-400' : ''}>
                      施加對象: {hasTarget ? targets.join(', ') : '⚠ 未設定'}
                    </span>
                    <span>備註: {state.note || '無'}</span>
                  </div>
                  {/* 缺少設備警告 */}
                  {missing.length > 0 && (
                    <div className="flex items-center gap-1 mt-1.5 text-[11px] text-red-400">
                      <AlertTriangle size={11} />
                      <span>缺少設備: {missing.join(', ')}</span>
                    </div>
                  )}
                  <div className="text-amber-400 text-[11px] font-semibold mt-1.5">預計消耗: {cost} MC</div>
                </div>
              );
            })}
          </div>
        )}

        {/* 總消耗 */}
        <div className="bg-[#13102a] rounded-xl border border-purple-900/25 px-3.5 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-white">總共將要消耗:</span>
          <span className={`text-sm font-bold ${energyOk ? 'text-purple-400' : 'text-red-400'}`}>
            {totalMcCost} MC 能量
          </span>
        </div>

        {/* 總缺少設備提醒 */}
        {uniqueMissing.length > 0 && (
          <div className="mt-2.5 bg-red-900/20 rounded-xl border border-red-500/30 px-3.5 py-2.5 flex items-start gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <div className="text-[11px] text-red-400 font-semibold">總共缺少的設備:</div>
              <div className="text-[11px] text-red-300 mt-0.5">{uniqueMissing.join(', ')}</div>
            </div>
          </div>
        )}

        {/* 能量不足提醒 */}
        {!energyOk && (
          <div className="mt-2.5 bg-red-900/20 rounded-xl border border-red-500/30 px-3.5 py-2.5 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-[11px] text-red-400 font-semibold">MC 能量不足，無法啟動</span>
          </div>
        )}

        {/* 施加對象未設定提醒 */}
        {hasTargetIssue && (
          <div className="mt-2.5 bg-red-900/20 rounded-xl border border-red-500/30 px-3.5 py-2.5 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <span className="text-[11px] text-red-400 font-semibold">有催眠的施加對象尚未設定</span>
          </div>
        )}
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
          onClick={onConfirm}
          disabled={!canLaunch}
          className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Play size={14} fill="currentColor" />
          立即啟動
        </button>
      </div>
    </div>
  );
};
