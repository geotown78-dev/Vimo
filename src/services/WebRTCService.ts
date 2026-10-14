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

  constructor(callbacks: WebRTCCallbacks) {
    this.callbacks = callbacks;
  }

  private getIceServers(): RTCIceServer[] {
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
    ];

    const turnUrl = import.meta.env.VITE_TURN_URL?.trim();
    const turnUsername = import.meta.env.VITE_TURN_USERNAME?.trim();
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL?.trim();

    if (turnUrl) {
      iceServers.push({
        urls: turnUrl,
        ...(turnUsername ? { username: turnUsername } : {}),
        ...(turnCredential ? { credential: turnCredential } : {}),
      });
    }

    return iceServers;
  }

  public async initializePeerConnection(
    matchId: string,
    localStream: MediaStream | null,
    initiator: boolean
  ): Promise<void> {
    // Always clean up any previous connection before creating a new one
    this.cleanupConnection();

    this.activeMatchId = matchId;
    this.pendingCandidates = [];
    this.isRemoteDescriptionSet = false;

    const pc = new RTCPeerConnection({
      iceServers: this.getIceServers(),
      iceCandidatePoolSize: 4,
    });

    this.peerConnection = pc;

    // Attach local audio/video tracks if available
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });
    } else {
      // Ensure we can still receive audio and video even if local camera is off
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    // Handle incoming tracks from remote peer
    pc.ontrack = (event: RTCTrackEvent) => {
      if (this.activeMatchId !== matchId) return; // Guard against stale connections

      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
      } else {
        if (!this.remoteStream) {
          this.remoteStream = new MediaStream();
        }
        this.remoteStream.addTrack(event.track);
      }
      this.callbacks.onRemoteStream(this.remoteStream);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (this.activeMatchId !== matchId) return;
      if (event.candidate) {
        this.callbacks.onSignal(matchId, 'ice-candidate', event.candidate.toJSON());
      }
    };

    // Monitor connection state changes
    pc.onconnectionstatechange = () => {
      if (this.activeMatchId !== matchId || !this.peerConnection) return;
      const state = this.peerConnection.connectionState;
      this.callbacks.onConnectionStateChange(matchId, state);

      if (state === 'connected') {
        this.callbacks.onSignal(matchId, 'connected', { timestamp: Date.now() });
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (this.activeMatchId !== matchId || !this.peerConnection) return;
      const iceState = this.peerConnection.iceConnectionState;
      if (iceState === 'failed') {
        this.callbacks.onError(matchId, 'Peer-to-peer connection failed across networks.');
      }
    };

    // If this client is the designated initiator, create and send the SDP offer
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
    // Prevent stale WebRTC connections from affecting a newer match
    if (!this.peerConnection || this.activeMatchId !== matchId) {
      return;
    }

    const pc = this.peerConnection;

    try {
      if (signalType === 'offer') {
        const offerDesc = new RTCSessionDescription(payload as RTCSessionDescriptionInit);
        await pc.setRemoteDescription(offerDesc);
        if (this.activeMatchId !== matchId) return;
        this.isRemoteDescriptionSet = true;
        await this.flushPendingCandidates(matchId);

        const answer = await pc.createAnswer();
        if (this.activeMatchId !== matchId) return;
        await pc.setLocalDescription(answer);
        this.callbacks.onSignal(matchId, 'answer', answer);
      } else if (signalType === 'answer') {
        const answerDesc = new RTCSessionDescription(payload as RTCSessionDescriptionInit);
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(answerDesc);
          if (this.activeMatchId !== matchId) return;
          this.isRemoteDescriptionSet = true;
          await this.flushPendingCandidates(matchId);
        }
      } else if (signalType === 'ice-candidate') {
        const candidateInit = payload as RTCIceCandidateInit;
        if (!candidateInit || !candidateInit.candidate) return;

        if (this.isRemoteDescriptionSet && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidateInit));
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
          await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidateInit));
        } catch (err) {
          console.error('Failed to add queued ICE candidate:', err);
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
