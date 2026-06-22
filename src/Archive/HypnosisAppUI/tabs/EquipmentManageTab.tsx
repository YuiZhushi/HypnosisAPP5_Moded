import React, { useState } from 'react';
import { Wrench, CheckCircle, ShoppingCart, PowerOff, Play, X, AlertTriangle } from 'lucide-react';
import { useEquipmentLogic, EquipmentMock } from '../HypnosisUILogics';

export const EquipmentManageTab: React.FC = () => {
  const {
    installedEquipment,
    availableEquipment,
    disabledEquipmentIds,
    toggleEquipmentStatus,
    canPurchaseEquipment,
    purchaseEquipment,
  } = useEquipmentLogic();

  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchasingEquipment, setPurchasingEquipment] = useState<EquipmentMock | null>(null);

  const handlePurchaseClick = (equipment: EquipmentMock) => {
    setPurchasingEquipment(equipment);
    setShowPurchaseModal(true);
  };

  const confirmPurchase = () => {
    if (purchasingEquipment) {
      purchaseEquipment(purchasingEquipment.id, purchasingEquipment.price);
    }
    setShowPurchaseModal(false);
    setPurchasingEquipment(null);
  };

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-6 hypno-scrollbar pb-24">
        {/* Header */}
        <div className="flex items-center space-x-2 text-purple-300 font-bold text-lg mb-4">
          <Wrench size={24} />
          <h2>設備管理</h2>
        </div>

        {/* Installed Equipment List */}
        <section className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <h3 className="text-md font-bold text-green-400 mb-3 flex items-center">
            <CheckCircle size={18} className="mr-2" />
            已安裝設備
          </h3>
          <div className="space-y-3">
            {installedEquipment.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">目前沒有已安裝的設備</div>
            ) : (
              installedEquipment.map(eq => {
                const isDisabled = disabledEquipmentIds.has(eq.id);
                return (
                  <div
                    key={eq.id}
                    className={`p-3 rounded-lg border transition-colors ${isDisabled ? 'bg-white/5 border-white/5 opacity-60' : 'bg-white/10 border-white/10'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className={`text-sm font-bold ${isDisabled ? 'text-gray-400' : 'text-white'}`}>{eq.name}</h4>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded ${eq.isBuiltIn ? 'bg-white/10 text-green-400' : 'bg-white/10 text-yellow-400'}`}
                      >
                        {eq.tier}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">設備介紹: {eq.desc}</p>
                    <div className="flex justify-between items-center border-t border-white/10 pt-2">
                      <span className={`text-xs font-bold ${isDisabled ? 'text-red-400' : 'text-green-400'}`}>
                        狀態: {isDisabled ? '已停用' : '運作中'}
                      </span>
                      <button
                        onClick={() => toggleEquipmentStatus(eq.id)}
                        className={`text-xs px-3 py-1 rounded flex items-center transition-colors ${
                          isDisabled
                            ? 'bg-white/10 hover:bg-white/20 text-green-400'
                            : 'bg-white/5 hover:bg-white/10 text-red-400'
                        }`}
                      >
                        {isDisabled ? <Play size={14} className="mr-1" /> : <PowerOff size={14} className="mr-1" />}
                        {isDisabled ? '啟用設備' : '停用設備'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* Available Equipment List */}
        <section className="bg-black/40 backdrop-blur-sm rounded-xl p-4 border border-white/10">
          <h3 className="text-md font-bold text-purple-300 mb-3 flex items-center">
            <ShoppingCart size={18} className="mr-2" />
            未安裝設備 (可選購)
          </h3>
          <div className="space-y-3">
            {availableEquipment.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">目前沒有可選購的設備</div>
            ) : (
              availableEquipment.map(eq => {
                const canBuy = canPurchaseEquipment(eq.price);
                return (
                  <div key={eq.id} className="bg-white/5 p-3 rounded-lg border border-white/5">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-sm font-bold text-white">{eq.name}</h4>
                      <span className="text-[10px] bg-white/10 text-yellow-400 px-2 py-0.5 rounded">{eq.tier}</span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">設備介紹: {eq.desc}</p>
                    <div className="flex justify-between items-center border-t border-white/10 pt-2">
                      <span className={`text-xs font-bold ${canBuy ? 'text-green-400' : 'text-red-400'}`}>
                        價格: ¥ {eq.price.toLocaleString()}
                      </span>
                      <button
                        onClick={() => handlePurchaseClick(eq)}
                        disabled={!canBuy}
                        className={`text-xs px-3 py-1 rounded flex items-center transition-colors shadow ${
                          canBuy
                            ? 'bg-white/10 hover:bg-white/20 text-white'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <ShoppingCart size={14} className="mr-1" />
                        購買設備
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && purchasingEquipment && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-fade-in">
          <div className="bg-black/60 backdrop-blur-xl border border-white/10 w-full max-w-sm rounded-2xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
              <h3 className="text-lg font-bold text-white flex items-center">
                <ShoppingCart className="mr-2 text-purple-400" size={20} />
                確認購買設備
              </h3>
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="text-gray-400 hover:text-white p-1 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-white/5 border border-white/10 rounded-lg p-3">
                <div className="font-bold text-white text-sm mb-1">{purchasingEquipment.name}</div>
                <div className="text-xs text-gray-400">{purchasingEquipment.desc}</div>
              </div>
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-lg border border-white/10">
                <span className="text-sm font-bold text-white">支付金額:</span>
                <span className="text-lg font-bold text-yellow-400">
                  ¥ {purchasingEquipment.price.toLocaleString()}
                </span>
              </div>
              <div className="text-xs text-gray-400 flex items-start mt-2">
                <AlertTriangle size={14} className="mr-1 shrink-0 mt-0.5 text-yellow-500" />
                <span>購買後設備將自動安裝並可於上方列表中管理。</span>
              </div>
            </div>
            <div className="p-4 border-t border-white/10 bg-black/40 flex gap-3">
              <button
                onClick={() => setShowPurchaseModal(false)}
                className="flex-1 py-3 rounded-xl border border-white/10 text-gray-300 font-bold hover:bg-white/5 transition-colors"
              >
                取消
              </button>
              <button
                onClick={confirmPurchase}
                className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center"
              >
                <ShoppingCart size={16} className="mr-1" />
                確認購買
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
