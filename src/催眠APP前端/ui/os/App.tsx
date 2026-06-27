import { useEffect, useRef, useState } from 'react';
import { StatusBar } from '../../shared/components/StatusBar';
import { HypnosisApp } from '../apps/hypnosis/HypnosisApp';
import { AchievementApp } from '../apps/achievement/AchievementApp';
import { BodyStatsApp } from '../apps/body-stats/BodyStatsApp';
import CalendarApp from '../apps/calendar/CalendarApp';
import { HelpApp } from '../apps/help/HelpApp';
import { WipApp } from '../../shared/components/PageLayout';
import { SettingsApp } from '../apps/settings/SettingsApp';
import { CharacterBackgroundApp } from '../apps/character-background/CharacterBackgroundApp';
import { MapApp } from '../apps/map/MapApp';
import { waitForMvuReady } from '../../shared/api/mvuBridge';
import { MockUserData, AppMode } from '../../models';
import { DebugPanel } from '../../shared/components/DebugPanel';

import { logger } from '../../../催眠APP共用/debug/loggerService';
import { MockApi } from '../../shared/api/mockApi';
import { HomeScreen } from './HomeScreen';

const FALLBACK_USER_DATA: MockUserData = {
  userName: 'MC',
  money: 6000,
  mcEnergy: 25,
  mcEnergyMax: 25,
  mcPoints: 25,
  totalConsumedMc: 0,
  vipTier: 0,
  vipEndVirtualMinutes: 0,
  vipAutoRenew: false,
  suspicion: 0,
  ownedHypnoModules: {},
  ownedHypnosis: {},
  ownedCombos: {},
  ownedAchievements: {},
  ownedQuests: {},
  inventory: {},
  effectiveVipTier: 0,
};

