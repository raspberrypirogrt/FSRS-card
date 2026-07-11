'use client';
import { useState, useEffect } from 'react';
import { MarkdownLatex } from '@/components/ui/MarkdownLatex';

interface CardEditorProps {
  initialFront?: string;
  initialBack?: string;
  onChange: (front: string, back: string) => void;
}

export function CardEditor({ initialFront = '', initialBack = '', onChange }: CardEditorProps) {
  const [front, setFront] = useState(initialFront);
  const [back, setBack] = useState(initialBack);
  const [activeTab, setActiveTab] = useState<'front' | 'back'>('front');

  // AI 輔助相關 state
  const [isAiPromptOpen, setIsAiPromptOpen] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [isAssisting, setIsAssisting] = useState(false);
  
  // 審查模式 state
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [proposedFront, setProposedFront] = useState('');
  const [proposedBack, setProposedBack] = useState('');

  useEffect(() => {
    onChange(front, back);
  }, [front, back, onChange]);

  const handleAIAssist = async () => {
    if (!aiInstruction.trim()) return;
    setIsAssisting(true);
    try {
      const res = await fetch('/api/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ front, back, instruction: aiInstruction })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      
      setProposedFront(data.front);
      setProposedBack(data.back);
      setIsReviewMode(true);
      setIsAiPromptOpen(false);
      setAiInstruction('');
    } catch (err) {
      console.error(err);
      alert('AI 輔助發生錯誤，請稍後再試。');
    } finally {
      setIsAssisting(false);
    }
  };

  const acceptReview = () => {
    setFront(proposedFront);
    setBack(proposedBack);
    setIsReviewMode(false);
  };

  const rejectReview = () => {
    setIsReviewMode(false);
    setProposedFront('');
    setProposedBack('');
  };

  return (
    <div className="card-editor" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      {/* 標籤頁切換 */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', borderBottom: '1px solid var(--glass-border)' }}>
        <button 
          className={`btn ${activeTab === 'front' ? 'btn-ghost' : ''}`}
          style={{ 
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0', 
            borderBottom: activeTab === 'front' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'front' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
          onClick={() => setActiveTab('front')}
        >
          卡片正面 (題目)
        </button>
        <button 
          className={`btn ${activeTab === 'back' ? 'btn-ghost' : ''}`}
          style={{ 
            borderRadius: 'var(--radius-md) var(--radius-md) 0 0', 
            borderBottom: activeTab === 'back' ? '2px solid var(--accent-primary)' : '2px solid transparent',
            color: activeTab === 'back' ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
          onClick={() => setActiveTab('back')}
        >
          卡片背面 (解答)
        </button>
        <div style={{ flex: 1 }}></div>
        {!isReviewMode && (
          <button 
            className="btn btn-ghost" 
            style={{ color: 'var(--accent-primary)', fontSize: 'var(--text-sm)' }}
            onClick={() => setIsAiPromptOpen(!isAiPromptOpen)}
          >
            ✨ AI 輔助修改
          </button>
        )}
      </div>

      {isAiPromptOpen && !isReviewMode && (
        <div style={{ display: 'flex', gap: 'var(--space-sm)', padding: 'var(--space-sm)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--accent-primary)' }}>
          <input 
            type="text" 
            className="input" 
            style={{ flex: 1 }}
            placeholder="例如：幫我用 LaTeX 排版公式、加上條列式重點..."
            value={aiInstruction}
            onChange={(e) => setAiInstruction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAIAssist()}
          />
          <button className="btn btn-primary" onClick={handleAIAssist} disabled={isAssisting}>
            {isAssisting ? '處理中...' : '送出'}
          </button>
        </div>
      )}

      {isReviewMode && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-sm)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', border: '2px dashed var(--accent-primary)' }}>
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'bold' }}>
            ✨ AI 已經為您修改完成！請在下方預覽結果。
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button className="btn btn-ghost" onClick={rejectReview} style={{ color: 'var(--danger)' }}>
              ❌ 放棄變更
            </button>
            <button className="btn btn-primary" onClick={acceptReview}>
              ✅ 接受並覆蓋
            </button>
          </div>
        </div>
      )}

      <div className="editor-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
        {/* 編輯區 */}
        <div className="editor-pane" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--space-sm) 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Markdown & LaTeX 編輯區 (使用 $$ 插入公式)
          </div>
          <textarea 
            className="textarea" 
            style={{ flex: 1, minHeight: '300px', fontFamily: 'var(--font-mono)', opacity: isReviewMode ? 0.6 : 1 }}
            value={isReviewMode ? (activeTab === 'front' ? proposedFront : proposedBack) : (activeTab === 'front' ? front : back)}
            onChange={(e) => {
              if (isReviewMode) return;
              activeTab === 'front' ? setFront(e.target.value) : setBack(e.target.value);
            }}
            placeholder={activeTab === 'front' ? "例如: $\\lambda$ 稱為方陣 A 的特徵值，若存在非零向量 $v$ 使得..." : "例如: $A v = \\lambda v$"}
            disabled={isReviewMode}
          />
        </div>

        {/* 預覽區 */}
        <div className="preview-pane" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--space-sm) 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            即時預覽
          </div>
          <div 
            className="card" 
            style={{ flex: 1, minHeight: '300px', overflowY: 'auto', cursor: 'pointer', position: 'relative' }}
            onClick={() => setActiveTab(activeTab === 'front' ? 'back' : 'front')}
            title="點擊翻面"
          >
            <div style={{ position: 'absolute', top: '8px', right: '12px', fontSize: 'var(--text-xs)', color: 'var(--text-muted)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
              點擊翻面 🔄
            </div>
            <div style={{ paddingTop: '24px' }}>
              {activeTab === 'front' ? (
                (isReviewMode ? proposedFront : front) ? <MarkdownLatex content={isReviewMode ? proposedFront : front} /> : <span style={{ color: 'var(--text-muted)' }}>尚未輸入內容</span>
              ) : (
                (isReviewMode ? proposedBack : back) ? <MarkdownLatex content={isReviewMode ? proposedBack : back} /> : <span style={{ color: 'var(--text-muted)' }}>尚未輸入內容</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
