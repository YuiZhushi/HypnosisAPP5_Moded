import React from 'react';
import { ArrowLeft, UserCircle, Crown, Zap, CircleDollarSign, Coins } from 'lucide-react';
import { APP_LABELS } from '../HypnosisUILogics';

interface AppHeaderProps {
  userData: {
    avatar?: string;
    name: string;
    vipLevel: string;
    vipExpiration: string;
    autoRenew: boolean;
    mcEnergy: number;
    mcEnergyMax: number;
    money: number;
    mcPoints: number;
  };
  onExit?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ userData, onExit }) => {
  return (
    <div className="bg-black/60 backdrop-blur-sm p-2 border-b border-white/10 sticky top-[24px] z-40">
      {/* Header Top Row: Back Button, Title, and VIP Info */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => onExit && onExit()}
          className="flex items-center space-x-1 text-gray-300 hover:text-white transition-colors w-[80px]"
        >
          <ArrowLeft size={16} />
          <span className="text-xs font-medium">{APP_LABELS.HEADER.EXIT}</span>
        </button>
        <h1 className="text-lg font-bold text-white flex-1 text-center">{APP_LABELS.HEADER.TITLE}</h1>
        <div className="flex flex-col items-end w-[80px]">
          <div className="flex items-center space-x-1 bg-white/10 px-1.5 py-0.5 rounded text-yellow-400 text-[10px] font-bold">
            <Crown size={10} />
            <span>{userData.vipLevel}</span>
          </div>
        </div>
      </div>

      {/* User Info & Stats Section */}
      <div className="bg-white/5 rounded-lg p-2 border border-white/5 flex flex-col space-y-1.5">
        {/* User Profile (Avatar & Name) and Sub-VIP info */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10 overflow-hidden">
              {userData.avatar ? (
                <img src={userData.avatar} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <UserCircle size={20} className="text-gray-300" />
              )}
            </div>
            <h2 className="text-white font-bold text-sm">{userData.name}</h2>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-gray-400">到期: {userData.vipExpiration}</span>
            {userData.autoRenew && <span className="text-[9px] text-green-400">{APP_LABELS.HEADER.AUTO_RENEW}</span>}
          </div>
        </div>

        {/* Quick Stats Grid (3 Columns, Compact) */}
        <div className="grid grid-cols-3 gap-1.5">
          {/* Energy */}
          <div className="bg-white/5 rounded p-1.5 border border-white/5 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center space-x-1 text-gray-300">
                <Zap size={10} className="text-yellow-400" />
                <span className="text-[9px] font-medium hidden sm:inline">MC 能量</span>
              </div>
              <span className="text-[10px] text-white font-mono">
                {userData.mcEnergy.toFixed(0)}/{userData.mcEnergyMax}
              </span>
            </div>
            <div className="w-full h-1 bg-black/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-purple-500"
                style={{ width: `${Math.min(100, (userData.mcEnergy / userData.mcEnergyMax) * 100)}%` }}
              />
            </div>
          </div>

          {/* Money */}
          <div className="bg-white/5 rounded p-1.5 border border-white/5 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-green-400">
                <CircleDollarSign size={10} />
                <span className="text-[9px] font-medium text-gray-300 hidden sm:inline">金錢</span>
              </div>
              <span className="text-[10px] text-white font-mono font-bold">¥{userData.money.toLocaleString()}</span>
            </div>
          </div>

          {/* MC Points */}
          <div className="bg-white/5 rounded p-1.5 border border-white/5 flex flex-col justify-center">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-1 text-blue-400">
                <Coins size={10} />
                <span className="text-[9px] font-medium text-gray-300 hidden sm:inline">催眠點</span>
              </div>
              <span className="text-[10px] text-white font-mono font-bold">
                {userData.mcPoints.toLocaleString()} PT
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
