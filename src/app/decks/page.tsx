'use client';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { getAllDecksWithStats, createDeck, deleteDeck } from '@/lib/db/deckRepo';

export default function DecksPage() {
  const decksWithStats = useLiveQuery(() => getAllDecksWithStats());
  const { showToast } = useToast();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const [newDeckDesc, setNewDeckDesc] = useState('');
  const [newDeckIcon, setNewDeckIcon] = useState('📚');

  const handleCreateDeck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDeckName.trim()) {
      showToast('牌組名稱不能為空', 'error');
      return;
    }

    try {
      await createDeck({
        name: newDeckName.trim(),
        description: newDeckDesc.trim(),
        icon: newDeckIcon,
      });
      showToast('牌組建立成功！', 'success');
      setIsCreateModalOpen(false);
      setNewDeckName('');
      setNewDeckDesc('');
      setNewDeckIcon('📚');
    } catch (error) {
      showToast('建立失敗，請稍後再試', 'error');
    }
  };

  const handleDeleteDeck = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirm('確定要刪除此牌組嗎？這會同時刪除牌組內的所有卡片！')) {
      try {
        await deleteDeck(id);
        showToast('牌組已刪除', 'info');
      } catch (error) {
        showToast('刪除失敗', 'error');
      }
    }
  };

  if (decksWithStats === undefined) {
    return (
      <div className="animate-fadeIn">
        <div className="page-header">
          <h1 className="page-title">牌組管理</h1>
        </div>
        <div className="stats-grid">
          <div className="card skeleton-card" style={{ height: '150px' }}></div>
          <div className="card skeleton-card" style={{ height: '150px' }}></div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">牌組管理</h1>
          <p className="page-subtitle">管理您的所有學習牌組</p>
        </div>
        <div className="page-actions">
          <button 
            className="btn btn-primary"
            onClick={() => setIsCreateModalOpen(true)}
          >
            ＋ 新增牌組
          </button>
        </div>
      </div>

      {decksWithStats.length === 0 ? (
        <EmptyState 
          icon="🗂️" 
          title="尚未建立任何牌組" 
          description="建立一個牌組來分類您的記憶卡片"
          actionLabel="建立牌組"
          onAction={() => setIsCreateModalOpen(true)}
        />
      ) : (
        <div className="deck-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-lg)' }}>
          {decksWithStats.map(deck => (
            <Link href={`/decks/${deck.id}`} key={deck.id} className="card deck-item" style={{ display: 'block', color: 'inherit' }}>
              <div className="deck-item-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-sm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <span style={{ fontSize: '1.5rem' }}>{deck.icon || '📚'}</span>
                  <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }}>{deck.name}</h3>
                </div>
                <button 
                  className="btn-icon btn-ghost" 
                  style={{ color: 'var(--text-muted)' }}
                  onClick={(e) => handleDeleteDeck(deck.id, e)}
                  title="刪除牌組"
                >
                  🗑️
                </button>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-md)' }}>
                {deck.description || '無描述'}
              </p>
              
              <div className="deck-item-stats" style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
                <span className="badge badge-warning">需複習: {deck.stats.due}</span>
                <span className="badge badge-info">新卡片: {deck.stats.new}</span>
                <span className="badge" style={{ background: 'var(--surface)', color: 'var(--text-secondary)' }}>總共: {deck.stats.total}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 建立牌組 Modal */}
      <Modal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        title="建立新牌組"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setIsCreateModalOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleCreateDeck}>建立</button>
          </>
        }
      >
        <form onSubmit={handleCreateDeck} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="input-group">
            <label className="input-label">圖示 (Emoji)</label>
            <input 
              type="text" 
              className="input" 
              value={newDeckIcon}
              onChange={(e) => setNewDeckIcon(e.target.value)}
              placeholder="例如: 📚"
              maxLength={2}
            />
          </div>
          <div className="input-group">
            <label className="input-label">牌組名稱</label>
            <input 
              type="text" 
              className="input" 
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="例如: 工程數學"
              autoFocus
            />
          </div>
          <div className="input-group">
            <label className="input-label">描述 (選填)</label>
            <textarea 
              className="textarea" 
              value={newDeckDesc}
              onChange={(e) => setNewDeckDesc(e.target.value)}
              placeholder="例如: 大二上學期必修課程"
              rows={3}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