const App = () => {
  // Global State
  const [currentApp, setCurrentApp] = useState<AppMode>(AppMode.HOME);
  const [userData, setUserData] = useState<MockUserData | null>(null);
  const [bodyStatsUnlocked, setBodyStatsUnlocked] = useState(false);
  const [systemTimeText, setSystemTimeText] = useState<string | undefined>(undefined);
  const [systemDateText, setSystemDateText] = useState<string | undefined>(undefined);
  const [localNow, setLocalNow] = useState(() => new Date());
  const userRefreshInFlightRef = useRef(false);

  // Initialize Data
  useEffect(() => {
    let stopped = false;
    let retryTimer: number | null = null;
    let attempt = 0;

    const load = async () => {
      attempt += 1;
      try {
        const data = await MockApi.getUserInfo();
        if (stopped) return;
        setUserData(data);
      } catch (err) {
        logger.warn('初始化用户数据失败，将重试', err);
        if (stopped) return;
        if (attempt >= 10) {
          setUserData(FALLBACK_USER_DATA);
          return;
        }
        retryTimer = window.setTimeout(() => void load(), Math.min(1000, 150 * attempt));
      }
    };

    void load();

    return () => {
      stopped = true;
      if (retryTimer !== null) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    if (currentApp !== AppMode.HOME) return;
    if (systemTimeText) return;
    const timer = setInterval(() => setLocalNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, [currentApp, systemTimeText]);

  const refreshUnlocks = async () => {
    try {
      const user = await MockApi.getUserInfo();
      setBodyStatsUnlocked(user.effectiveVipTier >= 1);
    } catch (err) {
      logger.warn('读取解锁状态失败', err);
      setBodyStatsUnlocked(false);
    }
  };

  useEffect(() => {
    void refreshUnlocks();
  }, []);

  // ==========================================
  // Debug 面板事件監聽：mock 資料更新時重新載入
  // ==========================================
  const [debugKey, setDebugKey] = useState(0);
  useEffect(() => {
    const handler = () => {
      // 遞增 key 強制所有子元件重新掛載，讀取最新的 mock 資料
      setDebugKey(k => k + 1);
      void refreshUserData();
      void refreshUnlocks();
      logger.info('Debug 面板觸發 mock 資料刷新');
    };
    window.addEventListener('__debug_mock_updated', handler);
    return () => window.removeEventListener('__debug_mock_updated', handler);
  }, []);

  const refreshUserData = async () => {
    if (userRefreshInFlightRef.current) return;
    userRefreshInFlightRef.current = true;
    try {
      const data = await MockApi.getUserInfo();
      setUserData(data);
    } catch (err) {
      logger.warn('刷新用户数据失败', err);
    } finally {
      userRefreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (currentApp !== AppMode.HOME) return;

    let stopped = false;
    let scheduled: number | null = null;

    const refreshHomeHeader = async () => {
      try {
        const [system, user] = await Promise.all([MockApi.getSystemData(), MockApi.getUserInfo()]);
        if (stopped) return;
        
        const dateObj = new Date(system.time);
        const timeText = dateObj.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false });
        const dateText = dateObj.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
        
        setSystemTimeText(timeText);
        setSystemDateText(dateText);
        setBodyStatsUnlocked(user.effectiveVipTier >= 1);
      } catch (err) {
        logger.warn('刷新主页信息失败', err);
      }
    };

    const requestRefresh = () => {
      if (scheduled !== null) return;
      scheduled = window.setTimeout(() => {
        scheduled = null;
        void refreshHomeHeader();
      }, 100);
    };

    requestRefresh();

    void (async () => {
      try {
        await waitForMvuReady({ timeoutMs: 5000, pollMs: 150 });
        if (stopped) return;
        void refreshUserData();
      } catch {
        // ignore: not in tavern env
      }
    })();

    return () => {
      stopped = true;
      if (scheduled !== null) window.clearTimeout(scheduled);
    };
  }, [currentApp]);

  // --- Router ---
  const renderCurrentApp = () => {
    if (!userData)
      return <div className="h-full bg-black flex items-center justify-center text-white">Loading OS...</div>;

    switch (currentApp) {
      case AppMode.HYPNOSIS:
        return <HypnosisApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.BODY_STATS:
        if (!bodyStatsUnlocked)
          return (
            <HomeScreen
              onLaunchApp={setCurrentApp}
              bodyStatsUnlocked={bodyStatsUnlocked}
              systemTimeText={systemTimeText}
              systemDateText={systemDateText}
              localNow={localNow}
            />
          );
        return <BodyStatsApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.CALENDAR:
        return <CalendarApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.HELP:
        return <HelpApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.ACHIEVEMENTS:
        return (
          <AchievementApp onBack={() => setCurrentApp(AppMode.HOME)} />
        );
      case AppMode.SETTINGS:
        return <SettingsApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.CHARACTER_EDITOR:
        return <CharacterBackgroundApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.MAP:
        return <MapApp onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.WIP:
        return <WipApp name="Unknown App" onBack={() => setCurrentApp(AppMode.HOME)} />;
      case AppMode.HOME:
      default:
        return (
          <HomeScreen
            onLaunchApp={setCurrentApp}
            bodyStatsUnlocked={bodyStatsUnlocked}
            systemTimeText={systemTimeText}
            systemDateText={systemDateText}
            localNow={localNow}
          />
        );
    }
  };

  return (
    <div className="w-full flex items-center justify-center p-2 sm:p-4">
      {/* Phone Bezel */}
      <div className="@container relative w-full max-w-[420px] aspect-9/19.5 bg-black rounded-[clamp(2rem,11.4cqw,3rem)] border-[clamp(4px,1.9cqw,8px)] border-gray-800 overflow-hidden shadow-2xl ring-2 ring-black/20">
        {/* Dynamic Notch/Status Bar Area - Only visible on Home */}
        {currentApp === AppMode.HOME && (
          <div className="absolute top-0 w-full z-50 pointer-events-none">
            <StatusBar timeText={systemTimeText} />
          </div>
        )}

        {/* Screen Content - key 用於 debug 面板強制重新掛載 */}
        <div key={debugKey} className="w-full h-full bg-black overflow-hidden relative">{renderCurrentApp()}</div>

        {/* Home Indicator (iOS style) - Always visible except in immersive hypnosis */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-50 pointer-events-none mb-1"></div>
      </div>

      {/* ==========================================
      // 調試控制台 (Debug Panel)
      // ========================================== */}
      <DebugPanel />
    </div>
  );
};

export default App;
