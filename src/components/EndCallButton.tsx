import React from 'react';
import { Language, translations } from '../lib/i18n';

interface EndCallButtonProps {
  onEndCall: () => void;
  disabled?: boolean;
  lang?: Language;
}

export const EndCallButton: React.FC<EndCallButtonProps> = ({
  onEndCall,
  disabled = false,
  lang = 'ka',
}) => {
  const t = translations[lang] || translations.ka;

  return (
    <button
      type="button"
      onClick={onEndCall}
      disabled={disabled}
      aria-label={t.endCall}
      title={t.endCall}
      className={`relative w-[44px] h-[44px] sm:w-[56px] sm:h-[56px] md:w-[64px] md:h-[64px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none bg-gradient-to-b from-[#FF4766] to-[#F2294E] hover:from-[#FF5C77] hover:to-[#FF385C] active:scale-95 shadow-[0_4px_20px_rgba(242,41,78,0.42)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shrink-0 ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {/* Centered White Telephone Hang-Up Icon */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] md:w-[26px] md:h-[26px] text-white"
        aria-hidden="true"
      >
        <path d="M12 9c-4.97 0-9.36 1.73-12 4.46-.39.4-.39 1.04 0 1.44l2.48 2.48c.37.37.96.4 1.37.07 1.15-.92 2.48-1.59 3.92-1.94.48-.12.82-.55.82-1.05v-2.6c1.08-.31 2.23-.48 3.41-.48s2.33.17 3.41.48v2.6c0 .5.34.93.82 1.05 1.44.35 2.77 1.02 3.92 1.94.41.33 1 .3 1.37-.07l2.48-2.48c.39-.4.39-1.04 0-1.44C21.36 10.73 16.97 9 12 9z" />
      </svg>
    </button>
  );
};
