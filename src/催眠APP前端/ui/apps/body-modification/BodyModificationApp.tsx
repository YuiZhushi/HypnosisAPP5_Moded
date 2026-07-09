import React, { useState, useEffect } from 'react';
import { MockcharData, MockUserData, BodyModificationDef, ConditionOnProgram } from '../../../models';
import { MockApi } from '../../../shared/api/mockApi';
import {
  ChevronLeft,
  Coins,
  Star,
  ShieldAlert,
  Wrench,
  Activity,
  Check,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react';

// ==========================================
// 預設部位與分類定義 (Cranial / Torso / Pelvic)
// ==========================================
interface DefaultSlotConfig {
  id: string;
  name: string;
  category: 'cranial' | 'torso' | 'pelvic';
  icon: string;
}

const DEFAULT_SLOTS_CONFIG: DefaultSlotConfig[] = [
  { id: 'mouth', name: '嘴部 / 口腔', category: 'cranial', icon: '👄' },
  { id: 'breastLeft', name: '左側乳房', category: 'torso', icon: '🍒' },
  { id: 'breastRight', name: '右側乳房', category: 'torso', icon: '🍒' },
  { id: 'womb', name: '子宮腔體', category: 'pelvic', icon: '🧬' },
  { id: 'clitoris', name: '陰蒂敏感核', category: 'pelvic', icon: '⚡' },
  { id: 'vagina', name: '陰道通道', category: 'pelvic', icon: '🌀' },
  { id: 'urethra', name: '尿道腺體', category: 'pelvic', icon: '💧' },
  { id: 'anus', name: '肛門括約肌', category: 'pelvic', icon: '🔮' },
];

export const BodyModificationApp: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  // ==========================================
  // 狀態宣告
  // ==========================================
  const [npcList, setNpcList] = useState<string[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<string>('');
  const [npcData, setNpcData] = useState<MockcharData | null>(null);
  const [userData, setUserData] = useState<MockUserData | null>(null);
  const [bodyModsDict, setBodyModsDict] = useState<Record<string, BodyModificationDef>>({});
  const [selectedSlot, setSelectedSlot] = useState<string>('breastLeft');
  const [activeTab, setActiveTab] = useState<'parts' | 'global'>('parts');
  const [loading, setLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // 自訂備註輸入框狀態，Key 為 modId
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>({});

  // ==========================================
  // 數據加載邏輯
  // ==========================================
  const loadData = async (npcName?: string, showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      // 1. 取得所有 NPC 列表
      const chars = await MockApi.getCharData();
      const names = Object.keys(chars);
      setNpcList(names);

      // 2. 確定當前選中的 NPC
      const activeNpc = npcName || selectedNpc || names[0];
      if (activeNpc) {
        setSelectedNpc(activeNpc);
        const activeData = await MockApi.getNpc(activeNpc);
        setNpcData(activeData);

        // 初始化自訂備註描述
        const tempDescs: Record<string, string> = {};
        if (activeData.ownedBodyModifications) {
          Object.entries(activeData.ownedBodyModifications).forEach(([modId, state]) => {
            tempDescs[modId] = state.customDescription || '';
          });
        }
        setCustomDescriptions(tempDescs);
      }

      // 3. 取得玩家資源
      const user = await MockApi.getUserInfo();
      setUserData(user);

      // 4. 取得靜態改造方案定義 (避免直接 import 靜態資料，維持數據流隔離)
      const mods = await MockApi.getAllBodyModifications();
      setBodyModsDict(mods);
    } catch (e) {
      console.error('[BodyModApp] 加載資料失敗:', e);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleNpcChange = (name: string) => {
    setSelectedNpc(name);
    loadData(name, true);
  };

  // ==========================================
  // 手術操作處理
  // ==========================================
  const handlePerformMod = async (modId: string) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await MockApi.performBodyModification(selectedNpc, modId);
      if (res.success) {
        setActionSuccess('手術成功！已安裝身體改造方案。');
        const desc = customDescriptions[modId];
        if (desc) {
          const char = (await MockApi.getCharData())[selectedNpc];
          if (char && char.ownedBodyModifications?.[modId]) {
            char.ownedBodyModifications[modId].customDescription = desc;
          }
        }
        await loadData(selectedNpc, false);
      } else {
        setActionError(res.errorMsg || '手術失敗。');
      }
    } catch (e: any) {
      setActionError(e.message || '手術時發生未預期錯誤。');
    }
  };

  const handleToggleMod = async (modId: string, enabled: boolean) => {
    setActionError(null);
    setActionSuccess(null);
    try {
      const res = await MockApi.toggleBodyModification(selectedNpc, modId, enabled);
      if (res.success) {
        setActionSuccess(enabled ? '改造已啟用。' : '改造已停用，數值加成暫時失效。');
        await loadData(selectedNpc, false);
      } else {
        setActionError(res.errorMsg || '狀態切換失敗。');
      }
    } catch (e: any) {
      setActionError(e.message || '切換狀態時發生未預期錯誤。');
    }
  };

  const handleRemoveMod = async (modId: string) => {
    setActionError(null);
    setActionSuccess(null);
    if (!window.confirm('確定要拆除這項改造嗎？這將會清除所有該改造的適應進度與備註。')) return;

    try {
      const res = await MockApi.removeBodyModification(selectedNpc, modId);
      if (res.success) {
        setActionSuccess('拆除手術完成！');
        const temp = { ...customDescriptions };
        delete temp[modId];
        setCustomDescriptions(temp);
        await loadData(selectedNpc, false);
      } else {
        setActionError(res.errorMsg || '拆除失敗。');
      }
    } catch (e: any) {
      setActionError(e.message || '拆除時發生未預期錯誤。');
    }
  };

  const handleUpdateCustomDescription = async (modId: string, desc: string) => {
    setCustomDescriptions(prev => ({ ...prev, [modId]: desc }));
    try {
      const chars = await MockApi.getCharData();
      const char = chars[selectedNpc];
      if (char && char.ownedBodyModifications?.[modId]) {
        char.ownedBodyModifications[modId].customDescription = desc;
      }
    } catch (e) {
      console.error('[BodyModApp] 更新備註失敗:', e);
    }
  };

  // ==========================================
  // 輔助計算函數
  // ==========================================
  const formatMoney = (val: number) => {
    if (val >= 100000) return `¥${(val / 10000).toFixed(2)}萬`;
    return `¥${val.toLocaleString()}`;
  };

  if (loading || !npcData || !userData || Object.keys(bodyModsDict).length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-gray-950 text-white items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        </div>
        <div className="text-sm text-gray-400 mt-4">載入中...</div>
      </div>
    );
  }

  // 1. 動態部位載入：自動區分預設與新增的自訂部位，達成無限部位擴展
  const defaultPartKeys = DEFAULT_SLOTS_CONFIG.map(s => s.id);
  const customSlots: { id: string; name: string; category: 'extensor'; icon: string }[] = [];

  Object.keys(npcData.bodyParts || {}).forEach(key => {
    if (!defaultPartKeys.includes(key)) {
      customSlots.push({
        id: key,
        name: key === 'tail' ? '外接仿生尾部' : key === 'horns' ? '額頂外接雙角' : `自定義部位 (${key})`,
        category: 'extensor',
        icon: key === 'tail' ? '🐈' : key === 'horns' ? '😈' : '🧬',
      });
    }
  });

  // 將器官按四大科技區塊分類 (Cranial / Torso / Pelvic / Extensor)
  const slotsByCategory = {
    cranial: DEFAULT_SLOTS_CONFIG.filter(s => s.category === 'cranial'),
    torso: DEFAULT_SLOTS_CONFIG.filter(s => s.category === 'torso'),
    pelvic: DEFAULT_SLOTS_CONFIG.filter(s => s.category === 'pelvic'),
    extensor: customSlots,
  };

  const allSlots = [...DEFAULT_SLOTS_CONFIG, ...customSlots];
  const activeSlotData = npcData.bodyParts[selectedSlot];

  // 整理與當前選中部位相關的改造方案
  const localModifications = Object.values(bodyModsDict).filter(
    mod => mod.scope === 'local' && mod.slots.includes(selectedSlot),
  );

  const globalModifications = Object.values(bodyModsDict).filter(mod => mod.scope === 'global');

  // 當前選中部位已安裝的改造
  const installedMods = Object.values(npcData.ownedBodyModifications || {}).filter(state => {
    const def = bodyModsDict[state.id];
    return def && def.scope === 'local' && def.slots.includes(selectedSlot);
  });

  // 全局已安裝材質/全身改造項目
  const installedGlobalMods = Object.values(npcData.ownedBodyModifications || {}).filter(state => {
    const def = bodyModsDict[state.id];
    return def && def.scope === 'global';
  });

  const maxLoad = (npcData as any).maxLoad ?? 14;
  const currentLoad = (npcData as any).currentLoad ?? 0;

  // 輔助：檢查部位是否有安裝任何啟用的改造
  const hasInstalledMod = (slotId: string) => {
    return Object.values(npcData.ownedBodyModifications || {}).some(state => {
      const def = bodyModsDict[state.id];
      return def && def.scope === 'local' && def.slots.includes(slotId) && state.isActive;
    });
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#060410] text-white font-sans overflow-hidden">
      {/* ============================================ */}
      {/* 標題與返回欄 */}
      {/* ============================================ */}
      <div className="relative flex items-center justify-between px-3 md:px-4 py-2 md:py-3 bg-[#0c0918] shrink-0 w-full border-b border-purple-900/30">
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 text-gray-300 hover:text-white transition-colors group shrink-0"
          aria-label="返回OS"
        >
          <ChevronLeft className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] md:text-[13px]">返回 OS</span>
        </button>

        <span className="absolute left-1/2 -translate-x-1/2 font-bold text-[14px] md:text-[16px] tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 font-mono">
          BIO-MOD LAB 控制台
        </span>

        {/* 角色切換選擇器 */}
        <select
          value={selectedNpc}
          onChange={e => handleNpcChange(e.target.value)}
          className="bg-[#130f2b] text-xs text-purple-300 border border-purple-800/40 rounded px-1.5 py-1 focus:outline-none focus:border-purple-500 font-mono"
        >
          {npcList.map(name => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {/* ============================================ */}
      {/* 頂部資源與最大負荷面板 */}
      {/* ============================================ */}
      <div className="p-3 shrink-0 bg-[#0b081a]/60 border-b border-purple-950/20">
        <div className="grid grid-cols-4 gap-2">
          {/* 金幣 */}
          <div className="bg-[#0f0c24] border border-purple-900/30 rounded-lg p-1.5 flex flex-col justify-center">
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <Coins className="w-2.5 h-2.5 text-yellow-400" /> 零花錢
            </span>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-yellow-300 truncate">
              {formatMoney(userData.money || 0)}
            </span>
          </div>

          {/* MC 點數 */}
          <div className="bg-[#0f0c24] border border-purple-900/30 rounded-lg p-1.5 flex flex-col justify-center">
            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
              <Star className="w-2.5 h-2.5 text-purple-400" /> MC點數
            </span>
            <span className="text-[11px] sm:text-xs font-mono font-bold text-purple-300">{userData.mcPoints} PT</span>
          </div>

          {/* 肉體負荷負荷量 */}
          <div className="bg-[#0f0c24] border border-purple-900/30 rounded-lg p-1.5 flex flex-col justify-center col-span-2 relative">
            <span className="text-[9px] text-gray-400 flex items-center justify-between">
              <span className="flex items-center gap-0.5">
                <Activity className="w-2.5 h-2.5 text-pink-400" /> 生物肉體負荷 (Load)
              </span>
              <span className="text-[8px] text-purple-400 font-mono">
                自訂器官+{customSlots.length} (Max +{customSlots.length * 2})
              </span>
            </span>
            <div className="flex items-center justify-between mt-0.5">
              <div className="w-full h-1.5 bg-[#171235] rounded-full overflow-hidden mr-2">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    currentLoad > maxLoad ? 'bg-red-500' : 'bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400'
                  }`}
                  style={{ width: `${Math.min(100, (currentLoad / maxLoad) * 100)}%` }}
                />
              </div>
              <span className="text-[11px] font-mono font-bold text-pink-300 whitespace-nowrap">
                {currentLoad}/{maxLoad}
              </span>
            </div>
          </div>
        </div>

        {/* 提示訊息 */}
        {actionError && (
          <div className="mt-2 bg-red-950/40 border border-red-900/40 rounded px-2.5 py-1.5 text-[10px] text-red-300 flex items-center gap-1.5 animate-pulse">
            <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
            <span>{actionError}</span>
          </div>
        )}
        {actionSuccess && (
          <div className="mt-2 bg-green-950/40 border border-green-900/40 rounded px-2.5 py-1.5 text-[10px] text-green-300 flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* 主介面雙欄：左側 HUD 列表導航，右側改造工作坊 */}
      {/* ============================================ */}
      <div className="flex-1 flex overflow-hidden w-full">
        {/* ========================================== */}
        {/* 左側：全息器官插槽樹狀 HUD (Holographic Port Tree) */}
        {/* ========================================== */}
        <div className="w-[45%] md:w-[42%] bg-[#05030d] border-r border-purple-950/30 flex flex-col overflow-y-auto hypno-scrollbar p-2 shrink-0">
          {/* 切換大標籤 */}
          <div className="grid grid-cols-2 gap-1 mb-3 bg-[#110d29]/40 p-0.5 rounded border border-purple-950/30 text-[10px] shrink-0 font-mono">
            <button
              onClick={() => {
                setActiveTab('parts');
                setActionError(null);
                setActionSuccess(null);
              }}
              className={`py-1 rounded transition-all cursor-pointer ${
                activeTab === 'parts'
                  ? 'bg-purple-950/70 text-purple-300 font-bold border border-purple-800/40'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              區域器官 (Slots)
            </button>
            <button
              onClick={() => {
                setActiveTab('global');
                setActionError(null);
                setActionSuccess(null);
              }}
              className={`py-1 rounded transition-all cursor-pointer ${
                activeTab === 'global'
                  ? 'bg-cyan-950/70 text-cyan-300 font-bold border border-cyan-800/40'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              全身同化 (Frame)
            </button>
          </div>

          {activeTab === 'parts' ? (
            <div className="space-y-3 pb-4">
              {/* 1. 頭面神經 (Cranial) */}
              <div>
                <span className="text-[8px] font-mono text-purple-500 uppercase tracking-widest block px-1.5 mb-1.5">
                  // CRANIAL PORTS
                </span>
                <div className="space-y-1.5">
                  {slotsByCategory.cranial.map(slot => {
                    const isSelected = selectedSlot === slot.id;
                    const modded = hasInstalledMod(slot.id);
                    const sensitivity = npcData.bodyParts[slot.id]?.sensitivity ?? 0;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          setSelectedSlot(slot.id);
                          setActionError(null);
                          setActionSuccess(null);
                        }}
                        className={`w-full text-left rounded-lg p-2 transition-all border font-mono relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#1e133c] border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.15)] text-white'
                            : 'bg-[#0a0717]/85 border-purple-950/30 hover:border-purple-800/20 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="text-xs">{slot.icon}</span> {slot.name}
                          </span>
                          {modded && (
                            <span className="text-[8px] bg-green-950/80 border border-green-800/40 text-green-400 px-1 rounded scale-90">
                              BIO-MOD
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between w-full text-[9px] text-gray-500">
                          <span>敏感度:</span>
                          <span
                            style={{ color: MockApi.getGradeColor(MockApi.getStatGrade(sensitivity, -100, 100)) }}
                            className="font-bold"
                          >
                            {sensitivity} ({MockApi.getStatGrade(sensitivity, -100, 100)})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. 軀幹腺體 (Torso) */}
              <div>
                <span className="text-[8px] font-mono text-purple-500 uppercase tracking-widest block px-1.5 mb-1.5">
                  // TORSO PORTS
                </span>
                <div className="space-y-1.5">
                  {slotsByCategory.torso.map(slot => {
                    const isSelected = selectedSlot === slot.id;
                    const modded = hasInstalledMod(slot.id);
                    const sensitivity = npcData.bodyParts[slot.id]?.sensitivity ?? 0;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          setSelectedSlot(slot.id);
                          setActionError(null);
                          setActionSuccess(null);
                        }}
                        className={`w-full text-left rounded-lg p-2 transition-all border font-mono relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#1e133c] border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.15)] text-white'
                            : 'bg-[#0a0717]/85 border-purple-950/30 hover:border-purple-800/20 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="text-xs">{slot.icon}</span> {slot.name}
                          </span>
                          {modded && (
                            <span className="text-[8px] bg-green-950/80 border border-green-800/40 text-green-400 px-1 rounded scale-90">
                              BIO-MOD
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between w-full text-[9px] text-gray-500">
                          <span>敏感度:</span>
                          <span
                            style={{ color: MockApi.getGradeColor(MockApi.getStatGrade(sensitivity, -100, 100)) }}
                            className="font-bold"
                          >
                            {sensitivity} ({MockApi.getStatGrade(sensitivity, -100, 100)})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. 骨盆深處 (Pelvic) */}
              <div>
                <span className="text-[8px] font-mono text-purple-500 uppercase tracking-widest block px-1.5 mb-1.5">
                  // PELVIC PORTS
                </span>
                <div className="space-y-1.5">
                  {slotsByCategory.pelvic.map(slot => {
                    const isSelected = selectedSlot === slot.id;
                    const modded = hasInstalledMod(slot.id);
                    const sensitivity = npcData.bodyParts[slot.id]?.sensitivity ?? 0;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => {
                          setSelectedSlot(slot.id);
                          setActionError(null);
                          setActionSuccess(null);
                        }}
                        className={`w-full text-left rounded-lg p-2 transition-all border font-mono relative flex flex-col justify-between ${
                          isSelected
                            ? 'bg-[#1e133c] border-pink-500/50 shadow-[0_0_12px_rgba(236,72,153,0.15)] text-white'
                            : 'bg-[#0a0717]/85 border-purple-950/30 hover:border-purple-800/20 text-gray-400'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span className="text-xs">{slot.icon}</span> {slot.name}
                          </span>
                          {modded && (
                            <span className="text-[8px] bg-green-950/80 border border-green-800/40 text-green-400 px-1 rounded scale-90">
                              BIO-MOD
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center justify-between w-full text-[9px] text-gray-500">
                          <span>敏感度:</span>
                          <span
                            style={{ color: MockApi.getGradeColor(MockApi.getStatGrade(sensitivity, -100, 100)) }}
                            className="font-bold"
                          >
                            {sensitivity} ({MockApi.getStatGrade(sensitivity, -100, 100)})
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. 擴展器官 (Extensors - 可無限動態擴展) */}
              <div>
                <span className="text-[8px] font-mono text-cyan-400 uppercase tracking-widest block px-1.5 mb-1.5 animate-pulse">
                  // EXTENSION ORGAN PORTS
                </span>
                <div className="space-y-1.5">
                  {slotsByCategory.extensor.length === 0 ? (
                    <div className="text-[9px] text-gray-600 italic px-2 py-3 bg-[#0a0717]/30 border border-dashed border-purple-950/20 rounded-lg text-center">
                      無外接實體化器官
                    </div>
                  ) : (
                    slotsByCategory.extensor.map(slot => {
                      const isSelected = selectedSlot === slot.id;
                      const modded = hasInstalledMod(slot.id);
                      const sensitivity = npcData.bodyParts[slot.id]?.sensitivity ?? 0;
                      return (
                        <button
                          key={slot.id}
                          onClick={() => {
                            setSelectedSlot(slot.id);
                            setActionError(null);
                            setActionSuccess(null);
                          }}
                          className={`w-full text-left rounded-lg p-2 transition-all border font-mono relative flex flex-col justify-between ${
                            isSelected
                              ? 'bg-[#121c38] border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.15)] text-white'
                              : 'bg-[#060b1b]/85 border-cyan-950/30 hover:border-cyan-800/20 text-cyan-600/70'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-xs font-bold flex items-center gap-1 text-cyan-300">
                              <span className="text-xs">{slot.icon}</span> {slot.name}
                            </span>
                            {modded ? (
                              <span className="text-[8px] bg-green-950/80 border border-green-800/40 text-green-400 px-1 rounded scale-90">
                                BIO-MOD
                              </span>
                            ) : (
                              <span className="text-[8px] bg-cyan-950/80 border border-cyan-800/40 text-cyan-400 px-1 rounded scale-90">
                                LINK ACTIVE
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center justify-between w-full text-[9px] text-cyan-700">
                            <span>敏感度:</span>
                            <span
                              style={{ color: MockApi.getGradeColor(MockApi.getStatGrade(sensitivity, -100, 100)) }}
                              className="font-bold"
                            >
                              {sensitivity} ({MockApi.getStatGrade(sensitivity, -100, 100)})
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-[#0a071a]/50 rounded-lg border border-purple-950/30 text-center text-xs text-gray-500 italic">
              請在右側操作全身細胞重組。
            </div>
          )}
        </div>

        {/* ========================================== */}
        {/* 右側：部位屬性監測與手術工坊 (滾動) */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070514]/40">
          {activeTab === 'parts' ? (
            <>
              {/* 部位狀態頭部 */}
              <div className="p-3 bg-[#0d0922] border-b border-purple-900/30 shrink-0 font-mono">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[8px] uppercase text-purple-400 font-bold block">
                      // SELECTED SLOT ACTIVE
                    </span>
                    <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-200 flex items-center gap-1.5">
                      <span>{allSlots.find((s: any) => s.id === selectedSlot)?.name || selectedSlot}</span>
                      <span className="text-[8px] text-gray-500 font-normal">({selectedSlot})</span>
                    </h3>
                  </div>

                  {/* 敏感度評級顯示 */}
                  <div className="text-right">
                    <span className="text-[8px] text-gray-500 block">SENSITIVITY GRADE</span>
                    <span
                      className="text-xs font-bold"
                      style={{
                        color: MockApi.getGradeColor(MockApi.getStatGrade(activeSlotData?.sensitivity ?? 0, -100, 100)),
                      }}
                    >
                      {activeSlotData?.sensitivity ?? 0} (
                      {MockApi.getStatGrade(activeSlotData?.sensitivity ?? 0, -100, 100)})
                    </span>
                  </div>
                </div>

                {/* 自訂部位額外屬性 (鬆緊、熟練) */}
                {activeSlotData &&
                  (activeSlotData.tightness !== undefined || activeSlotData.proficiency !== undefined) && (
                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-purple-950/20 text-[9px] text-gray-400">
                      {activeSlotData.tightness !== undefined && (
                        <div className="flex justify-between bg-[#070513] px-2 py-1 rounded border border-purple-950/30">
                          <span>通道緊緻度:</span>
                          <span className="text-purple-300 font-bold">{activeSlotData.tightness}</span>
                        </div>
                      )}
                      {activeSlotData.proficiency !== undefined && (
                        <div className="flex justify-between bg-[#070513] px-2 py-1 rounded border border-purple-950/30 font-mono">
                          <span>神經熟練度:</span>
                          <span className="text-purple-300 font-bold">{activeSlotData.proficiency}%</span>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {/* 內容區：已安裝改造與可手術方案 */}
              <div className="flex-1 overflow-y-auto hypno-scrollbar p-3 space-y-4">
                {/* 1. 已安裝的改造項目 */}
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1 font-mono">
                    <Wrench className="w-3 h-3 text-purple-400" /> [1] INSTALLED MODULES
                  </h4>

                  {installedMods.length === 0 && installedGlobalMods.length === 0 ? (
                    <div className="text-[10px] text-gray-500 italic p-3 bg-[#0a0718]/40 rounded-lg border border-purple-950/20 text-center">
                      該部位目前無任何植入模組。
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...installedGlobalMods, ...installedMods].map(state => {
                        const def = bodyModsDict[state.id];
                        if (!def) return null;

                        // 計算適應期剩餘狀態
                        let adaptingDesc = '';
                        if (state.adaptation && state.adaptation.endVirtualTime) {
                          adaptingDesc = `適應中 (預計 ${state.adaptation.endVirtualTime.split(' ')[0]} 完成)`;
                        }

                        return (
                          <div
                            key={state.id}
                            className="bg-[#100c28] border border-purple-800/30 rounded-lg p-2.5 text-xs transition-all duration-300"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-purple-200">{def.name}</span>
                                  <span
                                    className={`text-[8px] px-1 rounded font-mono ${
                                      def.category === 'material'
                                        ? 'bg-cyan-950 text-cyan-400 border border-cyan-800/40'
                                        : def.category === 'shape'
                                          ? 'bg-pink-950/60 text-pink-400 border border-pink-800/40'
                                          : 'bg-purple-950/60 text-purple-400 border border-purple-800/40'
                                    }`}
                                  >
                                    {def.category === 'material'
                                      ? '材質'
                                      : def.category === 'shape'
                                        ? '形狀'
                                        : '可疊加'}
                                  </span>
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{def.description}</p>
                              </div>

                              {/* 拆除按鈕 */}
                              <button
                                onClick={() => handleRemoveMod(state.id)}
                                className="text-gray-500 hover:text-red-400 p-1 rounded hover:bg-red-950/20 transition-all shrink-0 cursor-pointer"
                                title="拆除改造"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* 常駐屬性影響 */}
                            <div className="mt-2 flex flex-wrap gap-1">
                              {def.modifiers?.map((mod, idx) => (
                                <span
                                  key={idx}
                                  className="text-[9px] bg-[#070512] text-purple-300 px-1.5 py-0.5 rounded font-mono"
                                >
                                  {mod.targetType === 'global_stat' ? '全域' : '部位'} {mod.statName} {mod.operator}
                                  {mod.value}
                                </span>
                              ))}
                            </div>

                            {/* 排異與自訂備註 */}
                            <div className="mt-2.5 pt-2 border-t border-purple-950/30 space-y-2">
                              <div className="flex items-center justify-between">
                                {/* 切換啟用狀態開關 */}
                                <button
                                  onClick={() => handleToggleMod(state.id, !state.isActive)}
                                  className="flex items-center gap-1 text-[10px] text-purple-300 font-semibold cursor-pointer"
                                >
                                  {state.isActive ? (
                                    <>
                                      <ToggleRight className="w-5 h-5 text-green-400" />
                                      <span className="text-green-400 font-mono">已啟用</span>
                                    </>
                                  ) : (
                                    <>
                                      <ToggleLeft className="w-5 h-5 text-gray-600" />
                                      <span className="text-gray-500 font-mono">已鎖定</span>
                                    </>
                                  )}
                                </button>

                                {/* 適應期排異反應顯示 */}
                                {adaptingDesc && (
                                  <span className="text-[9px] text-yellow-500 bg-yellow-950/30 px-1.5 py-0.5 rounded font-mono animate-pulse">
                                    {adaptingDesc} (排異: 好感-10)
                                  </span>
                                )}
                              </div>

                              {/* 玩家自訂描述輸入框 */}
                              <div className="flex items-center gap-1 bg-[#05030d] border border-purple-950/30 rounded px-1.5 py-1">
                                <span className="text-[9px] text-purple-400 font-mono shrink-0">AI 註釋:</span>
                                <input
                                  type="text"
                                  value={customDescriptions[state.id] || ''}
                                  onChange={e => handleUpdateCustomDescription(state.id, e.target.value)}
                                  placeholder="例：刻有主人口印的乳環 (將直接影響 AI 演繹)"
                                  className="bg-transparent text-[10px] text-gray-300 focus:outline-none w-full font-sans"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. 手術工坊 (可選改裝方案) */}
                <div>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1 font-mono">
                    <Info className="w-3 h-3 text-purple-400" /> [2] COMPATIBLE BIO-MODS
                  </h4>

                  {localModifications.length === 0 && (
                    <div className="text-[10px] text-gray-500 italic p-3 bg-[#0a0718]/40 rounded-lg border border-purple-950/20 text-center">
                      此插槽無可用改造方案。
                    </div>
                  )}

                  <div className="space-y-2">
                    {localModifications.map(def => {
                      const isInstalled = npcData.ownedBodyModifications?.[def.id] !== undefined;

                      const checkMet = (cond: ConditionOnProgram) => {
                        const actualVal = npcData[cond.target as keyof MockcharData];
                        if (actualVal === undefined) return true;
                        const val = Number(actualVal);
                        if (cond.operator === '>=') return val >= cond.value;
                        if (cond.operator === '<=') return val <= cond.value;
                        return true;
                      };
                      const isConditionsMet = (def.conditions || []).every(checkMet);

                      const isItemsSufficient = (def.cost.requiredItems || []).every(item => {
                        const owned = userData.inventory?.[item.itemId]?.quantity || 0;
                        return owned >= item.quantity;
                      });

                      const isMoneySufficient = !def.cost.money || userData.money >= def.cost.money;
                      const isPtsSufficient = !def.cost.pts || userData.mcPoints >= def.cost.pts;
                      const isEnergySufficient = !def.cost.mcEnergy || userData.mcEnergy >= def.cost.mcEnergy;

                      const canPerform =
                        isConditionsMet &&
                        isItemsSufficient &&
                        isMoneySufficient &&
                        isPtsSufficient &&
                        isEnergySufficient &&
                        !isInstalled;

                      return (
                        <div
                          key={def.id}
                          className={`bg-[#0d0920]/80 border border-purple-950/40 rounded-lg p-2.5 text-xs transition-all ${
                            isInstalled ? 'opacity-40' : 'hover:border-purple-800/40'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="font-bold text-white">{def.name}</span>
                                <span className="text-[8px] bg-purple-950 text-purple-400 px-1 rounded-sm">
                                  LOAD {def.loadCost}
                                </span>
                              </div>
                              <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">{def.description}</p>
                            </div>

                            <button
                              onClick={() => handlePerformMod(def.id)}
                              disabled={!canPerform}
                              className={`text-[10px] px-2.5 py-1 rounded font-semibold cursor-pointer shrink-0 transition-all font-mono ${
                                isInstalled
                                  ? 'bg-purple-950/40 text-purple-600 border border-purple-900/10 cursor-not-allowed'
                                  : canPerform
                                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold'
                                    : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                              }`}
                            >
                              {isInstalled ? '已安裝' : '安裝手術'}
                            </button>
                          </div>

                          {/* 解鎖條件 */}
                          {def.conditions && def.conditions.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-gray-500 font-mono">
                              <span className="text-[8px] text-purple-400">// 解鎖要求:</span>
                              {def.conditions.map((cond, idx) => {
                                const met = checkMet(cond);
                                return (
                                  <span key={idx} className={met ? 'text-green-400' : 'text-red-400'}>
                                    {cond.target} {cond.operator} {cond.value} ({met ? '達成' : '未達'})
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* 消耗資源 */}
                          <div className="mt-2 pt-2 border-t border-purple-950/20 grid grid-cols-2 gap-1 text-[9px] text-gray-500 font-mono">
                            <div>
                              手術費用:{' '}
                              <span className={isMoneySufficient ? 'text-yellow-300' : 'text-red-400'}>
                                {def.cost.money ? formatMoney(def.cost.money) : '免費'}
                              </span>
                            </div>
                            <div>
                              MC 點數:{' '}
                              <span className={isPtsSufficient ? 'text-purple-300' : 'text-red-400'}>
                                {def.cost.pts ? `${def.cost.pts} PT` : '無'}
                              </span>
                            </div>
                            {def.cost.requiredItems && def.cost.requiredItems.length > 0 && (
                              <div className="col-span-2 mt-1 border-t border-purple-950/10 pt-1">
                                <span>所需耗材:</span>
                                <div className="flex flex-col gap-0.5 mt-0.5 pl-1 text-[8px]">
                                  {def.cost.requiredItems.map((item, idx) => {
                                    const owned = userData.inventory?.[item.itemId]?.quantity || 0;
                                    const suff = owned >= item.quantity;
                                    let itemLabel = item.itemId;
                                    if (item.itemId === 'item_hypno_serum') itemLabel = '催眠血清';
                                    if (item.itemId === 'item_cat_tail_implant') itemLabel = '仿生貓尾';
                                    if (item.itemId === 'item_slime_essence') itemLabel = '史萊姆核心精華';
                                    return (
                                      <span key={idx} className={suff ? 'text-green-400' : 'text-red-400'}>
                                        • {itemLabel}: {owned}/{item.quantity} ({suff ? '充足' : '缺件'})
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : (
            // ==========================================
            // 全局/全身改造面板 (Frame Modifications)
            // ==========================================
            <div className="flex-1 overflow-y-auto hypno-scrollbar p-3 space-y-4">
              <div className="p-3 bg-[#080d22] border border-cyan-900/30 rounded-lg font-mono">
                <span className="text-[8px] text-cyan-400 block font-bold">// FRAME ALIGNMENT & STRUCT</span>
                <h3 className="text-sm font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-cyan-200">
                  全身細胞同化與結構重組
                </h3>
                <p className="text-[10px] text-gray-400 mt-1 leading-relaxed">
                  適用於影響全域體質、皮膚材質等無法在單一區域細分的重大全身手術。同一材質分類改造在全身只能啟用一種。
                </p>
              </div>

              <div className="space-y-3">
                {globalModifications.map(def => {
                  const isInstalled = npcData.ownedBodyModifications?.[def.id] !== undefined;

                  const checkMet = (cond: ConditionOnProgram) => {
                    const actualVal = npcData[cond.target as keyof MockcharData];
                    if (actualVal === undefined) return true;
                    return Number(actualVal) >= cond.value;
                  };
                  const isConditionsMet = (def.conditions || []).every(checkMet);

                  const isItemsSufficient = (def.cost.requiredItems || []).every(item => {
                    const owned = userData.inventory?.[item.itemId]?.quantity || 0;
                    return owned >= item.quantity;
                  });

                  const isMoneySufficient = !def.cost.money || userData.money >= def.cost.money;
                  const isPtsSufficient = !def.cost.pts || userData.mcPoints >= def.cost.pts;
                  const isEnergySufficient = !def.cost.mcEnergy || userData.mcEnergy >= def.cost.mcEnergy;

                  const canPerform =
                    isConditionsMet &&
                    isItemsSufficient &&
                    isMoneySufficient &&
                    isPtsSufficient &&
                    isEnergySufficient &&
                    !isInstalled;

                  return (
                    <div
                      key={def.id}
                      className={`bg-[#0a1027]/70 border border-cyan-950/40 rounded-lg p-3 text-xs transition-all ${
                        isInstalled ? 'opacity-50 border-cyan-900/20' : 'hover:border-cyan-800/40'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-1.5 font-mono">
                            <span className="font-bold text-cyan-300">{def.name}</span>
                            <span className="text-[8px] bg-cyan-950 text-cyan-400 px-1.5 rounded-sm">
                              LOAD {def.loadCost}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">{def.description}</p>
                        </div>

                        <button
                          onClick={() => handlePerformMod(def.id)}
                          disabled={!canPerform}
                          className={`text-[10px] px-3 py-1.5 rounded font-semibold cursor-pointer shrink-0 transition-all font-mono ${
                            isInstalled
                              ? 'bg-cyan-950/40 text-cyan-700 border border-cyan-900/10 cursor-not-allowed'
                              : canPerform
                                ? 'bg-gradient-to-r from-cyan-500 via-purple-500 to-pink-500 hover:from-cyan-600 hover:to-pink-600 text-white font-bold shadow-[0_0_8px_rgba(6,182,212,0.15)]'
                                : 'bg-gray-800 text-gray-500 border border-gray-700 cursor-not-allowed'
                          }`}
                        >
                          {isInstalled ? '已同化' : '細胞重組'}
                        </button>
                      </div>

                      {/* 解鎖要求 */}
                      {def.conditions && def.conditions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[9px] text-gray-500 font-mono">
                          <span className="text-[8px] text-cyan-400">// 解鎖要求:</span>
                          {def.conditions.map((cond, idx) => {
                            const met = checkMet(cond);
                            return (
                              <span key={idx} className={met ? 'text-green-400' : 'text-red-400'}>
                                {cond.target} {cond.operator} {cond.value} ({met ? '達成' : '未達'})
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* 消耗資源 */}
                      <div className="mt-3 pt-2.5 border-t border-cyan-950/20 grid grid-cols-2 gap-1 text-[9px] text-gray-500 font-mono">
                        <div>
                          重組費用:{' '}
                          <span className={isMoneySufficient ? 'text-yellow-300' : 'text-red-400'}>
                            {def.cost.money ? formatMoney(def.cost.money) : '免費'}
                          </span>
                        </div>
                        <div>
                          催眠點數:{' '}
                          <span className={isPtsSufficient ? 'text-cyan-300' : 'text-red-400'}>
                            {def.cost.pts ? `${def.cost.pts} PT` : '無'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BodyModificationApp;
