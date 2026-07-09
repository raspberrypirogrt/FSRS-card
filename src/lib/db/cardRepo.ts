import { v7 as uuidv7 } from 'uuid';
import { db, type Card } from './schema';
import { scheduler } from '../fsrs/scheduler';
import type { CardStats } from '../types';

/**
 * Create a new card with FSRS initial scheduling state.
 */
export async function createCard(data: {
  deckId: string;
  front: string;
  back: string;
  tags?: string[];
  cardType?: Card['cardType'];
}): Promise<Card> {
  const now = Date.now();
  const fsrsFields = scheduler.createNewCardFields();

  const card: Card = {
    id: uuidv7(),
    deckId: data.deckId,
    front: data.front,
    back: data.back,
    tags: data.tags ?? [],
    cardType: data.cardType ?? 'basic',
    ...fsrsFields,
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
    syncVersion: 0,
  };

  await db.cards.add(card);
  return card;
}

/**
 * Partially update a card and bump updatedAt + syncVersion.
 */
export async function updateCard(
  id: string,
  updates: Partial<Card>,
): Promise<void> {
  const existing = await db.cards.get(id);
  if (!existing) throw new Error(`Card not found: ${id}`);

  await db.cards.update(id, {
    ...updates,
    updatedAt: Date.now(),
    syncVersion: existing.syncVersion + 1,
  });
}

/**
 * Soft-delete a card (set deletedAt timestamp).
 */
export async function deleteCard(id: string): Promise<void> {
  await db.cards.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Get a single card by id.
 */
export async function getCard(id: string): Promise<Card | undefined> {
  return db.cards.get(id);
}

/**
 * Get all non-deleted cards in a deck.
 */
export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  return db.cards
    .where('deckId')
    .equals(deckId)
    .filter((c) => c.deletedAt === null)
    .toArray();
}

/**
 * Get all cards that are due for review (due <= now) and not deleted.
 * Optionally filter by deckId.
 */
export async function getDueCards(deckId?: string): Promise<Card[]> {
  const now = Date.now();

  let collection = db.cards.where('due').belowOrEqual(now);

  const cards = await collection.toArray();

  return cards.filter(
    (c) => c.deletedAt === null && (deckId == null || c.deckId === deckId),
  );
}

/**
 * Get all non-deleted cards.
 */
export async function getAllCards(): Promise<Card[]> {
  return db.cards.filter((c) => c.deletedAt === null).toArray();
}

/**
 * Search non-deleted cards by front/back content (case-insensitive).
 */
export async function searchCards(query: string): Promise<Card[]> {
  const q = query.toLowerCase();
  return db.cards
    .filter(
      (c) =>
        c.deletedAt === null &&
        (c.front.toLowerCase().includes(q) ||
          c.back.toLowerCase().includes(q)),
    )
    .toArray();
}

/**
 * Get aggregate card statistics, optionally filtered by deck.
 *
 * States: 0=New, 1=Learning, 2=Review, 3=Relearning
 */
export async function getCardStats(deckId?: string): Promise<CardStats> {
  const now = Date.now();

  const cards = deckId
    ? await getCardsByDeck(deckId)
    : await getAllCards();

  const stats: CardStats = {
    new: 0,
    learning: 0,
    review: 0,
    due: 0,
    total: cards.length,
  };

  for (const card of cards) {
    switch (card.state) {
      case 0:
        stats.new++;
        break;
      case 1:
      case 3:
        stats.learning++;
        break;
      case 2:
        stats.review++;
        break;
    }
    if (card.due <= now) {
      stats.due++;
    }
  }

  return stats;
}
