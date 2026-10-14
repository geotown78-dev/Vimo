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

function attemptMatchmaking() {
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

      // Never match a user with themselves or with a blocked peer
      if (
        candidateA.sessionId !== candidateB.sessionId &&
        !isBlockedBetween(candidateA.sessionId, candidateB.sessionId)
      ) {
        matchedIndex = j;
        break;
      }
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
}

async function startServer() {
  const app = express();
  app.use(express.json());

  const httpServer = createServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

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
    });

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
    });

    ws.on('error', () => {
      removeFromQueue(sessionId);
      if (session.currentMatchId) {
        terminateActiveMatchForUser(sessionId, 'peer-disconnected');
      }
      userSessions.delete(sessionId);
    });
  });

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
