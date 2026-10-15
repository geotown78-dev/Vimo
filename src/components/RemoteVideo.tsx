import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  AlertTriangle,
  VolumeX,
  VideoOff,
  Mic,
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
  onOpenSetupModal: _onOpenSetupModal,
  className = '',
  messages = [],
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const t = translations[lang] || translations.ka;
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isAutoplayMuted, setIsAutoplayMuted] = useState<boolean>(false);
  const [, setTrackUpdateTick] = useState<number>(0);

  // Track dynamically added/removed or muted/unmuted tracks on the active stream
  useEffect(() => {
    if (!stream) return;
    const forceUpdate = () => setTrackUpdateTick((k) => k + 1);

    const onTrackAdded = (e: MediaStreamTrackEvent) => {
      forceUpdate();
      if (e.track) {
        e.track.addEventListener('mute', forceUpdate);
        e.track.addEventListener('unmute', forceUpdate);
        e.track.addEventListener('ended', forceUpdate);
      }
      if (videoRef.current) {
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            setIsAutoplayMuted(true);
            videoRef.current.play().catch(() => {});
          }
        });
      }
    };

    stream.addEventListener('addtrack', onTrackAdded);
    stream.addEventListener('removetrack', forceUpdate);
    stream.getTracks().forEach((track) => {
      track.addEventListener('mute', forceUpdate);
      track.addEventListener('unmute', forceUpdate);
      track.addEventListener('ended', forceUpdate);
    });

    return () => {
      stream.removeEventListener('addtrack', onTrackAdded);
      stream.removeEventListener('removetrack', forceUpdate);
      stream.getTracks().forEach((track) => {
        track.removeEventListener('mute', forceUpdate);
        track.removeEventListener('unmute', forceUpdate);
        track.removeEventListener('ended', forceUpdate);
      });
    };
  }, [stream]);

  const hasLiveVideoTrack = Boolean(
    stream &&
      stream
        .getVideoTracks()
        .some((track) => track.readyState === 'live' && !track.muted)
  );

  const hasAnyVideoTrack = Boolean(
    stream &&
      stream
        .getVideoTracks()
        .some((track) => track.readyState === 'live')
  );

  const hasLiveAudioTrack = Boolean(
    stream &&
      stream
        .getAudioTracks()
        .some((track) => track.readyState === 'live')
  );

  const isConnected =
    matchState === MatchmakingState.Connected ||
    (Boolean(stream) && (hasAnyVideoTrack || hasLiveAudioTrack));

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
      }

      const handlePlaying = () => setIsVideoPlaying(true);
      const handleWaiting = () => setIsVideoPlaying(false);

      videoEl.addEventListener('playing', handlePlaying);
      videoEl.addEventListener('pause', handleWaiting);
      videoEl.addEventListener('waiting', handleWaiting);

      const tryPlay = () => {
        const p = videoEl.play();
        if (p !== undefined) {
          p.then(() => {
            setIsVideoPlaying(true);
          }).catch((_err) => {
            // Autoplay policy prevented unmuted playback: fall back to muted so video frames render immediately
            videoEl.muted = true;
            setIsAutoplayMuted(true);
            videoEl.play().then(() => {
              setIsVideoPlaying(true);
            }).catch(() => {});
          });
        }
      };

      tryPlay();
      videoEl.onloadedmetadata = () => {
        setIsVideoPlaying(true);
        tryPlay();
      };
      videoEl.oncanplay = () => {
        setIsVideoPlaying(true);
        tryPlay();
      };

      return () => {
        videoEl.removeEventListener('playing', handlePlaying);
        videoEl.removeEventListener('pause', handleWaiting);
        videoEl.removeEventListener('waiting', handleWaiting);
      };
    } else {
      videoEl.srcObject = null;
      setIsVideoPlaying(false);
      setIsAutoplayMuted(false);
    }
  }, [stream, isConnected, hasAnyVideoTrack]);

  // Click on video to unmute if muted by autoplay restrictions
  const handleUnmute = () => {
    if (videoRef.current) {
      if (isAutoplayMuted) {
        videoRef.current.muted = false;
        setIsAutoplayMuted(false);
      }
      videoRef.current.play().catch(() => {});
    }
  };

  const getStatusDetailText = (): string => {
    if (statusDetail === 'stranger_skipped') return t.strangerSkipped;
    if (statusDetail === 'stranger_left') return t.strangerLeft;
    if (statusDetail === 'reconnecting_partner') return t.reconnectingPartner;
    if (statusDetail === 'call_ended') return t.callEnded;
    if (statusDetail === 'connection_failed') return t.connectionIssue;
    return statusDetail || '';
  };

  const isSearchingState =
    matchState === MatchmakingState.Searching ||
    matchState === MatchmakingState.Skipping ||
    matchState === MatchmakingState.Matched ||
    (matchState === MatchmakingState.Connecting && !isConnected);

  return (
    <VideoPanel className={className}>
      {/* Subtle warm/indigo ambient backdrop */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_65%_30%,rgba(99,102,241,0.12),transparent_60%),radial-gradient(circle_at_30%_75%,rgba(37,99,235,0.08),transparent_60%)]"
      />

      {/* Live Remote Peer Video Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        onClick={handleUnmute}
        className={`w-full h-full object-cover transition-opacity duration-200 cursor-pointer ${
          isConnected && hasLiveVideoTrack ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Tap to Unmute Overlay if audio autoplay was restricted by mobile browser */}
      {isConnected && isAutoplayMuted && (
        <button
          type="button"
          onClick={handleUnmute}
          className="absolute bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0b101e]/90 backdrop-blur-md border border-amber-400/40 text-white text-[11px] sm:text-xs font-medium shadow-xl hover:bg-slate-800 transition-all cursor-pointer animate-pulse"
        >
          <VolumeX className="w-3.5 h-3.5 text-amber-400" />
          <span>{lang === 'ka' ? 'ხმის ჩასართავად დააჭირეთ აქ' : 'Tap to enable sound'}</span>
        </button>
      )}

      {/* Connected State but Remote Video is Off / Audio Only */}
      {isConnected && !hasLiveVideoTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10">
          <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 mb-3">
            <span className="absolute inset-0 rounded-full bg-blue-500/10 border border-blue-400/20 animate-pulse" />
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-slate-800/80 border border-white/15 flex items-center justify-center text-slate-300">
              <User className="w-6 h-6 sm:w-7 sm:h-7 stroke-[1.8]" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center text-amber-400">
              <VideoOff className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-semibold text-white">
              {lang === 'ka' ? 'უცნობი დაკავშირებულია' : 'Stranger is connected'}
            </p>
            <p className="text-[11px] sm:text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>
                {lang === 'ka'
                  ? 'კამერა გამორთულია (აუდიო აქტიურია)'
                  : 'Camera is off (Audio active)'}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Center Status Overlay when nobody is connected */}
      {!isConnected && (
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
                    : getStatusDetailText() || t.waitingForUser}
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
                {getStatusDetailText() || t.connectionIssue}
              </p>
            </div>
          ) : matchState === MatchmakingState.Disconnected ? (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400">
                <User className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-white/90">
                  {getStatusDetailText() || t.disconnected}
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
