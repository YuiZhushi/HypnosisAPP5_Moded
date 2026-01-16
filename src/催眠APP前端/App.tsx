import React, { useEffect, useRef, useState } from 'react';
import { StatusBar } from './components/OS/StatusBar';
import { HypnosisApp, HypnoLogoSVG } from './components/HypnosisApp';
import { AchievementApp } from './components/AchievementApp'; // Import new component
import { BodyStatsApp, CalendarApp, HelpApp, WipApp } from './components/CommonApps';
import { DataService } from './services/dataService';
import { waitForMvuReady } from './services/mvuBridge';
import { UserResources, AppMode } from './types';
import { Activity, Calendar, HelpCircle, Trophy, Globe } from 'lucide-react';

const FALLBACK_USER_DATA: UserResources = {
  mcEnergy: 25,
  mcEnergyMax: 25,
  mcPoints: 25,
  totalConsumedMc: 0,
  money: 6000,
  suspicion: 0,
};

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    promise.then(
      value => {
        window.clearTimeout(timer);
        resolve(value);
      },
      err => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

const App = () => {
  // Global State
  const [currentApp, setCurrentApp] = useState<AppMode>(AppMode.HOME);
  const [userData, setUserData] = useState<UserResources | null>(null);
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
        const data = await withTimeout(DataService.getUserData(), 4000, 'DataService.getUserData');
        if (stopped) return;
        setUserData(data);
      } catch (err) {
        console.warn('[HypnoOS] 初始化用户数据失败，将重试', err);
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
      const unlocks = await DataService.getUnlocks();
      setBodyStatsUnlocked(unlocks.bodyStatsUnlocked);
    } catch (err) {
      console.warn('[HypnoOS] 读取解锁状态失败', err);
      setBodyStatsUnlocked(false);
    }
  };

  useEffect(() => {
    void refreshUnlocks();
  }, []);

  const refreshUserData = async () => {
    if (userRefreshInFlightRef.current) return;
    userRefreshInFlightRef.current = true;
    try {
      const data = await withTimeout(DataService.getUserData(), 4000, 'DataService.getUserData');
      setUserData(data);
    } catch (err) {
      console.warn('[HypnoOS] 刷新用户数据失败', err);
    } finally {
      userRefreshInFlightRef.current = false;
    }
  };

  useEffect(() => {
    if (currentApp !== AppMode.HOME) return;

    let stopped = false;
    let stops: Array<{ stop: () => void }> = [];
    let scheduled: number | null = null;

    const refreshHomeHeader = async () => {
      try {
        const [clock, unlocks] = await Promise.all([DataService.getSystemClock(), DataService.getUnlocks()]);
        if (stopped) return;
        setSystemTimeText(clock.timeText);
        setSystemDateText(clock.dateText);
        setBodyStatsUnlocked(unlocks.bodyStatsUnlocked);
      } catch (err) {
        console.warn('[HypnoOS] 刷新主页信息失败', err);
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
        const ready = await waitForMvuReady({ timeoutMs: 5000, pollMs: 150 });
        if (!ready) return;
        if (stopped) return;
        stops = [
          eventOn(Mvu.events.VARIABLE_INITIALIZED, () => {
            requestRefresh();
            void refreshUserData();
          }),
          eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, requestRefresh),
        ];
      } catch {
        // ignore: not in tavern env
      }
    })();

    return () => {
      stopped = true;
      if (scheduled !== null) window.clearTimeout(scheduled);
      stops.forEach(s => s.stop());
    };
  }, [currentApp]);

  const updateUser = (data: UserResources) => {
    setUserData(data);
    void DataService.updateResources(data);
  };

  // --- Router ---
  const renderCurrentApp = () => {
    if (!userData)
      return <div className="h-full bg-black flex items-center justify-center text-white">Loading OS...</div>;

    switch (currentApp) {
      case AppMode.HYPNOSIS:
        return <HypnosisApp userData={userData} onUpdateUser={updateUser} onExit={() => setCurrentApp(AppMode.HOME)} />;
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
      case AppMode.ACHIEVEMENTS: // New Route
        return (
          <AchievementApp userData={userData} onUpdateUser={updateUser} onBack={() => setCurrentApp(AppMode.HOME)} />
        );
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
    <div className="w-full flex items-center justify-center p-2">
      {/* Phone Bezel */}
      <div className="relative w-full max-w-[420px] aspect-[9/19.5] bg-black rounded-[3rem] border-[8px] border-gray-800 overflow-hidden shadow-2xl ring-2 ring-black/20">
        {/* Dynamic Notch/Status Bar Area - Only visible on Home */}
        {currentApp === AppMode.HOME && (
          <div className="absolute top-0 w-full z-50 pointer-events-none">
            <StatusBar timeText={systemTimeText} />
          </div>
        )}

        {/* Screen Content */}
        <div className="w-full h-full bg-black overflow-hidden relative">{renderCurrentApp()}</div>

        {/* Home Indicator (iOS style) - Always visible except in immersive hypnosis */}
        {/* You might want to hide this in apps too if full immersion is desired, but standard is usually visible */}
        <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full z-50 pointer-events-none mb-2"></div>
      </div>
    </div>
  );
};

