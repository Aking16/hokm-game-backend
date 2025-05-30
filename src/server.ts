import express from 'express';
import http from 'http';
import { Server, Socket } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;

// Types
interface Room {
  players: string[];
  gameState: any; // Replace with detailed game state later
}

const rooms: Record<string, Room> = {};

io.on('connection', (socket: Socket) => {
  console.log(`Player connected: ${socket.id}`);

  socket.on('create-room', (roomId: string) => {
    if (rooms[roomId]) {
      socket.emit('error', 'Room already exists');
      return;
    }

    rooms[roomId] = {
      players: [socket.id],
      gameState: {} // Later: init deck, player hands, turn, etc.
    };

    socket.join(roomId);
    socket.emit('room-created', roomId);
    console.log(`Room ${roomId} created`);
  });

  socket.on('join-room', (roomId: string) => {
    const room = rooms[roomId];
    if (!room || room.players.length >= 4) {
      socket.emit('error', 'Room full or not found');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.emit('room-joined', roomId);
    io.to(roomId).emit('player-joined', socket.id);

    if (room.players.length === 4) {
      io.to(roomId).emit('start-game', room.players);
      // Later: shuffle & deal cards
    }
  });

  socket.on('play-card', ({ roomId, card }: { roomId: string; card: string; }) => {
    console.log(`Card played in ${roomId} by ${socket.id}: ${card}`);
    io.to(roomId).emit('card-played', { player: socket.id, card });
    // TODO: Validate turn, manage game state
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const index = room.players.indexOf(socket.id);
      if (index !== -1) {
        room.players.splice(index, 1);
        io.to(roomId).emit('player-left', socket.id);
        if (room.players.length === 0) {
          delete rooms[roomId];
          console.log(`Room ${roomId} deleted`);
        }
        break;
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Hokm backend running at http://localhost:${PORT}`);
});