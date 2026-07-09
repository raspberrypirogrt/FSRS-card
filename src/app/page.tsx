'use client';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { getAllDecksWithStats } from '@/lib/db/deckRepo';
import { getCardStats, getDueCards } from '@/lib/db/cardRepo';
import { getTodayReviewCount } from '@/lib/db/reviewLogRepo';

export default function Dashboard() {
  const decksWithStats = useLiveQuery(() => getAllDecksWithStats());
  const globalStats = useLiveQuery(() => getCardStats());
  const dueCards = useLiveQuery(() => getDueCards());
  const todayReviewCount = useLiveQuery(() => getTodayReviewCount());

  // 日期格式化
  const today = new Date().toLocaleDateString('zh-TW', { 
    month: 'long', 
    day: 'numeric', 
    weekday: 'long' 
  });

  const isLoading = decksWithStats === undefined || globalStats === undefined;

  if (isLoading) {
    return (
      <div className="animate-fadeIn">
        <div className="page-header">
          <div>
            <h1 className="page-title">歡迎回來 👋</h1>
            <p className="page-subtitle">載入中...</p>
          </div>
        </div>
        <div className="stats-grid" style={{ marginBottom: 'var(--space-2xl)' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="card skeleton-card" style={{ height: '120px' }}></div>
          ))}
        </div>
      </div>
    );
  }

  const dueCount = dueCards?.length || 0;
  const newCount = globalStats?.new || 0;
  const totalCount = globalStats?.total || 0;

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">歡迎回來 👋</h1>
          <p className="page-subtitle">今天是 {today}</p>
        </div>
        <div className="page-actions">
          <Link href="/cards?action=new" className="btn btn-secondary">
            ＋ 新增卡片
          </Link>
          <Link href="/review" className="btn btn-primary" style={{ padding: 'var(--space-sm) var(--space-xl)' }}>
            開始複習
          </Link>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-2xl)' }}>
        <div className="card stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <span className="stat-icon">📝</span>
            <div>
              <div className="stat-value" style={{ color: dueCount > 0 ? 'var(--warning)' : 'inherit' }}>
                {dueCount}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>待複習</div>
            </div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <span className="stat-icon">🆕</span>
            <div>
              <div className="stat-value" style={{ color: newCount > 0 ? 'var(--info)' : 'inherit' }}>
                {newCount}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>新卡片</div>
            </div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <span className="stat-icon">✅</span>
            <div>
              <div className="stat-value" style={{ color: (todayReviewCount || 0) > 0 ? 'var(--success)' : 'inherit' }}>
                {todayReviewCount || 0}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>今日已複習</div>
            </div>
          </div>
        </div>
        
        <div className="card stat-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
            <span className="stat-icon">📚</span>
            <div>
              <div className="stat-value">{totalCount}</div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>總卡片數</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-xl)' }}>您的牌組</h2>
        <Link href="/decks" style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-secondary)' }}>查看全部 ➔</Link>
      </div>

      {(!decksWithStats || decksWithStats.length === 0) ? (
        <EmptyState 
          icon="🗂️" 
          title="尚未建立任何牌組" 
          description="建立一個牌組來開始新增卡片與複習"
        >
          <Link href="/decks?action=new" className="btn btn-primary">
            建立第一個牌組
          </Link>
        </EmptyState>
      ) : (
        <div className="deck-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
          {decksWithStats.map(deck => (
            <Link href={`/decks/${deck.id}`} key={deck.id} className="card deck-item" style={{ display: 'block', color: 'inherit' }}>
              <div className="deck-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span style={{ fontSize: '1.5rem' }}>{deck.icon || '📚'}</span>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{deck.name}</h3>
                </div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
                {deck.description || '無描述'}
              </p>
              
              {/* Progress bar */}
              <div style={{ marginBottom: 'var(--space-sm)' }}>
                <div className="progress-bar">
                  <div 
                    className="progress-bar-fill" 
                    style={{ width: `${deck.stats.total > 0 ? ((deck.stats.total - deck.stats.new - deck.stats.due) / deck.stats.total) * 100 : 0}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="deck-item-stats" style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                <span className="badge badge-warning">需複習: {deck.stats.due}</span>
                <span className="badge badge-info">新卡片: {deck.stats.new}</span>
                <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>總共: {deck.stats.total}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
