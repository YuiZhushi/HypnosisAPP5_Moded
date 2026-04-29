import React from 'react';

export const HypnosisApp: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="flex h-full w-full flex-col bg-gray-900 text-white">
      <div className="flex items-center justify-center h-full">
        <h1 className="text-2xl font-bold">催眠 APP (開發中)</h1>
        <button onClick={onBack}>返回</button>
      </div>
    </div>
  );
};

// ====== ICON ======
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
