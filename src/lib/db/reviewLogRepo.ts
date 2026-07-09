import { v7 as uuidv7 } from 'uuid';
import { db, type ReviewLog } from './schema';

/**
 * Add a new review log entry.
 */
export async function addReviewLog(
  data: Omit<ReviewLog, 'id'>,
): Promise<ReviewLog> {
  const log: ReviewLog = {
    id: uuidv7(),
    ...data,
  };

  await db.reviewLogs.add(log);
  return log;
}

/**
 * Get all review logs for a specific card, ordered by reviewedAt ascending.
 */
export async function getReviewLogsByCard(
  cardId: string,
): Promise<ReviewLog[]> {
  return db.reviewLogs
    .where('cardId')
    .equals(cardId)
    .sortBy('reviewedAt');
}

/**
 * Get review logs within a date range [start, end] (inclusive, ms timestamps).
 */
export async function getReviewLogsByDateRange(
  start: number,
  end: number,
): Promise<ReviewLog[]> {
  return db.reviewLogs
    .where('reviewedAt')
    .between(start, end, true, true)
    .toArray();
}

// ─── Helper: get today's start/end timestamps ────────────────────────────────

function getTodayRange(): { start: number; end: number } {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const end = start + 24 * 60 * 60 * 1000 - 1;
  return { start, end };
}

/**
 * Count review logs created today.
 */
export async function getTodayReviewCount(): Promise<number> {
  const { start, end } = getTodayRange();
  return db.reviewLogs
    .where('reviewedAt')
    .between(start, end, true, true)
    .count();
}

/**
 * Build a heatmap of review counts for the last N days.
 * Returns a Record keyed by 'YYYY-MM-DD' with the review count as value.
 */
export async function getReviewHeatmapData(
  days: number,
): Promise<Record<string, number>> {
  const now = new Date();
  const startDate = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days + 1,
  );
  const startMs = startDate.getTime();
  const endMs = Date.now();

  const logs = await db.reviewLogs
    .where('reviewedAt')
    .between(startMs, endMs, true, true)
    .toArray();

  const heatmap: Record<string, number> = {};

  // Initialize all days to 0
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const key = formatDateKey(d);
    heatmap[key] = 0;
  }

  // Tally reviews
  for (const log of logs) {
    const key = formatDateKey(new Date(log.reviewedAt));
    if (key in heatmap) {
      heatmap[key]++;
    }
  }

  return heatmap;
}

/**
 * Calculate the current streak: consecutive days (ending today or yesterday)
 * with at least 1 review.
 */
export async function getStreakDays(): Promise<number> {
  const heatmap = await getReviewHeatmapData(365);
  const today = new Date();
  let streak = 0;

  // Start checking from today, then go backwards
  for (let i = 0; i <= 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);

    if ((heatmap[key] ?? 0) > 0) {
      streak++;
    } else {
      // Allow skipping today if no reviews yet (streak continues from yesterday)
      if (i === 0) continue;
      break;
    }
  }

  return streak;
}

// ─── Utilities ───────────────────────────────────────────────────────────────

function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
