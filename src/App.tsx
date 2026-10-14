/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalVideo } from './components/LocalVideo';
import { RemoteVideo } from './components/RemoteVideo';
import { CallControls } from './components/CallControls';
import { SafetyAndSetupModal } from './components/SafetyAndSetupModal';
import { LanguageSelector } from './components/LanguageSelector';
import { VimoLogo } from './components/VimoLogo';
import { MatchmakingService } from './services/MatchmakingService';
import { MatchmakingState } from './types/chat';
import { Language, translations } from './lib/i18n';
import { ShieldAlert, Lock } from 'lucide-react';

export default function App() {
  // Language state (defaulting to Georgian, persisted in localStorage)
  const [lang, setLang] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem('vimo_lang') || localStorage.getItem('chatalternative_lang');
      if (saved === 'en' || saved === 'ka') return saved;
    } catch {
      // Ignore localStorage errors
    }
    return 'ka';
  });

  const handleSelectLang = useCallback((newLang: Language) => {
    setLang(newLang);
    try {
      localStorage.setItem('vimo_lang', newLang);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Matchmaking & WebRTC state
  const [matchState, setMatchState] = useState<MatchmakingState>(MatchmakingState.Idle);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [activeMatchId, setActiveMatchId] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermissions, setHasPermissions] = useState<boolean>(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isMicEnabled, setIsMicEnabled] = useState<boolean>(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState<boolean>(true);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isLocalMirrored, setIsLocalMirrored] = useState<boolean>(true);

  // Discreet modal state (Report/Block or Backend Setup info)
  const [activeModal, setActiveModal] = useState<'report' | 'setup' | null>(null);

  const matchmakingRef = useRef<MatchmakingService | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const isMicEnabledRef = useRef<boolean>(isMicEnabled);
  const isCameraEnabledRef = useRef<boolean>(isCameraEnabled);
  const currentDeviceIdRef = useRef<string | null>(currentDeviceId);
  const facingModeRef = useRef<'user' | 'environment'>(facingMode);

  useEffect(() => {
    isMicEnabledRef.current = isMicEnabled;
  }, [isMicEnabled]);

  useEffect(() => {
    isCameraEnabledRef.current = isCameraEnabled;
  }, [isCameraEnabled]);

  useEffect(() => {
    currentDeviceIdRef.current = currentDeviceId;
  }, [currentDeviceId]);

  useEffect(() => {
    facingModeRef.current = facingMode;
  }, [facingMode]);

  const refreshVideoDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter((d) => d.kind === 'videoinput');
      setVideoDevices(cameras);
    } catch {
      // Ignore enumeration errors
    }
  }, []);

  // Initialize MatchmakingService on mount and clean up on unmount
  useEffect(() => {
    const service = new MatchmakingService({
      onStateChange: (nextState, detail) => {
        setMatchState(nextState);
        setStatusDetail(detail ?? null);
      },
      onRemoteStreamChange: (stream) => {
        setRemoteStream(stream);
      },
      onMatchInfoChange: (matchId) => {
        setActiveMatchId(matchId);
      },
      onBackendStatusChange: (connected, sessId) => {
        setWsConnected(connected);
        setSessionId(sessId);
      },
    });

    matchmakingRef.current = service;

    if (localStreamRef.current) {
      service.setLocalStream(localStreamRef.current);
    }

    return () => {
      service.destroy();
      matchmakingRef.current = null;
    };
  }, []);

  // Synchronize localStream with matchmaking service whenever stream is updated
  useEffect(() => {
    if (matchmakingRef.current && localStream) {
      matchmakingRef.current.setLocalStream(localStream);
    }
  }, [localStream]);

  // Check if browser context is insecure (WebRTC/getUserMedia is blocked by browsers on HTTP)
  const [isInsecureContext] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    return (!window.isSecureContext || window.location.protocol !== 'https:') && !isLocal;
  });

  // Request camera and microphone stream explicitly
  const acquireMediaStream = useCallback(
    async (options?: {
      preferredDeviceId?: string | null;
      preferredFacingMode?: 'user' | 'environment';
      DesiredMicEnabled?: boolean;
      DesiredCameraEnabled?: boolean;
    }): Promise<MediaStream | null> => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        if (isInsecureContext) {
          setPermissionError('HTTPS_REQUIRED');
        } else {
          setPermissionError('Media devices are not supported in this browser context.');
        }
        return null;
      }

      setIsRequestingPermission(true);
      setPermissionError(null);
      matchmakingRef.current?.setPermissionRequesting(true);

      const targetDeviceId = options?.preferredDeviceId ?? currentDeviceIdRef.current;
      const targetFacing = options?.preferredFacingMode ?? facingModeRef.current;

      const videoConstraints: MediaTrackConstraints = targetDeviceId
        ? { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: targetFacing, width: { ideal: 1280 }, height: { ideal: 720 } };

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });

        // Stop previous tracks if replacing
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((t) => t.stop());
        }

        const micState = options?.DesiredMicEnabled ?? isMicEnabledRef.current;
        const camState = options?.DesiredCameraEnabled ?? isCameraEnabledRef.current;

        stream.getAudioTracks().forEach((track) => {
          track.enabled = micState;
        });
        stream.getVideoTracks().forEach((track) => {
          track.enabled = camState;
        });

        const activeVideoTrack = stream.getVideoTracks()[0];
        const settings = activeVideoTrack?.getSettings();
        if (settings?.deviceId) {
          setCurrentDeviceId(settings.deviceId);
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setHasPermissions(true);
        setIsMicEnabled(micState);
        setIsCameraEnabled(camState);
        setIsRequestingPermission(false);
        matchmakingRef.current?.setPermissionRequesting(false);
        matchmakingRef.current?.setLocalStream(stream);

        await refreshVideoDevices();
        return stream;
      } catch (err: unknown) {
        setIsRequestingPermission(false);
        matchmakingRef.current?.setPermissionRequesting(false);

        const errorName = err instanceof Error ? err.name : '';
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          setPermissionError('Camera or microphone permission was denied. Please allow access in your browser settings.');
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setPermissionError('No camera or microphone hardware was found on this device.');
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          setPermissionError('Your camera or microphone is currently in use by another application.');
        } else {
          setPermissionError('Could not access camera and microphone.');
        }
        return null;
      }
    },
    [refreshVideoDevices]
  );

  // Check once on mount if permissions were already granted
  useEffect(() => {
    let cancelled = false;
    async function checkExistingPermissions() {
      if (localStreamRef.current || !navigator.permissions?.query) return;
      try {
        const [camPerm, micPerm] = await Promise.all([
          navigator.permissions.query({ name: 'camera' as PermissionName }),
          navigator.permissions.query({ name: 'microphone' as PermissionName }),
        ]);
        if (
          !cancelled &&
          !localStreamRef.current &&
          camPerm.state === 'granted' &&
          micPerm.state === 'granted'
        ) {
          acquireMediaStream();
        }
      } catch {
        // Ignore if permissions query not supported
      }
    }
    checkExistingPermissions();
    return () => {
      cancelled = true;
    };
  }, [acquireMediaStream]);

  // Automatically flag HTTPS requirement if opened on insecure HTTP
  useEffect(() => {
    if (isInsecureContext) {
      setPermissionError('HTTPS_REQUIRED');
    }
  }, [isInsecureContext]);

  // Clean up local media tracks on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleRequestPermissions = useCallback(() => {
    acquireMediaStream();
  }, [acquireMediaStream]);

  // Toggle Microphone
  const handleToggleMic = useCallback(async () => {
    if (!localStreamRef.current) {
      await acquireMediaStream({ DesiredMicEnabled: true, DesiredCameraEnabled: true });
      return;
    }
    const nextMic = !isMicEnabledRef.current;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = nextMic;
    });
    setIsMicEnabled(nextMic);
  }, [acquireMediaStream]);

  // Flip Camera (switches between available video input devices or flips mirror orientation)
  const handleFlipCamera = useCallback(async () => {
    if (!localStreamRef.current) {
      await acquireMediaStream();
      return;
    }

    await refreshVideoDevices();

    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      if (nextDevice) {
        setIsLocalMirrored((prev) => !prev);
        await acquireMediaStream({
          preferredDeviceId: nextDevice.deviceId,
          DesiredMicEnabled: isMicEnabled,
          DesiredCameraEnabled: isCameraEnabled,
        });
        return;
      }
    }

    // Fallback for single-camera desktops or mobile facingMode switch
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    setIsLocalMirrored((prev) => !prev);
  }, [
    acquireMediaStream,
    currentDeviceId,
    facingMode,
    isCameraEnabled,
    isMicEnabled,
    refreshVideoDevices,
    videoDevices,
  ]);

  // Floating chat messages state
  const [messages, setMessages] = useState<Array<{ id: string; sender: 'me' | 'stranger'; text: string }>>([]);

  const handleSendMessage = useCallback((text: string) => {
    const newMsg = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      sender: 'me' as const,
      text,
    };
    setMessages((prev) => [...prev.slice(-10), newMsg]);
  }, []);

  // End Call / Disconnect
  const handleEndCall = useCallback(() => {
    matchmakingRef.current?.disconnectCurrentMatch();
    setMessages([]);
  }, []);

  // Next / Start Search
  const handleNext = useCallback(async () => {
    setMessages([]);
    let stream = localStreamRef.current;
    if (!stream && !hasPermissions && !isRequestingPermission) {
      stream = await acquireMediaStream();
    }
    if (stream && matchmakingRef.current) {
      matchmakingRef.current.setLocalStream(stream);
    }
    matchmakingRef.current?.startOrNextSearch();
  }, [acquireMediaStream, hasPermissions, isRequestingPermission]);

  const handleConfirmReportAndBlock = useCallback((reason: string) => {
    matchmakingRef.current?.blockAndReportCurrentStranger(reason);
    setMessages([]);
  }, []);

  const isSearching =
    matchState === MatchmakingState.Searching ||
    matchState === MatchmakingState.Skipping;

  const isSkipping = matchState === MatchmakingState.Skipping;

  // True whenever the user has started searching or is in a match/connecting/connected state
  const isActiveSession =
    matchState === MatchmakingState.Searching ||
    matchState === MatchmakingState.Skipping ||
    matchState === MatchmakingState.Matched ||
    matchState === MatchmakingState.Connecting ||
    matchState === MatchmakingState.Connected;

  return (
    <main className="relative w-screen h-dvh overflow-hidden bg-[#070B16] flex flex-col justify-between items-center px-2.5 pt-[max(0.4rem,env(safe-area-inset-top))] pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5 md:px-9 md:pb-6 select-none">
      {/* Ambient Radial Edge Gradients matching the visual design system */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(ellipse_60%_50%_at_12%_10%,rgba(29,78,216,0.13),transparent_70%),radial-gradient(ellipse_60%_50%_at_88%_12%,rgba(109,40,217,0.11),transparent_70%),radial-gradient(ellipse_55%_45%_at_50%_96%,rgba(79,70,229,0.16),transparent_70%)]"
      />

      {/* Top Header Bar: Vimo Brand (Left) & Language Selector (Right) */}
      <header className="relative z-30 w-full max-w-[1440px] flex items-center justify-between px-1 sm:px-2 pt-0.5 pb-1 sm:pb-2 shrink-0">
        <VimoLogo size={22} />
        <LanguageSelector currentLang={lang} onSelectLang={handleSelectLang} />
      </header>

      {/* HTTPS Notice Banner if visited over insecure HTTP */}
      {isInsecureContext && (
        <div className="relative z-30 w-full max-w-[1440px] mb-1 sm:mb-2 px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex flex-wrap items-center justify-between gap-2 shadow-sm animate-in fade-in duration-300">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-medium">{translations[lang].insecureNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              window.location.protocol = 'https:';
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold text-xs shadow transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            {translations[lang].switchToHttps}
          </button>
        </div>
      )}

      {/* Main Stage Grid (Mobile: Stranger BIG top, You SMALL bottom-left, Controls bottom-right; Desktop: Side-by-side square panels + centered bottom toolbar) */}
      <div className="relative z-10 w-full flex-1 min-h-0 flex items-center justify-center px-1 sm:px-2 py-0.5 sm:py-1 max-w-[1440px]">
        <div className="vimo-stage-grid">
          {/* Remote User ("Stranger"): Full-width row 1 (BIG) on Mobile; Column 2 (Right) on Desktop */}
          <div className="stage-panel-remote">
            <RemoteVideo
              stream={remoteStream}
              matchState={matchState}
              statusDetail={statusDetail}
              hasActiveMatch={Boolean(activeMatchId)}
              lang={lang}
              onOpenReportModal={() => setActiveModal('report')}
              onOpenSetupModal={() => setActiveModal('setup')}
              messages={messages}
              className="w-full h-full"
            />
          </div>

          {/* My Camera ("You"): Bottom-Left (SMALL) on Mobile; Column 1 (Left) on Desktop */}
          <div className="stage-panel-local">
            <LocalVideo
              stream={localStream}
              isCameraEnabled={isCameraEnabled}
              hasPermissions={hasPermissions}
              isRequestingPermission={isRequestingPermission}
              permissionError={permissionError}
              isMirrored={isLocalMirrored}
              lang={lang}
              onFlipCamera={handleFlipCamera}
              onRequestPermissions={handleRequestPermissions}
              isMicEnabled={isMicEnabled}
              onToggleMic={handleToggleMic}
              className="w-full h-full"
            />
          </div>

          {/* Call Controls: Bottom-Right beside Local Video on Mobile; Bottom Centered Toolbar on Desktop */}
          <div className="stage-panel-controls">
            <CallControls
              isMicEnabled={isMicEnabled}
              isActiveSession={isActiveSession}
              isSearching={isSearching}
              isSkipping={isSkipping}
              lang={lang}
              onToggleMic={handleToggleMic}
              onEndCall={handleEndCall}
              onNext={handleNext}
              onSendMessage={handleSendMessage}
            />
          </div>
        </div>
      </div>

      {/* Discreet Safety (Report/Block) & Backend Setup Modal */}
      <SafetyAndSetupModal
        mode={activeModal}
        onClose={() => setActiveModal(null)}
        wsConnected={wsConnected}
        sessionId={sessionId}
        matchState={matchState}
        lang={lang}
        onConfirmReportAndBlock={handleConfirmReportAndBlock}
      />
    </main>
  );
}
