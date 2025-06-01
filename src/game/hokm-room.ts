import { Server, Socket } from "socket.io";
import { createDeck, shuffle, Player, Suit, Card } from "./types";

interface Room {
  id: string;
  players: Player[];
  gameStarted: boolean;
  trumpSuit?: Suit;
  turnIndex: number;
  deck: Card[];
  hands: Record<string, Card[]>;
  trick: { playerId: string; card: Card; }[];
  teamScores: { A: number; B: number; };
}

export class HokmRoomManager {
  private rooms: Map<string, Room> = new Map();
  constructor(private io: Server) { }

  getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId);
  }

  createRoom(creatorId: string, playerName: string): string {
    const roomId = `room-${Math.random().toString(36).substr(2, 6)}`;
    const player: Player = {
      id: creatorId,
      team: 1,
      name: playerName
    };
    this.rooms.set(roomId, {
      id: roomId,
      players: [player],
      gameStarted: false,
      turnIndex: 0,
      deck: [],
      hands: {},
      trick: [],
      teamScores: { A: 0, B: 0 },
    });
    return roomId;
  }

  joinRoom(roomId: string, playerOrSocket: Socket | Player, playerName?: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || room.players.length >= 4 || room.gameStarted) return false;

    const team = room.players.length % 2 === 0 ? 1 : 2;
    let player: Player;

    if ('id' in playerOrSocket && 'name' in playerOrSocket) {
      // It's a Player object
      player = playerOrSocket;
    } else {
      // It's a Socket object
      player = {
        id: playerOrSocket.id,
        name: playerName ?? "",
        team
      };
      playerOrSocket.join(roomId);
    }

    room.players.push(player);
    this.io.to(roomId).emit('player-joined', player);

    if (room.players.length === 4) {
      this.startGame(room);
    }

    return true;
  }

  startGame(room: Room) {
    room.gameStarted = true;
    room.deck = shuffle(createDeck());
    room.players.forEach(p => room.hands[p.id] = room.deck.splice(0, 13));

    const chooser = room.players[Math.floor(Math.random() * 4)];
    this.io.to(room.id).emit('choose-trump', chooser.id);
  }

  setTrump(roomId: string, playerId: string, suit: Suit) {
    const room = this.rooms.get(roomId);
    if (!room || room.trumpSuit) return;

    room.trumpSuit = suit;
    this.io.to(room.id).emit('trump-set', suit);
    this.io.to(room.id).emit('start-turn', room.players[room.turnIndex].id);
  }

  handlePlayCard(playerId: string, { roomId, card }: { roomId: string; card: Card; }) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const current = room.players[room.turnIndex];
    if (current.id !== playerId) return;

    room.hands[playerId] = room.hands[playerId].filter(c => c.suit !== card.suit || c.rank !== card.rank);
    room.trick.push({ playerId, card });
    this.io.to(roomId).emit('card-played', { playerId, card });

    if (room.trick.length === 4) {
      const winner = this.evaluateTrick(room.trick, room.trumpSuit!);
      room.turnIndex = room.players.findIndex(p => p.id === winner);
      const team = room.players[room.turnIndex].team;
      const teamKey = team === 1 ? 'A' : 'B';
      room.teamScores[teamKey]++;
      room.trick = [];
      this.io.to(roomId).emit('trick-won', { winner, teamScores: room.teamScores });
    } else {
      room.turnIndex = (room.turnIndex + 1) % 4;
    }

    this.io.to(roomId).emit('start-turn', room.players[room.turnIndex].id);
  }

  evaluateTrick(trick: { playerId: string; card: Card; }[], trump: Suit): string {
    const leadingSuit = trick[0].card.suit;
    const ranked = trick.map(entry => {
      const priority =
        entry.card.suit === trump ? 3 :
          entry.card.suit === leadingSuit ? 2 : 1;
      return { ...entry, priority };
    });

    ranked.sort((a, b) => {
      if (a.priority !== b.priority) return b.priority - a.priority;
      return b.card.rank - a.card.rank;
    });

    return ranked[0].playerId;
  }

  handleDisconnect(socketId: string) {
    for (const [roomId, room] of this.rooms) {
      const idx = room.players.findIndex(p => p.id === socketId);
      if (idx !== -1) {
        room.players.splice(idx, 1);
        this.io.to(roomId).emit('player-disconnected', socketId);
        if (room.players.length === 0) {
          this.rooms.delete(roomId);
        }
        break;
      }
    }
  }
}