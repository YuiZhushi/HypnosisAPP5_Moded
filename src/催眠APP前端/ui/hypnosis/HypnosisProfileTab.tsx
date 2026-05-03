import React, { useState } from 'react';
import { RuntimeData, MockApi } from './mockData';
import { User, Crown, Zap, Coins, Star, ShieldAlert, Clock, RefreshCw, Activity, ArrowRightLeft, ArrowUpCircle, X, Plus } from 'lucide-react';

export const HypnosisProfileTab: React.FC<{
  data: RuntimeData | null;
  reload: () => void;
  vipEndDate: string;
  mcPercent: number;
  formatMoney: (val: number) => string;
}> = ({ data, reload, vipEndDate, mcPercent, formatMoney }) => {
  const [showVipModal, setShowVipModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeType, setExchangeType] = useState<'moneyToMc' | 'moneyToPts' | 'ptsToMcMax' | 'ptsToMoney'>('moneyToMc');

  if (!data) return null;

  const toggleAutoRenew = async () => {
    await MockApi.updateUserResource({ vipAutoRenew: !data.user.vipAutoRenew });
    reload();
  };

  const openExchangeModal = (type: 'moneyToMc' | 'moneyToPts' | 'ptsToMcMax' | 'ptsToMoney') => {
    setExchangeType(type);
    setShowExchangeModal(true);
  };

  return (
    <div className="flex flex-col h-full relative overflow-y-auto px-4 py-4 gap-4 no-scrollbar pb-24">
      {/* 1. 頂部區 (玩家基本資訊) */}
      <div className="bg-[#13102a] rounded-xl border border-purple-900/30 p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#1a1530] flex items-center justify-center border border-purple-500/40 shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
          <User size={28} className="text-purple-400" />
        </div>
        <div className="flex flex-col flex-1">
          <div className="text-lg font-bold text-white mb-1">{data.user.userName || '催眠大師'}</div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-900/30 border border-amber-500/30 text-[11px] font-bold text-amber-400">
              <Crown size={12} />
              VIP {data.user.vipTier}
            </div>
            <div className="text-[10px] text-gray-400 flex items-center gap-1">
              <Clock size={10} />
              到期日: {vipEndDate}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 中間資源區 */}
      <div className="flex flex-col gap-3">
        {/* MC 能量欄 */}
        <div className="bg-[#13102a] rounded-xl border border-purple-900/30 p-4 flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <Zap size={16} className="text-purple-400" />
              <span className="text-sm font-bold text-white">MC 能量</span>
            </div>
            <div className="text-sm font-mono text-white font-bold">
              {data.user.mcEnergy} <span className="text-xs text-gray-500">/ {data.user.mcEnergyMax}</span>
            </div>
          </div>
          <div className="w-full h-[6px] bg-[#1a1530] rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${mcPercent}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }} />
          </div>
          <div className="flex justify-between items-center text-[11px] text-gray-400">
            <div className="flex items-center gap-1">
              <Activity size={12} />
              累計消耗 MC: <span className="font-mono text-gray-300">{data.user.totalConsumedMc}</span>
            </div>
          </div>
          <div className="flex gap-2 mt-1">
            <button
              onClick={() => openExchangeModal('moneyToMc')}
              className="flex-1 py-2 rounded-lg bg-[#1a1530] hover:bg-purple-900/40 border border-purple-900/50 text-xs font-semibold text-purple-300 transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={14} />
              購買能量
            </button>
            <button
              onClick={() => openExchangeModal('ptsToMcMax')}
              className="flex-1 py-2 rounded-lg bg-[#1a1530] hover:bg-purple-900/40 border border-purple-900/50 text-xs font-semibold text-purple-300 transition-colors flex items-center justify-center gap-1"
            >
              <ArrowUpCircle size={14} />
              提升上限
            </button>
          </div>
        </div>

        {/* 金錢欄與催眠點欄 (同一行) */}
        <div className="grid grid-cols-2 gap-3">
          {/* 金錢欄 */}
          <div className="bg-[#13102a] rounded-xl border border-yellow-900/30 p-3 flex flex-col justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Coins size={14} className="text-yellow-400" />
              <span className="text-xs font-bold text-gray-300">持有金錢</span>
            </div>
            <div className="text-base font-mono text-white font-bold">{formatMoney(data.user.money)}</div>
            <button
              onClick={() => openExchangeModal('ptsToMoney')}
              className="w-full py-1.5 rounded-md bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-900/50 text-[11px] font-semibold text-yellow-500 transition-colors flex items-center justify-center gap-1"
            >
              <ArrowRightLeft size={12} />
              資源兌換
            </button>
          </div>

          {/* 催眠點欄 */}
          <div className="bg-[#13102a] rounded-xl border border-purple-900/30 p-3 flex flex-col justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <Star size={14} className="text-purple-400" />
              <span className="text-xs font-bold text-gray-300">催眠點 (PTS)</span>
            </div>
            <div className="text-base font-mono text-white font-bold">{data.user.mcPoints}</div>
            <button
              onClick={() => openExchangeModal('moneyToPts')}
              className="w-full py-1.5 rounded-md bg-purple-900/20 hover:bg-purple-900/40 border border-purple-900/50 text-[11px] font-semibold text-purple-400 transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={12} />
              購買 PTS
            </button>
          </div>
        </div>
      </div>

      {/* 3. VIP 資訊區 */}
      <div className="bg-[#13102a] rounded-xl border border-amber-900/30 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown size={16} className="text-amber-400" />
            <span className="text-sm font-bold text-white">VIP 資訊</span>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-b border-amber-900/20">
          <div className="flex items-center gap-2">
            <RefreshCw size={14} className="text-gray-400" />
            <span className="text-xs text-gray-300">VIP 自動續訂</span>
          </div>
          <button
            onClick={toggleAutoRenew}
            className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${
              data.user.vipAutoRenew ? 'bg-emerald-500' : 'bg-gray-700'
            }`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
              data.user.vipAutoRenew ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`} />
          </button>
        </div>

        <button
          onClick={() => setShowVipModal(true)}
          className="w-full py-2.5 rounded-lg bg-amber-900/20 hover:bg-amber-900/40 border border-amber-500/30 text-sm font-bold text-amber-400 transition-colors flex items-center justify-center gap-2 mt-1"
        >
          <ArrowUpCircle size={16} />
          升級 VIP
        </button>
      </div>

      {/* 4. 風險指標區 */}
      <div className="bg-[#13102a] rounded-xl border border-red-900/30 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <ShieldAlert size={16} className="text-red-400" />
            <span className="text-sm font-bold text-white">風險指標</span>
          </div>
          <span className="text-sm font-mono font-bold text-red-400">{data.user.suspicion}%</span>
        </div>
        <div className="w-full h-[6px] bg-[#1a1530] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, data.user.suspicion)}%`, background: 'linear-gradient(90deg, #ef4444, #f87171)' }} />
        </div>
        <div className="text-[11px] text-gray-400">
          {data.user.suspicion > 80 ? '極度危險！請立即停止可疑行為！' :
           data.user.suspicion > 50 ? '警告：可疑度偏高。' :
           data.user.suspicion > 20 ? '注意：已引起部分懷疑。' : '安全：目前未引起明顯懷疑。'}
        </div>
      </div>

      {/* Modal 區 */}
      {showVipModal && (
        <VipUpgradeModal
          data={data}
          reload={reload}
          onClose={() => setShowVipModal(false)}
        />
      )}

      {showExchangeModal && (
        <ResourceExchangeModal
          data={data}
          reload={reload}
          onClose={() => setShowExchangeModal(false)}
          initialType={exchangeType}
        />
      )}
    </div>
  );
};

