/**
 * Store 遷移函式
 *
 * 處理舊版持久化數據格式到新版的轉換。
 * 純函式，無副作用。
 */

import type { CalendarCrudNode, PersistedStore } from '../../constants/schemas/storeSchema';
import { normalizeCalendarCrudStore, DEFAULT_CALENDAR_CRUD } from '../../constants/schemas/storeSchema';

export function migrateStore(store: PersistedStore): PersistedStore {
  // 遷移 promptTuning → settingsPromptTuning
  const storeAny = store as any;
  if (storeAny.promptTuning && !store.settingsPromptTuning) {
    store.settingsPromptTuning = storeAny.promptTuning;
  }
  delete storeAny.promptTuning;

  store.calendarCRUD = normalizeCalendarCrudStore(store.calendarCRUD ?? DEFAULT_CALENDAR_CRUD);

  // 舊資料一次性遷移：若沒有 calendarCRUD 節點但有 calendarEvents，收斂為 #0 swipe0 的 add 操作
  if (
    Object.keys(store.calendarEvents ?? {}).length > 0 &&
    Object.keys(store.calendarCRUD.nodes ?? {}).length === 0
  ) {
    const node: CalendarCrudNode = {
      floor: 0,
      swipeId: 0,
      updatedAt: Date.now(),
      ops: Object.values(store.calendarEvents).map(evt => ({
        opId: `migrated_add_${evt.id}`,
        type: 'add' as const,
        eventId: evt.id,
        month: evt.month,
        day: evt.day,
        title: evt.title,
        ...(evt.description ? { description: evt.description } : {}),
        createdAt: Date.now(),
      })),
    };
    store.calendarCRUD.nodes['0'] = { '0': node };
    store.calendarCRUD.floorSelectedSwipe['0'] = 0;
    store.calendarCRUD.lastKnownCurrentFloor = Math.max(store.calendarCRUD.lastKnownCurrentFloor, 0);
  }

  return store;
}
