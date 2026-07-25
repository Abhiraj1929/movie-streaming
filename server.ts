import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { Room, Participant, VideoState, ChatMessage } from './server-types';

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `http://localhost:${port}`).split(',');

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const rooms = new Map<string, Room>();
const socketToRoom = new Map<string, string>();             // socketId -> roomId
const socketToUserId = new Map<string, string>();            // socketId -> persistent userId
const userIdToData = new Map<string, {                      // userId -> user record
  roomId: string;
  participant: Participant;
  graceTimer?: NodeJS.Timeout;
}>();

const MAX_ROOMS = 100;
const MAX_MESSAGE_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 30;
const ROOM_EMPTY_TTL_MS = 5 * 60 * 1000;
const ROOM_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10000;
const RATE_LIMIT_MAX = 30;
const RECONNECT_GRACE_MS = 120_000;                         // 2-minute grace period

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(socketId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(socketId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(socketId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function sanitizeInput(input: string, maxLength: number): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>"&]/g, '').trim().substring(0, maxLength);
}

function findParticipantInRoom(room: Room, userId: string): Participant | undefined {
  return room.participants.find((p) => p.userId === userId);
}

/** Clean up all server-side state for a user (leave + cancel timer). */
function removeUserFromServer(userId: string, io?: SocketIOServer): void {
  const record = userIdToData.get(userId);
  if (!record) return;

  if (record.graceTimer) {
    clearTimeout(record.graceTimer);
    record.graceTimer = undefined;
  }

  // Clean socket-level maps for any socket.id this user may have held
  // We scan socketToUserId (max 6 users per room, so cheap)
  for (const [sid, uid] of socketToUserId) {
    if (uid === userId) {
      socketToRoom.delete(sid);
      socketToUserId.delete(sid);
      rateLimitMap.delete(sid);
      if (io) {
        const sock = io.sockets.sockets.get(sid);
        if (sock) {
          sock.leave(record.roomId);
        }
      }
    }
  }

  userIdToData.delete(userId);
}

/** Remove a participant from a room, handling host transfer and room cleanup. */
function removeParticipantFromRoom(roomId: string, userId: string, io: SocketIOServer, notify = true): void {
  const room = rooms.get(roomId);
  if (!room) return;

  const record = userIdToData.get(userId);
  const leftParticipant = record?.participant || findParticipantInRoom(room, userId);
  if (!leftParticipant) return;

  const displayName = leftParticipant.displayName;
  const wasHost = leftParticipant.isHost;

  // Remove from room's participant list
  room.participants = room.participants.filter((p) => p.userId !== userId);

  // System message
  if (notify) {
    const systemMessage: ChatMessage = {
      id: uuidv4(),
      senderId: 'system',
      senderName: 'System',
      content: `${displayName} left the party`,
      timestamp: new Date(),
      type: 'system',
    };
    io.to(roomId).emit('chat-message-received', systemMessage);
  }

  // Host transfer: assign host to the oldest remaining participant
  if (wasHost && room.participants.length > 0) {
    const newHost = room.participants[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    io.to(roomId).emit('participant-updated', newHost);
  }

  // Notify remaining participants (send userId, not socket.id, for matching)
  if (notify) {
    io.to(roomId).emit('participant-left', userId);
  }

  // Schedule room cleanup if empty
  if (room.participants.length === 0) {
    room.emptySince = Date.now();
  }

  // Remove server-side user state
  removeUserFromServer(userId, io);
}

function cleanupRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (room.participants.length === 0) {
      if (room.emptySince && now - room.emptySince > ROOM_EMPTY_TTL_MS) {
        // Clean up any lingering userId entries for this room
        for (const [uid, data] of userIdToData) {
          if (data.roomId === roomId) removeUserFromServer(uid);
        }
        rooms.delete(roomId);
      }
    } else if (now - new Date(room.createdAt).getTime() > ROOM_MAX_AGE_MS) {
      const io = (app as any)._io as SocketIOServer | undefined;
      if (io) {
        io.to(roomId).emit('room-error', { message: 'Room expired after 4 hours' });
        for (const p of room.participants) {
          removeUserFromServer(p.userId, io);
        }
      }
      rooms.delete(roomId);
    }
  }
}

setInterval(cleanupRooms, 60_000);

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(server, {
    cors: {
      origin: ALLOWED_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['polling', 'websocket'],
    allowUpgrades: true,
    perMessageDeflate: false,
    httpCompression: false,
    pingTimeout: 60000,
    pingInterval: 25000,
    maxHttpBufferSize: 10e7,
  });

  (app as any)._io = io;

  io.use((socket, next) => {
    if (rooms.size >= MAX_ROOMS && !socketToRoom.has(socket.id)) {
      return next(new Error('Server is at capacity, try again later'));
    }
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    /* ------------------------------------------------------------------ */
    /*  CREATE ROOM                                                        */
    /* ------------------------------------------------------------------ */
    socket.on('create-room', ({ roomId: customRoomId, userId, displayName }) => {
      if (isRateLimited(socket.id)) return;

      if (!userId || typeof userId !== 'string') {
        return socket.emit('room-error', { message: 'User ID is required' });
      }
      if (!displayName || typeof displayName !== 'string') {
        return socket.emit('room-error', { message: 'Display name is required' });
      }
      const sanitizedName = sanitizeInput(displayName, MAX_DISPLAY_NAME_LENGTH);
      if (!sanitizedName) {
        return socket.emit('room-error', { message: 'Invalid display name' });
      }

      // Determine room ID: use custom if provided and valid, else auto-generate
      let roomId: string;
      if (customRoomId && typeof customRoomId === 'string') {
        const sanitizedRoomId = sanitizeInput(customRoomId.toUpperCase(), 10);
        if (!sanitizedRoomId || sanitizedRoomId.length < 2) {
          return socket.emit('room-error', { message: 'Room name must be at least 2 characters' });
        }
        if (rooms.has(sanitizedRoomId)) {
          return socket.emit('room-error', { message: 'Room name already exists. Please choose another.' });
        }
        roomId = sanitizedRoomId;
      } else {
        roomId = generateRoomId();
      }

      const participant: Participant = {
        id: socket.id,
        userId,
        displayName: sanitizedName,
        isHost: true,
        isMuted: false,
        hasVideo: true,
        disconnected: false,
        joinedAt: new Date(),
      };

      const room: Room = {
        id: roomId,
        hostId: socket.id,
        participants: [participant],
        videoState: {
          isPlaying: false,
          currentTime: 0,
          duration: 0,
          videoSrc: '',
          lastUpdate: Date.now(),
        },
        createdAt: new Date(),
      };

      rooms.set(roomId, room);
      socketToRoom.set(socket.id, roomId);
      socketToUserId.set(socket.id, userId);
      userIdToData.set(userId, { roomId, participant });

      socket.join(roomId);
      console.log(`Room ${roomId} created by ${sanitizedName} (userId: ${userId})`);
      socket.emit('room-created', {
        room: { ...room },
        participant,
        participants: room.participants,
      });
    });

    /* ------------------------------------------------------------------ */
    /*  JOIN ROOM (also handles reconnection during grace period)          */
    /* ------------------------------------------------------------------ */
    socket.on('join-room', ({ roomId, displayName, userId }) => {
      if (isRateLimited(socket.id)) return;

      if (!roomId || typeof roomId !== 'string' || !displayName || typeof displayName !== 'string') {
        return socket.emit('room-error', { message: 'Room ID and display name are required' });
      }
      if (!userId || typeof userId !== 'string') {
        return socket.emit('room-error', { message: 'User ID is required' });
      }
      const normalizedRoomId = sanitizeInput(roomId.toUpperCase(), 10);
      const sanitizedName = sanitizeInput(displayName, MAX_DISPLAY_NAME_LENGTH);
      if (!sanitizedName) {
        return socket.emit('room-error', { message: 'Invalid display name' });
      }

      const room = rooms.get(normalizedRoomId);
      if (!room) {
        return socket.emit('room-error', { message: 'Room not found' });
      }

      // Check if this userId already exists in this room (reconnection during grace period)
      const existingRecord = userIdToData.get(userId);
      const existingInRoom = existingRecord && existingRecord.roomId === normalizedRoomId;

      if (existingInRoom) {
        // --- RECONNECTION PATH ---
        console.log(`[GRACE] ${sanitizedName} (${userId}) reconnecting to room ${normalizedRoomId}`);

        // Cancel the grace timer
        if (existingRecord.graceTimer) {
          clearTimeout(existingRecord.graceTimer);
          existingRecord.graceTimer = undefined;
        }

        // Clean up old socket mappings
        for (const [sid, uid] of socketToUserId) {
          if (uid === userId) {
            const oldSock = io.sockets.sockets.get(sid);
            if (oldSock) oldSock.leave(normalizedRoomId);
            socketToRoom.delete(sid);
            socketToUserId.delete(sid);
            rateLimitMap.delete(sid);
          }
        }

        // Update participant's socket.id to the new socket
        const participant = existingRecord.participant;
        participant.id = socket.id;
        participant.disconnected = false;

        // Update room participant list in-place (same object reference)
        room.participants = room.participants.map((p) =>
          p.userId === userId ? participant : p
        );

        // Update maps
        socketToRoom.set(socket.id, normalizedRoomId);
        socketToUserId.set(socket.id, userId);

        socket.join(normalizedRoomId);

        // Notify others that this participant is back
        io.to(normalizedRoomId).emit('participant-updated', participant);

        // Send reconnecting user the current room state + videoState so they catch up instantly
        socket.emit('room-joined', {
          room: { ...room, participants: room.participants },
          participant,
          participants: room.participants,
        });

        // Also send the current video state explicitly so the viewer immediately syncs
        socket.emit('video-state-updated', room.videoState);

        console.log(`[GRACE] ${sanitizedName} reconnected successfully`);
        return;
      }

      // --- NORMAL JOIN (new participant) ---
      if (room.participants.length >= 6) {
        return socket.emit('room-error', { message: 'Room is full (max 6 participants)' });
      }

      const participant: Participant = {
        id: socket.id,
        userId,
        displayName: sanitizedName,
        isHost: false,
        isMuted: false,
        hasVideo: true,
        disconnected: false,
        joinedAt: new Date(),
      };

      room.participants.push(participant);
      socketToRoom.set(socket.id, normalizedRoomId);
      socketToUserId.set(socket.id, userId);
      userIdToData.set(userId, { roomId: normalizedRoomId, participant });

      socket.join(normalizedRoomId);

      socket.emit('room-joined', {
        room: { ...room },
        participant,
        participants: room.participants,
      });

      // Broadcast new participant to existing members
      socket.to(normalizedRoomId).emit('participant-joined', participant);

      const systemMessage: ChatMessage = {
        id: uuidv4(),
        senderId: 'system',
        senderName: 'System',
        content: `${sanitizedName} joined the party`,
        timestamp: new Date(),
        type: 'system',
      };
      io.to(normalizedRoomId).emit('chat-message-received', systemMessage);
    });

    /* ------------------------------------------------------------------ */
    /*  EXPLICIT LEAVE                                                     */
    /* ------------------------------------------------------------------ */
    socket.on('leave-room', () => {
      const userId = socketToUserId.get(socket.id);
      const roomId = socketToRoom.get(socket.id);
      if (userId && roomId) {
        removeParticipantFromRoom(roomId, userId, io, true);
      }
    });

    /* ------------------------------------------------------------------ */
    /*  DISCONNECT (grace period starts here)                              */
    /* ------------------------------------------------------------------ */
    socket.on('disconnect', () => {
      const userId = socketToUserId.get(socket.id);
      const roomId = socketToRoom.get(socket.id);

      console.log(`Client disconnected: ${socket.id} (userId: ${userId || 'unknown'})`);

      if (!userId || !roomId) return;

      const record = userIdToData.get(userId);
      if (!record) return;

      const room = rooms.get(roomId);
      if (!room) return;

      // Mark participant as disconnected and notify room
      record.participant.disconnected = true;
      io.to(roomId).emit('participant-updated', record.participant);

      // Start the 2-minute grace period
      record.graceTimer = setTimeout(() => {
        console.log(`[GRACE] Timer expired for ${record.participant.displayName} (${userId}) — removing from room ${roomId}`);

        // Check if the user is still disconnected (they might have reconnected and timer was cleared)
        const currentRecord = userIdToData.get(userId);
        if (!currentRecord || currentRecord.graceTimer === undefined) {
          // Timer was already cleared (reconnected) — do nothing
          return;
        }

        removeParticipantFromRoom(roomId, userId, io, true);
      }, RECONNECT_GRACE_MS);

      // Clean up socket-level maps early (they'll be recreated on reconnect)
      socketToRoom.delete(socket.id);
      socketToUserId.delete(socket.id);
      rateLimitMap.delete(socket.id);
    });

    /* ------------------------------------------------------------------ */
    /*  VIDEO STATE CHANGE (host only)                                     */
    /* ------------------------------------------------------------------ */
    socket.on('video-state-change', (state: Partial<VideoState>) => {
      console.log(`[SERVER] video-state-change from ${socket.id}:`, JSON.stringify({ videoSrc: state.videoSrc?.substring(0, 80), isPlaying: state.isPlaying }));
      if (isRateLimited(socket.id)) return;

      const roomId = socketToRoom.get(socket.id);
      const userId = socketToUserId.get(socket.id);
      const record = userId ? userIdToData.get(userId) : undefined;
      if (!roomId || !record?.participant?.isHost) return;

      const room = rooms.get(roomId);
      if (!room) return;

      if (state.videoSrc !== undefined && typeof state.videoSrc !== 'string') return;

      room.videoState = {
        ...room.videoState,
        ...state,
        lastUpdate: Date.now(),
      };

      io.to(roomId).emit('video-state-updated', room.videoState);
    });

    /* ------------------------------------------------------------------ */
    /*  CHAT MESSAGE                                                       */
    /* ------------------------------------------------------------------ */
    socket.on('chat-message', (content: string) => {
      if (isRateLimited(socket.id)) return;
      const roomId = socketToRoom.get(socket.id);
      const userId = socketToUserId.get(socket.id);
      const record = userId ? userIdToData.get(userId) : undefined;
      if (!roomId || !record) return;

      if (!content || typeof content !== 'string') return;
      const sanitized = sanitizeInput(content, MAX_MESSAGE_LENGTH);
      if (!sanitized) return;

      const message: ChatMessage = {
        id: uuidv4(),
        senderId: socket.id,
        senderName: record.participant.displayName,
        content: sanitized,
        timestamp: new Date(),
        type: 'message',
      };

      io.to(roomId).emit('chat-message-received', message);
    });

    /* ------------------------------------------------------------------ */
    /*  MUTE STATUS                                                        */
    /* ------------------------------------------------------------------ */
    socket.on('mute-status', (isMuted: boolean) => {
      if (isRateLimited(socket.id)) return;
      if (typeof isMuted !== 'boolean') return;
      const roomId = socketToRoom.get(socket.id);
      const userId = socketToUserId.get(socket.id);
      const record = userId ? userIdToData.get(userId) : undefined;
      if (!roomId || !record) return;

      record.participant.isMuted = isMuted;
      const room = rooms.get(roomId);
      if (room) {
        const p = room.participants.find((pp) => pp.userId === userId);
        if (p) p.isMuted = isMuted;
      }
      io.to(roomId).emit('participant-updated', record.participant);
    });

    /* ------------------------------------------------------------------ */
    /*  VIDEO STATUS                                                       */
    /* ------------------------------------------------------------------ */
    socket.on('video-status', (hasVideo: boolean) => {
      if (isRateLimited(socket.id)) return;
      if (typeof hasVideo !== 'boolean') return;
      const roomId = socketToRoom.get(socket.id);
      const userId = socketToUserId.get(socket.id);
      const record = userId ? userIdToData.get(userId) : undefined;
      if (!roomId || !record) return;

      record.participant.hasVideo = hasVideo;
      const room = rooms.get(roomId);
      if (room) {
        const p = room.participants.find((pp) => pp.userId === userId);
        if (p) p.hasVideo = hasVideo;
      }
      io.to(roomId).emit('participant-updated', record.participant);
    });

    /* ------------------------------------------------------------------ */
    /*  WEBRTC SIGNALING (unchanged)                                       */
    /* ------------------------------------------------------------------ */
    socket.on('offer', ({ peerId, offer }) => {
      if (!peerId || !offer) return;
      socket.to(peerId).emit('offer-received', { peerId: socket.id, offer });
    });

    socket.on('answer', ({ peerId, answer }) => {
      if (!peerId || !answer) return;
      socket.to(peerId).emit('answer-received', { peerId: socket.id, answer });
    });

    socket.on('ice-candidate', ({ peerId, candidate }) => {
      if (!peerId || !candidate) return;
      socket.to(peerId).emit('ice-candidate-received', { peerId: socket.id, candidate });
    });

    socket.on('peer-ready', (peerId: string) => {
      if (!peerId || typeof peerId !== 'string') return;
      socket.to(peerId).emit('peer-ready-received', socket.id);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
