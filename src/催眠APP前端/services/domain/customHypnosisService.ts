/**
 * 自訂催眠領域服務（Phase B-3）
 */
export type CustomHypnosisServiceDeps<TStore, TDef, TTier> = {
  readStoreSnapshot: () => TStore;
  listFromStore: (store: TStore) => TDef[];
  calculateCost: (tier: TTier, costType: 'ONE_TIME' | 'PER_MINUTE', costValue: number) => number;
  addByUsecase: (def: Omit<TDef, 'id' | 'createdAt' | 'researchCost'>) => Promise<{ ok: boolean; message?: string; id?: string }>;
  deleteByUsecase: (id: string) => Promise<{ ok: boolean; message?: string; refund?: number }>;
};

export function createCustomHypnosisService<TStore, TDef, TTier>(deps: CustomHypnosisServiceDeps<TStore, TDef, TTier>) {
  return {
    getCustomHypnosis(): TDef[] {
      return deps.listFromStore(deps.readStoreSnapshot());
    },

    calculateCustomHypnosisCost(tier: TTier, costType: 'ONE_TIME' | 'PER_MINUTE', costValue: number): number {
      return deps.calculateCost(tier, costType, costValue);
    },

    addCustomHypnosis(def: Omit<TDef, 'id' | 'createdAt' | 'researchCost'>) {
      return deps.addByUsecase(def);
    },

    deleteCustomHypnosis(id: string) {
      return deps.deleteByUsecase(id);
    },
  };
}
