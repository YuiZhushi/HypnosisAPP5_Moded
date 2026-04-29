import React from 'react';
import { Eye, Settings2, Wrench, User } from 'lucide-react';
import { APP_LABELS } from '../HypnosisUILogics';

export type TabType = 'use' | 'manage' | 'equipment' | 'profile';

interface BottomTabBarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export const BottomTabBar: React.FC<BottomTabBarProps> = ({ activeTab, onTabChange }) => {
    const tabs = [
        { id: 'use' as TabType, label: APP_LABELS.TABS.USE, icon: Eye },
        { id: 'manage' as TabType, label: APP_LABELS.TABS.MANAGE, icon: Settings2 },
        { id: 'equipment' as TabType, label: APP_LABELS.TABS.EQUIPMENT, icon: Wrench },
        { id: 'profile' as TabType, label: APP_LABELS.TABS.PROFILE, icon: User },
    ];

    return (
        <div className="bg-black/90 border-t border-purple-500/30 sticky bottom-0 w-full flex justify-around items-center p-2 backdrop-blur-md z-50">
            {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl w-1/4 transition-all duration-300 ${
                            isActive
                                ? 'text-purple-300 bg-purple-900/40 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                                : 'text-gray-500 hover:text-purple-400 hover:bg-white/5'
                        }`}
                    >
                        <Icon size={24} className={`mb-1 ${isActive ? 'animate-pulse' : ''}`} />
                        <span className="text-[10px] font-medium whitespace-nowrap overflow-hidden text-ellipsis w-full text-center">
                            {tab.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};
