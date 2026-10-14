import React from 'react';
import { Play, SkipForward } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface NextButtonProps {
  onNext: () => void;
  isActiveSession?: boolean;
  isSearching?: boolean;
  isSkipping?: boolean;
  disabled?: boolean;
  lang?: Language;
}

export const NextButton: React.FC<NextButtonProps> = ({
  onNext,
  isActiveSession = false,
  isSearching = false,
  isSkipping = false,
  disabled = false,
  lang = 'ka',
}) => {
  const t = translations[lang] || translations.ka;
  const label = isActiveSession ? t.next : t.start;

  return (
    <button
      type="button"
      onClick={onNext}
      disabled={disabled}
      aria-label={isActiveSession ? t.next : t.start}
      title={isActiveSession ? t.next : t.start}
      className={`group relative w-[110px] sm:w-[148px] md:w-[170px] h-[44px] sm:h-[56px] md:h-[64px] rounded-full p-[1.5px] transition-all duration-200 cursor-pointer select-none bg-gradient-to-r from-[#2563EB] via-[#5B54F2] to-[#9333EA] shadow-[0_0_24px_rgba(79,70,229,0.38)] hover:shadow-[0_0_32px_rgba(124,58,237,0.55)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0 ${
        disabled ? 'opacity-60 cursor-not-allowed' : ''
      }`}
    >
      {/* Subtle outer ambient neon aura */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -inset-[2px] rounded-full bg-gradient-to-r from-blue-500/25 via-indigo-500/25 to-purple-500/25 blur-md opacity-80 group-hover:opacity-100 transition-opacity duration-200"
      />

      {/* Inner Pill Surface */}
      <span className="relative w-full h-full rounded-full bg-gradient-to-r from-[#0F1830] via-[#131B36] to-[#1A1738] group-hover:from-[#14203E] group-hover:via-[#182244] group-hover:to-[#221D46] flex items-center justify-center gap-1.5 sm:gap-2.5 md:gap-3 px-3 sm:px-5 md:px-6 transition-colors duration-200">
        {isActiveSession ? (
          <SkipForward
            className={`w-[15px] h-[15px] sm:w-[18px] sm:h-[18px] md:w-[20px] md:h-[20px] text-white stroke-[2] shrink-0 transition-transform duration-200 ${
              isSkipping
                ? 'translate-x-1 scale-110'
                : isSearching
                ? 'group-hover:translate-x-0.5'
                : 'group-hover:translate-x-0.5'
            }`}
          />
        ) : (
          <Play className="w-[14px] h-[14px] sm:w-[17px] sm:h-[17px] md:w-[19px] md:h-[19px] text-white fill-white stroke-[2] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
        )}
        <span className="text-[13px] sm:text-[15px] md:text-[17px] font-medium text-white tracking-[-0.01em] whitespace-nowrap shrink-0">
          {label}
        </span>
      </span>
    </button>
  );
};
