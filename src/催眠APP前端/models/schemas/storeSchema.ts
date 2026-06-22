/**
 * PersistedStore 類型定義與 Zod Schema
 *
 * PersistedStore 是 HypnoOS 的核心持久化數據結構，
 * 存儲在酒館聊天變量 `系統._hypnoos` 中。
 */

import { z } from 'zod';
import type { QuestStatus, StreamMode, EditorPromptModuleType, SubscriptionTier, VipTier, CustomHypnosisDef, EditorPromptModule } from '..';

// ====== Calendar CRUD 類型 ======

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
  | { opId: string; type: 'edit'; eventId: string; patch: CalendarEventPatch; createdAt: number }
  | { opId: string; type: 'delete'; eventId: string; createdAt: number };

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
    lastKnownCurrentFloor: Number.isFinite(Number(input.lastKnownCurrentFloor))
      ? Number(input.lastKnownCurrentFloor)
      : -1,
    floorSelectedSwipe: { ...(input.floorSelectedSwipe ?? {}) },
    nodes: { ...(input.nodes ?? {}) },
    snapshots: { ...(input.snapshots ?? {}) },
    bridge: {
      deleteFloor: {
        triggered: Boolean(input.bridge?.deleteFloor?.triggered),
        deleteFrom: input.bridge?.deleteFloor?.deleteFrom,
      },
      deleteSwipe: {
        triggered: Boolean(input.bridge?.deleteSwipe?.triggered),
        floor: input.bridge?.deleteSwipe?.floor,
        swipeId: input.bridge?.deleteSwipe?.swipeId,
        newSwipeId: input.bridge?.deleteSwipe?.newSwipeId,
      },
      switchSwipe: {
        triggered: Boolean(input.bridge?.switchSwipe?.triggered),
        floor: input.bridge?.switchSwipe?.floor,
      },
    },
  };
}

// ====== PersistedStore 主類型 ======

export type PersistedStore = {
  version: number;
  debugEnabled: boolean;
  sessionEndVirtualMinutes?: number;
  sessionEndAtMs?: number;
  hasUsedHypnosis: boolean;
  subscription?: {
    tier: SubscriptionTier;
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
    streamMode?: StreamMode;
    topK?: number;
  };
  settingsPromptTuning?: {
    modules: Record<string, { id: string; title: string; content: string; enabled: boolean }>;
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
      type: EditorPromptModuleType;
      sectionId?: string;
      order: number;
    }
  >;
};

// ====== 衍生類型別名 ======

export type PersistedEditorPromptRecord = NonNullable<PersistedStore['editorPromptModules']>;
export type PersistedEditorPromptItem = PersistedEditorPromptRecord[string];
export type PersistedStoreSettingsPromptModule = NonNullable<PersistedStore['settingsPromptTuning']>['modules'][string];
export type PersistedEditorPrompt = Pick<
  EditorPromptModule,
  'id' | 'title' | 'content' | 'type' | 'sectionId' | 'order'
>;

// ====== Zod Schema ======

