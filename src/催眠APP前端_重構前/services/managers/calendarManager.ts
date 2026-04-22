import type {
  CalendarCrudOp,
  CalendarCrudNode,
  CalendarCrudStore,
  CalendarResolvedState,
  CalendarEventResolved,
  CalendarEventPatch,
  CustomCalendarEvent,
  PersistedStore,
} from '../types/persistedStore';
import { DEFAULT_CALENDAR_CRUD, normalizeCalendarCrudStore } from '../types/persistedStore';

// === Calendar CRUD Resolver ===

export function floorKey(floor: number): string {
  return String(Math.max(0, Math.trunc(floor)));
}

export function swipeKey(swipeId: number): string {
  return String(Math.max(0, Math.trunc(swipeId)));
}

export function cloneResolvedState<T extends CalendarResolvedState>(state: T): T {
  return {
    ...state,
    events: Object.fromEntries(
      Object.entries(state.events).map(([k, v]) => [k, { ...v }])
    ) as Record<string, CalendarEventResolved>
  } as T;
}

export function applyCrudOp<
  TState extends CalendarResolvedState,
  TOp extends
    | {
        type: 'add';
        eventId: string;
        month: number;
        day: number;
        title: string;
        description?: string;
      }
    | {
        type: 'edit';
        eventId: string;
        patch: { month?: number; day?: number; title?: string; description?: string | null };
      }
    | { type: 'delete'; eventId: string }
>(state: TState, op: TOp): void {
  if (op.type === 'add') {
    state.events[op.eventId] = {
      id: op.eventId,
      month: op.month,
      day: op.day,
      title: op.title,
      ...(op.description ? { description: op.description } : {}),
    };
    return;
  }
  if (op.type === 'edit') {
    const curr = state.events[op.eventId];
    if (!curr) return;
    const next = { ...curr };
    if (op.patch.month !== undefined) next.month = op.patch.month;
    if (op.patch.day !== undefined) next.day = op.patch.day;
    if (op.patch.title !== undefined) next.title = op.patch.title;
    if (op.patch.description !== undefined) {
      if (op.patch.description === null) delete next.description;
      else if (op.patch.description) next.description = op.patch.description;
      else delete next.description;
    }
    state.events[op.eventId] = next;
    return;
  }
  delete state.events[op.eventId];
}

export function getSnapshotBaseFloor(targetFloor: number, interval: number): number {
  if (targetFloor < 0) return -1;
  if (targetFloor % interval === 0) return targetFloor - interval;
  return targetFloor - (targetFloor % interval);
}

export function resolveCalendarStateAtCrud<
  TStore,
  TCrud extends {
    snapshotInterval: number;
    lastKnownCurrentFloor: number;
    floorSelectedSwipe: Record<string, number>;
    nodes: Record<string, Record<string, CalendarCrudNode>>;
    snapshots: Record<string, CalendarResolvedState>;
  }
