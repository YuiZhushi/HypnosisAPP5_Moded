import React from 'react';
import { AchievementOrQuestDef, MockUserData } from '../mock/mockModels';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RewardIcon = ({ type }: { type: 'money' | 'pts' | 'mcEnergyMax' | 'mcEnergy' | 'suspicion' }) => {
  switch (type) {
    case 'money':
      return <span className="text-yellow-500 font-bold">$</span>;
    case 'pts':
      return <span className="text-purple-500 font-bold">PT</span>;
    case 'mcEnergyMax':
      return <span className="text-blue-500 font-bold">⚡+</span>;
    case 'mcEnergy':
      return <span className="text-cyan-400 font-bold">⚡</span>;
    case 'suspicion':
      return <span className="text-red-500 font-bold">👁️</span>;
    default:
      return null;
  }
};

export const RewardDisplay = ({ reward }: { reward: Record<string, number> }) => {
  return (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {Object.entries(reward).map(([type, amount]) => (
        <div key={type} className="flex items-center gap-1 text-[10px] md:text-[11px] font-medium bg-[#0c0a1e] border border-purple-900/30 px-1.5 py-0.5 rounded-md shrink-0">
          <RewardIcon type={type as 'money' | 'pts' | 'mcEnergyMax' | 'mcEnergy' | 'suspicion'} />
          <span className="text-white">{amount}</span>
        </div>
      ))}
    </div>
  );
};

interface AchievementTabProps {
  achievements: Record<string, AchievementOrQuestDef>;
  userData: MockUserData;
  onClaim: (id: string) => void;
}

export const AchievementTab: React.FC<AchievementTabProps> = ({ achievements, userData, onClaim }) => {
  return (
    <div className="space-y-3">
      {Object.entries(achievements).map(([id, ach]) => {
        const state = userData.ownedAchievements[id];
        const isUnlocked = !!state;
        const isClaimed = state?.claimed || false;

        return (
          <div
            key={id}
            className={cn(
              "p-2.5 md:p-3 rounded-xl border transition-all",
              isClaimed
                ? "bg-[#13102a]/40 border-purple-900/20 opacity-50 grayscale-30"
                : isUnlocked
                ? "bg-[#13102a] border-yellow-500/50 shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                : "bg-[#0c0a1e] border-purple-900/30"
            )}
          >
            <div className="flex justify-between items-start mb-1.5">
              <h3 className={cn("font-bold text-[13px] md:text-sm", isUnlocked && !isClaimed ? "text-yellow-400" : "text-gray-200")}>
                {ach.name}
              </h3>
              <RewardDisplay reward={ach.reward} />
            </div>
            <p className="text-[11px] md:text-xs text-gray-400 mb-2 leading-snug">{ach.description}</p>

            <div className="flex justify-end gap-2 mt-2">
              <div className="flex items-center gap-2 shrink-0">
                {isClaimed ? (
                  <span className="text-[10px] md:text-[11px] text-gray-500 font-medium px-2.5 py-1">已領取</span>
                ) : isUnlocked ? (
                  <button
                    onClick={() => onClaim(id)}
                    className="text-[10px] md:text-[11px] font-medium bg-yellow-500 hover:bg-yellow-400 text-yellow-950 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    領取獎勵
                  </button>
                ) : (
                  <span className="text-[10px] md:text-[11px] text-gray-600 font-medium px-2.5 py-1">未解鎖</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
