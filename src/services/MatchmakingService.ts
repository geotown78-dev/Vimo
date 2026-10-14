import {
  MatchEndedEvent,
  MatchFoundEvent,
  MatchmakingState,
  SignalMessageEvent,
} from '../types/chat';
import { SignalingService } from './SignalingService';
import { WebRTCService } from './WebRTCService';

export interface MatchmakingServiceCallbacks {
  onStateChange: (state: MatchmakingState, detail?: string | null) => void;
  onRemoteStreamChange: (stream: MediaStream | null) => void;
  onMatchInfoChange: (matchId: string | null, peerId: string | null) => void;
  onBackendStatusChange: (connected: boolean, sessionId: string | null) => void;
}

export class MatchmakingService {
  private state: MatchmakingState = MatchmakingState.Idle;
  private currentMatchId: string | null = null;
  private currentPeerId: string | null = null;
  private localStream: MediaStream | null = null;
  private isRequestInFlight = false;
  private signaling: SignalingService;
  private webrtc: WebRTCService;
  private callbacks: MatchmakingServiceCallbacks;

  constructor(callbacks: MatchmakingServiceCallbacks) {
    this.callbacks = callbacks;

    this.webrtc = new WebRTCService({
      onRemoteStream: (stream) => {
        this.callbacks.onRemoteStreamChange(stream);
        if (stream && this.state === MatchmakingState.Connecting) {
          this.setState(MatchmakingState.Connected);
        }
      },
      onSignal: (matchId, signalType, payload) => {
        if (this.currentMatchId === matchId) {
          this.signaling.sendSignal(matchId, signalType, payload);
        }
      },
      onConnectionStateChange: (matchId, pcState) => {
        if (this.currentMatchId !== matchId) return;
        if (pcState === 'connected') {
          this.setState(MatchmakingState.Connected);
        } else if (pcState === 'connecting') {
          if (this.state !== MatchmakingState.Connected) {
            this.setState(MatchmakingState.Connecting);
          }
        } else if (pcState === 'disconnected' || pcState === 'closed') {
          this.handleMatchEnded({ matchId, reason: 'peer-disconnected' });
        } else if (pcState === 'failed') {
          this.webrtc.cleanupConnection();
          this.currentMatchId = null;
          this.currentPeerId = null;
          this.callbacks.onMatchInfoChange(null, null);
          this.setState(MatchmakingState.Error, 'Connection lost due to network failure.');
        }
      },
      onError: (matchId, message) => {
        if (this.currentMatchId !== matchId) return;
        this.webrtc.cleanupConnection();
        this.currentMatchId = null;
        this.currentPeerId = null;
        this.callbacks.onMatchInfoChange(null, null);
        this.setState(MatchmakingState.Error, message);
      },
    });

    this.signaling = new SignalingService({
      onSessionInit: (sessionId, iceServers) => {
        if (iceServers) {
          this.webrtc.setIceServers(iceServers);
        }
        this.callbacks.onBackendStatusChange(true, sessionId);
      },
      onConnectionChange: (connected) => {
        this.callbacks.onBackendStatusChange(connected, this.signaling.getSessionId());
        if (!connected && this.state !== MatchmakingState.Idle) {
          this.webrtc.cleanupConnection();
          this.currentMatchId = null;
          this.currentPeerId = null;
          this.callbacks.onMatchInfoChange(null, null);
          this.setState(MatchmakingState.Disconnected, 'Disconnected from signaling server.');
        }
      },
      onMatchFound: (event) => this.handleMatchFound(event),
      onSignalMessage: (event) => this.handleSignalMessage(event),
      onMatchEnded: (event) => this.handleMatchEnded(event),
      onError: (message) => {
        this.isRequestInFlight = false;
        this.setState(MatchmakingState.Error, message);
      },
    });

    this.signaling.connect();
  }

  private setState(nextState: MatchmakingState, detail: string | null = null): void {
    this.state = nextState;
    this.callbacks.onStateChange(nextState, detail);
  }

  public getState(): MatchmakingState {
    return this.state;
  }

  public setPermissionRequesting(isRequesting: boolean): void {
    if (isRequesting) {
      this.setState(MatchmakingState.RequestingMediaPermission);
    } else if (this.state === MatchmakingState.RequestingMediaPermission) {
      this.setState(MatchmakingState.Idle);
    }
  }

