/**
 * Calendar APP 後端 — 統一入口
 *
 * 職責：
 * - 日曆事件 CRUD（add / update / delete / get / find）
 * - CRUD 狀態解析（基於 floor+swipe 的事件回放引擎）
 * - Bridge 事件處理（外部腳本觸發的 deleteFloor / deleteSwipe / switchSwipe）
 * - AI 日曆操作處理（從 MVU 變量讀取 AI 產生的日曆指令）
 *
 * 所有函式透過 shared 層讀寫數據，不直接呼叫全域 API。
 */

import type {
  CalendarCrudOp,
  CalendarCrudNode,
  CalendarCrudStore,
  CalendarResolvedState,
  CalendarEventResolved,
  CalendarEventPatch,
  CustomCalendarEvent,
  PersistedStore,
} from '../../constants/schemas/storeSchema';
import { DEFAULT_CALENDAR_CRUD, normalizeCalendarCrudStore } from '../../constants/schemas/storeSchema';
import { normalizeChatVariables, readStoreSnapshot, updateStoreWith, CHAT_OPTION } from '../../shared/store/storeGateway';
import * as MvuBridge from '../../shared/mvu/mvuBridge';
import { logger } from '../../../催眠APP共用/debug/loggerService';

// ====== CRUD 引擎（純函數） ======

export function floorKey(floor: number): string {
  return String(Math.max(0, Math.trunc(floor)));
}

export function swipeKey(swipeId: number): string {
  return String(Math.max(0, Math.trunc(swipeId)));
}

function cloneResolvedState(state: CalendarResolvedState): CalendarResolvedState {
  return {
    ...state,
    events: Object.fromEntries(
      Object.entries(state.events).map(([k, v]) => [k, { ...v }]),
    ) as Record<string, CalendarEventResolved>,
  };
}

