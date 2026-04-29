import { useState, useEffect } from 'react';

// ==========================================
// 1. Mock Data 定義
// ==========================================

export const mockUserData = {
    avatar: '',
    name: '催眠大師',
    vipLevel: 'VIP 4',
    vipExpiration: '2026-05-27',
    autoRenew: true,
    mcEnergy: 200,
    mcEnergyMax: 1000,
    money: 500000,
    mcPoints: 600,
};

export const EXCHANGE_RATES = {
    energyRestoreRate: 10, // 1 MC = ¥10
    energyMaxUpgradeRate: 1, // 1 上限 = 1 PT
    ptToMoneyRate: 100, // 1 PT = ¥100
    moneyToPtRate: 100, // ¥100 = 1 PT
};

export const VIP_TIERS = ['VIP 0', 'VIP 1', 'VIP 2', 'VIP 3', 'VIP 4', 'VIP 5'];

export const VIP_UPGRADE_CONFIG = {
    targetLevel: 'VIP 3',
    price: 15000,
    unit: '週'
};

export const CUSTOM_HYPNOSIS_TIERS = [
    { id: 'VIP 0', label: '微弱', desc: '符合自然規律', baseCost: 5000 },
    { id: 'VIP 2', label: '中等', desc: '輕度干涉', baseCost: 15000 },
    { id: 'VIP 4', label: '強烈', desc: '嚴重干涉', baseCost: 30000 }
];

export const APP_LABELS = {
    TABS: {
        USE: '催眠使用區',
        MANAGE: '催眠管理區',
        EQUIPMENT: '設備管理區',
        PROFILE: '詳細用戶資料區'
    },
    HEADER: {
        TITLE: '催眠 APP',
        EXIT: '返回 OS',
        AUTO_RENEW: '自動續訂開啟'
    }
};

export interface HypnosisFeatureMock {
    id: string;
    tier: string;
    name: string;
    isPermanent: boolean;
    costPerMin: number;
    desc: string;
    price?: number;
    isOwned?: boolean;
}

export const mockFeatures: HypnosisFeatureMock[] = [
    {
        id: 'f1',
        tier: 'VIP 0',
        name: '微弱意識暗示',
        isPermanent: false,
        costPerMin: 2,
        desc: '被催眠者無意識遵循簡單指示，不能指令非常不願意的行為。',
        isOwned: true,
    },
    {
        id: 'f2',
        tier: 'VIP 1',
        name: '基礎意識模糊',
        isPermanent: false,
        costPerMin: 5,
        desc: '降低目標警覺性，使其更容易接受暗示。',
        isOwned: true,
        price: 20,
    },
    {
        id: 'f3',
        tier: 'VIP 2',
        name: '中度感官剝奪',
        isPermanent: false,
        costPerMin: 15,
        desc: '可以指令稍微不願意的指示，不能指令極其不願意的行為。',
        isOwned: true,
        price: 50,
    },
    {
        id: 'f4',
        tier: 'VIP 2',
        name: '中度感官剝奪2',
        isPermanent: false,
        costPerMin: 18,
        desc: '可以指令稍微不願意的指示，不能指令極其不願意的行為。',
        isOwned: false,
        price: 100,
    },
    {
        id: 'f5',
        tier: 'VIP 5',
        name: '永久記憶竄改',
        isPermanent: true,
        costPerMin: 5000,
        desc: '永久性改變目標的特定記憶片段。',
        isOwned: false,
        price: 250,
    },
];

export interface ComboMock {
    id: string;
    name: string;
    features: string[];
    cost: number;
}

export const mockCombos: ComboMock[] = [
    {
        id: 'c1',
        name: '深度睡眠套餐',
        features: ['基礎意識模糊', '中度感官剝奪'],
        cost: 150
    },
    {
        id: 'c2',
        name: '日常服從訓練',
        features: ['微弱意識暗示'],
        cost: 20
    }
];

export const mockCharacters = ['目前角色', '群體', '白婭', '黑奈'];

export interface EquipmentMock {
    id: string;
    name: string;
    desc: string;
    tier: string;
    price: number;
    isBuiltIn: boolean;
}

