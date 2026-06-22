import React, { useState } from 'react';
import { Play, List, Star, X, Check, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { useHypnosisUseLogic, mockCombos, mockCharacters, HypnosisFeatureMock } from '../HypnosisUILogics';

export const HypnosisUseTab: React.FC = () => {
    // 狀態管理 (State Management)
    const [showSavedCombosModal, setShowSavedCombosModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [showSaveComboModal, setShowSaveComboModal] = useState(false);
    const [newComboName, setNewComboName] = useState('');
    const [expandedCombo, setExpandedCombo] = useState<string | null>(null);
    const [activeVipTab, setActiveVipTab] = useState<string>('VIP 0');
    const [inputMethods, setInputMethods] = useState<Record<string, string>>({}); // 紀錄每個 feature 選擇的施加方式

    const {
        ownedFeatures,
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
        getMissingEquipment
    } = useHypnosisUseLogic();

    const vipTiers = ['VIP 0', 'VIP 1', 'VIP 2', 'VIP 3', 'VIP 4', 'VIP 5'];

    const handleInputMethodChange = (id: string, method: string) => {
        setInputMethods(prev => ({ ...prev, [id]: method }));
    };

    // 計算所有啟用的催眠所缺少的設備
    const getAllMissingEquipment = () => {
        const missing = new Set<string>();
        enabledFeatures.forEach(id => {
            const method = inputMethods[id];
            if (method) {
                const missingForMethod = getMissingEquipment(method);
                missingForMethod.forEach(m => missing.add(m));
            }
        });
        return Array.from(missing);
    };

    const renderFeatureInputPanel = (feature: HypnosisFeatureMock) => {
        const duration = featureDurations[feature.id] || 0;
        const currentMethod = inputMethods[feature.id] || '';
        const missingEquip = currentMethod ? getMissingEquipment(currentMethod) : [];

        return (
            <div className="bg-black/50 p-3 rounded-b-lg border-x border-b border-purple-500/30 space-y-3 animate-slide-down -mt-px">
                <div className="text-xs text-gray-300 mb-2 p-2 bg-purple-900/20 rounded border border-purple-500/20">
                    <span className="font-bold text-purple-300">效果與強度:</span> {feature.desc}
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label className="block text-xs text-purple-300 mb-1">持續時間 (分鐘)</label>
                        <input
                            type="number"
                            value={feature.isPermanent ? 0 : duration}
                            onChange={(e) => handleDurationChange(feature.id, e.target.value)}
                            disabled={feature.isPermanent}
                            className={`w-full bg-purple-900/20 border border-purple-500/30 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-400 ${feature.isPermanent ? 'opacity-50 cursor-not-allowed' : ''}`}
                        />
                        {feature.isPermanent && <span className="text-[9px] text-red-400 mt-0.5 block">永久催眠不可修改</span>}
                    </div>
                    <div>
                        <label className="block text-xs text-purple-300 mb-1">施加方式</label>
                        <select
                            value={currentMethod}
                            onChange={(e) => handleInputMethodChange(feature.id, e.target.value)}
                            className="w-full bg-purple-900/20 border border-purple-500/30 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-400"
                        >
                            <option value="">請選擇</option>
                            <optgroup label="直接輸入" className="bg-gray-900 text-white">
                                <option value="直接輸入-圖像">圖像 (需: 屏幕)</option>
                                <option value="直接輸入-文字">文字 (需: 文字編譯)</option>
                                <option value="直接輸入-聲音">聲音 (需: 音頻調製)</option>
                            </optgroup>
                            <optgroup label="間接輸入" className="bg-gray-900 text-white">
                                <option value="間接輸入-圖像">圖像 (需: 圖像混淆)</option>
                                <option value="間接輸入-文字">文字 (需: 語意混淆)</option>
                                <option value="間接輸入-聲音">聲音 (需: 音頻混淆)</option>
                                <option value="間接輸入-觸覺">觸覺 (需: 頻率調製)</option>
                                <option value="間接輸入-味覺">味覺 (需: 食物融合)</option>
                                <option value="間接輸入-氣味">氣味 (需: 氣體調製)</option>
                                <option value="間接輸入-電磁波">電磁波 (需: 電磁波發射)</option>
                            </optgroup>
                        </select>
                        {missingEquip.length > 0 && (
                            <div className="text-[9px] text-yellow-500 mt-1 flex items-center">
                                <AlertTriangle size={10} className="mr-1"/> 缺少設備: {missingEquip.join(', ')}
                            </div>
                        )}
                    </div>
                </div>
                <div>
                    <label className="block text-xs text-purple-300 mb-1">施加對象 (可多選或自填)</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                        {mockCharacters.map(char => {
                            const isSelected = (featureSelectedTargets[feature.id] || []).includes(char);
                            return (
                                <button
                                    key={char}
                                    onClick={() => {
                                        setFeatureSelectedTargets(prev => {
                                            const current = prev[feature.id] || [];
                                            if (current.includes(char)) {
                                                return { ...prev, [feature.id]: current.filter(c => c !== char) };
                                            } else {
                                                return { ...prev, [feature.id]: [...current, char] };
                                            }
                                        });
                                    }}
                                    className={`px-3 py-1 rounded-full text-[10px] border transition-all ${
                                        isSelected
                                            ? 'bg-purple-600 border-purple-400 text-white shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                                            : 'bg-purple-900/40 border-purple-500/30 text-purple-300 hover:border-purple-400'
                                    }`}
                                >
                                    {char}
                                </button>
                            );
                        })}
                    </div>
                    <input
                        type="text"
                        value={featureCustomTargets[feature.id] || ''}
                        onChange={(e) => setFeatureCustomTargets(prev => ({ ...prev, [feature.id]: e.target.value }))}
                        placeholder="其他自訂對象..."
                        className="w-full bg-purple-900/20 border border-purple-500/30 rounded px-2 py-1.5 text-white text-xs focus:outline-none focus:border-purple-400"
                    />
                </div>
                <div>
                    <label className="block text-xs text-purple-300 mb-1">備註</label>
                    <textarea rows={2} placeholder="輸入詳細指令或設定..." className="w-full bg-purple-900/20 border border-purple-500/30 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-purple-400 resize-none"></textarea>
                </div>
            </div>
        );
    };

    const renderFeaturesForActiveTab = () => {
        const tierFeatures = ownedFeatures.filter(f => f.tier === activeVipTab);

        if (tierFeatures.length === 0) {
            return (
                <div className="text-center py-8 text-gray-500 text-sm">
                    此等級目前沒有可用的催眠功能
                </div>
            );
        }

        return (
            <div className="space-y-3 mt-4">
                {tierFeatures.map(feature => {
                    const isEnabled = enabledFeatures.has(feature.id);
                    const totalCost = isEnabled ? getFeatureCost(feature) : 0;

                    return (
                        <div key={feature.id} className="relative">
                            {/* Feature Header Card */}
                            <div
                                onClick={() => toggleFeature(feature.id)}
                                className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 flex justify-between items-center
                                    ${isEnabled
                                        ? 'bg-linear-to-r from-purple-900/60 to-pink-900/40 border-pink-400 shadow-[0_0_15px_rgba(236,72,153,0.3)] rounded-b-none'
                                        : 'bg-purple-900/20 border-purple-500/30 hover:bg-purple-900/30 hover:border-purple-500/50'
                                    }`}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className={`font-bold text-sm ${isEnabled ? 'text-pink-300' : 'text-white'}`}>
                                            {feature.name}
                                        </h4>
                                        {feature.isPermanent && (
                                            <span className="text-[9px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30">
                                                永久
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 flex justify-between items-center pr-4">
                                        <span>
                                            {feature.isPermanent ? `單次消耗: ${feature.costPerMin} MC` : `消耗: ${feature.costPerMin} MC / 分鐘`}
                                        </span>
                                        {isEnabled && !feature.isPermanent && (
                                            <span className="text-yellow-400 font-bold text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                                                總計: {totalCost} MC
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    {/* Toggle Switch */}
                                    <div className={`w-10 h-5 rounded-full relative transition-colors duration-200 ${isEnabled ? 'bg-pink-500' : 'bg-gray-700'}`}>
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-200 shadow-sm ${isEnabled ? 'left-5.5 right-0.5' : 'left-0.5'}`}></div>
                                    </div>
                                </div>
                            </div>

                            {/* Expanded Input Panel */}
                            {isEnabled && renderFeatureInputPanel(feature)}
                        </div>
                    );
                })}
            </div>
        );
    };

    const allMissingEquip = getAllMissingEquipment();

    return (
        <div className="relative flex flex-col h-full overflow-hidden">
            {/* Inner Scrolling Content */}
            <div className="flex-1 overflow-y-auto p-4 pb-24 hypno-scrollbar">
                {/* Available Features Section */}
                <section className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/10 mb-6 mt-2">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-bold text-purple-300 flex items-center">
                            <List className="mr-2" size={20} />
                            目前擁有的催眠
                        </h2>
                        <button
                            onClick={() => setShowConfirmModal(true)}
                            disabled={enabledFeatures.size === 0}
                            className={`px-4 py-1.5 rounded-lg font-bold text-xs transition-all flex items-center justify-center
                                ${enabledFeatures.size > 0
                                    ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_10px_rgba(168,85,247,0.4)] transform hover:scale-105 active:scale-95'
                                    : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                                }`}
                        >
                            <Play className="mr-1.5" size={14} />
                            催眠啟動
                        </button>
                    </div>

                    {/* VIP Tabs */}
                    <div className="flex overflow-x-auto no-scrollbar border-b border-white/10 pb-1 space-x-2">
                        {vipTiers.map(tier => (
                            <button
                                key={tier}
                                onClick={() => setActiveVipTab(tier)}
                                className={`whitespace-nowrap px-3 py-1.5 text-xs font-bold rounded-t-lg transition-colors ${
                                    activeVipTab === tier
                                    ? 'bg-white/10 text-yellow-400 border-t border-x border-white/10'
                                    : 'text-gray-500 hover:text-purple-300 hover:bg-white/5'
                                }`}
                            >
                                {tier}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    {renderFeaturesForActiveTab()}
                </section>
            </div>

            {/* 懸浮按鈕 (FAB) - 收藏組合 */}
            <button
                onClick={() => setShowSavedCombosModal(true)}
                className="absolute bottom-6 left-4 z-40 bg-purple-600 hover:bg-purple-500 p-3 rounded-full shadow-[0_0_15px_rgba(217,70,239,0.5)] hover:scale-105 active:scale-95 transition-transform flex items-center justify-center border border-white/20"
                aria-label="收藏的組合"
            >
                <Star size={20} className="text-white fill-white/20" />
            </button>

            {/* --- Modals --- */}

            {/* 1. 收藏組合 Modal */}
            {showSavedCombosModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col max-h-[80vh] animate-slide-up overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Star className="mr-2 text-yellow-400" size={20} />
                                收藏的組合
                            </h3>
                            <button onClick={() => setShowSavedCombosModal(false)} className="text-gray-400 hover:text-white p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-4 overflow-y-auto flex-1 space-y-3 hypno-scrollbar">
                            {mockCombos.map(combo => (
                                <div key={combo.id} className="bg-white/5 border border-white/5 rounded-lg overflow-hidden">
                                    <div
                                        className="p-3 flex justify-between items-center cursor-pointer hover:bg-white/10 transition-colors"
                                        onClick={() => setExpandedCombo(expandedCombo === combo.id ? null : combo.id)}
                                    >
                                        <span className="font-bold text-purple-300">{combo.name}</span>
                                        {expandedCombo === combo.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                                    </div>

                                    {expandedCombo === combo.id && (
                                        <div className="p-3 bg-white/5 border-t border-white/5 animate-slide-down">
                                            <div className="text-xs text-gray-400 mb-2">包含以下催眠：</div>
                                            <ul className="list-disc list-inside text-xs text-gray-200 mb-4 space-y-1 ml-1">
                                                {combo.features.map((f, i) => <li key={i}>{f}</li>)}
                                            </ul>
                                            <button
                                                onClick={() => {
                                                    applyCombo(combo.id);
                                                    setShowSavedCombosModal(false);
                                                }}
                                                className="w-full py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg flex items-center justify-center transition-colors"
                                            >
                                                <Check size={14} className="mr-1" />
                                                確認套用此組合
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="p-4 border-t border-white/10 bg-black/40">
                            <button
                                onClick={() => {
                                    setShowSavedCombosModal(false);
                                    setShowSaveComboModal(true);
                                }}
                                className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-purple-300 font-bold rounded-xl transition-colors flex items-center justify-center"
                            >
                                <Star size={18} className="mr-2" />
                                儲存目前設定為組合
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. 啟動確認 Modal */}
            {showConfirmModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col animate-fade-in">
                    <div className="bg-black/60 backdrop-blur-xl w-full h-full flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <AlertTriangle className="mr-2 text-yellow-400" size={20} />
                                確認啟動催眠
                            </h3>
                            <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-white p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 hypno-scrollbar">
                            <h4 className="text-sm font-bold text-purple-300 mb-3">目前啟用了哪些催眠:</h4>
                            <div className="space-y-3 mb-6">
                                {Array.from(enabledFeatures).map(id => {
                                    const feature = ownedFeatures.find(f => f.id === id);
                                    if (!feature) return null;
                                    const duration = featureDurations[id] || 0;
                                    const totalCost = getFeatureCost(feature);
                                    const method = inputMethods[id] || '未設定';
                                    const missing = method !== '未設定' ? getMissingEquipment(method) : [];

                                    return (
                                        <div key={id} className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                            <div className="font-bold text-white text-sm mb-2 border-b border-white/10 pb-1">{feature.name}</div>
                                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                                <div className="text-gray-400">持續時間: <span className="text-gray-200">{feature.isPermanent ? '永久' : `${duration} 分鐘`}</span></div>
                                                <div className="text-gray-400">施加方式: <span className="text-gray-200">{method}</span></div>
                                                <div className="col-span-2 text-gray-400">施加對象: <span className="text-gray-200">{[...(featureSelectedTargets[id] || []), featureCustomTargets[id]].filter(Boolean).join(', ') || '未設定'}</span></div>
                                                <div className="col-span-2 text-gray-400">備註: <span className="text-gray-200">無</span></div>
                                                {missing.length > 0 && (
                                                    <div className="col-span-2 text-yellow-500 mt-1 flex items-center"><AlertTriangle size={10} className="mr-1"/> 缺少設備: {missing.join(', ')}</div>
                                                )}
                                                <div className="col-span-2 text-purple-400 font-bold mt-1">預計消耗: {totalCost} MC</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="bg-white/5 border border-white/10 p-3 rounded-lg mb-4">
                                <div className="flex justify-between items-center text-sm font-bold mb-1">
                                    <span className="text-white">總共將要消耗:</span>
                                    <span className="text-yellow-400">{getTotalCost()} MC 能量</span>
                                </div>
                                {allMissingEquip.length > 0 && (
                                    <div className="text-xs text-gray-400 flex items-start mt-2">
                                        <AlertTriangle size={14} className="mr-1 shrink-0 mt-0.5 text-yellow-500" />
                                        <span>總共缺少的設備: {allMissingEquip.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 flex gap-3">
                            <button
                                onClick={() => setShowConfirmModal(false)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-bold hover:bg-white/5 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    // Mock Start
                                    setShowConfirmModal(false);
                                }}
                                disabled={!canStartHypnosis() || allMissingEquip.length > 0}
                                className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center ${
                                    canStartHypnosis() && allMissingEquip.length === 0 ? 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                }`}
                            >
                                <Play size={18} className="mr-1" />
                                立即啟動
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. 儲存組合 Modal */}
            {showSaveComboModal && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col animate-fade-in">
                    <div className="bg-black/60 backdrop-blur-xl w-full h-full flex flex-col overflow-hidden animate-slide-up">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                            <h3 className="text-lg font-bold text-white flex items-center">
                                <Star className="mr-2 text-yellow-400" size={20} />
                                儲存催眠組合
                            </h3>
                            <button onClick={() => setShowSaveComboModal(false)} className="text-gray-400 hover:text-white p-1 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-4 overflow-y-auto flex-1 hypno-scrollbar">
                            <div className="mb-4">
                                <label className="block text-sm font-bold text-purple-300 mb-2">組合名稱</label>
                                <input
                                    type="text"
                                    value={newComboName}
                                    onChange={(e) => setNewComboName(e.target.value)}
                                    placeholder="輸入組合名稱 (不可重複)"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400 transition-colors"
                                />
                            </div>

                            <h4 className="text-sm font-bold text-purple-300 mb-3">組合內包含的催眠:</h4>
                            <div className="space-y-3 mb-6">
                                {enabledFeatures.size === 0 ? (
                                    <div className="text-gray-500 text-xs text-center py-4">
                                        目前沒有啟用的催眠項目
                                    </div>
                                ) : (
                                    Array.from(enabledFeatures).map(id => {
                                        const feature = ownedFeatures.find(f => f.id === id);
                                        if (!feature) return null;
                                        const duration = featureDurations[id] || 0;
                                        const totalCost = getFeatureCost(feature);
                                        const method = inputMethods[id] || '未設定';

                                        return (
                                            <div key={id} className="bg-white/5 border border-white/10 p-3 rounded-lg">
                                                <div className="font-bold text-white text-sm mb-2 border-b border-white/10 pb-1">{feature.name}</div>
                                                <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                                                    <div className="text-gray-400">持續時間: <span className="text-gray-200">{feature.isPermanent ? '永久' : `${duration} 分鐘`}</span></div>
                                                    <div className="text-gray-400">施加方式: <span className="text-gray-200">{method}</span></div>
                                                    <div className="col-span-2 text-gray-400">施加對象: <span className="text-gray-200">{[...(featureSelectedTargets[id] || []), featureCustomTargets[id]].filter(Boolean).join(', ') || '未設定'}</span></div>
                                                    <div className="col-span-2 text-gray-400">備註: <span className="text-gray-200">無</span></div>
                                                    <div className="col-span-2 text-purple-400 font-bold mt-1">預計消耗: {totalCost} MC</div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="bg-white/5 border border-white/10 p-3 rounded-lg mb-4">
                                <div className="flex justify-between items-center text-sm font-bold">
                                    <span className="text-white">使用該組合時需消耗:</span>
                                    <span className="text-yellow-400">{getTotalCost()} MC 能量</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/10 bg-black/40 flex gap-3">
                            <button
                                onClick={() => setShowSaveComboModal(false)}
                                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-bold hover:bg-white/5 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    if (saveCombo(newComboName)) {
                                        setShowSaveComboModal(false);
                                        setNewComboName('');
                                    }
                                }}
                                disabled={!newComboName.trim() || enabledFeatures.size === 0}
                                className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center
                                    ${newComboName.trim() && enabledFeatures.size > 0
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-[0_0_20px_rgba(168,85,247,0.4)] active:scale-95'
                                        : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/10'
                                    }`}
                            >
                                <Check size={18} className="mr-1" />
                                儲存組合
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
