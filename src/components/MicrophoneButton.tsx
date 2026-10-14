import React from 'react';
import { Mic, MicOff } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface MicrophoneButtonProps {
  isEnabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  lang?: Language;
}

export const MicrophoneButton: React.FC<MicrophoneButtonProps> = ({
  isEnabled,
  onToggle,
  disabled = false,
  lang = 'ka',
}) => {
  const t = translations[lang] || translations.ka;
  const label = isEnabled ? t.muteMic : t.unmuteMic;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isEnabled}
      title={label}
      className={`relative w-[44px] h-[44px] sm:w-[56px] sm:h-[56px] md:w-[64px] md:h-[64px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 active:scale-95 shrink-0 ${
        isEnabled
          ? 'bg-[#161F33] hover:bg-[#1E2A44] border border-white/[0.06] text-white'
          : 'bg-[#1B192B] hover:bg-[#25213B] border border-rose-500/30 text-rose-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isEnabled ? (
        <Mic className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] text-white stroke-[2]" />
      ) : (
        <MicOff className="w-[18px] h-[18px] sm:w-[22px] sm:h-[22px] md:w-[24px] md:h-[24px] text-rose-400 stroke-[2]" />
      )}

      {/* Status Indicator Dot */}
      <span
        aria-hidden="true"
        className={`absolute bottom-[7px] right-[8px] sm:bottom-[10px] sm:right-[12px] md:bottom-[11px] md:right-[15px] w-[5px] h-[5px] sm:w-[7px] sm:h-[7px] rounded-full transition-colors duration-200 ${
          isEnabled
            ? 'bg-[#10B981] shadow-[0_0_6px_#10B981]'
            : 'bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
        }`}
      />
    </button>
  );
};
