import React from 'react';
import { AchievementOrQuestDef, MockUserData } from '../../../models';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RewardDisplay } from './AchievementTab';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

import { Trash2 } from 'lucide-react';

interface QuestTabProps {
  quests: Record<string, AchievementOrQuestDef>;
  userData: MockUserData;
  onAccept: (id: string) => void;
  onCancel: (id: string) => void;
  onClaim: (id: string) => void;
  onDelete: (id: string) => void;
}

export const QuestTab: React.FC<QuestTabProps> = ({ quests, userData, onAccept, onCancel, onClaim, onDelete }) => {
  return (
    <div className="space-y-2.5">
      {Object.entries(quests).map(([id, quest]) => {
        const state = userData.ownedQuests[id] || { status: 'available' };

        return (
          <div
            key={id}
            className={cn(
              'p-2.5 md:p-3 rounded-xl border transition-all',
              state.status === 'claimed'
                ? 'bg-[#13102a]/40 border-purple-900/20 opacity-50 grayscale-[30%]'
                : state.status === 'completed'
                  ? 'bg-[#13102a] border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.15)]'
                  : state.status === 'accepted'
                    ? 'bg-[#13102a] border-purple-500/50 shadow-[0_0_8px_rgba(168,85,247,0.1)]'
                    : 'bg-[#0c0a1e] border-purple-900/30',
            )}
          >
            <div className="flex justify-between items-start mb-1.5">
              <h3 className="font-bold text-[13px] md:text-sm text-gray-200">{quest.name}</h3>
              <RewardDisplay reward={quest.reward as Record<string, number>} />
            </div>
            <p className="text-[11px] md:text-xs text-gray-400 mb-2 leading-snug">{quest.description}</p>

            <div className="flex justify-end gap-2 mt-2">
              <div className="flex items-center gap-2 shrink-0">
                {quest.isCustom && state.status !== 'claimed' && state.status !== 'completed' && (
                  <button
                    onClick={() => onDelete(id)}
                    className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-md transition-colors"
                    title="刪除任務"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {state.status === 'claimed' ? (
                  <span className="text-[10px] md:text-[11px] text-gray-500 font-medium px-2.5 py-1">已領取</span>
                ) : state.status === 'completed' ? (
                  <button
                    onClick={() => onClaim(id)}
                    className="text-[10px] md:text-[11px] font-medium bg-emerald-500 hover:bg-emerald-400 text-emerald-950 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    領取獎勵
                  </button>
                ) : state.status === 'accepted' ? (
                  <>
                    <button
                      onClick={() => onCancel(id)}
                      className="text-[10px] md:text-[11px] font-medium bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                    >
                      放棄
                    </button>
                    <span className="text-[10px] md:text-[11px] text-purple-400 font-medium px-2.5 py-1">進行中</span>
                  </>
                ) : (
                  <button
                    onClick={() => onAccept(id)}
                    className="text-[10px] md:text-[11px] font-medium bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    接取任務
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
