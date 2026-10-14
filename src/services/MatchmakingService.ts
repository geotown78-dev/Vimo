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
  // User explicitly stopped flag: only becomes true when the user themselves clicks Stop / Disconnect
  private userExplicitlyStopped = true;
  private autoSearchTimeout: number | null = null;
  private signaling: SignalingService;
  private webrtc: WebRTCService;
  private callbacks: MatchmakingServiceCallbacks;

  constructor(callbacks: MatchmakingServiceCallbacks) {
    this.callbacks = callbacks;

    this.webrtc = new WebRTCService({
      onRemoteStream: (stream) => {
        this.callbacks.onRemoteStreamChange(stream);
        if (stream && this.state !== MatchmakingState.Connected) {
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
        } else if (pcState === 'disconnected') {
          // Soft disconnect; peer connection might recover or peer is about to leave
        } else if (pcState === 'closed') {
          this.handlePeerDisconnected(matchId, 'peer-disconnected');
        } else if (pcState === 'failed') {
          // Connection failed across network: do not freeze app in dead state.
          // Clean up this match and auto-continue search for the next user if user didn't stop.
          this.handleConnectionFailure(matchId);
        }
      },
      onError: (matchId, _message) => {
        if (this.currentMatchId !== matchId) return;
        this.handleConnectionFailure(matchId);
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
          this.setState(MatchmakingState.Disconnected, 'Disconnected from server.');
        }
      },
      onMatchFound: (event) => this.handleMatchFound(event),
      onSignalMessage: (event) => this.handleSignalMessage(event),
      onMatchEnded: (event) => this.handleMatchEnded(event),
      onError: (message) => {
        this.isRequestInFlight = false;
        if (this.userExplicitlyStopped) {
          this.setState(MatchmakingState.Error, message);
        } else {
          // If in active search mode, recover automatically
          this.setState(MatchmakingState.Searching, 'Reconnecting...');
          this.signaling.joinQueue();
        }
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
    this.clearAutoSearchTimer();
    this.userExplicitlyStopped = false;

    if (this.isRequestInFlight) return;
    this.isRequestInFlight = true;

    const hadActiveMatch = Boolean(this.currentMatchId);

    // Clean up current peer connection
    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    if (hadActiveMatch) {
      this.setState(MatchmakingState.Skipping, 'Switching to next user...');
      this.signaling.skipMatch();
    } else {
      this.setState(MatchmakingState.Searching);
      this.signaling.joinQueue();
    }

    window.setTimeout(() => {
      this.isRequestInFlight = false;
      if (this.state === MatchmakingState.Skipping) {
        this.setState(MatchmakingState.Searching);
      }
    }, 250);
  }

  public disconnectCurrentMatch(): void {
    this.clearAutoSearchTimer();
    // User explicitly pressed Stop / Disconnect!
    this.userExplicitlyStopped = true;
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
    this.clearAutoSearchTimer();
    const matchId = this.currentMatchId;
    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    if (matchId) {
      this.signaling.blockAndReportPeer(matchId, reason);
    }

    if (!this.userExplicitlyStopped) {
      this.setState(MatchmakingState.Searching, 'User blocked. Finding next...');
      this.signaling.joinQueue();
    } else {
      this.setState(MatchmakingState.Disconnected, 'User blocked and reported.');
    }
  }

  private async handleMatchFound(event: MatchFoundEvent): Promise<void> {
    this.clearAutoSearchTimer();
    this.isRequestInFlight = false;

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

    this.handlePeerDisconnected(event.matchId, event.reason);
  }

  private handlePeerDisconnected(
    matchId: string,
    reason: 'peer-left' | 'peer-skipped' | 'peer-disconnected' | 'blocked'
  ): void {
    if (this.currentMatchId && this.currentMatchId !== matchId) {
      return;
    }

    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    // CRITICAL: If the user DID NOT explicitly click Stop, their search NEVER STOPS!
    // Stranger's action does not terminate this user's search session.
    if (!this.userExplicitlyStopped) {
      const detail =
        reason === 'peer-skipped'
          ? 'stranger_skipped'
          : reason === 'blocked'
          ? 'stranger_blocked'
          : 'stranger_left';

      this.setState(MatchmakingState.Searching, detail);

      // Re-join matchmaking queue to immediately find the next available user
      this.clearAutoSearchTimer();
      this.autoSearchTimeout = window.setTimeout(() => {
        if (!this.userExplicitlyStopped && !this.currentMatchId) {
          this.signaling.joinQueue();
        }
      }, 300);
    } else {
      this.setState(MatchmakingState.Disconnected, 'call_ended');
    }
  }

  private handleConnectionFailure(matchId: string): void {
    if (this.currentMatchId && this.currentMatchId !== matchId) {
      return;
    }

    this.webrtc.cleanupConnection();
    this.currentMatchId = null;
    this.currentPeerId = null;
    this.callbacks.onMatchInfoChange(null, null);

    // If user is actively searching, do not freeze on error; auto-retry search for another user
    if (!this.userExplicitlyStopped) {
      this.setState(MatchmakingState.Searching, 'reconnecting_partner');
      this.clearAutoSearchTimer();
      this.autoSearchTimeout = window.setTimeout(() => {
        if (!this.userExplicitlyStopped && !this.currentMatchId) {
          this.signaling.skipMatch();
        }
      }, 400);
    } else {
      this.setState(MatchmakingState.Disconnected, 'connection_failed');
    }
  }

  private clearAutoSearchTimer(): void {
    if (this.autoSearchTimeout !== null) {
      clearTimeout(this.autoSearchTimeout);
      this.autoSearchTimeout = null;
    }
  }

  public destroy(): void {
    this.clearAutoSearchTimer();
    this.webrtc.cleanupConnection();
    this.signaling.destroy();
  }
}
