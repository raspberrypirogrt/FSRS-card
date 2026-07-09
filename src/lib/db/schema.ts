import Dexie, { type EntityTable } from 'dexie';

// ─── Card ────────────────────────────────────────────────────────────────────
export interface Card {
  id: string;
  deckId: string;
  front: string;               // Markdown + LaTeX content
  back: string;                // Markdown + LaTeX content
  tags: string[];
  cardType: 'basic' | 'cloze' | 'vocab';
  due: number;                 // timestamp ms
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: number;               // 0=New, 1=Learning, 2=Review, 3=Relearning
  lastReview: number | null;   // timestamp ms
  updatedAt: number;
  createdAt: number;
  deletedAt: number | null;
  syncVersion: number;
}

// ─── Deck ────────────────────────────────────────────────────────────────────
export interface Deck {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  icon: string;
  newCardsPerDay: number;
  reviewsPerDay: number;
  targetRetention: number;
  updatedAt: number;
  createdAt: number;
  deletedAt: number | null;
  syncVersion: number;
}

// ─── ReviewLog ───────────────────────────────────────────────────────────────
export interface ReviewLog {
  id: string;
  cardId: string;
  rating: number;
  state: number;
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reviewedAt: number;
  reviewDuration: number;
  syncVersion: number;
}

// ─── Database ────────────────────────────────────────────────────────────────
class AppDatabase extends Dexie {
  cards!: EntityTable<Card, 'id'>;
  decks!: EntityTable<Deck, 'id'>;
  reviewLogs!: EntityTable<ReviewLog, 'id'>;

  constructor() {
    super('fsrs-card-db');

    this.version(1).stores({
      cards: 'id, deckId, state, due, *tags, updatedAt',
      decks: 'id, updatedAt',
      reviewLogs: 'id, cardId, reviewedAt',
    });
  }
}

export const db = new AppDatabase();
