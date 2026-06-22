import React from 'react';
import { ArrowLeft, Construction } from 'lucide-react';

export const PageLayout = ({ title, children, onBack, color = 'bg-gray-100' }: any) => (
  <div className={`h-full flex flex-col ${color} overflow-hidden animate-fade-in`}>
    <div className="px-4 py-4 flex items-center gap-3 bg-white/50 backdrop-blur-md shadow-sm z-10">
      <button onClick={onBack} className="p-1 rounded-full hover:bg-black/5">
        <ArrowLeft className="text-gray-800" />
      </button>
      <h1 className="text-lg font-bold text-gray-800">{title}</h1>
    </div>
    <div className="flex-1 overflow-auto p-4">{children}</div>
  </div>
);

export const WipApp = ({ onBack, name }: { onBack: () => void; name: string }) => (
  <PageLayout title={name} onBack={onBack}>
    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
      <Construction size={48} className="mb-4" />
      <p>正在施工中...</p>
      <p className="text-xs mt-2">Coming Soon</p>
    </div>
  </PageLayout>
);