export const MOCK_EQUIPMENT: EquipmentMock[] = [
    {
        id: 'e1',
        name: '屏幕',
        desc: '基本視覺輸出設備，可用於顯示簡單的催眠圖像。',
        tier: '內建',
        price: 0,
        isBuiltIn: true
    },
    {
        id: 'e2',
        name: '催眠文字編譯技術',
        desc: '能將催眠要求轉換成具有催眠效果的文字。',
        tier: 'VIP 2',
        price: 2000,
        isBuiltIn: false
    },
    {
        id: 'e3',
        name: '圖像混淆技術',
        desc: '能將具有催眠效果的圖像與其他圖像混合，使其更加難以察覺。',
        tier: 'VIP 3',
        price: 5000,
        isBuiltIn: false
    },
    {
        id: 'e4',
        name: '觸覺震動頻率調製技術',
        desc: '能將催眠要求轉換成具有催眠效果的震動訊號。',
        tier: 'VIP 4',
        price: 15000,
        isBuiltIn: false
    }
];

export const INPUT_METHOD_REQUIREMENTS: Record<string, string[]> = {
    '直接輸入-圖像': ['屏幕'],
    '直接輸入-文字': ['催眠文字編譯技術'],
    '間接輸入-圖像': ['圖像混淆技術'],
    '間接輸入-觸覺': ['觸覺震動頻率調製技術'],
};

export const INPUT_METHODS = [
    { id: '直接輸入-圖像', label: '圖像', category: '直接輸入', req: '屏幕' },
    { id: '直接輸入-文字', label: '文字', category: '直接輸入', req: '催眠文字編譯技術' },
    { id: '直接輸入-聲音', label: '聲音', category: '直接輸入', req: '音頻調製' },
    { id: '間接輸入-圖像', label: '圖像', category: '間接輸入', req: '圖像混淆技術' },
    { id: '間接輸入-文字', label: '文字', category: '間接輸入', req: '語意混淆' },
    { id: '間接輸入-聲音', label: '聲音', category: '間接輸入', req: '音頻混淆' },
    { id: '間接輸入-觸覺', label: '觸覺', category: '間接輸入', req: '觸覺震動頻率調製技術' },
    { id: '間接輸入-味覺', label: '味覺', category: '間接輸入', req: '食物融合' },
    { id: '間接輸入-氣味', label: '氣味', category: '間接輸入', req: '氣體調製' },
    { id: '間接輸入-電磁波', label: '電磁波', category: '間接輸入', req: '電磁波發射' },
];

// ==========================================
// 2. Global Runtime State (Mock Store)
// ==========================================

export interface MockState {
    userData: typeof mockUserData;
    purchasedFeatureIds: Set<string>;
    ownedEquipmentIds: Set<string>;
    disabledEquipmentIds: Set<string>;
    savedCombos: ComboMock[];
}

let mockState: MockState = {
    userData: { ...mockUserData },
    purchasedFeatureIds: new Set<string>(mockFeatures.filter(f => f.isOwned).map(f => f.id)),
    ownedEquipmentIds: new Set<string>(['e1']),
    disabledEquipmentIds: new Set<string>(),
    savedCombos: [...mockCombos],
};

const storeListeners = new Set<() => void>();

export const updateMockState = (partial: Partial<MockState>) => {
    mockState = { ...mockState, ...partial };
    storeListeners.forEach(listener => listener());
};

const updateUserData = (partialUserData: Partial<typeof mockUserData>) => {
    updateMockState({ userData: { ...mockState.userData, ...partialUserData } });
};

export function useMockStore() {
    const [state, setState] = useState(mockState);

    useEffect(() => {
        const listener = () => setState(mockState);
        storeListeners.add(listener);
        return () => {
            storeListeners.delete(listener);
        };
    }, []);

    return state;
}

// ==========================================
// 3. Custom Hooks & Utilities
// ==========================================

