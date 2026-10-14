import React from 'react';

export const VimoIcon: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 22,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`shrink-0 ${className}`}
    aria-hidden="true"
  >
    {/* Outer Silver/White Disc */}
    <circle cx="12" cy="12" r="11" fill="#E2E8F0" />
    {/* Stylized Dual-Swirl Aperture Motif matching the reference */}
    <path
      d="M12 3.5C7.3 3.5 3.5 7.3 3.5 12C3.5 14.1 4.3 16 5.6 17.5C6.2 14.2 8.6 11.5 12 11.2C9.5 9.8 8.8 6.5 10.3 4C10.8 3.6 11.4 3.5 12 3.5ZM12 20.5C16.7 20.5 20.5 16.7 20.5 12C20.5 9.9 19.7 8 18.4 6.5C17.8 9.8 15.4 12.5 12 12.8C14.5 14.2 15.2 17.5 13.7 20C13.2 20.4 12.6 20.5 12 20.5Z"
      fill="#070B16"
    />
  </svg>
);

export const VimoLogo: React.FC<{ className?: string; size?: number }> = ({
  className = '',
  size = 22,
}) => {
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      <VimoIcon size={size} />
      <span className="text-[17px] sm:text-[18px] font-bold tracking-tight text-white/95 leading-none">
        Vimo
      </span>
    </div>
  );
};
