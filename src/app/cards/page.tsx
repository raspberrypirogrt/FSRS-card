'use client';
import { useState, useEffect, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { EmptyState } from '@/components/ui/EmptyState';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { CardEditor } from '@/components/card/CardEditor';
import { getAllDecks } from '@/lib/db/deckRepo';
import { searchCards, createCard, deleteCard, updateCard, getCard } from '@/lib/db/cardRepo';

function CardsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const action = searchParams?.get('action');
  const editId = searchParams?.get('edit');
  const initialDeckId = searchParams?.get('deckId');
  
  const { showToast } = useToast();
  const decks = useLiveQuery(() => getAllDecks());
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const cards = useLiveQuery(() => searchCards(debouncedQuery), [debouncedQuery]);
  
  const [isEditorOpen, setIsEditorOpen] = useState(action === 'new' || !!editId);
  const [editingCardId, setEditingCardId] = useState<string | null>(editId || null);
  const [selectedDeckId, setSelectedDeckId] = useState(initialDeckId || '');
  const [cardFront, setCardFront] = useState('');
  const [cardBack, setCardBack] = useState('');

  // 搜尋防抖 (Debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // 如果帶有 action=new 參數，自動打開新增對話框
  useEffect(() => {
    if (action === 'new' && decks && decks.length > 0 && !selectedDeckId) {
      setSelectedDeckId(initialDeckId || decks[0].id);
      setIsEditorOpen(true);
      setEditingCardId(null);
      setCardFront('');
      setCardBack('');
    }
  }, [action, decks, selectedDeckId, initialDeckId]);

  // 如果帶有 edit 參數，載入卡片資料
  useEffect(() => {
    if (editId) {
      setIsEditorOpen(true);
      setEditingCardId(editId);
      getCard(editId).then(card => {
        if (card) {
          setSelectedDeckId(card.deckId);
          setCardFront(card.front);
          setCardBack(card.back);
        }
      });
    }
  }, [editId]);

  const handleSaveCard = async () => {
    if (!selectedDeckId) {
      showToast('請先選擇一個牌組', 'warning');
      return;
    }
    if (!cardFront.trim() || !cardBack.trim()) {
      showToast('卡片的正面和背面都必須填寫', 'warning');
      return;
    }

    try {
      if (editingCardId) {
        // 更新現有卡片
        await updateCard(editingCardId, {
          deckId: selectedDeckId,
          front: cardFront,
          back: cardBack,
        });
        showToast('卡片更新成功！', 'success');
        setIsEditorOpen(false);
        router.replace('/cards');
      } else {
        // 新增卡片
        await createCard({
          deckId: selectedDeckId,
          front: cardFront,
          back: cardBack,
          tags: [],
        });
        showToast('卡片新增成功！', 'success');
        setCardFront('');
        setCardBack('');
      }
    } catch (error) {
      showToast('儲存卡片失敗', 'error');
    }
  };

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

  return (
    <div className="animate-fadeIn">
      <div className="page-header">
        <div>
          <h1 className="page-title">卡片瀏覽</h1>
          <p className="page-subtitle">搜尋與管理您的所有記憶卡</p>
        </div>
        <div className="page-actions">
          <button 
            className="btn btn-primary"
            onClick={() => {
              if (decks && decks.length > 0) setSelectedDeckId(decks[0].id);
              setEditingCardId(null);
              setCardFront('');
              setCardBack('');
              setIsEditorOpen(true);
            }}
          >
            ＋ 新增卡片
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-lg)', padding: 'var(--space-md)' }}>
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input 
            type="text" 
            className="input" 
            placeholder="搜尋卡片內容 (正面或背面)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {cards === undefined ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {[1, 2, 3].map(i => (
            <div key={i} className="card skeleton-card" style={{ height: '80px' }}></div>
          ))}
        </div>
      ) : cards.length === 0 ? (
        <EmptyState 
          icon="🃏" 
          title={searchQuery ? "找不到符合的卡片" : "還沒有任何卡片"} 
          description={searchQuery ? "試試其他關鍵字" : "點擊右上角新增您的第一張記憶卡"}
        />
      ) : (
        <div className="card-list" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {cards.map(card => {
            const deck = decks?.find(d => d.id === card.deckId);
            return (
              <div key={card.id} className="card card-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-xs)' }}>
                    <span className="badge" style={{ background: 'var(--surface)' }}>{deck?.icon} {deck?.name || '未知牌組'}</span>
                    {card.state === 0 && <span className="badge badge-info">新卡片</span>}
                    {card.state === 1 && <span className="badge badge-warning">學習中</span>}
                    {card.state === 2 && <span className="badge badge-success">複習中</span>}
                    {card.state === 3 && <span className="badge badge-danger">重新學習</span>}
                  </div>
                  
                  {/* 簡單擷取正面內容，去除 markdown 語法 */}
                  <div style={{ 
                    whiteSpace: 'nowrap', 
                    overflow: 'hidden', 
                    textOverflow: 'ellipsis',
                    fontWeight: 500
                  }}>
                    {card.front.substring(0, 100).replace(/[#*`_]/g, '')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-xs)' }}>
                  <button 
                    className="btn-icon btn-ghost" 
                    onClick={() => {
                      setEditingCardId(card.id);
                      setSelectedDeckId(card.deckId);
                      setCardFront(card.front);
                      setCardBack(card.back);
                      setIsEditorOpen(true);
                    }} 
                    title="編輯"
                  >
                    ✏️
                  </button>
                  <button className="btn-icon btn-ghost" onClick={() => handleDeleteCard(card.id)} title="刪除">
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增卡片 Modal (滿版) */}
      <Modal 
        isOpen={isEditorOpen} 
        onClose={() => {
          setIsEditorOpen(false);
          router.replace('/cards');
        }}
        title={editingCardId ? "編輯記憶卡" : "新增記憶卡"}
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setIsEditorOpen(false)}>取消</button>
            <button className="btn btn-primary" onClick={handleSaveCard}>
              {editingCardId ? "儲存變更" : "儲存並新增下一張"}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
          <div className="input-group">
            <label className="input-label">選擇牌組</label>
            {decks && decks.length > 0 ? (
              <select 
                className="select"
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
              >
                {decks.map(deck => (
                  <option key={deck.id} value={deck.id}>{deck.icon} {deck.name}</option>
                ))}
              </select>
            ) : (
              <div style={{ color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
                請先建立一個牌組
              </div>
            )}
          </div>

          <CardEditor 
            initialFront={cardFront}
            initialBack={cardBack}
            onChange={(front, back) => {
              setCardFront(front);
              setCardBack(back);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}

export default function CardsPage() {
  return (
    <Suspense fallback={<div className="animate-fadeIn page-header"><div><h1 className="page-title">載入中...</h1></div></div>}>
      <CardsContent />
    </Suspense>
  );
}