  public setErrorState(message: string): void {
    this.setState(MatchmakingState.Error, message);
  }

  public setLocalStream(stream: MediaStream | null): void {
    this.localStream = stream;
    if (stream && this.currentMatchId) {
      this.webrtc.replaceLocalStreamTracks(stream);
    }
  }

  public startOrNextSearch(): void {
    // Prevent simultaneous duplicate requests while a transition is in flight
    if (this.isRequestInFlight) return;

    this.isRequestInFlight = true;

    const hadActiveMatch = Boolean(this.currentMatchId);
    const wasAlreadySearching =
      this.state === MatchmakingState.Searching ||
      this.state === MatchmakingState.Matched ||
      this.state === MatchmakingState.Connecting ||
      this.state === MatchmakingState.Connected;

    // Clean up any existing WebRTC connection before creating a new one
    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    if (hadActiveMatch || wasAlreadySearching) {
      this.setState(MatchmakingState.Skipping, 'Switching to next user...');
      const sent = this.signaling.skipMatch();
      if (sent) {
        window.setTimeout(() => {
          if (this.state === MatchmakingState.Skipping) {
            this.setState(MatchmakingState.Searching);
          }
          this.isRequestInFlight = false;
        }, 250);
        return;
      }
    } else {
      const sent = this.signaling.joinQueue();
      if (sent) {
        this.setState(MatchmakingState.Searching);
      }
    }

    window.setTimeout(() => {
      this.isRequestInFlight = false;
    }, 250);
  }

  public disconnectCurrentMatch(): void {
    this.isRequestInFlight = false;
    this.webrtc.cleanupConnection();

    if (this.currentMatchId) {
      this.signaling.leaveMatch();
      this.currentMatchId = null;
      this.currentPeerId = null;
      this.callbacks.onMatchInfoChange(null, null);
      this.setState(MatchmakingState.Disconnected, 'Call ended.');
    } else if (
      this.state === MatchmakingState.Searching ||
      this.state === MatchmakingState.Skipping
    ) {
      this.signaling.leaveQueue();
      this.setState(MatchmakingState.Disconnected, 'Search stopped.');
    } else {
      this.setState(MatchmakingState.Disconnected, 'Disconnected.');
    }
  }

  public blockAndReportCurrentStranger(reason: string): void {
    const matchId = this.currentMatchId;
    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    if (matchId) {
      this.signaling.blockAndReportPeer(matchId, reason);
    }
    this.setState(MatchmakingState.Disconnected, 'User blocked and reported.');
  }

  private async handleMatchFound(event: MatchFoundEvent): Promise<void> {
    this.isRequestInFlight = false;

    // Prevent two simultaneous matches for the same user
    if (this.currentMatchId && this.currentMatchId !== event.matchId) {
      this.webrtc.cleanupConnection();
    }

    this.currentMatchId = event.matchId;
    this.currentPeerId = event.peerId;
    this.callbacks.onMatchInfoChange(event.matchId, event.peerId);

    this.setState(MatchmakingState.Matched);
    this.setState(MatchmakingState.Connecting);

    await this.webrtc.initializePeerConnection(
      event.matchId,
      this.localStream,
      event.initiator
    );
  }

  private async handleSignalMessage(event: SignalMessageEvent): Promise<void> {
    // Reject signaling messages for stale or non-matching sessions
    if (!this.currentMatchId || this.currentMatchId !== event.matchId) {
      return;
    }

    if (event.signalType === 'connected') {
      this.setState(MatchmakingState.Connected);
      return;
    }

    await this.webrtc.handleSignalMessage(
      event.matchId,
      event.signalType,
      event.payload
    );
  }

  private handleMatchEnded(event: MatchEndedEvent): void {
    if (this.currentMatchId && this.currentMatchId !== event.matchId) {
      return;
    }

    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    // Return the remote panel to the disconnected state; never auto-start without updating state
    const detail =
      event.reason === 'peer-skipped'
        ? 'Stranger skipped to next chat.'
        : event.reason === 'blocked'
        ? 'Connection terminated.'
        : 'Stranger disconnected.';

    this.setState(MatchmakingState.Disconnected, detail);
  }

  public destroy(): void {
    this.webrtc.cleanupConnection();
    this.signaling.destroy();
  }
}
