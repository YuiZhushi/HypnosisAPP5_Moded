/**
 * PersistedStore 的 Zod Schema（Phase D-2）
 * 
 * 這個 schema 原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import { z } from 'zod';
import type { PersistedStore } from '../types/persistedStore';
import { DEFAULT_CALENDAR_CRUD } from '../types/persistedStore';

/**
 * PersistedStore 的完整 Zod Schema 喵~
 * 用於驗證和解析從酒館變數讀取的資料
 */
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
              .object({
                triggered: z.coerce.boolean().default(false),
                deleteFrom: z.coerce.number().optional(),
              })
              .default({}),
            deleteSwipe: z
              .object({
                triggered: z.coerce.boolean().default(false),
                floor: z.coerce.number().optional(),
                swipeId: z.coerce.number().optional(),
                newSwipeId: z.coerce.number().optional(),
              })
              .default({}),
            switchSwipe: z
              .object({
                triggered: z.coerce.boolean().default(false),
                floor: z.coerce.number().optional(),
              })
              .default({}),
          })
          .default({}),
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
