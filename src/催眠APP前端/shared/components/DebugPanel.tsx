import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  X,
  Database,
  ShieldAlert,
  Cpu,
  Check,
  Zap,
  ChevronRight,
  Clock,
  Package,
  Users,
  MapPin,
  Eye,
  GitBranch,
  Wrench,
} from 'lucide-react';
import { mockMvuVariables, mockChatVariables } from '../../database/mockDatabase';
import { MockApi } from '../api/mockApi';

// ==========================================
// Debug 輔助函數區
// ==========================================
function getTavernRealMvu(): any {
  return (globalThis as any).Mvu || null;
}

function getTavernRealChatVars(): any {
  if (typeof (globalThis as any).getVariables === 'function') {
    try {
      return (globalThis as any).getVariables({ type: 'chat' }) || null;
    } catch {
      return null;
    }
  }
  return null;
}

// ==========================================
// 子面板類型定義
// ==========================================
type ActionSubPanel = 'system' | 'playerInv' | 'npcInv' | 'bodyMod' | 'mapExplore' | 'nodeEdit' | 'edgeEdit';

const SUB_PANEL_CONFIG: { key: ActionSubPanel; label: string; icon: React.ReactNode }[] = [
  { key: 'system', label: '系統與資源', icon: <Clock size={12} /> },
  { key: 'playerInv', label: '玩家背包', icon: <Package size={12} /> },
  { key: 'npcInv', label: 'NPC設定', icon: <Users size={12} /> },
  { key: 'bodyMod', label: '身體改造', icon: <Wrench size={12} /> },
  { key: 'mapExplore', label: '地圖探索', icon: <MapPin size={12} /> },
  { key: 'nodeEdit', label: '節點屏蔽', icon: <Eye size={12} /> },
  { key: 'edgeEdit', label: '通路連線', icon: <GitBranch size={12} /> },
];

// ==========================================
// 比較符與屬性定義
// ==========================================
const OPERATORS = ['>=', '<=', '==', '!=', '>', '<'];
const NPC_ATTRIBUTES = [
  { value: 'obedience', label: '服從度' },
  { value: 'affection', label: '好感度' },
  { value: 'alertness', label: '警戒度' },
  { value: 'arousal', label: '興奮度' },
  { value: 'lust', label: '淫癖' },
];

// ==========================================
// 地圖通路條件解析與序列化輔助函數
// ==========================================
function parseNpcConditionString(str: string): any[] {
  if (!str) return [];
  return str.split(',').map(part => {
    const segments = part.trim().split(':');
    if (segments.length === 4) {
      return { npcName: segments[0], attribute: segments[1], operator: segments[2], value: Number(segments[3]) };
    } else if (segments.length === 2) {
      return { npcName: segments[0], attribute: 'obedience', operator: '>=', value: Number(segments[1]) };
    }
    return { npcName: segments[0], attribute: 'obedience', operator: '>=', value: 0 };
  });
}

function serializeNpcConditions(conds: any[]): string {
  return conds.map(c => `${c.npcName}:${c.attribute}:${c.operator}:${c.value}`).join(',');
}

function parseItemConditionString(str: string): any[] {
  if (!str) return [];
  return str.split(',').map(part => {
    const segments = part.trim().split(':');
    if (segments.length === 3) {
      return { itemId: segments[0], operator: segments[1], quantity: Number(segments[2]) };
    } else if (segments.length === 2) {
      return { itemId: segments[0], operator: '>=', quantity: Number(segments[1]) };
    }
    return { itemId: segments[0], operator: '>=', quantity: 1 };
  });
}

function serializeItemConditions(conds: any[]): string {
  return conds.map(c => `${c.itemId}:${c.operator}:${c.quantity}`).join(',');
}

function parseTimeConditionString(str: string): any[] {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) {
    if (str.includes(' ')) {
      const parts = str.split(' ');
      return [{ type: 'weekly', range: str, passable: true }];
    } else if (str.includes('-')) {
      return [{ type: 'daily', range: str, passable: true }];
    }
  }
  return [];
}

function serializeTimeConditions(conds: any[]): string {
  return JSON.stringify(conds);
}

function getRangeTimePart(type: string, range: string): { start: string; end: string } {
  if (type === 'date') return { start: '', end: '' };
  const timeStr = range.includes(' ') ? range.split(/\s+/)[1] : range;
  if (!timeStr || !timeStr.includes('-')) return { start: '00:00', end: '23:59' };
  const parts = timeStr.split('-');
  return { start: parts[0] || '00:00', end: parts[1] || '23:59' };
}

function getWeekPartList(range: string): number[] {
  const weekStr = range.includes(' ') ? range.split(/\s+/)[0] : '';
  if (!weekStr) return [];
  if (weekStr.includes('-')) {
    const [start, end] = weekStr.split('-').map(Number);
    const list = [];
    for (let i = start; i <= end; i++) list.push(i);
    return list;
  } else if (weekStr.includes(',')) {
    return weekStr.split(',').map(Number);
  } else {
    const num = Number(weekStr);
    return isNaN(num) ? [] : [num];
  }
}

const PART_NAME_MAP: Record<string, string> = {
  mouth: '口腔',
  breastLeft: '左乳房',
  breastRight: '右乳房',
  vagina: '阴道',
  anus: '肛门',
  urethra: '尿道',
  clitoris: '阴蒂',
};

// ==========================================
// 微調按鈕元件
// ==========================================
const AdjustBtn: React.FC<{ label: string; onClick: () => void; color?: string }> = ({
  label,
  onClick,
  color = 'purple',
}) => (
  <button
    onClick={onClick}
    className={`px-1.5 py-0.5 text-[9px] font-bold rounded border transition-all active:scale-95
      ${
        color === 'red'
          ? 'bg-red-950/30 border-red-500/20 text-red-300 hover:bg-red-900/40'
          : color === 'emerald'
            ? 'bg-emerald-950/30 border-emerald-500/20 text-emerald-300 hover:bg-emerald-900/40'
            : 'bg-purple-950/30 border-purple-500/20 text-purple-300 hover:bg-purple-900/40'
      }`}
  >
    {label}
  </button>
);

// ==========================================
// 數值微調輸入列
// ==========================================
const NumberAdjustRow: React.FC<{
  label: string;
  value: number;
  onChange: (v: number) => void;
  steps?: number[];
}> = ({ label, value, onChange, steps = [1, 5, 100] }) => (
  <div className="flex items-center gap-1.5 py-1">
    <span className="text-[10px] text-gray-400 w-16 shrink-0">{label}</span>
    <input
      type="number"
      value={value}
      onChange={e => onChange(Number(e.target.value) || 0)}
      className="w-16 bg-black/40 border border-purple-500/20 rounded px-1.5 py-0.5 text-[10px] text-purple-100 text-center focus:outline-none focus:border-purple-500/50"
    />
    <div className="flex gap-0.5">
      {steps.map(s => (
        <React.Fragment key={s}>
          <AdjustBtn label={`-${s}`} onClick={() => onChange(value - s)} color="red" />
          <AdjustBtn label={`+${s}`} onClick={() => onChange(value + s)} color="emerald" />
        </React.Fragment>
      ))}
    </div>
  </div>
);

