import { CustomHypnosisDef, EditorPromptModule, QuestStatus } from '../../types';

export type CustomQuestDef = {
  name: string;
  condition: string;
  rewardMcPoints: number;
  createdAt: number;
};

export type CustomCalendarEvent = {
  id: string;
  month: number;
  day: number;
  title: string;
  description?: string;
};

export type CalendarEventResolved = CustomCalendarEvent;

export type CalendarEventPatch = {
  month?: number;
  day?: number;
  title?: string;
  description?: string | null;
};

export type CalendarCrudOp =
  | {
      opId: string;
      type: 'add';
      eventId: string;
      month: number;
      day: number;
      title: string;
      description?: string;
      createdAt: number;
    }
  | {
      opId: string;
      type: 'edit';
      eventId: string;
      patch: CalendarEventPatch;
      createdAt: number;
    }
  | {
      opId: string;
      type: 'delete';
      eventId: string;
      createdAt: number;
    };

export type CalendarCrudNode = {
  floor: number;
  swipeId: number;
  ops: CalendarCrudOp[];
  updatedAt: number;
};

export type CalendarResolvedState = {
  events: Record<string, CalendarEventResolved>;
};

export type CalendarBridgeStore = {
  deleteFloor: { triggered: boolean; deleteFrom?: number };
  deleteSwipe: { triggered: boolean; floor?: number; swipeId?: number; newSwipeId?: number };
  switchSwipe: { triggered: boolean; floor?: number };
};

export type CalendarCrudStore = {
  version: number;
  snapshotInterval: number;
  lastKnownCurrentFloor: number;
  floorSelectedSwipe: Record<string, number>;
  nodes: Record<string, Record<string, CalendarCrudNode>>;
  snapshots: Record<string, CalendarResolvedState>;
  bridge: CalendarBridgeStore;
};

export const DEFAULT_CALENDAR_CRUD: CalendarCrudStore = {
  version: 1,
  snapshotInterval: 50,
  lastKnownCurrentFloor: -1,
  floorSelectedSwipe: {},
  nodes: {},
  snapshots: {},
  bridge: {
    deleteFloor: { triggered: false },
    deleteSwipe: { triggered: false },
    switchSwipe: { triggered: false },
  },
};

export function normalizeCalendarCrudStore(raw: unknown): CalendarCrudStore {
  const input = (raw && typeof raw === 'object' ? raw : {}) as Partial<CalendarCrudStore>;
  return {
    version: 1,
    snapshotInterval: 50,
    lastKnownCurrentFloor: Number.isFinite(Number(input.lastKnownCurrentFloor)) ? Number(input.lastKnownCurrentFloor) : -1,
    floorSelectedSwipe: { ...(input.floorSelectedSwipe ?? {}) },
    nodes: { ...(input.nodes ?? {}) },
    snapshots: { ...(input.snapshots ?? {}) },
    bridge: {
      deleteFloor: { triggered: Boolean(input.bridge?.deleteFloor?.triggered), deleteFrom: input.bridge?.deleteFloor?.deleteFrom },
      deleteSwipe: {
        triggered: Boolean(input.bridge?.deleteSwipe?.triggered),
        floor: input.bridge?.deleteSwipe?.floor,
        swipeId: input.bridge?.deleteSwipe?.swipeId,
        newSwipeId: input.bridge?.deleteSwipe?.newSwipeId,
      },
      switchSwipe: { triggered: Boolean(input.bridge?.switchSwipe?.triggered), floor: input.bridge?.switchSwipe?.floor },
    },
  };
}

export type PersistedStore = {
  version: number;
  debugEnabled: boolean;
  sessionEndVirtualMinutes?: number;
  sessionEndAtMs?: number;
  hasUsedHypnosis: boolean;
  subscription?: {
    tier: 'VIP1' | 'VIP2' | 'VIP3' | 'VIP4' | 'VIP5';
    endVirtualMinutes: number;
    autoRenew: boolean;
  };
  features: Record<string, { isEnabled?: boolean; userNote?: string; userNumber?: number }>;
  purchases: Record<string, boolean>;
  achievements: Record<string, boolean>;
  quests: Record<string, QuestStatus>;
  customQuests: Record<string, CustomQuestDef>;
  calendarEvents: Record<string, CustomCalendarEvent>;
  calendarCRUD?: CalendarCrudStore;
  customHypnosis: Record<string, CustomHypnosisDef>;
  apiSettings?: {
    apiKey: string;
    apiEndpoint: string;
    modelName: string;
    temperature: number;
    maxTokens: number;
    topP: number;
    presencePenalty: number;
    frequencyPenalty: number;
    streamMode?: 'streaming' | 'fake_streaming' | 'non_streaming';
    topK?: number;
  };
  settingsPromptTuning?: {
    modules: Record<
      string,
      {
        id: string;
        title: string;
        content: string;
        enabled: boolean;
      }
    >;
    moduleOrder: string[];
    placeholders: Record<
      string,
      {
        key: string;
        value: string;
        enabled: boolean;
        source: 'built_in' | 'user' | 'worldbook' | 'runtime';
        resolverType: 'static' | 'function';
        scope: 'app';
      }
    >;
  };
  editorPromptModules?: Record<
    string,
    {
      id: string;
      title: string;
      content: string;
      type: 'fixed' | 'section_content' | 'section_format' | 'section_instruction';
      sectionId?: string;
      order: number;
    }
  >;
};

export type PersistedEditorPromptRecord = NonNullable<PersistedStore['editorPromptModules']>;
export type PersistedEditorPromptItem = PersistedEditorPromptRecord[string];

export type PersistedStoreSettingsPromptModule = NonNullable<PersistedStore['settingsPromptTuning']>['modules'][string];

export type PersistedEditorPrompt = Pick<EditorPromptModule, 'id' | 'title' | 'content' | 'type' | 'sectionId' | 'order'>;
