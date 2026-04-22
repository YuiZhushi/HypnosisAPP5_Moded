type ParseLike<T> = { parse(input: unknown): T; };

export type StoreGatewayDeps<TSystem extends Record<string, unknown>, TStore> = {
	chatOption: VariableOption;
	getVariables: (option?: VariableOption) => Record<string, unknown>;
	updateVariablesWith: (callback: (vars: Record<string, unknown>) => Record<string, unknown>, option?: VariableOption) => Record<string, unknown>;
	normalizeSystemAliases: (systemRaw: Record<string, unknown>) => Record<string, unknown>;
	systemSchema: ParseLike<TSystem>;
	storeSchema: ParseLike<TStore>;
	migrateStore: (store: TStore) => TStore;
	syncPersistedStore: (store: TStore) => Promise<void>;
};

export function createStoreGateway<TSystem extends Record<string, unknown>, TStore>(deps: StoreGatewayDeps<TSystem, TStore>) {
	function normalizeChatVariables(variables: Record<string, unknown>) {
		const systemRaw = deps.normalizeSystemAliases(variables?.系统 ?? {});
		const system = deps.systemSchema.parse(systemRaw) as TSystem & { _hypnoos?: TStore };
		system._hypnoos = deps.migrateStore(deps.storeSchema.parse(system._hypnoos ?? {}));
		variables.系统 = system;
		return { variables, system, store: system._hypnoos as TStore };
	}

	async function updateStoreWith(updater: (store: TStore) => TStore) {
		let nextStore: TStore | undefined;
		deps.updateVariablesWith(vars => {
			const { system, store } = normalizeChatVariables(vars);
			nextStore = deps.storeSchema.parse(updater(store));
			(system as TSystem & { _hypnoos?: TStore })._hypnoos = nextStore;
			vars.系统 = system;
			return vars;
		}, deps.chatOption);

		const result = nextStore ?? deps.storeSchema.parse({});
		await deps.syncPersistedStore(result);
		return result;
	}

	function readStoreSnapshot(): TStore {
		const { store } = normalizeChatVariables(deps.getVariables(deps.chatOption));
		return deps.storeSchema.parse(store);
	}

	return {
		normalizeChatVariables,
		updateStoreWith,
		readStoreSnapshot,
		migrateStore: deps.migrateStore,
	};
}
