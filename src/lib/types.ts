export type { Card, Deck, ReviewLog } from './db/schema';

export type CardStats = {
  new: number;
  learning: number;
  review: number;
  due: number;
  total: number;
};

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

export type DeckWithStats = import('./db/schema').Deck & { stats: CardStats };
