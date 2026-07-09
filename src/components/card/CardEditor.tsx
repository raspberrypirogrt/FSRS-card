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

  useEffect(() => {
    onChange(front, back);
  }, [front, back, onChange]);

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
      </div>

      <div className="editor-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 'var(--space-md)' }}>
        {/* 編輯區 */}
        <div className="editor-pane" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--space-sm) 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            Markdown & LaTeX 編輯區 (使用 $$ 插入公式)
          </div>
          <textarea 
            className="textarea" 
            style={{ flex: 1, minHeight: '300px', fontFamily: 'var(--font-mono)' }}
            value={activeTab === 'front' ? front : back}
            onChange={(e) => activeTab === 'front' ? setFront(e.target.value) : setBack(e.target.value)}
            placeholder={activeTab === 'front' ? "例如: $\\lambda$ 稱為方陣 A 的特徵值，若存在非零向量 $v$ 使得..." : "例如: $A v = \\lambda v$"}
          />
        </div>

        {/* 預覽區 */}
        <div className="preview-pane" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: 'var(--space-sm) 0', fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
            即時預覽
          </div>
          <div className="card" style={{ flex: 1, minHeight: '300px', overflowY: 'auto' }}>
            {activeTab === 'front' ? (
              front ? <MarkdownLatex content={front} /> : <span style={{ color: 'var(--text-muted)' }}>尚未輸入內容</span>
            ) : (
              back ? <MarkdownLatex content={back} /> : <span style={{ color: 'var(--text-muted)' }}>尚未輸入內容</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
