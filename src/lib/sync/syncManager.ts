import { db } from '../db/schema';
import { supabase, isSupabaseConfigured } from '../supabase/client';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'success';

// 使用 localStorage 記錄最後同步時間
const LAST_SYNC_KEY = 'fsrs_last_sync_timestamp';

export class SyncManager {
  private static instance: SyncManager;
  private syncListeners: ((status: SyncStatus, message?: string) => void)[] = [];
  private isSyncing = false;

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public subscribe(listener: (status: SyncStatus, message?: string) => void) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  private notify(status: SyncStatus, message?: string) {
    this.syncListeners.forEach(listener => listener(status, message));
  }

  public getLastSyncTime(): number {
    if (typeof window === 'undefined') return 0;
    const val = localStorage.getItem(LAST_SYNC_KEY);
    return val ? parseInt(val, 10) : 0;
  }

  private setLastSyncTime(timestamp: number) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LAST_SYNC_KEY, timestamp.toString());
    }
  }

  /**
   * 完整同步流程：先 Pull 再 Push
   */
  public async fullSync(): Promise<void> {
    if (!isSupabaseConfigured) {
      console.warn('Supabase 未設定，跳過同步。請在 .env.local 中設定。');
      return;
    }

    if (this.isSyncing) return;
    
    try {
      this.isSyncing = true;
      this.notify('syncing', '正在同步中...');

      const lastSync = this.getLastSyncTime();
      const currentSyncStart = Date.now();

      // 1. PULL: 從雲端拉取上次同步之後的變更
      await this.pullChanges(lastSync);

      // 2. PUSH: 將本地在上次同步之後的變更推送到雲端
      await this.pushChanges(lastSync);

      // 3. 更新同步時間
      this.setLastSyncTime(currentSyncStart);
      this.notify('success', '同步完成');

    } catch (error: any) {
      console.error('Sync failed:', error);
      this.notify('error', `同步失敗: ${error.message || '未知錯誤'}`);
    } finally {
      this.isSyncing = false;
      // 3秒後恢復 idle 狀態
      setTimeout(() => this.notify('idle'), 3000);
    }
  }

  private async pullChanges(lastSync: number) {
    // 拉取 Cards
    const { data: remoteCards, error: cardsError } = await supabase
      .from('cards')
      .select('*')
      .gt('updatedAt', lastSync);
    
    if (cardsError) throw cardsError;

    // 拉取 Decks
    const { data: remoteDecks, error: decksError } = await supabase
      .from('decks')
      .select('*')
      .gt('updatedAt', lastSync);
    
    if (decksError) throw decksError;

    // 寫入本地 DB (Last-Write-Wins: 如果雲端資料較新，則覆蓋)
    await db.transaction('rw', db.cards, db.decks, async () => {
      if (remoteCards && remoteCards.length > 0) {
        for (const rCard of remoteCards) {
          const lCard = await db.cards.get(rCard.id);
          if (!lCard || rCard.updatedAt > lCard.updatedAt) {
            await db.cards.put(rCard);
          }
        }
      }

      if (remoteDecks && remoteDecks.length > 0) {
        for (const rDeck of remoteDecks) {
          const lDeck = await db.decks.get(rDeck.id);
          if (!lDeck || rDeck.updatedAt > lDeck.updatedAt) {
            await db.decks.put(rDeck);
          }
        }
      }
    });
  }

  private async pushChanges(lastSync: number) {
    // 找出本地在上次同步後修改的資料
    const localCards = await db.cards.where('updatedAt').above(lastSync).toArray();
    const localDecks = await db.decks.where('updatedAt').above(lastSync).toArray();
    
    // 雖然這裡沒有實作 ReviewLog 同步，但在實際應用中也可以加入
    
    if (localCards.length > 0) {
      const { error } = await supabase.from('cards').upsert(localCards);
      if (error) throw error;
    }

    if (localDecks.length > 0) {
      const { error } = await supabase.from('decks').upsert(localDecks);
      if (error) throw error;
    }
  }
}

export const syncManager = SyncManager.getInstance();
