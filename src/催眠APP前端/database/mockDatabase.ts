import {
  ChatVariables,
  MvuVariables,
  DevRuntimeVariables,
  MockLocationNode,
  BodyPartsDef,
} from '../models';

import {
  HYPNOSIS_DICTIONARY,
  HYPNO_MODULE_DICTIONARY,
  ITEM_DICTIONARY,
  ACHIEVEMENT_DICTIONARY,
  QUEST_DICTIONARY,
  CALENDAR_STATIC_EVENTS,
  MAP_LOCATION_NODES,
  MAP_MAP_EDGES,
  MAP_ZONES,
  BODY_PARTS_DICTIONARY,
  BODY_MODIFICATIONS_DICTIONARY,
} from '../staticData';

import { chatDatabasePatch } from './chatVariables';
import { mvuDatabasePatch } from './mvuVariables';
import { mockPrompts, mockCharacters } from './characterMockData';

// ==========================================
// 全域模擬變數 (Memory Database) - 永久維持同一個物件參照
// ==========================================
export const mockChatVariables: ChatVariables = {
  apiSettings: undefined,
  hypnosis: {},
  combos: {},
  hypnoModules: {},
  quests: {},
  achievements: {},
  calendarEvents: {},
  zones: {},
  locations: {},
  mapEdges: [],
  items: {},
  bodyParts: {},
  bodyModifications: {},
};

export const mockMvuVariables: MvuVariables = {
  time: '2026-05-01 11:28:00',
  user: {
    userName: '預設玩家名',
    money: 0,
    mcEnergy: 0,
    mcEnergyMax: 100,
    mcPoints: 0,
    totalConsumedMc: 0,
    vipTier: 0,
    vipEndVirtualMinutes: 0,
    vipAutoRenew: false,
    suspicion: 0,
    ownedHypnosis: {},
    ownedHypnoModules: {},
    ownedCombos: {},
    mapState: {
      currentLocationId: 'home_my_room',
      discoveredNodeIds: ['home_my_room'],
    },
    ownedAchievements: {},
    ownedQuests: {},
    inventory: {},
  },
  chars: {},
};

export const mockDevRuntimeVariables: DevRuntimeVariables = {
  prompts: [],
  charBackgrounds: {},
};

// ==========================================
// 深度合併輔助函數 (Mutating Deep Merge)
// ==========================================
function deepMergeMutate<T extends Record<string, any>>(target: T, source: Partial<T>): void {
  const t = target as any;
  const s = source as any;
  if (isObject(t) && isObject(s)) {
    Object.keys(s).forEach(key => {
      const sourceVal = s[key];
      if (isObject(sourceVal)) {
        if (!(key in t) || !isObject(t[key])) {
          t[key] = { ...sourceVal };
        } else {
          deepMergeMutate(t[key], sourceVal);
        }
      } else {
        t[key] = sourceVal;
      }
    });
  }
}

function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// ==========================================
// 身體部位與身體改造同步邏輯
// ==========================================
export function syncCharacterBodyParts(char: any, bodyPartsDefs: Record<string, BodyPartsDef>) {
  if (!char.bodyParts) {
    char.bodyParts = {};
  }
  if (!char.ownedBodyModifications) {
    char.ownedBodyModifications = {};
  }

  for (const [id, def] of Object.entries(bodyPartsDefs)) {
    const shouldExist = !def.isCustom || !!char.ownedBodyModifications[id];

    if (shouldExist) {
      if (!char.bodyParts[id]) {
        char.bodyParts[id] = {};
      }
      const stat = char.bodyParts[id];

      if (def.hasSensitivity) {
        if (stat.sensitivity === undefined) stat.sensitivity = 0;
      } else {
        delete stat.sensitivity;
      }

      if (def.hasTightness) {
        if (stat.tightness === undefined) stat.tightness = 0;
      } else {
        delete stat.tightness;
      }

      if (def.hasProficiency) {
        if (stat.proficiency === undefined) stat.proficiency = 0;
      } else {
        delete stat.proficiency;
      }

      if (def.canOrgasm) {
        if (stat.orgasms === undefined) stat.orgasms = 0;
      } else {
        delete stat.orgasms;
      }
    } else {
      delete char.bodyParts[id];
    }
  }

  for (const id of Object.keys(char.bodyParts)) {
    if (!bodyPartsDefs[id]) {
      delete char.bodyParts[id];
    }
  }
}

// ==========================================
// 載入與覆蓋流程實作 (Load Flow)
// ==========================================
export function loadSimulationVariables() {
  console.info('[HypnoOS][mockDatabase] 啟動載入模擬資料流程 (database > staticData)...');

  // 1. 載入 staticData 作為底層預設資料 (StaticData -> Chat/Mvu)
  
  // 聊天靜態資料
  mockChatVariables.hypnosis = { ...HYPNOSIS_DICTIONARY };
  mockChatVariables.hypnoModules = { ...HYPNO_MODULE_DICTIONARY };
  mockChatVariables.items = { ...ITEM_DICTIONARY };
  mockChatVariables.achievements = { ...ACHIEVEMENT_DICTIONARY };
  mockChatVariables.quests = { ...QUEST_DICTIONARY };
  mockChatVariables.calendarEvents = { ...CALENDAR_STATIC_EVENTS };
  mockChatVariables.bodyParts = { ...BODY_PARTS_DICTIONARY };
  mockChatVariables.bodyModifications = { ...BODY_MODIFICATIONS_DICTIONARY };
  
  // 地圖靜態資料轉換 (Array -> Record)
  const locRecord: Record<string, MockLocationNode> = {};
  MAP_LOCATION_NODES.forEach(node => {
    locRecord[node.id] = node;
  });
  mockChatVariables.locations = locRecord;
  mockChatVariables.mapEdges = [...MAP_MAP_EDGES];

  const zoneRecord: Record<string, any> = {};
  MAP_ZONES.forEach(z => {
    zoneRecord[z.id] = z;
  });
  mockChatVariables.zones = zoneRecord;

  // 開發期臨時 Runtime 變數初始化
  mockDevRuntimeVariables.prompts = [...mockPrompts];
  
  const charBgRecord: Record<string, any> = {};
  mockCharacters.forEach(c => {
    const name = Object.keys(c.basic)[0];
    if (name) charBgRecord[name] = c;
  });
  mockDevRuntimeVariables.charBackgrounds = charBgRecord;

  // 2. 深度合併 database patch (database 覆蓋 staticData) - 原地修改物件
  deepMergeMutate(mockChatVariables, chatDatabasePatch);
  deepMergeMutate(mockMvuVariables, mvuDatabasePatch as MvuVariables);

  // 注意：Debug 面板的修改透過直接修改記憶體中的 mock 物件生效，
  // 不再使用 sessionStorage 持久化。iframe 重載時自然回到預設狀態。

  // 3. 補齊 NPC 的基本空欄位並進行身體部位與改造的同步
  Object.keys(mockMvuVariables.chars).forEach(key => {
    const char = mockMvuVariables.chars[key];
    if (char) {
      if (!char.identity) {
        char.identity = '體育生';
      }
      if (!char.inventory) {
        char.inventory = {};
      }
      syncCharacterBodyParts(char, mockChatVariables.bodyParts);
    }
  });

  console.info('[HypnoOS][mockDatabase] 模擬資料載入完成。');
}

// 在模組首次載入時自動執行一次初始化
loadSimulationVariables();