// ==========================================
// 升級 VIP Modal
// ==========================================
const VipUpgradeModal: React.FC<{
  data: RuntimeData;
  reload: () => void;
  onClose: () => void;
}> = ({ data, reload, onClose }) => {
  const currentTier = data.user.vipTier;
  const nextTier = currentTier + 1;

  const upgradeCost = nextTier === 1 ? 3000 :
                      nextTier === 2 ? 6000 :
                      nextTier === 3 ? 10000 :
                      nextTier === 4 ? 20000 :
                      nextTier === 5 ? 40000 : 0;

  const requiredMc = nextTier === 1 ? 50 :
                     nextTier === 2 ? 100 :
                     nextTier === 3 ? 300 :
                     nextTier === 4 ? 500 :
                     nextTier === 5 ? 1000 : 0;

  const canUpgrade = nextTier <= 5 && data.user.money >= upgradeCost && data.user.totalConsumedMc >= requiredMc;

  const handleUpgrade = async () => {
    if (!canUpgrade) return;
    await MockApi.updateUserResource({
      vipTier: nextTier,
      money: data.user.money - upgradeCost
    });
    reload();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-[#13102a] rounded-xl border border-amber-900/50 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-lg">
            <Crown size={20} />
            升級 VIP 等級
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {nextTier <= 5 ? (
          <>
            <div className="flex items-center justify-center gap-4 py-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm text-gray-400">目前等級</span>
                <span className="px-3 py-1 bg-gray-800 rounded-lg font-bold text-gray-300">VIP {currentTier}</span>
              </div>
              <ArrowRightLeft size={20} className="text-gray-500" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-sm text-amber-400">下一等級</span>
                <span className="px-3 py-1 bg-amber-900/30 border border-amber-500/50 rounded-lg font-bold text-amber-400">VIP {nextTier}</span>
              </div>
            </div>

            <div className="bg-[#0c0a1e] rounded-lg p-3 border border-amber-900/30 flex flex-col gap-2">
              <div>
                <div className="text-[11px] text-gray-400 mb-1">升級費用 (金錢)</div>
                <div className={`text-lg font-mono font-bold ${data.user.money >= upgradeCost ? 'text-yellow-400' : 'text-red-400'}`}>
                  ¥{upgradeCost.toLocaleString()}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  目前持有: ¥{data.user.money.toLocaleString()}
                </div>
              </div>
              <div className="border-t border-amber-900/20 pt-2">
                <div className="text-[11px] text-gray-400 mb-1">要求累計消耗 MC</div>
                <div className={`text-lg font-mono font-bold ${data.user.totalConsumedMc >= requiredMc ? 'text-cyan-400' : 'text-red-400'}`}>
                  {requiredMc.toLocaleString()} MC
                </div>
                <div className="text-[10px] text-gray-500 mt-1">
                  目前累計: {data.user.totalConsumedMc.toLocaleString()} MC
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpgrade}
                disabled={!canUpgrade}
                className="flex-1 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
              >
                確認升級
              </button>
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-gray-300">
            您已達到最高 VIP 等級！
          </div>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 資源兌換 Modal
// ==========================================
const ResourceExchangeModal: React.FC<{
  data: RuntimeData;
  reload: () => void;
  onClose: () => void;
  initialType: 'moneyToMc' | 'moneyToPts' | 'ptsToMcMax' | 'ptsToMoney';
}> = ({ data, reload, onClose, initialType }) => {
  const [exchangeType, setExchangeType] = useState<'moneyToMc' | 'moneyToPts' | 'ptsToMcMax' | 'ptsToMoney'>(initialType);
  const [amount, setAmount] = useState(1);

  const getExchangeDetails = () => {
    let cost = 0;
    let gain = 0;
    let costLabel = '';
    let gainLabel = '';
    let inputLabel = '';
    let canExchange = false;
    let warning = '';

    switch (exchangeType) {
      case 'moneyToMc':
        cost = amount * 100; // 100 money per 1 MC
        gain = amount;
        costLabel = '金錢';
        gainLabel = 'MC 能量';
        inputLabel = '購買多少 MC 能量';
        canExchange = amount > 0 && data.user.money >= cost && (data.user.mcEnergy + gain <= data.user.mcEnergyMax);
        if (data.user.mcEnergy + gain > data.user.mcEnergyMax) {
          warning = `警告：兌換後將超過 MC 能量上限 (${data.user.mcEnergyMax})`;
        }
        break;
      case 'ptsToMcMax':
        cost = amount; // 1 PTS per 1 MC Max
        gain = amount;
        costLabel = '催眠點 (PTS)';
        gainLabel = 'MC 能量上限';
        inputLabel = '提升多少能量上限';
        canExchange = amount > 0 && data.user.mcPoints >= cost;
        break;
      case 'ptsToMoney':
        cost = amount;
        gain = amount * 800; // 1 PTS = 800 money
        costLabel = '催眠點 (PTS)';
        gainLabel = '金錢';
        inputLabel = '消耗多少催眠點';
        canExchange = amount > 0 && data.user.mcPoints >= cost;
        break;
      case 'moneyToPts':
        cost = amount * 1000; // 1000 money per 1 PTS
        gain = amount;
        costLabel = '金錢';
        gainLabel = '催眠點 (PTS)';
        inputLabel = '購買多少催眠點';
        canExchange = amount > 0 && data.user.money >= cost;
        break;
    }

    return { cost, gain, costLabel, gainLabel, inputLabel, canExchange, warning };
  };

  const { cost, gain, costLabel, gainLabel, inputLabel, canExchange, warning } = getExchangeDetails();

  const handleExchange = async () => {
    if (!canExchange) return;

    const patch: any = {};
    if (exchangeType === 'moneyToMc') {
      patch.money = data.user.money - cost;
      patch.mcEnergy = data.user.mcEnergy + gain;
    } else if (exchangeType === 'ptsToMcMax') {
      patch.mcPoints = data.user.mcPoints - cost;
      patch.mcEnergyMax = data.user.mcEnergyMax + gain;
    } else if (exchangeType === 'ptsToMoney') {
      patch.mcPoints = data.user.mcPoints - cost;
      patch.money = data.user.money + gain;
    } else if (exchangeType === 'moneyToPts') {
      patch.money = data.user.money - cost;
      patch.mcPoints = data.user.mcPoints + gain;
    }

    await MockApi.updateUserResource(patch);
    reload();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="bg-[#13102a] rounded-xl border border-purple-900/50 p-5 w-full max-w-sm flex flex-col gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-lg">
            <ArrowRightLeft size={20} />
            資源兌換
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-2 p-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setExchangeType('moneyToMc')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${exchangeType === 'moneyToMc' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              購買 MC 能量
            </button>
            <button
              onClick={() => setExchangeType('ptsToMcMax')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${exchangeType === 'ptsToMcMax' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              提升能量上限
            </button>
            <button
              onClick={() => setExchangeType('ptsToMoney')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${exchangeType === 'ptsToMoney' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              兌換金錢
            </button>
            <button
              onClick={() => setExchangeType('moneyToPts')}
              className={`py-1.5 text-xs font-semibold rounded-md transition-colors ${exchangeType === 'moneyToPts' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              購買催眠點
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-[11px] text-gray-400 mb-1 block">{inputLabel}</label>
            <input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-full bg-[#0c0a1e] border border-purple-900/30 rounded-lg px-3 py-2 text-white outline-none focus:border-purple-500/50"
            />
          </div>

          <div className="bg-[#0c0a1e] rounded-lg p-3 border border-purple-900/30 grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-gray-500 mb-1">消耗 {costLabel}</div>
              <div className={`text-sm font-mono font-bold ${
                (exchangeType === 'moneyToMc' || exchangeType === 'moneyToPts')
                  ? (data.user.money >= cost ? 'text-yellow-400' : 'text-red-400')
                  : (data.user.mcPoints >= cost ? 'text-purple-400' : 'text-red-400')
              }`}>
                {(exchangeType === 'moneyToMc' || exchangeType === 'moneyToPts') ? '¥' : ''}{cost.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-gray-500 mb-1">獲得 {gainLabel}</div>
              <div className="text-sm font-mono font-bold text-emerald-400">
                +{gain.toLocaleString()}
              </div>
            </div>
          </div>

          {warning && (
            <div className="text-[11px] text-red-400 mt-1">
              {warning}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-sm hover:bg-gray-800/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExchange}
            disabled={!canExchange}
            className="flex-1 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
          >
            確認兌換
          </button>
        </div>
      </div>
    </div>
  );
};
