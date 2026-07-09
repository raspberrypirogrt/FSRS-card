'use client';
import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { getDeck } from '@/lib/db/deckRepo';
import { getCardsByDeck, deleteCard } from '@/lib/db/cardRepo';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';

export default function DeckDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const deckId = params?.id as string;

  const deck = useLiveQuery(() => getDeck(deckId), [deckId]);
  const cards = useLiveQuery(() => getCardsByDeck(deckId), [deckId]);

  if (deck === undefined || cards === undefined) {
    return (
      <div className="animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">載入中...</h1>
        </div>
      </div>
    );
  }

  if (deck === null) {
    return (
      <EmptyState 
        icon="❓" 
        title="找不到牌組" 
        description="此牌組可能已被刪除或不存在"
      >
        <button className="btn btn-primary" onClick={() => router.push('/decks')}>返回牌組列表</button>
      </EmptyState>
    );
  }

  const handleDeleteCard = async (id: string) => {
    if (confirm('確定要刪除這張卡片嗎？')) {
      try {
        await deleteCard(id);
        showToast('卡片已刪除', 'info');
      } catch (error) {
        showToast('刪除失敗', 'error');
      }
    }
  };

  const dueCount = cards.filter(c => c.due <= Date.now()).length;
  const newCount = cards.filter(c => c.state === 0).length;

  return (
    <div className="animate-fadeIn">
      <div className="page-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
            <Link href="/decks" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>← 返回</Link>
          </div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
            {deck.icon} {deck.name}
          </h1>
          <p className="page-subtitle">{deck.description || '無描述'}</p>
        </div>
        <div className="page-actions" style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <Link href={`/cards?action=new&deckId=${deck.id}`} className="btn btn-secondary">
            ＋ 新增卡片
          </Link>
          <Link href={`/review?deckId=${deck.id}`} className="btn btn-primary">
            開始複習
          </Link>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="card stat-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>待複習</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--warning)' }}>{dueCount}</div>
        </div>
        <div className="card stat-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>新卡片</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--info)' }}>{newCount}</div>
        </div>
        <div className="card stat-card" style={{ padding: 'var(--space-md)' }}>
          <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>總卡片數</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{cards.length}</div>
        </div>
      </div>

      <h2 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-md)' }}>卡片列表 ({cards.length})</h2>

      {cards.length === 0 ? (
        <EmptyState 
          icon="🃏" 
          title="這個牌組還沒有卡片" 
          description="點擊右上角新增卡片來開始學習"
        />
      ) : (
        <div className="card-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {cards.map(card => (
            <div key={card.id} className="card card-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                  {card.state === 0 && <span className="badge badge-info">新卡片</span>}
                  {card.state === 1 && <span className="badge badge-warning">學習中</span>}
                  {card.state === 2 && <span className="badge badge-success">複習中</span>}
                  {card.state === 3 && <span className="badge badge-danger">重新學習</span>}
                </div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                  {card.front.substring(0, 100).replace(/[#*`_]/g, '')}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                <Link href={`/cards?edit=${card.id}`} className="btn-icon btn-ghost" title="編輯">
                  ✏️
                </Link>
                <button className="btn-icon btn-ghost" onClick={() => handleDeleteCard(card.id)} title="刪除">
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
