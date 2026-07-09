import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FSRSCard,
  type Grade,
} from 'ts-fsrs';
import type { Card } from '../db/schema';

// Re-export for convenience
export { Rating, State };

export class FSRSScheduler {
  private f = fsrs();

  /**
   * Generate default FSRS fields for a brand-new card.
   */
  createNewCardFields(): Pick<
    Card,
    | 'due'
    | 'stability'
    | 'difficulty'
    | 'elapsedDays'
    | 'scheduledDays'
    | 'reps'
    | 'lapses'
    | 'state'
    | 'lastReview'
  > {
    const empty = createEmptyCard(new Date());
    return {
      due: empty.due.getTime(),
      stability: empty.stability,
      difficulty: empty.difficulty,
      elapsedDays: empty.elapsed_days,
      scheduledDays: empty.scheduled_days,
      reps: empty.reps,
      lapses: empty.lapses,
      state: empty.state as number,
      lastReview: null,
    };
  }

  /**
   * Convert our application Card (number timestamps) to the ts-fsrs Card
   * format (Date objects).
   */
  private toFSRSCard(card: Card): FSRSCard {
    return {
      due: new Date(card.due),
      stability: card.stability,
      difficulty: card.difficulty,
      elapsed_days: card.elapsedDays,
      scheduled_days: card.scheduledDays,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state as State,
      learning_steps: 0,
      ...(card.lastReview != null
        ? { last_review: new Date(card.lastReview) }
        : {}),
    };
  }

  /**
   * Review a card with a given rating and return updated card fields + log
   * data that can be persisted.
   */
  review(
    card: Card,
    rating: Rating,
  ): {
    cardUpdates: Partial<Card>;
    logData: {
      cardId: string;
      rating: number;
      state: number;
      due: number;
      stability: number;
      difficulty: number;
      elapsedDays: number;
      scheduledDays: number;
      reviewedAt: number;
    };
  } {
    const now = new Date();
    const fsrsCard = this.toFSRSCard(card);
    const result = this.f.next(fsrsCard, now, rating as Grade);

    const nextCard = result.card;
    const log = result.log;

    return {
      cardUpdates: {
        due: nextCard.due.getTime(),
        stability: nextCard.stability,
        difficulty: nextCard.difficulty,
        elapsedDays: nextCard.elapsed_days,
        scheduledDays: nextCard.scheduled_days,
        reps: nextCard.reps,
        lapses: nextCard.lapses,
        state: nextCard.state as number,
        lastReview: now.getTime(),
        updatedAt: Date.now(),
      },
      logData: {
        cardId: card.id,
        rating: log.rating as number,
        state: log.state as number,
        due: log.due.getTime(),
        stability: log.stability,
        difficulty: log.difficulty,
        elapsedDays: log.elapsed_days,
        scheduledDays: log.scheduled_days,
        reviewedAt: now.getTime(),
      },
    };
  }

  /**
   * Preview all 4 possible rating outcomes for a card without persisting
   * anything.
   */
  preview(
    card: Card,
  ): Array<{
    rating: Rating;
    ratingLabel: string;
    interval: string;
    card: Partial<Card>;
  }> {
    const now = new Date();
    const fsrsCard = this.toFSRSCard(card);
    const scheduling = this.f.repeat(fsrsCard, now);

    const labels: Record<number, string> = {
      [Rating.Again]: '重來',
      [Rating.Hard]: '困難',
      [Rating.Good]: '良好',
      [Rating.Easy]: '簡單',
    };

    const grades: Grade[] = [
      Rating.Again as Grade,
      Rating.Hard as Grade,
      Rating.Good as Grade,
      Rating.Easy as Grade,
    ];

    return grades.map((grade) => {
      const item = scheduling[grade];
      const nextCard = item.card;
      const intervalDays = nextCard.scheduled_days;

      return {
        rating: grade as Rating,
        ratingLabel: labels[grade] ?? String(grade),
        interval: this.formatInterval(intervalDays),
        card: {
          due: nextCard.due.getTime(),
          stability: nextCard.stability,
          difficulty: nextCard.difficulty,
          elapsedDays: nextCard.elapsed_days,
          scheduledDays: nextCard.scheduled_days,
          reps: nextCard.reps,
          lapses: nextCard.lapses,
          state: nextCard.state as number,
          lastReview: now.getTime(),
        },
      };
    });
  }

  /**
   * Format a scheduled_days interval as a human-readable Chinese string.
   *
   * - 0 days  → '<1分鐘' (sub-minute for learning cards)
   * - <1 day  → 'N分鐘'
   * - <30 days → 'N天'
   * - <365 days → 'N.N個月'
   * - ≥365 days → 'N.N年'
   */
  formatInterval(days: number): string {
    if (days < 1) {
      // Sub-day intervals: show as minutes.  scheduled_days=0 is typical for
      // learning steps that are measured in minutes, so we fall back to a
      // generic label.
      const minutes = Math.round(days * 24 * 60);
      if (minutes < 1) return '<1分鐘';
      return `${minutes}分鐘`;
    }
    if (days < 30) {
      return `${Math.round(days)}天`;
    }
    if (days < 365) {
      const months = days / 30;
      return `${months % 1 === 0 ? months : months.toFixed(1)}個月`;
    }
    const years = days / 365;
    return `${years % 1 === 0 ? years : years.toFixed(1)}年`;
  }
}

export const scheduler = new FSRSScheduler();
