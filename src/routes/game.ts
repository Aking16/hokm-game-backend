import { Router, Request, Response } from 'express';
import { Server as SocketIOServer } from 'socket.io';
import { HokmRoomManager } from '../game/hokm-room';
import { Card, Suit } from '../game/types';

// Augment Express Request to include io
interface RequestWithIO extends Request {
  io: SocketIOServer;
  roomManager: HokmRoomManager;
}

export const gameRouter = Router();

// DTO for starting a game
interface StartGameBody {
  roomId: string;
  playerId: string;
}

// DTO for playing a card
interface PlayCardBody {
  roomId: string;
  playerId: string;
  card: Card;
}

// DTO for declaring hokm
interface DeclareHokmBody {
  roomId: string;
  playerId: string;
  suit: Suit;
}

// REST endpoints for game actions
gameRouter.post('/start', ((req: RequestWithIO, res: Response) => {
  const { roomId } = req.body as StartGameBody;

  try {
    const room = req.roomManager.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    req.roomManager.startGame(room);
    res.json({ message: 'Game started successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start game' });
  }
}) as any);

gameRouter.post('/play-card', ((req: RequestWithIO, res: Response) => {
  const { roomId, playerId, card } = req.body as PlayCardBody;

  try {
    req.roomManager.handlePlayCard(playerId, { roomId, card });
    res.json({ message: 'Card played successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to play card' });
  }
}) as any);

gameRouter.post('/declare-hokm', ((req: RequestWithIO, res: Response) => {
  const { roomId, playerId, suit } = req.body as DeclareHokmBody;

  try {
    req.roomManager.setTrump(roomId, playerId, suit);
    res.json({ message: 'Hokm declared successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to declare hokm' });
  }
}) as any);

// Get game state
gameRouter.get('/state/:roomId', ((req: RequestWithIO, res: Response) => {
  const { roomId } = req.params;

  try {
    const room = req.roomManager.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Game not found' });
    }
    res.json({
      id: room.id,
      players: room.players,
      gameStarted: room.gameStarted,
      trumpSuit: room.trumpSuit,
      turnIndex: room.turnIndex,
      trick: room.trick,
      teamScores: room.teamScores
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get game state' });
  }
}) as any);

// Get player's hand
gameRouter.get('/hand/:roomId/:playerId', ((req: RequestWithIO, res: Response) => {
  const { roomId, playerId } = req.params;

  try {
    const room = req.roomManager.getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: 'Game not found' });
    }
    const hand = room.hands[playerId];
    if (!hand) {
      return res.status(404).json({ error: 'Player hand not found' });
    }
    res.json(hand);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get player hand' });
  }
}) as any); 