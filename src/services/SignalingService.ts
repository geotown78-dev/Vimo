import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  MatchEndedEvent,
  MatchFoundEvent,
  SignalMessageEvent,
  SignalPayloadType,
} from '../types/chat';
import type { RealtimeChannel } from '@supabase/supabase-js';

type SignalingCallbacks = {
  onSessionInit?: (sessionId: string) => void;
  onConnectionChange?: (connected: boolean) => void;
  onMatchFound?: (event: MatchFoundEvent) => void;
  onSignalMessage?: (event: SignalMessageEvent) => void;
  onMatchEnded?: (event: MatchEndedEvent) => void;
  onError?: (message: string) => void;
};

export class SignalingService {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;
  private callbacks: SignalingCallbacks = {};
  private reconnectTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private isDestroyed = false;
  private wsConnected = false;
  private supabaseChannel: RealtimeChannel | null = null;

  constructor(callbacks: SignalingCallbacks) {
    this.callbacks = callbacks;
  }

  public connect(): void {
    if (this.isDestroyed) return;
    this.connectWebSocket();
  }

  private connectWebSocket(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.isDestroyed) return;
        this.wsConnected = true;
        this.callbacks.onConnectionChange?.(true);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        if (this.isDestroyed) return;
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingMessage(data);
        } catch (err) {
          console.error('Failed to parse signaling message:', err);
        }
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        this.stopHeartbeat();
        this.callbacks.onConnectionChange?.(false);
        if (!this.isDestroyed) {
          this.reconnectTimer = window.setTimeout(() => {
            this.connectWebSocket();
          }, 2000);
        }
      };

      this.ws.onerror = () => {
        this.wsConnected = false;
        this.callbacks.onConnectionChange?.(false);
      };
    } catch (err) {
      console.error('WebSocket connection error:', err);
      this.callbacks.onError?.('Unable to connect to signaling server.');
    }
  }

  private handleIncomingMessage(data: Record<string, unknown>): void {
    switch (data.type) {
      case 'session:init': {
        this.sessionId = String(data.sessionId);
        this.callbacks.onSessionInit?.(this.sessionId);
        break;
      }
      case 'match:found': {
        const matchEvent: MatchFoundEvent = {
          matchId: String(data.matchId),
          peerId: String(data.peerId),
          initiator: Boolean(data.initiator),
        };
        if (isSupabaseConfigured && supabase) {
          this.subscribeSupabaseMatchChannel(matchEvent.matchId);
        }
        this.callbacks.onMatchFound?.(matchEvent);
        break;
      }
      case 'signal:message': {
        this.callbacks.onSignalMessage?.({
          matchId: String(data.matchId),
          senderId: String(data.senderId),
          signalType: data.signalType as SignalPayloadType,
          payload: data.payload as RTCSessionDescriptionInit | RTCIceCandidateInit,
        });
        break;
      }
      case 'match:ended': {
        this.unsubscribeSupabaseMatchChannel();
        this.callbacks.onMatchEnded?.({
          matchId: String(data.matchId),
          reason: (data.reason as MatchEndedEvent['reason']) || 'peer-left',
        });
        break;
      }
      case 'signal:error': {
        this.callbacks.onError?.(String(data.error || 'Signaling error'));
        break;
      }
    }
  }

  private subscribeSupabaseMatchChannel(matchId: string): void {
    if (!supabase) return;
    this.unsubscribeSupabaseMatchChannel();

    this.supabaseChannel = supabase
      .channel(`match:${matchId}`)
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        if (!payload || payload.senderId === this.sessionId) return;
        this.callbacks.onSignalMessage?.({
          matchId: payload.matchId,
          senderId: payload.senderId,
          signalType: payload.signalType,
          payload: payload.payload,
        });
      })
      .subscribe();
  }

  private unsubscribeSupabaseMatchChannel(): void {
    if (this.supabaseChannel && supabase) {
      supabase.removeChannel(this.supabaseChannel);
      this.supabaseChannel = null;
    }
  }

  public joinQueue(): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.callbacks.onError?.('Signaling server is not connected.');
      return false;
    }
    this.ws.send(JSON.stringify({ type: 'queue:join' }));
    return true;
  }

  public leaveQueue(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'queue:leave' }));
    }
  }

  public skipMatch(): boolean {
    this.unsubscribeSupabaseMatchChannel();
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.callbacks.onError?.('Signaling server is not connected.');
      return false;
    }
    this.ws.send(JSON.stringify({ type: 'match:skip' }));
    return true;
  }

  public leaveMatch(): void {
    this.unsubscribeSupabaseMatchChannel();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'match:leave' }));
    }
  }

  public sendSignal(
    matchId: string,
    signalType: SignalPayloadType,
    payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, unknown>
  ): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'signal:message',
          matchId,
          signalType,
          payload,
        })
      );
    }
  }

  public blockAndReportPeer(matchId: string, reason: string): void {
    this.unsubscribeSupabaseMatchChannel();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'match:block_and_report',
          matchId,
          reason,
        })
      );
    }
  }

  public getSessionId(): string | null {
    return this.sessionId;
  }

  public isConnected(): boolean {
    return this.wsConnected;
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = window.setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  public destroy(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();
    this.unsubscribeSupabaseMatchChannel();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
