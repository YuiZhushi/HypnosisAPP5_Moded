import React, { useState } from 'react';
import { User, Zap, CircleDollarSign, Coins, Crown, RefreshCw, ArrowRight, X, Check, Plus, Minus } from 'lucide-react';
import { useUserProfileLogic, EXCHANGE_RATES } from '../HypnosisUILogics';

type ExchangeType = 'RESTORE_ENERGY' | 'UPGRADE_MAX_ENERGY' | 'PT_TO_MONEY' | 'MONEY_TO_PT' | null;

interface ExchangeConfig {
    type: ExchangeType;
    title: string;
    icon: React.ReactNode;
    inputLabel: string;
    inputUnit: string;
    costLabel: string;
    costUnit: string;
    rateText: string;
}

export const UserProfileTab: React.FC = () => {
    const { userData, calculateExchangeResult, canExchange, performExchange, canUpgradeVip, upgradeVip } = useUserProfileLogic();
    const [exchangeType, setExchangeType] = useState<ExchangeType>(null);
    const [inputValue, setInputValue] = useState<string>('');

    const getExchangeConfig = (type: ExchangeType): ExchangeConfig | null => {
        switch (type) {
            case 'RESTORE_ENERGY':
                return {
                    type,
                    title: 'MC 能量儲值',
                    icon: <Zap className="text-yellow-400 mr-2" size={20} />,
                    inputLabel: '請輸入欲回復的能量點數',
                    inputUnit: 'MC',
                    costLabel: '預計消耗金錢',
                    costUnit: '¥',
                    rateText: `當前匯率: 1 MC = ¥ ${EXCHANGE_RATES.energyRestoreRate}`
                };
            case 'UPGRADE_MAX_ENERGY':
                return {
                    type,
                    title: '提升能量上限',
                    icon: <Zap className="text-yellow-400 mr-2" size={20} />,
                    inputLabel: '請輸入欲提升的上限點數',
                    inputUnit: '上限',
                    costLabel: '預計消耗催眠點',
                    costUnit: 'PT',
                    rateText: `當前匯率: 1 上限 = ${EXCHANGE_RATES.energyMaxUpgradeRate} PT`
                };
            case 'PT_TO_MONEY':
                return {
                    type,
                    title: '催眠點兌換金錢',
                    icon: <CircleDollarSign className="text-green-400 mr-2" size={20} />,
                    inputLabel: '請輸入欲消耗的催眠點數',
                    inputUnit: 'PT',
                    costLabel: '預計獲得金錢',
                    costUnit: '¥',
                    rateText: `當前匯率: 1 PT = ¥ ${EXCHANGE_RATES.ptToMoneyRate}`
                };
            case 'MONEY_TO_PT':
                return {
                    type,
                    title: '金錢兌換催眠點',
                    icon: <Coins className="text-blue-400 mr-2" size={20} />,
                    inputLabel: '請輸入欲兌換的催眠點數',
                    inputUnit: 'PT',
                    costLabel: '預計消耗金錢',
                    costUnit: '¥',
                    rateText: `當前匯率: ¥ ${EXCHANGE_RATES.moneyToPtRate} = 1 PT`
                };
            default:
                return null;
        }
    };

    const config = getExchangeConfig(exchangeType);
    const parsedInput = parseInt(inputValue) || 0;
    const calculatedResult = calculateExchangeResult(exchangeType, parsedInput);
    const isExchangeValid = parsedInput > 0 && canExchange(exchangeType, parsedInput);

    const handleOpenModal = (type: ExchangeType) => {
        setExchangeType(type);
        setInputValue('');
    };

    const handleCloseModal = () => {
        setExchangeType(null);
        setInputValue('');
    };

    return (
        <div className="relative flex flex-col h-full overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-3 hypno-scrollbar pb-24">
                {/* Header */}
                <div className="flex items-center space-x-2 text-purple-300 font-bold text-lg mb-2">
                    <User size={24} />
                    <h2>詳細用戶資料</h2>
                </div>

                {/* General User Info */}
                <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                                <User size={28} className="text-purple-300" />
                            </div>
                            <div>
                                <h3 className="text-md font-bold text-white leading-tight">{userData.name}</h3>
                                <div className="flex items-center space-x-2 mt-0.5">
                                    <span className="bg-white/10 text-yellow-400 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center">
                                        <Crown size={10} className="mr-1" /> {userData.vipLevel}
                                    </span>
                                    <span className="text-[10px] text-gray-400">到期: {userData.vipExpiration}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Resource Management: MC Energy */}
                <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                    <h3 className="text-sm font-bold text-purple-300 flex items-center mb-2">
                        <Zap className="mr-1.5 text-yellow-400" size={16} />
                        MC 能量
                    </h3>
                    <div className="space-y-2">
                        <div>
                            <div className="flex justify-between text-xs text-gray-300 mb-1">
                                <span>當前能量</span>
                                <span className="font-mono font-bold text-yellow-400">{userData.mcEnergy} / {userData.mcEnergyMax}</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500" style={{ width: `${Math.min(100, (userData.mcEnergy / userData.mcEnergyMax) * 100)}%` }} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => handleOpenModal('RESTORE_ENERGY')}
                                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2 text-center transition-colors flex justify-center items-center"
                            >
                                <span className="text-xs font-bold text-white flex items-center">
                                    能量儲值 <RefreshCw size={12} className="ml-1" />
                                </span>
                            </button>
                            <button
                                onClick={() => handleOpenModal('UPGRADE_MAX_ENERGY')}
                                className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2 text-center transition-colors flex justify-center items-center"
                            >
                                <span className="text-xs font-bold text-yellow-400 flex items-center">
                                    提升上限 <Zap size={12} className="ml-1" />
                                </span>
                            </button>
                        </div>
                    </div>
                </section>

                {/* Economy Section: Money & PTS */}
                <div className="grid grid-cols-2 gap-3">
                    {/* Money */}
                    <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-green-400 flex items-center mb-1">
                                <CircleDollarSign className="mr-1.5" size={16} />
                                金錢
                            </h3>
                            <div className="text-lg font-mono font-bold text-white mb-2">
                                ¥ {userData.money.toLocaleString()}
                            </div>
                        </div>
                        <button
                            onClick={() => handleOpenModal('MONEY_TO_PT')}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2 text-center transition-colors flex justify-center items-center mt-auto"
                        >
                            <span className="text-xs font-bold text-blue-400 flex items-center">
                                兌換催眠點 <ArrowRight size={12} className="ml-0.5" />
                            </span>
                        </button>
                    </section>

                    {/* PTS */}
                    <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10 flex flex-col justify-between">
                        <div>
                            <h3 className="text-sm font-bold text-blue-400 flex items-center mb-1">
                                <Coins className="mr-1.5" size={16} />
                                催眠點 (PTS)
                            </h3>
                            <div className="text-lg font-mono font-bold text-white mb-2">
                                {userData.mcPoints.toLocaleString()} PT
                            </div>
                        </div>
                        <button
                            onClick={() => handleOpenModal('PT_TO_MONEY')}
                            className="w-full bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg p-2 text-center transition-colors flex justify-center items-center mt-auto"
                        >
                            <span className="text-xs font-bold text-green-400 flex items-center">
                                兌換金錢 <ArrowRight size={12} className="ml-0.5" />
                            </span>
                        </button>
                    </section>
                </div>

                {/* VIP Info & Upgrade */}
                <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
                    <h3 className="text-sm font-bold text-yellow-400 flex items-center mb-2">
                        <Crown className="mr-1.5" size={16} />
                        VIP 資訊
                    </h3>
                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 mb-2">
                        <span className="text-xs text-gray-300">自動續訂</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" defaultChecked={userData.autoRenew} />
                            <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                        </label>
                    </div>
                    <div className="flex justify-between items-center bg-white/5 p-2 rounded-lg border border-white/5">
                        <div>
                            <div className="text-xs font-bold text-white">升級至 VIP 3</div>
                            <div className="text-[10px] text-gray-400 mt-0.5">¥ 15,000 / 週</div>
                        </div>
                        <button
                            onClick={upgradeVip}
                            disabled={!canUpgradeVip()}
                            className={`font-bold px-3 py-1.5 rounded-lg transition-colors text-xs border ${
                                canUpgradeVip() ? 'bg-white/10 hover:bg-white/20 text-yellow-400 border-white/10' : 'bg-gray-800 text-gray-500 border-gray-700 cursor-not-allowed'
                            }`}
                        >
                            升級
                        </button>
                    </div>
                </section>
            </div>

            {/* Exchange Modal */}
            {exchangeType && config && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                {config.icon}
                                {config.title}
                            </h3>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-white p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 space-y-4">
                            <div className="text-xs text-purple-300 font-bold text-center bg-white/5 py-2 rounded-lg border border-white/5">
                                {config.rateText}
                            </div>

                            <div>
                                <label className="block text-xs text-gray-300 mb-1">{config.inputLabel}</label>
                                <div className="relative flex items-center">
                                    <button
                                        onClick={() => setInputValue(String(Math.max(0, parsedInput - 1)))}
                                        className="absolute left-1 z-10 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                    >
                                        <Minus size={16} />
                                    </button>
                                    <input
                                        type="number"
                                        min="0"
                                        value={inputValue}
                                        onChange={(e) => setInputValue(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-10 py-2 text-center text-white text-sm focus:outline-none focus:border-purple-400 transition-colors"
                                        placeholder="0"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => setInputValue(String(parsedInput + 1))}
                                        className="absolute right-10 z-10 p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
                                    >
                                        <Plus size={16} />
                                    </button>
                                    <span className="absolute right-3 text-gray-500 text-sm font-bold">
                                        {config.inputUnit}
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                                <span className="text-sm font-bold text-white">{config.costLabel}:</span>
                                <span className={`text-lg font-bold ${
                                    config.type === 'RESTORE_ENERGY' ? 'text-red-400' :
                                    config.type === 'UPGRADE_MAX_ENERGY' ? 'text-blue-400' :
                                    config.type === 'PT_TO_MONEY' ? 'text-green-400' : 'text-blue-400'
                                }`}>
                                    {config.costUnit === '¥' ? `¥ ${calculatedResult.toLocaleString()}` : `${calculatedResult.toLocaleString()} PT`}
                                </span>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 flex gap-3">
                            <button
                                onClick={handleCloseModal}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-bold hover:bg-white/5 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                disabled={parsedInput <= 0}
                                onClick={() => {
                                    performExchange(exchangeType, parsedInput);
                                    handleCloseModal();
                                }}
                                className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center
                                    ${parsedInput > 0
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95'
                                        : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                                    }`}
                            >
                                <Check size={18} className="mr-1" />
                                確認
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
