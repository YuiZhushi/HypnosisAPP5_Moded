import React, { useState, useEffect } from 'react';
import { AchievementOrQuestDef, MockUserData } from '../../../models';
import { MockApi } from '../../../shared/api/mockApi';
import { AchievementTab } from './AchievementTab';
import { QuestTab } from './QuestTab';
import { ChevronLeft, Trophy, Target, Coins, Star, Zap, PenTool } from 'lucide-react';
import { QuestCraftTab } from './QuestCraftTab';

export const AchievementApp: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'achievements' | 'quests' | 'craft'>('achievements');
  const [userData, setUserData] = useState<MockUserData | null>(null);
  const [achievements, setAchievements] = useState<Record<string, AchievementOrQuestDef>>({});
  const [quests, setQuests] = useState<Record<string, AchievementOrQuestDef>>({});
  const [totalAchievementsCount, setTotalAchievementsCount] = useState<number>(0);
  const [charNames, setCharNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [user, achs, qsts, chars, totalAchs] = await Promise.all([
        MockApi.getUserInfo(),
        MockApi.getAllAchievements(),
        MockApi.getAllQuests(),
        MockApi.getCharData(),
        MockApi.getTotalAchievementsCount(),
      ]);
      setUserData(user);
      setAchievements(achs);
      setQuests(qsts);
      setCharNames(Object.keys(chars));
      setTotalAchievementsCount(totalAchs);
    } catch (error) {
      console.error('Failed to load achievement data:', error);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 每次切換分頁時，自動檢查條件
  useEffect(() => {
    if (!userData) return;

    const checkConditions = async () => {
      let hasUpdates = false;

      if (activeTab === 'achievements') {
        // 檢查所有未解鎖的成就
        const checks = Object.keys(achievements).map(async id => {
          if (!userData.ownedAchievements[id]) {
            const isMet = await MockApi.checkCondition(id, 'achievement');
            if (isMet) {
              await MockApi.unlockAchievement(id);
              return true;
            }
          }
          return false;
        });
        const results = await Promise.all(checks);
        if (results.some(r => r)) hasUpdates = true;
      } else if (activeTab === 'quests') {
        // 檢查所有已接取 (accepted) 的任務
        const checks = Object.entries(userData.ownedQuests).map(async ([id, state]) => {
          if (state.status === 'accepted') {
            const isMet = await MockApi.checkCondition(id, 'quest');
            if (isMet) {
              await MockApi.completeQuest(id);
              return true;
            }
          }
          return false;
        });
        const results = await Promise.all(checks);
        if (results.some(r => r)) hasUpdates = true;
      }

      if (hasUpdates) {
        loadData(false);
      }
    };

    checkConditions();
  }, [activeTab, userData?.ownedAchievements, userData?.ownedQuests]);

  const handleClaimAchievement = async (id: string) => {
    const success = await MockApi.claimAchievement(id);
    if (success) {
      loadData(false); // 重新載入資料以更新 UI
    }
  };

  const handleAcceptQuest = async (id: string) => {
    const success = await MockApi.acceptQuest(id);
    if (success) {
      loadData(false);
    }
  };

  const handleCancelQuest = async (id: string) => {
    const success = await MockApi.cancelQuest(id);
    if (success) {
      loadData(false);
    }
  };

  const handleClaimQuest = async (id: string) => {
    const success = await MockApi.claimQuest(id);
    if (success) {
      loadData(false);
    }
  };

  const handleDeleteQuest = async (id: string) => {
    await MockApi.deleteQuest(id);
    loadData(false);
  };

  if (loading || !userData) {
    return (
      <div className="flex h-full w-full flex-col bg-gray-950 text-white items-center justify-center">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-purple-500/30 border-t-purple-500 animate-spin" />
        </div>
        <div className="text-sm text-gray-400 mt-4">載入中...</div>
      </div>
    );
  }

  const formatMoney = (val: number) => {
    if (val >= 100000) return `¥${(val / 10000).toFixed(2)}萬`;
    return `¥${val.toLocaleString()}`;
  };

  return (
    <div className="flex h-full w-full flex-col bg-[#0d0a1a] text-white font-sans overflow-hidden">
      {/* ============================================ */}
      {/* App Title Bar (標題欄) */}
      {/* ============================================ */}
      <div className="relative flex items-center justify-between px-3 md:px-4 py-2 md:py-3 bg-[#0d0a1a] shrink-0 w-full border-b border-purple-900/30">
        {/* 返回按鈕 */}
        <button
          onClick={onBack}
          className="flex items-center gap-0.5 text-gray-300 hover:text-white transition-colors group shrink-0"
          aria-label="返回OS"
        >
          <ChevronLeft className="w-[16px] h-[16px] md:w-[18px] md:h-[18px] group-hover:-translate-x-0.5 transition-transform" />
          <span className="text-[11px] md:text-[13px]">返回 OS</span>
        </button>

        {/* APP 標題 */}
        <span className="absolute left-1/2 -translate-x-1/2 font-bold text-[14px] md:text-[16px] tracking-widest text-white">
          成就與任務
        </span>
      </div>

      {/* ============================================ */}
      {/* 資源狀態列 */}
      {/* ============================================ */}
      <div className="px-4 py-3 shrink-0">
        <div className="bg-[#13102a] rounded-xl border border-purple-800/30 p-2.5">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
              <div className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                <span className="text-[10px] md:text-xs text-gray-400">MC 能量</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-24 h-1.5 bg-[#1a1530] rounded-full overflow-hidden hidden sm:block">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.round((userData.mcEnergy / userData.mcEnergyMax) * 100)}%`,
                      background: 'linear-gradient(90deg, #a855f7, #c084fc)',
                    }}
                  />
                </div>
                <span className="text-[11px] md:text-sm font-mono text-white font-semibold">
                  {userData.mcEnergy}/{userData.mcEnergyMax}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span className="text-[10px] md:text-xs text-gray-400">金幣</span>
                </div>
                <span className="text-[11px] md:text-sm font-mono text-white font-semibold">
                  {formatMoney(userData.money || 0)}
                </span>
              </div>
              <div className="flex items-center justify-between bg-[#0c0a1e] rounded-lg border border-purple-900/30 px-2 py-1.5">
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="text-[10px] md:text-xs text-gray-400">催眠點</span>
                </div>
                <span className="text-[11px] md:text-sm font-mono text-white font-semibold">
                  {userData.mcPoints} PT
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* Main Content Area */}
      {/* ============================================ */}
      <div className="flex-1 overflow-y-auto hypno-scrollbar p-4 pt-0">
        {activeTab === 'achievements' && (
          <AchievementTab achievements={achievements} userData={userData} onClaim={handleClaimAchievement} />
        )}
        {activeTab === 'quests' && (
          <QuestTab
            quests={quests}
            userData={userData}
            onAccept={handleAcceptQuest}
            onCancel={handleCancelQuest}
            onClaim={handleClaimQuest}
            onDelete={handleDeleteQuest}
          />
        )}
        {activeTab === 'craft' && (
          <QuestCraftTab
            userData={userData}
            charNames={charNames}
            onCraftComplete={() => {
              loadData(false);
              setActiveTab('quests');
            }}
          />
        )}
      </div>

      {/* ============================================ */}
      {/* Bottom Tab Bar (底部頁面切換區) */}
      {/* ============================================ */}
      <div className="shrink-0 bg-[#100d1e] border-t border-purple-900/30 w-full">
        <div className="flex items-stretch justify-around px-1 pt-1.5 md:pt-2 pb-3 md:pb-5.5">
          <BottomTabButton
            icon={
              <Trophy
                className="w-[18px] h-[18px] md:w-5 md:h-5"
                strokeWidth={activeTab === 'achievements' ? 2.2 : 1.5}
              />
            }
            label={`成就 (${Object.values(userData.ownedAchievements).length}/${totalAchievementsCount})`}
            active={activeTab === 'achievements'}
            onClick={() => setActiveTab('achievements')}
          />
          <BottomTabButton
            icon={
              <Target className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={activeTab === 'quests' ? 2.2 : 1.5} />
            }
            label="任務"
            active={activeTab === 'quests'}
            onClick={() => setActiveTab('quests')}
          />
          {userData.effectiveVipTier >= 4 && (
            <BottomTabButton
              icon={
                <PenTool className="w-[18px] h-[18px] md:w-5 md:h-5" strokeWidth={activeTab === 'craft' ? 2.2 : 1.5} />
              }
              label="自訂任務"
              active={activeTab === 'craft'}
              onClick={() => setActiveTab('craft')}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 底部頁籤按鈕組件
// ==========================================
const BottomTabButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center gap-1 flex-1 transition-colors duration-200 cursor-pointer ${
      active ? 'text-purple-400' : 'text-gray-600 hover:text-gray-400'
    }`}
  >
    {icon}
    <span
      className={`text-[9px] md:text-[10px] font-medium leading-none ${active ? 'text-purple-400' : 'text-gray-600'}`}
    >
      {label}
    </span>
  </button>
);

export default AchievementApp;
