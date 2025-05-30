// routes/rooms.ts
import { Router, Request } from 'express';
import { Room, Player } from '../game/types';
import { v4 as uuidv4 } from 'uuid';
import type { Server as SocketIOServer } from 'socket.io';

// Augment Express Request to include io
interface RequestWithIO extends Request {
  io: import('socket.io').Server;
}

export const roomsRouter = Router();

// In-memory store of rooms (for example purposes; a real app might use a database)
const rooms: Map<string, Room> = new Map();

// DTO for creating a room
interface CreateRoomBody { playerName: string; }

roomsRouter.post('/rooms', (req, res) => {
  const { playerName } = req.body;
  const roomId = uuidv4();
  const hostPlayer: Player = { id: uuidv4(), name: playerName, team: 1 };

  const room: Room = {
    id: roomId,
    players: [hostPlayer],
    hostId: hostPlayer.id,
    status: 'waiting',
  };
  rooms.set(roomId, room);

  res.status(201).json(room);
});

// DTO for joining a room
interface JoinRoomBody { playerName: string; }

roomsRouter.post('/rooms/:roomId/join', (req, res) => {
  const roomId = req.params.roomId;
  const room = rooms.get(roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  if (room.players.length >= 4) {
    res.status(400).json({ error: 'Room is full' });
    return;
  }

  const newPlayer: Player = {
    id: uuidv4(),
    name: req.body.playerName,
    team: ((room.players.length % 2) + 1) as 1 | 2  // alternate team 1/2
  };
  room.players.push(newPlayer);
  if (room.players.length === 4) room.status = 'playing';

  // Emit a Socket.IO event to this room notifying others
  (req as unknown as RequestWithIO).io.in(roomId).emit('player_joined', newPlayer, room.players);

  res.json(room);
});

roomsRouter.get('/rooms/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(room);
});

// DTO for leaving (could include playerId or name)
interface LeaveRoomBody { playerId: string; }

roomsRouter.post('/rooms/:roomId/leave', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const idx = room.players.findIndex(p => p.id === req.body.playerId);
  if (idx === -1) {
    res.status(400).json({ error: 'Player not in room' });
    return;
  }

  const [leaving] = room.players.splice(idx, 1);
  if (room.players.length === 0) {
    rooms.delete(room.id); // room is empty, delete it
    res.json({ message: 'Room closed' });
    return;
  }
  if (leaving.id === room.hostId) {
    room.hostId = room.players[0].id;
  }
  room.status = 'waiting';

  (req as unknown as RequestWithIO).io.in(room.id).emit('player_left', leaving.id, room.players);
  res.json(room);
});
