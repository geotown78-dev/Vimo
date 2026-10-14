import React, { useEffect, useRef } from 'react';
import {
  User,
  AlertTriangle,
} from 'lucide-react';
import { MatchmakingState } from '../types/chat';
import { VideoPanel } from './VideoPanel';
import { Language, translations } from '../lib/i18n';

interface RemoteVideoProps {
  stream: MediaStream | null;
  matchState: MatchmakingState;
  statusDetail: string | null;
  hasActiveMatch: boolean;
  lang?: Language;
  onOpenReportModal: () => void;
  onOpenSetupModal: () => void;
  className?: string;
  messages?: Array<{ id: string; sender: 'me' | 'stranger'; text: string }>;
}

export const RemoteVideo: React.FC<RemoteVideoProps> = ({
  stream,
  matchState,
  statusDetail,
  hasActiveMatch: _hasActiveMatch,
  lang = 'ka',
  onOpenReportModal,
  onOpenSetupModal,
  className = '',
  messages = [],
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const t = translations[lang] || translations.ka;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }
      videoEl.play().catch(() => {
        // Browser autoplay policy handled safely
      });
    } else {
      videoEl.srcObject = null;
    }
  }, [stream]);

  const isConnectedWithVideo =
    Boolean(stream) &&
    (matchState === MatchmakingState.Connected ||
      matchState === MatchmakingState.Connecting);

  const isSearchingState =
    matchState === MatchmakingState.Searching ||
    matchState === MatchmakingState.Skipping ||
    matchState === MatchmakingState.Matched ||
    (matchState === MatchmakingState.Connecting && !stream);

  return (
    <VideoPanel className={className}>
      {/* Subtle warm/indigo ambient backdrop when no remote video */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_65%_30%,rgba(99,102,241,0.10),transparent_60%),radial-gradient(circle_at_30%_75%,rgba(37,99,235,0.08),transparent_60%)]"
      />

      {/* Live Remote Peer Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isConnectedWithVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Center Status Overlay when nobody is connected */}
      {!isConnectedWithVideo && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-6 text-center z-10"
          aria-live="polite"
        >
          {isSearchingState ? (
            <div className="flex flex-col items-center gap-3 sm:gap-4 px-2">
              {/* Elegant animated orbital pulse for "Finding someone..." */}
              <div className="relative flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16">
                <span className="absolute inset-0 rounded-full border border-indigo-500/30 animate-ping" />
                <span className="absolute inset-1.5 sm:inset-2 rounded-full border border-blue-400/40 animate-pulse" />
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-indigo-400/40 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border-2 border-white/90 border-t-transparent animate-spin" />
                </div>
              </div>

              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[13px] sm:text-[15px] font-medium text-white tracking-[-0.01em]">
                  {matchState === MatchmakingState.Skipping
                    ? t.switchingUser
                    : t.findingSomeone}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  {matchState === MatchmakingState.Matched ||
                  matchState === MatchmakingState.Connecting
                    ? t.establishingConnection
                    : t.waitingForUser}
                </p>
              </div>
            </div>
          ) : matchState === MatchmakingState.Error ? (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/90">
                {t.connectionIssue}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400">
                {statusDetail || t.connectionIssue}
              </p>
            </div>
          ) : matchState === MatchmakingState.Disconnected ? (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400">
                <User className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-white/90">
                  {statusDetail || t.disconnected}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  {t.pressStartToFindNew}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400">
                <User className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-white/90">
                  {t.noStrangerConnected}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  {t.pressStartToBegin}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Top-Right Badge: "Stranger" with Exclamation Mark (!) for Reporting */}
      <div
        className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 md:top-4 md:right-4 z-20 flex items-center gap-1.5"
      >
        <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-[#090D16]/75 backdrop-blur-md border border-white/[0.08] shadow-sm">
          <User className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-white fill-white stroke-[1.8]" />
          <span className="text-[11px] sm:text-[12px] md:text-[13px] font-medium text-white leading-none tracking-[-0.01em] whitespace-nowrap">
            {t.stranger}
          </span>

          {/* Exclamation Mark (!) button directly next to the Stranger text */}
          <button
            type="button"
            onClick={onOpenReportModal}
            aria-label={t.reportAndBlock}
            title={t.reportAndBlock}
            className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-white/[0.08] hover:bg-rose-500/25 border border-white/[0.14] hover:border-rose-400/50 text-slate-200 hover:text-rose-400 transition-all cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400 -mr-0.5 ml-0.5"
          >
            <span className="text-[11px] font-bold leading-none select-none">!</span>
          </button>
        </div>
      </div>
      {/* Floating Chat Message Bubbles */}
      {messages.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 flex flex-col gap-1.5 pointer-events-none max-w-xs sm:max-w-sm">
          {messages.slice(-3).map((msg) => (
            <div
              key={msg.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium backdrop-blur-md shadow-lg ${
                msg.sender === 'me'
                  ? 'bg-blue-600/90 text-white self-end'
                  : 'bg-[#090D16]/90 border border-white/15 text-white self-start'
              }`}
            >
              <span className="font-bold opacity-80 text-[11px] sm:text-xs">
                {msg.sender === 'me' ? t.you : t.stranger}:
              </span>
              <span>{msg.text}</span>
            </div>
          ))}
        </div>
      )}
    </VideoPanel>
  );
};