>(
  store: TStore,
  targetFloor: number,
  deps: {
    ensureCalendarCrud: (store: TStore) => TCrud;
    debug: boolean;
    logger?: (payload: unknown) => void;
  }
): CalendarResolvedState {
  const crud = deps.ensureCalendarCrud(store);
  const interval = Math.max(1, crud.snapshotInterval || 50);
  const appliedNodes: Array<{ floor: number; swipeId: number; opCount: number; source: 'selected' | 'fallback_s0' }> = [];
  const snapshotFloors = Object.keys(crud.snapshots)
    .map(Number)
    .filter(n => Number.isFinite(n) && n <= targetFloor)
    .sort((a, b) => a - b);
  const startSnapshotFloor = snapshotFloors.length ? snapshotFloors[snapshotFloors.length - 1] : -1;
  const startState: CalendarResolvedState =
    startSnapshotFloor >= 0 && crud.snapshots[String(startSnapshotFloor)]
      ? cloneResolvedState(crud.snapshots[String(startSnapshotFloor)])
      : { events: {} };

  const floors = Object.keys(crud.floorSelectedSwipe)
    .map(Number)
    .filter(n => Number.isFinite(n) && n > startSnapshotFloor && n <= targetFloor)
    .sort((a, b) => a - b);
  for (const floor of floors) {
    const selected = crud.floorSelectedSwipe[floorKey(floor)] ?? 0;
    const node = crud.nodes[floorKey(floor)]?.[swipeKey(selected)];
    if (!node) continue;
    if (deps.debug) {
      appliedNodes.push({ floor, swipeId: selected, opCount: node.ops.length, source: 'selected' });
    }
    for (const op of node.ops) applyCrudOp(startState, op as Parameters<typeof applyCrudOp<TCrud['snapshots'][string], CalendarCrudOp>>[1]);
  }

  for (const [fKey, swipeMap] of Object.entries(crud.nodes)) {
    const floor = Number(fKey);
    if (!Number.isFinite(floor) || floor <= startSnapshotFloor || floor > targetFloor) continue;
    if (crud.floorSelectedSwipe[fKey] !== undefined) continue;
    const node = swipeMap['0'];
    if (!node) continue;
    if (deps.debug) {
      appliedNodes.push({ floor, swipeId: 0, opCount: node.ops.length, source: 'fallback_s0' });
    }
    for (const op of node.ops) applyCrudOp(startState, op as Parameters<typeof applyCrudOp<TCrud['snapshots'][string], CalendarCrudOp>>[1]);
  }

  if (targetFloor > crud.lastKnownCurrentFloor) {
    const checkpoint = targetFloor - 2;
    if (checkpoint >= 0 && checkpoint % interval === 0 && !crud.snapshots[String(checkpoint)]) {
      crud.snapshots[String(checkpoint)] = cloneResolvedState(startState);
    }
    crud.lastKnownCurrentFloor = targetFloor;
  }

  if (deps.debug) {
    deps.logger?.({
      targetFloor,
      snapshotUsed: startSnapshotFloor >= 0,
      startSnapshotFloor,
      snapshotKnownFloors: snapshotFloors,
      appliedNodes,
      eventCount: Object.keys(startState.events).length,
    });
  }

  return startState;
}

export function cleanupAfterRollbackCrud<
  TStore,
  TCrud extends {
    snapshotInterval: number;
    lastKnownCurrentFloor: number;
    nodes: Record<string, Record<string, CalendarCrudNode>>;
    floorSelectedSwipe: Record<string, number>;
    snapshots: Record<string, CalendarResolvedState>;
  }
>(
  store: TStore,
  currentFloor: number,
  deps: {
    ensureCalendarCrud: (store: TStore) => TCrud;
  }
): void {
  const crud = deps.ensureCalendarCrud(store);
  for (const key of Object.keys(crud.nodes)) {
    if (Number(key) > currentFloor) delete crud.nodes[key];
  }
  for (const key of Object.keys(crud.floorSelectedSwipe)) {
    if (Number(key) > currentFloor) delete crud.floorSelectedSwipe[key];
  }
  const interval = Math.max(1, crud.snapshotInterval || 50);
  const keepBase = getSnapshotBaseFloor(currentFloor, interval);
  for (const key of Object.keys(crud.snapshots)) {
    if (Number(key) > keepBase) delete crud.snapshots[key];
  }
  crud.lastKnownCurrentFloor = currentFloor;
}

// === Calendar CRUD Store ===

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

// === Calendar Event Impl ===

// 外部依賴類型定義
type NormalizeChatVariablesFn = (vars: any) => { system: any; store: PersistedStore };
type GetCurrentFloorAndSwipeFn = () => { floor: number; swipeId: number };
type ResolveCalendarStateAtFn = (store: PersistedStore, targetFloor: number) => CalendarResolvedState;
type UpdateStoreWithFn = (callback: (store: PersistedStore) => PersistedStore | Promise<PersistedStore>) => Promise<PersistedStore>;
type GetChatMessagesFn = (floor: number, options?: { include_swipes?: boolean }) => unknown[] | undefined;

