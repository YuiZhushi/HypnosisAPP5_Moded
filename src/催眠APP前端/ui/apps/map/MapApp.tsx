import React, { useState, useEffect, useRef } from 'react';
import {
  Compass,
  Lock,
  MapPin,
  User,
  ZoomIn,
  ZoomOut,
  Save,
  Edit2,
  X,
  ArrowLeft,
  Navigation,
  Key,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { MockLocationNode as LocationNode, MockMapEdge as MapEdge, MockMapState as MapState } from '../../../models';
import { MockApi, MockApi as MockMapApi } from '../../../shared/api/mockApi';
import { logger } from '../../../../催眠APP共用/debug/loggerService';

interface MapAppProps {
  onBack: () => void;
}

interface Position {
  x: number;
  y: number;
}

const computeDeterministicLayout = (
  nodes: LocationNode[],
  edges: MapEdge[],
  width: number = 420,
  height: number = 600,
): Record<string, Position> => {
  const positions: Record<string, Position> = {};
  if (nodes.length === 0) return positions;

  // 1. 計算度數，選擇度數最大的為 Root
  const degrees: Record<string, number> = {};
  nodes.forEach(n => (degrees[n.id] = 0));
  edges.forEach(e => {
    if (degrees[e.StartNodeId] !== undefined) degrees[e.StartNodeId]++;
    if (degrees[e.EndNodeId] !== undefined) degrees[e.EndNodeId]++;
  });

  // 按度數遞減、ID 字母排序，選取第一個
  const sortedNodes = [...nodes].sort((a, b) => {
    const degA = degrees[a.id] || 0;
    const degB = degrees[b.id] || 0;
    if (degB !== degA) return degB - degA;
    return a.id.localeCompare(b.id);
  });
  const rootId = sortedNodes[0].id;

  // 2. BFS 遍歷分層與父節點記錄
  const visited = new Set<string>([rootId]);
  const queue: string[] = [rootId];
  const parentMap: Record<string, string> = {};
  const layers: Record<string, number> = { [rootId]: 0 };
  const adjList: Record<string, string[]> = {};

  nodes.forEach(n => (adjList[n.id] = []));
  edges.forEach(e => {
    if (adjList[e.StartNodeId] && adjList[e.EndNodeId]) {
      adjList[e.StartNodeId].push(e.EndNodeId);
      adjList[e.EndNodeId].push(e.StartNodeId);
    }
  });

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const currLayer = layers[curr];
    const sortedNeighbors = (adjList[curr] || []).sort((a, b) => a.localeCompare(b));

    sortedNeighbors.forEach(nbr => {
      if (!visited.has(nbr)) {
        visited.add(nbr);
        parentMap[nbr] = curr;
        layers[nbr] = currLayer + 1;
        queue.push(nbr);
      }
    });
  }

  // 3. 將節點歸類到各層級陣列
  const maxLayer = Math.max(...Object.values(layers));
  const layerGroups: string[][] = Array.from({ length: maxLayer + 1 }, () => []);
  nodes.forEach(node => {
    const l = layers[node.id];
    if (l !== undefined) {
      layerGroups[l].push(node.id);
    }
  });

  // 4. 重心 Heuristic 排序 (Barycenter crossing minimization)
  const layerOrder: Record<string, number> = {}; // 記錄節點在其層級中的最終 Y 排序索引

  // Root (Layer 0) 順序固定為 0
  if (layerGroups[0] && layerGroups[0].length > 0) {
    layerGroups[0].forEach((id, idx) => {
      layerOrder[id] = idx;
    });
  }

  // 從 Layer 1 開始向下計算重心並排序
  for (let l = 1; l <= maxLayer; l++) {
    const currNodes = layerGroups[l] || [];

    const barycenters = currNodes.map(nodeId => {
      // 找出與上一層 (l-1) 連接的鄰居
      const upperNeighbors = (adjList[nodeId] || []).filter(nbrId => layers[nbrId] === l - 1);
      if (upperNeighbors.length === 0) {
        // 若無上層連線，承接父節點的順序
        const parent = parentMap[nodeId];
        return parent ? (layerOrder[parent] ?? 0) : 0;
      }
      const sum = upperNeighbors.reduce((acc, nbrId) => acc + (layerOrder[nbrId] ?? 0), 0);
      return sum / upperNeighbors.length;
    });

    // 依據重心排序（重心相同時以 ID 字母排序保證確定性）
    const sorted = currNodes
      .map((id, idx) => ({ id, val: barycenters[idx] }))
      .sort((a, b) => {
        if (a.val !== b.val) return a.val - b.val;
        return a.id.localeCompare(b.id);
      })
      .map(item => item.id);

    // 寫入最終順序
    sorted.forEach((id, idx) => {
      layerOrder[id] = idx;
    });
    layerGroups[l] = sorted;
  }

  // 5. 坐標映射 (由左至右的層次網格)
  const paddingX = 45;
  const paddingY = 50;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingY * 2;

  // 限制 X 軸最大層級間距為 100px，並居中
  const layerWidth = maxLayer > 0 ? Math.min(100, usableWidth / maxLayer) : 60;
  const totalMapWidth = maxLayer * layerWidth;
  const startX = paddingX + (usableWidth - totalMapWidth) / 2;

  for (let l = 0; l <= maxLayer; l++) {
    const layerNodes = layerGroups[l] || [];
    const k = layerNodes.length;

    // 限制 Y 軸最大節點間距為 80px
    const layerHeightStep = k > 1 ? Math.min(80, usableHeight / (k - 1)) : 80;
    const totalLayerHeight = k > 1 ? (k - 1) * layerHeightStep : 0;
    // 計算該層 Y 軸起始位置以居中對齊
    const startY = paddingY + (usableHeight - totalLayerHeight) / 2;

    layerNodes.forEach((nodeId, idx) => {
      let xPos = startX + l * layerWidth;
      let yPos = k > 1 ? startY + idx * layerHeightStep : startY; // 若該層只有一個點，直接取置中點

      // 加入 Stagger 起伏美化與防線路重合
      if (l % 2 !== 0) {
        yPos += 15; // 奇數層微調下移
      } else {
        yPos -= 15; // 偶數層微調上移
      }

      if (idx % 2 !== 0) {
        xPos += 8; // 奇數 index 節點微調右移
      }

      // 防禦性限制邊界
      positions[nodeId] = {
        x: Math.max(30, Math.min(width - 30, xPos)),
        y: Math.max(40, Math.min(height - 40, yPos)),
      };
    });
  }

  return positions;
};