export function useHypnosisManageLogic() {
    const state = useMockStore();
    const { userData, purchasedFeatureIds } = state;

    const features = mockFeatures.map(f => ({
        ...f,
        isOwned: purchasedFeatureIds.has(f.id)
    }));

    const canPurchaseFeature = (price?: number) => {
        if (!price) return true;
        return userData.mcPoints >= price;
    };

    const purchaseFeature = (id: string, price?: number) => {
        if (price && !canPurchaseFeature(price)) return false;

        if (price) {
            updateUserData({ mcPoints: userData.mcPoints - price });
        }

        const newPurchased = new Set(purchasedFeatureIds);
        newPurchased.add(id);
        updateMockState({ purchasedFeatureIds: newPurchased });
        return true;
    };

    const getGroupedFeatures = (isOwned: boolean) => {
        const filtered = features.filter(f => f.isOwned === isOwned);
        const grouped: Record<string, HypnosisFeatureMock[]> = {};
        filtered.forEach(f => {
            if (!grouped[f.tier]) grouped[f.tier] = [];
            grouped[f.tier].push(f);
        });
        return grouped;
    };

    const checkVipRequirement = (currentVip: string, requiredVipIndex: number) => {
        const currentVipIndex = parseInt(currentVip.replace('VIP ', '')) || 0;
        return currentVipIndex >= requiredVipIndex;
    };

    const calculateCustomCost = (tierId: string, isPermanent: boolean) => {
        const tierDef = CUSTOM_HYPNOSIS_TIERS.find(t => t.id === tierId);
        const baseCost = tierDef ? tierDef.baseCost : 5000;
        return isPermanent ? baseCost * 2 : baseCost;
    };

    const canCreateCustomHypnosis = (cost: number) => {
        return userData.money >= cost;
    };

    const createCustomHypnosis = (cost: number) => {
        if (!canCreateCustomHypnosis(cost)) return false;
        updateUserData({ money: userData.money - cost });
        // Mock: 這裡可以實作將自訂催眠加入到商店或已擁有列表的邏輯
        return true;
    };

    return {
        features,
        purchaseFeature,
        canPurchaseFeature,
        getGroupedFeatures,
        checkVipRequirement,
        calculateCustomCost,
        canCreateCustomHypnosis,
        createCustomHypnosis,
        userData,
        savedCombos: state.savedCombos
    };
}

export function useHypnosisUseLogic() {
    const { features } = useHypnosisManageLogic();
    const state = useMockStore();
    const { userData, ownedEquipmentIds, disabledEquipmentIds, savedCombos } = state;

    const [enabledFeatures, setEnabledFeatures] = useState<Set<string>>(new Set());
    const [featureDurations, setFeatureDurations] = useState<Record<string, number>>({});
    const [featureSelectedTargets, setFeatureSelectedTargets] = useState<Record<string, string[]>>({});
    const [featureCustomTargets, setFeatureCustomTargets] = useState<Record<string, string>>({});

    const toggleFeature = (id: string) => {
        const newSet = new Set(enabledFeatures);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
            if (featureDurations[id] === undefined) {
                const feature = features.find(f => f.id === id);
                setFeatureDurations(prev => ({
                    ...prev,
                    [id]: feature?.isPermanent ? 1 : 10
                }));
            }
        }
        setEnabledFeatures(newSet);
    };

    const handleDurationChange = (id: string, value: string) => {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num > 0) {
            setFeatureDurations(prev => ({ ...prev, [id]: num }));
        } else if (value === '') {
             setFeatureDurations(prev => ({ ...prev, [id]: 0 }));
        }
    };

    const getFeatureCost = (feature: HypnosisFeatureMock) => {
        if (feature.isPermanent) return feature.costPerMin;
        const duration = featureDurations[feature.id] || 0;
        return duration * feature.costPerMin;
    };

    const getTotalCost = () => {
        let total = 0;
        enabledFeatures.forEach(id => {
            const feature = features.find(f => f.id === id);
            if (feature) {
                total += getFeatureCost(feature);
            }
        });
        return total;
    };

    const canStartHypnosis = () => {
        return userData.mcEnergy >= getTotalCost();
    };

    const isEquipmentReady = (equipmentName: string) => {
        const eq = MOCK_EQUIPMENT.find(e => e.name === equipmentName);
        if (!eq) return false;
        return ownedEquipmentIds.has(eq.id) && !disabledEquipmentIds.has(eq.id);
    };

    const getMissingEquipment = (methodId: string) => {
        const methodDef = INPUT_METHODS.find(m => m.id === methodId);
        if (!methodDef || !methodDef.req) return [];
        return isEquipmentReady(methodDef.req) ? [] : [methodDef.req];
    };

    const saveCombo = (name: string) => {
        if (!name.trim() || enabledFeatures.size === 0) return false;

        const featureNames = Array.from(enabledFeatures)
            .map(id => features.find(f => f.id === id)?.name)
            .filter(Boolean) as string[];

        const newCombo: ComboMock = {
            id: `c_${Date.now()}`,
            name,
            features: featureNames,
            cost: getTotalCost()
        };

        updateMockState({ savedCombos: [...savedCombos, newCombo] });
        return true;
    };

    const applyCombo = (comboId: string) => {
        const combo = savedCombos.find(c => c.id === comboId);
        if (!combo) return false;

        const newEnabled = new Set<string>();
        const newDurations = { ...featureDurations };

        combo.features.forEach(featureName => {
            const feature = features.find(f => f.name === featureName);
            if (feature && feature.isOwned) {
                newEnabled.add(feature.id);
                if (newDurations[feature.id] === undefined) {
                    newDurations[feature.id] = feature.isPermanent ? 1 : 10;
                }
            }
        });

        setEnabledFeatures(newEnabled);
        setFeatureDurations(newDurations);
        return true;
    };

    return {
        ownedFeatures: features.filter(f => f.isOwned),
        enabledFeatures,
        featureDurations,
        featureSelectedTargets,
        featureCustomTargets,
        setFeatureSelectedTargets,
        setFeatureCustomTargets,
        toggleFeature,
        handleDurationChange,
        getFeatureCost,
        getTotalCost,
        canStartHypnosis,
        getMissingEquipment,
        saveCombo,
        applyCombo,
        savedCombos
    };
}

