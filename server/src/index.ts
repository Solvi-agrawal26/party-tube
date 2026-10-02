import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import { Server } from 'socket.io';
import { config } from './config';
import { initDatabase } from './db/database';
import { RoomRepository, ChatRepository } from './db/repository';
import { RoomManager } from './services/RoomManager';
import { MessageHandler } from './services/MessageHandler';
import { ClientToServerEvents, ServerToClientEvents } from './types';
import { nanoid } from 'nanoid';

async function bootstrap() {
  // 1. Initialize SQLite Database
  await initDatabase();

  const app = express();
  const server = http.createServer(app);

  // 2. Setup Middleware
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json());

  // 3. Initialize Socket.IO
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    cors: {
      origin: config.clientOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  // 4. Optional Redis Adapter for horizontal scaling
  if (config.redisUrl) {
    try {
      const { createAdapter } = await import('@socket.io/redis-adapter');
      const { default: Redis } = await import('ioredis');
      const pubClient = new Redis(config.redisUrl);
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log(`[Scaling] Socket.IO Redis adapter enabled via ${config.redisUrl}`);
    } catch (err: any) {
      console.warn(`[Scaling] Could not connect Redis adapter, falling back to in-memory:`, err.message);
    }
  } else {
    console.log('[Scaling] Running in standalone single-node mode (in-memory adapter)');
  }

  // 5. Register WebSocket Message Handler
  const messageHandler = new MessageHandler(io);
  io.on('connection', (socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);
    messageHandler.registerEvents(socket);
  });

  // 6. REST API Endpoints
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  });

  // Get active public rooms for community lobby
  app.get('/api/rooms/public', async (_req, res) => {
    try {
      const publicRooms = await RoomManager.getInstance().getPublicRooms();
      res.json({ rooms: publicRooms });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch public rooms' });
    }
  });

  app.post('/api/rooms', async (req, res) => {
    try {
      const { name, roomId, roomType, description, category, videoId } = req.body;
      const prefix = roomType === 'public' ? 'COMMUNITY' : 'PARTY';
      const id = (roomId || `${prefix}-${nanoid(6)}`).toUpperCase();
      const room = await RoomManager.getInstance().getOrCreateRoom(
        id,
        name || (roomType === 'public' ? 'Public Community Lounge' : 'Watch Party'),
        undefined,
        roomType || 'private',
        description || '',
        category || 'General',
        videoId
      );
      if (room.roomType === 'public') {
        await RoomManager.getInstance().broadcastPublicRooms(io);
      }

      res.status(201).json({
        roomId: room.id,
        name: room.name,
        roomType: room.roomType,
        description: room.description,
        category: room.category,
        videoId: room.videoId,
        currentTime: room.currentTime,
        playState: room.playState,
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create room' });
    }
  });

  app.get('/api/rooms/:id', async (req, res) => {
    try {
      const roomId = req.params.id.toUpperCase();
      const room = RoomManager.getInstance().getRoom(roomId);
      if (room) {
        res.json({
          roomId: room.id,
          name: room.name,
          roomType: room.roomType,
          description: room.description,
          category: room.category,
          videoId: room.videoId,
          currentTime: room.getEstimatedCurrentTime(),
          playState: room.playState,
          participantsCount: room.getParticipantCount(),
        });
        return;
      }

      const dbRecord = await RoomRepository.findById(roomId);
      if (dbRecord) {
        res.json({
          roomId: dbRecord.id,
          name: dbRecord.name,
          roomType: dbRecord.room_type || 'private',
          description: dbRecord.description || '',
          category: dbRecord.category || 'General',
          videoId: dbRecord.video_id,
          currentTime: dbRecord.current_time,
          playState: dbRecord.play_state,
          participantsCount: 0,
        });
        return;
      }

      res.status(404).json({ error: 'Room not found' });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch room' });
    }
  });

  app.get('/api/rooms/:id/messages', async (req, res) => {
    try {
      const roomId = req.params.id.toUpperCase();
      const messages = await ChatRepository.getRecentMessages(roomId, 50);
      res.json({ messages });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to fetch messages' });
    }
  });

  // 7. Serve Static Files in Production (Express serves built Vite bundle)
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    console.log(`[Static] Serving client assets from ${clientDistPath}`);
    app.use(express.static(clientDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>PartyTube Server is Running 🚀</h2>
          <p>Status: Healthy | Port: ${config.port}</p>
          <p>Client build not detected at <code>${clientDistPath}</code>. Run client in Vite dev mode or execute <code>npm run build</code>.</p>
        </div>
      `);
    });
  }

  // 8. Start HTTP + WS Server
  server.listen(config.port, () => {
    console.log(`[Server] PartyTube listening on http://localhost:${config.port}`);
  });
}

bootstrap().catch((err) => {
  console.error('[Fatal] Server failed to start:', err);
  process.exit(1);
});
