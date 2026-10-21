import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Radio,
  Video,
  Mic,
  MicOff,
  Copy,
  Check,
  Settings,
  HelpCircle,
  Eye,
  Heart,
  Send,
  Monitor,
  Maximize2,
  Volume2,
  VolumeX,
  Share2,
  Tv,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Play,
  Square,
  RefreshCw,
  Lock,
} from 'lucide-react';
import {
  LiveBroadcastService,
  LiveChatMessage,
  LiveRoomState,
} from '../services/LiveBroadcastService';
import { Language, translations } from '../lib/i18n';
import { useAuth } from '../context/AuthContext';
import { AuthModal } from './AuthModal';

const ADMIN_EMAIL = 'georgetchedia@gmail.com';

interface LiveStreamPageProps {
  lang: Language;
  onNavigateHome: () => void;
}

export const LiveStreamPage: React.FC<LiveStreamPageProps> = ({
  lang,
  onNavigateHome,
}) => {
  const t = translations[lang];
  const { user, profile } = useAuth();

  const isAdmin = Boolean(
    user?.email && user.email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase()
  );
  const [broadcastError, setBroadcastError] = useState<string | null>(null);
  const [showAuthModalForAdmin, setShowAuthModalForAdmin] = useState(false);

  // Active view tab: 'watch' (Viewer) or 'studio' (OBS Streamer - admin only)
  const [activeTab, setActiveTab] = useState<'watch' | 'studio'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'studio' && isAdmin) return 'studio';
    } catch {
      // Ignore
    }
    return 'watch';
  });

  // Keep non-admins strictly on watch mode
  useEffect(() => {
    if (!isAdmin && activeTab === 'studio') {
      setActiveTab('watch');
    }
  }, [isAdmin, activeTab]);

  // Live room state from server
  const [roomState, setRoomState] = useState<LiveRoomState>({
    isLive: false,
    streamerId: null,
    streamerName: 'Yumi Streamer',
    title: 'Yumi.ge Live Stream',
    category: 'General',
    startedAt: null,
    viewerCount: 0,
    likes: 0,
  });

  // Live Chat & Reactions
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [floatingLikes, setFloatingLikes] = useState<{ id: number; x: number }[]>([]);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Broadcaster / Studio media state
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('obs_virtual');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('default');
  const [streamTitle, setStreamTitle] = useState('Yumi.ge Live Broadcast');
  const [streamCategory, setStreamCategory] = useState('Just Chatting');
  const [streamerName, setStreamerName] = useState(() => profile?.displayName || 'Host');
  const [isBroadcasting, setIsBroadcasting] = useState(false);

  useEffect(() => {
    if (profile?.displayName && (streamerName === 'Host' || !streamerName)) {
      setStreamerName(profile.displayName);
    }
  }, [profile]);
  const [studioStream, setStudioStream] = useState<MediaStream | null>(null);
  const [studioMicMuted, setStudioMicMuted] = useState(false);
  const [isScreenShareSource, setIsScreenShareSource] = useState(false);
  const [streamDuration, setStreamDuration] = useState('00:00:00');

  // Viewer state
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isViewerMuted, setIsViewerMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Copy badges
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedShare, setCopiedShare] = useState(false);
  const [showObsHelp, setShowObsHelp] = useState(false);

  // Video Refs
  const studioVideoRef = useRef<HTMLVideoElement>(null);
  const viewerVideoRef = useRef<HTMLVideoElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const liveServiceRef = useRef<LiveBroadcastService | null>(null);

  // Auto-generate stream key
  const [streamKey] = useState(() => 'live_yumi_' + Math.random().toString(36).substring(2, 10));
  const serverUrl = `${window.location.protocol}//${window.location.host}/api/whip`;
  const rtmpUrl = `rtmp://5.83.153.142/live`;

  // Initialize LiveBroadcastService
  useEffect(() => {
    const service = new LiveBroadcastService({
      onStateChange: (newState) => {
        setRoomState(newState);
      },
      onChatMessage: (newMsg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
      },
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (viewerVideoRef.current && stream) {
          viewerVideoRef.current.srcObject = stream;
        }
      },
      onLikesUpdate: (likes) => {
        setRoomState((prev) => ({ ...prev, likes }));
        triggerFloatingHeart();
      },
      onError: (errMsg) => {
        setBroadcastError(errMsg);
        setIsBroadcasting(false);
      },
    });

    liveServiceRef.current = service;

    return () => {
      service.destroy();
      liveServiceRef.current = null;
    };
  }, []);

  // When switching between Watch and Studio
  useEffect(() => {
    const service = liveServiceRef.current;
    if (!service) return;

    if (activeTab === 'watch') {
      service.joinAsViewer();
    } else {
      service.leaveViewer();
    }
  }, [activeTab]);

  // Enumerate video and audio devices to detect OBS Virtual Camera
  const refreshDevices = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      setVideoDevices(videoInputs);
      setAudioDevices(audioInputs);

      // Auto-detect OBS Virtual Camera
      const obsCam = videoInputs.find(
        (d) =>
          d.label.toLowerCase().includes('obs') ||
          d.label.toLowerCase().includes('virtual')
      );
      if (obsCam && selectedVideoDevice === 'obs_virtual') {
        setSelectedVideoDevice(obsCam.deviceId);
      } else if (videoInputs.length > 0 && selectedVideoDevice === 'obs_virtual') {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }

      if (audioInputs.length > 0 && selectedAudioDevice === 'default') {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
    } catch (e) {
      console.warn('Device enumeration error:', e);
    }
  }, [selectedAudioDevice, selectedVideoDevice]);

  useEffect(() => {
    refreshDevices();
  }, [refreshDevices]);

  // Duration timer when broadcasting
  useEffect(() => {
    if (!isBroadcasting) {
      setStreamDuration('00:00:00');
      return;
    }

    const startTime = Date.now();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - startTime) / 1000);
      const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
      const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const seconds = String(diff % 60).padStart(2, '0');
      setStreamDuration(`${hours}:${minutes}:${seconds}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [isBroadcasting]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Floating heart reaction helper
  const triggerFloatingHeart = () => {
    const id = Date.now() + Math.random();
    const x = Math.floor(Math.random() * 60) + 20; // 20% to 80%
    setFloatingLikes((prev) => [...prev.slice(-15), { id, x }]);
    setTimeout(() => {
      setFloatingLikes((prev) => prev.filter((item) => item.id !== id));
    }, 2200);
  };

  // Acquire Studio Stream (OBS Virtual Camera or Screen/Window Capture)
  const acquireStudioStream = async (useScreenShare = false) => {
    try {
      if (studioStream) {
        studioStream.getTracks().forEach((t) => t.stop());
      }

      let stream: MediaStream;

      if (useScreenShare) {
        // High-framerate screen/window capture of OBS Projector
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            displaySurface: 'window',
            frameRate: { ideal: 60, max: 60 },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: true,
        });
        setIsScreenShareSource(true);
      } else {
        const videoConstraints: MediaTrackConstraints = {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 60, max: 60 },
        };
        if (selectedVideoDevice && selectedVideoDevice !== 'obs_virtual') {
          videoConstraints.deviceId = { exact: selectedVideoDevice };
        }

        const audioConstraints: MediaTrackConstraints | boolean =
          selectedAudioDevice && selectedAudioDevice !== 'default'
            ? { deviceId: { exact: selectedAudioDevice } }
            : true;

        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
        setIsScreenShareSource(false);
      }

      setStudioStream(stream);
      if (studioVideoRef.current) {
        studioVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.error('Failed to acquire studio stream:', err);
      return null;
    }
  };

  // Start Broadcast
  const handleStartBroadcast = async () => {
    if (!isAdmin) {
      setBroadcastError(t.adminOnlyBroadcast);
      return;
    }
    setBroadcastError(null);
    let stream = studioStream;
    if (!stream) {
      stream = await acquireStudioStream(isScreenShareSource);
    }
    if (!stream) return;

    if (liveServiceRef.current) {
      await liveServiceRef.current.startLiveStream({
        title: streamTitle || 'Yumi.ge Live Stream',
        category: streamCategory,
        streamerName: streamerName || profile?.displayName || 'Host',
        streamKey,
        email: user?.email,
        stream,
      });
      setIsBroadcasting(true);
    }
  };

  // Stop Broadcast
  const handleStopBroadcast = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.stopLiveStream();
    }
    setIsBroadcasting(false);
  };

  // Toggle Studio Mic
  const toggleStudioMic = () => {
    if (studioStream) {
      const audioTrack = studioStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setStudioMicMuted(!audioTrack.enabled);
      }
    }
  };

  // Send Chat Message
  const handleSendChat = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!chatInput.trim() || !liveServiceRef.current) return;

    const isHost = activeTab === 'studio';
    const authorName = profile?.displayName || `User_${Math.floor(1000 + Math.random() * 9000)}`;
    liveServiceRef.current.sendChatMessage(
      chatInput.trim(),
      isHost ? streamerName : authorName,
      isHost ? 'host' : user ? 'vip' : 'viewer'
    );
    setChatInput('');
  };

  // Send Quick Emoji
  const handleSendEmoji = (emoji: string) => {
    if (!liveServiceRef.current) return;
    const isHost = activeTab === 'studio';
    const authorName = profile?.displayName || `User_${Math.floor(1000 + Math.random() * 9000)}`;
    liveServiceRef.current.sendChatMessage(
      emoji,
      isHost ? streamerName : authorName,
      isHost ? 'host' : user ? 'vip' : 'viewer'
    );
  };

  // Like Stream
  const handleLike = () => {
    if (liveServiceRef.current) {
      liveServiceRef.current.sendLike();
      triggerFloatingHeart();
    }
  };

  // Copy Helpers
  const copyToClipboard = (text: string, type: 'key' | 'url' | 'share') => {
    navigator.clipboard.writeText(text);
    if (type === 'key') {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    } else if (type === 'url') {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else if (type === 'share') {
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2000);
    }
  };

  // Fullscreen Viewer
  const toggleFullscreen = () => {
    if (!viewerContainerRef.current) return;
    if (!document.fullscreenElement) {
      viewerContainerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const hasObsDevice = videoDevices.some(
    (d) =>
      d.label.toLowerCase().includes('obs') ||
      d.label.toLowerCase().includes('virtual')
  );

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden text-white select-none">
      {/* Top Studio & Viewer Nav Bar */}
      <div className="w-full flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 bg-slate-900/60 backdrop-blur-md border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-xs tracking-wider uppercase">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            {t.liveBadge}
          </div>

          <h1 className="text-sm sm:text-base font-bold text-slate-100 flex items-center gap-2">
            <span>{t.liveStudioTitle}</span>
            <span className="hidden sm:inline-block text-xs font-normal text-slate-400">
              — {t.liveStudioSubtitle}
            </span>
          </h1>
        </div>

        {/* Tab Switcher: Watch Stream vs Go Live (OBS) */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-950/70 border border-slate-800/90 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('watch')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
              activeTab === 'watch'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t.watchStreamTab}</span>
            {roomState.isLive && (
              <span className="w-2 h-2 rounded-full bg-red-500 ml-0.5 animate-pulse" />
            )}
          </button>

          {/* Streamer Studio Button: ONLY rendered for administrator (georgetchedia@gmail.com) */}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('studio');
                  acquireStudioStream(isScreenShareSource);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'studio'
                    ? 'bg-gradient-to-r from-red-600 to-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                <span>{t.streamerStudioTab}</span>
                <span className="text-[10px] text-amber-300 bg-amber-500/25 px-1 py-0.2 rounded font-bold">
                  👑
                </span>
              </button>

              <button
                type="button"
                onClick={() => setShowObsHelp(true)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                title={t.obsGuide}
              >
                <HelpCircle className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden p-2 sm:p-3 md:p-4 gap-3">
        {/* ========================================================= */}
        {/* VIEW 1: WATCH STREAM (VIEWER MODE) */}
        {/* ========================================================= */}
        {activeTab === 'watch' && (
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-3 overflow-hidden">
            {/* Live Video Player Area */}
            <div
              ref={viewerContainerRef}
              className="relative flex-1 min-h-[280px] bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden flex flex-col justify-between shadow-2xl group"
            >
              {/* If Stream is Live */}
              {roomState.isLive ? (
                <>
                  <video
                    ref={viewerVideoRef}
                    autoPlay
                    playsInline
                    muted={isViewerMuted}
                    className="absolute inset-0 w-full h-full object-contain bg-black"
                  />

                  {/* Top Video Overlay: Badges & Info */}
                  <div className="relative z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-b from-black/80 via-black/30 to-transparent">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-bold tracking-wider animate-pulse">
                        <Radio className="w-3.5 h-3.5" />
                        LIVE
                      </div>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/60 backdrop-blur-md border border-white/10 text-xs text-slate-200">
                        <Eye className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          {roomState.viewerCount} {t.viewersCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(window.location.href, 'share')}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-black/60 hover:bg-black/90 backdrop-blur-md border border-white/10 text-xs text-slate-200 transition-colors cursor-pointer"
                      >
                        {copiedShare ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Share2 className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedShare ? t.copied : t.shareStream}</span>
                      </button>
                    </div>
                  </div>

                  {/* Bottom Video Controls Overlay */}
                  <div className="relative z-20 flex items-center justify-between p-3 sm:p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent">
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white drop-shadow">
                        {roomState.title || 'Live Broadcast'}
                      </h2>
                      <div className="flex items-center gap-2 text-xs text-slate-300 drop-shadow">
                        <span className="font-semibold text-blue-400">
                          {roomState.streamerName || 'Streamer'}
                        </span>
                        <span>•</span>
                        <span>{roomState.category}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsViewerMuted(!isViewerMuted)}
                        className="p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white transition-colors cursor-pointer"
                        title={isViewerMuted ? 'Unmute' : 'Mute'}
                      >
                        {isViewerMuted ? (
                          <VolumeX className="w-4 h-4 text-rose-400" />
                        ) : (
                          <Volume2 className="w-4 h-4 text-white" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={toggleFullscreen}
                        className="p-2 rounded-xl bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/10 text-white transition-colors cursor-pointer"
                        title="Fullscreen"
                      >
                        <Maximize2 className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* Offline / Waiting State */
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-radial from-slate-900 to-[#070B16]">
                  {isAdmin ? (
                    /* Admin Offline View */
                    <>
                      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4 shadow-xl">
                        <Radio className="w-8 h-8 text-rose-500 animate-pulse" />
                      </div>
                      <h2 className="text-lg sm:text-xl font-bold text-slate-100 mb-2">
                        {t.streamOffline}
                      </h2>
                      <p className="max-w-md text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
                        {t.streamOfflineDesc}
                      </p>

                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('studio');
                            acquireStudioStream(isScreenShareSource);
                          }}
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-semibold text-sm shadow-lg shadow-red-600/25 transition-all cursor-pointer"
                        >
                          <Radio className="w-4 h-4" />
                          <span>{t.streamerStudioTab}</span>
                          <ArrowRight className="w-4 h-4 ml-1" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowObsHelp(true)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                        >
                          <HelpCircle className="w-4 h-4" />
                          <span>{t.obsGuide}</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    /* Viewer Waiting Mode View (Non-admin or Guest) */
                    <div className="flex flex-col items-center max-w-md animate-in fade-in duration-300">
                      {/* Pulsing Radar Signal */}
                      <div className="relative mb-5 flex items-center justify-center">
                        <div className="absolute w-24 h-24 rounded-full bg-blue-500/10 animate-ping pointer-events-none" />
                        <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700 flex items-center justify-center text-blue-400 shadow-xl shadow-blue-500/10">
                          <Tv className="w-8 h-8 text-blue-400" />
                        </div>
                      </div>

                      {/* Waiting Status Chip */}
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800/90 border border-slate-700/80 text-xs text-slate-300 font-medium mb-3 shadow-inner">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                        <span>{t.waitingStatus}</span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold text-white mb-2 tracking-tight">
                        {t.waitingForStream}
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                        {t.waitingForStreamDesc}
                      </p>

                      <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        <span>ავტომატური ჩართვა გააქტიურებულია (Live Stream)</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Viewer Live Chat Sidebar */}
            <div className="w-full lg:w-80 h-72 lg:h-full bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 flex flex-col overflow-hidden shadow-xl shrink-0">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800/80 bg-slate-950/40">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  {t.liveChat}
                </span>
                <button
                  type="button"
                  onClick={handleLike}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-semibold hover:bg-rose-500/25 transition-colors cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                  <span>{roomState.likes}</span>
                </button>
              </div>

              {/* Messages list */}
              <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5 text-xs">
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 text-center text-xs">
                    პირდაპირი ეთერის ჩატი
                  </div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className="flex flex-col gap-0.5 rounded-lg p-1.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {m.badge === 'host' ? (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[10px] uppercase">
                            👑 Host
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 font-semibold text-[10px]">
                            Viewer
                          </span>
                        )}
                        <span className="font-semibold text-slate-200">{m.author}</span>
                      </div>
                      <p className="text-slate-300 break-words leading-relaxed pl-1">
                        {m.text}
                      </p>
                    </div>
                  ))
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Quick Emojis */}
              <div className="flex items-center justify-around px-2 py-1.5 border-t border-slate-800/50 bg-slate-950/30">
                {['🔥', '❤️', '👏', '😂', '🚀', '🇬🇪'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleSendEmoji(emoji)}
                    className="p-1 rounded hover:bg-slate-800 text-sm transition-transform active:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form
                onSubmit={handleSendChat}
                className="p-2 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={t.chatPlaceholder}
                  maxLength={300}
                  className="flex-1 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ========================================================= */}
        {/* VIEW 2: OBS BROADCAST STUDIO (STREAMER MODE - ADMIN ONLY) */}
        {/* ========================================================= */}
        {activeTab === 'studio' && (
          !isAdmin ? (
            <div className="flex-1 min-h-[360px] flex items-center justify-center p-4">
              <div className="w-full max-w-lg bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 shadow-lg shadow-amber-500/10">
                  <Lock className="w-8 h-8 text-amber-400" />
                </div>

                <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                  {t.adminOnlyBroadcast}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 mb-5 leading-relaxed max-w-md">
                  {t.adminEmailNotice} (
                  <span className="font-mono text-amber-400 font-semibold">{ADMIN_EMAIL}</span>
                  ).
                </p>

                {!user ? (
                  <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full justify-center">
                    <button
                      type="button"
                      onClick={() => setShowAuthModalForAdmin(true)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{t.adminLoginRequired}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('watch')}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition-colors cursor-pointer"
                    >
                      {t.watchStreamTab}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400">
                      თქვენ შესული ხართ როგორც: <span className="text-slate-200 font-medium">{user.email}</span> (მაყურებელი)
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('watch')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow transition-colors cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                      <span>{t.watchStreamTab}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col xl:flex-row gap-3 overflow-hidden">
              {/* Left: Video Preview & Broadcast Controls */}
              <div className="flex-1 min-h-0 flex flex-col bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-3 sm:p-4 overflow-y-auto shadow-2xl">
                {broadcastError && (
                  <div className="p-3 mb-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
                    <span>{broadcastError}</span>
                    <button
                      type="button"
                      onClick={() => setBroadcastError(null)}
                      className="text-rose-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                )}
              {/* Studio Canvas / Preview */}
              <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-slate-800 shadow-inner flex items-center justify-center mb-3">
                <video
                  ref={studioVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain"
                />

                {!studioStream && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-slate-950/90">
                    <Tv className="w-10 h-10 text-slate-500 mb-2" />
                    <p className="text-xs text-slate-400 max-w-sm">
                      ვიდეო წყარო არ არის ჩართული. აირჩიეთ OBS Virtual Camera ან დააჭირეთ ქვემოთ
                      ჩართვას.
                    </p>
                    <button
                      type="button"
                      onClick={() => acquireStudioStream(false)}
                      className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
                    >
                      <Video className="w-3.5 h-3.5" />
                      წყაროს ჩართვა
                    </button>
                  </div>
                )}

                {/* Overlays on Preview */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                      isBroadcasting
                        ? 'bg-red-600 text-white animate-pulse'
                        : 'bg-slate-800/90 text-slate-400 border border-white/10'
                    }`}
                  >
                    <Radio className="w-3 h-3" />
                    {isBroadcasting ? 'LIVE' : 'PREVIEW'}
                  </div>

                  {isBroadcasting && (
                    <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-xs font-mono text-emerald-400 border border-white/10">
                      {streamDuration}
                    </div>
                  )}
                </div>

                <div className="absolute top-2.5 right-2.5 flex items-center gap-2">
                  <div className="px-2 py-0.5 rounded bg-black/60 backdrop-blur-md text-[11px] text-slate-300 border border-white/10">
                    {t.healthExcellent}
                  </div>
                </div>

                {/* Quick preview controls */}
                <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleStudioMic}
                    className={`p-2 rounded-lg backdrop-blur-md border border-white/10 text-white transition-colors cursor-pointer ${
                      studioMicMuted ? 'bg-rose-600' : 'bg-black/60 hover:bg-black/80'
                    }`}
                    title={studioMicMuted ? t.unmuteMic : t.muteMic}
                  >
                    {studioMicMuted ? (
                      <MicOff className="w-4 h-4" />
                    ) : (
                      <Mic className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Source Selection & Mode */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {/* Video Source Selector */}
                <div className="flex flex-col gap-1.5 bg-slate-950/50 p-3 rounded-xl border border-slate-800/70">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-blue-400" />
                      {t.videoSource}
                    </label>
                    <button
                      type="button"
                      onClick={refreshDevices}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" /> განახლება
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={isScreenShareSource ? 'screen' : selectedVideoDevice}
                      onChange={(e) => {
                        if (e.target.value === 'screen') {
                          acquireStudioStream(true);
                        } else {
                          setSelectedVideoDevice(e.target.value);
                          acquireStudioStream(false);
                        }
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      {hasObsDevice && (
                        <option value="obs_virtual">⭐ {t.obsVirtualCamRecommended}</option>
                      )}
                      <option value="screen">🖥️ {t.obsScreenCapture}</option>
                      {videoDevices.map((d) => (
                        <option key={d.deviceId} value={d.deviceId}>
                          {d.label || `Camera ${d.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  {hasObsDevice && (
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> OBS Virtual Camera აღმოჩენილია!
                    </span>
                  )}
                </div>

                {/* Audio Source Selector */}
                <div className="flex flex-col gap-1.5 bg-slate-950/50 p-3 rounded-xl border border-slate-800/70">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                    {t.audioSource}
                  </label>
                  <select
                    value={selectedAudioDevice}
                    onChange={(e) => {
                      setSelectedAudioDevice(e.target.value);
                      acquireStudioStream(isScreenShareSource);
                    }}
                    className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="default">Default / OBS Audio Line</option>
                    {audioDevices.map((d) => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label || `Microphone ${d.deviceId.slice(0, 5)}`}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Broadcast Action Button */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  {isBroadcasting ? (
                    <button
                      type="button"
                      onClick={handleStopBroadcast}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                    >
                      <Square className="w-4 h-4 fill-white" />
                      <span>{t.stopBroadcast}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleStartBroadcast}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 hover:from-red-500 hover:to-pink-500 text-white font-bold text-sm shadow-lg shadow-red-600/30 transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      <span>{t.startBroadcast}</span>
                    </button>
                  )}

                  {isBroadcasting && (
                    <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {t.broadcastingLive}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                  <span>
                    {roomState.viewerCount} {t.viewersCount}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Stream Settings, OBS Keys & Studio Chat */}
            <div className="w-full xl:w-96 flex flex-col gap-3 shrink-0">
              {/* Stream Metadata Card */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-3.5 shadow-xl flex flex-col gap-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Settings className="w-3.5 h-3.5 text-blue-400" />
                  სტრიმის პარამეტრები
                </h3>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {t.streamTitle}
                  </label>
                  <input
                    type="text"
                    value={streamTitle}
                    onChange={(e) => setStreamTitle(e.target.value)}
                    placeholder={t.streamTitlePlaceholder}
                    className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-slate-400 font-medium">
                      {t.category}
                    </label>
                    <select
                      value={streamCategory}
                      onChange={(e) => setStreamCategory(e.target.value)}
                      className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="Just Chatting">Just Chatting</option>
                      <option value="Gaming">Gaming</option>
                      <option value="Music">Music</option>
                      <option value="Tech">Tech</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] text-slate-400 font-medium">სტრიმერი</label>
                    <input
                      type="text"
                      value={streamerName}
                      onChange={(e) => setStreamerName(e.target.value)}
                      className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* OBS Direct Ingestion Keys (WHIP / RTMP) */}
              <div className="bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-3.5 shadow-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-rose-400" />
                    OBS Studio კავშირის პარამეტრები
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowObsHelp(true)}
                    className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                  >
                    გიდი
                  </button>
                </div>

                {/* Server URL */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">{t.serverUrl}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      readOnly
                      value={serverUrl}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(serverUrl, 'url')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedUrl ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Stream Key */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] text-slate-400">{t.streamKey}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="password"
                      readOnly
                      value={streamKey}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(streamKey, 'key')}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                    >
                      {copiedKey ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Studio Live Chat Panel */}
              <div className="flex-1 min-h-[200px] bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-800/80 p-3 shadow-xl flex flex-col overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-xs font-bold text-slate-300">
                  <span>{t.liveChat}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {messages.length} წერილი
                  </span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto py-2 space-y-2 text-xs">
                  {messages.map((m) => (
                    <div key={m.id} className="leading-snug">
                      <span className="font-semibold text-blue-400 mr-1.5">{m.author}:</span>
                      <span className="text-slate-200 break-words">{m.text}</span>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                <form onSubmit={handleSendChat} className="flex items-center gap-1.5 pt-2 border-t border-slate-800">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="პასუხი ჩათში (როგორც ჰოსტი)..."
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </div>
          </div>
        )
      )}
    </div>

      {/* Floating Hearts Animation overlay */}
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
        {floatingLikes.map((item) => (
          <div
            key={item.id}
            style={{ left: `${item.x}%` }}
            className="absolute bottom-16 transform -translate-x-1/2 animate-[floatUp_2s_ease-out_forwards]"
          >
            <Heart className="w-7 h-7 text-rose-500 fill-rose-500 drop-shadow-lg" />
          </div>
        ))}
      </div>

      {/* OBS Setup Guide Modal */}
      {showObsHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-white">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold flex items-center gap-2">
                <Radio className="w-5 h-5 text-red-500" />
                {t.obsGuide}
              </h3>
              <button
                type="button"
                onClick={() => setShowObsHelp(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs sm:text-sm text-slate-300 leading-relaxed">
              {/* Option 1: Virtual Camera (Easiest & Fastest) */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="font-bold text-emerald-400 block mb-1">
                  მეთოდი 1: OBS Virtual Camera (ყველაზე მარტივი — 1 წამში)
                </span>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-xs">
                  <li>{t.obsStep1Desc}</li>
                  <li>{t.obsStep2Desc}</li>
                  <li>{t.obsStep3Desc}</li>
                </ol>
              </div>

              {/* Option 2: WHIP / RTMP Streaming */}
              <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                <span className="font-bold text-blue-400 block mb-1">
                  მეთოდი 2: OBS WHIP Direct Ingest (OBS 30+)
                </span>
                <p className="text-xs text-slate-300 mb-2 leading-normal">
                  {t.obsAlternativeWhipDesc}
                </p>
                <div className="space-y-1.5 text-xs font-mono">
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 truncate">URL: {serverUrl}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(serverUrl, 'url')}
                      className="text-blue-400 hover:underline shrink-0 ml-2 cursor-pointer"
                    >
                      {t.copy}
                    </button>
                  </div>
                  <div className="bg-slate-900 p-2 rounded border border-slate-800 flex items-center justify-between">
                    <span className="text-slate-400 truncate">Key: {streamKey}</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(streamKey, 'key')}
                      className="text-blue-400 hover:underline shrink-0 ml-2 cursor-pointer"
                    >
                      {t.copy}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowObsHelp(false)}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 font-semibold text-xs text-white transition-colors cursor-pointer"
              >
                {t.done}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Admin Login Modal Trigger */}
      <AuthModal
        isOpen={showAuthModalForAdmin}
        onClose={() => setShowAuthModalForAdmin(false)}
        initialMode="signin"
        lang={lang}
      />
    </div>
  );
};
