'use client';
import { useState, useEffect } from 'react';
import { syncManager, type SyncStatus } from '@/lib/sync/syncManager';
import { useToast } from '@/components/ui/Toast';

export default function SettingsPage() {
  const { showToast } = useToast();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<number>(0);

  useEffect(() => {
    // 取得初始同步時間
    setLastSyncTime(syncManager.getLastSyncTime());
    
    const unsubscribe = syncManager.subscribe((status) => {
      setSyncStatus(status);
      if (status === 'success') {
        setLastSyncTime(syncManager.getLastSyncTime());
      }
    });

    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    try {
      await syncManager.fullSync();
      showToast('同步請求已發送', 'info');
    } catch (error) {
      showToast('同步失敗', 'error');
    }
  };

  const formatDate = (timestamp: number) => {
    if (!timestamp) return '從未同步';
    return new Date(timestamp).toLocaleString('zh-TW');
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">設定</h1>
          <p className="page-subtitle">管理您的應用程式偏好設定</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* 同步設定 */}
        <section className="card" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>☁️</span> 雲端同步 (Supabase)
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--text-sm)' }}>
            您的資料會自動儲存在本地設備。如已在 <code>.env.local</code> 設定 Supabase 連線資訊，系統會在應用程式開啟與關閉時自動為您同步。
          </p>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
            <div>
              <div style={{ fontWeight: 600, marginBottom: 'var(--space-xs)' }}>最後同步時間</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
                {formatDate(lastSyncTime)}
              </div>
            </div>
            
            <button 
              className="btn btn-secondary" 
              onClick={handleManualSync}
              disabled={syncStatus === 'syncing'}
            >
              {syncStatus === 'syncing' ? '同步中...' : '立即同步'}
            </button>
          </div>
        </section>

        {/* FSRS 演算法設定 */}
        <section className="card" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>🧠</span> FSRS 演算法設定
          </h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-lg)', fontSize: 'var(--text-sm)' }}>
            目前應用程式採用 FSRS v4 預設權重。進階使用者未來可在此自訂權重參數以獲得更精準的學習排程。
          </p>
          
          <div className="empty-state" style={{ padding: 'var(--space-xl) 0' }}>
            <span style={{ fontSize: '2rem', opacity: 0.5, marginBottom: 'var(--space-sm)' }}>⚙️</span>
            <div style={{ color: 'var(--text-muted)' }}>自訂參數功能即將推出</div>
          </div>
        </section>

        {/* 關於 */}
        <section className="card" style={{ padding: 'var(--space-lg)' }}>
          <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)' }}>關於 FSRS Cards</h3>
          <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.8 }}>
            <p>版本：v1.0.0</p>
            <p>本應用程式使用 <a href="https://github.com/open-spaced-repetition/fsrs4anki" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)' }}>FSRS</a> (Free Spaced Repetition Scheduler) 演算法來最佳化您的記憶曲線。</p>
            <p>架構設計採用本地優先 (Local-First)，所有資料優先儲存於瀏覽器內建資料庫 (IndexedDB)，確保離線時也能流暢使用。</p>
          </div>
        </section>
      </div>
    </div>
  );
}
