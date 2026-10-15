import React from 'react';
import { MicrophoneButton } from './MicrophoneButton';
import { Language, translations } from '../lib/i18n';
import { Play, SkipForward, Square, Mic, MicOff } from 'lucide-react';

interface CallControlsProps {
  isMicEnabled: boolean;
  isActiveSession: boolean;
  isSearching: boolean;
  isSkipping: boolean;
  lang?: Language;
  onToggleMic: () => void;
  onEndCall: () => void;
  onNext: () => void;
  onSendMessage?: (text: string) => void;
}

export const CallControls: React.FC<CallControlsProps> = ({
  isMicEnabled,
  isActiveSession,
  isSearching: _isSearching,
  isSkipping,
  lang = 'ka',
  onToggleMic,
  onEndCall,
  onNext,
  onSendMessage: _onSendMessage,
}) => {
  const t = translations[lang] || translations.ka;

  return (
    <div
      role="toolbar"
      aria-label="Video chat controls"
      className="w-full h-full flex flex-col justify-center gap-1.5 sm:gap-2 min-w-0 md:flex-row md:items-center md:justify-center md:gap-3 md:h-auto select-none"
    >
      {/* Desktop Microphone Button (Shown on desktop md: and above) */}
      <div className="hidden md:block shrink-0">
        <MicrophoneButton isEnabled={isMicEnabled} onToggle={onToggleMic} lang={lang} />
      </div>

      {/* STOP & NEXT/START Action Buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto md:gap-3">
        {/* STOP Button (Red gradient with Stop square icon) */}
        <button
          type="button"
          onClick={onEndCall}
          disabled={!isActiveSession}
          aria-label={t.stop}
          title={t.stop}
          className={`flex-1 md:flex-initial md:min-w-[140px] h-[42px] sm:h-[46px] md:h-[56px] rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 md:px-5 font-bold text-white transition-all duration-200 select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shrink-0 ${
            isActiveSession
              ? 'bg-gradient-to-r from-[#FF4766] to-[#E11D48] hover:from-[#FF5C77] hover:to-[#F43F5E] shadow-[0_4px_16px_rgba(225,29,72,0.4)] cursor-pointer'
              : 'bg-white/[0.06] text-white/30 border border-white/[0.08] cursor-not-allowed shadow-none'
          }`}
        >
          <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
          <span className="text-[11px] sm:text-xs md:text-sm font-bold uppercase tracking-wider truncate">
            {t.stop}
          </span>
        </button>

        {/* NEXT / START Button (Indigo-purple gradient with Play / SkipForward icon) */}
        <button
          type="button"
          onClick={onNext}
          aria-label={isActiveSession ? t.next : t.start}
          title={isActiveSession ? t.next : t.start}
          className="group relative flex-[1.2] md:flex-initial md:min-w-[170px] h-[42px] sm:h-[46px] md:h-[56px] rounded-xl sm:rounded-2xl p-[1.5px] transition-all duration-200 cursor-pointer select-none bg-gradient-to-r from-[#2563EB] via-[#5B54F2] to-[#9333EA] shadow-[0_0_20px_rgba(79,70,229,0.38)] hover:shadow-[0_0_28px_rgba(124,58,237,0.55)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2px] rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-500/25 via-indigo-500/25 to-purple-500/25 blur-md opacity-80 group-hover:opacity-100 transition-opacity duration-200"
          />
          <span className="relative w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#0F1830] via-[#131B36] to-[#1A1738] group-hover:from-[#14203E] group-hover:via-[#182244] group-hover:to-[#221D46] flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 md:px-6 transition-colors duration-200">
            {isActiveSession ? (
              <SkipForward
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white stroke-[2.2] shrink-0 transition-transform duration-200 ${
                  isSkipping
                    ? 'translate-x-1 scale-110'
                    : 'group-hover:translate-x-0.5'
                }`}
              />
            ) : (
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white fill-white stroke-[2] shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
            )}
            <span className="text-[11px] sm:text-xs md:text-sm font-bold text-white uppercase tracking-wider truncate">
              {isActiveSession ? t.next : t.start}
            </span>
          </span>
        </button>
      </div>

      {/* Mobile Ergonomic Microphone Control Pill (Shown on mobile screens below md:) */}
      <div className="block md:hidden w-full">
        <button
          type="button"
          onClick={onToggleMic}
          aria-label={isMicEnabled ? t.muteMic : t.unmuteMic}
          aria-pressed={isMicEnabled}
          title={isMicEnabled ? t.muteMic : t.unmuteMic}
          className={`w-full h-[36px] sm:h-[40px] rounded-xl flex items-center justify-center gap-2 px-3 transition-all duration-200 select-none active:scale-[0.98] cursor-pointer focus-visible:outline-none focus-visible:ring-2 border ${
            isMicEnabled
              ? 'bg-[#0E172A]/90 hover:bg-[#152342] border-white/10 text-white shadow-sm'
              : 'bg-rose-950/40 hover:bg-rose-900/50 border-rose-500/40 text-rose-300 shadow-sm'
          }`}
        >
          <div className="relative flex items-center justify-center shrink-0">
            {isMicEnabled ? (
              <Mic className="w-4 h-4 text-emerald-400 stroke-[2.2]" />
            ) : (
              <MicOff className="w-4 h-4 text-rose-400 stroke-[2.2]" />
            )}
            <span
              aria-hidden="true"
              className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${
                isMicEnabled ? 'bg-emerald-400 shadow-[0_0_6px_#10B981]' : 'bg-rose-500'
              }`}
            />
          </div>
          <span className="text-[11px] sm:text-xs font-semibold tracking-wide truncate">
            {isMicEnabled ? t.micOn : t.micOff}
          </span>
        </button>
      </div>
    </div>
  );
};
