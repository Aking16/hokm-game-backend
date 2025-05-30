export type Suit = '♠' | '♥' | '♦' | '♣';

export interface Card {
  suit: Suit;
  rank: number; // 2-14 (J=11, Q=12, K=13, A=14)
}

export interface Player {
  id: string;           // unique player ID (could be socket ID or generated UUID)
  name: string;         // player display name
  team: 1 | 2;          // team number (1 or 2 in a 2v2 game)
}

export interface Room {
  id: string;           // unique room ID
  players: Player[];    // currently joined players
  hostId: string;       // ID of the player who created the room
  status: 'waiting' | 'playing' | 'finished'; // room/game status
  // (Game details like hands/tricks are managed over WebSocket and not exposed here)
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['♠', '♥', '♦', '♣'];
  const deck: Card[] = [];

  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) {
      deck.push({ suit, rank });
    }
  }

  return deck;
}

export function shuffle<T>(array: T[]): T[] {
  const clone = [...array];
  for (let i = clone.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }
  return clone;
}