export function useSystemTime() {
    const [time, setTime] = useState(new Date());
    const [batteryPercentage] = useState(100); // Mock battery

    useEffect(() => {
        const timer = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    return {
        timeString: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        batteryPercentage
    };
}

export function useEquipmentLogic() {
    const state = useMockStore();
    const { userData, ownedEquipmentIds, disabledEquipmentIds } = state;

    const toggleEquipmentStatus = (id: string) => {
        const newSet = new Set(disabledEquipmentIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        updateMockState({ disabledEquipmentIds: newSet });
    };

    const canPurchaseEquipment = (price: number) => {
        return userData.money >= price;
    };

    const purchaseEquipment = (id: string, price: number) => {
        if (!canPurchaseEquipment(price)) return false;

        updateUserData({ money: userData.money - price });

        const newSet = new Set(ownedEquipmentIds);
        newSet.add(id);
        updateMockState({ ownedEquipmentIds: newSet });
        return true;
    };

    return {
        installedEquipment: MOCK_EQUIPMENT.filter(e => ownedEquipmentIds.has(e.id)),
        availableEquipment: MOCK_EQUIPMENT.filter(e => !ownedEquipmentIds.has(e.id)),
        disabledEquipmentIds,
        toggleEquipmentStatus,
        canPurchaseEquipment,
        purchaseEquipment
    };
}

export function useUserProfileLogic() {
    const state = useMockStore();
    const { userData } = state;

    const calculateExchangeResult = (type: string | null, value: number) => {
        switch (type) {
            case 'RESTORE_ENERGY': return value * EXCHANGE_RATES.energyRestoreRate;
            case 'UPGRADE_MAX_ENERGY': return value * EXCHANGE_RATES.energyMaxUpgradeRate;
            case 'PT_TO_MONEY': return value * EXCHANGE_RATES.ptToMoneyRate;
            case 'MONEY_TO_PT': return value * EXCHANGE_RATES.moneyToPtRate;
            default: return 0;
        }
    };

    const canExchange = (type: string | null, value: number) => {
        const result = calculateExchangeResult(type, value);
        switch (type) {
            case 'RESTORE_ENERGY':
                return userData.money >= result && userData.mcEnergy < userData.mcEnergyMax;
            case 'UPGRADE_MAX_ENERGY':
                return userData.mcPoints >= result;
            case 'PT_TO_MONEY':
                return userData.mcPoints >= value;
            case 'MONEY_TO_PT':
                return userData.money >= result;
            default:
                return false;
        }
    };

    const performExchange = (type: string | null, value: number) => {
        if (!canExchange(type, value)) return false;

        const result = calculateExchangeResult(type, value);
        const newData = { ...userData };
        switch (type) {
            case 'RESTORE_ENERGY':
                newData.money -= result;
                newData.mcEnergy = Math.min(newData.mcEnergyMax, newData.mcEnergy + value);
                break;
            case 'UPGRADE_MAX_ENERGY':
                newData.mcPoints -= result;
                newData.mcEnergyMax += value;
                break;
            case 'PT_TO_MONEY':
                newData.mcPoints -= value;
                newData.money += result;
                break;
            case 'MONEY_TO_PT':
                newData.money -= result;
                newData.mcPoints += value;
                break;
        }
        updateUserData(newData);
        return true;
    };

    const canUpgradeVip = () => {
        return userData.money >= VIP_UPGRADE_CONFIG.price;
    };

    const upgradeVip = () => {
        if (!canUpgradeVip()) return false;
        updateUserData({
            money: userData.money - VIP_UPGRADE_CONFIG.price,
            vipLevel: VIP_UPGRADE_CONFIG.targetLevel
        });
        return true;
    };

    return {
        userData,
        calculateExchangeResult,
        canExchange,
        performExchange,
        canUpgradeVip,
        upgradeVip
    };
}
