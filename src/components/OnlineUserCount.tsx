import React from 'react';
import { Language, translations } from '../lib/i18n';

interface OnlineUserCountProps {
  count: number;
  lang: Language;
  className?: string;
}

export const OnlineUserCount: React.FC<OnlineUserCountProps> = ({
  count,
  lang,
  className = '',
}) => {
  // Always at least 1 since current user is browsing the site
  const displayCount = Math.max(1, count);
  const tooltip = `${translations[lang].usersOnlineTooltip}: ${displayCount}`;

  return (
    <div
      title={tooltip}
      aria-label={tooltip}
      className={`inline-flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 rounded-full bg-[#0D1424]/85 hover:bg-[#141E34]/95 backdrop-blur-md border border-white/[0.12] text-xs shadow-lg select-none transition-all duration-200 cursor-default ${className}`}
    >
      {/* Live Pulsing Green Presence Indicator */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 duration-1000" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
      </span>

      {/* Real-time Numeric Count */}
      <span className="font-semibold text-white tracking-tight tabular-nums text-[12px] sm:text-[12.5px]">
        {displayCount}
      </span>

      {/* Online Label */}
      <span className="text-[11px] sm:text-[12px] font-medium text-slate-300">
        {translations[lang].onlineCount}
      </span>
    </div>
  );
};
