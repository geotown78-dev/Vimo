import React, { useEffect, useRef } from 'react';
import { Video, VideoOff, SwitchCamera, AlertCircle, Mic, MicOff } from 'lucide-react';
import { VideoPanel } from './VideoPanel';
import { Language, translations } from '../lib/i18n';

interface LocalVideoProps {
  stream: MediaStream | null;
  isCameraEnabled: boolean;
  hasPermissions: boolean;
  isRequestingPermission: boolean;
  permissionError: string | null;
  isMirrored: boolean;
  lang?: Language;
  onFlipCamera: () => void;
  onRequestPermissions: () => void;
  isMicEnabled?: boolean;
  onToggleMic?: () => void;
  className?: string;
}

export const LocalVideo: React.FC<LocalVideoProps> = React.memo(({
  stream,
  isCameraEnabled,
  hasPermissions,
  isRequestingPermission,
  permissionError,
  isMirrored,
  lang = 'ka',
  onFlipCamera,
  onRequestPermissions,
  isMicEnabled = true,
  onToggleMic,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const t = translations[lang] || translations.ka;

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (stream) {
      if (videoEl.srcObject !== stream) {
        videoEl.srcObject = stream;
        videoEl.play().catch(() => {
          // Autoplay handled safely
        });
      }
    } else {
      videoEl.srcObject = null;
    }
  }, [stream]);

  const showLiveVideo = Boolean(stream && isCameraEnabled && hasPermissions);

  return (
    <VideoPanel className={className}>
      {/* Subtle ambient background inside panel when video is off */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(37,99,235,0.12),transparent_60%),radial-gradient(circle_at_75%_80%,rgba(124,58,237,0.08),transparent_60%)]"
      />

      {/* Live Local Webcam Stream */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={`w-full h-full object-cover transition-opacity duration-200 ${
          isMirrored ? 'scale-x-[-1]' : ''
        } ${showLiveVideo ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      />

      {/* Camera-Off / Permission Placeholder */}
      {!showLiveVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-3 sm:p-6 text-center z-10">
          {isRequestingPermission ? (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-blue-500/10 border border-blue-400/20 flex items-center justify-center">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/90">
                {t.requestingAccess}
              </p>
              <p className="text-[11px] sm:text-xs text-slate-400">
                {t.allowAccessPrompt}
              </p>
            </div>
          ) : permissionError ? (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <p className="text-xs sm:text-sm font-medium text-white/90">
                {t.cameraUnavailable}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400 leading-relaxed">
                {permissionError}
              </p>
              <button
                type="button"
                onClick={onRequestPermissions}
                className="mt-0.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-medium text-white bg-white/10 hover:bg-white/15 border border-white/10 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.tryAgain}
              </button>
            </div>
          ) : !hasPermissions ? (
            <div className="flex flex-col items-center gap-2.5 sm:gap-3 max-w-xs px-2">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-300">
                <Video className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              </div>
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-xs sm:text-sm font-medium text-white/90">
                  {t.cameraOff}
                </p>
                <p className="text-[11px] sm:text-xs text-slate-400">
                  {t.cameraOffHint}
                </p>
              </div>
              <button
                type="button"
                onClick={onRequestPermissions}
                className="mt-0.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-medium text-white bg-blue-600/25 hover:bg-blue-600/35 border border-blue-400/30 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.enableCameraAndMic}
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-full bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-slate-400">
                <VideoOff className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.75]" />
              </div>
              <p className="text-xs font-medium text-slate-400">
                {t.yourCameraIsOff}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Top-Left Badge: "You" */}
      <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 md:top-3.5 md:left-3.5 z-20 pointer-events-none">
        <div className="inline-flex items-center gap-1 sm:gap-1.5 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#090D16]/80 backdrop-blur-md border border-white/[0.08] shadow-sm">
          <Video className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-3.5 md:h-3.5 text-white fill-white stroke-[1.8]" />
          <span className="text-[10px] sm:text-[11px] md:text-[13px] font-medium text-white leading-none tracking-[-0.01em] whitespace-nowrap">
            {t.you}
          </span>
        </div>
      </div>

      {/* Bottom Controls Overlay on Self Video: Flip Camera & Mic Indicator */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 sm:bottom-2.5 sm:left-2.5 sm:right-2.5 md:bottom-3 md:left-3 md:right-3 z-20 flex items-center justify-between pointer-events-none">
        {/* Flip Camera */}
        <button
          type="button"
          onClick={onFlipCamera}
          aria-label={t.flipCamera}
          title={t.flipCamera}
          className="pointer-events-auto inline-flex items-center justify-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full bg-[#090D16]/85 hover:bg-[#131B2E] active:scale-95 backdrop-blur-md border border-white/15 text-[11px] sm:text-xs font-medium text-white transition-all cursor-pointer shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <SwitchCamera className="w-3.5 h-3.5 text-white stroke-[2] shrink-0" />
          <span className="hidden sm:inline leading-none whitespace-nowrap">{t.flipCamera}</span>
        </button>

        {/* Microphone Toggle/Indicator on Self-View */}
        {onToggleMic && (
          <button
            type="button"
            onClick={onToggleMic}
            aria-label={isMicEnabled ? t.muteMic : t.unmuteMic}
            title={isMicEnabled ? t.muteMic : t.unmuteMic}
            className={`pointer-events-auto inline-flex items-center justify-center gap-1 p-1.5 sm:px-2.5 sm:py-1.5 rounded-full backdrop-blur-md border transition-all cursor-pointer active:scale-95 shadow-md focus-visible:outline-none focus-visible:ring-2 ${
              isMicEnabled
                ? 'bg-[#090D16]/85 hover:bg-[#131B2E] border-white/15 text-white'
                : 'bg-rose-600/90 hover:bg-rose-600 border-rose-500/50 text-white'
            }`}
          >
            {isMicEnabled ? (
              <Mic className="w-3.5 h-3.5 text-white stroke-[2] shrink-0" />
            ) : (
              <MicOff className="w-3.5 h-3.5 text-white stroke-[2] shrink-0" />
            )}
            <span className="hidden md:inline text-[11px] font-medium leading-none whitespace-nowrap">
              {isMicEnabled ? (lang === 'ka' ? 'მიკროფონი' : 'Mic') : (lang === 'ka' ? 'გათიშულია' : 'Muted')}
            </span>
          </button>
        )}
      </div>
    </VideoPanel>
  );
});
