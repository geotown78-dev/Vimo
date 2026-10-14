import React, { useState } from 'react';
import { MicrophoneButton } from './MicrophoneButton';
import { Language, translations } from '../lib/i18n';
import { Play, SkipForward, Square, Send } from 'lucide-react';

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
  onSendMessage,
}) => {
  const t = translations[lang] || translations.ka;
  const [chatInput, setChatInput] = useState('');

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    if (onSendMessage) {
      onSendMessage(trimmed);
    }
    setChatInput('');
  };

  return (
    <div
      role="toolbar"
      aria-label="Video chat controls"
      className="w-full h-full flex flex-col justify-between gap-1.5 min-w-0 md:flex-row md:items-center md:justify-center md:gap-3 md:h-auto select-none"
    >
      {/* Mobile Top Row: Quick Message Bar & Mic Toggle */}
      <div className="flex md:hidden items-center gap-1.5 w-full min-w-0">
        <form onSubmit={handleSend} className="flex-1 min-w-0 flex items-center gap-1">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={t.messagePlaceholder}
            className="flex-1 min-w-0 h-[38px] bg-white/[0.07] hover:bg-white/[0.1] focus:bg-[#0B132B] border border-white/10 focus:border-blue-500/50 rounded-xl px-2.5 text-xs text-white placeholder:text-slate-400 focus:outline-none transition-colors"
          />
          <button
            type="submit"
            disabled={!chatInput.trim()}
            aria-label={t.sendMessage}
            className="w-[38px] h-[38px] rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:opacity-25 disabled:pointer-events-none text-white flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Mobile Microphone button */}
        <div className="shrink-0">
          <MicrophoneButton isEnabled={isMicEnabled} onToggle={onToggleMic} lang={lang} />
        </div>
      </div>

      {/* Desktop Microphone Button */}
      <div className="hidden md:block shrink-0">
        <MicrophoneButton isEnabled={isMicEnabled} onToggle={onToggleMic} lang={lang} />
      </div>

      {/* STOP & NEXT Buttons Row */}
      <div className="flex items-center gap-1.5 sm:gap-2 w-full md:w-auto md:gap-3">
        {/* STOP Button (Red accent with Stop square icon) */}
        <button
          type="button"
          onClick={onEndCall}
          disabled={!isActiveSession}
          aria-label={t.stop}
          title={t.stop}
          className={`flex-1 md:flex-initial md:min-w-[140px] h-[44px] sm:h-[48px] md:h-[56px] rounded-xl sm:rounded-2xl flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-5 font-bold text-white transition-all duration-200 select-none active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 shrink-0 ${
            isActiveSession
              ? 'bg-gradient-to-r from-[#FF4766] to-[#E11D48] hover:from-[#FF5C77] hover:to-[#F43F5E] shadow-[0_4px_16px_rgba(225,29,72,0.4)] cursor-pointer'
              : 'bg-white/[0.06] text-white/30 border border-white/[0.08] cursor-not-allowed shadow-none'
          }`}
        >
          <Square className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current shrink-0" />
          <span className="text-xs sm:text-sm md:text-base uppercase tracking-wider font-bold truncate">
            {t.stop}
          </span>
        </button>

        {/* NEXT / START Button (Blue gradient with Play / SkipForward icon) */}
        <button
          type="button"
          onClick={onNext}
          aria-label={isActiveSession ? t.next : t.start}
          title={isActiveSession ? t.next : t.start}
          className="group relative flex-[1.25] md:flex-initial md:min-w-[170px] h-[44px] sm:h-[48px] md:h-[56px] rounded-xl sm:rounded-2xl p-[1.5px] transition-all duration-200 cursor-pointer select-none bg-gradient-to-r from-[#2563EB] via-[#5B54F2] to-[#9333EA] shadow-[0_0_20px_rgba(79,70,229,0.38)] hover:shadow-[0_0_28px_rgba(124,58,237,0.55)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 shrink-0"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[2px] rounded-xl sm:rounded-2xl bg-gradient-to-r from-blue-500/25 via-indigo-500/25 to-purple-500/25 blur-md opacity-80 group-hover:opacity-100 transition-opacity duration-200"
          />
          <span className="relative w-full h-full rounded-xl sm:rounded-2xl bg-gradient-to-r from-[#0F1830] via-[#131B36] to-[#1A1738] group-hover:from-[#14203E] group-hover:via-[#182244] group-hover:to-[#221D46] flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-6 transition-colors duration-200">
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
            <span className="text-xs sm:text-sm md:text-base font-bold text-white uppercase tracking-wider truncate">
              {isActiveSession ? t.next : t.start}
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};
