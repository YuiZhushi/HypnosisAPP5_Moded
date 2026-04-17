/**
 * 資源領域服務（Phase B-3）
 */
import type { SessionStartPayload } from '../../types';

export type ResourceServiceDeps<TUserData, TStore> = {
  getUserData: () => Promise<TUserData>;
  updateResources: (patch: Partial<TUserData>) => Promise<TUserData>;
  getSystemClock: () => Promise<{ dateText?: string; timeText?: string; virtualMinutes: number | null }>;
  startSession: (payload: SessionStartPayload) => Promise<boolean>;
  readStoreSnapshot: () => TStore;
  updateStoreWith: (updater: (store: TStore) => TStore) => Promise<TStore>;
  getSessionEndFromStore: (store: TStore) => { endVirtualMinutes: number | null; endAtMs: number | null };
  setSessionEndToStore: (
    store: TStore,
    payload: { endVirtualMinutes: number | null; endAtMs: number | null },
  ) => TStore;
};

export function createResourceService<TUserData, TStore>(deps: ResourceServiceDeps<TUserData, TStore>) {
  return {
    getUserData: () => deps.getUserData(),
    updateResources: (patch: Partial<TUserData>) => deps.updateResources(patch),
    getSystemClock: () => deps.getSystemClock(),
    startSession: (payload: SessionStartPayload) => deps.startSession(payload),

    async getSessionEnd(): Promise<{ endVirtualMinutes: number | null; endAtMs: number | null }> {
      return deps.getSessionEndFromStore(deps.readStoreSnapshot());
    },

    async setSessionEnd(payload: { endVirtualMinutes: number | null; endAtMs: number | null }): Promise<void> {
      await deps.updateStoreWith(store => deps.setSessionEndToStore(store, payload));
    },

    async clearSessionEnd(): Promise<void> {
      await deps.updateStoreWith(store =>
        deps.setSessionEndToStore(store, {
          endVirtualMinutes: null,
          endAtMs: null,
        }),
      );
    },
  };
}
