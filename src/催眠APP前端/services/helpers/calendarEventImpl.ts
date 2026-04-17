/**
 * 日曆事件 *Impl 函式實作（Phase D-2）
 * 
 * 這些函式原本在 dataService.ts 中，現已下沉至此模組喵~
 */

import type { CustomCalendarEvent } from '../types/persistedStore';
import type { CalendarCrudNode, CalendarCrudOp, CalendarEventPatch, CalendarResolvedState, PersistedStore } from '../types/persistedStore';
import { MvuBridge } from '../mvuBridge';
import { ensureCalendarCrud, ensureNode, cleanupAfterRollback as cleanupAfterRollbackCalendarStore } from './calendarCrudStore';
import { floorKey, swipeKey } from './calendarCrudResolver';

// 外部依賴類型定義
type NormalizeChatVariablesFn = (vars: any) => { system: any; store: PersistedStore };
type GetCurrentFloorAndSwipeFn = () => { floor: number; swipeId: number };
type ResolveCalendarStateAtFn = (store: PersistedStore, targetFloor: number) => CalendarResolvedState;
type UpdateStoreWithFn = (callback: (store: PersistedStore) => PersistedStore | Promise<PersistedStore>) => Promise<PersistedStore>;
type GetChatMessagesFn = (floor: number, options?: { include_swipes?: boolean }) => unknown[] | undefined;
type GetCalendarEventsFn = () => CustomCalendarEvent[];

/**
 * 建立 Calendar *Impl 函式的工廠函式喵~
 */
export function createCalendarEventImplFunctions(deps: {
  normalizeChatVariables: NormalizeChatVariablesFn;
  getVariables: (option?: any) => any;
  CHAT_OPTION: { type: 'chat' };
  getCurrentFloorAndSwipe: GetCurrentFloorAndSwipeFn;
  resolveCalendarStateAt: ResolveCalendarStateAtFn;
  updateStoreWith: UpdateStoreWithFn;
  getChatMessages: GetChatMessagesFn;
  getCalendarEvents: GetCalendarEventsFn;
  CALENDAR_CRUD_RESOLVE_DEBUG: boolean;
}) {
  const { normalizeChatVariables, getVariables, CHAT_OPTION, getCurrentFloorAndSwipe, resolveCalendarStateAt, updateStoreWith, getChatMessages, getCalendarEvents, CALENDAR_CRUD_RESOLVE_DEBUG } = deps;

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
        cleanupAfterRollbackCalendarStore(store, current.floor);
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

    const existing = getCalendarEvents().find(
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
    const currentEvents = getCalendarEvents();
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
    const existing = getCalendarEvents().find(e => e.id === id);
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
    const events = getCalendarEvents();
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

// 匯出類型供外部使用喵~
export type CalendarEventImplFns = ReturnType<typeof createCalendarEventImplFunctions>;
