import React from 'react';
import { Video, VideoOff } from 'lucide-react';
import { Language, translations } from '../lib/i18n';

interface CameraButtonProps {
  isEnabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  lang?: Language;
}

export const CameraButton: React.FC<CameraButtonProps> = ({
  isEnabled,
  onToggle,
  disabled = false,
  lang = 'ka',
}) => {
  const t = translations[lang] || translations.ka;
  const label = isEnabled ? t.turnCameraOff : t.turnCameraOn;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={label}
      aria-pressed={isEnabled}
      title={label}
      className={`relative w-[56px] h-[56px] sm:w-[64px] sm:h-[64px] rounded-full flex items-center justify-center transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 active:scale-95 ${
        isEnabled
          ? 'bg-[#161F33] hover:bg-[#1E2A44] border border-white/[0.06] text-white'
          : 'bg-[#1B192B] hover:bg-[#25213B] border border-rose-500/30 text-rose-400'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {isEnabled ? (
        <Video className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px] text-white fill-white stroke-[1.8]" />
      ) : (
        <VideoOff className="w-[22px] h-[22px] sm:w-[24px] sm:h-[24px] text-rose-400 stroke-[2]" />
      )}

      {/* Status Indicator Dot */}
      <span
        aria-hidden="true"
        className={`absolute bottom-[10px] right-[13px] sm:bottom-[11px] sm:right-[15px] w-[7px] h-[7px] rounded-full transition-colors duration-200 ${
          isEnabled
            ? 'bg-[#10B981] shadow-[0_0_6px_#10B981]'
            : 'bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.6)]'
        }`}
      />
    </button>
  );
};
