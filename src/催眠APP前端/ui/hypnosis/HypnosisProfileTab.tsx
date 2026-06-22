import React, { useState } from 'react';
import { RuntimeData } from '../mock/mockModels';
import { MockApi } from '../mock/mockApi';
import {
  User,
  Crown,
  Zap,
  Coins,
  Star,
  ShieldAlert,
  Clock,
  RefreshCw,
  Activity,
  ArrowRightLeft,
  ArrowUpCircle,
  X,
  Plus,
} from 'lucide-react';

export const HypnosisProfileTab: React.FC<{
  data: RuntimeData | null;
  reload: () => void;
  vipEndDate: string;
  mcPercent: number;
  formatMoney: (val: number) => string;
}> = ({ data, reload, vipEndDate, mcPercent, formatMoney }) => {
  const [showVipModal, setShowVipModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [exchangeType, setExchangeType] = useState<'moneyToMc' | 'moneyToPts' | 'ptsToMcMax' | 'ptsToMoney'>(
    'moneyToMc',
  );

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
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* 1. 頂部區 (玩家基本資訊) */}
      <div className="px-3 md:px-4 pt-3 md:pt-3 pb-1 md:pb-1 shrink-0">
        <div className="bg-[#13102a] rounded-xl border border-purple-900/30 p-3 md:p-4 flex items-center gap-3 md:gap-4 shrink-0">
          <div className="w-12 md:w-14 h-12 md:h-14 rounded-full bg-[#1a1530] flex items-center justify-center border border-purple-500/40 shrink-0 shadow-[0_0_15px_rgba(168,85,247,0.2)]">
            <User className="w-6 h-6 md:w-7 md:h-7 text-purple-400" />
          </div>
          <div className="flex flex-col flex-1">
            <div className="text-[17px] md:text-lg font-bold text-white mb-1">{data.user.userName || '催眠大師'}</div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-1.5 md:px-2 py-0.5 rounded-md bg-amber-900/30 border border-amber-500/30 text-[10px] md:text-[11px] font-bold text-amber-400 whitespace-nowrap shrink-0">
                <Crown className="w-[11px] h-[11px] md:w-3 md:h-3" />
                <span>VIP {data.user.vipTier}</span>
              </div>
              <div className="text-[9px] md:text-[10px] text-gray-400 flex flex-col md:flex-row items-start md:items-center gap-px md:gap-1 shrink-0 text-left md:text-left">
                <div className="flex items-center gap-0.5 md:gap-1">
                  <Clock className="w-[9px] h-[9px] md:w-2.5 md:h-2.5 shrink-0" />
                  <span>到期:</span>
                </div>
                <span className="leading-[1.1]">{vipEndDate}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 md:px-4 pt-2 md:pt-2 pb-20 md:pb-24 flex flex-col gap-3 md:gap-4 no-scrollbar">
        {/* 2. 中間資源區 */}
        <div className="flex flex-col gap-3 shrink-0">
          {/* MC 能量欄 */}
          <div className="bg-[#13102a] rounded-xl border border-purple-900/30 p-3 md:p-4 flex flex-col gap-2 md:gap-3">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 md:w-4 md:h-4 text-purple-400" />
                <span className="text-[13px] md:text-sm font-bold text-white">MC 能量</span>
              </div>
              <div className="text-[13px] md:text-sm font-mono text-white font-bold">
                {data.user.mcEnergy}{' '}
                <span className="text-[11px] md:text-xs text-gray-500">/ {data.user.mcEnergyMax}</span>
              </div>
            </div>
            <div className="w-full h-[5px] md:h-[6px] bg-[#1a1530] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${mcPercent}%`, background: 'linear-gradient(90deg, #a855f7, #c084fc)' }}
              />
            </div>
            <div className="flex justify-between items-center text-[10px] md:text-[11px] text-gray-400">
              <div className="flex items-center gap-1">
                <Activity className="w-[11px] h-[11px] md:w-3 md:h-3" />
                累計消耗 MC: <span className="font-mono text-gray-300">{data.user.totalConsumedMc}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => openExchangeModal('moneyToMc')}
                className="flex-1 py-1.5 md:py-2 rounded-lg bg-[#1a1530] hover:bg-purple-900/40 border border-purple-900/50 text-[11px] md:text-xs font-semibold text-purple-300 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-[13px] h-[13px] md:w-3.5 md:h-3.5" />
                購買能量
              </button>
              <button
                onClick={() => openExchangeModal('ptsToMcMax')}
                className="flex-1 py-1.5 md:py-2 rounded-lg bg-[#1a1530] hover:bg-purple-900/40 border border-purple-900/50 text-[11px] md:text-xs font-semibold text-purple-300 transition-colors flex items-center justify-center gap-1"
              >
                <ArrowUpCircle className="w-[13px] h-[13px] md:w-3.5 md:h-3.5" />
                提升上限
              </button>
            </div>
          </div>

          {/* 金錢欄與催眠點欄 (同一行) */}
          <div className="grid grid-cols-2 gap-2 md:gap-3">
            {/* 金錢欄 */}
            <div className="bg-[#13102a] rounded-xl border border-yellow-900/30 p-2.5 md:p-3 flex flex-col justify-between gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-1.5">
                <Coins className="w-[13px] h-[13px] md:w-3.5 md:h-3.5 text-yellow-400" />
                <span className="text-[11px] md:text-xs font-bold text-gray-300">持有金錢</span>
              </div>
              <div className="text-[15px] md:text-base font-mono text-white font-bold">
                {formatMoney(data.user.money)}
              </div>
              <button
                onClick={() => openExchangeModal('ptsToMoney')}
                className="w-full py-1 md:py-1.5 rounded-md bg-yellow-900/20 hover:bg-yellow-900/40 border border-yellow-900/50 text-[10px] md:text-[11px] font-semibold text-yellow-500 transition-colors flex items-center justify-center gap-1"
              >
                <ArrowRightLeft className="w-[11px] h-[11px] md:w-3 md:h-3" />
                資源兌換
              </button>
            </div>

            {/* 催眠點欄 */}
            <div className="bg-[#13102a] rounded-xl border border-purple-900/30 p-2.5 md:p-3 flex flex-col justify-between gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-1.5">
                <Star className="w-[13px] h-[13px] md:w-3.5 md:h-3.5 text-purple-400" />
                <span className="text-[11px] md:text-xs font-bold text-gray-300">催眠點 (PTS)</span>
              </div>
              <div className="text-[15px] md:text-base font-mono text-white font-bold">{data.user.mcPoints}</div>
              <button
                onClick={() => openExchangeModal('moneyToPts')}
                className="w-full py-1 md:py-1.5 rounded-md bg-purple-900/20 hover:bg-purple-900/40 border border-purple-900/50 text-[10px] md:text-[11px] font-semibold text-purple-400 transition-colors flex items-center justify-center gap-1"
              >
                <Plus className="w-[11px] h-[11px] md:w-3 md:h-3" />
                購買 PTS
              </button>
            </div>
          </div>
        </div>

        {/* 3. VIP 資訊區 */}
        <div className="bg-[#13102a] rounded-xl border border-amber-900/30 p-3 md:p-4 flex flex-col gap-2 md:gap-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="w-3.5 h-3.5 md:w-4 md:h-4 text-amber-400" />
              <span className="text-[13px] md:text-sm font-bold text-white">VIP 資訊</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-1.5 md:py-2 border-b border-amber-900/20">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 md:w-4 md:h-4 text-gray-400" />
              <span className="text-[11px] md:text-xs text-gray-300">VIP 自動續訂</span>
            </div>
            <button
              onClick={toggleAutoRenew}
              className={`relative w-9 md:w-10 h-4.5 md:h-5 rounded-full transition-colors shrink-0 ${
                data.user.vipAutoRenew ? 'bg-emerald-500' : 'bg-gray-700'
              }`}
            >
              <div
                className={`absolute top-[2px] md:top-0.5 w-3.5 md:w-4 h-3.5 md:h-4 rounded-full bg-white shadow transition-transform ${
                  data.user.vipAutoRenew ? 'translate-x-[20px] md:translate-x-[22px]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          <button
            onClick={() => setShowVipModal(true)}
            className="w-full py-2 md:py-2.5 rounded-lg bg-amber-900/20 hover:bg-amber-900/40 border border-amber-500/30 text-[13px] md:text-sm font-bold text-amber-400 transition-colors flex items-center justify-center gap-1.5 md:gap-2 mt-1"
          >
            <ArrowUpCircle className="w-3.5 h-3.5 md:w-4 md:h-4" />
            升級 VIP
          </button>
        </div>

        {/* 4. 風險指標區 */}
        <div className="bg-[#13102a] rounded-xl border border-red-900/30 p-3 md:p-4 flex flex-col gap-2 md:gap-3 shrink-0">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 md:w-4 md:h-4 text-red-400" />
              <span className="text-[13px] md:text-sm font-bold text-white">風險指標</span>
            </div>
            <span className="text-[13px] md:text-sm font-mono font-bold text-red-400">{data.user.suspicion}%</span>
          </div>
          <div className="w-full h-[5px] md:h-[6px] bg-[#1a1530] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, data.user.suspicion)}%`,
                background: 'linear-gradient(90deg, #ef4444, #f87171)',
              }}
            />
          </div>
          <div className="text-[10px] md:text-[11px] text-gray-400">
            {data.user.suspicion > 80
              ? '極度危險！請立即停止可疑行為！'
              : data.user.suspicion > 50
                ? '警告：可疑度偏高。'
                : data.user.suspicion > 20
                  ? '注意：已引起部分懷疑。'
                  : '安全：目前未引起明顯懷疑。'}
          </div>
        </div>
      </div>

      {/* Modal 區 */}
      {showVipModal && <VipUpgradeModal data={data} reload={reload} onClose={() => setShowVipModal(false)} />}

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
  React.useEffect(() => {
    const containers = document.querySelectorAll('.overflow-y-auto');
    const originalStyles = Array.from(containers).map(c => (c as HTMLElement).style.overflow);
    containers.forEach(c => ((c as HTMLElement).style.overflow = 'hidden'));
    return () => {
      containers.forEach((c, i) => ((c as HTMLElement).style.overflow = originalStyles[i]));
    };
  }, []);

  const currentTier = data.user.vipTier;
  const nextTier = currentTier + 1;

  const upgradeCost =
    nextTier === 1
      ? 3000
      : nextTier === 2
        ? 6000
        : nextTier === 3
          ? 10000
          : nextTier === 4
            ? 20000
            : nextTier === 5
              ? 40000
              : 0;

  const requiredMc =
    nextTier === 1
      ? 50
      : nextTier === 2
        ? 100
        : nextTier === 3
          ? 300
          : nextTier === 4
            ? 500
            : nextTier === 5
              ? 1000
              : 0;

  const canUpgrade = nextTier <= 5 && data.user.money >= upgradeCost && data.user.totalConsumedMc >= requiredMc;

  const handleUpgrade = async () => {
    if (!canUpgrade) return;
    await MockApi.updateUserResource({
      vipTier: nextTier,
      money: data.user.money - upgradeCost,
    });
    reload();
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 md:p-4">
      <div className="bg-[#13102a] rounded-xl border border-amber-900/50 p-4 md:p-5 w-full max-w-sm flex flex-col gap-3 md:gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-base md:text-lg">
            <Crown size={20} />
            升級 VIP 等級
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {nextTier <= 5 ? (
          <>
            <div className="flex items-center justify-center gap-3 md:gap-4 py-3 md:py-4">
              <div className="flex flex-col items-center gap-1">
                <span className="text-[13px] md:text-sm text-gray-400">目前等級</span>
                <span className="px-2.5 md:px-3 py-1 bg-gray-800 rounded-lg font-bold text-gray-300">
                  VIP {currentTier}
                </span>
              </div>
              <ArrowRightLeft size={20} className="text-gray-500" />
              <div className="flex flex-col items-center gap-1">
                <span className="text-[13px] md:text-sm text-amber-400">下一等級</span>
                <span className="px-2.5 md:px-3 py-1 bg-amber-900/30 border border-amber-500/50 rounded-lg font-bold text-amber-400">
                  VIP {nextTier}
                </span>
              </div>
            </div>

            <div className="bg-[#0c0a1e] rounded-lg p-2.5 md:p-3 border border-amber-900/30 flex flex-col gap-2">
              <div>
                <div className="text-[10px] md:text-[11px] text-gray-400 mb-1">升級費用 (金錢)</div>
                <div
                  className={`text-base md:text-lg font-mono font-bold ${data.user.money >= upgradeCost ? 'text-yellow-400' : 'text-red-400'}`}
                >
                  ¥{upgradeCost.toLocaleString()}
                </div>
                <div className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                  目前持有: ¥{data.user.money.toLocaleString()}
                </div>
              </div>
              <div className="border-t border-amber-900/20 pt-2">
                <div className="text-[10px] md:text-[11px] text-gray-400 mb-1">要求累計消耗 MC</div>
                <div
                  className={`text-base md:text-lg font-mono font-bold ${data.user.totalConsumedMc >= requiredMc ? 'text-cyan-400' : 'text-red-400'}`}
                >
                  {requiredMc.toLocaleString()} MC
                </div>
                <div className="text-[9px] md:text-[10px] text-gray-500 mt-1">
                  目前累計: {data.user.totalConsumedMc.toLocaleString()} MC
                </div>
              </div>
            </div>

            <div className="flex gap-2 md:gap-3 mt-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 md:py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-[13px] md:text-sm hover:bg-gray-800/50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleUpgrade}
                disabled={!canUpgrade}
                className="flex-1 py-2 md:py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-[13px] md:text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
              >
                確認升級
              </button>
            </div>
          </>
        ) : (
          <div className="py-6 text-center text-gray-300">您已達到最高 VIP 等級！</div>
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
  const [exchangeType, setExchangeType] = useState<'moneyToMc' | 'moneyToPts' | 'ptsToMcMax' | 'ptsToMoney'>(
    initialType,
  );
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
        canExchange = amount > 0 && data.user.money >= cost && data.user.mcEnergy + gain <= data.user.mcEnergyMax;
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
    <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-3 md:p-4">
      <div className="bg-[#13102a] rounded-xl border border-purple-900/50 p-4 md:p-5 w-full max-w-sm flex flex-col gap-3 md:gap-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-purple-400 font-bold text-base md:text-lg">
            <ArrowRightLeft size={20} />
            資源兌換
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-2 p-1 bg-[#0c0a1e] rounded-lg border border-purple-900/30">
          <div className="grid grid-cols-2 gap-1.5 md:gap-2">
            <button
              onClick={() => setExchangeType('moneyToMc')}
              className={`py-1.5 text-[11px] md:text-xs font-semibold rounded-md transition-colors ${exchangeType === 'moneyToMc' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              購買 MC 能量
            </button>
            <button
              onClick={() => setExchangeType('ptsToMcMax')}
              className={`py-1.5 text-[11px] md:text-xs font-semibold rounded-md transition-colors ${exchangeType === 'ptsToMcMax' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              提升能量上限
            </button>
            <button
              onClick={() => setExchangeType('ptsToMoney')}
              className={`py-1.5 text-[11px] md:text-xs font-semibold rounded-md transition-colors ${exchangeType === 'ptsToMoney' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              兌換金錢
            </button>
            <button
              onClick={() => setExchangeType('moneyToPts')}
              className={`py-1.5 text-[11px] md:text-xs font-semibold rounded-md transition-colors ${exchangeType === 'moneyToPts' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              購買催眠點
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 md:gap-3">
          <div>
            <label className="text-[10px] md:text-[11px] text-gray-400 mb-1 block">{inputLabel}</label>
            <div className="flex items-center">
              <button
                onClick={() => setAmount(Math.max(1, amount - 1))}
                className="w-8 md:w-10 h-[28px] md:h-[32px] bg-[#0c0a1e] border border-r-0 border-purple-900/30 rounded-l-lg text-gray-400 hover:text-white hover:bg-purple-900/40 flex items-center justify-center transition-colors shrink-0"
              >
                -
              </button>
              <input
                type="number"
                min={1}
                value={amount}
                onChange={e => setAmount(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 min-w-0 text-center bg-[#0c0a1e] border-y border-purple-900/30 h-[28px] md:h-[32px] text-white outline-none focus:border-purple-500/50 px-0"
              />
              <button
                onClick={() => setAmount(amount + 1)}
                className="w-8 md:w-10 h-[28px] md:h-[32px] bg-[#0c0a1e] border border-l-0 border-purple-900/30 rounded-r-lg text-gray-400 hover:text-white hover:bg-purple-900/40 flex items-center justify-center transition-colors shrink-0"
              >
                +
              </button>
            </div>
          </div>

          <div className="bg-[#0c0a1e] rounded-lg p-2.5 md:p-3 border border-purple-900/30 grid grid-cols-2 gap-2 md:gap-3">
            <div>
              <div className="text-[9px] md:text-[10px] text-gray-500 mb-1">消耗 {costLabel}</div>
              <div
                className={`text-[13px] md:text-sm font-mono font-bold ${
                  exchangeType === 'moneyToMc' || exchangeType === 'moneyToPts'
                    ? data.user.money >= cost
                      ? 'text-yellow-400'
                      : 'text-red-400'
                    : data.user.mcPoints >= cost
                      ? 'text-purple-400'
                      : 'text-red-400'
                }`}
              >
                {exchangeType === 'moneyToMc' || exchangeType === 'moneyToPts' ? '¥' : ''}
                {cost.toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-[9px] md:text-[10px] text-gray-500 mb-1">獲得 {gainLabel}</div>
              <div className="text-[13px] md:text-sm font-mono font-bold text-emerald-400">
                +{gain.toLocaleString()}
              </div>
            </div>
          </div>

          {warning && <div className="text-[10px] md:text-[11px] text-red-400 mt-1">{warning}</div>}
        </div>

        <div className="flex gap-2 md:gap-3 mt-1.5 md:mt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 md:py-2.5 rounded-lg border border-gray-600/50 text-gray-300 font-medium text-[13px] md:text-sm hover:bg-gray-800/50 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleExchange}
            disabled={!canExchange}
            className="flex-1 py-2 md:py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium text-[13px] md:text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
          >
            確認兌換
          </button>
        </div>
      </div>
    </div>
  );
};