function applyCrudOp(state: CalendarResolvedState, op: CalendarCrudOp): void {
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

function ensureCalendarCrud(store: PersistedStore): CalendarCrudStore {
  const normalized = normalizeCalendarCrudStore(store.calendarCRUD ?? DEFAULT_CALENDAR_CRUD);
  store.calendarCRUD = normalized;
  return normalized;
}

function ensureNode(crud: CalendarCrudStore, floor: number, swipeId: number): CalendarCrudNode {
  const fk = floorKey(floor);
  const sk = swipeKey(swipeId);
  if (!crud.nodes[fk]) crud.nodes[fk] = {};
  if (!crud.nodes[fk][sk]) {
    crud.nodes[fk][sk] = { floor: Number(fk), swipeId: Number(sk), ops: [], updatedAt: Date.now() };
  }
  return crud.nodes[fk][sk];
}

/** 從快照基礎逐層回放 CRUD 操作，解析出目標樓層的日曆狀態 */
function resolveCalendarStateAt(
  store: PersistedStore,
  targetFloor: number,
  debug = false,
): CalendarResolvedState {
  const crud = ensureCalendarCrud(store);
  const interval = Math.max(1, crud.snapshotInterval || 50);

  // 找最近的快照
  const snapshotFloors = Object.keys(crud.snapshots)
    .map(Number)
    .filter(n => Number.isFinite(n) && n <= targetFloor)
    .sort((a, b) => a - b);
  const startSnapshotFloor = snapshotFloors.length ? snapshotFloors[snapshotFloors.length - 1] : -1;
  const startState: CalendarResolvedState =
    startSnapshotFloor >= 0 && crud.snapshots[String(startSnapshotFloor)]
      ? cloneResolvedState(crud.snapshots[String(startSnapshotFloor)])
      : { events: {} };

  // 回放 selected swipe 的節點
  const floors = Object.keys(crud.floorSelectedSwipe)
    .map(Number)
    .filter(n => Number.isFinite(n) && n > startSnapshotFloor && n <= targetFloor)
    .sort((a, b) => a - b);
  for (const floor of floors) {
    const selected = crud.floorSelectedSwipe[floorKey(floor)] ?? 0;
    const node = crud.nodes[floorKey(floor)]?.[swipeKey(selected)];
    if (!node) continue;
    for (const op of node.ops) applyCrudOp(startState, op);
  }

  // 回放沒有 selectedSwipe 但有 swipe0 的節點
  for (const [fKey, swipeMap] of Object.entries(crud.nodes)) {
    const floor = Number(fKey);
    if (!Number.isFinite(floor) || floor <= startSnapshotFloor || floor > targetFloor) continue;
    if (crud.floorSelectedSwipe[fKey] !== undefined) continue;
    const node = swipeMap['0'];
    if (!node) continue;
    for (const op of node.ops) applyCrudOp(startState, op);
  }

  // 自動快照
  if (targetFloor > crud.lastKnownCurrentFloor) {
    const checkpoint = targetFloor - 2;
    if (checkpoint >= 0 && checkpoint % interval === 0 && !crud.snapshots[String(checkpoint)]) {
      crud.snapshots[String(checkpoint)] = cloneResolvedState(startState);
    }
    crud.lastKnownCurrentFloor = targetFloor;
  }

  if (debug) {
    logger.debug('Calendar resolve', {
      targetFloor,
      startSnapshotFloor,
      eventCount: Object.keys(startState.events).length,
    });
  }

  return startState;
}

function cleanupAfterRollback(store: PersistedStore, currentFloor: number): void {
  const crud = ensureCalendarCrud(store);
  for (const key of Object.keys(crud.nodes)) {
    if (Number(key) > currentFloor) delete crud.nodes[key];
  }
  for (const key of Object.keys(crud.floorSelectedSwipe)) {
    if (Number(key) > currentFloor) delete crud.floorSelectedSwipe[key];
  }
  const interval = Math.max(1, crud.snapshotInterval || 50);
  const keepBase = currentFloor - (currentFloor % interval === 0 ? interval : currentFloor % interval);
  for (const key of Object.keys(crud.snapshots)) {
    if (Number(key) > keepBase) delete crud.snapshots[key];
  }
  crud.lastKnownCurrentFloor = currentFloor;
}

// ====== 樓層/Swipe 工具 ======

function getCurrentFloorAndSwipe(): { floor: number; swipeId: number } {
  const currentFromApi = Math.max(0, Number(getCurrentMessageId?.() ?? 0) || 0);
  const latest = getChatMessages(-1, { include_swipes: true })?.[0] as
    | { message_id?: number; swipe_id?: number }
    | undefined;
  const latestFloor = Math.max(0, Number(latest?.message_id ?? 0) || 0);
  const floor = Math.max(currentFromApi, latestFloor);
  const msgAtFloor =
    floor === latestFloor && latest
      ? latest
      : ((getChatMessages(floor, { include_swipes: true })?.[0] as { swipe_id?: number } | undefined) ?? latest);
  return { floor, swipeId: Math.max(0, Number(msgAtFloor?.swipe_id ?? 0) || 0) };
}

// ====== 公開 API ======

/** 取得當前樓層的所有日曆事件 */
export function getCalendarEvents(): CustomCalendarEvent[] {
  const { store } = normalizeChatVariables(getVariables(CHAT_OPTION));
  const { floor, swipeId } = getCurrentFloorAndSwipe();
  const crud = ensureCalendarCrud(store);
  if (crud.floorSelectedSwipe[floorKey(floor)] === undefined) {
    crud.floorSelectedSwipe[floorKey(floor)] = swipeId;
  }
  const resolved = resolveCalendarStateAt(store, floor);
  return Object.values(resolved.events);
}

/** 新增日曆事件 */
export async function addCalendarEvent(params: {
  month: number;
  day: number;
  title: string;
  description?: string;
}): Promise<{ ok: boolean; id?: string; message?: string }> {
  const trimmedTitle = params.title.trim();
  if (!trimmedTitle) return { ok: false, message: '标题不能为空' };

  // 去重
  const existing = getCalendarEvents().find(
    e => e.title === trimmedTitle && e.month === params.month && e.day === params.day,
  );
  if (existing) {
    logger.info(`日历事件「${trimmedTitle}」(${params.month}月${params.day}日) 已存在，跳过新增`);
    return { ok: true, id: existing.id };
  }

  const id = `cal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const { floor, swipeId } = getCurrentFloorAndSwipe();
  const description = params.description?.trim() || undefined;

  await updateStoreWith(s => {
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
  });

  logger.info(`新增日历事件「${trimmedTitle}」(${params.month}月${params.day}日)`);
  return { ok: true, id };
}

/** 更新日曆事件 */
export async function updateCalendarEvent(
  id: string,
  patch: { title?: string; description?: string; month?: number; day?: number },
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
    e => e.id !== id && e.month === updated.month && e.day === updated.day && e.title === updated.title,
  );
  if (sameNameConflict) return { ok: false, message: '同日期已存在同名事件' };

  const { floor, swipeId } = getCurrentFloorAndSwipe();
  await updateStoreWith(s => {
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
  });

  logger.info(`修改日历事件「${updated.title}」`);
  return { ok: true };
}

/** 刪除日曆事件 */
export async function deleteCalendarEvent(id: string): Promise<{ ok: boolean; message?: string }> {
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

  logger.info(`删除日历事件「${existing.title}」`);
  return { ok: true };
}

/** 根據標題和日期查找日曆事件 */
export function findCalendarEventByTitleAndDate(
  title: string,
  month: number,
  day: number,
): CustomCalendarEvent | undefined {
  return getCalendarEvents().find(e => e.title === title && e.month === month && e.day === day);
}

// ====== Bridge 事件處理 ======

/** 處理外部腳本觸發的 bridge 事件（deleteFloor / deleteSwipe / switchSwipe） */
export async function processCalendarBridgeEventsOnLoad(): Promise<void> {
  await updateStoreWith(store => {
    const crud = ensureCalendarCrud(store);
    const current = getCurrentFloorAndSwipe();

    // 回退清理
    if (current.floor < crud.lastKnownCurrentFloor) {
      cleanupAfterRollback(store, current.floor);
    }

    // deleteFloor
    if (crud.bridge.deleteFloor.triggered && Number.isFinite(crud.bridge.deleteFloor.deleteFrom)) {
      const pruneFrom = Math.max(0, Math.trunc(Number(crud.bridge.deleteFloor.deleteFrom)));
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

    // deleteSwipe
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
        if (!Number.isFinite(oldIndex) || oldIndex === swipeId) continue;
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

    // switchSwipe
    if (crud.bridge.switchSwipe.triggered) {
      const floor = Number.isFinite(crud.bridge.switchSwipe.floor)
        ? Math.max(0, Math.trunc(Number(crud.bridge.switchSwipe.floor)))
        : current.floor;
      const message = getChatMessages(floor, { include_swipes: true })?.[0] as { swipe_id?: number } | undefined;
      const swipe = Math.max(0, Number(message?.swipe_id ?? 0) || 0);
      crud.floorSelectedSwipe[floorKey(floor)] = swipe;
      crud.bridge.switchSwipe = { triggered: false };
    }

    // 確保當前樓層有 swipe 記錄
    if (crud.floorSelectedSwipe[floorKey(current.floor)] === undefined) {
      crud.floorSelectedSwipe[floorKey(current.floor)] = current.swipeId;
    }

    resolveCalendarStateAt(store, current.floor);
    return store;
  });
}

// ====== AI 日曆操作處理 ======

/** 處理 AI 產生的日曆操作指令（從 MVU 變量讀取） */
export async function processAiCalendarOps(): Promise<{ changed: boolean }> {
  const ops = await MvuBridge.getCalendarOps();
  if (!ops || ops.length === 0) return { changed: false };

  // 排序：刪除(0) → 修改(1) → 新增(2)
  const ORDER: Record<string, number> = { '删除': 0, '刪除': 0, '修改': 1, '新增': 2 };
  const sorted = [...ops].sort((a: any, b: any) =>
    (ORDER[a['操作']] ?? 9) - (ORDER[b['操作']] ?? 9),
  );

  let changed = false;
  for (const raw of sorted) {
    const op = raw as Record<string, any>;
    const action = op['操作'];
    const month = Number(op['月']);
    const day = Number(op['日']);
    const title = String(op['标题'] ?? op['標題'] ?? '');
    const desc = op['描述'] !== undefined ? String(op['描述']) : undefined;
    const target = String(op['目标事件'] ?? op['目標事件'] ?? '');

    if (!Number.isFinite(month) || !Number.isFinite(day)) {
      logger.warn('AI日历操作: 无效的月/日', op);
      continue;
    }

    if (action === '新增') {
      if (!title) { logger.warn('AI日历操作: 缺少标题', op); continue; }
      await addCalendarEvent({ month, day, title, description: desc });
      changed = true;
    } else if (action === '修改') {
      const found = findCalendarEventByTitleAndDate(target, month, day);
      if (!found) { logger.warn('AI日历操作: 未找到目标事件', op); continue; }
      await updateCalendarEvent(found.id, {
        ...(title ? { title } : {}),
        ...(desc !== undefined ? { description: desc } : {}),
      });
      changed = true;
    } else if (action === '删除' || action === '刪除') {
      const found = findCalendarEventByTitleAndDate(target, month, day);
      if (!found) { logger.warn('AI日历操作: 未找到目标事件', op); continue; }
      await deleteCalendarEvent(found.id);
      changed = true;
    } else {
      logger.warn('AI日历操作: 未知操作', op);
    }
  }

  await MvuBridge.clearCalendarOps();
  return { changed };
}
