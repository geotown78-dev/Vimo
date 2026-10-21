/**
 * LiveBroadcastService.ts
 * Real-time WebRTC 1-to-many live streaming & signaling service
 * supporting OBS Studio (Virtual Camera, Screen/Window Projector, and WHIP signaling)
 */

export interface LiveChatMessage {
  id: string;
  senderId: string;
  author: string;
  text: string;
  badge?: 'host' | 'vip' | 'viewer';
  timestamp: number;
}

export interface LiveRoomState {
  isLive: boolean;
  streamerId: string | null;
  streamerName: string;
  title: string;
  category: string;
  streamKey?: string;
  streamType?: 'rtmp' | 'webrtc';
  startedAt: number | null;
  viewerCount: number;
  likes: number;
}

export type LiveEventCallback = {
  onStateChange?: (state: LiveRoomState) => void;
  onChatMessage?: (message: LiveChatMessage) => void;
  onRemoteStream?: (stream: MediaStream | null) => void;
  onLikesUpdate?: (likes: number) => void;
  onViewerJoined?: (viewerId: string) => void;
  onViewerLeft?: (viewerId: string) => void;
  onError?: (error: string) => void;
};

export class LiveBroadcastService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private isDestroyed = false;
  private callbacks: LiveEventCallback = {};

  // Streamer state
  private isStreamer = false;
  private localStream: MediaStream | null = null;
  private viewerPeerConnections = new Map<string, RTCPeerConnection>();

  // Viewer state
  private isViewer = false;
  private viewerPeerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;

  // Cached state
  private currentState: LiveRoomState = {
    isLive: false,
    streamerId: null,
    streamerName: 'Yumi Streamer',
    title: 'Live Stream',
    category: 'General',
    startedAt: null,
    viewerCount: 0,
    likes: 0,
  };

  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ];

  constructor(callbacks: LiveEventCallback = {}) {
    this.callbacks = callbacks;
    this.initWebSocket();
  }

  public updateCallbacks(callbacks: LiveEventCallback) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  private initWebSocket() {
    if (this.isDestroyed) return;

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        // Request current live room state immediately
        this.send({ type: 'live:get_state' });
      };

      socket.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          await this.handleMessage(msg);
        } catch (err) {
          console.error('[LiveService] error parsing message:', err);
        }
      };

      socket.onclose = () => {
        if (!this.isDestroyed) {
          setTimeout(() => {
            if (!this.isDestroyed) this.initWebSocket();
          }, 3000);
        }
      };

      socket.onerror = () => {
        // Handled in onclose
      };
    } catch (e) {
      console.warn('[LiveService] WebSocket connection error:', e);
    }
  }

  private send(data: Record<string, unknown>) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private async handleMessage(msg: Record<string, unknown>) {
    switch (msg.type) {
      case 'session:init': {
        this.sessionId = msg.sessionId as string;
        if (Array.isArray(msg.iceServers)) {
          this.iceServers = msg.iceServers as RTCIceServer[];
        }
        break;
      }

      case 'live:state': {
        this.currentState = {
          isLive: Boolean(msg.isLive),
          streamerId: (msg.streamerId as string) || null,
          streamerName: (msg.streamerName as string) || 'Streamer',
          title: (msg.title as string) || 'Live Stream',
          category: (msg.category as string) || 'General',
          streamKey: (msg.streamKey as string) || 'live_yumi_stream',
          streamType: (msg.streamType as 'rtmp' | 'webrtc') || 'rtmp',
          startedAt: (msg.startedAt as number) || null,
          viewerCount: (msg.viewerCount as number) || 0,
          likes: (msg.likes as number) || 0,
        };
        this.callbacks.onStateChange?.(this.currentState);

        // If history was delivered with initial get_state
        if (Array.isArray(msg.chatHistory)) {
          for (const chat of msg.chatHistory) {
            this.callbacks.onChatMessage?.(chat as LiveChatMessage);
          }
        }
        break;
      }

      case 'live:chat_message': {
        if (msg.message) {
          this.callbacks.onChatMessage?.(msg.message as LiveChatMessage);
        }
        break;
      }

      case 'live:reaction': {
        if (typeof msg.likes === 'number') {
          this.currentState.likes = msg.likes;
          this.callbacks.onLikesUpdate?.(msg.likes);
        }
        break;
      }

      case 'live:viewer_ready': {
        // Streamer received notification that a viewer wants to receive the stream
        const viewerId = msg.viewerId as string;
        if (this.isStreamer && this.localStream && viewerId) {
          this.callbacks.onViewerJoined?.(viewerId);
          await this.createStreamerPeerForViewer(viewerId);
        }
        break;
      }

      case 'live:viewer_left': {
        const viewerId = msg.viewerId as string;
        if (viewerId) {
          const pc = this.viewerPeerConnections.get(viewerId);
          if (pc) {
            pc.close();
            this.viewerPeerConnections.delete(viewerId);
          }
          this.callbacks.onViewerLeft?.(viewerId);
        }
        break;
      }

      case 'live:error': {
        if (typeof msg.error === 'string') {
          this.callbacks.onError?.(msg.error);
        }
        break;
      }

      case 'live:signal': {
        await this.handleSignalMessage(msg);
        break;
      }
    }
  }

  // --- Streamer Methods ---

  public async startLiveStream(options: {
    title: string;
    category: string;
    streamerName: string;
    streamKey?: string;
    email?: string;
    stream: MediaStream;
  }) {
    this.isStreamer = true;
    this.isViewer = false;
    this.localStream = options.stream;

    this.send({
      type: 'live:start',
      title: options.title,
      category: options.category,
      streamerName: options.streamerName,
      streamKey: options.streamKey,
      email: options.email,
    });
  }

  public stopLiveStream() {
    this.isStreamer = false;
    for (const [, pc] of this.viewerPeerConnections) {
      pc.close();
    }
    this.viewerPeerConnections.clear();
    this.localStream = null;

    this.send({ type: 'live:stop' });
  }

  private async createStreamerPeerForViewer(viewerId: string) {
    if (!this.localStream) return;

    try {
      const pc = new RTCPeerConnection({ iceServers: this.iceServers });
      this.viewerPeerConnections.set(viewerId, pc);

      // Add local stream tracks to send to viewer
      for (const track of this.localStream.getTracks()) {
        pc.addTrack(track, this.localStream);
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.send({
            type: 'live:signal',
            targetSessionId: viewerId,
            signalType: 'ice-candidate',
            payload: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          pc.close();
          this.viewerPeerConnections.delete(viewerId);
        }
      };

      const offer = await pc.createOffer({
        offerToReceiveAudio: false,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      this.send({
        type: 'live:signal',
        targetSessionId: viewerId,
        signalType: 'offer',
        payload: offer,
      });
    } catch (e) {
      console.error('[LiveService] error creating peer for viewer:', e);
    }
  }

  // --- Viewer Methods ---

  public joinAsViewer() {
    this.isViewer = true;
    this.isStreamer = false;
    this.send({ type: 'live:viewer_join' });
  }

  public leaveViewer() {
    this.isViewer = false;
    if (this.viewerPeerConnection) {
      this.viewerPeerConnection.close();
      this.viewerPeerConnection = null;
    }
    this.remoteStream = null;
    this.callbacks.onRemoteStream?.(null);
    this.send({ type: 'live:viewer_leave' });
  }

  // --- WebRTC Signaling Handler ---

  private async handleSignalMessage(msg: Record<string, unknown>) {
    const senderId = msg.senderId as string;
    const signalType = msg.signalType as string;
    const payload = msg.payload as any;

    if (!senderId || !payload) return;

    if (this.isViewer) {
      // Viewer receiving offer from Streamer
      if (signalType === 'offer') {
        if (this.viewerPeerConnection) {
          this.viewerPeerConnection.close();
        }

        const pc = new RTCPeerConnection({ iceServers: this.iceServers });
        this.viewerPeerConnection = pc;

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            this.remoteStream = event.streams[0];
            this.callbacks.onRemoteStream?.(event.streams[0]);
          } else {
            const stream = new MediaStream([event.track]);
            this.remoteStream = stream;
            this.callbacks.onRemoteStream?.(stream);
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.send({
              type: 'live:signal',
              targetSessionId: senderId,
              signalType: 'ice-candidate',
              payload: event.candidate,
            });
          }
        };

        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.send({
          type: 'live:signal',
          targetSessionId: senderId,
          signalType: 'answer',
          payload: answer,
        });
      } else if (signalType === 'ice-candidate' && this.viewerPeerConnection) {
        try {
          await this.viewerPeerConnection.addIceCandidate(new RTCIceCandidate(payload));
        } catch {
          // Candidate might arrive before remote description
        }
      }
    } else if (this.isStreamer) {
      // Streamer receiving answer or ice-candidate from a Viewer
      const pc = this.viewerPeerConnections.get(senderId);
      if (!pc) return;

      if (signalType === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (signalType === 'ice-candidate') {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload));
        } catch {
          // Ignore early candidate error
        }
      }
    }
  }

  // --- Chat & Interaction Methods ---

  public sendChatMessage(text: string, author?: string, badge?: 'host' | 'vip' | 'viewer') {
    if (!text.trim()) return;
    this.send({
      type: 'live:chat',
      text: text.trim(),
      author,
      badge,
    });
  }

  public sendLike() {
    this.send({ type: 'live:like' });
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public getCurrentState(): LiveRoomState {
    return this.currentState;
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.isStreamer) {
      this.stopLiveStream();
    }
    if (this.isViewer) {
      this.leaveViewer();
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // Ignore
      }
      this.ws = null;
    }
  }
}
