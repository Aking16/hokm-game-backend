import express from 'express';
import http from 'http';
import cors from 'cors';
import { Server as SocketIOServer } from 'socket.io';
import { HokmRoomManager } from './game/hokm-room';
import { roomsRouter } from './routes/rooms';
import { gameRouter } from './routes/game';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const PORT = 3000;
const roomManager = new HokmRoomManager(io);

io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  socket.on('create-room', ({ playerName }) => {
    const roomId = roomManager.createRoom(socket.id, playerName);
    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  socket.on('join-room', ({ roomId, playerName }) => {
    const success = roomManager.joinRoom(roomId, socket, playerName);
    if (!success) {
      socket.emit('error', 'Unable to join room');
      return;
    }
  });

  socket.on('play-card', (data) => {
    roomManager.handlePlayCard(socket.id, data);
  });

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

// Middleware to give routes access to io and roomManager
app.use((req, res, next) => {
  (req as any).io = io;
  (req as any).roomManager = roomManager;
  next();
});

// JSON body parsing
app.use(express.json());

// Mount the rooms router under /api
app.use('/api/room', roomsRouter);
app.use('/api/game', gameRouter);

server.listen(PORT, () => {
  console.log(`🚀 Hokm server running at http://localhost:${PORT}`);
});