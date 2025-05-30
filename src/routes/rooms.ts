import { Request, Response, Router } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { HokmRoomManager } from '../game/hokm-room';

// Augment Express Request to include io and roomManager
interface RequestWithIO extends Request {
  io: SocketIOServer;
  roomManager: HokmRoomManager;
}

export const roomsRouter = Router();

// DTO for creating a room
interface CreateRoomBody { playerName: string; }

roomsRouter.post('/', ((req: RequestWithIO, res: Response) => {
  const { playerName } = req.body as CreateRoomBody;
  const playerId = uuidv4();
  const roomId = req.roomManager.createRoom(playerId);

  // Update player name after room creation
  const room = req.roomManager.getRoom(roomId);
  if (room) {
    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.name = playerName;
    }
  }

  res.status(201).json(room);
}) as any);

// DTO for joining a room
interface JoinRoomBody { playerName: string; }

roomsRouter.post('/:roomId/join', ((req: RequestWithIO, res: Response) => {
  const roomId = req.params.roomId;
  const room = req.roomManager.getRoom(roomId);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  if (room.players.length >= 4) {
    res.status(400).json({ error: 'Room is full' });
    return;
  }

  const playerId = uuidv4();
  const success = req.roomManager.joinRoom(roomId, {
    id: playerId,
    name: req.body.playerName,
    team: ((room.players.length % 2) + 1) as 1 | 2
  } as any);

  if (!success) {
    res.status(400).json({ error: 'Could not join room' });
    return;
  }

  res.json(req.roomManager.getRoom(roomId));
}) as any);

roomsRouter.get('/:roomId', ((req: RequestWithIO, res: Response) => {
  const room = req.roomManager.getRoom(req.params.roomId);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }
  res.json(room);
}) as any);

// DTO for leaving (could include playerId or name)
interface LeaveRoomBody { playerId: string; }

roomsRouter.post('/:roomId/leave', ((req: RequestWithIO, res: Response) => {
  const roomId = req.params.roomId;
  const room = req.roomManager.getRoom(roomId);

  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const playerId = req.body.playerId;
  const player = room.players.find(p => p.id === playerId);

  if (!player) {
    res.status(400).json({ error: 'Player not in room' });
    return;
  }

  req.roomManager.handleDisconnect(playerId);
  res.json({ message: 'Left room successfully' });
}) as any);
