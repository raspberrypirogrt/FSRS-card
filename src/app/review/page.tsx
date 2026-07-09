'use client';
import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import Link from 'next/link';
import { MarkdownLatex } from '@/components/ui/MarkdownLatex';
import { EmptyState } from '@/components/ui/EmptyState';
import { getDueCards, updateCard } from '@/lib/db/cardRepo';
import { addReviewLog } from '@/lib/db/reviewLogRepo';
import { scheduler, Rating } from '@/lib/fsrs/scheduler';
import type { Card } from '@/lib/db/schema';

export default function ReviewPage() {
  const dueCards = useLiveQuery(() => getDueCards());
  
  // State for the review session
  const [sessionCards, setSessionCards] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewStartTime, setReviewStartTime] = useState<number>(0);
  const [completedCount, setCompletedCount] = useState(0);

  // Initialize session when due cards are loaded
  useEffect(() => {
    if (dueCards && sessionCards.length === 0 && currentIndex === 0 && completedCount === 0) {
      // Shuffle the due cards for the session
      const shuffled = [...dueCards].sort(() => Math.random() - 0.5);
      setSessionCards(shuffled);
    }
  }, [dueCards, sessionCards.length, currentIndex, completedCount]);

  // Record start time when card changes or is flipped
  useEffect(() => {
    setReviewStartTime(Date.now());
  }, [currentIndex]);

  const currentCard = sessionCards[currentIndex];

  // Pre-calculate outcomes for the 4 buttons
  const previews = useMemo(() => {
    if (!currentCard) return null;
    return scheduler.preview(currentCard);
  }, [currentCard]);

  const handleFlip = () => {
    if (!isFlipped) {
      setIsFlipped(true);
    }
  };

  const handleRating = async (rating: Rating) => {
    if (!currentCard) return;

    const reviewDuration = Date.now() - reviewStartTime;
    const { cardUpdates, logData } = scheduler.review(currentCard, rating);

    try {
      // 1. Update card in DB
      await updateCard(currentCard.id, cardUpdates);
      
      // 2. Save review log
      await addReviewLog({
        ...logData,
        cardId: currentCard.id,
        reviewDuration,
        syncVersion: 1
      });

      // 3. Move to next card
      setIsFlipped(false);
      setCompletedCount(prev => prev + 1);
      setCurrentIndex(prev => prev + 1);
      
    } catch (error) {
      console.error('Failed to save review:', error);
      alert('儲存複習紀錄失敗');
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (!isFlipped) {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          handleFlip();
        }
      } else {
        if (e.code === 'Digit1' || e.code === 'Numpad1') handleRating(Rating.Again);
        else if (e.code === 'Digit2' || e.code === 'Numpad2') handleRating(Rating.Hard);
        else if (e.code === 'Digit3' || e.code === 'Numpad3' || e.code === 'Space') {
          e.preventDefault(); // Space is default 'Good'
          handleRating(Rating.Good);
        }
        else if (e.code === 'Digit4' || e.code === 'Numpad4') handleRating(Rating.Easy);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFlipped, currentCard]); // Re-bind when state changes

  if (dueCards === undefined) {
    return (
      <div className="review-container animate-fadeIn" style={{ margin: '0 auto', maxWidth: '700px', display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="skeleton-text" style={{ width: '200px', marginBottom: 'var(--space-xl)' }}></div>
        <div className="card skeleton-card" style={{ height: '400px' }}></div>
      </div>
    );
  }

  // Session complete or nothing to review
  if (sessionCards.length > 0 && currentIndex >= sessionCards.length || (sessionCards.length === 0 && dueCards.length === 0)) {
    return (
      <div className="review-container animate-fadeIn" style={{ margin: '0 auto', maxWidth: '700px', marginTop: '10vh' }}>
        <EmptyState 
          icon="🎉" 
          title="太棒了！您已完成所有複習" 
          description={`本次複習了 ${completedCount} 張卡片。現在是休息的好時機。`}
        >
          <Link href="/" className="btn btn-primary">
            返回首頁
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (!currentCard) return null;

  const totalCards = sessionCards.length;
  const progressPercent = ((currentIndex) / totalCards) * 100;

  return (
    <div className="review-container animate-fadeIn" style={{ margin: '0 auto', maxWidth: '800px', display: 'flex', flexDirection: 'column', minHeight: '80vh' }}>
      
      {/* Progress Bar & Header */}
      <div style={{ marginBottom: 'var(--space-xl)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-sm)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          <span>複習進度</span>
          <span>{currentIndex + 1} / {totalCards}</span>
        </div>
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
        </div>
      </div>

      {/* Review Card */}
      <div 
        className="review-card" 
        style={{ flex: 1, position: 'relative', marginBottom: 'var(--space-xl)', minHeight: '400px', perspective: '1000px', cursor: isFlipped ? 'default' : 'pointer' }}
        onClick={() => !isFlipped && handleFlip()}
      >
        <div 
          className={`review-card-inner ${isFlipped ? 'flipped' : ''}`}
          style={{ 
            position: 'absolute', width: '100%', height: '100%', 
            transition: 'transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1)', 
            transformStyle: 'preserve-3d' 
          }}
        >
          {/* Front */}
          <div 
            className="card review-card-front" 
            style={{ 
              position: 'absolute', width: '100%', height: '100%', 
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              padding: 'var(--space-2xl)'
            }}
          >
            <MarkdownLatex content={currentCard.front} className="text-center" />
            
            {!isFlipped && (
              <div style={{ position: 'absolute', bottom: 'var(--space-lg)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>
                點擊卡片或按 <kbd style={{ background: 'var(--surface)', padding: '2px 6px', borderRadius: '4px' }}>空白鍵</kbd> 顯示解答
              </div>
            )}
          </div>

          {/* Back */}
          <div 
            className="card review-card-back" 
            style={{ 
              position: 'absolute', width: '100%', height: '100%', 
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              display: 'flex', flexDirection: 'column',
              padding: 'var(--space-2xl)', overflowY: 'auto'
            }}
          >
            <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', borderBottom: '1px dashed var(--glass-border)', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-md)', textAlign: 'center' }}>
              <MarkdownLatex content={currentCard.front} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
              <MarkdownLatex content={currentCard.back} className="text-center" />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="review-actions" style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-md)', flexWrap: 'wrap', minHeight: '80px' }}>
        {isFlipped ? (
          previews?.map(preview => (
            <button 
              key={preview.rating}
              className={`btn rating-btn ${preview.rating === Rating.Again ? 'again' : preview.rating === Rating.Hard ? 'hard' : preview.rating === Rating.Good ? 'good' : 'easy'}`}
              onClick={() => handleRating(preview.rating)}
              style={{ display: 'flex', flexDirection: 'column', padding: 'var(--space-md) var(--space-xl)', flex: '1 1 120px', maxWidth: '200px' }}
            >
              <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, marginBottom: 'var(--space-xs)' }}>{preview.ratingLabel}</span>
              <span style={{ fontSize: 'var(--text-xs)', opacity: 0.8 }}>{preview.interval}</span>
            </button>
          ))
        ) : (
          <button 
            className="btn btn-primary btn-lg" 
            onClick={handleFlip}
            style={{ width: '100%', maxWidth: '300px' }}
          >
            顯示解答
          </button>
        )}
      </div>
    </div>
  );
}
