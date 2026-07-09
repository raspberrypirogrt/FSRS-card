'use client';
import { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllDecks } from '@/lib/db/deckRepo';
import { createCard } from '@/lib/db/cardRepo';
import { useToast } from '@/components/ui/Toast';
import { MarkdownLatex } from '@/components/ui/MarkdownLatex';

interface GeneratedCard {
  front: string;
  back: string;
}

export default function AIGeneratePage() {
  const decks = useLiveQuery(() => getAllDecks());
  const { showToast } = useToast();
  
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string>('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 4 * 1024 * 1024) {
        showToast('檔案大小不能超過 4MB', 'warning');
        return;
      }
      setFile(selectedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result as string);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleGenerate = async () => {
    if (!sourceText.trim() && !file) {
      showToast('請輸入文本或上傳圖片', 'warning');
      return;
    }

    setIsGenerating(true);
    setGeneratedCards([]);
    
    try {
      let fileBase64 = '';
      let mimeType = '';
      
      if (filePreview) {
        // 從 data:image/jpeg;base64,... 中分離
        const parts = filePreview.split(',');
        if (parts.length === 2) {
          const match = parts[0].match(/:(.*?);/);
          if (match) mimeType = match[1];
          fileBase64 = parts[1];
        }
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          fileBase64,
          mimeType
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '生成失敗');
      }

      setGeneratedCards(data.cards || []);
      showToast('成功生成卡片，請確認後儲存', 'success');

    } catch (error: any) {
      showToast(error.message || '網路錯誤', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAll = async () => {
    if (!selectedDeckId) {
      showToast('請先選擇要儲存的牌組', 'warning');
      return;
    }
    
    if (generatedCards.length === 0) return;

    try {
      let successCount = 0;
      for (const card of generatedCards) {
        await createCard({
          deckId: selectedDeckId,
          front: card.front,
          back: card.back,
          tags: ['AI生成']
        });
        successCount++;
      }
      
      showToast(`成功儲存 ${successCount} 張卡片到牌組！`, 'success');
      setGeneratedCards([]); // 清空已儲存的卡片
      setSourceText('');
      setFile(null);
      setFilePreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      
    } catch (error) {
      showToast('儲存失敗，請稍後再試', 'error');
    }
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI 卡片生成</h1>
          <p className="page-subtitle">上傳筆記或講義截圖，讓 AI 自動為您萃取重點</p>
        </div>
      </div>

      <div className="editor-container" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-lg)' }}>
        
        {/* 左側：輸入區 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-lg)' }}>輸入資料來源</h3>
            
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">📝 貼上文本 / 講義文字</label>
              <textarea 
                className="textarea" 
                rows={6} 
                placeholder="在此貼上筆記內容... AI 將為您整理成問答卡片。"
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-xl)' }}>
              <label className="input-label">🖼️ 上傳圖片 (數學題、圖表、截圖)</label>
              <div 
                style={{ 
                  border: '2px dashed var(--glass-border)', 
                  borderRadius: 'var(--radius-md)', 
                  padding: 'var(--space-md)',
                  textAlign: 'center',
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                {filePreview ? (
                  <div>
                    <img src={filePreview} alt="預覽" style={{ maxHeight: '150px', maxWidth: '100%', objectFit: 'contain' }} />
                    <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: 'var(--space-xs)' }}>點擊更換圖片</div>
                  </div>
                ) : (
                  <div style={{ color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: 'var(--space-xs)' }}>📁</div>
                    點擊選擇圖片 (支援 JPG, PNG)
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  style={{ display: 'none' }} 
                />
              </div>
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%' }}
              onClick={handleGenerate}
              disabled={isGenerating || (!sourceText.trim() && !file)}
            >
              {isGenerating ? '🔄 AI 正在萃取知識點...' : '✨ 魔術生成'}
            </button>
          </div>
        </div>

        {/* 右側：預覽與儲存區 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {generatedCards.length > 0 ? (
            <div className="card" style={{ padding: 'var(--space-lg)', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>預覽生成結果 ({generatedCards.length} 張)</h3>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '50vh', paddingRight: 'var(--space-sm)' }}>
                {generatedCards.map((card, idx) => (
                  <div key={idx} style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                      <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>正面 (Q)</strong>
                      <div><MarkdownLatex content={card.front} /></div>
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>背面 (A)</strong>
                      <div><MarkdownLatex content={card.back} /></div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'var(--space-lg)', paddingTop: 'var(--space-md)', borderTop: '1px solid var(--glass-border)' }}>
                <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
                  <label className="input-label">選擇儲存目標牌組</label>
                  <select 
                    className="select"
                    value={selectedDeckId}
                    onChange={(e) => setSelectedDeckId(e.target.value)}
                  >
                    <option value="" disabled>請選擇牌組...</option>
                    {decks?.map(deck => (
                      <option key={deck.id} value={deck.id}>{deck.icon} {deck.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="btn btn-success btn-lg" 
                  style={{ width: '100%', background: 'var(--success)', color: 'white' }}
                  onClick={handleSaveAll}
                  disabled={!selectedDeckId}
                >
                  📥 全部儲存到牌組
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 'var(--space-lg)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', opacity: 0.5 }}>🤖</div>
                <p>AI 生成的卡片將顯示在這裡</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