export const STORE_SCHEMA: z.ZodType<PersistedStore> = z
  .object({
    version: z.coerce.number().default(1),
    debugEnabled: z.coerce.boolean().default(false),
    sessionEndVirtualMinutes: z.coerce.number().optional(),
    sessionEndAtMs: z.coerce.number().optional(),
    hasUsedHypnosis: z.coerce.boolean().default(false),
    subscription: z
      .object({
        tier: z.enum(['VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5']),
        endVirtualMinutes: z.coerce.number(),
        autoRenew: z.coerce.boolean().default(false),
      })
      .optional(),
    features: z
      .record(
        z.string(),
        z
          .object({
            isEnabled: z.boolean().optional(),
            userNote: z.string().optional(),
            userNumber: z.coerce.number().optional(),
          })
          .passthrough(),
      )
      .default({}),
    purchases: z.record(z.string(), z.coerce.boolean()).default({}),
    achievements: z.record(z.string(), z.boolean()).default({}),
    quests: z.record(z.string(), z.enum(['AVAILABLE', 'ACTIVE', 'COMPLETED', 'CLAIMED'])).default({}),
    customQuests: z
      .record(
        z.string(),
        z.object({
          name: z.string(),
          condition: z.string(),
          rewardMcPoints: z.coerce.number(),
          createdAt: z.coerce.number(),
        }),
      )
      .default({}),
    calendarEvents: z
      .record(
        z.string(),
        z.object({
          id: z.string(),
          month: z.coerce.number(),
          day: z.coerce.number(),
          title: z.string(),
          description: z.string().optional(),
        }),
      )
      .default({}),
    calendarCRUD: z
      .object({
        version: z.coerce.number().default(1),
        snapshotInterval: z.coerce.number().default(50),
        lastKnownCurrentFloor: z.coerce.number().default(-1),
        floorSelectedSwipe: z.record(z.string(), z.coerce.number()).default({}),
        nodes: z.record(z.string(), z.record(z.string(), z.any())).default({}),
        snapshots: z.record(z.string(), z.any()).default({}),
        bridge: z
          .object({
            deleteFloor: z
              .object({ triggered: z.coerce.boolean().default(false), deleteFrom: z.coerce.number().optional() })
              .default({ triggered: false }),
            deleteSwipe: z
              .object({
                triggered: z.coerce.boolean().default(false),
                floor: z.coerce.number().optional(),
                swipeId: z.coerce.number().optional(),
                newSwipeId: z.coerce.number().optional(),
              })
              .default({ triggered: false }),
            switchSwipe: z
              .object({ triggered: z.coerce.boolean().default(false), floor: z.coerce.number().optional() })
              .default({ triggered: false }),
          })
          .default({
            deleteFloor: { triggered: false },
            deleteSwipe: { triggered: false },
            switchSwipe: { triggered: false },
          }),
      })
      .optional(),
    customHypnosis: z
      .record(
        z.string(),
        z.object({
          id: z.string(),
          title: z.string(),
          description: z.string(),
          tier: z.enum(['TRIAL', 'VIP1', 'VIP2', 'VIP3', 'VIP4', 'VIP5', 'VIP6']),
          costType: z.enum(['ONE_TIME', 'PER_MINUTE']),
          costValue: z.coerce.number(),
          notePlaceholder: z.string().optional(),
          createdAt: z.coerce.number(),
          researchCost: z.coerce.number(),
        }),
      )
      .default({}),
    apiSettings: z
      .object({
        apiKey: z.string().default(''),
        apiEndpoint: z.string().default(''),
        modelName: z.string().default(''),
        temperature: z.coerce.number().min(0).max(2).default(0.7),
        maxTokens: z.coerce.number().int().min(1).default(8192),
        topP: z.coerce.number().min(0).max(1).default(1),
        presencePenalty: z.coerce.number().min(-2).max(2).default(0.2),
        frequencyPenalty: z.coerce.number().min(-2).max(2).default(0.15),
        streamMode: z.enum(['streaming', 'fake_streaming', 'non_streaming']).default('non_streaming'),
      })
      .optional(),
    settingsPromptTuning: z
      .object({
        modules: z
          .record(
            z.string(),
            z.object({
              id: z.string(),
              title: z.string(),
              content: z.string(),
              enabled: z.coerce.boolean().default(true),
            }),
          )
          .default({}),
        moduleOrder: z.array(z.string()).default([]),
        placeholders: z
          .record(
            z.string(),
            z.object({
              key: z.string(),
              value: z.string().default(''),
              enabled: z.coerce.boolean().default(true),
              source: z.enum(['built_in', 'user', 'worldbook', 'runtime']).default('user'),
              resolverType: z.enum(['static', 'function']).default('static'),
              scope: z.literal('app').default('app'),
            }),
          )
          .default({}),
      })
      .optional(),
    editorPromptModules: z
      .record(
        z.string(),
        z.object({
          id: z.string(),
          title: z.string(),
          content: z.string(),
          type: z.enum(['fixed', 'section_content', 'section_format', 'section_instruction']),
          sectionId: z.string().optional(),
          order: z.coerce.number().default(99),
        }),
      )
      .optional(),
  })
  .default({
    version: 1,
    debugEnabled: false,
    hasUsedHypnosis: false,
    features: {},
    purchases: {},
    achievements: {},
    quests: {},
    customQuests: {},
    calendarEvents: {},
    calendarCRUD: DEFAULT_CALENDAR_CRUD,
    customHypnosis: {},
  });
