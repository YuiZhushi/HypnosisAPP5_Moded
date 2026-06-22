import React, { useState } from 'react';
import { TopBar } from './components/TopBar';
import { AppHeader } from './components/AppHeader';
import { BottomTabBar, TabType } from './components/BottomTabBar';
import { HypnosisUseTab } from './tabs/HypnosisUseTab';
import { HypnosisManageTab } from './tabs/HypnosisManageTab';
import { EquipmentManageTab } from './tabs/EquipmentManageTab';
import { UserProfileTab } from './tabs/UserProfileTab';
import { useUserProfileLogic } from './HypnosisUILogics';

// --- SVG Logo Component ---
export const HypnoLogoSVG = ({
  className,
  size = 24,
  ...props
}: {
  className?: string;
  size?: number | string;
  [key: string]: any;
}) => (
  <svg viewBox="0 0 200 200" className={className} width={size} height={size} {...props}>
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
    <g fill="currentColor" filter="url(#glow)">
      {/* Top Left Spike */}
      <path d="M 45 60 L 40 20 L 75 65" />
      {/* Top Middle Spike */}
      <path d="M 85 55 L 100 5 L 115 55" />
      {/* Top Right Spike */}
      <path d="M 155 60 L 160 20 L 125 65" />

      {/* Main Body (Oval-ish) */}
      <path d="M 10 100 C 10 40 190 40 190 100 C 190 160 10 160 10 100 Z" />

      {/* Bottom Spike */}
      <path d="M 70 145 L 100 195 L 130 145" />
    </g>

    {/* Inner Eye (Cutout via black fill) */}
    <ellipse cx="100" cy="100" rx="55" ry="28" fill="#0f0518" />

    {/* Pupil */}
    <circle cx="100" cy="100" r="18" fill="currentColor" filter="url(#glow)" />
  </svg>
);

interface HypnosisAppProps {
  userData?: any;
  onUpdateUser?: (data: any) => void;
  onExit?: () => void;
}

export const HypnosisApp: React.FC<HypnosisAppProps> = ({ onExit }) => {
  const [activeTab, setActiveTab] = useState<TabType>('use');
  const { userData } = useUserProfileLogic();

  const renderActiveTab = () => {
    switch (activeTab) {
      case 'use':
        return <HypnosisUseTab />;
      case 'manage':
        return <HypnosisManageTab />;
      case 'equipment':
        return <EquipmentManageTab />;
      case 'profile':
        return <UserProfileTab />;
      default:
        return <HypnosisUseTab />;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-black text-white relative font-sans overflow-hidden">
      {/* Background Effect */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900 via-black to-black animate-pulse"></div>
      </div>

      {/* App Layout */}
      <div className="relative z-10 flex flex-col h-full w-full">
        <TopBar />
        <AppHeader userData={userData} onExit={onExit} />

        {/* Tab Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col bg-black/50">{renderActiveTab()}</div>

        <BottomTabBar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </div>
  );
};
