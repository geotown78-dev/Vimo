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

export class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private remoteStream: MediaStream | null = null;
  private activeMatchId: string | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
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
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: 'stun:stun.services.mozilla.com' },
      { urls: 'stun:stun.sipgate.net:10000' },
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
    // Clean up any existing connection before initializing
    this.cleanupConnection();

    this.activeMatchId = matchId;
    this.pendingCandidates = [];
    this.isRemoteDescriptionSet = false;

    const pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
      iceCandidatePoolSize: 4,
      bundlePolicy: 'max-bundle' as RTCBundlePolicy,
      rtcpMuxPolicy: 'require' as RTCRtcpMuxPolicy,
    });

    this.peerConnection = pc;

    // Attach local tracks if available
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    } else {
      // Allow receiving remote video/audio even if local devices are not broadcasting
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming tracks from the remote peer
    pc.ontrack = (_event: RTCTrackEvent) => {
      if (this.activeMatchId !== matchId) return;

      const activeTracks = pc
        .getReceivers()
        .map((r) => r.track)
        .filter((track): track is MediaStreamTrack => Boolean(track) && track.readyState === 'live');

      // Create a fresh MediaStream instance with all active tracks
      const updatedStream = new MediaStream(activeTracks);
      this.remoteStream = updatedStream;
      this.callbacks.onRemoteStream(updatedStream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (this.activeMatchId !== matchId) return;
      if (event.candidate) {
        this.callbacks.onSignal(matchId, 'ice-candidate', event.candidate.toJSON());
      }
    };

    // Monitor peer connection state
    pc.onconnectionstatechange = () => {
      if (this.activeMatchId !== matchId || !this.peerConnection) return;
      const state = this.peerConnection.connectionState;
      this.callbacks.onConnectionStateChange(matchId, state);

      if (state === 'connected') {
        this.callbacks.onSignal(matchId, 'connected', { timestamp: Date.now() });
      }
    };

    // Monitor ICE connection state
    pc.oniceconnectionstatechange = () => {
      if (this.activeMatchId !== matchId || !this.peerConnection) return;
      const iceState = this.peerConnection.iceConnectionState;

      if (iceState === 'connected' || iceState === 'completed') {
        this.callbacks.onConnectionStateChange(matchId, 'connected');
      } else if (iceState === 'failed') {
        // Attempt ICE restart if supported, otherwise report failure
        if (typeof pc.restartIce === 'function' && initiator) {
          try {
            pc.restartIce();
            return;
          } catch {
            // Fall through to error callback
          }
        }
        this.callbacks.onError(matchId, 'Peer-to-peer connection failed across networks.');
      }
    };

    // If designated initiator, create and send the SDP offer
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
    if (!this.peerConnection || this.activeMatchId !== matchId) {
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
        if (!candidateInit || !candidateInit.candidate) return;

        if (this.isRemoteDescriptionSet && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(candidateInit);
          } catch (err) {
            console.warn('Failed to add received ICE candidate:', err);
          }
        } else {
          this.pendingCandidates.push(candidateInit);
        }
      }
    } catch (err) {
      console.error('WebRTC signaling handling error:', err);
    }
  }

  private async flushPendingCandidates(matchId: string): Promise<void> {
    if (!this.peerConnection || this.activeMatchId !== matchId) return;
    while (this.pendingCandidates.length > 0) {
      const candidateInit = this.pendingCandidates.shift();
      if (candidateInit) {
        try {
          await this.peerConnection.addIceCandidate(candidateInit);
        } catch (err) {
          console.warn('Failed to add queued ICE candidate:', err);
        }
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
        this.peerConnection.addTrack(newVideoTrack, newStream);
      }
    }

    if (newAudioTrack) {
      const audioSender = senders.find((s) => s.track?.kind === 'audio');
      if (audioSender) {
        await audioSender.replaceTrack(newAudioTrack);
      } else {
        this.peerConnection.addTrack(newAudioTrack, newStream);
      }
    }
  }

  public cleanupConnection(): void {
    this.activeMatchId = null;
    this.pendingCandidates = [];
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