// --- Home Screen Component ---
const HomeScreen = ({
  onLaunchApp,
  bodyStatsUnlocked,
  systemTimeText,
  systemDateText,
  localNow,
}: {
  onLaunchApp: (app: AppMode) => void;
  bodyStatsUnlocked: boolean;
  systemTimeText?: string;
  systemDateText?: string;
  localNow: Date;
}) => {
  const displayTime = systemTimeText || `${localNow.getHours()}:${localNow.getMinutes().toString().padStart(2, '0')}`;
  const displayDate =
    systemDateText || localNow.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });

  const [notice, setNotice] = useState<string | null>(null);

  const appendMcAnonTagToThisFloor = async () => {
    const marker = '<匿名版></匿名版>';
    try {
      const messageId = (() => {
        try {
          return getCurrentMessageId();
        } catch {
          const latest = getChatMessages(-1)[0];
          return latest?.message_id ?? 0;
        }
      })();

      const chatMessage = getChatMessages(messageId)[0];
      if (!chatMessage) throw new Error(`missing chat message: ${messageId}`);

      if (chatMessage.message.includes(marker)) {
        setNotice('已存在');
        window.setTimeout(() => setNotice(null), 1500);
        return;
      }

      const base = chatMessage.message.replace(/\s+$/, '');
      const nextMessage = `${base}${base ? '\n' : ''}${marker}`;

      await setChatMessages([{ message_id: messageId, message: nextMessage }], { refresh: 'affected' });
      setNotice('已插入');
      window.setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      console.warn('[HypnoOS] 插入匿名版标签失败', err);
      setNotice('插入失败');
      window.setTimeout(() => setNotice(null), 1500);
    }
  };

  type DesktopApp = {
    id: string;
    name: string;
    icon: any;
    color: string;
    mode: AppMode;
    disabled: boolean;
    action?: () => void | Promise<void>;
  };

  const apps: DesktopApp[] = [
    {
      id: 'hypno',
      name: '催眠APP',
      icon: HypnoLogoSVG,
      color: 'bg-gradient-to-br from-purple-600 to-pink-600',
      mode: AppMode.HYPNOSIS,
      disabled: false,
    },
    {
      id: 'calendar',
      name: '日历',
      icon: Calendar,
      color: 'bg-white text-black',
      mode: AppMode.CALENDAR,
      disabled: false,
    },
    { id: 'help', name: '帮助', icon: HelpCircle, color: 'bg-gray-500', mode: AppMode.HELP, disabled: false },
    // Replaced Ghost with Achievements
    {
      id: 'achievements',
      name: '成就和任务',
      icon: Trophy,
      color: 'bg-gradient-to-br from-indigo-500 to-purple-600',
      mode: AppMode.ACHIEVEMENTS,
      disabled: false,
    },
    {
      id: 'mc-anon',
      name: 'MC匿名版',
      icon: Globe,
      color: 'bg-blue-900',
      mode: AppMode.HOME,
      disabled: false,
      action: appendMcAnonTagToThisFloor,
    },
  ];
  const visibleApps: DesktopApp[] = bodyStatsUnlocked
    ? [
        apps[0],
        {
          id: 'stats',
          name: '身体检测',
          icon: Activity,
          color: 'bg-blue-500',
          mode: AppMode.BODY_STATS,
          disabled: false,
        },
        ...apps.slice(1),
      ]
    : apps;

  return (
    <div className="relative h-full w-full bg-gradient-to-b from-slate-900 via-purple-950 to-black flex flex-col pt-12 pb-24 animate-fade-in">
      {/* Date Widget */}
      <div className="px-6 mb-8 text-white/90 drop-shadow-md">
        <div className="text-6xl font-thin tracking-tighter">{displayTime}</div>
        <div className="text-lg font-medium">{displayDate}</div>
      </div>

      {/* App Grid */}
      <div className="flex-1 px-5 grid grid-cols-4 gap-y-6 gap-x-4 content-start">
        {visibleApps.map(app => (
          <div
            key={app.id}
            className={`flex flex-col items-center gap-1.5 group ${app.disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
            onClick={() => {
              if (app.disabled) return;
              if (typeof app.action === 'function') {
                void app.action();
                return;
              }
              onLaunchApp(app.mode);
            }}
          >
            <div
              className={`
              w-14 h-14 rounded-2xl ${app.color} flex items-center justify-center shadow-lg 
              ${!app.disabled && 'group-active:scale-90 transition-transform duration-200'}
              relative
            `}
            >
              <app.icon size={28} className={app.id === 'calendar' ? 'text-black' : 'text-white'} />
              {app.disabled && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                  <span className="text-[8px] font-bold text-white bg-red-600 px-1 rounded">WIP</span>
                </div>
              )}
            </div>
            <span className="text-[10px] text-white font-medium tracking-wide drop-shadow-md">{app.name}</span>
          </div>
        ))}
      </div>

      {notice && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-8 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs border border-white/10 shadow-lg backdrop-blur-sm">
          {notice}
        </div>
      )}

      {/* Dock removed per request */}
    </div>
  );
};

export default App;