/**
 * 建立 Calendar *Impl 函式的工廠函式喵~
 */
import {
  normalizeChatVariables,
  CHAT_OPTION,
  updateStoreWith,
  getVariables,
  getChatMessages,
} from './systemCoreManager';

export function createCalendarEventImplFunctions(deps: {
  getCurrentFloorAndSwipe: () => { floor: number; swipeId: number };
  resolveCalendarStateAt: (store: PersistedStore, targetFloor: number) => CalendarResolvedState;
  CALENDAR_CRUD_RESOLVE_DEBUG: boolean;
}) {
  const {
    getCurrentFloorAndSwipe,
    resolveCalendarStateAt,
    CALENDAR_CRUD_RESOLVE_DEBUG,
  } = deps;

  /**
   * 取得日曆事件列表喵~
   */
  function getCalendarEventsImpl(): CustomCalendarEvent[] {
    const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
    const { floor, swipeId } = getCurrentFloorAndSwipe();
    const crud = ensureCalendarCrud(store);
    if (crud.floorSelectedSwipe[floorKey(floor)] === undefined) {
      crud.floorSelectedSwipe[floorKey(floor)] = swipeId;
    }
    const resolved = resolveCalendarStateAt(store, floor);
    return Object.values(resolved.events);
  }

  /**
   * 處理 bridge 事件喵~
   */
  async function processCalendarBridgeEventsOnLoadImpl(): Promise<void> {
    await updateStoreWith(store => {
      const crud = ensureCalendarCrud(store);
      const current = getCurrentFloorAndSwipe();

      if (current.floor < crud.lastKnownCurrentFloor) {
        cleanupAfterRollback(store, current.floor);
      }

      if (crud.bridge.deleteFloor.triggered && Number.isFinite(crud.bridge.deleteFloor.deleteFrom)) {
        const deleteFrom = Math.max(0, Math.trunc(Number(crud.bridge.deleteFloor.deleteFrom)));
        const pruneFrom = deleteFrom;
        for (const key of Object.keys(crud.nodes)) {
          if (Number(key) >= pruneFrom) delete crud.nodes[key];
        }
        for (const key of Object.keys(crud.floorSelectedSwipe)) {
          if (Number(key) >= pruneFrom) delete crud.floorSelectedSwipe[key];
        }
        for (const key of Object.keys(crud.snapshots)) {
          if (Number(key) >= pruneFrom) delete crud.snapshots[key];
        }
        crud.bridge.deleteFloor = { triggered: false };
      }

      if (
        crud.bridge.deleteSwipe.triggered &&
        Number.isFinite(crud.bridge.deleteSwipe.floor) &&
        Number.isFinite(crud.bridge.deleteSwipe.swipeId) &&
        Number.isFinite(crud.bridge.deleteSwipe.newSwipeId)
      ) {
        const floor = Math.max(0, Math.trunc(Number(crud.bridge.deleteSwipe.floor)));
        const swipeId = Math.max(0, Math.trunc(Number(crud.bridge.deleteSwipe.swipeId)));
        const nextSwipeId = Math.max(0, Math.trunc(Number(crud.bridge.deleteSwipe.newSwipeId)));
        const fk = floorKey(floor);
        const swipeMap = crud.nodes[fk] ?? {};

        const rebuilt: Record<string, CalendarCrudNode> = {};
        for (const [key, node] of Object.entries(swipeMap)) {
          const oldIndex = Number(key);
          if (!Number.isFinite(oldIndex)) continue;
          if (oldIndex === swipeId) continue;

          const newIndex = oldIndex > swipeId ? oldIndex - 1 : oldIndex;
          rebuilt[swipeKey(newIndex)] = {
            ...node,
            floor,
            swipeId: newIndex,
            ops: [...(node.ops ?? [])],
          };
        }
        crud.nodes[fk] = rebuilt;

        const existingSwipeIndexes = Object.keys(rebuilt)
          .map(Number)
          .filter(n => Number.isFinite(n))
          .sort((a, b) => a - b);
        const selectedSwipe =
          existingSwipeIndexes.length > 0
            ? Math.min(nextSwipeId, existingSwipeIndexes[existingSwipeIndexes.length - 1])
            : 0;
        crud.floorSelectedSwipe[fk] = selectedSwipe;
        crud.bridge.deleteSwipe = { triggered: false };
      }

      if (crud.bridge.switchSwipe.triggered) {
        const floor = Number.isFinite(crud.bridge.switchSwipe.floor)
          ? Math.max(0, Math.trunc(Number(crud.bridge.switchSwipe.floor)))
          : current.floor;
        const message = getChatMessages(floor, { include_swipes: true })?.[0] as { swipe_id?: number } | undefined;
        const swipe = Math.max(0, Number(message?.swipe_id ?? 0) || 0);
        crud.floorSelectedSwipe[floorKey(floor)] = swipe;
        crud.bridge.switchSwipe = { triggered: false };
      }

      if (crud.floorSelectedSwipe[floorKey(current.floor)] === undefined) {
        crud.floorSelectedSwipe[floorKey(current.floor)] = current.swipeId;
      }

      resolveCalendarStateAt(store, current.floor);
      return store;
    });
  }

  /**
   * 新增日曆事件喵~
   */
  async function addCalendarEventImpl(params: {
    month: number;
    day: number;
    title: string;
    description?: string;
  }): Promise<{ ok: boolean; id?: string; message?: string }> {
    const trimmedTitle = params.title.trim();
    if (!trimmedTitle) return { ok: false, message: '标题不能为空' };

    const existing = getCalendarEventsImpl().find(
      e => e.title === trimmedTitle && e.month === params.month && e.day === params.day
    );
    if (existing) {
      console.info(`[HypnoOS] 日历事件「${trimmedTitle}」(${params.month}月${params.day}日) 已存在，跳过新增`);
      return { ok: true, id: existing.id };
    }

    const id = `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { floor, swipeId } = getCurrentFloorAndSwipe();
    const description = params.description?.trim() || undefined;

    await updateStoreWith(s => ({
      ...(() => {
        const crud = ensureCalendarCrud(s);
        crud.floorSelectedSwipe[floorKey(floor)] = swipeId;
        const node = ensureNode(crud, floor, swipeId);
        node.ops.push({
          opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          type: 'add',
          eventId: id,
          month: params.month,
          day: params.day,
          title: trimmedTitle,
          ...(description ? { description } : {}),
          createdAt: Date.now(),
        });
        node.updatedAt = Date.now();
        resolveCalendarStateAt(s, floor);
        return s;
      })(),
    }));

    console.info(`[HypnoOS] 新增日历事件「${trimmedTitle}」(${params.month}月${params.day}日)`);
    return { ok: true, id };
  }

  /**
   * 更新日曆事件喵~
   */
  async function updateCalendarEventImpl(
    id: string,
    patch: { title?: string; description?: string; month?: number; day?: number }
  ): Promise<{ ok: boolean; message?: string }> {
    const currentEvents = getCalendarEventsImpl();
    const existing = currentEvents.find(e => e.id === id);
    if (!existing) return { ok: false, message: '未找到该事件' };

    const nextTitle = patch.title !== undefined ? patch.title.trim() : existing.title;
    const nextMonth = patch.month ?? existing.month;
    const nextDay = patch.day ?? existing.day;
    const nextDescRaw = patch.description !== undefined ? patch.description.trim() : existing.description;
    const nextDescription = patch.description !== undefined && nextDescRaw === '' ? undefined : nextDescRaw;

    const updated: CustomCalendarEvent = {
      id,
      title: nextTitle,
      month: nextMonth,
      day: nextDay,
      ...(nextDescription ? { description: nextDescription } : {}),
    };
    if (!updated.title) return { ok: false, message: '标题不能为空' };

    const sameNameConflict = currentEvents.some(
      e => e.id !== id && e.month === updated.month && e.day === updated.day && e.title === updated.title
    );
    if (sameNameConflict) return { ok: false, message: '同日期已存在同名事件' };

    const { floor, swipeId } = getCurrentFloorAndSwipe();
    await updateStoreWith(s => ({
      ...(() => {
        const crud = ensureCalendarCrud(s);
        crud.floorSelectedSwipe[floorKey(floor)] = swipeId;
        const node = ensureNode(crud, floor, swipeId);

        const addIdx = node.ops.findIndex(op => op.type === 'add' && op.eventId === id);
        if (addIdx >= 0) {
          const addOp = node.ops[addIdx] as Extract<CalendarCrudOp, { type: 'add' }>;
          addOp.title = updated.title;
          addOp.month = updated.month;
          addOp.day = updated.day;
          if (updated.description) addOp.description = updated.description;
          else delete addOp.description;
        } else {
          const editIdx = node.ops.findIndex(op => op.type === 'edit' && op.eventId === id);
          const patchData: CalendarEventPatch = {
            ...(patch.title !== undefined ? { title: updated.title } : {}),
            ...(patch.month !== undefined ? { month: updated.month } : {}),
            ...(patch.day !== undefined ? { day: updated.day } : {}),
            ...(patch.description !== undefined
              ? { description: patch.description.trim() ? patch.description.trim() : null }
              : {}),
          };
          if (editIdx >= 0) {
            const editOp = node.ops[editIdx] as Extract<CalendarCrudOp, { type: 'edit' }>;
            editOp.patch = { ...editOp.patch, ...patchData };
          } else {
            node.ops.push({
              opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              type: 'edit',
              eventId: id,
              patch: patchData,
              createdAt: Date.now(),
            });
          }
        }

        node.updatedAt = Date.now();
        resolveCalendarStateAt(s, floor);
        return s;
      })(),
    }));

    console.info(`[HypnoOS] 修改日历事件「${updated.title}」`);
    return { ok: true };
  }

  /**
   * 刪除日曆事件喵~
   */
  async function deleteCalendarEventImpl(id: string): Promise<{ ok: boolean; message?: string }> {
    const existing = getCalendarEventsImpl().find(e => e.id === id);
    if (!existing) return { ok: false, message: '未找到该事件' };

    const { floor, swipeId } = getCurrentFloorAndSwipe();
    await updateStoreWith(s => {
      const crud = ensureCalendarCrud(s);
      crud.floorSelectedSwipe[floorKey(floor)] = swipeId;
      const node = ensureNode(crud, floor, swipeId);

      const addIdx = node.ops.findIndex(op => op.type === 'add' && op.eventId === id);
      if (addIdx >= 0) {
        node.ops.splice(addIdx, 1);
      } else {
        const existingDeleteIdx = node.ops.findIndex(op => op.type === 'delete' && op.eventId === id);
        if (existingDeleteIdx < 0) {
          node.ops.push({
            opId: `op_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: 'delete',
            eventId: id,
            createdAt: Date.now(),
          });
        }
      }

      node.updatedAt = Date.now();
      resolveCalendarStateAt(s, floor);
      return s;
    });

    console.info(`[HypnoOS] 删除日历事件「${existing.title}」`);
    return { ok: true };
  }

  /**
   * 根據標題和日期查找日曆事件喵~
   */
  function findCalendarEventByTitleAndDateImpl(title: string, month: number, day: number): CustomCalendarEvent | undefined {
    const events = getCalendarEventsImpl();
    return events.find(e => e.title === title && e.month === month && e.day === day);
  }

  return {
    getCalendarEventsImpl,
    processCalendarBridgeEventsOnLoadImpl,
    addCalendarEventImpl,
    updateCalendarEventImpl,
    deleteCalendarEventImpl,
    findCalendarEventByTitleAndDateImpl,
  };
}

export type CalendarEventUsecaseFns = ReturnType<typeof createCalendarEventImplFunctions>;
