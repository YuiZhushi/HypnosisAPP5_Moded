import React from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

export const StatusBar: React.FC<{ timeText?: string }> = ({ timeText }) => {
  return (
    <div className="w-full h-8 px-5 flex justify-between items-center text-white/90 text-xs font-medium z-50 select-none mix-blend-difference">
      <div className="w-20">
        {timeText || new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}
      </div>
      <div className="flex items-center gap-1.5">
        <Signal size={12} />
        <Wifi size={12} />
        <Battery size={14} />
      </div>
    </div>
  );
};
