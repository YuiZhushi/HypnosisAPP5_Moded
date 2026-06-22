import React, { useEffect, useState } from 'react';
import {
  Battery,
  Bell,
  Settings,
  Monitor,
  Radio,
  Wifi,
  Cpu,
  Code,
  EyeOff,
  Ear,
  Fingerprint,
  Droplets,
  Wind,
} from 'lucide-react';
import { useSystemTime, useEquipmentLogic } from '../HypnosisUILogics';

export const TopBar: React.FC = () => {
  const { timeString, batteryPercentage } = useSystemTime();
  const { installedEquipment, disabledEquipmentIds } = useEquipmentLogic();

  // 通知功能佔位符 (留出兼容性)
  const hasNotifications = true; // 假設有通知

  // 系統功能：顯示啟用的設備 (至多 4 個)
  const enabledEquipment = installedEquipment.filter(eq => !disabledEquipmentIds.has(eq.id)).slice(0, 4);

  const getEquipmentIcon = (name: string) => {
    if (name.includes('屏幕')) return Monitor;
    if (name.includes('文字編譯')) return Code;
    if (name.includes('圖像混淆')) return EyeOff;
    if (name.includes('音頻調製')) return Ear;
    if (name.includes('音頻混淆')) return Ear;
    if (name.includes('語意混淆')) return Code;
    if (name.includes('觸覺')) return Fingerprint;
    if (name.includes('頻率')) return Radio;
    if (name.includes('食物')) return Droplets;
    if (name.includes('氣體')) return Wind;
    if (name.includes('電磁波')) return Wifi;
    return Cpu;
  };

  return (
    <div className="flex justify-between items-center px-4 py-1 bg-black/80 text-white text-xs z-50 sticky top-0 w-full backdrop-blur-md">
      {/* 左側：時間與通知 */}
      <div className="flex items-center space-x-2">
        <span className="font-medium tracking-wider">{timeString}</span>
        <div className="relative flex items-center cursor-pointer">
          <Bell size={12} className="opacity-80" />
          {hasNotifications && (
            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
          )}
        </div>
      </div>

      {/* 右側：系統功能 (設備) 與 電池 */}
      <div className="flex items-center space-x-3">
        {/* 啟用的設備圖標 (間距更密集 space-x-1) */}
        <div className="flex items-center space-x-1 border-r border-white/20 pr-3">
          {enabledEquipment.map(eq => {
            const Icon = getEquipmentIcon(eq.name);
            return <Icon key={eq.id} size={12} className="opacity-70" title={eq.name} />;
          })}
          {enabledEquipment.length === 0 && <Settings size={12} className="opacity-40" title="無啟用設備" />}
        </div>

        <div className="flex items-center space-x-1">
          <span className="opacity-80">{batteryPercentage}%</span>
          <Battery size={14} className="opacity-80" />
        </div>
      </div>
    </div>
  );
};
