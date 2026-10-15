import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Server-Side Data Structures (Equivalent to Supabase Tables with Server-Side Authorization) ---

interface UserSession {
  sessionId: string;
  ws: WebSocket;
  status: 'idle' | 'searching' | 'matched' | 'connecting' | 'connected';
  currentMatchId: string | null;
  createdAt: number;
  lastSeenAt: number;
}

interface QueueEntry {
  sessionId: string;
  joinedAt: number;
}

interface MatchRecord {
  matchId: string;
  userA: string;
  userB: string;
  status: 'matched' | 'connecting' | 'connected' | 'ended';
  createdAt: number;
}

interface SignalingMessageRecord {
  id: string;
  matchId: string;
  senderId: string;
  receiverId: string;
  type: 'offer' | 'answer' | 'ice-candidate' | 'ConnectionState';
  payload: unknown;
  createdAt: number;
}

interface BlockRecord {
  id: string;
  blockerSessionId: string;
  blockedSessionId: string;
  createdAt: number;
}

interface ReportRecord {
  id: string;
  reporterSessionId: string;
  reportedSessionId: string;
  matchId: string | null;
  reason: string;
  createdAt: number;
}

const userSessions = new Map<string, UserSession>();
const matchmakingQueue: QueueEntry[] = [];
const matches = new Map<string, MatchRecord>();
const signalingMessages: SignalingMessageRecord[] = [];
const blockRecords: BlockRecord[] = [];
const reportRecords: ReportRecord[] = [];

// Helper to safely send JSON to a WebSocket client
function sendToClient(ws: WebSocket, message: Record<string, unknown>) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

// Broadcast exact online user count to all active WebSocket clients
function broadcastUserCount() {
  const count = userSessions.size;
  const message = { type: 'online:count', count };
  for (const session of userSessions.values()) {
    sendToClient(session.ws, message);
  }
}

function isBlockedBetween(user1: string, user2: string): boolean {
  return blockRecords.some(
    (b) =>
      (b.blockerSessionId === user1 && b.blockedSessionId === user2) ||
      (b.blockerSessionId === user2 && b.blockedSessionId === user1)
  );
}

function removeFromQueue(sessionId: string) {
  for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
    if (matchmakingQueue[i].sessionId === sessionId) {
      matchmakingQueue.splice(i, 1);
    }
  }
}

function cleanupMatchSignaling(matchId: string) {
  for (let i = signalingMessages.length - 1; i >= 0; i--) {
    if (signalingMessages[i].matchId === matchId) {
      signalingMessages.splice(i, 1);
    }
  }
}

const recentPairs = new Map<string, number>();

function recordRecentPair(u1: string, u2: string) {
  const key = u1 < u2 ? `${u1}:${u2}` : `${u2}:${u1}`;
  recentPairs.set(key, Date.now());
}

function wasRecentlyMatched(u1: string, u2: string, cooldownMs = 3500): boolean {
  const key = u1 < u2 ? `${u1}:${u2}` : `${u2}:${u1}`;
  const ts = recentPairs.get(key);
  if (!ts) return false;
  if (Date.now() - ts > cooldownMs) {
    recentPairs.delete(key);
    return false;
  }
  return true;
}

function terminateActiveMatchForUser(
  sessionId: string,
  reason: 'peer-left' | 'peer-skipped' | 'peer-disconnected' | 'blocked'
) {
  const session = userSessions.get(sessionId);
  if (!session || !session.currentMatchId) return;

  const matchId = session.currentMatchId;
  const match = matches.get(matchId);
  session.currentMatchId = null;
  if (session.status !== 'searching') {
    session.status = 'idle';
  }

  if (!match || match.status === 'ended') return;
  match.status = 'ended';
  cleanupMatchSignaling(matchId);

  const peerSessionId = match.userA === sessionId ? match.userB : match.userA;
  recordRecentPair(sessionId, peerSessionId);

  const peerSession = userSessions.get(peerSessionId);
  if (peerSession && peerSession.currentMatchId === matchId) {
    peerSession.currentMatchId = null;
    peerSession.status = 'idle';
    sendToClient(peerSession.ws, {
      type: 'match:ended',
      matchId,
      reason,
    });
  }
}

