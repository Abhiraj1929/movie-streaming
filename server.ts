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
const socketToRoom = new Map<string, string>();
const socketToParticipant = new Map<string, Participant>();

const MAX_ROOMS = 100;
const MAX_MESSAGE_LENGTH = 500;
const MAX_DISPLAY_NAME_LENGTH = 30;
const ROOM_EMPTY_TTL_MS = 5 * 60 * 1000;
const ROOM_MAX_AGE_MS = 4 * 60 * 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 10000;
const RATE_LIMIT_MAX = 30;

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
  return input.replace(/[<>"&]/g, '').trim().substring(0, maxLength);
}

function handleLeaveRoom(socketId: string, io: SocketIOServer): void {
  const roomId = socketToRoom.get(socketId);
  const participant = socketToParticipant.get(socketId);
  if (!roomId || !participant) return;

  const room = rooms.get(roomId);
  if (!room) return;

  room.participants = room.participants.filter((p) => p.id !== socketId);

  const systemMessage: ChatMessage = {
    id: uuidv4(),
    senderId: 'system',
    senderName: 'System',
    content: `${participant.displayName} left the party`,
    timestamp: new Date(),
    type: 'system',
  };
  io.to(roomId).emit('chat-message-received', systemMessage);

  if (participant.isHost && room.participants.length > 0) {
    const newHost = room.participants[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
    io.to(newHost.id).emit('participant-updated', newHost);
  }

  io.to(roomId).emit('participant-left', socketId);

  if (room.participants.length === 0) {
    room.emptySince = Date.now();
  }

  socketToRoom.delete(socketId);
  socketToParticipant.delete(socketId);
  rateLimitMap.delete(socketId);
}

function cleanupRooms() {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    if (room.participants.length === 0) {
      if (room.emptySince && now - room.emptySince > ROOM_EMPTY_TTL_MS) {
        rooms.delete(roomId);
      }
    } else if (now - new Date(room.createdAt).getTime() > ROOM_MAX_AGE_MS) {
      const io = (app as any)._io as SocketIOServer | undefined;
      if (io) {
        io.to(roomId).emit('room-error', { message: 'Room expired after 4 hours' });
        for (const p of room.participants) {
          io.sockets.sockets.get(p.id)?.leave(roomId);
          socketToRoom.delete(p.id);
          socketToParticipant.delete(p.id);
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

    socket.on('create-room', ({ displayName }) => {
      if (isRateLimited(socket.id)) return;
      if (!displayName || typeof displayName !== 'string') {
        return socket.emit('room-error', { message: 'Display name is required' });
      }
      const sanitizedName = sanitizeInput(displayName, MAX_DISPLAY_NAME_LENGTH);
      if (!sanitizedName) {
        return socket.emit('room-error', { message: 'Invalid display name' });
      }

      const roomId = generateRoomId();
      const participant: Participant = {
        id: socket.id,
        displayName: sanitizedName,
        isHost: true,
        isMuted: false,
        hasVideo: true,
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
      socketToParticipant.set(socket.id, participant);

      socket.join(roomId);
      console.log(`Room ${roomId} created by ${sanitizedName}`);
      socket.emit('room-created', { roomId, participant });
    });

    socket.on('join-room', ({ roomId, displayName }) => {
      if (isRateLimited(socket.id)) return;
      if (!roomId || typeof roomId !== 'string' || !displayName || typeof displayName !== 'string') {
        return socket.emit('room-error', { message: 'Room ID and display name are required' });
      }
      const normalizedRoomId = sanitizeInput(roomId.toUpperCase(), 6);
      const sanitizedName = sanitizeInput(displayName, MAX_DISPLAY_NAME_LENGTH);
      if (!sanitizedName) {
        return socket.emit('room-error', { message: 'Invalid display name' });
      }

      const room = rooms.get(normalizedRoomId);
      if (!room) {
        return socket.emit('room-error', { message: 'Room not found' });
      }
      if (room.participants.length >= 6) {
        return socket.emit('room-error', { message: 'Room is full (max 6 participants)' });
      }

      const participant: Participant = {
        id: socket.id,
        displayName: sanitizedName,
        isHost: false,
        isMuted: false,
        hasVideo: true,
        joinedAt: new Date(),
      };

      room.participants.push(participant);
      socketToRoom.set(socket.id, normalizedRoomId);
      socketToParticipant.set(socket.id, participant);

      socket.join(normalizedRoomId);

      socket.emit('room-joined', {
        room: { ...room },
        participant,
        participants: room.participants,
      });

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

    socket.on('leave-room', () => {
      handleLeaveRoom(socket.id, io);
    });

    socket.on('video-state-change', (state: Partial<VideoState>) => {
      console.log(`[SERVER] video-state-change from ${socket.id}:`, JSON.stringify({ videoSrc: state.videoSrc?.substring(0, 80), isPlaying: state.isPlaying }));
      if (isRateLimited(socket.id)) return;
      const roomId = socketToRoom.get(socket.id);
      const participant = socketToParticipant.get(socket.id);
      if (!roomId || !participant?.isHost) return;

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

    socket.on('chat-message', (content: string) => {
      if (isRateLimited(socket.id)) return;
      const roomId = socketToRoom.get(socket.id);
      const participant = socketToParticipant.get(socket.id);
      if (!roomId || !participant) return;

      if (!content || typeof content !== 'string') return;
      const sanitized = sanitizeInput(content, MAX_MESSAGE_LENGTH);
      if (!sanitized) return;

      const message: ChatMessage = {
        id: uuidv4(),
        senderId: socket.id,
        senderName: participant.displayName,
        content: sanitized,
        timestamp: new Date(),
        type: 'message',
      };

      io.to(roomId).emit('chat-message-received', message);
    });

    socket.on('mute-status', (isMuted: boolean) => {
      if (isRateLimited(socket.id)) return;
      if (typeof isMuted !== 'boolean') return;
      const roomId = socketToRoom.get(socket.id);
      const participant = socketToParticipant.get(socket.id);
      if (!roomId || !participant) return;

      participant.isMuted = isMuted;
      const room = rooms.get(roomId);
      if (room) {
        const p = room.participants.find((pp) => pp.id === socket.id);
        if (p) p.isMuted = isMuted;
      }
      io.to(roomId).emit('participant-updated', participant);
    });

    socket.on('video-status', (hasVideo: boolean) => {
      if (isRateLimited(socket.id)) return;
      if (typeof hasVideo !== 'boolean') return;
      const roomId = socketToRoom.get(socket.id);
      const participant = socketToParticipant.get(socket.id);
      if (!roomId || !participant) return;

      participant.hasVideo = hasVideo;
      const room = rooms.get(roomId);
      if (room) {
        const p = room.participants.find((pp) => pp.id === socket.id);
        if (p) p.hasVideo = hasVideo;
      }
      io.to(roomId).emit('participant-updated', participant);
    });

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

    socket.on('disconnect', () => {
      handleLeaveRoom(socket.id, io);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
