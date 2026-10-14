import React from 'react';

interface VideoPanelProps {
  children: React.ReactNode;
  className?: string;
}

export const VideoPanel: React.FC<VideoPanelProps> = ({
  children,
  className = '',
}) => {
  return (
    <div
      className={`relative w-full h-full rounded-[16px] overflow-hidden bg-[#0B1120] border border-[#1E3A5F]/45 shadow-[0_12px_36px_rgba(0,0,0,0.45)] select-none ${className}`}
    >
      {children}
    </div>
  );
};
