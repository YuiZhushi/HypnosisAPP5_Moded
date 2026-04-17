import type { CalendarCrudOp, CalendarCrudNode, CalendarCrudStore, CalendarResolvedState, CalendarEventResolved } from '../types/persistedStore';

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