let retryMatchTimeout: NodeJS.Timeout | null = null;

function attemptMatchmaking() {
  if (retryMatchTimeout) {
    clearTimeout(retryMatchTimeout);
    retryMatchTimeout = null;
  }

  // Clean up any stale or disconnected users in the queue first
  for (let i = matchmakingQueue.length - 1; i >= 0; i--) {
    const entry = matchmakingQueue[i];
    const sess = userSessions.get(entry.sessionId);
    if (
      !sess ||
      sess.ws.readyState !== WebSocket.OPEN ||
      sess.status !== 'searching' ||
      sess.currentMatchId !== null
    ) {
      matchmakingQueue.splice(i, 1);
    }
  }

  if (matchmakingQueue.length < 2) return;

  let hasPendingCooldown = false;
  let i = 0;
  while (i < matchmakingQueue.length) {
    const candidateA = matchmakingQueue[i];
    const sessionA = userSessions.get(candidateA.sessionId);

    if (!sessionA || sessionA.status !== 'searching' || sessionA.currentMatchId) {
      matchmakingQueue.splice(i, 1);
      continue;
    }

    let matchedIndex = -1;
    for (let j = i + 1; j < matchmakingQueue.length; j++) {
      const candidateB = matchmakingQueue[j];
      const sessionB = userSessions.get(candidateB.sessionId);

      if (!sessionB || sessionB.status !== 'searching' || sessionB.currentMatchId) {
        continue;
      }

      // Check if blocked
      if (isBlockedBetween(candidateA.sessionId, candidateB.sessionId)) {
        continue;
      }

      // Check if recent pair cooldown applies
      if (wasRecentlyMatched(candidateA.sessionId, candidateB.sessionId)) {
        hasPendingCooldown = true;
        continue;
      }

      matchedIndex = j;
      break;
    }

    if (matchedIndex !== -1) {
      const entryB = matchmakingQueue.splice(matchedIndex, 1)[0];
      const entryA = matchmakingQueue.splice(i, 1)[0];

      const sessA = userSessions.get(entryA.sessionId);
      const sessB = userSessions.get(entryB.sessionId);

      if (sessA && sessB) {
        const matchId = crypto.randomUUID();
        const matchRecord: MatchRecord = {
          matchId,
          userA: sessA.sessionId,
          userB: sessB.sessionId,
          status: 'matched',
          createdAt: Date.now(),
        };
        matches.set(matchId, matchRecord);

        sessA.currentMatchId = matchId;
        sessA.status = 'matched';
        sessB.currentMatchId = matchId;
        sessB.status = 'matched';

        // Notify both participants; userA is designated polite/initiator for WebRTC offer
        sendToClient(sessA.ws, {
          type: 'match:found',
          matchId,
          peerId: sessB.sessionId,
          initiator: true,
        });

        sendToClient(sessB.ws, {
          type: 'match:found',
          matchId,
          peerId: sessA.sessionId,
          initiator: false,
        });
      }
    } else {
      i++;
    }
  }

  if (hasPendingCooldown && matchmakingQueue.length >= 2) {
    retryMatchTimeout = setTimeout(() => {
      attemptMatchmaking();
    }, 1500);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  function getIceServersConfig() {
    const iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }> = [
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

    const turnUrl = process.env.TURN_URL || process.env.VITE_TURN_URL;
    const turnUsername = process.env.TURN_USERNAME || process.env.VITE_TURN_USERNAME;
    const turnCredential = process.env.TURN_CREDENTIAL || process.env.VITE_TURN_CREDENTIAL;

    if (turnUrl) {
      const urls = turnUrl.includes(',')
        ? turnUrl.split(',').map((s) => s.trim()).filter(Boolean)
        : turnUrl.trim();
      iceServers.push({
        urls,
        ...(turnUsername ? { username: turnUsername.trim() } : {}),
        ...(turnCredential ? { credential: turnCredential.trim() } : {}),
      });

      // Secondary backup TURN relay servers in case custom VPS is restarting or firewall has UDP issues
      iceServers.push({
        urls: [
          'turn:openrelay.metered.ca:80',
          'turn:openrelay.metered.ca:443',
          'turn:openrelay.metered.ca:443?transport=tcp',
        ],
        username: 'openrelayproject',
        credential: 'openrelayproject',
      });
    } else {
      // Default fallback open TURN relay servers for peer-to-peer across NAT and mobile carrier networks
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

  // REST endpoint for runtime ICE servers (STUN & TURN)
  app.get('/api/webrtc/ice-servers', (_req, res) => {
    res.json({
      ok: true,
      iceServers: getIceServersConfig(),
    });
  });

  // REST endpoint for real-time online user count with maximum precision
  app.get('/api/online-count', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json({
      ok: true,
      count: userSessions.size,
    });
  });

  // REST endpoint for backend status & diagnostics
  app.get('/api/status', (_req, res) => {
    const supabaseConfigured = Boolean(
      process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
    );
    res.json({
      ok: true,
      mode: supabaseConfigured ? 'supabase+websocket' : 'websocket-native',
      supabaseConfigured,
      activeSessions: userSessions.size,
      queueSize: matchmakingQueue.length,
    });
  });

  // Server-validated block & report endpoint
  app.post('/api/safety/report', (req, res) => {
    const { sessionId, matchId, reason, blockPeer } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      res.status(400).json({ error: 'Invalid session ID' });
      return;
    }

    const match = matchId ? matches.get(matchId) : undefined;
    let peerId: string | null = null;
    if (match && (match.userA === sessionId || match.userB === sessionId)) {
      peerId = match.userA === sessionId ? match.userB : match.userA;
    }

    if (peerId) {
      reportRecords.push({
        id: crypto.randomUUID(),
        reporterSessionId: sessionId,
        reportedSessionId: peerId,
        matchId: matchId || null,
        reason: typeof reason === 'string' && reason.trim() ? reason.trim() : 'Inappropriate behavior',
        createdAt: Date.now(),
      });

      if (blockPeer !== false) {
        blockRecords.push({
          id: crypto.randomUUID(),
          blockerSessionId: sessionId,
          blockedSessionId: peerId,
          createdAt: Date.now(),
        });
      }

      terminateActiveMatchForUser(sessionId, 'blocked');
    }

    res.json({ ok: true, blocked: Boolean(peerId) });
  });

  // WebSocket Signaling & Matchmaking Engine
  wss.on('connection', (ws: WebSocket) => {
    const sessionId = crypto.randomUUID();
    const session: UserSession = {
      sessionId,
      ws,
      status: 'idle',
      currentMatchId: null,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    };

    userSessions.set(sessionId, session);

    sendToClient(ws, {
      type: 'session:init',
      sessionId,
      iceServers: getIceServersConfig(),
      onlineCount: userSessions.size,
    });

    broadcastUserCount();

    ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        session.lastSeenAt = Date.now();

        switch (msg.type) {
          case 'queue:join': {
            // If currently in a match, end it cleanly before joining the queue
            if (session.currentMatchId) {
              terminateActiveMatchForUser(sessionId, 'peer-skipped');
            }
            // Prevent duplicate queue entries
            removeFromQueue(sessionId);
            session.status = 'searching';
            matchmakingQueue.push({
              sessionId,
              joinedAt: Date.now(),
            });
            sendToClient(ws, { type: 'queue:joined' });
            attemptMatchmaking();
            break;
          }

          case 'queue:leave': {
            removeFromQueue(sessionId);
            if (!session.currentMatchId) {
              session.status = 'idle';
            }
            sendToClient(ws, { type: 'queue:left' });
            break;
          }

          case 'match:leave': {
            removeFromQueue(sessionId);
            if (session.currentMatchId) {
              terminateActiveMatchForUser(sessionId, 'peer-left');
            }
            session.status = 'idle';
            sendToClient(ws, { type: 'match:left' });
            break;
          }

          case 'match:skip': {
            // On Next: release previous match and find another eligible user
            if (session.currentMatchId) {
              terminateActiveMatchForUser(sessionId, 'peer-skipped');
            }
            removeFromQueue(sessionId);
            session.status = 'searching';
            matchmakingQueue.push({
              sessionId,
              joinedAt: Date.now(),
            });
            sendToClient(ws, { type: 'queue:joined' });
            attemptMatchmaking();
            break;
          }

          case 'signal:message': {
            const { matchId, signalType, payload } = msg;
            if (!matchId || typeof matchId !== 'string') return;

            const match = matches.get(matchId);
            // Server-side authorization check: Ensure only participants in an active match can exchange its signaling messages
            if (
              !match ||
              match.status === 'ended' ||
              (match.userA !== sessionId && match.userB !== sessionId) ||
              session.currentMatchId !== matchId
            ) {
              sendToClient(ws, {
                type: 'signal:error',
                error: 'Unauthorized or stale match signaling message rejected.',
              });
              return;
            }

            const receiverId = match.userA === sessionId ? match.userB : match.userA;
            const receiverSession = userSessions.get(receiverId);

            if (!receiverSession || receiverSession.currentMatchId !== matchId) {
              terminateActiveMatchForUser(sessionId, 'peer-disconnected');
              return;
            }

            if (signalType === 'offer' || signalType === 'answer') {
              match.status = 'connecting';
              session.status = 'connecting';
            } else if (signalType === 'connected') {
              match.status = 'connected';
              session.status = 'connected';
            }

            // Record temporary signaling message
            signalingMessages.push({
              id: crypto.randomUUID(),
              matchId,
              senderId: sessionId,
              receiverId,
              type: signalType,
              payload,
              createdAt: Date.now(),
            });

            sendToClient(receiverSession.ws, {
              type: 'signal:message',
              matchId,
              senderId: sessionId,
              signalType,
              payload,
            });
            break;
          }

          case 'match:block_and_report': {
            const { matchId, reason } = msg;
            const match = matchId ? matches.get(matchId) : undefined;
            if (match && (match.userA === sessionId || match.userB === sessionId)) {
              const peerId = match.userA === sessionId ? match.userB : match.userA;
              blockRecords.push({
                id: crypto.randomUUID(),
                blockerSessionId: sessionId,
                blockedSessionId: peerId,
                createdAt: Date.now(),
              });
              reportRecords.push({
                id: crypto.randomUUID(),
                reporterSessionId: sessionId,
                reportedSessionId: peerId,
                matchId,
                reason: reason || 'Reported by user',
                createdAt: Date.now(),
              });
              terminateActiveMatchForUser(sessionId, 'blocked');
            }
            removeFromQueue(sessionId);
            session.status = 'idle';
            sendToClient(ws, { type: 'safety:blocked' });
            break;
          }

          case 'ping': {
            sendToClient(ws, { type: 'pong' });
            break;
          }
        }
      } catch (err) {
        console.error('Error processing WebSocket message:', err);
      }
    });

    ws.on('close', () => {
      removeFromQueue(sessionId);
      if (session.currentMatchId) {
        terminateActiveMatchForUser(sessionId, 'peer-disconnected');
      }
      userSessions.delete(sessionId);
      broadcastUserCount();
    });

    ws.on('error', () => {
      removeFromQueue(sessionId);
      if (session.currentMatchId) {
        terminateActiveMatchForUser(sessionId, 'peer-disconnected');
      }
      userSessions.delete(sessionId);
      broadcastUserCount();
    });
  });

  // Prune dead or unacknowledged sockets every 10 seconds for maximum user count accuracy
  setInterval(() => {
    let changed = false;
    const now = Date.now();
    for (const [id, s] of userSessions.entries()) {
      if (s.ws.readyState !== WebSocket.OPEN || now - s.lastSeenAt > 50000) {
        try {
          s.ws.terminate();
        } catch {
          // Ignore terminate errors
        }
        removeFromQueue(id);
        if (s.currentMatchId) {
          terminateActiveMatchForUser(id, 'peer-disconnected');
        }
        userSessions.delete(id);
        changed = true;
      }
    }
    if (changed) {
      broadcastUserCount();
    }
  }, 10000);

  app.set('trust proxy', 1);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Vimo signaling & web server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