export const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'tavern' | 'mockMvu' | 'mockChat' | 'actions'>('tavern');

  // ==========================================
  // 面板拖曳 State
  // ==========================================
  const [panelPos, setPanelPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const currentX = panelPos?.x ?? window.innerWidth - 520 - 16;
    const currentY = panelPos?.y ?? window.innerHeight - 680 - 64;
    dragOffset.current = { x: clientX - currentX, y: clientY - currentY };
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const newX = Math.max(0, Math.min(window.innerWidth - 200, clientX - dragOffset.current.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 100, clientY - dragOffset.current.y));
      setPanelPos({ x: newX, y: newY });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  // ==========================================
  // 面板調整大小 (Resizable) State
  // ==========================================
  const [panelSize, setPanelSize] = useState<{ width: number; height: number }>({ width: 520, height: 680 });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartSize = useRef<{ width: number; height: number }>({ width: 520, height: 680 });
  const resizeStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartSize.current = { width: panelSize.width, height: panelSize.height };
    resizeStartPos.current = { x: e.clientX, y: e.clientY };
  };

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const deltaX = e.clientX - resizeStartPos.current.x;
      const deltaY = e.clientY - resizeStartPos.current.y;
      const newWidth = Math.max(350, resizeStartSize.current.width + deltaX);
      const newHeight = Math.max(400, resizeStartSize.current.height + deltaY);
      setPanelSize({ width: newWidth, height: newHeight });
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing]);

  // ==========================================
  // 編輯文字區的 State
  // ==========================================
  const [mvuText, setMvuText] = useState('');
  const [chatText, setChatText] = useState('');
  const [mvuError, setMvuError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ==========================================
  // Tavern 變數讀取
  // ==========================================
  const [tavernMvu, setTavernMvu] = useState<any>(null);
  const [tavernChat, setTavernChat] = useState<any>(null);

  // ==========================================
  // 快捷動作子面板 State
  // ==========================================
  const [actionSubPanel, setActionSubPanel] = useState<ActionSubPanel>('system');

  // ==========================================
  // 本地快照 State (只在面板開啟時從 mock 同步，修改後按保存才回寫)
  // ==========================================
  const [localPlayerInv, setLocalPlayerInv] = useState<Record<string, number>>({});
  const [localNpcInvMap, setLocalNpcInvMap] = useState<Record<string, Record<string, number>>>({});
  const [localDiscovered, setLocalDiscovered] = useState<string[]>([]);
  const [localHiddenNodes, setLocalHiddenNodes] = useState<Record<string, boolean>>({});
  const [localEdges, setLocalEdges] = useState<any[]>([]);

  // ==========================================
  // 身體改造 Debug 相關邏輯 (State 聲明)
  // ==========================================
  const [localBodyMods, setLocalBodyMods] = useState<Record<string, any>>({});
  const [selectedModId, setSelectedModId] = useState<string>('');

  // 系統與資源
  const [editTime, setEditTime] = useState('');
  const [editVip, setEditVip] = useState(0);
  const [editMoney, setEditMoney] = useState(0);
  const [editEnergy, setEditEnergy] = useState(0);
  const [editEnergyMax, setEditEnergyMax] = useState(0);
  const [editPoints, setEditPoints] = useState(0);
  const [editSuspicion, setEditSuspicion] = useState(0);

  // 玩家/NPC 背包
  const [selectedNpc, setSelectedNpc] = useState('');

  // ==========================================
  // NPC 屬性暫存與修改 State
  // ==========================================
  const [localNpcStats, setLocalNpcStats] = useState<Record<string, any>>({});

  useEffect(() => {
    if (selectedNpc && !localNpcStats[selectedNpc]) {
      const char = mockMvuVariables.chars[selectedNpc];
      if (char) {
        // 舊資料與多餘資料清理：清除不存在於靜態字典中的身體改造
        const cleanChar = JSON.parse(JSON.stringify(char));
        if (cleanChar.ownedBodyModifications) {
          Object.keys(cleanChar.ownedBodyModifications).forEach(modId => {
            if (!mockChatVariables.bodyModifications[modId]) {
              delete cleanChar.ownedBodyModifications[modId];
            }
          });
        }
        setLocalNpcStats(prev => ({
          ...prev,
          [selectedNpc]: cleanChar,
        }));
      }
    }
  }, [selectedNpc, localNpcStats]);

  const updateNpcBaseStat = (npc: string, key: string, val: number) => {
    setLocalNpcStats(prev => {
      const next = { ...prev };
      if (!next[npc]) next[npc] = JSON.parse(JSON.stringify(mockMvuVariables.chars[npc] || {}));
      next[npc][key] = val;
      return next;
    });
  };

  const updateNpcBodyPartStat = (npc: string, part: string, key: string, val: number) => {
    setLocalNpcStats(prev => {
      const next = { ...prev };
      if (!next[npc]) next[npc] = JSON.parse(JSON.stringify(mockMvuVariables.chars[npc] || {}));
      if (!next[npc].bodyParts) next[npc].bodyParts = {};
      if (!next[npc].bodyParts[part]) next[npc].bodyParts[part] = {};
      next[npc].bodyParts[part][key] = val;
      return next;
    });
  };

  const updateNpcLocationState = (npc: string, field: 'locationId' | 'locationStatus', val: string) => {
    setLocalNpcStats(prev => {
      const next = { ...prev };
      if (!next[npc]) next[npc] = JSON.parse(JSON.stringify(mockMvuVariables.chars[npc] || {}));
      if (!next[npc].locationState) {
        next[npc].locationState = { locationId: '', locationStatus: '' };
      }
      next[npc].locationState[field] = val;
      return next;
    });
  };

  // ==========================================
  // 身體改造 Debug 相關邏輯 (NPC 快照管理)
  // ==========================================
  const addNpcBodyMod = (npc: string, modId: string) => {
    setLocalNpcStats(prev => {
      const next = { ...prev };
      if (!next[npc]) next[npc] = JSON.parse(JSON.stringify(mockMvuVariables.chars[npc] || {}));
      if (!next[npc].ownedBodyModifications) next[npc].ownedBodyModifications = {};

      next[npc].ownedBodyModifications[modId] = {
        id: modId,
        installedVirtualTime: mockMvuVariables.time,
        isActive: true,
        selectedTraits: [],
        adaptation: undefined,
      };

      const def = localBodyMods[modId];
      if (def && def.addedBodyPart) {
        const partId = def.addedBodyPart.id;
        if (!next[npc].bodyParts) next[npc].bodyParts = {};
        if (!next[npc].bodyParts[partId]) {
          next[npc].bodyParts[partId] = {
            sensitivity: def.addedBodyPart.initialStats?.sensitivity ?? 0,
            tightness: def.addedBodyPart.initialStats?.tightness ?? 0,
            proficiency: def.addedBodyPart.initialStats?.proficiency ?? 0,
            orgasms: def.addedBodyPart.initialStats?.orgasms ?? 0,
          };
        }
      }
      return next;
    });
  };

  const removeNpcBodyMod = (npc: string, modId: string) => {
    setLocalNpcStats(prev => {
      const next = { ...prev };
      if (!next[npc] || !next[npc].ownedBodyModifications) return prev;

      const def = localBodyMods[modId];
      delete next[npc].ownedBodyModifications[modId];

      if (def && def.addedBodyPart) {
        const partId = def.addedBodyPart.id;
        const defaultParts = ['mouth', 'breastLeft', 'breastRight', 'vagina', 'anus', 'urethra', 'clitoris'];
        if (!defaultParts.includes(partId)) {
          let stillNeeded = false;
          Object.keys(next[npc].ownedBodyModifications).forEach(otherModId => {
            const otherDef = localBodyMods[otherModId];
            if (otherDef && otherDef.slots && otherDef.slots.includes(partId)) {
              stillNeeded = true;
            }
          });
          if (!stillNeeded && next[npc].bodyParts) {
            delete next[npc].bodyParts[partId];
          }
        }
      }
      return next;
    });
  };

  const updateNpcBodyModProp = (npc: string, modId: string, key: string, val: any) => {
    setLocalNpcStats(prev => {
      const next = { ...prev };
      if (!next[npc] || !next[npc].ownedBodyModifications || !next[npc].ownedBodyModifications[modId]) return prev;

      if (key === 'adaptation_complete') {
        if (val) {
          delete next[npc].ownedBodyModifications[modId].adaptation;
        } else {
          const dt = new Date(mockMvuVariables.time.replace(/-/g, '/'));
          const baseTime = isNaN(dt.getTime()) ? new Date() : dt;
          baseTime.setHours(baseTime.getHours() + 48);
          const formatTime = (d: Date) => {
            const y = d.getFullYear();
            const mo = String(d.getMonth() + 1).padStart(2, '0');
            const date = String(d.getDate()).padStart(2, '0');
            const h = String(d.getHours()).padStart(2, '0');
            const mi = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return `${y}-${mo}-${date} ${h}:${mi}:${s}`;
          };
          next[npc].ownedBodyModifications[modId].adaptation = {
            endVirtualTime: formatTime(baseTime),
            extraModifiers: [{ targetType: 'global_stat', statName: 'affection', operator: '-', value: 10 }],
          };
        }
      } else {
        next[npc].ownedBodyModifications[modId][key] = val;
      }
      return next;
    });
  };

  const updateModDef = (modId: string, path: string[], val: any) => {
    setLocalBodyMods(prev => {
      const next = { ...prev };
      if (!next[modId]) return prev;
      next[modId] = JSON.parse(JSON.stringify(next[modId]));
      let cur = next[modId];
      for (let i = 0; i < path.length - 1; i++) {
        if (!cur[path[i]]) cur[path[i]] = {};
        cur = cur[path[i]];
      }
      cur[path[path.length - 1]] = val;
      return next;
    });
  };

  // 地圖探索
  const [teleportTarget, setTeleportTarget] = useState('');

  // 節點編輯
  const [editNodeId, setEditNodeId] = useState('');
  const [editNodeName, setEditNodeName] = useState('');
  const [editNodeDesc, setEditNodeDesc] = useState('');

  // 通路連線
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('');
  const [expandedEdge, setExpandedEdge] = useState('');

  // ==========================================
  // 初始化及監聽邏輯（開啟面板時從 mock 同步快照）
  // ==========================================
  useEffect(() => {
    if (isOpen) {
      setMvuText(JSON.stringify(mockMvuVariables, null, 2));
      setChatText(JSON.stringify(mockChatVariables, null, 2));
      setTavernMvu(getTavernRealMvu());
      setTavernChat(getTavernRealChatVars());

      // 初始化系統資源欄位
      const timeStr = mockMvuVariables.time || '2026-05-01T11:28';
      setEditTime(timeStr.replace(' ', 'T').slice(0, 16));
      setEditVip(mockMvuVariables.user.vipTier || 0);
      setEditMoney(mockMvuVariables.user.money || 0);
      setEditEnergy(mockMvuVariables.user.mcEnergy || 0);
      setEditEnergyMax(mockMvuVariables.user.mcEnergyMax || 0);
      setEditPoints(mockMvuVariables.user.mcPoints || 0);
      setEditSuspicion(mockMvuVariables.user.suspicion || 0);

      // 快照：玩家背包
      const pInv: Record<string, number> = {};
      Object.entries(mockMvuVariables.user?.inventory || {}).forEach(([id, item]) => {
        pInv[id] = item.quantity;
      });
      setLocalPlayerInv(pInv);

      // 快照：NPC 背包
      const nInv: Record<string, Record<string, number>> = {};
      Object.keys(mockMvuVariables.chars || {}).forEach(name => {
        const charInv = (mockMvuVariables.chars[name] as any)?.inventory || {};
        nInv[name] = {};
        Object.entries(charInv).forEach(([id, item]) => {
          nInv[name][id] = (item as any).quantity || 0;
        });
      });
      setLocalNpcInvMap(nInv);

      // 快照：已發現節點
      setLocalDiscovered([...(mockMvuVariables.user?.mapState?.discoveredNodeIds || [])]);

      // 快照：屏蔽節點
      const hidden: Record<string, boolean> = {};
      Object.entries(mockChatVariables.locations || {}).forEach(([id, node]) => {
        if ((node as any)._hidden) hidden[id] = true;
      });
      setLocalHiddenNodes(hidden);

      // 快照：地圖連線 (深拷貝)
      setLocalEdges(JSON.parse(JSON.stringify(mockChatVariables.mapEdges || [])));

      // 快照：身體改造定義 (深拷貝)
      const initialBodyMods = JSON.parse(JSON.stringify(mockChatVariables.bodyModifications || {}));
      setLocalBodyMods(initialBodyMods);
      const modIds = Object.keys(initialBodyMods);
      if (modIds.length > 0 && !selectedModId) setSelectedModId(modIds[0]);

      const npcNames = Object.keys(mockMvuVariables.chars || {});
      if (npcNames.length > 0 && !selectedNpc) setSelectedNpc(npcNames[0]);

      const zoneIds = Object.keys(mockChatVariables.zones || {});
      if (zoneIds.length > 0 && !selectedZoneFilter) setSelectedZoneFilter(zoneIds[0]);
    }
  }, [isOpen]);

  // ==========================================
  // 變數套用與重設邏輯
  // ==========================================
  const handleApplyMvu = () => {
    try {
      const parsed = JSON.parse(mvuText);
      Object.keys(mockMvuVariables).forEach(key => delete (mockMvuVariables as any)[key]);
      Object.assign(mockMvuVariables, parsed);
      setMvuError(null);
      showSuccess('Mvu 模擬變數已套用。');
      window.dispatchEvent(new CustomEvent('__debug_mock_updated'));
      setIsOpen(false);
    } catch (err: any) {
      setMvuError(`JSON 格式錯誤: ${err?.message || err}`);
    }
  };

  const handleApplyChat = () => {
    try {
      const parsed = JSON.parse(chatText);
      Object.keys(mockChatVariables).forEach(key => delete (mockChatVariables as any)[key]);
      Object.assign(mockChatVariables, parsed);
      setChatError(null);
      showSuccess('Chat 模擬變數已套用。');
      window.dispatchEvent(new CustomEvent('__debug_mock_updated'));
      setIsOpen(false);
    } catch (err: any) {
      setChatError(`JSON 格式錯誤: ${err?.message || err}`);
    }
  };

  const handleResetAll = () => {
    // 重新載入預設資料庫 (等同新的 iframe 載入)
    window.location.reload();
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // ==========================================
  // 回寫本地快照到 mock 物件，並透過事件通知元件刷新
  // ==========================================
  const flushAndSave = () => {
    // 回寫：NPC 屬性
    Object.entries(localNpcStats).forEach(([name, stat]) => {
      const char = mockMvuVariables.chars[name];
      if (char) {
        Object.assign(char, stat);
      }
    });

    // 回寫：玩家背包 (安全保留原有裝備、自訂描述等狀態)
    const oldPlayerInv = { ...mockMvuVariables.user?.inventory };
    mockMvuVariables.user.inventory = {};
    Object.entries(localPlayerInv).forEach(([id, qty]) => {
      if (qty > 0) {
        mockMvuVariables.user.inventory[id] = {
          ...(oldPlayerInv[id] || {}),
          quantity: qty,
        };
      }
    });

    // 回寫：NPC 背包 (安全保留原有裝備、自訂描述等狀態)
    Object.entries(localNpcInvMap).forEach(([name, items]) => {
      const char = mockMvuVariables.chars[name] as any;
      if (!char) return;
      const oldCharInv = { ...char.inventory };
      char.inventory = {};
      Object.entries(items).forEach(([id, qty]) => {
        if (qty > 0) {
          char.inventory[id] = {
            ...(oldCharInv[id] || {}),
            quantity: qty,
          };
        }
      });
    });

    // 回寫：已發現節點
    if (mockMvuVariables.user.mapState) {
      mockMvuVariables.user.mapState.discoveredNodeIds = [...localDiscovered];
    }

    // 回寫：屏蔽節點
    Object.keys(mockChatVariables.locations).forEach(id => {
      (mockChatVariables.locations[id] as any)._hidden = !!localHiddenNodes[id];
    });

    // 回寫：地圖連線
    mockChatVariables.mapEdges = JSON.parse(JSON.stringify(localEdges));

    // ==========================================
    // 身體改造 Debug 相關邏輯 (保存與清理)
    // ==========================================
    mockChatVariables.bodyModifications = JSON.parse(JSON.stringify(localBodyMods));

    // 清理 NPC 身上與目前靜態字典定義不符的多餘舊改造資料
    Object.entries(localNpcStats).forEach(([name, stat]) => {
      if (stat && stat.ownedBodyModifications) {
        Object.keys(stat.ownedBodyModifications).forEach(modId => {
          if (!localBodyMods[modId]) {
            delete stat.ownedBodyModifications[modId];
          }
        });
      }
    });

    // 刷新背包物品激活狀態
    MockApi.refreshInventoryItemsActivation();

    // 透過事件通知元件刷新，不需要 sessionStorage 或重載
    showSuccess('修改已套用到記憶體中。');
    window.dispatchEvent(new CustomEvent('__debug_mock_updated'));
    setIsOpen(false);
  };

  // ==========================================
  // 系統與資源 - 套用修改
  // ==========================================
  const applySystemChanges = () => {
    mockMvuVariables.time = editTime.replace('T', ' ') + ':00';
    mockMvuVariables.user.vipTier = editVip;
    mockMvuVariables.user.money = editMoney;
    mockMvuVariables.user.mcEnergy = editEnergy;
    mockMvuVariables.user.mcEnergyMax = editEnergyMax;
    mockMvuVariables.user.mcPoints = editPoints;
    mockMvuVariables.user.suspicion = editSuspicion;
    flushAndSave();
  };

  // ==========================================
  // 時間快捷修改
  // ==========================================
  const adjustTime = (hours: number, minutes: number) => {
    const dt = new Date(editTime.replace('T', ' '));
    if (isNaN(dt.getTime())) return;
    dt.setHours(dt.getHours() + hours);
    dt.setMinutes(dt.getMinutes() + minutes);
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const h = String(dt.getHours()).padStart(2, '0');
    const mi = String(dt.getMinutes()).padStart(2, '0');
    setEditTime(`${y}-${mo}-${d}T${h}:${mi}`);
  };

  const setTimePreset = (dateTime: string) => {
    setEditTime(dateTime.replace(' ', 'T').slice(0, 16));
  };

  // ==========================================
  // 玩家物品擁有狀態與數量 (操作本地快照)
  // ==========================================
  const getPlayerItemQty = (itemId: string): number => localPlayerInv[itemId] || 0;

  const setPlayerItemQty = (itemId: string, qty: number) => {
    setLocalPlayerInv(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[itemId];
      else next[itemId] = qty;
      return next;
    });
  };

  // ==========================================
  // NPC 物品擁有狀態與數量 (操作本地快照)
  // ==========================================
  const getNpcItemQty = (npcName: string, itemId: string): number => localNpcInvMap[npcName]?.[itemId] || 0;

  const setNpcItemQty = (npcName: string, itemId: string, qty: number) => {
    setLocalNpcInvMap(prev => {
      const next = { ...prev, [npcName]: { ...(prev[npcName] || {}) } };
      if (qty <= 0) delete next[npcName][itemId];
      else next[npcName][itemId] = qty;
      return next;
    });
  };

  // ==========================================
  // 地圖傳送
  // ==========================================
  const handleTeleport = () => {
    if (!teleportTarget) return;
    // 傳送需立即回寫並重載
    if (mockMvuVariables.user.mapState) {
      mockMvuVariables.user.mapState.currentLocationId = teleportTarget;
      if (!mockMvuVariables.user.mapState.discoveredNodeIds.includes(teleportTarget)) {
        mockMvuVariables.user.mapState.discoveredNodeIds.push(teleportTarget);
      }
    }
    // 同步快照中的 discovered 再保存
    if (!localDiscovered.includes(teleportTarget)) {
      setLocalDiscovered(prev => [...prev, teleportTarget]);
    }
    flushAndSave();
  };

  // ==========================================
  // 探索狀態切換 (操作本地快照)
  // ==========================================
  const toggleDiscovered = (nodeId: string) => {
    setLocalDiscovered(prev => {
      if (prev.includes(nodeId)) return prev.filter(id => id !== nodeId);
      return [...prev, nodeId];
    });
  };

  // ==========================================
  // 節點屏蔽切換 (操作本地快照)
  // ==========================================
  const toggleNodeHidden = (nodeId: string) => {
    setLocalHiddenNodes(prev => {
      const next = { ...prev };
      if (next[nodeId]) delete next[nodeId];
      else next[nodeId] = true;
      return next;
    });
  };

  // ==========================================
  // 節點屬性編輯
  // ==========================================
  const applyNodeEdit = () => {
    if (!editNodeId) return;
    const node = mockChatVariables.locations[editNodeId];
    if (!node) return;
    if (editNodeName) node.name = editNodeName;
    if (editNodeDesc) node.description = editNodeDesc;
    flushAndSave();
  };

  // ==========================================
  // 通路連線編輯 (操作本地快照 localEdges)
  // ==========================================
  const updatePathInfoField = (edgeId: string, direction: 'forward' | 'reverse', field: string, value: any) => {
    setLocalEdges(prev => {
      const next = prev.map(e => (e.id === edgeId ? JSON.parse(JSON.stringify(e)) : e));
      const edge = next.find((e: any) => e.id === edgeId);
      if (!edge) return prev;
      const pathInfo = direction === 'forward' ? edge.forwardPath : edge.ReversePath;
      if (!pathInfo) return prev;

      if (field === 'status') pathInfo.status = value;
      else if (field === 'timeCost') pathInfo.cost.timeCostMinutes = Number(value);
      else if (field === 'energyCost') pathInfo.cost.energyCost = Number(value);
      else if (field === 'unlockType') {
        if (value === 'none') {
          delete pathInfo.unlockCondition;
        } else if (!pathInfo.unlockCondition) {
          pathInfo.unlockCondition = { type: value, description: '' };
        } else {
          pathInfo.unlockCondition.type = value;
        }
      } else if (field === 'unlockTargetName') {
        if (pathInfo.unlockCondition) pathInfo.unlockCondition.targetName = value;
      } else if (field === 'unlockValue') {
        if (pathInfo.unlockCondition) pathInfo.unlockCondition.value = Number(value);
      } else if (field === 'unlockDesc') {
        if (pathInfo.unlockCondition) pathInfo.unlockCondition.description = value;
      } else if (field === 'tempType') {
        if (value === 'none') {
          delete pathInfo.tempConditon;
        } else if (!pathInfo.tempConditon) {
          pathInfo.tempConditon = { type: value, description: '' };
        } else {
          pathInfo.tempConditon.type = value;
        }
      } else if (field === 'tempTargetName') {
        if (pathInfo.tempConditon) pathInfo.tempConditon.targetName = value;
      } else if (field === 'tempValue') {
        if (pathInfo.tempConditon) pathInfo.tempConditon.value = Number(value);
      } else if (field === 'tempDesc') {
        if (pathInfo.tempConditon) pathInfo.tempConditon.description = value;
      }
      return next;
    });
  };

  // ==========================================
  // 通路編輯子元件
  // ==========================================
  const renderPathEditor = (edgeId: string, direction: 'forward' | 'reverse', pathInfo: any, label: string) => {
    if (!pathInfo) return <div className="text-[9px] text-gray-500 italic">（{label}不存在）</div>;

    const allItems = mockChatVariables.items || {};
    const npcNames = Object.keys(mockMvuVariables.chars || {});

    // --- 解鎖條件的本地解析與更新 ---
    const unlockType = pathInfo.unlockCondition?.type || 'none';
    const rawUnlockTarget = pathInfo.unlockCondition?.targetName || '';

    // --- 臨時條件的本地解析與更新 ---
    const tempType = pathInfo.tempConditon?.type || 'none';
    const rawTempTarget = pathInfo.tempConditon?.targetName || '';

    return (
      <div className="p-2.5 bg-black/30 rounded-xl border border-purple-500/10 space-y-2">
        <div className="text-[10px] font-bold text-purple-300 border-b border-purple-500/10 pb-1 mb-1.5">{label}</div>

        {/* 通路狀態 */}
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-gray-400">通路狀態</span>
          <select
            value={pathInfo.status}
            onChange={e => updatePathInfoField(edgeId, direction, 'status', e.target.value)}
            className="bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-[9px] text-purple-100 focus:outline-none"
          >
            <option value="open">🟢 open</option>
            <option value="locked">🔴 locked</option>
            <option value="temp_open">🟡 temp_open</option>
          </select>
        </div>

        {/* 通行消耗 */}
        <div className="grid grid-cols-2 gap-2 bg-black/20 p-1.5 rounded border border-purple-500/5">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-gray-400">時間(分)</span>
            <input
              type="number"
              value={pathInfo.cost?.timeCostMinutes || 0}
              onChange={e => updatePathInfoField(edgeId, direction, 'timeCost', e.target.value)}
              className="w-12 bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 text-center"
            />
          </div>
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-gray-400">能量</span>
            <input
              type="number"
              value={pathInfo.cost?.energyCost || 0}
              onChange={e => updatePathInfoField(edgeId, direction, 'energyCost', e.target.value)}
              className="w-12 bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 text-center"
            />
          </div>
        </div>

        {/* ==========================================
        // 解鎖條件 (unlockCondition)
        // ========================================== */}
        <div className="border-t border-purple-500/10 pt-2 space-y-1.5">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-purple-300 font-semibold">🔓 解鎖條件</span>
            <select
              value={unlockType}
              onChange={e => updatePathInfoField(edgeId, direction, 'unlockType', e.target.value)}
              className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 focus:outline-none"
            >
              <option value="none">無條件</option>
              <option value="npc_stats">角色門檻</option>
              <option value="item">物品门槛</option>
              <option value="always_locked">永久鎖定</option>
            </select>
          </div>

          {/* 描述欄位 (只在有條件時顯示) */}
          {unlockType !== 'none' && unlockType !== 'always_locked' && (
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="text-gray-500 w-10 shrink-0">條件描述</span>
              <input
                type="text"
                value={pathInfo.unlockCondition?.description || ''}
                onChange={e => updatePathInfoField(edgeId, direction, 'unlockDesc', e.target.value)}
                placeholder="解鎖條件的介面描述"
                className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-[9px] text-purple-100 focus:outline-none"
              />
            </div>
          )}

          {/* 角色解鎖條件 (多 NPC) */}
          {unlockType === 'npc_stats' && (
            <div className="space-y-1.5 pl-2 border-l border-purple-500/20">
              {parseNpcConditionString(rawUnlockTarget).map((cond, idx, arr) => (
                <div key={idx} className="bg-black/40 p-2 rounded border border-purple-500/10 space-y-1.5">
                  <div className="flex gap-1 items-center">
                    <select
                      value={cond.npcName}
                      onChange={e => {
                        const next = [...arr];
                        next[idx].npcName = e.target.value;
                        updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeNpcConditions(next));
                      }}
                      className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 flex-1"
                    >
                      {npcNames.map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.attribute}
                      onChange={e => {
                        const next = [...arr];
                        next[idx].attribute = e.target.value;
                        updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeNpcConditions(next));
                      }}
                      className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 flex-1"
                    >
                      <optgroup label="基礎屬性">
                        <option value="obedience">服從度</option>
                        <option value="affection">好感度</option>
                        <option value="alertness">警戒度</option>
                        <option value="arousal">興奮度</option>
                        <option value="lust">淫癖</option>
                      </optgroup>
                      <optgroup label="部位屬性">
                        {Object.entries(mockChatVariables.bodyParts || {}).map(([id, def]) => (
                          <React.Fragment key={id}>
                            {def.hasSensitivity && <option value={`${id}Sensitivity`}>{def.name}敏感度</option>}
                            {def.hasTightness && <option value={`${id}Tightness`}>{def.name}鬆緊度</option>}
                            {def.hasProficiency && <option value={`${id}Proficiency`}>{def.name}熟練度</option>}
                            {def.canOrgasm && <option value={`${id}Orgasms`}>{def.name}高潮數</option>}
                          </React.Fragment>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex gap-1.5 items-center justify-between">
                    <div className="flex gap-0.5">
                      {['>', '<', '==', '>=', '<='].map(op => {
                        const isSel = cond.operator === op;
                        const opLabel = op === '>=' ? '≥' : op === '<=' ? '≤' : op === '==' ? '=' : op;
                        return (
                          <button
                            key={op}
                            type="button"
                            onClick={() => {
                              const next = [...arr];
                              next[idx].operator = op;
                              updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeNpcConditions(next));
                            }}
                            className={`px-1 py-0.5 text-[9px] rounded border ${isSel ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black border-purple-500/20 text-purple-300 hover:bg-white/5'}`}
                          >
                            {opLabel}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-[8px]">目標值</span>
                      <input
                        type="number"
                        value={cond.value}
                        onChange={e => {
                          const next = [...arr];
                          next[idx].value = Number(e.target.value) || 0;
                          updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeNpcConditions(next));
                        }}
                        className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = arr.filter((_, i) => i !== idx);
                        updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeNpcConditions(next));
                      }}
                      className="text-[9px] text-red-400 hover:text-red-300"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...parseNpcConditionString(rawUnlockTarget),
                    { npcName: npcNames[0] || '', attribute: 'obedience', operator: '>=', value: 0 },
                  ];
                  updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeNpcConditions(next));
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 underline"
              >
                + 新增角色解鎖條件
              </button>
            </div>
          )}

          {/* 物品解鎖條件 (多物品) */}
          {unlockType === 'item' && (
            <div className="space-y-1.5 pl-2 border-l border-purple-500/20">
              {parseItemConditionString(rawUnlockTarget).map((ic, idx, arr) => (
                <div
                  key={idx}
                  className="flex gap-1 items-center bg-black/40 p-1.5 rounded border border-purple-500/10"
                >
                  <select
                    value={ic.itemId}
                    onChange={e => {
                      const next = [...arr];
                      next[idx].itemId = e.target.value;
                      updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeItemConditions(next));
                    }}
                    className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 flex-1 min-w-[70px]"
                  >
                    {Object.entries(allItems).map(([id, def]) => (
                      <option key={id} value={id}>
                        {(def as any).name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ic.operator}
                    onChange={e => {
                      const next = [...arr];
                      next[idx].operator = e.target.value;
                      updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeItemConditions(next));
                    }}
                    className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 w-10"
                  >
                    {['>=', '<=', '==', '>', '<'].map(op => (
                      <option key={op} value={op}>
                        {op === '>=' ? '≥' : op === '<=' ? '≤' : op === '==' ? '=' : op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ic.quantity}
                    onChange={e => {
                      const next = [...arr];
                      next[idx].quantity = Number(e.target.value) || 0;
                      updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeItemConditions(next));
                    }}
                    className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = arr.filter((_, i) => i !== idx);
                      updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeItemConditions(next));
                    }}
                    className="text-[9px] text-red-400 hover:text-red-300 ml-1"
                  >
                    刪
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const firstItem = Object.keys(allItems)[0] || '';
                  const next = [
                    ...parseItemConditionString(rawUnlockTarget),
                    { itemId: firstItem, operator: '>=', quantity: 0 },
                  ];
                  updatePathInfoField(edgeId, direction, 'unlockTargetName', serializeItemConditions(next));
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 underline"
              >
                + 新增物品解鎖條件
              </button>
            </div>
          )}
        </div>

        {/* ==========================================
        // 臨時通行條件 (tempConditon)
        // ========================================== */}
        <div className="border-t border-purple-500/10 pt-2 space-y-1.5">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-purple-300 font-semibold">⏳ 臨時通行條件</span>
            <select
              value={tempType}
              onChange={e => updatePathInfoField(edgeId, direction, 'tempType', e.target.value)}
              className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 focus:outline-none"
            >
              <option value="none">無條件</option>
              <option value="npc_stats">角色門檻</option>
              <option value="item">物品門檻</option>
              <option value="time">時間通行</option>
            </select>
          </div>

          {/* 描述欄位 */}
          {tempType !== 'none' && (
            <div className="flex items-center gap-1.5 text-[9px]">
              <span className="text-gray-500 w-10 shrink-0">條件描述</span>
              <input
                type="text"
                value={pathInfo.tempConditon?.description || ''}
                onChange={e => updatePathInfoField(edgeId, direction, 'tempDesc', e.target.value)}
                placeholder="通行條件描述"
                className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-[9px] text-purple-100 focus:outline-none"
              />
            </div>
          )}

          {/* 角色門檻條件 */}
          {tempType === 'npc_stats' && (
            <div className="space-y-1.5 pl-2 border-l border-purple-500/20">
              {parseNpcConditionString(rawTempTarget).map((cond, idx, arr) => (
                <div key={idx} className="bg-black/40 p-2 rounded border border-purple-500/10 space-y-1.5">
                  <div className="flex gap-1 items-center">
                    <select
                      value={cond.npcName}
                      onChange={e => {
                        const next = [...arr];
                        next[idx].npcName = e.target.value;
                        updatePathInfoField(edgeId, direction, 'tempTargetName', serializeNpcConditions(next));
                      }}
                      className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 flex-1"
                    >
                      {npcNames.map(n => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                    <select
                      value={cond.attribute}
                      onChange={e => {
                        const next = [...arr];
                        next[idx].attribute = e.target.value;
                        updatePathInfoField(edgeId, direction, 'tempTargetName', serializeNpcConditions(next));
                      }}
                      className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 flex-1"
                    >
                      <optgroup label="基礎屬性">
                        <option value="obedience">服從度</option>
                        <option value="affection">好感度</option>
                        <option value="alertness">警戒度</option>
                        <option value="arousal">興奮度</option>
                        <option value="lust">淫癖</option>
                      </optgroup>
                      <optgroup label="部位屬性">
                        {Object.entries(mockChatVariables.bodyParts || {}).map(([id, def]) => (
                          <React.Fragment key={id}>
                            {def.hasSensitivity && <option value={`${id}Sensitivity`}>{def.name}敏感度</option>}
                            {def.hasTightness && <option value={`${id}Tightness`}>{def.name}鬆緊度</option>}
                            {def.hasProficiency && <option value={`${id}Proficiency`}>{def.name}熟練度</option>}
                            {def.canOrgasm && <option value={`${id}Orgasms`}>{def.name}高潮數</option>}
                          </React.Fragment>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                  <div className="flex gap-1.5 items-center justify-between">
                    <div className="flex gap-0.5">
                      {['>', '<', '==', '>=', '<='].map(op => {
                        const isSel = cond.operator === op;
                        const opLabel = op === '>=' ? '≥' : op === '<=' ? '≤' : op === '==' ? '=' : op;
                        return (
                          <button
                            key={op}
                            type="button"
                            onClick={() => {
                              const next = [...arr];
                              next[idx].operator = op;
                              updatePathInfoField(edgeId, direction, 'tempTargetName', serializeNpcConditions(next));
                            }}
                            className={`px-1 py-0.5 text-[9px] rounded border ${isSel ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black border-purple-500/20 text-purple-300 hover:bg-white/5'}`}
                          >
                            {opLabel}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500 text-[8px]">目標值</span>
                      <input
                        type="number"
                        value={cond.value}
                        onChange={e => {
                          const next = [...arr];
                          next[idx].value = Number(e.target.value) || 0;
                          updatePathInfoField(edgeId, direction, 'tempTargetName', serializeNpcConditions(next));
                        }}
                        className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const next = arr.filter((_, i) => i !== idx);
                        updatePathInfoField(edgeId, direction, 'tempTargetName', serializeNpcConditions(next));
                      }}
                      className="text-[9px] text-red-400 hover:text-red-300"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...parseNpcConditionString(rawTempTarget),
                    { npcName: npcNames[0] || '', attribute: 'obedience', operator: '>=', value: 0 },
                  ];
                  updatePathInfoField(edgeId, direction, 'tempTargetName', serializeNpcConditions(next));
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 underline"
              >
                + 新增角色門檻
              </button>
            </div>
          )}

          {/* 物品通行條件 */}
          {tempType === 'item' && (
            <div className="space-y-1.5 pl-2 border-l border-purple-500/20">
              {parseItemConditionString(rawTempTarget).map((ic, idx, arr) => (
                <div
                  key={idx}
                  className="flex gap-1 items-center bg-black/40 p-1.5 rounded border border-purple-500/10"
                >
                  <select
                    value={ic.itemId}
                    onChange={e => {
                      const next = [...arr];
                      next[idx].itemId = e.target.value;
                      updatePathInfoField(edgeId, direction, 'tempTargetName', serializeItemConditions(next));
                    }}
                    className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 flex-1 min-w-[70px]"
                  >
                    {Object.entries(allItems).map(([id, def]) => (
                      <option key={id} value={id}>
                        {(def as any).name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={ic.operator}
                    onChange={e => {
                      const next = [...arr];
                      next[idx].operator = e.target.value;
                      updatePathInfoField(edgeId, direction, 'tempTargetName', serializeItemConditions(next));
                    }}
                    className="bg-black border border-purple-500/20 rounded px-1 text-[9px] text-purple-100 w-10"
                  >
                    {['>=', '<=', '==', '>', '<'].map(op => (
                      <option key={op} value={op}>
                        {op === '>=' ? '≥' : op === '<=' ? '≤' : op === '==' ? '=' : op}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={ic.quantity}
                    onChange={e => {
                      const next = [...arr];
                      next[idx].quantity = Number(e.target.value) || 0;
                      updatePathInfoField(edgeId, direction, 'tempTargetName', serializeItemConditions(next));
                    }}
                    className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = arr.filter((_, i) => i !== idx);
                      updatePathInfoField(edgeId, direction, 'tempTargetName', serializeItemConditions(next));
                    }}
                    className="text-[9px] text-red-400 hover:text-red-300 ml-1"
                  >
                    刪
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  const firstItem = Object.keys(allItems)[0] || '';
                  const next = [
                    ...parseItemConditionString(rawTempTarget),
                    { itemId: firstItem, operator: '>=', quantity: 0 },
                  ];
                  updatePathInfoField(edgeId, direction, 'tempTargetName', serializeItemConditions(next));
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 underline"
              >
                + 新增物品通行條件
              </button>
            </div>
          )}

          {/* 時間通行條件 (多規則 JSON 陣列) */}
          {tempType === 'time' && (
            <div className="space-y-2 pl-2 border-l border-purple-500/20">
              {parseTimeConditionString(rawTempTarget).map((rule, idx, arr) => {
                const timePart = getRangeTimePart(rule.type, rule.range);

                // 每月開始/結束日期解析
                let monthlyStart = 1,
                  monthlyEnd = 30;
                if (rule.type === 'monthly') {
                  const dayStr = rule.range.split(/\s+/)[0] || '1-30';
                  if (dayStr.includes('-')) {
                    const [s, e] = dayStr.split('-').map(Number);
                    monthlyStart = s || 1;
                    monthlyEnd = e || 30;
                  } else {
                    monthlyStart = Number(dayStr) || 1;
                    monthlyEnd = Number(dayStr) || 1;
                  }
                }

                // 指定日期範圍開始/結束解析
                let dateStart = '',
                  dateEnd = '';
                if (rule.type === 'date') {
                  const parts = rule.range.split(' - ');
                  dateStart = parts[0] ? parts[0].replace(' ', 'T') : '';
                  dateEnd = parts[1] ? parts[1].replace(' ', 'T') : '';
                }

                const handleRuleChange = (field: string, val: any) => {
                  const next = [...arr];
                  const currentRule = { ...next[idx] };

                  if (field === 'type') {
                    currentRule.type = val;
                    currentRule.range =
                      val === 'date'
                        ? '2026-05-01 00:00 - 2026-05-01 23:59'
                        : val === 'weekly'
                          ? '1-5 00:00-23:59'
                          : val === 'monthly'
                            ? '1-30 00:00-23:59'
                            : '00:00-23:59';
                  } else if (field === 'passable') {
                    currentRule.passable = val;
                  } else if (field === 'timeRange') {
                    const { start, end } = val;
                    if (currentRule.type === 'daily') {
                      currentRule.range = `${start}-${end}`;
                    } else if (currentRule.type === 'weekly') {
                      const wPart = rule.range.split(/\s+/)[0] || '1-5';
                      currentRule.range = `${wPart} ${start}-${end}`;
                    } else if (currentRule.type === 'monthly') {
                      const mPart = rule.range.split(/\s+/)[0] || '1-30';
                      currentRule.range = `${mPart} ${start}-${end}`;
                    }
                  } else if (field === 'weeklyWeeks') {
                    const tPart = getRangeTimePart(rule.type, rule.range);
                    currentRule.range = `${val} ${tPart.start}-${tPart.end}`;
                  } else if (field === 'monthlyStart' || field === 'monthlyEnd') {
                    const tPart = getRangeTimePart(rule.type, rule.range);
                    const s = field === 'monthlyStart' ? val : monthlyStart;
                    const e = field === 'monthlyEnd' ? val : monthlyEnd;
                    currentRule.range = `${s}-${e} ${tPart.start}-${tPart.end}`;
                  } else if (field === 'dateRange') {
                    const { start, end } = val;
                    const cleanStart = start.replace('T', ' ');
                    const cleanEnd = end.replace('T', ' ');
                    currentRule.range = `${cleanStart} - ${cleanEnd}`;
                  }

                  next[idx] = currentRule;
                  updatePathInfoField(edgeId, direction, 'tempTargetName', serializeTimeConditions(next));
                };

                const weekList = rule.type === 'weekly' ? getWeekPartList(rule.range) : [];

                return (
                  <div key={idx} className="p-2 bg-black/40 rounded border border-purple-500/10 space-y-2 text-[9px]">
                    <div className="flex items-center justify-between gap-1">
                      <select
                        value={rule.type}
                        onChange={e => handleRuleChange('type', e.target.value)}
                        className="bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100"
                      >
                        <option value="daily">每天</option>
                        <option value="weekly">每週</option>
                        <option value="monthly">每月</option>
                        <option value="date">指定日期</option>
                      </select>

                      {/* 通行設定雙態按鈕 */}
                      <button
                        type="button"
                        onClick={() => handleRuleChange('passable', !rule.passable)}
                        className={`px-2 py-0.5 rounded font-bold border transition-colors ${rule.passable ? 'bg-emerald-950 border-emerald-500 text-emerald-300' : 'bg-red-950 border-red-500 text-red-300'}`}
                      >
                        {rule.passable ? '🟢 允許通行' : '🔴 禁止通行'}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const next = arr.filter((_, i) => i !== idx);
                          updatePathInfoField(edgeId, direction, 'tempTargetName', serializeTimeConditions(next));
                        }}
                        className="text-red-400 hover:text-red-300"
                      >
                        刪除
                      </button>
                    </div>

                    {/* 時段編輯 */}
                    {rule.type !== 'date' && (
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500">時段</span>
                        <input
                          type="time"
                          value={timePart.start}
                          onChange={e => handleRuleChange('timeRange', { start: e.target.value, end: timePart.end })}
                          className="bg-black border border-purple-500/20 rounded px-1 text-purple-100"
                        />
                        <span className="text-gray-500">➔</span>
                        <input
                          type="time"
                          value={timePart.end}
                          onChange={e => handleRuleChange('timeRange', { start: timePart.start, end: e.target.value })}
                          className="bg-black border border-purple-500/20 rounded px-1 text-purple-100"
                        />
                      </div>
                    )}

                    {/* 每週複選按鈕 */}
                    {rule.type === 'weekly' && (
                      <div className="space-y-1">
                        <span className="text-gray-500 block">重覆星期 (點選)</span>
                        <div className="flex gap-1 flex-wrap">
                          {[1, 2, 3, 4, 5, 6, 7].map(w => {
                            const isSelected = weekList.includes(w);
                            const wLabel = ['一', '二', '三', '四', '五', '六', '日'][w - 1];
                            return (
                              <button
                                key={w}
                                type="button"
                                onClick={() => {
                                  const nextWeeks = isSelected
                                    ? weekList.filter(x => x !== w)
                                    : [...weekList, w].sort();
                                  handleRuleChange('weeklyWeeks', nextWeeks.join(','));
                                }}
                                className={`w-5 h-5 rounded-full border text-[8px] font-bold transition-colors ${isSelected ? 'bg-purple-600 border-purple-500 text-white' : 'bg-black border-purple-500/15 text-purple-300 hover:bg-white/5'}`}
                              >
                                {wLabel}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 每月日期區間選單 */}
                    {rule.type === 'monthly' && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-500">日期</span>
                        <select
                          value={monthlyStart}
                          onChange={e => handleRuleChange('monthlyStart', Number(e.target.value))}
                          className="bg-black border border-purple-500/20 rounded text-purple-100"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>
                              {d} 日
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-500">➔</span>
                        <select
                          value={monthlyEnd}
                          onChange={e => handleRuleChange('monthlyEnd', Number(e.target.value))}
                          className="bg-black border border-purple-500/20 rounded text-purple-100"
                        >
                          {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                            <option key={d} value={d}>
                              {d} 日
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* 指定日期開始/結束時間選擇 */}
                    {rule.type === 'date' && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 w-10 shrink-0">開始時間</span>
                          <input
                            type="datetime-local"
                            value={dateStart}
                            onChange={e => handleRuleChange('dateRange', { start: e.target.value, end: dateEnd })}
                            className="bg-black border border-purple-500/20 rounded px-1 text-purple-100 flex-1"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-gray-500 w-10 shrink-0">結束時間</span>
                          <input
                            type="datetime-local"
                            value={dateEnd}
                            onChange={e => handleRuleChange('dateRange', { start: dateStart, end: e.target.value })}
                            className="bg-black border border-purple-500/20 rounded px-1 text-purple-100 flex-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <button
                type="button"
                onClick={() => {
                  const next = [
                    ...parseTimeConditionString(rawTempTarget),
                    { type: 'daily', range: '00:00-23:59', passable: true },
                  ];
                  updatePathInfoField(edgeId, direction, 'tempTargetName', serializeTimeConditions(next));
                }}
                className="text-[9px] text-purple-400 hover:text-purple-300 underline"
              >
                + 新增時間通行規則
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ==========================================
  // 渲染：快捷動作子面板內容
  // ==========================================
  const renderActionSubPanel = () => {
    const allItems = mockChatVariables.items || {};
    const allLocations = mockChatVariables.locations || {};
    const allZones = mockChatVariables.zones || {};
    const npcNames = Object.keys(mockMvuVariables.chars || {});
    const mapState = mockMvuVariables.user?.mapState;

    switch (actionSubPanel) {
      // ==========================================
      // 子面板 A：系統與資源
      // ==========================================
      case 'system':
        return (
          <div className="space-y-3">
            {/* 精確時間 */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">⏱ 系統時間</div>
              <input
                type="datetime-local"
                value={editTime}
                onChange={e => setEditTime(e.target.value)}
                className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[10px] text-purple-100 focus:outline-none focus:border-purple-500/50 mb-1.5"
              />
              <div className="flex gap-1 flex-wrap">
                <AdjustBtn label="時 -1" onClick={() => adjustTime(-1, 0)} color="red" />
                <AdjustBtn label="時 +1" onClick={() => adjustTime(1, 0)} color="emerald" />
                <AdjustBtn label="分 -5" onClick={() => adjustTime(0, -5)} color="red" />
                <AdjustBtn label="分 +5" onClick={() => adjustTime(0, 5)} color="emerald" />
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {[
                  { label: '☀️ 上午', dt: '2026-05-01 11:28:00' },
                  { label: '🌇 社團', dt: '2026-05-01 16:00:00' },
                  { label: '🌙 平日深夜', dt: '2026-05-01 22:00:00' },
                  { label: '💤 週末深夜', dt: '2026-05-02 22:00:00' },
                ].map(p => (
                  <button
                    key={p.label}
                    onClick={() => setTimePreset(p.dt)}
                    className="text-[9px] px-2 py-0.5 bg-purple-950/30 border border-purple-500/20 rounded-full text-purple-300 hover:bg-purple-900/40 transition-all active:scale-95"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* VIP */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">👑 VIP 等級</div>
              <select
                value={editVip}
                onChange={e => setEditVip(Number(e.target.value))}
                className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[10px] text-purple-100 focus:outline-none"
              >
                {[0, 1, 2, 3, 4, 5, 6].map(v => (
                  <option key={v} value={v}>
                    VIP {v}
                  </option>
                ))}
              </select>
            </div>

            {/* 基礎資源 */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">💰 基礎資源</div>
              <NumberAdjustRow label="💵 金幣" value={editMoney} onChange={setEditMoney} steps={[1, 5, 100]} />
              <NumberAdjustRow label="⚡ MC能量" value={editEnergy} onChange={setEditEnergy} steps={[1, 5, 100]} />
              <NumberAdjustRow
                label="🔋 能量上限"
                value={editEnergyMax}
                onChange={setEditEnergyMax}
                steps={[1, 5, 100]}
              />
              <NumberAdjustRow label="🪙 MC點" value={editPoints} onChange={setEditPoints} steps={[1, 5, 100]} />
              <NumberAdjustRow label="🚨 可疑度" value={editSuspicion} onChange={setEditSuspicion} steps={[1, 5, 10]} />
            </div>

            <button
              onClick={applySystemChanges}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95"
            >
              保存系統變更並重載
            </button>
          </div>
        );

      // ==========================================
      // 子面板 B：玩家背包
      // ==========================================
      case 'playerInv':
        return (
          <div className="space-y-1">
            <div className="text-[10px] font-bold text-purple-300 mb-1">🎒 玩家持有物品</div>
            <div className="max-h-[380px] overflow-y-auto space-y-0.5 pr-1 hypno-scrollbar">
              {Object.entries(allItems).map(([itemId, itemDef]) => {
                const qty = getPlayerItemQty(itemId);
                const hasItem = qty > 0;
                const isActive = hasItem && !!mockMvuVariables.user?.inventory?.[itemId]?.isActive;
                return (
                  <div
                    key={itemId}
                    className={`flex flex-col p-1.5 rounded border transition-all ${hasItem ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-black/10 border-purple-500/10'}`}
                  >
                    <div className="flex items-center gap-1.5 w-full">
                      <input
                        type="checkbox"
                        checked={hasItem}
                        onChange={() => {
                          if (hasItem) {
                            setPlayerItemQty(itemId, 0);
                          } else {
                            setPlayerItemQty(itemId, 1);
                          }
                        }}
                        className="accent-emerald-500 w-3 h-3"
                      />
                      <span className="text-[9px] text-gray-200 flex-1 truncate" title={itemDef.description}>
                        {itemDef.name} <span className="text-gray-500">({itemId})</span>
                        {hasItem && itemDef.activationType !== 'none' && (
                          <span
                            className={`ml-1.5 px-1 py-px rounded text-[8px] font-bold ${isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20 animate-pulse' : 'bg-gray-900 text-gray-400 border border-gray-700/20'}`}
                          >
                            {isActive ? '● 激活中' : '○ 未激活'}
                          </span>
                        )}
                      </span>
                      {hasItem && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          <AdjustBtn
                            label="-1"
                            onClick={() => setPlayerItemQty(itemId, Math.max(0, qty - 1))}
                            color="red"
                          />
                          <input
                            type="number"
                            value={qty}
                            min={0}
                            onChange={e => setPlayerItemQty(itemId, Math.max(0, Number(e.target.value)))}
                            className="w-10 bg-black/40 border border-purple-500/20 rounded px-1 py-0.5 text-[9px] text-purple-100 text-center focus:outline-none"
                          />
                          <AdjustBtn label="+1" onClick={() => setPlayerItemQty(itemId, qty + 1)} color="emerald" />
                        </div>
                      )}
                    </div>
                    {hasItem && itemDef.activationType !== 'none' && itemDef.activationDescription && (
                      <div className="text-[8px] text-purple-300 font-normal pl-4.5 mt-0.5 border-l border-purple-500/20 ml-1.5">
                        效果: {itemDef.activationDescription}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={flushAndSave}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 mt-2"
            >
              保存背包變更並重載
            </button>
          </div>
        );

      // ==========================================
      // 子面板 C：NPC 設定
      // ==========================================
      case 'npcInv': {
        const currentNpcStat = localNpcStats[selectedNpc];
        return (
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-purple-300 mb-1">👥 NPC 設定管理</div>
            <select
              value={selectedNpc}
              onChange={e => setSelectedNpc(e.target.value)}
              className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[10px] text-purple-100 focus:outline-none"
            >
              {npcNames.map(name => (
                <option key={name} value={name}>
                  {name} ({(mockMvuVariables.chars[name] as any)?.identity || ''})
                </option>
              ))}
            </select>

            {/* 基礎屬性編輯 */}
            {currentNpcStat && (
              <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-1">
                <div className="text-[10px] font-bold text-purple-300 mb-1">📊 基礎屬性編輯</div>
                <NumberAdjustRow
                  label="服從度"
                  value={currentNpcStat.obedience || 0}
                  onChange={v => updateNpcBaseStat(selectedNpc, 'obedience', v)}
                  steps={[1, 5, 20]}
                />
                <NumberAdjustRow
                  label="好感度"
                  value={currentNpcStat.affection || 0}
                  onChange={v => updateNpcBaseStat(selectedNpc, 'affection', v)}
                  steps={[1, 5, 20]}
                />
                <NumberAdjustRow
                  label="警戒度"
                  value={currentNpcStat.alertness || 0}
                  onChange={v => updateNpcBaseStat(selectedNpc, 'alertness', v)}
                  steps={[1, 5, 20]}
                />
                <NumberAdjustRow
                  label="快感值"
                  value={currentNpcStat.arousal || 0}
                  onChange={v => updateNpcBaseStat(selectedNpc, 'arousal', v)}
                  steps={[1, 5, 20]}
                />
                <NumberAdjustRow
                  label="淫癖"
                  value={currentNpcStat.lust || 0}
                  onChange={v => updateNpcBaseStat(selectedNpc, 'lust', v)}
                  steps={[1, 5, 20]}
                />
              </div>
            )}
            {/* 所在地點與在場描述編輯 */}
            {currentNpcStat && (
              <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                <div className="text-[10px] font-bold text-purple-300">📍 所在地點與狀態編輯</div>

                <div className="flex items-center gap-1.5 py-1 text-[10px]">
                  <span className="text-gray-400 w-16 shrink-0">所在地點</span>
                  <select
                    value={currentNpcStat.locationState?.locationId || ''}
                    onChange={e => updateNpcLocationState(selectedNpc, 'locationId', e.target.value)}
                    className="flex-1 bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[10px] text-purple-100 focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="">無 (不在地圖上)</option>
                    {Object.entries(mockChatVariables.locations || {}).map(([id, node]) => (
                      <option key={id} value={id}>
                        {(node as any).name} ({id})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1.5 py-1 text-[10px]">
                  <span className="text-gray-400 w-16 shrink-0">在場描述</span>
                  <input
                    type="text"
                    value={currentNpcStat.locationState?.locationStatus || ''}
                    onChange={e => updateNpcLocationState(selectedNpc, 'locationStatus', e.target.value)}
                    placeholder="例如: 正在整理講台..."
                    className="flex-1 bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[10px] text-purple-100 focus:outline-none focus:border-purple-500/50"
                  />
                </div>
              </div>
            )}

            {/* 身體部位開發狀態 */}
            {currentNpcStat && currentNpcStat.bodyParts && (
              <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                <div className="text-[10px] font-bold text-purple-300">🧬 身體部位開發狀態</div>
                <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1 hypno-scrollbar">
                  {Object.entries(mockChatVariables.bodyParts || {}).map(([partKey, partDef]) => {
                    const partStat = currentNpcStat.bodyParts[partKey];
                    if (!partStat) return null;

                    const isSensitivitySupported = partDef ? partDef.hasSensitivity : true;
                    const isTightnessSupported = partDef
                      ? partDef.hasTightness
                      : partKey.includes('mouth') ||
                        partKey.includes('vagina') ||
                        partKey.includes('anus') ||
                        partKey.includes('urethra');
                    const isProficiencySupported = partDef ? partDef.hasProficiency : true;
                    const isOrgasmSupported = partDef ? partDef.canOrgasm : true;

                    const sensitivity = partStat.sensitivity ?? 0;
                    const tightness = partStat.tightness ?? 0;
                    const proficiency = partStat.proficiency ?? 0;
                    const orgasms = partStat.orgasms ?? 0;

                    const sensGrade = MockApi.getStatGrade(sensitivity, -100, 100);
                    const sensGradeColor = MockApi.getGradeColor(sensGrade);

                    return (
                      <div key={partKey} className="p-2 bg-black/40 border border-purple-500/10 rounded-lg space-y-1.5">
                        <div className="text-[9px] font-bold text-white/95 border-b border-white/5 pb-1 flex justify-between">
                          <span>
                            {partDef.name} ({partKey})
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[9px]">
                          {/* 敏感度 */}
                          {isSensitivitySupported && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-10 shrink-0">敏感度</span>
                              <input
                                type="number"
                                value={sensitivity}
                                onChange={e =>
                                  updateNpcBodyPartStat(
                                    selectedNpc,
                                    partKey,
                                    'sensitivity',
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                              />
                              <span className={`text-[8px] font-bold ${sensGradeColor}`}>{sensGrade}</span>
                            </div>
                          )}
                          {/* 鬆緊度 */}
                          {isTightnessSupported && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-10 shrink-0">松紧度</span>
                              <input
                                type="number"
                                value={tightness}
                                onChange={e =>
                                  updateNpcBodyPartStat(selectedNpc, partKey, 'tightness', Number(e.target.value) || 0)
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                              />
                              <span
                                className={`text-[8px] font-bold ${MockApi.getGradeColor(MockApi.getStatGrade(tightness, -100, 100))}`}
                              >
                                {MockApi.getStatGrade(tightness, -100, 100)}
                              </span>
                            </div>
                          )}
                          {/* 熟練度 */}
                          {isProficiencySupported && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-10 shrink-0">熟练度</span>
                              <input
                                type="number"
                                value={proficiency}
                                onChange={e =>
                                  updateNpcBodyPartStat(
                                    selectedNpc,
                                    partKey,
                                    'proficiency',
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                              />
                              <span
                                className={`text-[8px] font-bold ${MockApi.getGradeColor(MockApi.getStatGrade(proficiency, 0, 100))}`}
                              >
                                {MockApi.getStatGrade(proficiency, 0, 100)}
                              </span>
                            </div>
                          )}
                          {/* 高潮次數 */}
                          {isOrgasmSupported && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-10 shrink-0">高潮次</span>
                              <input
                                type="number"
                                value={orgasms}
                                onChange={e =>
                                  updateNpcBodyPartStat(selectedNpc, partKey, 'orgasms', Number(e.target.value) || 0)
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-[9px] text-purple-100 text-center"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 背包管理 */}
            {selectedNpc && (
              <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-1.5">
                <div className="text-[10px] font-bold text-purple-300">🎒 NPC 物品背包</div>
                <div className="max-h-[160px] overflow-y-auto space-y-0.5 pr-1 hypno-scrollbar">
                  {Object.entries(allItems).map(([itemId, itemDef]) => {
                    const qty = getNpcItemQty(selectedNpc, itemId);
                    const hasItem = qty > 0;
                    const isActive =
                      hasItem && !!(mockMvuVariables.chars?.[selectedNpc]?.inventory as any)?.[itemId]?.isActive;
                    return (
                      <div
                        key={itemId}
                        className={`flex flex-col p-1.5 rounded border transition-all ${hasItem ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-black/10 border-purple-500/10'}`}
                      >
                        <div className="flex items-center gap-1.5 w-full">
                          <input
                            type="checkbox"
                            checked={hasItem}
                            onChange={() => {
                              if (hasItem) {
                                setNpcItemQty(selectedNpc, itemId, 0);
                              } else {
                                setNpcItemQty(selectedNpc, itemId, 1);
                              }
                            }}
                            className="accent-emerald-500 w-3 h-3"
                          />
                          <span className="text-[9px] text-gray-200 flex-1 truncate">
                            {itemDef.name}
                            {hasItem && itemDef.activationType !== 'none' && (
                              <span
                                className={`ml-1.5 px-1 py-px rounded text-[8px] font-bold ${isActive ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/20 animate-pulse' : 'bg-gray-900 text-gray-400 border border-gray-700/20'}`}
                              >
                                {isActive ? '● 激活中' : '○ 未激活'}
                              </span>
                            )}
                          </span>
                          {hasItem && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              <AdjustBtn
                                label="-1"
                                onClick={() => setNpcItemQty(selectedNpc, itemId, Math.max(0, qty - 1))}
                                color="red"
                              />
                              <input
                                type="number"
                                value={qty}
                                min={0}
                                onChange={e => setNpcItemQty(selectedNpc, itemId, Math.max(0, Number(e.target.value)))}
                                className="w-8 bg-black/40 border border-purple-500/20 rounded px-1 py-0.5 text-[9px] text-purple-100 text-center focus:outline-none"
                              />
                              <AdjustBtn
                                label="+1"
                                onClick={() => setNpcItemQty(selectedNpc, itemId, qty + 1)}
                                color="emerald"
                              />
                            </div>
                          )}
                        </div>
                        {hasItem && itemDef.activationType !== 'none' && itemDef.activationDescription && (
                          <div className="text-[8px] text-purple-300 font-normal pl-4.5 mt-0.5 border-l border-purple-500/20 ml-1.5">
                            效果: {itemDef.activationDescription}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ==========================================
            // 身體改造 Debug 相關邏輯 (NPC 改造狀態管理)
            // ========================================== */}
            {selectedNpc && currentNpcStat && (
              <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                <div className="text-[10px] font-bold text-purple-300">🧬 身體改造狀態管理</div>

                {/* 新增改造選單 */}
                <div className="flex items-center gap-1.5 p-1.5 bg-black/40 rounded border border-purple-500/15">
                  <select
                    id="new-mod-select"
                    className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-[9px] text-purple-100 focus:outline-none"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      選擇要加裝的身體改造...
                    </option>
                    {Object.entries(localBodyMods).map(([id, def]: [string, any]) => {
                      const isInstalled = currentNpcStat.ownedBodyModifications?.[id] !== undefined;
                      if (isInstalled) return null;
                      return (
                        <option key={id} value={id}>
                          {def.name} ({id})
                        </option>
                      );
                    })}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const sel = document.getElementById('new-mod-select') as HTMLSelectElement;
                      if (sel && sel.value) {
                        addNpcBodyMod(selectedNpc, sel.value);
                        sel.value = ''; // 重設 selection
                      }
                    }}
                    className="px-2 py-0.5 bg-purple-600 hover:bg-purple-500 text-white text-[9px] font-bold rounded border border-purple-500/30 transition-all active:scale-95 shrink-0"
                  >
                    新增植入
                  </button>
                </div>

                {/* 已有改造列表 */}
                <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-1 hypno-scrollbar">
                  {!currentNpcStat.ownedBodyModifications ||
                  Object.keys(currentNpcStat.ownedBodyModifications).length === 0 ? (
                    <div className="text-[9px] text-gray-500 italic text-center py-2">目前無 any 已安裝改造。</div>
                  ) : (
                    Object.entries(currentNpcStat.ownedBodyModifications).map(([modId, modState]: [string, any]) => {
                      const def = localBodyMods[modId] || { name: modId, description: '未定義方案' };
                      const isAdaptCompleted = !modState.adaptation;
                      return (
                        <div
                          key={modId}
                          className="p-2 bg-black/30 border border-purple-500/10 rounded-lg space-y-1.5 text-[9px]"
                        >
                          <div className="flex items-center justify-between border-b border-purple-500/5 pb-1">
                            <span className="font-bold text-purple-200">{def.name}</span>
                            <button
                              type="button"
                              onClick={() => removeNpcBodyMod(selectedNpc, modId)}
                              className="text-[9px] text-red-400 hover:text-red-300 transition-colors font-semibold"
                            >
                              移除
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            {/* 啟用/關閉 */}
                            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={!!modState.isActive}
                                onChange={e => updateNpcBodyModProp(selectedNpc, modId, 'isActive', e.target.checked)}
                                className="accent-purple-500 w-3 h-3"
                              />
                              啟用狀態
                            </label>

                            {/* 適應狀態 */}
                            <label className="flex items-center gap-1.5 text-gray-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isAdaptCompleted}
                                onChange={e =>
                                  updateNpcBodyModProp(selectedNpc, modId, 'adaptation_complete', e.target.checked)
                                }
                                className="accent-purple-500 w-3 h-3"
                              />
                              已完全適應
                            </label>
                          </div>

                          {/* AI 註釋 */}
                          <div className="flex items-center gap-1">
                            <span className="text-gray-500 shrink-0">AI 註釋:</span>
                            <input
                              type="text"
                              value={modState.customDescription || ''}
                              onChange={e =>
                                updateNpcBodyModProp(selectedNpc, modId, 'customDescription', e.target.value)
                              }
                              placeholder="輸入對 AI 演繹的故事註釋..."
                              className="flex-1 bg-black/50 border border-purple-500/20 rounded px-1.5 py-0.5 text-[9px] text-purple-100 focus:outline-none focus:border-purple-500/50"
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            <button
              onClick={flushAndSave}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 mt-2"
            >
              保存 NPC 設定並重載
            </button>
          </div>
        );
      }

      // ==========================================
      // 子面板：身體改造方案定義編輯器 (bodyMod)
      // ==========================================
      case 'bodyMod': {
        const currentModDef = localBodyMods[selectedModId];
        const allItems = mockChatVariables.items || {};

        // ==========================================
        // 身體改造 Debug 相關邏輯 (前置條件快捷選項)
        // ==========================================
        const presetTargets = [
          { value: 'money', label: '💵 金幣 (money)' },
          { value: 'pts', label: '🪙 MC點數 (pts)' },
          { value: 'mcEnergy', label: '⚡ MC能量 (mcEnergy)' },
          { value: 'mcEnergyMax', label: '🔋 能量上限 (mcEnergyMax)' },
          { value: 'vipTier', label: '👑 VIP等級 (vipTier)' },
          { value: 'suspicion', label: '🚨 可疑度 (suspicion)' },
          { value: 'obedience', label: '📊 服從度 (obedience)' },
          { value: 'affection', label: '📊 好感度 (affection)' },
          { value: 'alertness', label: '📊 警戒度 (alertness)' },
          { value: 'arousal', label: '📊 快感值 (arousal)' },
          { value: 'lust', label: '📊 淫癖 (lust)' },
        ];

        // 動態搜集所有身體部位 (包含預設與執行期動態加裝的部位)
        const defaultPartKeys = ['mouth', 'breastLeft', 'breastRight', 'vagina', 'anus', 'urethra', 'clitoris', 'womb'];
        const bodyPartNames: Record<string, string> = {
          mouth: '嘴部/口腔',
          breastLeft: '左側乳房',
          breastRight: '右側乳房',
          vagina: '陰道通道',
          anus: '肛門括約肌',
          urethra: '尿道腺體',
          clitoris: '陰蒂敏感核',
          womb: '子宮腔體',
        };

        const allPartKeysSet = new Set(defaultPartKeys);

        // 1. 從 mock 靜態部位資料庫搜集
        if (mockChatVariables.bodyParts) {
          Object.entries(mockChatVariables.bodyParts).forEach(([k, def]: [string, any]) => {
            allPartKeysSet.add(k);
            if (def && def.name && !bodyPartNames[k]) {
              bodyPartNames[k] = def.name;
            }
          });
        }

        // 2. 從所有改造方案定義的 addedBodyPart 中搜集
        Object.values(localBodyMods).forEach((def: any) => {
          if (def && def.addedBodyPart && def.addedBodyPart.id) {
            allPartKeysSet.add(def.addedBodyPart.id);
            if (def.addedBodyPart.name && !bodyPartNames[def.addedBodyPart.id]) {
              bodyPartNames[def.addedBodyPart.id] = def.addedBodyPart.name;
            }
          }
        });

        // 3. 從所有 NPC 當前實體化的 bodyParts 中搜集 (涵蓋執行期動態變化)
        Object.values(localNpcStats).forEach((npc: any) => {
          if (npc && npc.bodyParts) {
            Object.keys(npc.bodyParts).forEach(k => {
              allPartKeysSet.add(k);
            });
          }
        });

        const bodyPartKeys = Array.from(allPartKeysSet);
        const bodyPartAttrs = [
          { key: 'sensitivity', name: '敏感度' },
          { key: 'tightness', name: '鬆緊度' },
          { key: 'proficiency', name: '熟練度' },
          { key: 'orgasms', name: '高潮次數' },
        ];

        const partOptions: { value: string; label: string }[] = [];
        bodyPartKeys.forEach(part => {
          const partLabel = bodyPartNames[part] || part;
          bodyPartAttrs.forEach(attr => {
            partOptions.push({
              value: `bodyParts.${part}.${attr.key}`,
              label: `🧬 ${partLabel} - ${attr.name} (${attr.key})`,
            });
          });
        });

        const allTargetOptions = [...presetTargets, ...partOptions];

        const toggleHasAddedPart = (hasPart: boolean) => {
          if (hasPart) {
            updateModDef(selectedModId, ['addedBodyPart'], {
              id: 'tail',
              name: '尾巴',
              hasSensitivity: true,
              hasTightness: false,
              hasProficiency: true,
              canOrgasm: true,
              description: '手術移植的部位',
              initialStats: { sensitivity: 20, tightness: 0, proficiency: 10, orgasms: 0 },
            });
          } else {
            setLocalBodyMods(prev => {
              const next = { ...prev };
              if (next[selectedModId]) {
                next[selectedModId] = JSON.parse(JSON.stringify(next[selectedModId]));
                delete next[selectedModId].addedBodyPart;
              }
              return next;
            });
          }
        };

        return (
          <div className="space-y-3">
            <div className="text-[10px] font-bold text-purple-300 mb-1">🧬 身體改造方案編輯器</div>

            {/* 方案選擇 */}
            <div className="flex gap-1">
              <select
                value={selectedModId}
                onChange={e => setSelectedModId(e.target.value)}
                className="flex-1 bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[10px] text-purple-100 focus:outline-none"
              >
                {Object.entries(localBodyMods).map(([id, def]: [string, any]) => (
                  <option key={id} value={id}>
                    {def.name} ({id})
                  </option>
                ))}
              </select>
            </div>

            {currentModDef ? (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 hypno-scrollbar">
                {/* 1. 基本資訊 */}
                <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                  <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-1">
                    📄 基本資訊
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-gray-400 w-16 shrink-0 font-bold">改造名稱</span>
                    <input
                      type="text"
                      value={currentModDef.name || ''}
                      onChange={e => updateModDef(selectedModId, ['name'], e.target.value)}
                      className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 focus:outline-none focus:border-purple-500/50"
                    />
                  </div>

                  <div className="flex items-start gap-1.5 text-[9px]">
                    <span className="text-gray-400 w-16 shrink-0 mt-1 font-bold">改造說明</span>
                    <textarea
                      value={currentModDef.description || ''}
                      onChange={e => updateModDef(selectedModId, ['description'], e.target.value)}
                      rows={2}
                      className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 resize-none focus:outline-none focus:border-purple-500/50 font-sans"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-gray-400 w-16 shrink-0 font-bold">肉體負荷</span>
                    <input
                      type="number"
                      value={currentModDef.loadCost || 0}
                      onChange={e => updateModDef(selectedModId, ['loadCost'], Number(e.target.value) || 0)}
                      className="w-16 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 text-center focus:outline-none"
                    />
                  </div>

                  <div className="flex items-start gap-1.5 text-[9px]">
                    <span className="text-gray-400 w-16 shrink-0 mt-1 font-bold">Prompt 注入</span>
                    <textarea
                      value={currentModDef.promptInjection || ''}
                      onChange={e => updateModDef(selectedModId, ['promptInjection'], e.target.value)}
                      rows={3}
                      className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 resize-none focus:outline-none focus:border-purple-500/50 font-sans"
                      placeholder="注入 AI 的故事描述文本..."
                    />
                  </div>
                </div>

                {/* 2. 手術花費 */}
                <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                  <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-1">
                    💰 手術花費與材料
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <div className="flex flex-col text-[8px]">
                      <span className="text-gray-400 mb-0.5">金幣 (¥)</span>
                      <input
                        type="number"
                        value={currentModDef.cost?.money || 0}
                        onChange={e => updateModDef(selectedModId, ['cost', 'money'], Number(e.target.value) || 0)}
                        className="w-full bg-black border border-purple-500/20 rounded px-1 py-0.5 text-purple-100 text-center focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col text-[8px]">
                      <span className="text-gray-400 mb-0.5">MC點數 (PTS)</span>
                      <input
                        type="number"
                        value={currentModDef.cost?.pts || 0}
                        onChange={e => updateModDef(selectedModId, ['cost', 'pts'], Number(e.target.value) || 0)}
                        className="w-full bg-black border border-purple-500/20 rounded px-1 py-0.5 text-purple-100 text-center focus:outline-none"
                      />
                    </div>
                    <div className="flex flex-col text-[8px]">
                      <span className="text-gray-400 mb-0.5">MC能量 (⚡)</span>
                      <input
                        type="number"
                        value={currentModDef.cost?.mcEnergy || 0}
                        onChange={e => updateModDef(selectedModId, ['cost', 'mcEnergy'], Number(e.target.value) || 0)}
                        className="w-full bg-black border border-purple-500/20 rounded px-1 py-0.5 text-purple-100 text-center focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* 物品消耗清單 */}
                  <div className="space-y-1 mt-1.5">
                    <span className="text-[8px] text-gray-400 block font-semibold">所需物品材料:</span>
                    {(currentModDef.cost?.requiredItems || []).map((item: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex gap-1 items-center bg-black/40 p-1 rounded border border-purple-500/10"
                      >
                        <select
                          value={item.itemId}
                          onChange={e => {
                            const list = [...(currentModDef.cost.requiredItems || [])];
                            list[idx].itemId = e.target.value;
                            updateModDef(selectedModId, ['cost', 'requiredItems'], list);
                          }}
                          className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 flex-1 min-w-[70px] focus:outline-none"
                        >
                          {Object.entries(allItems).map(([id, def]: [string, any]) => (
                            <option key={id} value={id}>
                              {def.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={e => {
                            const list = [...(currentModDef.cost.requiredItems || [])];
                            list[idx].quantity = Number(e.target.value) || 0;
                            updateModDef(selectedModId, ['cost', 'requiredItems'], list);
                          }}
                          className="w-10 bg-black border border-purple-500/20 rounded text-[8px] text-purple-100 text-center focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const list = (currentModDef.cost.requiredItems || []).filter(
                              (_: any, i: number) => i !== idx,
                            );
                            updateModDef(selectedModId, ['cost', 'requiredItems'], list);
                          }}
                          className="text-[8px] text-red-400 hover:text-red-300 px-1 font-semibold"
                        >
                          刪除
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const firstItem = Object.keys(allItems)[0] || '';
                        const list = [...(currentModDef.cost?.requiredItems || []), { itemId: firstItem, quantity: 1 }];
                        updateModDef(selectedModId, ['cost', 'requiredItems'], list);
                      }}
                      className="text-[8px] text-purple-400 hover:text-purple-300 underline"
                    >
                      + 新增材料消耗
                    </button>
                  </div>
                </div>

                {/* 3. 前置條件 */}
                <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                  <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-1">
                    🔓 前置條件 (Conditions)
                  </div>

                  <div className="space-y-1">
                    {(currentModDef.conditions || []).map((cond: any, idx: number) => {
                      const isPreset = allTargetOptions.some(opt => opt.value === cond.target);
                      const selectValue = isPreset ? cond.target : 'custom';
                      return (
                        <div key={idx} className="bg-black/40 p-1.5 rounded border border-purple-500/10 space-y-1">
                          <div className="flex gap-1 items-center flex-wrap">
                            <select
                              value={selectValue}
                              onChange={e => {
                                const val = e.target.value;
                                const list = [...currentModDef.conditions];
                                if (val === 'custom') {
                                  list[idx].target = 'custom_target';
                                } else {
                                  list[idx].target = val;
                                }
                                updateModDef(selectedModId, ['conditions'], list);
                              }}
                              className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 flex-1 min-w-[120px] focus:outline-none"
                            >
                              <optgroup label="全域與基礎屬性">
                                {presetTargets.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="身體部位開發">
                                {partOptions.map(opt => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </optgroup>
                              <option value="custom">⚙️ 自定義輸入...</option>
                            </select>
                            <select
                              value={cond.operator}
                              onChange={e => {
                                const list = [...currentModDef.conditions];
                                list[idx].operator = e.target.value;
                                updateModDef(selectedModId, ['conditions'], list);
                              }}
                              className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 w-12 focus:outline-none text-center"
                            >
                              {['>=', '<=', '==', '!=', '>', '<'].map(op => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>
                            <input
                              type="number"
                              value={cond.value}
                              onChange={e => {
                                const list = [...currentModDef.conditions];
                                list[idx].value = Number(e.target.value) || 0;
                                updateModDef(selectedModId, ['conditions'], list);
                              }}
                              className="w-10 bg-black border border-purple-500/20 rounded text-[8px] text-purple-100 text-center focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const list = currentModDef.conditions.filter((_: any, i: number) => i !== idx);
                                updateModDef(selectedModId, ['conditions'], list);
                              }}
                              className="text-[8px] text-red-400 hover:text-red-300 px-1 font-semibold"
                            >
                              刪除
                            </button>
                          </div>
                          {!isPreset && (
                            <div className="flex items-center gap-1.5 mt-1">
                              <span className="text-[8px] text-gray-500 shrink-0">自定義目標:</span>
                              <input
                                type="text"
                                value={cond.target}
                                onChange={e => {
                                  const list = [...currentModDef.conditions];
                                  list[idx].target = e.target.value;
                                  updateModDef(selectedModId, ['conditions'], list);
                                }}
                                placeholder="屬性路徑 (如 bodyParts.mouth.sensitivity)"
                                className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-[8px] text-purple-100 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const list = [
                          ...(currentModDef.conditions || []),
                          { target: 'obedience', operator: '>=', value: 30 },
                        ];
                        updateModDef(selectedModId, ['conditions'], list);
                      }}
                      className="text-[8px] text-purple-400 hover:text-purple-300 underline"
                    >
                      + 新增前置條件
                    </button>
                  </div>
                </div>

                {/* 4. 常駐影響 */}
                <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                  <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-1">
                    ⚡ 常駐屬性影響 (Modifiers)
                  </div>

                  <div className="space-y-1.5">
                    {(currentModDef.modifiers || []).map((mod: any, idx: number) => {
                      const globalAttrOptions = [
                        { value: 'obedience', label: '服從度 (obedience)' },
                        { value: 'affection', label: '好感度 (affection)' },
                        { value: 'alertness', label: '警戒度 (alertness)' },
                        { value: 'arousal', label: '快感值 (arousal)' },
                        { value: 'lust', label: '淫癖 (lust)' },
                        { value: 'suspicion', label: '可疑度 (suspicion)' },
                      ];

                      const partAttrOptions = [
                        { value: 'sensitivity', label: '敏感度 (sensitivity)' },
                        { value: 'tightness', label: '鬆緊度 (tightness)' },
                        { value: 'proficiency', label: '熟練度 (proficiency)' },
                        { value: 'orgasms', label: '高潮次數 (orgasms)' },
                      ];

                      const currentAttrOptions = mod.targetType === 'global_stat' ? globalAttrOptions : partAttrOptions;
                      const isPresetAttr = currentAttrOptions.some(opt => opt.value === mod.statName);
                      const selectAttrValue = isPresetAttr ? mod.statName : 'custom';

                      const isPresetPart = ['slots', ...bodyPartKeys].includes(mod.bodyPartId || '');
                      const selectPartValue = isPresetPart ? mod.bodyPartId || 'slots' : 'custom';

                      return (
                        <div
                          key={idx}
                          className="bg-black/40 p-1.5 rounded border border-purple-500/10 space-y-1 text-[8px]"
                        >
                          <div className="flex gap-1 items-center flex-wrap">
                            {/* 影響範圍 */}
                            <select
                              value={mod.targetType}
                              onChange={e => {
                                const list = [...currentModDef.modifiers];
                                const nextTarget = e.target.value;
                                list[idx].targetType = nextTarget;
                                // 切換類型時自動校正預設屬性
                                list[idx].statName = nextTarget === 'global_stat' ? 'obedience' : 'sensitivity';
                                if (nextTarget === 'global_stat') {
                                  delete list[idx].bodyPartId;
                                } else {
                                  list[idx].bodyPartId = 'slots';
                                }
                                updateModDef(selectedModId, ['modifiers'], list);
                              }}
                              className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 focus:outline-none"
                            >
                              <option value="global_stat">全域屬性</option>
                              <option value="body_part_stat">部位屬性</option>
                            </select>

                            {/* 屬性名稱 */}
                            <select
                              value={selectAttrValue}
                              onChange={e => {
                                const val = e.target.value;
                                const list = [...currentModDef.modifiers];
                                if (val === 'custom') {
                                  list[idx].statName = 'custom_stat';
                                } else {
                                  list[idx].statName = val;
                                }
                                updateModDef(selectedModId, ['modifiers'], list);
                              }}
                              className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 focus:outline-none"
                            >
                              {currentAttrOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                              <option value="custom">⚙️ 自定義...</option>
                            </select>

                            {!isPresetAttr && (
                              <input
                                type="text"
                                value={mod.statName}
                                onChange={e => {
                                  const list = [...currentModDef.modifiers];
                                  list[idx].statName = e.target.value;
                                  updateModDef(selectedModId, ['modifiers'], list);
                                }}
                                placeholder="自定義屬性"
                                className="bg-black border border-purple-500/20 rounded px-1 py-0.5 text-[8px] text-purple-100 w-16 focus:outline-none"
                              />
                            )}

                            {/* 運算子 */}
                            <select
                              value={mod.operator}
                              onChange={e => {
                                const list = [...currentModDef.modifiers];
                                list[idx].operator = e.target.value;
                                updateModDef(selectedModId, ['modifiers'], list);
                              }}
                              className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 w-8 text-center font-bold focus:outline-none"
                            >
                              {['+', '-', '*'].map(op => (
                                <option key={op} value={op}>
                                  {op}
                                </option>
                              ))}
                            </select>

                            {/* 調整數值 */}
                            <input
                              type="number"
                              value={mod.value}
                              onChange={e => {
                                const list = [...currentModDef.modifiers];
                                list[idx].value = Number(e.target.value) || 0;
                                updateModDef(selectedModId, ['modifiers'], list);
                              }}
                              className="w-10 bg-black border border-purple-500/20 rounded text-[8px] text-purple-100 text-center focus:outline-none"
                            />

                            <button
                              type="button"
                              onClick={() => {
                                const list = currentModDef.modifiers.filter((_: any, i: number) => i !== idx);
                                updateModDef(selectedModId, ['modifiers'], list);
                              }}
                              className="text-[8px] text-red-400 hover:text-red-300 px-1 ml-auto font-semibold"
                            >
                              刪除
                            </button>
                          </div>

                          {/* 部位 ID */}
                          {mod.targetType === 'body_part_stat' && (
                            <div className="flex gap-1 items-center mt-1 flex-wrap">
                              <span className="text-gray-500">影響部位:</span>
                              <select
                                value={selectPartValue}
                                onChange={e => {
                                  const val = e.target.value;
                                  const list = [...currentModDef.modifiers];
                                  if (val === 'custom') {
                                    list[idx].bodyPartId = 'custom_part';
                                  } else {
                                    list[idx].bodyPartId = val;
                                  }
                                  updateModDef(selectedModId, ['modifiers'], list);
                                }}
                                className="bg-black border border-purple-500/20 rounded px-1 text-[8px] text-purple-100 focus:outline-none"
                              >
                                <option value="slots">slots (佔用部位)</option>
                                {bodyPartKeys.map(partKey => {
                                  const label = bodyPartNames[partKey] || partKey;
                                  return (
                                    <option key={partKey} value={partKey}>
                                      {label} ({partKey})
                                    </option>
                                  );
                                })}
                                <option value="custom">⚙️ 自定義...</option>
                              </select>

                              {!isPresetPart && (
                                <input
                                  type="text"
                                  value={mod.bodyPartId || ''}
                                  onChange={e => {
                                    const list = [...currentModDef.modifiers];
                                    list[idx].bodyPartId = e.target.value;
                                    updateModDef(selectedModId, ['modifiers'], list);
                                  }}
                                  placeholder="例如 tail"
                                  className="bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-[8px] text-purple-100 flex-1 min-w-[60px] focus:outline-none"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        const list = [
                          ...(currentModDef.modifiers || []),
                          {
                            targetType: 'body_part_stat',
                            statName: 'sensitivity',
                            bodyPartId: 'slots',
                            operator: '+',
                            value: 10,
                          },
                        ];
                        updateModDef(selectedModId, ['modifiers'], list);
                      }}
                      className="text-[8px] text-purple-400 hover:text-purple-300 underline"
                    >
                      + 新增屬性影響
                    </button>
                  </div>
                </div>

                {/* 5. 新增部位加裝 */}
                <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg space-y-2">
                  <div className="text-[9px] font-bold text-purple-300 border-b border-purple-500/5 pb-1 flex justify-between items-center">
                    <span>🧬 部位加裝設定 (addedBodyPart)</span>
                    <input
                      type="checkbox"
                      checked={currentModDef.addedBodyPart !== undefined}
                      onChange={e => toggleHasAddedPart(e.target.checked)}
                      className="accent-purple-500 w-3 h-3 cursor-pointer"
                    />
                  </div>

                  {currentModDef.addedBodyPart && (
                    <div className="space-y-2 pl-1 border-l border-purple-500/10 mt-1.5 text-[8px]">
                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 w-16 shrink-0">部位唯一 ID</span>
                        <input
                          type="text"
                          value={currentModDef.addedBodyPart.id || ''}
                          onChange={e => updateModDef(selectedModId, ['addedBodyPart', 'id'], e.target.value)}
                          placeholder="例如 tail"
                          className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 w-16 shrink-0">顯示名稱</span>
                        <input
                          type="text"
                          value={currentModDef.addedBodyPart.name || ''}
                          onChange={e => updateModDef(selectedModId, ['addedBodyPart', 'name'], e.target.value)}
                          placeholder="例如 尾巴"
                          className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-gray-400 w-16 shrink-0">部位描述</span>
                        <input
                          type="text"
                          value={currentModDef.addedBodyPart.description || ''}
                          onChange={e => updateModDef(selectedModId, ['addedBodyPart', 'description'], e.target.value)}
                          className="flex-1 bg-black border border-purple-500/20 rounded px-1.5 py-0.5 text-purple-100 focus:outline-none focus:border-purple-500/50"
                        />
                      </div>

                      {/* 支援的屬性 */}
                      <div className="space-y-1 bg-black/20 p-1.5 rounded border border-purple-500/5">
                        <span className="text-gray-400 block font-semibold">功能支援:</span>
                        <div className="grid grid-cols-2 gap-1.5">
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={!!currentModDef.addedBodyPart.hasSensitivity}
                              onChange={e =>
                                updateModDef(selectedModId, ['addedBodyPart', 'hasSensitivity'], e.target.checked)
                              }
                              className="accent-purple-500 w-3.5 h-3.5"
                            />
                            敏感度
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={!!currentModDef.addedBodyPart.hasTightness}
                              onChange={e =>
                                updateModDef(selectedModId, ['addedBodyPart', 'hasTightness'], e.target.checked)
                              }
                              className="accent-purple-500 w-3.5 h-3.5"
                            />
                            鬆緊度
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={!!currentModDef.addedBodyPart.hasProficiency}
                              onChange={e =>
                                updateModDef(selectedModId, ['addedBodyPart', 'hasProficiency'], e.target.checked)
                              }
                              className="accent-purple-500 w-3.5 h-3.5"
                            />
                            熟練度
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                            <input
                              type="checkbox"
                              checked={!!currentModDef.addedBodyPart.canOrgasm}
                              onChange={e =>
                                updateModDef(selectedModId, ['addedBodyPart', 'canOrgasm'], e.target.checked)
                              }
                              className="accent-purple-500 w-3.5 h-3.5"
                            />
                            高潮次數
                          </label>
                        </div>
                      </div>

                      {/* 初始值設定 */}
                      <div className="space-y-1 bg-black/20 p-1.5 rounded border border-purple-500/5">
                        <span className="text-gray-400 block font-semibold">實體化初始數值:</span>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                          {currentModDef.addedBodyPart.hasSensitivity && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-12 truncate">初始敏感度</span>
                              <input
                                type="number"
                                value={currentModDef.addedBodyPart.initialStats?.sensitivity ?? 0}
                                onChange={e =>
                                  updateModDef(
                                    selectedModId,
                                    ['addedBodyPart', 'initialStats', 'sensitivity'],
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-center text-purple-100 focus:outline-none"
                              />
                            </div>
                          )}
                          {currentModDef.addedBodyPart.hasTightness && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-12 truncate">初始鬆緊度</span>
                              <input
                                type="number"
                                value={currentModDef.addedBodyPart.initialStats?.tightness ?? 0}
                                onChange={e =>
                                  updateModDef(
                                    selectedModId,
                                    ['addedBodyPart', 'initialStats', 'tightness'],
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-center text-purple-100 focus:outline-none"
                              />
                            </div>
                          )}
                          {currentModDef.addedBodyPart.hasProficiency && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-12 truncate">初始熟練度</span>
                              <input
                                type="number"
                                value={currentModDef.addedBodyPart.initialStats?.proficiency ?? 0}
                                onChange={e =>
                                  updateModDef(
                                    selectedModId,
                                    ['addedBodyPart', 'initialStats', 'proficiency'],
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-center text-purple-100 focus:outline-none"
                              />
                            </div>
                          )}
                          {currentModDef.addedBodyPart.canOrgasm && (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 w-12 truncate">初始高潮數</span>
                              <input
                                type="number"
                                value={currentModDef.addedBodyPart.initialStats?.orgasms ?? 0}
                                onChange={e =>
                                  updateModDef(
                                    selectedModId,
                                    ['addedBodyPart', 'initialStats', 'orgasms'],
                                    Number(e.target.value) || 0,
                                  )
                                }
                                className="w-10 bg-black border border-purple-500/20 rounded text-center text-purple-100 focus:outline-none"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-[10px] text-gray-500 italic text-center py-4">請選取一個改造項目。</div>
            )}

            <button
              onClick={flushAndSave}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95"
            >
              保存改造定義並重載
            </button>
          </div>
        );
      }

      // ==========================================
      // 子面板 D：地圖探索
      // ==========================================
      case 'mapExplore':
        return (
          <div className="space-y-3">
            {/* 傳送 */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">🚀 地點傳送</div>
              <div className="flex gap-1">
                <select
                  value={teleportTarget}
                  onChange={e => setTeleportTarget(e.target.value)}
                  className="flex-1 bg-black/40 border border-purple-500/20 rounded px-1.5 py-1 text-[9px] text-purple-100 focus:outline-none"
                >
                  <option value="">選擇目標...</option>
                  {Object.entries(allLocations).map(([id, node]) => (
                    <option key={id} value={id}>
                      {node.name} ({id})
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleTeleport}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[9px] font-bold transition-all active:scale-95"
                >
                  傳送
                </button>
              </div>
              {mapState && (
                <div className="text-[9px] text-gray-400 mt-1">
                  目前位置：
                  <span className="text-emerald-300">
                    {allLocations[mapState.currentLocationId]?.name || mapState.currentLocationId}
                  </span>
                </div>
              )}
            </div>

            {/* 探索狀態 */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">🗺️ 探索狀態</div>
              <div className="max-h-[280px] overflow-y-auto space-y-0.5 pr-1 hypno-scrollbar">
                {Object.entries(allLocations).map(([id, node]) => {
                  const isDiscovered = localDiscovered.includes(id);
                  return (
                    <div key={id} className="flex items-center gap-1.5 p-1 rounded bg-black/10">
                      <input
                        type="checkbox"
                        checked={isDiscovered}
                        onChange={() => toggleDiscovered(id)}
                        className="accent-emerald-500 w-3 h-3"
                      />
                      <span className={`text-[9px] ${isDiscovered ? 'text-gray-200' : 'text-gray-500'}`}>
                        {node.name}{' '}
                        <span className="text-gray-600">({(allZones[node.zoneId] as any)?.name || node.zoneId})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <button
              onClick={flushAndSave}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95"
            >
              保存探索狀態並重載
            </button>
          </div>
        );

      // ==========================================
      // 子面板 E：節點屏蔽與屬性
      // ==========================================
      case 'nodeEdit':
        return (
          <div className="space-y-3">
            {/* 屏蔽開關 */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">👁 節點屏蔽（含相關連線）</div>
              <div className="max-h-[200px] overflow-y-auto space-y-0.5 pr-1 hypno-scrollbar">
                {Object.entries(allLocations).map(([id, node]) => {
                  const isHidden = !!localHiddenNodes[id];
                  return (
                    <div
                      key={id}
                      className={`flex items-center gap-1.5 p-1 rounded ${isHidden ? 'bg-red-950/20 border border-red-500/20' : 'bg-black/10'}`}
                    >
                      <input
                        type="checkbox"
                        checked={isHidden}
                        onChange={() => toggleNodeHidden(id)}
                        className="accent-red-500 w-3 h-3"
                      />
                      <span className={`text-[9px] ${isHidden ? 'text-red-300 line-through' : 'text-gray-200'}`}>
                        {node.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 屬性修改 */}
            <div className="p-2 bg-purple-950/10 border border-purple-500/10 rounded-lg">
              <div className="text-[10px] font-bold text-purple-300 mb-1.5">✏️ 節點屬性修改</div>
              <select
                value={editNodeId}
                onChange={e => {
                  setEditNodeId(e.target.value);
                  const n = allLocations[e.target.value];
                  setEditNodeName(n?.name || '');
                  setEditNodeDesc(n?.description || '');
                }}
                className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[9px] text-purple-100 focus:outline-none mb-1"
              >
                <option value="">選擇節點...</option>
                {Object.entries(allLocations).map(([id, node]) => (
                  <option key={id} value={id}>
                    {node.name}
                  </option>
                ))}
              </select>
              {editNodeId && (
                <div className="space-y-1">
                  <input
                    type="text"
                    value={editNodeName}
                    onChange={e => setEditNodeName(e.target.value)}
                    placeholder="節點名稱"
                    className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[9px] text-purple-100 focus:outline-none"
                  />
                  <textarea
                    value={editNodeDesc}
                    onChange={e => setEditNodeDesc(e.target.value)}
                    placeholder="節點描述"
                    rows={3}
                    className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[9px] text-purple-100 focus:outline-none resize-none"
                  />
                </div>
              )}
            </div>

            <button
              onClick={editNodeId ? applyNodeEdit : flushAndSave}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95"
            >
              {editNodeId ? '保存屬性修改並重載' : '保存屏蔽設定並重載'}
            </button>
          </div>
        );

      // ==========================================
      // 子面板 F：通路連線設定
      // ==========================================
      case 'edgeEdit': {
        const zoneEdges = localEdges.filter(e => e.zoneId === selectedZoneFilter);
        return (
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-purple-300 mb-1">🔗 通路連線設定</div>
            <select
              value={selectedZoneFilter}
              onChange={e => setSelectedZoneFilter(e.target.value)}
              className="w-full bg-black/40 border border-purple-500/20 rounded px-2 py-1 text-[9px] text-purple-100 focus:outline-none"
            >
              {Object.entries(allZones).map(([id, zone]) => (
                <option key={id} value={id}>
                  {(zone as any).name}
                </option>
              ))}
            </select>
            <div className="max-h-[360px] overflow-y-auto space-y-1 pr-1 hypno-scrollbar">
              {zoneEdges.map(edge => {
                const fromName = allLocations[edge.StartNodeId]?.name || edge.StartNodeId;
                const toName = allLocations[edge.EndNodeId]?.name || edge.EndNodeId;
                const isExpanded = expandedEdge === edge.id;
                return (
                  <div key={edge.id} className="border border-purple-500/10 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedEdge(isExpanded ? '' : edge.id)}
                      className="w-full flex items-center gap-1.5 p-1.5 bg-purple-950/10 hover:bg-purple-950/20 transition-colors text-left"
                    >
                      <ChevronRight
                        size={10}
                        className={`text-purple-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                      <span className="text-[9px] text-gray-200 flex-1">
                        {fromName} <span className="text-purple-400">➔</span> {toName}
                      </span>
                      <span className="text-[8px] text-gray-500">{edge.id}</span>
                    </button>
                    {isExpanded && (
                      <div className="p-1.5 space-y-1.5">
                        {renderPathEditor(edge.id, 'forward', edge.forwardPath, `正向：${fromName} ➔ ${toName}`)}
                        {renderPathEditor(edge.id, 'reverse', edge.ReversePath, `反向：${toName} ➔ ${fromName}`)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              onClick={flushAndSave}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95"
            >
              保存通路修改並重載
            </button>
          </div>
        );
      }

      default:
        return null;
    }
  };

  // ==========================================
  // UI 渲染與元件結構
  // ==========================================
  return (
    <>
      {/* 懸浮調試按鈕 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-4 right-4 z-[9999] flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-900/80 hover:bg-purple-800 text-purple-100 rounded-full shadow-lg border border-purple-500/30 backdrop-blur-md transition-all active:scale-95 group"
        title="開啟 Debug 控制台"
      >
        <Terminal size={16} className="group-hover:rotate-12 transition-transform duration-300" />
        <span className="text-xs font-semibold tracking-wider">DEBUG</span>
      </button>

      {/* 控制面板 */}
      {isOpen && (
        <div
          className="fixed z-[9998] bg-[#0c091d]/95 border border-purple-500/30 rounded-2xl shadow-2xl backdrop-blur-lg flex flex-col overflow-hidden text-gray-200 font-sans"
          style={
            panelPos
              ? { left: panelPos.x, top: panelPos.y, width: panelSize.width, height: panelSize.height }
              : { right: 16, bottom: 64, width: panelSize.width, height: panelSize.height }
          }
        >
          {/* 面板標題列 (拖曳手把) */}
          <div
            className="shrink-0 p-4 border-b border-purple-500/20 bg-purple-950/40 flex justify-between items-center select-none"
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
          >
            <div className="flex items-center gap-2">
              <Database className="text-purple-400" size={18} />
              <span className="font-bold tracking-wide bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                HypnoOS 調試控制台
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* 分頁選擇列 */}
          <div className="shrink-0 flex border-b border-purple-500/10 bg-black/30 p-1">
            {(['tavern', 'mockMvu', 'mockChat', 'actions'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === tab
                    ? 'bg-purple-950/50 text-purple-200 border border-purple-500/20 shadow-[0_0_10px_rgba(168,85,247,0.15)]'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                {tab === 'tavern'
                  ? '真實 Tavern'
                  : tab === 'mockMvu'
                    ? '模擬 Mvu'
                    : tab === 'mockChat'
                      ? '模擬 Chat'
                      : '快捷動作'}
              </button>
            ))}
          </div>

          {/* 訊息狀態列 */}
          {successMsg && (
            <div className="shrink-0 px-4 py-2 bg-emerald-950/80 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check size={14} className="animate-bounce" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* 分頁內容 */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#0a0717]/50 font-mono text-xs">
            {/* Tab: 真實 Tavern */}
            {activeTab === 'tavern' && (
              <div className="space-y-4 h-full flex flex-col">
                <div className="p-3 bg-purple-950/20 border border-purple-500/10 rounded-xl flex items-center gap-3">
                  <Cpu className="text-purple-400" size={20} />
                  <div>
                    <h4 className="font-bold text-gray-200 text-sm">Tavern 執行環境檢測</h4>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {tavernMvu || tavernChat
                        ? '🟢 已成功對接酒館宿主變數介面'
                        : '⚪ 未偵測到 Tavern 環境（目前運行於純模擬模式）'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-3 min-h-0">
                  <div className="flex-1 flex flex-col min-h-0">
                    <span className="text-[10px] text-purple-400 font-bold mb-1 uppercase tracking-wider">
                      Real Mvu State:
                    </span>
                    <pre className="flex-1 bg-black/40 border border-purple-500/10 p-3 rounded-lg overflow-auto text-[10px] text-gray-300">
                      {tavernMvu ? JSON.stringify(tavernMvu, null, 2) : 'No Mvu Defined (globalThis.Mvu is undefined)'}
                    </pre>
                  </div>

                  <div className="flex-1 flex flex-col min-h-0">
                    <span className="text-[10px] text-purple-400 font-bold mb-1 uppercase tracking-wider">
                      Real Chat Variables:
                    </span>
                    <pre className="flex-1 bg-black/40 border border-purple-500/10 p-3 rounded-lg overflow-auto text-[10px] text-gray-300">
                      {tavernChat ? JSON.stringify(tavernChat, null, 2) : 'No Chat Variables Defined'}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: 模擬 Mvu */}
            {activeTab === 'mockMvu' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    編輯 mockMvuVariables (JSON)
                  </span>
                  <button
                    onClick={handleApplyMvu}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold transition-colors active:scale-95"
                  >
                    套用並重新載入
                  </button>
                </div>
                <textarea
                  value={mvuText}
                  onChange={e => setMvuText(e.target.value)}
                  className="flex-1 w-full bg-black/60 border border-purple-500/20 rounded-xl p-3 focus:outline-none focus:border-purple-500/50 resize-none font-mono text-[10px] text-purple-100"
                  spellCheck={false}
                />
                {mvuError && (
                  <div className="p-2.5 bg-red-950/80 border border-red-500/30 rounded-lg text-red-300 text-[10px] flex items-center gap-1.5">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span className="break-all">{mvuError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 模擬 Chat */}
            {activeTab === 'mockChat' && (
              <div className="h-full flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                    編輯 mockChatVariables (JSON)
                  </span>
                  <button
                    onClick={handleApplyChat}
                    className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-semibold transition-colors active:scale-95"
                  >
                    套用並重新載入
                  </button>
                </div>
                <textarea
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  className="flex-1 w-full bg-black/60 border border-purple-500/20 rounded-xl p-3 focus:outline-none focus:border-purple-500/50 resize-none font-mono text-[10px] text-purple-100"
                  spellCheck={false}
                />
                {chatError && (
                  <div className="p-2.5 bg-red-950/80 border border-red-500/30 rounded-lg text-red-300 text-[10px] flex items-center gap-1.5">
                    <ShieldAlert size={14} className="shrink-0" />
                    <span className="break-all">{chatError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Tab: 快捷動作 */}
            {activeTab === 'actions' && (
              <div className="flex gap-2 h-full">
                {/* 左側次選單 */}
                <div className="w-20 shrink-0 space-y-0.5">
                  {SUB_PANEL_CONFIG.map(sp => (
                    <button
                      key={sp.key}
                      onClick={() => setActionSubPanel(sp.key)}
                      className={`w-full flex items-center gap-1 px-1.5 py-1.5 rounded-lg text-[9px] font-semibold transition-all ${
                        actionSubPanel === sp.key
                          ? 'bg-purple-950/50 text-purple-200 border border-purple-500/20'
                          : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                      }`}
                    >
                      {sp.icon}
                      <span className="truncate">{sp.label}</span>
                    </button>
                  ))}

                  {/* 危險操作 */}
                  <div className="border-t border-red-500/10 pt-1 mt-2">
                    <button
                      onClick={handleResetAll}
                      className="w-full py-1.5 bg-red-950/30 hover:bg-red-900/40 border border-red-500/20 text-red-300 rounded-lg text-[8px] font-bold transition-all active:scale-95"
                    >
                      🔄 重置全部
                    </button>
                  </div>
                </div>

                {/* 右側內容 */}
                <div className="flex-1 overflow-y-auto hypno-scrollbar">{renderActionSubPanel()}</div>
              </div>
            )}
          </div>

          {/* 底部狀態列 */}
          <div className="shrink-0 p-3 bg-black/40 border-t border-purple-500/10 text-gray-500 text-[9px] flex justify-between items-center">
            <span>Powered by Antigravity Debugger</span>
            <span>V2.0.0</span>
          </div>

          {/* Resize 手把 */}
          <div
            onMouseDown={handleResizeStart}
            className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize flex items-end justify-end p-0.5 z-[9999]"
            title="調整大小"
          >
            <svg
              width="8"
              height="8"
              viewBox="0 0 8 8"
              className="text-gray-400 fill-current opacity-60 hover:opacity-100 transition-opacity"
            >
              <path d="M6 0 L8 0 L8 8 L0 8 L0 6 L6 6 Z" />
            </svg>
          </div>
        </div>
      )}
    </>
  );
};
