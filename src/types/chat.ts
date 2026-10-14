export enum MatchmakingState {
  Idle = 'Idle',
  RequestingMediaPermission = 'Requesting media permission',
  Searching = 'Searching',
  Matched = 'Matched',
  Connecting = 'Connecting',
  Connected = 'Connected',
  Skipping = 'Skipping',
  Disconnected = 'Disconnected',
  Error = 'Error',
}

export type SignalPayloadType = 'offer' | 'answer' | 'ice-candidate' | 'connected';

export interface MatchFoundEvent {
  matchId: string;
  peerId: string;
  initiator: boolean;
}

export interface SignalMessageEvent {
  matchId: string;
  senderId: string;
  signalType: SignalPayloadType;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>;
}

export interface MatchEndedEvent {
  matchId: string;
  reason: 'peer-left' | 'peer-skipped' | 'peer-disconnected' | 'blocked';
}

export interface MediaDeviceState {
  hasPermissions: boolean;
  permissionError: string | null;
  isMicEnabled: boolean;
  isCameraEnabled: boolean;
  videoDevices: MediaDeviceInfo[];
  currentVideoDeviceId: string | null;
  facingMode: 'user' | 'environment';
}

export interface BackendConnectionInfo {
  wsConnected: boolean;
  supabaseConfigured: boolean;
  sessionId: string | null;
  activeMode: 'supabase' | 'websocket' | 'unconfigured';
}
