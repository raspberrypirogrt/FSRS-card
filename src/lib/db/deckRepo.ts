import { v7 as uuidv7 } from 'uuid';
import { db, type Deck } from './schema';
import { getCardStats } from './cardRepo';
import type { CardStats } from '../types';

/**
 * Create a new deck.
 */
export async function createDeck(data: {
  name: string;
  description?: string;
  icon?: string;
  parentId?: string | null;
}): Promise<Deck> {
  const now = Date.now();

  const deck: Deck = {
    id: uuidv7(),
    name: data.name,
    description: data.description ?? '',
    parentId: data.parentId ?? null,
    icon: data.icon ?? '📚',
    newCardsPerDay: 20,
    reviewsPerDay: 200,
    targetRetention: 0.9,
    updatedAt: now,
    createdAt: now,
    deletedAt: null,
    syncVersion: 0,
  };

  await db.decks.add(deck);
  return deck;
}

/**
 * Partially update a deck and bump updatedAt + syncVersion.
 */
export async function updateDeck(
  id: string,
  updates: Partial<Deck>,
): Promise<void> {
  const existing = await db.decks.get(id);
  if (!existing) throw new Error(`Deck not found: ${id}`);

  await db.decks.update(id, {
    ...updates,
    updatedAt: Date.now(),
    syncVersion: existing.syncVersion + 1,
  });
}

/**
 * Soft-delete a deck (set deletedAt timestamp).
 */
export async function deleteDeck(id: string): Promise<void> {
  await db.decks.update(id, {
    deletedAt: Date.now(),
    updatedAt: Date.now(),
  });
}

/**
 * Get a single deck by id.
 */
export async function getDeck(id: string): Promise<Deck | undefined> {
  return db.decks.get(id);
}

/**
 * Get all non-deleted decks, sorted by name.
 */
export async function getAllDecks(): Promise<Deck[]> {
  const decks = await db.decks
    .filter((d) => d.deletedAt === null)
    .toArray();

  return decks.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get all non-deleted decks with their card statistics.
 */
export async function getAllDecksWithStats(): Promise<
  Array<Deck & { stats: CardStats }>
> {
  const decks = await getAllDecks();

  const results = await Promise.all(
    decks.map(async (deck) => {
      const stats = await getCardStats(deck.id);
      return { ...deck, stats };
    }),
  );

  return results;
}
