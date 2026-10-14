import { SignalPayloadType } from '../types/chat';

export interface WebRTCCallbacks {
  onRemoteStream: (stream: MediaStream | null) => void;
  onSignal: (
    matchId: string,
    signalType: SignalPayloadType,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
  ) => void;
  onConnectionStateChange: (matchId: string, state: RTCPeerConnectionState) => void;
  onError: (matchId: string, message: string) => void;
}

interface QueuedSignal {
  matchId: string;
  signalType: SignalPayloadType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
}

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private activeMatchId: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private queuedSignals: QueuedSignal[] = [];
  private isRemoteDescriptionSet = false;
  private isInitializing = false;
  private callbacks: WebRTCCallbacks;
  private configuredIceServers: RTCIceServer[] | null = null;

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  public setIceServers(servers: RTCIceServer[]): void {
    if (Array.isArray(servers) && servers.length > 0) {
      this.configuredIceServers = servers;
    }
  }

  private getIceServers(): RTCIceServer[] {
    if (this.configuredIceServers && this.configuredIceServers.length > 0) {
      return this.configuredIceServers;
    }

    const iceServers: RTCIceServer[] = [
      {
        urls: [
          'stun:stun.l.google.com:19302',
          'stun:stun1.l.google.com:19302',
          'stun:stun2.l.google.com:19302',
          'stun:stun3.l.google.com:19302',
          'stun:stun4.l.google.com:19302',
          'stun:stun.cloudflare.com:3478',
        ],
      },
    ];

    const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
    const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();

    if (turnUrl) {
      const urls = turnUrl.includes(',')
        ? turnUrl.split(',').map((u: string) => u.trim()).filter(Boolean)
        : turnUrl;
      iceServers.push({
        urls,
        ...(turnUsername ? { username: turnUsername } : {}),
        ...(turnCredential ? { credential: turnCredential } : {}),
      });
    } else {
      // Default public TURN relay servers for cross-network and mobile carrier traversal
      iceServers.push({
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
          'turns:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      });
    }

    return iceServers;
  }

  public async initializePeerConnection(
    matchId: string,
    localStream: MediaStream | null,
    initiator: boolean
  ): Promise<void> {
    // Clean up any previous session
    this.cleanupConnection();

    this.activeMatchId = matchId;
    this.isInitializing = true;
    this.pendingCandidates = [];
    this.queuedSignals = [];
    this.isRemoteDescriptionSet = false;

    const pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
    });

    this.peerConnection = pc;

    // Attach local audio & video tracks if available
    const hasAudio = Boolean(localStream && localStream.getAudioTracks().length > 0);
    const hasVideo = Boolean(localStream && localStream.getVideoTracks().length > 0);

    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          pc.addTrack(track, localStream);
        } catch (e) {
          console.warn('Could not add track to peer connection:', e);
        }
      });
    }

    // Always ensure transceivers exist to receive remote audio/video regardless of local mic/cam status
    if (!hasAudio) {
      try {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      } catch (e) {
        console.warn('Error adding audio transceiver:', e);
      }
    }
    if (!hasVideo) {
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch (e) {
        console.warn('Error adding video transceiver:', e);
      }
    }

    // Handle incoming media tracks from remote peer
    pc.ontrack = (event: RTCTrackEvent) => {
      if (this.activeMatchId !== matchId) return;

      let targetStream: MediaStream;
      if (event.streams && event.streams[0]) {
        targetStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        if (!this.remoteStream.getTracks().some((t) => t.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        targetStream = this.remoteStream;
      }

      this.remoteStream = targetStream;
      this.callbacks.onRemoteStream(targetStream);
    };

    // Forward ICE candidates to remote peer via signaling server
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (this.activeMatchId !== matchId) return;
      if (event.candidate) {
        this.callbacks.onSignal(matchId, 'ice-candidate', event.candidate.toJSON());
      }
    };

    // Connection state handler
    const markConnected = () => {
      if (this.activeMatchId !== matchId) return;
      this.callbacks.onConnectionStateChange(matchId, 'connected');
      this.callbacks.onSignal(matchId, 'connected', { timestamp: Date.now() });
    };

    pc.onconnectionstatechange = () => {
      if (this.activeMatchId !== matchId || !this.peerConnection) return;
      const state = this.peerConnection.connectionState;
      if (state === 'connected') {
        markConnected();
      } else if (state === 'connecting') {
        this.callbacks.onConnectionStateChange(matchId, 'connecting');
      } else if (state === 'failed') {
        this.callbacks.onConnectionStateChange(matchId, 'failed');
      } else if (state === 'disconnected') {
        this.callbacks.onConnectionStateChange(matchId, 'disconnected');
      }
    };

    // ICE connection state handler
    pc.oniceconnectionstatechange = () => {
      if (this.activeMatchId !== matchId || !this.peerConnection) return;
      const iceState = this.peerConnection.iceConnectionState;

      if (iceState === 'connected' || iceState === 'completed') {
        markConnected();
      } else if (iceState === 'failed') {
        this.callbacks.onConnectionStateChange(matchId, 'failed');
      }
    };

    this.isInitializing = false;

    // Process any signals that arrived while initializePeerConnection was executing
    await this.processQueuedSignals();

    // If designated initiator, generate SDP offer
    if (initiator) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });
        if (this.activeMatchId !== matchId) return;
        await pc.setLocalDescription(offer);
        this.callbacks.onSignal(matchId, 'offer', offer);
      } catch (err) {
        console.error('Error creating WebRTC offer:', err);
        this.callbacks.onError(matchId, 'Failed to initialize video call offer.');
      }
    }
  }

  public async handleSignalMessage(
    matchId: string,
    signalType: SignalPayloadType,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
  ): Promise<void> {
    if (this.activeMatchId !== matchId) {
      return;
    }

    // If peer connection is currently initializing, queue the signal
    if (!this.peerConnection || this.isInitializing) {
      this.queuedSignals.push({ matchId, signalType, payload });
      return;
    }

    const pc = this.peerConnection;

    try {
      if (signalType === 'offer') {
        await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
        if (this.activeMatchId !== matchId) return;
        this.isRemoteDescriptionSet = true;
        await this.flushPendingCandidates(matchId);

        const answer = await pc.createAnswer();
        if (this.activeMatchId !== matchId) return;
        await pc.setLocalDescription(answer);
        this.callbacks.onSignal(matchId, 'answer', answer);
      } else if (signalType === 'answer') {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(payload as RTCSessionDescriptionInit);
          if (this.activeMatchId !== matchId) return;
          this.isRemoteDescriptionSet = true;
          await this.flushPendingCandidates(matchId);
        }
      } else if (signalType === 'ice-candidate') {
        const candidateInit = payload as RTCIceCandidateInit;
        if (!candidateInit || candidateInit.candidate === undefined) return;

        if (this.isRemoteDescriptionSet && pc.remoteDescription) {
          await this.safelyAddIceCandidate(candidateInit);
        } else {
          this.pendingCandidates.push(candidateInit);
        }
      }
    } catch (err) {
      console.warn('WebRTC signal handling warning:', err);
    }
  }

  private async processQueuedSignals(): Promise<void> {
    if (this.queuedSignals.length === 0) return;
    const signals = [...this.queuedSignals];
    this.queuedSignals = [];

    for (const item of signals) {
      if (this.activeMatchId === item.matchId) {
        await this.handleSignalMessage(item.matchId, item.signalType, item.payload);
      }
    }
  }

  private async safelyAddIceCandidate(candidateInit: RTCIceCandidateInit): Promise<void> {
    if (!this.peerConnection) return;
    try {
      if (typeof RTCIceCandidate !== 'undefined') {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
      } else {
        await this.peerConnection.addIceCandidate(candidateInit);
      }
    } catch {
      try {
        await this.peerConnection.addIceCandidate(candidateInit);
      } catch (err2) {
        console.warn('Could not add candidate:', err2);
      }
    }
  }

  private async flushPendingCandidates(matchId: string): Promise<void> {
    if (!this.peerConnection || this.activeMatchId !== matchId) return;
    while (this.pendingCandidates.length > 0) {
      const candidateInit = this.pendingCandidates.shift();
      if (candidateInit) {
        await this.safelyAddIceCandidate(candidateInit);
      }
    }
  }

  public async replaceLocalStreamTracks(newStream: MediaStream): Promise<void> {
    if (!this.peerConnection) return;

    const senders = this.peerConnection.getSenders();
    const newVideoTrack = newStream.getVideoTracks()[0];
    const newAudioTrack = newStream.getAudioTracks()[0];

    if (newVideoTrack) {
      const videoSender = senders.find((s) => s.track?.kind === 'video');
      if (videoSender) {
        await videoSender.replaceTrack(newVideoTrack);
      } else {
        try {
          this.peerConnection.addTrack(newVideoTrack, newStream);
        } catch {
          // Track might already be added
        }
      }
    }

    if (newAudioTrack) {
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender) {
        await audioSender.replaceTrack(newAudioTrack);
      } else {
        try {
          this.peerConnection.addTrack(newAudioTrack, newStream);
        } catch {
          // Track might already be added
        }
      }
    }
  }

  public cleanupConnection(): void {
    this.activeMatchId = null;
    this.isInitializing = false;
    this.pendingCandidates = [];
    this.queuedSignals = [];
    this.isRemoteDescriptionSet = false;

    if (this.peerConnection) {
      this.peerConnection.ontrack = null;
      this.peerConnection.onicecandidate = null;
      this.peerConnection.onconnectionstatechange = null;
      this.peerConnection.oniceconnectionstatechange = null;
      try {
        this.peerConnection.close();
      } catch {
        // Ignore close errors
      }
      this.peerConnection = null;
    }

    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t) => t.stop());
      this.remoteStream = null;
    }

    this.callbacks.onRemoteStream(null);
  }
}
