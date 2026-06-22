import React, { useState } from 'react';
import {
  Settings2,
  PlusCircle,
  Trash2,
  Edit3,
  ShoppingCart,
  Package,
  Layers,
  Plus,
  X,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useHypnosisManageLogic, mockCombos } from '../HypnosisUILogics';

type SubTabType = 'OWNED' | 'COMBOS' | 'SHOP' | 'CREATE';

export const HypnosisManageTab: React.FC = () => {
  const [activeSubTab, setActiveSubTab] = useState<SubTabType>('OWNED');
  const {
    getGroupedFeatures,
    purchaseFeature,
    canPurchaseFeature,
    checkVipRequirement,
    calculateCustomCost,
    canCreateCustomHypnosis,
    createCustomHypnosis,
    userData,
  } = useHypnosisManageLogic();

  const ownedGroups = getGroupedFeatures(true);
  const shopGroups = getGroupedFeatures(false);
  const canCreateCustom = checkVipRequirement(userData.vipLevel, 4);

  // Create custom hypnosis state
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customTier, setCustomTier] = useState('VIP 0');
  const [customPermanent, setCustomPermanent] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const customCost = calculateCustomCost(customTier, customPermanent);
  const canAffordCustom = canCreateCustomHypnosis(customCost);

  const handleCreateCustomClick = () => {
    if (!customName.trim() || !customDesc.trim()) return;
    setShowCreateModal(true);
  };

  const confirmCreateCustom = () => {
    if (createCustomHypnosis(customCost)) {
      setShowCreateModal(false);
      setCustomName('');
      setCustomDesc('');
      setCustomTier('VIP 0');
      setCustomPermanent(false);
    }
  };

  const renderSubTabButton = (type: SubTabType, icon: React.ReactNode, label: string) => {
    const isActive = activeSubTab === type;
    return (
      <button
        onClick={() => setActiveSubTab(type)}
        className={`flex-1 py-2 px-1 flex flex-col items-center justify-center rounded-lg transition-all duration-200 ${
          isActive
            ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]'
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
        }`}
      >
        <div className="mb-1">{icon}</div>
        <span className="text-[10px] font-bold">{label}</span>
      </button>
    );
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-3 pb-1 shrink-0">
        <div className="flex items-center space-x-2 text-purple-300 font-bold text-lg mb-3">
          <Settings2 size={24} />
          <h2>催眠管理</h2>
        </div>

        {/* Sub-tab Navigation Bar */}
        <div className="flex space-x-2 bg-black/40 backdrop-blur-md p-1.5 rounded-xl border border-white/10">
          {renderSubTabButton('OWNED', <Package size={18} />, '已擁有')}
          {renderSubTabButton('COMBOS', <Layers size={18} />, '組合')}
          {renderSubTabButton('SHOP', <ShoppingCart size={18} />, '商店')}
          {renderSubTabButton('CREATE', <Edit3 size={18} />, '製作')}
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 hypno-scrollbar pb-24 relative">
        {/* 1. 已擁有的催眠 (OWNED) */}
        {activeSubTab === 'OWNED' && (
          <div className="animate-fade-in space-y-3">
            <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <h3 className="text-sm font-bold text-purple-300 flex items-center mb-3">
                <Package className="mr-1.5" size={16} />
                已擁有的催眠
              </h3>
              <div className="space-y-4">
                {Object.keys(ownedGroups)
                  .sort()
                  .map(tier => (
                    <div key={tier}>
                      <h4 className="text-purple-300 font-bold mb-2 text-xs border-b border-purple-500/30 pb-1">
                        {tier}
                      </h4>
                      <div className="space-y-2">
                        {ownedGroups[tier].map(feature => (
                          <div key={feature.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-white font-bold text-sm">{feature.name}</h4>
                                <span className="text-xs text-purple-400">{feature.tier}</span>
                              </div>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded border ${feature.isPermanent ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                              >
                                {feature.isPermanent ? '永久' : '持續'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-2 line-clamp-2">{feature.desc}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}

        {/* 2. 收藏的催眠組合 (COMBOS) */}
        {activeSubTab === 'COMBOS' && (
          <div className="animate-fade-in space-y-3">
            <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-purple-300 flex items-center">
                  <Layers className="mr-1.5" size={16} />
                  收藏的催眠組合
                </h3>
                <button className="text-purple-400 hover:text-purple-300 transition-colors">
                  <PlusCircle size={18} />
                </button>
              </div>
              <div className="space-y-2">
                {mockCombos.map(combo => (
                  <div key={combo.id} className="bg-white/5 border border-white/10 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-white font-bold text-sm">{combo.name}</h4>
                      <div className="flex space-x-2">
                        <button className="text-gray-400 hover:text-white transition-colors">
                          <Edit3 size={14} />
                        </button>
                        <button className="text-red-400 hover:text-red-300 transition-colors">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      包含 {combo.features.length} 個催眠效果 • 預計消耗: {combo.cost} MC/分
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* 3. 催眠購買頁面 (SHOP) */}
        {activeSubTab === 'SHOP' && (
          <div className="animate-fade-in space-y-3">
            <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <h3 className="text-sm font-bold text-purple-300 flex items-center mb-3">
                <ShoppingCart className="mr-1.5" size={16} />
                催眠商店
              </h3>
              <div className="space-y-4">
                {Object.keys(shopGroups)
                  .sort()
                  .map(tier => (
                    <div key={tier}>
                      <h4 className="text-purple-300 font-bold mb-2 text-xs border-b border-purple-500/30 pb-1">
                        {tier}
                      </h4>
                      <div className="space-y-2">
                        {shopGroups[tier].map(feature => {
                          const canBuy = canPurchaseFeature(feature.price);
                          return (
                            <div
                              key={feature.id}
                              className="bg-white/5 border border-purple-500/30 rounded-lg p-3 hover:bg-white/10 transition-colors group"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="text-white font-bold text-sm group-hover:text-purple-300 transition-colors">
                                    {feature.name}
                                  </h4>
                                  <span className="text-xs text-purple-400">{feature.tier}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                  <span
                                    className={`text-sm font-bold mb-1 ${canBuy ? 'text-yellow-400' : 'text-red-400'}`}
                                  >
                                    {feature.price?.toLocaleString()} PT
                                  </span>
                                  <button
                                    onClick={() => purchaseFeature(feature.id, feature.price)}
                                    disabled={!canBuy}
                                    className={`text-xs px-2 py-1 rounded shadow transition-colors ${
                                      canBuy
                                        ? 'bg-purple-600 hover:bg-purple-500 text-white'
                                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                    }`}
                                  >
                                    購買
                                  </button>
                                </div>
                              </div>
                              <p className="text-xs text-gray-400 mt-2 line-clamp-2">{feature.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                {Object.keys(shopGroups).length === 0 && (
                  <div className="text-center py-4 text-gray-500 text-sm">商店內目前沒有可購買的催眠</div>
                )}
              </div>
            </section>
          </div>
        )}

        {/* 4. 催眠製作頁面 (CREATE) */}
        {activeSubTab === 'CREATE' && (
          <div className="animate-fade-in space-y-3">
            <section className="bg-black/40 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <h3 className="text-sm font-bold text-purple-300 flex items-center mb-3">
                <Edit3 className="mr-1.5" size={16} />
                催眠製作
              </h3>

              {!canCreateCustom ? (
                <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-3 mb-4">
                  <p className="text-xs text-purple-200">
                    <span className="font-bold text-yellow-400">提示：</span> 只有 VIP 4
                    及以上等級可以製作自訂催眠。目前的等級為 {userData.vipLevel}。
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">催眠名稱</label>
                    <input
                      type="text"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400 transition-colors"
                      placeholder="輸入催眠名稱..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">催眠效果</label>
                    <textarea
                      value={customDesc}
                      onChange={e => setCustomDesc(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-400 transition-colors hypno-scrollbar"
                      rows={3}
                      placeholder="描述催眠的具體效果..."
                    ></textarea>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-300 mb-1">催眠強度</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setCustomTier('VIP 0')}
                        className={`border rounded-lg p-2 text-xs transition-colors ${
                          customTier === 'VIP 0'
                            ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        微弱 (VIP 0)
                      </button>
                      <button
                        onClick={() => setCustomTier('VIP 2')}
                        className={`border rounded-lg p-2 text-xs transition-colors ${
                          customTier === 'VIP 2'
                            ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        中等 (VIP 2)
                      </button>
                      <button
                        onClick={() => setCustomTier('VIP 4')}
                        className={`border rounded-lg p-2 text-xs transition-colors ${
                          customTier === 'VIP 4'
                            ? 'bg-purple-600/30 border-purple-500/50 text-purple-200'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        強烈 (VIP 4)
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/10">
                    <span className="text-sm font-bold text-white">永久催眠</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={customPermanent}
                        onChange={e => setCustomPermanent(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-500"></div>
                    </label>
                  </div>

                  <button
                    onClick={handleCreateCustomClick}
                    disabled={!customName.trim() || !customDesc.trim()}
                    className={`w-full font-bold py-3 rounded-xl shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-all flex items-center justify-center mt-4 ${
                      customName.trim() && customDesc.trim()
                        ? 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    <Plus size={18} className="mr-1" />
                    計算製作成本
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Create Custom Hypnosis Confirmation Modal */}
      {showCreateModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Edit3 className="mr-2 text-purple-400" size={20} />
                確認製作催眠
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-white p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="font-bold text-white text-sm mb-1">{customName}</div>
                <div className="text-xs text-gray-400 mb-2">{customDesc}</div>
                <div className="flex space-x-2">
                  <span className="text-[10px] bg-white/10 text-yellow-400 px-2 py-0.5 rounded">{customTier}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded border ${customPermanent ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}
                  >
                    {customPermanent ? '永久' : '持續'}
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                <span className="text-sm font-bold text-white">製作成本 (金錢):</span>
                <span className={`text-lg font-bold ${canAffordCustom ? 'text-yellow-400' : 'text-red-400'}`}>
                  ¥ {customCost.toLocaleString()}
                </span>
              </div>
              {!canAffordCustom && (
                <div className="text-xs text-red-400 flex items-start mt-2">
                  <AlertTriangle size={14} className="mr-1 shrink-0 mt-0.5 text-red-500" />
                  <span>金錢不足，無法製作此催眠。</span>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 bg-black/40 flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-bold hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmCreateCustom}
                disabled={!canAffordCustom}
                className={`flex-1 py-3 rounded-xl font-bold shadow-lg transition-all flex items-center justify-center ${
                  canAffordCustom
                    ? 'bg-purple-600 hover:bg-purple-500 text-white active:scale-95'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
              >
                <Check size={16} className="mr-1" />
                確認製作
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