export const MapApp: React.FC<MapAppProps> = ({ onBack }) => {
  // ====== 佈局設定 ======
  // 由於本系統已被限制在 420px 的手機框 (Phone Bezel) 內渲染，一律採用手機端單欄佈局以獲得最佳體驗。

  // ====== 地圖與物品動態資料庫 State ======
  const [locations, setLocations] = useState<Record<string, LocationNode>>({});
  const [mapEdges, setMapEdges] = useState<MapEdge[]>([]);
  const [zones, setZones] = useState<Record<string, any>>({});
  const [itemsDict, setItemsDict] = useState<Record<string, any>>({});
  const [mapDataLoading, setMapDataLoading] = useState<boolean>(true);

  const loadMapData = async () => {
    try {
      const [locsData, edgesData, zonesData, itemsData] = await Promise.all([
        MockMapApi.getMapLocations(),
        MockMapApi.getMapEdges(),
        MockMapApi.getMapZones(),
        MockMapApi.getAllItems(),
      ]);
      setLocations(locsData);
      setMapEdges(edgesData);
      setZones(zonesData);
      setItemsDict(itemsData);
    } catch (err) {
      logger.warn('讀取地圖資料與道具字典失敗', err);
    }
  };

  // ====== 核心狀態 ======
  const [mapState, setMapState] = useState<MapState>({
    currentLocationId: 'home_my_room',
    discoveredNodeIds: [],
  });
  const [currentZoneId, setCurrentZoneId] = useState<string>('home_zone');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [shortestPath, setShortestPath] = useState<string[]>([]);
  const [showFullDrawer, setShowFullDrawer] = useState<boolean>(false);
  const [activeLockDetail, setActiveLockDetail] = useState<{
    edgeId: string;
    isForward: boolean;
    title: string;
    description: string;
    isEligible: boolean;
  } | null>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});

  // ====== 頂部欄資源與時間 ======
  const [timeText, setTimeText] = useState<string>('12:00');
  const [mcEnergy, setMcEnergy] = useState<number>(25);
  const [mcEnergyMax, setMcEnergyMax] = useState<number>(25);
  const [mcPoints, setMcPoints] = useState<number>(25);
  const [money, setMoney] = useState<number>(5000);

  // ====== 遊戲環境與時間詳細狀態 (避免直接引用全域後端變數) ======
  const [charsData, setCharsData] = useState<Record<string, any>>({});
  const [currentDateTimeStr, setCurrentDateTimeStr] = useState<string>('2026-05-01 11:28:00');

  // ====== 畫布縮放與平移 ======
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.0);
  const canvasRef = useRef<SVGSVGElement | null>(null);

  // ====== 互動與特效 ======
  const [scanning, setScanning] = useState(false);
  const [scanLaserPos, setScanLaserPos] = useState(-20);
  const [notification, setNotification] = useState<{ type: 'radar' | 'move' | 'unlock'; content: string } | null>(null);
  const [showGpsTip, setShowGpsTip] = useState(false);

  // ====== 編輯描述 ======
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [tempDesc, setTempDesc] = useState('');

  // ====== 測試輔助 (物品背包載入與動態修改) ======
  const [userInventory, setUserInventory] = useState<Record<string, any>>({});

  // ==========================================
  // 資源與時間加載邏輯
  // ==========================================
  const loadPlayerResources = async () => {
    try {
      const [system, user, chars] = await Promise.all([
        MockMapApi.getSystemData(),
        MockMapApi.getUserInfo(),
        MockMapApi.getCharData(),
      ]);
      if (system.time) {
        setCurrentDateTimeStr(system.time);
        const dateObj = new Date(system.time);
        const timeString = dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
        setTimeText(timeString);
      }
      setMcEnergy(user.mcEnergy);
      setMcEnergyMax(user.mcEnergyMax);
      setMcPoints(user.mcPoints);
      setMoney(user.money);
      setCharsData(chars || {});
    } catch (err) {
      logger.warn('讀取系統與角色變數失敗', err);
    }
  };

  useEffect(() => {
    const loadInventory = async () => {
      const inv = await MockApi.getUserInventory();
      setUserInventory(inv);
    };
    loadInventory();
  }, [mapState.currentLocationId]);

  const toggleMockItem = async (itemName: string) => {
    // 根據物品名稱找對應的 ID
    const itemId = Object.keys(itemsDict).find(key => itemsDict[key].name === itemName) || itemName;
    const hasItem = userInventory[itemId] && userInventory[itemId].quantity > 0;

    // 如果持有則扣除 (設為 0)，未持有則加 1
    await MockApi.updateUserInventoryItem(itemId, hasItem ? -userInventory[itemId].quantity : 1);

    const newInv = await MockApi.getUserInventory();
    setUserInventory(newInv);

    // 修改道具後，可能影響通路狀態，更新地圖資料
    await loadMapData();
  };

  // ====== 輔助取得目前環境中可用於判斷的變數 ======
  const getEnvVariablesHelper = (inv: Record<string, any>) => {
    // 搜集背包中持有的物品 ID 與物品名稱
    const items: string[] = [];
    Object.entries(inv).forEach(([itemId, state]) => {
      if (state && state.quantity > 0) {
        items.push(itemId);
        const def = itemsDict[itemId];
        if (def) {
          items.push(def.name);
        }
      }
    });

    const npcObedience: Record<string, number> = {};
    if (charsData) {
      Object.keys(charsData).forEach(name => {
        const char = charsData[name];
        if (char && char.obedience !== undefined) {
          npcObedience[name] = Number(char.obedience);
        }
      });
    }

    return { items, npcObedience };
  };

  const checkTimeRange = (currentMinutes: number, rangeStr: string): boolean => {
    const [startStr, endStr] = rangeStr.split('-');
    if (!startStr || !endStr) return false;
    const toMinutes = (tStr: string) => {
      const [h, m] = tStr.trim().split(':').map(Number);
      return h * 60 + m;
    };
    const start = toMinutes(startStr);
    const end = toMinutes(endStr);
    if (start <= end) {
      return currentMinutes >= start && currentMinutes <= end;
    } else {
      return currentMinutes >= start || currentMinutes <= end;
    }
  };

  const checkWeekMatch = (currentDayOfWeek: number, weekPart: string): boolean => {
    if (weekPart.includes('-')) {
      const [startW, endW] = weekPart.split('-').map(Number);
      return currentDayOfWeek >= startW && currentDayOfWeek <= endW;
    } else if (weekPart.includes(',')) {
      const weeks = weekPart.split(',').map(Number);
      return weeks.includes(currentDayOfWeek);
    } else {
      return Number(weekPart) === currentDayOfWeek;
    }
  };

  const checkMonthMatch = (currentDayOfMonth: number, monthPart: string): boolean => {
    if (monthPart.includes('-')) {
      const [startM, endM] = monthPart.split('-').map(Number);
      return currentDayOfMonth >= startM && currentDayOfMonth <= endM;
    } else if (monthPart.includes(',')) {
      const days = monthPart.split(',').map(Number);
      return days.includes(currentDayOfMonth);
    } else {
      return Number(monthPart) === currentDayOfMonth;
    }
  };

  const checkDateRange = (currentDateObj: Date, dateRangeStr: string): boolean => {
    const parts = dateRangeStr.split(' - ');
    if (parts.length !== 2) return false;
    const startStr = parts[0].replace('T', ' ');
    const endStr = parts[1].replace('T', ' ');
    const currentMs = currentDateObj.getTime();
    const startMs = new Date(startStr.replace(/-/g, '/')).getTime();
    const endMs = new Date(endStr.replace(/-/g, '/')).getTime();
    if (isNaN(currentMs) || isNaN(startMs) || isNaN(endMs)) return false;
    return currentMs >= startMs && currentMs <= endMs;
  };

  const isTimeInPeriod = (currentDateTimeStr: string, periodString: string): boolean => {
    try {
      const rules = JSON.parse(periodString);
      if (!Array.isArray(rules)) return false;

      let currentMinutes = 12 * 60; // 預設 12:00
      let currentDayOfWeek = 5; // 預設週五 (2026-05-01 是週五)
      let currentDayOfMonth = 1; // 預設 1 日
      let currentDateObj = new Date();

      // 1. 強健的日期解析器 (防禦空格與簡繁體格式)
      const dateMatch = currentDateTimeStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (dateMatch) {
        const year = Number(dateMatch[1]);
        const month = Number(dateMatch[2]) - 1;
        const date = Number(dateMatch[3]);
        const dateObj = new Date(year, month, date);
        if (!isNaN(dateObj.getTime())) {
          currentDateObj = dateObj;
          const rawDay = dateObj.getDay();
          currentDayOfWeek = rawDay === 0 ? 7 : rawDay;
          currentDayOfMonth = dateObj.getDate();
        }
      }

      // 2. 強健的時間解析器 (支援 12/24 小時制自動換算)
      const timeMatch = currentDateTimeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (timeMatch) {
        let h = Number(timeMatch[1]);
        const m = Number(timeMatch[2]);

        const isPm = currentDateTimeStr.includes('下午') || currentDateTimeStr.toUpperCase().includes('PM');
        const isAm = currentDateTimeStr.includes('上午') || currentDateTimeStr.toUpperCase().includes('AM');

        if (isPm || isAm) {
          if (isPm) {
            if (h !== 12) h += 12;
          } else {
            if (h === 12) h = 0;
          }
        }
        currentMinutes = h * 60 + m;
      }

      const matchedResults: boolean[] = [];

      for (const rule of rules) {
        let matched = false;

        if (rule.type === 'daily') {
          matched = checkTimeRange(currentMinutes, rule.range);
        } else if (rule.type === 'weekly') {
          const parts = rule.range.split(/\s+/);
          const weekPart = parts[0];
          const timePart = parts[1];
          if (checkWeekMatch(currentDayOfWeek, weekPart)) {
            matched = checkTimeRange(currentMinutes, timePart);
          }
        } else if (rule.type === 'monthly') {
          const parts = rule.range.split(/\s+/);
          const monthPart = parts[0];
          const timePart = parts[1];
          if (checkMonthMatch(currentDayOfMonth, monthPart)) {
            matched = checkTimeRange(currentMinutes, timePart);
          }
        } else if (rule.type === 'date') {
          matched = checkDateRange(currentDateObj, rule.range);
        }

        if (matched) {
          matchedResults.push(rule.passable);
        }
      }

      if (matchedResults.length > 0) {
        // 當範圍有衝突時，以 true (可通行) 優先
        return matchedResults.includes(true);
      } else {
        // 智能預設狀態推導：當前時間未落在任何一項規則區間內
        // 若規則中包含任何「允許通行 (passable: true)」，說明是限時開放，其他時間預設禁止通行
        const hasAnyOpen = rules.some(r => r.passable === true);
        return !hasAnyOpen;
      }
    } catch (e) {
      return false;
    }
  };

  // ==========================================
  // 物品數量獲取輔助函數 (僅限 ID 索引)
  // ==========================================
  const getItemQuantity = (itemId: string, inv: Record<string, any>) => {
    if (inv && inv[itemId]) {
      return inv[itemId].quantity || 0;
    }
    return 0;
  };

  // ==========================================
  // 通路開放狀態檢測 (支援多物品、多角色條件)
  // ==========================================
  const checkEdgeOpen = (pathInfo: any, targetNodeId: string) => {
    void targetNodeId;
    if (!pathInfo) return false;
    if (pathInfo.status === 'open') return true;
    if (pathInfo.status === 'temp_open') {
      const cond = pathInfo.tempConditon;
      if (!cond) return true;

      if (cond.type === 'item') {
        if (!cond.targetName) return false;
        // 解析多物品條件
        const conditions = cond.targetName.split(',').map((part: string) => {
          const segs = part
            .trim()
            .split(':')
            .map(s => s.trim());
          if (segs.length === 3) return { itemId: segs[0], op: segs[1], qty: Number(segs[2]) };
          if (segs.length === 2) return { itemId: segs[0], op: '>=', qty: Number(segs[1]) };
          return { itemId: segs[0], op: '>=', qty: 1 };
        });
        const res = conditions.every((ic: { itemId: string; op: string; qty: number }) => {
          const held = getItemQuantity(ic.itemId, userInventory);
          let passed = false;
          switch (ic.op) {
            case '>=':
              passed = held >= ic.qty;
              break;
            case '<=':
              passed = held <= ic.qty;
              break;
            case '==':
              passed = held === ic.qty;
              break;
            case '!=':
              passed = held !== ic.qty;
              break;
            case '>':
              passed = held > ic.qty;
              break;
            case '<':
              passed = held < ic.qty;
              break;
            default:
              passed = held >= ic.qty;
          }
          return passed;
        });
        return res;
      }

      if (cond.type === 'character') {
        if (!cond.targetName) return false;
        // 解析多 NPC 條件
        const npcConditions = cond.targetName.split(',').map((part: string) => {
          const segs = part
            .trim()
            .split(':')
            .map(s => s.trim());
          if (segs.length === 4) return { npcName: segs[0], attr: segs[1], op: segs[2], val: Number(segs[3]) };
          if (segs.length === 2) return { npcName: segs[0], attr: 'obedience', op: '>=', val: Number(segs[1]) };
          return { npcName: segs[0], attr: 'obedience', op: '>=', val: 0 };
        });
        const res = npcConditions.every((nc: { npcName: string; attr: string; val: number; op: string }) => {
          const charData = charsData[nc.npcName] as any;
          if (!charData) {
            return false;
          }

          // 完美移植後端安全屬性解析器
          let actual = 0;
          if (charData[nc.attr] !== undefined) {
            actual = Number(charData[nc.attr]) || 0;
          } else if (charData.bodyParts) {
            const bp = charData.bodyParts;
            const attr = nc.attr;
            if (attr === 'totalSensitivity') {
              for (const k in bp) actual += bp[k]?.sensitivity ?? 0;
            } else if (attr === 'totalOrgasms') {
              for (const k in bp) actual += bp[k]?.orgasms ?? 0;
            } else if (attr.endsWith('Sensitivity')) {
              actual = bp[attr.slice(0, -11)]?.sensitivity ?? 0;
            } else if (attr.endsWith('Tightness')) {
              actual = bp[attr.slice(0, -9)]?.tightness ?? 0;
            } else if (attr.endsWith('Proficiency')) {
              actual = bp[attr.slice(0, -11)]?.proficiency ?? 0;
            } else if (attr.endsWith('Orgasms')) {
              actual = bp[attr.slice(0, -7)]?.orgasms ?? 0;
            }
          }

          let passed = false;
          switch (nc.op) {
            case '>=':
              passed = actual >= nc.val;
              break;
            case '<=':
              passed = actual <= nc.val;
              break;
            case '==':
              passed = actual === nc.val;
              break;
            case '!=':
              passed = actual !== nc.val;
              break;
            case '>':
              passed = actual > nc.val;
              break;
            case '<':
              passed = actual < nc.val;
              break;
            default:
              passed = actual >= nc.val;
          }
          return passed;
        });
        return res;
      }

      if (cond.type === 'time') {
        return cond.targetName ? isTimeInPeriod(currentDateTimeStr, cond.targetName) : false;
      }
    }
    return false;
  };

  // ====== 初始化載入 ======
  useEffect(() => {
    const init = async () => {
      setMapDataLoading(true);
      try {
        // 1. 載入地圖動態/模擬資料
        const [locsData, edgesData, zonesData, itemsData] = await Promise.all([
          MockMapApi.getMapLocations(),
          MockMapApi.getMapEdges(),
          MockMapApi.getMapZones(),
          MockMapApi.getAllItems(),
        ]);
        setLocations(locsData);
        setMapEdges(edgesData);
        setZones(zonesData);
        setItemsDict(itemsData);

        // 2. 獲取地圖狀態
        const state = await MockMapApi.getMapState();
        setMapState(state);

        // 3. 依據當前地點設定初始大區域
        const currentNode = locsData[state.currentLocationId];
        if (currentNode) {
          setCurrentZoneId(currentNode.zoneId);
        }

        // 4. 獲取系統資源與時間
        await loadPlayerResources();
      } catch (err) {
        logger.warn('地圖初始化資料載入失敗', err);
      } finally {
        setMapDataLoading(false);
      }

      // 5. 開啟時自動執行有動畫的雷達掃描 (延遲 200ms 等地圖與 SVG 容器掛載完成)
      setTimeout(() => {
        void handleRadarScan(true);
      }, 200);
    };
    void init();
  }, []);

  // ====== 自動計算節點位置 (過濾屏蔽節點) ======
  useEffect(() => {
    if (Object.keys(locations).length === 0) return;
    const zoneNodes = Object.values(locations).filter(n => n.zoneId === currentZoneId && !(n as any)._hidden);
    const zoneEdges = mapEdges.filter(
      e =>
        e.zoneId === currentZoneId &&
        !(locations[e.StartNodeId] as any)?._hidden &&
        !(locations[e.EndNodeId] as any)?._hidden,
    );
    const layout = computeDeterministicLayout(zoneNodes, zoneEdges);
    setNodePositions(layout);
  }, [currentZoneId, mapState.currentLocationId, locations, mapEdges]);

  // ====== 選中節點時計算高亮最短路徑 ======
  useEffect(() => {
    if (selectedNodeId && selectedNodeId !== mapState.currentLocationId) {
      const env = getEnvVariablesHelper(userInventory);
      const path = MockMapApi.findShortestPath(
        mapState.currentLocationId,
        selectedNodeId,
        mapState.discoveredNodeIds,
        env.items,
      );
      setShortestPath(path);
    } else {
      setShortestPath([]);
    }
  }, [selectedNodeId, mapState.currentLocationId, mapState.discoveredNodeIds, userInventory]);

  // ====== 取得目前環境中可用於判斷的變數 ======
  const getEnvVariables = async () => {
    return getEnvVariablesHelper(userInventory);
  };

  // ====== 行動：移動至目標地點 ======
  const handleMove = async (targetId: string) => {
    const targetNode = locations[targetId];
    if (!targetNode) return;

    // 取得只到 targetId 為止的子路徑
    const idx = shortestPath.indexOf(targetId);
    const actualPath = idx !== -1 ? shortestPath.slice(0, idx + 1) : shortestPath;

    // 獲取當前道具與服從度
    const { items, npcObedience } = await getEnvVariables();

    // 呼叫實體移動 API
    const res = await MockMapApi.moveToLocation(targetId, items, npcObedience);
    if (res.success) {
      setMapState(res.nextState);
      setSelectedNodeId(targetId);
      await loadPlayerResources();
      // 同步地圖狀態，可能通路有變化
      await loadMapData();

      const pathNames = actualPath.map(id => locations[id]?.name ?? id).join(' -> ');
      const msg = `已抵達「${targetNode.name}」\n(途經：${pathNames}，耗時 ${res.timeCost} 分鐘，消耗 MC 能量 ${res.energyCost} 點)`;
      setNotification({ type: 'move', content: msg });
    } else {
      setNotification({ type: 'move', content: `移動失敗：${res.errorMsg || '未知錯誤'}` });
    }
    setTimeout(() => setNotification(null), 5000);
  };

  // ====== 行動：雷達掃描解鎖 ======
  const handleRadarScan = async (isAuto = false) => {
    if (scanning) return;
    setScanning(true);
    setNotification(null);

    // 雷射動畫啟動
    let pos = -10;
    const animTimer = setInterval(() => {
      pos += 4;
      setScanLaserPos(pos);
      if (pos >= 110) {
        clearInterval(animTimer);
      }
    }, 60);

    // 獲取當前道具與服從度
    const { items, npcObedience } = await getEnvVariables();

    setTimeout(async () => {
      const res = await MockMapApi.scanForLocations(items, npcObedience);
      setScanning(false);
      setMapState(res.nextState);
      await loadPlayerResources();
      // 同步地圖狀態，解鎖新地點
      await loadMapData();

      if (res.unlockedNodeIds.length > 0) {
        setNotification({ type: 'radar', content: res.messages.join('\n') });
      } else {
        // 如果是手動觸發，才彈出無新發現提示；或者如果雖然是自動，但有隱藏點解鎖失敗，才彈出提示
        if (!isAuto) {
          const failedMsg = res.messages.filter(m => m.includes('解鎖失敗'));
          if (failedMsg.length > 0) {
            setNotification({ type: 'radar', content: failedMsg.join('\n') });
          } else {
            setNotification({ type: 'radar', content: '雷達掃描完成：未偵測到鄰近有新的可探索空間。' });
          }
        }
        logger.info('雷達掃描完成：', res);
      }

      // 5 秒後自動隱藏提示
      setTimeout(() => setNotification(null), 5000);
    }, 2000);
  };

  // ====== 行動：GPS定位 (重置視角居中) ======
  const handleLocateCurrent = () => {
    const currentLocId = mapState.currentLocationId;
    const currentNode = locations[currentLocId];
    if (!currentNode) return;

    // 自動切換為該節點所屬的 Zone
    if (currentNode.zoneId !== currentZoneId) {
      setCurrentZoneId(currentNode.zoneId);
    }
    // 高亮主角當前所在地
    setSelectedNodeId(currentLocId);

    const targetZoom = 1.2;
    let width = 420;
    let height = 600;
    if (canvasRef.current) {
      width = canvasRef.current.clientWidth || canvasRef.current.getBoundingClientRect().width || 420;
      height = canvasRef.current.clientHeight || canvasRef.current.getBoundingClientRect().height || 600;
    }

    const nodePos = nodePositions[currentLocId];
    if (!nodePos) return;
    const nodeX = nodePos.x;
    const nodeY = nodePos.y;

    setZoom(targetZoom);
    setPan({
      x: width / 2 - nodeX * targetZoom,
      y: height / 2 - nodeY * targetZoom,
    });

    setShowGpsTip(true);
    setTimeout(() => setShowGpsTip(false), 2000);
  };

  // ====== 行動：修正地點描述 ======
  const handleSaveDescription = async (nodeId: string) => {
    const ok = await MockMapApi.updateLocationNote(nodeId, tempDesc);
    if (ok) {
      setIsEditingDesc(false);
      // 重新加載地圖資料以更新 UI 中的 description
      await loadMapData();
    }
  };

  // ====== 行動：點擊鎖頭顯示解鎖條件 ======
  const handleLockClick = async (e: React.MouseEvent, edge: MapEdge, isForward: boolean) => {
    e.stopPropagation();
    const path = isForward ? edge.forwardPath : edge.ReversePath;
    if (!path) return;

    const fromNodeName = locations[edge.StartNodeId]?.name ?? edge.StartNodeId;
    const toNodeName = locations[edge.EndNodeId]?.name ?? edge.EndNodeId;
    const title = isForward ? `通道鎖定：${fromNodeName} ➔ ${toNodeName}` : `通道鎖定：${toNodeName} ➔ ${fromNodeName}`;

    // 取得解鎖條件文字描述
    const description =
      path.unlockCondition?.description || path.tempConditon?.description || '此通道目前被阻擋，暫無詳細解鎖說明。';

    // 判定是否滿足解鎖條件，直接拉取最新數據防止 React 狀態延遲
    const [latestInv, latestChars] = await Promise.all([MockApi.getUserInventory(), MockMapApi.getCharData()]);

    const cond = path.unlockCondition;
    let isEligible = false;

    if (cond) {
      if (cond.type === 'item' && cond.targetName) {
        // 解析多物品條件
        const conditions = cond.targetName.split(',').map((part: string) => {
          const segs = part
            .trim()
            .split(':')
            .map(s => s.trim());
          if (segs.length === 3) return { itemId: segs[0], op: segs[1], qty: Number(segs[2]) };
          if (segs.length === 2) return { itemId: segs[0], op: '>=', qty: Number(segs[1]) };
          return { itemId: segs[0], op: '>=', qty: 1 };
        });
        isEligible = conditions.every((ic: { itemId: string; op: string; qty: number }) => {
          const held = getItemQuantity(ic.itemId, latestInv);
          switch (ic.op) {
            case '>=':
              return held >= ic.qty;
            case '<=':
              return held <= ic.qty;
            case '==':
              return held === ic.qty;
            case '!=':
              return held !== ic.qty;
            case '>':
              return held > ic.qty;
            case '<':
              return held < ic.qty;
            default:
              return held >= ic.qty;
          }
        });
      } else if (cond.type === 'obedience' && cond.targetName) {
        // 解析多 NPC 條件
        const npcConditions = cond.targetName.split(',').map((part: string) => {
          const segs = part
            .trim()
            .split(':')
            .map(s => s.trim());
          if (segs.length === 4) return { npcName: segs[0], attr: segs[1], op: segs[2], val: Number(segs[3]) };
          if (segs.length === 2) return { npcName: segs[0], attr: 'obedience', op: '>=', val: Number(segs[1]) };
          return { npcName: segs[0], attr: 'obedience', op: '>=', val: 0 };
        });
        isEligible = npcConditions.every((nc: { npcName: string; attr: string; val: number; op: string }) => {
          const charData = latestChars[nc.npcName] as any;
          if (!charData) return false;

          let actual = 0;
          if (charData[nc.attr] !== undefined) {
            actual = Number(charData[nc.attr]) || 0;
          } else if (charData.bodyParts) {
            const bp = charData.bodyParts;
            const attr = nc.attr;
            if (attr === 'totalSensitivity') {
              for (const k in bp) actual += bp[k]?.sensitivity ?? 0;
            } else if (attr === 'totalOrgasms') {
              for (const k in bp) actual += bp[k]?.orgasms ?? 0;
            } else if (attr.endsWith('Sensitivity')) {
              actual = bp[attr.slice(0, -11)]?.sensitivity ?? 0;
            } else if (attr.endsWith('Tightness')) {
              actual = bp[attr.slice(0, -9)]?.tightness ?? 0;
            } else if (attr.endsWith('Proficiency')) {
              actual = bp[attr.slice(0, -11)]?.proficiency ?? 0;
            } else if (attr.endsWith('Orgasms')) {
              actual = bp[attr.slice(0, -7)]?.orgasms ?? 0;
            }
          }

          switch (nc.op) {
            case '>=':
              return actual >= nc.val;
            case '<=':
              return actual <= nc.val;
            case '==':
              return actual === nc.val;
            case '!=':
              return actual !== nc.val;
            case '>':
              return actual > nc.val;
            case '<':
              return actual < nc.val;
            default:
              return actual >= nc.val;
          }
        });
      }
    }

    setActiveLockDetail({
      edgeId: edge.id,
      isForward,
      title,
      description,
      isEligible,
    });
  };

  // ====== 行動：執行主動開鎖 ======
  const handleUnlockEdge = async (edgeId: string, isForward: boolean) => {
    const { items, npcObedience } = await getEnvVariables();
    const res = await MockMapApi.unlockEdge(edgeId, isForward, items, npcObedience);
    if (res.success) {
      setActiveLockDetail(null);
      // 重新加載地圖資料以將通路狀態更新為 open
      await loadMapData();
      await loadPlayerResources();
      setNotification({ type: 'unlock', content: '🔐 通道已成功解鎖！您現在可以通行了。' });
      setTimeout(() => setNotification(null), 3000);
    } else if (res.errorMsg) {
      setNotification({ type: 'unlock', content: `解鎖失敗：${res.errorMsg}` });
      setTimeout(() => setNotification(null), 3550);
    }
  };

  // ====== SVG 拖曳 & 滾輪縮放邏輯 ======
  const stateRef = useRef({ pan, zoom });
  useEffect(() => {
    stateRef.current = { pan, zoom };
  }, [pan, zoom]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let isDragActive = false;
    let startX = 0;
    let startY = 0;

    // 雙指觸控相關局部變數
    let initialTouchDist = 0;
    let initialTouchZoom = 1;
    let initialTouchCenter = { x: 0, y: 0 };
    let initialPan = { x: 0, y: 0 };

    // --- 拖曳開始 ---
    const startDrag = (clientX: number, clientY: number) => {
      isDragActive = true;
      startX = clientX - stateRef.current.pan.x;
      startY = clientY - stateRef.current.pan.y;
      canvas.style.cursor = 'grabbing';
    };

    // --- 拖曳中 ---
    const doDrag = (clientX: number, clientY: number, e: Event) => {
      if (!isDragActive) return;
      e.preventDefault(); // 阻止手機端下拉刷新與頁面回彈
      setPan({
        x: clientX - startX,
        y: clientY - startY,
      });
    };

    // --- 拖曳結束 ---
    const endDrag = () => {
      isDragActive = false;
      canvas.style.cursor = 'grab';
    };

    // --- 滑鼠事件對接 ---
    const onMouseDown = (e: MouseEvent) => {
      // 僅限滑鼠左鍵
      if (e.button !== 0) return;
      startDrag(e.clientX, e.clientY);
    };
    const onMouseMove = (e: MouseEvent) => {
      doDrag(e.clientX, e.clientY, e);
    };

    // --- 觸控事件對接 (手機端) ---
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        startDrag(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        isDragActive = false;
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        initialTouchDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);
        initialTouchZoom = stateRef.current.zoom;

        const rect = canvas.getBoundingClientRect();
        initialTouchCenter = {
          x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
          y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
        };
        initialPan = { ...stateRef.current.pan };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        doDrag(e.touches[0].clientX, e.touches[0].clientY, e);
      } else if (e.touches.length === 2 && initialTouchDist > 0) {
        e.preventDefault();
        const touch1 = e.touches[0];
        const touch2 = e.touches[1];
        const currentDist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

        const factor = currentDist / initialTouchDist;
        const targetZoom = Math.max(0.5, Math.min(initialTouchZoom * factor, 3));

        setZoom(targetZoom);

        setPan(() => {
          const dx = initialTouchCenter.x - initialPan.x;
          const dy = initialTouchCenter.y - initialPan.y;
          return {
            x: initialTouchCenter.x - dx * (targetZoom / initialTouchZoom),
            y: initialTouchCenter.y - dy * (targetZoom / initialTouchZoom),
          };
        });
      }
    };

    // --- 滾輪縮放 (以滑鼠指針為中心) ---
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomFactor = 1.1;

      setZoom(prevZoom => {
        let nextZoom = prevZoom;
        if (e.deltaY < 0) {
          nextZoom = Math.min(prevZoom * zoomFactor, 3);
        } else {
          nextZoom = Math.max(prevZoom / zoomFactor, 0.5);
        }

        // 以指針為中心調整平移值
        setPan(prevPan => {
          const dx = mouseX - prevPan.x;
          const dy = mouseY - prevPan.y;
          return {
            x: mouseX - dx * (nextZoom / prevZoom),
            y: mouseY - dy * (nextZoom / prevZoom),
          };
        });

        return nextZoom;
      });
    };

    // 註冊滑鼠與觸控事件
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove, { passive: false });
    window.addEventListener('mouseup', endDrag);

    canvas.addEventListener('touchstart', onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', onTouchMove, { passive: false });
    canvas.addEventListener('touchend', endDrag);
    canvas.addEventListener('touchcancel', endDrag);

    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', endDrag);

      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchmove', onTouchMove);
      canvas.removeEventListener('touchend', endDrag);
      canvas.removeEventListener('touchcancel', endDrag);

      canvas.removeEventListener('wheel', onWheel);
    };
  }, [mapDataLoading, locations]);

  // ==========================================
  // 初始玩家位置自動居中對焦邏輯
  // ==========================================
  const hasLocatedInitial = useRef(false);

  useEffect(() => {
    const currentLocId = mapState.currentLocationId;
    if (Object.keys(nodePositions).length > 0 && nodePositions[currentLocId] && !hasLocatedInitial.current) {
      hasLocatedInitial.current = true;

      const nodePos = nodePositions[currentLocId];
      const targetZoom = 1.2;
      let width = 420;
      let height = 600;
      if (canvasRef.current) {
        width = canvasRef.current.clientWidth || canvasRef.current.getBoundingClientRect().width || 420;
        height = canvasRef.current.clientHeight || canvasRef.current.getBoundingClientRect().height || 600;
      }

      setZoom(targetZoom);
      setPan({
        x: width / 2 - nodePos.x * targetZoom,
        y: height / 2 - nodePos.y * targetZoom,
      });
      setSelectedNodeId(currentLocId);
    }
  }, [nodePositions, mapState.currentLocationId]);

  // ====== 取得畫布上節點與線的數據 (過濾屏蔽節點與相關連線) ======
  const filteredNodes = Object.values(locations).filter(n => n.zoneId === currentZoneId && !(n as any)._hidden);
  const filteredEdges = mapEdges.filter(
    e =>
      e.zoneId === currentZoneId &&
      !(locations[e.StartNodeId] as any)?._hidden &&
      !(locations[e.EndNodeId] as any)?._hidden,
  );
  const currentZone = Object.values(zones).find(z => z.id === currentZoneId);
  const selectedNode = locations[selectedNodeId ?? ''];

  // ====== 計算選中路徑的總消耗與步驟 ======
  let routeTotalTime = 0;
  let routeTotalEnergy = 0;
  const routeSteps: { fromName: string; toName: string; time: number; energy: number }[] = [];

  if (selectedNode && shortestPath.length > 0) {
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const u = shortestPath[i];
      const v = shortestPath[i + 1];
      const edge = mapEdges.find(
        e => (e.StartNodeId === u && e.EndNodeId === v) || (e.EndNodeId === u && e.StartNodeId === v),
      );
      if (edge) {
        const pathInfo = edge.StartNodeId === u ? edge.forwardPath : edge.ReversePath;
        if (pathInfo) {
          const timeCost = pathInfo.cost.timeCostMinutes || 0;
          const energyCost = pathInfo.cost.energyCost || 0;
          routeTotalTime += timeCost;
          routeTotalEnergy += energyCost;

          const fromNode = locations[u];
          const toNode = locations[v];
          routeSteps.push({
            fromName: fromNode?.name ?? u,
            toName: toNode?.name ?? v,
            time: timeCost,
            energy: energyCost,
          });
        }
      }
    }
  }

  // 計算最遠可達節點
  let lastReachableNodeId: string | null = null;
  let isPathTruncated = false;

  if (selectedNode && shortestPath.length > 0) {
    lastReachableNodeId = shortestPath[0]; // 起點
    for (let i = 0; i < shortestPath.length - 1; i++) {
      const u = shortestPath[i];
      const v = shortestPath[i + 1];
      const edge = mapEdges.find(
        e => (e.StartNodeId === u && e.EndNodeId === v) || (e.EndNodeId === u && e.StartNodeId === v),
      );
      if (edge) {
        const pathInfo = edge.StartNodeId === u ? edge.forwardPath : edge.ReversePath;
        const isOpen = checkEdgeOpen(pathInfo, edge.StartNodeId === u ? edge.EndNodeId : edge.StartNodeId);
        if (isOpen) {
          lastReachableNodeId = v;
        } else {
          isPathTruncated = true;
          break; // 遇到阻擋，最遠只能走到當前的 u
        }
      } else {
        isPathTruncated = true;
        break;
      }
    }

    if (lastReachableNodeId !== selectedNode.id) {
      isPathTruncated = true;
    }
  }

  const isMoveDisabled = !lastReachableNodeId || lastReachableNodeId === mapState.currentLocationId;
  const lastReachableNode = lastReachableNodeId ? locations[lastReachableNodeId] : null;

  // 取得大區域的探索進度
  const getZoneProgress = (zoneId: string) => {
    const nodesInZone = Object.values(locations).filter(n => n.zoneId === zoneId);
    const discoveredInZone = nodesInZone.filter(n => mapState.discoveredNodeIds.includes(n.id));
    return nodesInZone.length > 0 ? Math.round((discoveredInZone.length / nodesInZone.length) * 100) : 0;
  };

  // ====== 渲染邏輯 ======
  if (mapDataLoading || Object.keys(locations).length === 0) {
    return (
      <div className="flex h-full w-full flex-col bg-slate-950 text-white items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
        </div>
        <div className="text-sm text-slate-400 mt-4">載入地圖系統中...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-slate-950 flex flex-col overflow-hidden text-slate-100 font-sans relative">
      {/* 1. 頂部狀態欄 */}
      <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 z-30">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all text-slate-300"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="font-bold text-xs sm:text-sm tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400 whitespace-nowrap shrink-0">
            GPS 定位
          </span>
        </div>

        {/* 系統時間與三種資源 */}
        <div className="flex items-center gap-3 text-[10px] sm:text-xs">
          <span className="text-slate-400 font-mono">{timeText}</span>
          <div className="h-3 w-px bg-slate-800"></div>

          <div className="flex items-center gap-1.5" title="MC能量">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse"></span>
            <span className="text-purple-300 font-semibold font-mono">
              {mcEnergy}/{mcEnergyMax}
            </span>
          </div>

          <div className="flex items-center gap-1.5" title="當前MC點">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            <span className="text-amber-300 font-semibold font-mono">{mcPoints}PT</span>
          </div>

          <div className="flex items-center gap-1.5" title="持有零花錢">
            <span className="text-emerald-400 font-bold">¥</span>
            <span className="text-emerald-300 font-semibold font-mono">{money}</span>
          </div>
        </div>
      </div>

      {/* 2. 區域切換下拉欄 */}
      <div className="w-full px-4 py-2 bg-slate-950/60 backdrop-blur-sm border-b border-slate-900/60 flex items-center justify-between z-20">
        <div className="relative group">
          <button className="flex items-center gap-1 bg-slate-900/80 px-3 py-1 rounded-full border border-slate-800 text-xs text-slate-200">
            <span>
              {currentZone?.name} ({getZoneProgress(currentZoneId)}%)
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* 下拉列表 */}
          <div className="absolute left-0 mt-1 w-48 max-h-72 overflow-y-auto rounded-xl bg-slate-900 border border-slate-850 shadow-xl hidden group-focus-within:block group-hover:block z-50 hypno-scrollbar">
            {Object.values(zones).map(zone => (
              <button
                key={zone.id}
                onClick={() => {
                  setCurrentZoneId(zone.id);
                  setSelectedNodeId(null);
                  setShowFullDrawer(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${currentZoneId === zone.id ? 'bg-slate-800 text-emerald-400' : 'hover:bg-slate-800 text-slate-300'}`}
              >
                {zone.name} ({getZoneProgress(zone.id)}%)
              </button>
            ))}
          </div>
        </div>

        {/* 測試輔助道具面板已被移除 */}
      </div>

      {/* 3. 主版面配置 */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* 中央 SVG 拓撲畫布 */}
        <div className="flex-1 h-full relative bg-radial-dot bg-[size:16px_16px] bg-[slate-950]/90">
          <svg ref={canvasRef} className="w-full h-full cursor-grab active:cursor-grabbing select-none">
            {/* 底層空白點擊感應區，用於點選空白處取消選取 */}
            <rect
              width="100%"
              height="100%"
              fill="transparent"
              className="cursor-default"
              onClick={() => {
                setSelectedNodeId(null);
                setShowFullDrawer(false);
              }}
            />
            {/* SVG 內容變換群組 (Pan & Zoom) */}
            <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
              {/* 繪製連線 (Edges) */}
              {filteredEdges.map(edge => {
                const fromNode = locations[edge.StartNodeId];
                const toNode = locations[edge.EndNodeId];
                if (!fromNode || !toNode) return null;

                const isStartDiscovered = mapState.discoveredNodeIds.includes(edge.StartNodeId);
                const isEndDiscovered = mapState.discoveredNodeIds.includes(edge.EndNodeId);

                // 從自動佈局中獲取坐標
                const posFrom = nodePositions[fromNode.id];
                const posTo = nodePositions[toNode.id];
                if (!posFrom || !posTo) return null;

                const x1 = posFrom.x;
                const y1 = posFrom.y;
                const x2 = posTo.x;
                const y2 = posTo.y;

                // 計算方向與法向量
                const dx_val = x2 - x1;
                const dy_val = y2 - y1;
                const len = Math.sqrt(dx_val * dx_val + dy_val * dy_val);
                if (len === 0) return null;

                const dx = dx_val / len;
                const dy = dy_val / len;

                // 判定單向路徑 (物理上沒有反向或正向路徑)
                const hasOnlyForward = !edge.ReversePath;
                const hasOnlyReverse = !edge.forwardPath;
                const isOneWay = hasOnlyForward || hasOnlyReverse;

                const d = isOneWay ? 0 : 4.5; // 如果是單向路徑，平移間距為 0 (置中)

                // 1. 正向通路 (StartNodeId -> EndNodeId) - 起點與終點皆需 discovered，且非只有反向的單向路徑
                const showForward = isStartDiscovered && isEndDiscovered && !hasOnlyReverse;
                const fX1 = x1 - d * dy;
                const fY1 = y1 + d * dx;
                const fX2 = x2 - d * dy;
                const fY2 = y2 + d * dx;

                // 2. 反向通路 (EndNodeId -> StartNodeId) - 起點與終點皆需 discovered，且非只有正向的單向路徑
                const showReverse = isStartDiscovered && isEndDiscovered && !hasOnlyForward;
                const rX1 = x2 + d * dy;
                const rY1 = y2 - d * dx;
                const rX2 = x1 + d * dy;
                const rY2 = y1 - d * dx;

                // 計算該連線是否屬於當前高亮路徑的某個方向
                const fromIdxF = shortestPath.indexOf(edge.StartNodeId);
                const toIdxF = shortestPath.indexOf(edge.EndNodeId);
                const isForwardInPath = fromIdxF !== -1 && toIdxF !== -1 && toIdxF === fromIdxF + 1;

                const fromIdxR = shortestPath.indexOf(edge.EndNodeId);
                const toIdxR = shortestPath.indexOf(edge.StartNodeId);
                const isReverseInPath = fromIdxR !== -1 && toIdxR !== -1 && toIdxR === fromIdxR + 1;

                return (
                  <g key={edge.id}>
                    {/* 正向線 */}
                    {showForward &&
                      (() => {
                        const status = edge.forwardPath?.status;
                        const isLocked = status === 'locked';
                        const isTemp = status === 'temp_open';
                        const isFOpen = checkEdgeOpen(edge.forwardPath, edge.EndNodeId);

                        // 預設樣式與顏色
                        let strokeColor = 'stroke-slate-700'; // 默認灰色
                        if (isLocked) {
                          strokeColor = 'stroke-red-900/50';
                        } else if (isTemp) {
                          strokeColor = isFOpen ? 'stroke-amber-500/80' : 'stroke-red-900/40';
                        }

                        // 高亮狀態
                        if (isForwardInPath) {
                          if (!isFOpen) {
                            strokeColor = 'stroke-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]'; // 高亮紅色虛線
                          } else if (isTemp) {
                            strokeColor = 'stroke-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]'; // 高亮橘黃
                          } else {
                            strokeColor = 'stroke-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'; // 高亮青綠色
                          }
                        }

                        const isDash = !isFOpen ? 'stroke-dasharray-[4_4]' : '';

                        // 計算中點與方向角以繪製箭頭
                        const fMx = (fX1 + fX2) / 2;
                        const fMy = (fY1 + fY2) / 2;
                        const fTheta = Math.atan2(fY2 - fY1, fX2 - fX1) * (180 / Math.PI);

                        return (
                          <g>
                            <line
                              x1={fX1}
                              y1={fY1}
                              x2={fX2}
                              y2={fY2}
                              className={`stroke-2 transition-all duration-300 ${strokeColor} ${isDash}`}
                            />
                            {isFOpen && (
                              <polygon
                                points="-4,-3 4,0 -4,3"
                                className={`${strokeColor.replace(/stroke-/g, 'fill-')} transition-all duration-300`}
                                transform={`translate(${fMx}, ${fMy}) rotate(${fTheta})`}
                              />
                            )}
                            {!isFOpen && (
                              <g
                                transform={`translate(${(fX1 + fX2) / 2 - 6}, ${(fY1 + fY2) / 2 - 6})`}
                                className="cursor-pointer group/lock pointer-events-auto"
                                onClick={e => handleLockClick(e, edge, true)}
                              >
                                <circle
                                  r="7"
                                  cx="6"
                                  cy="6"
                                  className="fill-slate-950/90 stroke-red-500/50 stroke-[1.2] group-hover/lock:stroke-red-400 group-hover/lock:fill-slate-900 transition-colors"
                                />
                                <path
                                  d="M4.5 4.5v-1a1.5 1.5 0 0 1 3 0v1m-4 0h5v4.5h-5z"
                                  className="stroke-red-500 group-hover/lock:stroke-red-400 fill-none stroke-[0.8] transition-colors"
                                />
                              </g>
                            )}
                          </g>
                        );
                      })()}

                    {/* 反向線 */}
                    {showReverse &&
                      (() => {
                        const status = edge.ReversePath?.status;
                        const isLocked = status === 'locked';
                        const isTemp = status === 'temp_open';
                        const isROpen = checkEdgeOpen(edge.ReversePath, edge.StartNodeId);

                        // 預設樣式與顏色
                        let strokeColor = 'stroke-slate-700'; // 默認灰色
                        if (isLocked) {
                          strokeColor = 'stroke-red-900/50';
                        } else if (isTemp) {
                          strokeColor = isROpen ? 'stroke-amber-500/80' : 'stroke-red-900/40';
                        }

                        // 高亮狀態
                        if (isReverseInPath) {
                          if (!isROpen) {
                            strokeColor = 'stroke-red-500 drop-shadow-[0_0_6px_rgba(239,68,68,0.6)]'; // 高亮紅色虛線
                          } else if (isTemp) {
                            strokeColor = 'stroke-amber-400 drop-shadow-[0_0_6px_rgba(245,158,11,0.6)]'; // 高亮橘黃
                          } else {
                            strokeColor = 'stroke-cyan-400 drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]'; // 高亮青綠色
                          }
                        }

                        const isDash = !isROpen ? 'stroke-dasharray-[4_4]' : '';

                        // 計算中點與方向角以繪製箭頭
                        const rMx = (rX1 + rX2) / 2;
                        const rMy = (rY1 + rY2) / 2;
                        const rTheta = Math.atan2(rY2 - rY1, rX2 - rX1) * (180 / Math.PI);

                        return (
                          <g>
                            <line
                              x1={rX1}
                              y1={rY1}
                              x2={rX2}
                              y2={rY2}
                              className={`stroke-2 transition-all duration-300 ${strokeColor} ${isDash}`}
                            />
                            {isROpen && (
                              <polygon
                                points="-4,-3 4,0 -4,3"
                                className={`${strokeColor.replace(/stroke-/g, 'fill-')} transition-all duration-300`}
                                transform={`translate(${rMx}, ${rMy}) rotate(${rTheta})`}
                              />
                            )}
                            {!isROpen && (
                              <g
                                transform={`translate(${(rX1 + rX2) / 2 - 6}, ${(rY1 + rY2) / 2 - 6})`}
                                className="cursor-pointer group/lock pointer-events-auto"
                                onClick={e => handleLockClick(e, edge, false)}
                              >
                                <circle
                                  r="7"
                                  cx="6"
                                  cy="6"
                                  className="fill-slate-950/90 stroke-red-500/50 stroke-[1.2] group-hover/lock:stroke-red-400 group-hover/lock:fill-slate-900 transition-colors"
                                />
                                <path
                                  d="M4.5 4.5v-1a1.5 1.5 0 0 1 3 0v1m-4 0h5v4.5h-5z"
                                  className="stroke-red-500 group-hover/lock:stroke-red-400 fill-none stroke-[0.8] transition-colors"
                                />
                              </g>
                            )}
                          </g>
                        );
                      })()}
                  </g>
                );
              })}

              {/* 繪製節點 (Nodes) */}
              {filteredNodes.map(node => {
                const isDiscovered = mapState.discoveredNodeIds.includes(node.id);
                const isCurrent = mapState.currentLocationId === node.id;
                const isSelected = selectedNodeId === node.id;

                const pos = nodePositions[node.id];
                if (!pos) return null;

                const px = pos.x;
                const py = pos.y;

                // 未探索節點 (迷霧狀態)
                if (!isDiscovered) {
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${px}, ${py})`}
                      className="cursor-pointer"
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedNodeId(node.id);
                        setIsEditingDesc(false);
                      }}
                    >
                      <circle
                        r="12"
                        className="fill-slate-900 stroke-slate-700/60 stroke-2 stroke-dasharray-[3_3] hover:stroke-slate-500 transition-colors"
                      />
                      <text
                        y="22"
                        textAnchor="middle"
                        className="fill-slate-500 text-[8px] font-medium pointer-events-none"
                      >
                        ???
                      </text>
                    </g>
                  );
                }

                // 已解鎖節點
                return (
                  <g
                    key={node.id}
                    transform={`translate(${px}, ${py})`}
                    className="cursor-pointer"
                    onClick={e => {
                      e.stopPropagation();
                      setSelectedNodeId(node.id);
                      setIsEditingDesc(false);
                      setTempDesc(node.description);
                    }}
                  >
                    {/* 慢速呼吸定位提示圈 (僅當前所在地點顯示) */}
                    {isCurrent && (
                      <circle
                        r="20"
                        className="fill-none stroke-emerald-500/30 stroke animate-[ping_3s_ease-in-out_infinite]"
                      />
                    )}

                    {/* 節點主圓圈 */}
                    <circle
                      r="12"
                      className={`transition-all duration-300 ${isCurrent ? 'fill-emerald-950/80 stroke-emerald-400 stroke-2' : isSelected ? 'fill-slate-800 stroke-cyan-400 stroke-2' : 'fill-slate-900 stroke-slate-700 hover:stroke-slate-400 stroke-[1.5]'}`}
                    />

                    {/* 內部核心圓點 */}
                    <circle
                      r="4"
                      className={isCurrent ? 'fill-emerald-400' : isSelected ? 'fill-cyan-400' : 'fill-slate-500'}
                    />

                    {/* 地點名稱標籤 */}
                    <text
                      y="24"
                      textAnchor="middle"
                      className={`text-[9px] font-bold pointer-events-none tracking-wide transition-all ${isCurrent ? 'fill-emerald-300 drop-shadow-[0_2px_4px_rgba(16,185,129,0.3)]' : isSelected ? 'fill-cyan-300' : 'fill-slate-300'}`}
                    >
                      {node.name}
                    </text>

                    {/* 疊加標誌：NPC 在此處 */}
                    {Object.entries(charsData).some(
                      ([_, char]) => (char as any).locationState?.locationId === node.id,
                    ) && (
                      <g transform="translate(10, -10)">
                        <circle r="6" className="fill-purple-600 stroke-slate-950 stroke-[1.5]" />
                        <User className="w-2.5 h-2.5 text-slate-100 absolute -translate-x-1.2 -translate-y-1.2 pointer-events-none" />
                      </g>
                    )}

                    {/* 疊加標誌：任務驚嘆號 */}
                    {node.hasQuest && (
                      <g transform="translate(-10, -10)">
                        <circle r="6" className="fill-amber-500 stroke-slate-950 stroke-[1.5]" />
                        <span className="text-[8px] font-extrabold text-slate-950 absolute -translate-x-1 -translate-y-2 pointer-events-none">
                          !
                        </span>
                      </g>
                    )}
                  </g>
                );
              })}
            </g>

            {/* SVG 覆蓋濾鏡：綠色激光掃描線 */}
            {scanning && (
              <line
                x1={`${scanLaserPos}%`}
                y1="0%"
                x2={`${scanLaserPos}%`}
                y2="100%"
                className="stroke-emerald-400/80 stroke-2 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
                style={{ filter: 'drop-shadow(0px 0px 8px #10b981)' }}
              />
            )}
          </svg>

          {/* 畫布控制按鈕 (縮放) */}
          <div className="absolute left-4 bottom-4 flex flex-col gap-1 z-10">
            <button
              onClick={() => setZoom(prev => Math.min(prev * 1.2, 3))}
              className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-slate-200 active:scale-95 transition-all"
              title="放大"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <button
              onClick={() => setZoom(prev => Math.max(prev / 1.2, 0.5))}
              className="p-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-slate-200 active:scale-95 transition-all"
              title="縮小"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
          </div>

          {/* 右下角控制區 (雷達掃描 + GPS 佔位) */}
          <div className="absolute right-4 bottom-4 flex flex-col items-end gap-2.5 z-10">
            {/* GPS 定位按鈕 */}
            <button
              onClick={handleLocateCurrent}
              className="px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-[10px] text-slate-300 font-semibold flex items-center gap-1.5 hover:border-slate-700 hover:text-white shadow-lg active:scale-95 transition-all"
            >
              <Navigation className="w-3.5 h-3.5 text-cyan-400" />
              <span>GPS定位</span>
            </button>

            {/* 雷達掃描按鈕 */}
            <button
              onClick={() => handleRadarScan()}
              disabled={scanning}
              className={`p-3.5 rounded-full shadow-2xl flex items-center justify-center relative active:scale-90 transition-all ${scanning ? 'bg-emerald-950 border border-emerald-500/40 text-emerald-400' : 'bg-gradient-to-br from-emerald-500 to-teal-600 text-slate-950 hover:brightness-110'}`}
            >
              <Compass className={`w-6 h-6 ${scanning && 'animate-spin'}`} style={{ animationDuration: '3s' }} />
              {scanning && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              )}
            </button>
          </div>

          {/* 提示浮動框 */}
          {notification && (
            <div
              className={`absolute left-1/2 -translate-x-1/2 bottom-20 max-w-[85%] px-4 py-3 bg-slate-900/95 border rounded-2xl shadow-2xl backdrop-blur-md flex items-start gap-2.5 animate-slide-up z-40 ${
                notification.type === 'radar'
                  ? 'border-emerald-500/30'
                  : notification.type === 'unlock'
                    ? 'border-amber-500/30'
                    : 'border-cyan-500/30'
              }`}
            >
              {notification.type === 'radar' ? (
                <ShieldAlert className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : notification.type === 'unlock' ? (
                <Key className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              ) : (
                <Navigation className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5 rotate-45" />
              )}
              <div className="flex flex-col gap-1">
                <span
                  className={`text-xs font-bold ${
                    notification.type === 'radar'
                      ? 'text-emerald-400'
                      : notification.type === 'unlock'
                        ? 'text-amber-400'
                        : 'text-cyan-400'
                  }`}
                >
                  {notification.type === 'radar'
                    ? '雷達掃描報告'
                    : notification.type === 'unlock'
                      ? '通道解鎖報告'
                      : '行動指令發送'}
                </span>
                <p className="text-[10px] text-slate-300 leading-relaxed whitespace-pre-line">{notification.content}</p>
              </div>
            </div>
          )}

          {/* GPS 同步提示浮動框 */}
          {showGpsTip && (
            <div className="absolute right-4 bottom-14 px-3 py-1.5 bg-cyan-950/90 border border-cyan-500/30 rounded-xl text-[10px] text-cyan-300 shadow-xl animate-fade-in z-20">
              衛星定位已校對，視野已重置。
            </div>
          )}
        </div>

        {/* 4. 底部輕量級地點資訊浮動卡片 (Deselect / Navigation / Show details) */}
        {selectedNodeId && selectedNode && !showFullDrawer && (
          <div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 w-[90%] sm:max-w-md bg-slate-900/90 border border-slate-800 rounded-2xl p-3 shadow-2xl backdrop-blur-md flex items-center justify-between z-20 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0 pr-3">
              <span className="text-[8px] text-cyan-400 font-semibold tracking-wider font-mono">已選取地點</span>
              <h3 className="text-xs font-bold text-white leading-tight truncate" title={selectedNode.name}>
                {selectedNode.name}
              </h3>
              <div className="flex flex-col gap-0.5 mt-0.5">
                <span className="text-[9px] text-slate-400 leading-tight truncate">
                  {mapState.currentLocationId === selectedNode.id
                    ? '您目前在此處'
                    : shortestPath.length > 0
                      ? `距離主角 ${shortestPath.length - 1} 個節點`
                      : '無法到達該地點'}
                </span>
                {mapState.currentLocationId !== selectedNode.id && shortestPath.length > 0 && routeTotalTime > 0 && (
                  <span className="text-[9px] text-emerald-400/90 font-mono font-bold flex items-center gap-1 leading-tight whitespace-nowrap select-none">
                    <span>⚡ 預計消耗:</span>
                    <span>{routeTotalTime}min</span>
                    {routeTotalEnergy > 0 && <span>/ {routeTotalEnergy}MC</span>}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setShowFullDrawer(true)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-[10px] text-slate-200 font-semibold transition-all active:scale-95 whitespace-nowrap"
              >
                詳情
              </button>

              {/* 行動按鈕 */}
              {mapState.currentLocationId === selectedNode.id ? (
                <button
                  disabled
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-850 text-[10px] text-slate-500 font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  <span>在此處</span>
                </button>
              ) : isMoveDisabled ? (
                <button
                  disabled
                  className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-850 text-[10px] text-slate-500 font-semibold flex items-center gap-1 whitespace-nowrap"
                >
                  <Lock className="w-3 h-3 text-red-500/80" />
                  <span>受阻</span>
                </button>
              ) : isPathTruncated ? (
                <button
                  onClick={() => handleMove(lastReachableNodeId!)}
                  className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 active:scale-95 transition-all shadow-[0_0_6px_rgba(245,158,11,0.2)] whitespace-nowrap"
                >
                  <Navigation className="w-3 h-3" />
                  <span>前往 {lastReachableNode?.name}</span>
                </button>
              ) : (
                <button
                  onClick={() => handleMove(selectedNode.id)}
                  className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-[10px] flex items-center gap-1 active:scale-95 transition-all whitespace-nowrap"
                >
                  <Navigation className="w-3 h-3" />
                  <span>前往</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. 通用底部詳情抽屜 (Bottom Sheet) */}
      {selectedNodeId && selectedNode && showFullDrawer && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-40" onClick={() => setShowFullDrawer(false)}>
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full sm:max-w-md h-[45%] bg-slate-900 border-t border-slate-800 rounded-t-[2.5rem] flex flex-col overflow-hidden backdrop-blur-xl animate-slide-up shadow-[0_-10px_30px_rgba(0,0,0,0.5)]"
            onClick={e => e.stopPropagation()}
          >
            {/* 拖動指示條 */}
            <div className="w-12 h-1 bg-slate-700/60 rounded-full mx-auto my-2.5"></div>

            <div className="relative px-5 pb-3 flex items-center justify-between border-b border-slate-850">
              <div className="flex flex-col">
                <span className="text-[8px] text-cyan-400 uppercase tracking-widest font-semibold font-mono">
                  地點詳情
                </span>
                <h2 className="text-base font-bold text-white tracking-wide">{selectedNode.name}</h2>
              </div>
              <button
                onClick={() => setShowFullDrawer(false)}
                className="p-1 rounded-full bg-slate-800 hover:bg-slate-750 text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 內容區 */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 hypno-scrollbar">
              {/* 空間描述 */}
              <div className="flex flex-col gap-1.5 bg-slate-950/30 p-3 rounded-2xl border border-slate-850">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 font-bold">空間描述</span>
                  <button
                    onClick={() => {
                      setIsEditingDesc(!isEditingDesc);
                      setTempDesc(selectedNode.description);
                    }}
                    className="text-slate-400 hover:text-cyan-400 p-0.5 rounded transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                </div>

                {isEditingDesc ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <textarea
                      value={tempDesc}
                      onChange={e => setTempDesc(e.target.value)}
                      className="w-full h-16 bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none resize-none font-sans"
                    />
                    <button
                      onClick={() => handleSaveDescription(selectedNode.id)}
                      className="px-2.5 py-1 bg-cyan-600 text-slate-950 font-bold text-[9px] rounded-md self-end flex items-center gap-1"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>儲存</span>
                    </button>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-300 leading-relaxed">{selectedNode.description}</p>
                )}
              </div>

              {/* 導航路線與消耗 */}
              {mapState.currentLocationId !== selectedNode.id && shortestPath.length > 0 && (
                <div className="flex flex-col gap-2 bg-slate-950/40 p-3 rounded-2xl border border-slate-850">
                  <div className="flex items-center justify-between border-b border-slate-800/60 pb-1.5">
                    <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                      <span>🧭 推薦路線導航</span>
                    </span>
                    <span className="text-[9px] text-cyan-400 font-mono font-bold">
                      總消耗: {routeTotalTime}min{routeTotalEnergy > 0 ? ` / ${routeTotalEnergy}MC` : ''}
                    </span>
                  </div>

                  {/* 步驟小箭頭清單 */}
                  <div className="flex flex-col gap-1 text-[10px]">
                    {routeSteps.map((step, idx) => (
                      <div key={idx} className="flex items-center justify-between text-slate-300">
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500 font-mono text-[8px] bg-slate-900/60 px-1 py-0.5 rounded">
                            Step {idx + 1}
                          </span>
                          <span>
                            {step.fromName} ➔ {step.toName}
                          </span>
                        </div>
                        <span className="text-slate-400 font-mono text-[9px]">
                          {step.time}min{step.energy > 0 ? ` (+${step.energy}MC)` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* NPC 列表 */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] text-slate-500 font-bold">在場NPC蹤跡</span>
                {Object.entries(charsData).some(
                  ([_, char]) => (char as any).locationState?.locationId === selectedNode.id,
                ) ? (
                  Object.entries(charsData)
                    .filter(([_, char]) => (char as any).locationState?.locationId === selectedNode.id)
                    .map(([npcName, char]) => {
                      const obedience = char ? char.obedience : 0;
                      const alertness = char ? char.alertness : 0;
                      const status = (char as any).locationState?.locationStatus || '在此處';
                      return (
                        <div
                          key={npcName}
                          className="flex items-center gap-2.5 bg-slate-900/60 p-2 rounded-xl border border-slate-850"
                        >
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-[11px] font-bold">
                            {npcName[0]}
                          </div>
                          <div className="flex-1 flex flex-col gap-0.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-200">{npcName}</span>
                              <span className="text-[8px] text-slate-400 bg-slate-950 px-1 py-0.5 rounded-full font-mono scale-95">
                                {status}
                              </span>
                            </div>
                            <div className="flex gap-2 text-[8px] text-slate-400">
                              <span>
                                服從度: <strong className="text-purple-400">{obedience}</strong>
                              </span>
                              <span>
                                警戒度: <strong className="text-red-400">{alertness}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <span className="text-[9px] text-slate-400 italic">此處目前空無一人...</span>
                )}
              </div>
            </div>

            {/* 按鈕操作 */}
            <div className="p-4 border-t border-slate-850 bg-slate-950/20 mb-2">
              {mapState.currentLocationId === selectedNode.id ? (
                <button
                  disabled
                  className="w-full py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-500 font-bold flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-4 h-4 text-emerald-400" />
                  <span>當前所在地</span>
                </button>
              ) : isMoveDisabled ? (
                <button
                  disabled
                  className="w-full py-2 rounded-xl bg-slate-950 border border-slate-850 text-xs text-slate-500 font-bold flex items-center justify-center gap-1.5"
                >
                  <Lock className="w-4 h-4 text-red-500/80" />
                  <span>通路被阻擋 / 無法通行</span>
                </button>
              ) : isPathTruncated ? (
                <button
                  onClick={() => handleMove(lastReachableNodeId!)}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                >
                  <Navigation className="w-4 h-4" />
                  <span>前往 {lastReachableNode?.name} (受阻前最遠可達)</span>
                </button>
              ) : (
                <button
                  onClick={() => handleMove(selectedNode.id)}
                  className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-extrabold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition-all"
                >
                  <Navigation className="w-4 h-4" />
                  <span>前往此處</span>
                </button>
              )}

              {/* 強制移動測試按鈕已被移除 */}
            </div>
          </div>
        </div>
      )}

      {/* 6. 鎖頭詳細解鎖條件彈窗 */}
      {activeLockDetail && (
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-[3px] z-50 flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setActiveLockDetail(null)}
        >
          <div
            className="w-full max-w-xs bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl flex flex-col gap-4 border-t-red-500/30 animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            {/* 頂部標題 */}
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-red-950/50 border border-red-500/30 text-red-400 flex-shrink-0">
                <Key className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-[8px] text-red-400 font-bold uppercase tracking-wider font-mono">
                  ACCESS DENIED
                </span>
                <h3 className="text-xs font-bold text-white leading-tight truncate">{activeLockDetail.title}</h3>
              </div>
            </div>

            {/* 詳細說明 */}
            <div className="bg-slate-950/40 border border-slate-850 rounded-2xl p-3.5">
              <p className="text-[11px] text-slate-300 leading-relaxed font-medium">{activeLockDetail.description}</p>
            </div>

            {/* 操作按鈕 */}
            {activeLockDetail.isEligible && (
              <button
                onClick={() => handleUnlockEdge(activeLockDetail.edgeId, activeLockDetail.isForward)}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-extrabold text-xs active:scale-95 transition-all shadow-[0_0_10px_rgba(52,211,153,0.3)]"
              >
                🔓 立即解鎖通道
              </button>
            )}

            <button
              onClick={() => setActiveLockDetail(null)}
              className="w-full py-2 rounded-xl bg-slate-850 hover:bg-slate-800 text-slate-200 hover:text-white font-semibold text-xs active:scale-95 transition-all border border-slate-800"
            >
              {activeLockDetail.isEligible ? '取消' : '確認並返回'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
export default MapApp;
