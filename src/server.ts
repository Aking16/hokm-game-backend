import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { HokmRoomManager } from './game/hokm-room';
import { roomsRouter } from './routes/rooms';

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server);

const PORT = 3000;
const roomManager = new HokmRoomManager(io);

io.on('connection', (socket) => {
  console.log(`🔌 Player connected: ${socket.id}`);

  socket.on('create-room', () => {
    const roomId = roomManager.createRoom(socket.id);
    socket.join(roomId);
    socket.emit('room-created', roomId);
  });

  socket.on('join-room', (roomId: string) => {
    const success = roomManager.joinRoom(roomId, socket);
    if (!success) socket.emit('error', 'Unable to join room');
  });

  socket.on('play-card', (data) => {
    roomManager.handlePlayCard(socket.id, data);
  });

  socket.on('disconnect', () => {
    roomManager.handleDisconnect(socket.id);
  });
});

// Middleware to give routes access to io (TS declaration shown below)
app.use((req, res, next) => { (req as any).io = io; next(); });

// JSON body parsing
app.use(express.json());

// Mount the rooms router under /api
app.use('/api', roomsRouter);

server.listen(PORT, () => {
  console.log(`🚀 Hokm server running at http://localhost:${PORT}`);
});