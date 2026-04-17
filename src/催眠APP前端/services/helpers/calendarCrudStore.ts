import {
  cleanupAfterRollbackCrud,
  floorKey,
  resolveCalendarStateAtCrud,
  swipeKey,
} from './calendarCrudResolver';
import {
  CalendarCrudNode,
  CalendarCrudStore,
  CalendarResolvedState,
  DEFAULT_CALENDAR_CRUD,
  PersistedStore,
  normalizeCalendarCrudStore,
} from '../types/persistedStore';

/**
 * 確保 store 內 calendarCRUD 可用（含 normalize 與回填）。
 */
export function ensureCalendarCrud(store: PersistedStore): CalendarCrudStore {
  const normalized = normalizeCalendarCrudStore(store.calendarCRUD ?? DEFAULT_CALENDAR_CRUD);
  store.calendarCRUD = normalized;
  return normalized;
}

/**
 * 確保 floor+swipe 對應節點存在。
 */
export function ensureNode(crud: CalendarCrudStore, floor: number, swipeId: number): CalendarCrudNode {
  const fk = floorKey(floor);
  const sk = swipeKey(swipeId);
  if (!crud.nodes[fk]) crud.nodes[fk] = {};
  if (!crud.nodes[fk][sk]) {
    crud.nodes[fk][sk] = { floor: Number(fk), swipeId: Number(sk), ops: [], updatedAt: Date.now() };
  }
  return crud.nodes[fk][sk];
}

/**
 * 封裝 resolver，保留 debug 路徑輸出能力。
 */
export function resolveCalendarStateAt(
  store: PersistedStore,
  targetFloor: number,
  options: { debug: boolean; logger?: (payload: unknown) => void },
): CalendarResolvedState {
  return resolveCalendarStateAtCrud(store, targetFloor, {
    ensureCalendarCrud,
    debug: options.debug,
    logger: options.logger,
  });
}

export function cleanupAfterRollback(store: PersistedStore, currentFloor: number): void {
  cleanupAfterRollbackCrud(store, currentFloor, { ensureCalendarCrud });
}

/**
 * 取得目前樓層與 swipe；在初載時對 currentMessageId 落後做容錯。
 */
export function getCurrentFloorAndSwipe(deps: {
  getCurrentMessageId?: () => number;
  getChatMessages: (floor: number, opts: { include_swipes: boolean }) => Array<{ message_id?: number; swipe_id?: number }> | undefined;
}): { floor: number; swipeId: number } {
  const currentFromApi = Math.max(0, Number(deps.getCurrentMessageId?.() ?? 0) || 0);
  const latest = deps.getChatMessages(-1, { include_swipes: true })?.[0] as
    | { message_id?: number; swipe_id?: number }
    | undefined;
  const latestFloor = Math.max(0, Number(latest?.message_id ?? 0) || 0);

  const floor = Math.max(currentFromApi, latestFloor);

  const msgAtFloor =
    floor === latestFloor && latest
      ? latest
      : ((deps.getChatMessages(floor, { include_swipes: true })?.[0] as { swipe_id?: number } | undefined) ?? latest);

  return { floor, swipeId: Math.max(0, Number(msgAtFloor?.swipe_id ?? 0) || 0) };
}
