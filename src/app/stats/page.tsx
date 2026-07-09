'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import { getCardStats } from '@/lib/db/cardRepo';
import { getTodayReviewCount, getStreakDays } from '@/lib/db/reviewLogRepo';

export default function StatsPage() {
  const globalStats = useLiveQuery(() => getCardStats());
  const todayCount = useLiveQuery(() => getTodayReviewCount());
  const streak = useLiveQuery(() => getStreakDays());

  if (globalStats === undefined) {
    return (
      <div className="animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">學習統計</h1>
        </div>
        <div className="card skeleton-card" style={{ height: '300px' }}></div>
      </div>
    );
  }

  const { new: newCards, learning, review, total } = globalStats;
  const retentionRate = total > 0 ? (((total - newCards - learning) / total) * 100).toFixed(1) : '0.0';

  return (
    <div className="animate-fadeIn" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">學習統計</h1>
          <p className="page-subtitle">追蹤您的記憶成效與學習軌跡</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 'var(--space-lg)', marginBottom: 'var(--space-xl)' }}>
        {/* Streak */}
        <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>🔥</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {streak || 0} 天
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>連續學習天數</div>
        </div>

        {/* Today Review */}
        <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>✅</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700 }}>
            {todayCount || 0} 張
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>今日已複習</div>
        </div>

        {/* Retention */}
        <div className="card" style={{ padding: 'var(--space-xl)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 'var(--space-sm)' }}>🧠</div>
          <div style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--info)' }}>
            {retentionRate}%
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>預估留存率</div>
        </div>
      </div>

      {/* Card States Distribution */}
      <div className="card" style={{ padding: 'var(--space-xl)' }}>
        <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-lg)' }}>卡片狀態分佈</h3>
        
        {total > 0 ? (
          <div>
            <div style={{ display: 'flex', height: '24px', borderRadius: 'var(--radius-full)', overflow: 'hidden', marginBottom: 'var(--space-lg)' }}>
              <div style={{ width: `${(newCards / total) * 100}%`, background: 'var(--info)' }} title={`新卡片: ${newCards}`}></div>
              <div style={{ width: `${(learning / total) * 100}%`, background: 'var(--warning)' }} title={`學習中: ${learning}`}></div>
              <div style={{ width: `${(review / total) * 100}%`, background: 'var(--success)' }} title={`已掌握: ${review}`}></div>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--info)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>新卡片 ({newCards})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--warning)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>學習中 ({learning})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>已掌握 ({review})</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: 'var(--surface)', display: 'inline-block' }}></span>
                <span style={{ color: 'var(--text-secondary)' }}>總數 ({total})</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ padding: 'var(--space-md) 0' }}>
            <span style={{ fontSize: '2rem', opacity: 0.5 }}>📊</span>
            <div style={{ color: 'var(--text-muted)', marginTop: 'var(--space-sm)' }}>尚未新增任何卡片</div>
          </div>
        )}
      </div>
    </div>
  );
}
