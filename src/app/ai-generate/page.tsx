'use client';
import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllDecks } from '@/lib/db/deckRepo';
import { createCard } from '@/lib/db/cardRepo';
import { useToast } from '@/components/ui/Toast';
import { MarkdownLatex } from '@/components/ui/MarkdownLatex';
import mammoth from 'mammoth';

// Dynamic import for pdfjs will happen inside extractPdfText to avoid SSR DOMMatrix error

interface GeneratedCard {
  id: string; // for UI list key
  front: string;
  back: string;
  isEditing?: boolean; // 新增狀態來控制預覽/編輯
}

const AI_MODELS = [
  { id: 'gemini-3.0-flash', name: 'Gemini 3 Flash' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
];

export default function AIGeneratePage() {
  const decks = useLiveQuery(() => getAllDecks());
  const { showToast } = useToast();
  
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-3.1-flash-lite');
  const [sourceText, setSourceText] = useState('');
  const [filePreviews, setFilePreviews] = useState<{data: string, mimeType: string, id: string}[]>([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const extractPdfText = async (arrayBuffer: ArrayBuffer) => {
    // 動態載入 pdfjs-dist 避免 SSR 報錯 (DOMMatrix is not defined)
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');
      fullText += `--- Page ${i} ---\n${pageText}\n\n`;
    }
    return fullText;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    
    setIsGenerating(true);
    try {
      let appendedText = '';
      const newPreviews = [...filePreviews];

      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        
        if (file.type === 'application/pdf') {
          showToast(`正在解析 PDF: ${file.name}...`, 'info');
          const arrayBuffer = await file.arrayBuffer();
          const text = await extractPdfText(arrayBuffer);
          appendedText += `\n\n--- PDF: ${file.name} ---\n${text}`;
          showToast(`已成功解析 PDF: ${file.name}`, 'success');
        } else if (file.name.endsWith('.docx')) {
          showToast(`正在解析 Word: ${file.name}...`, 'info');
          const arrayBuffer = await file.arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer });
          appendedText += `\n\n--- DOCX: ${file.name} ---\n${result.value}`;
          showToast(`已成功解析 Word: ${file.name}`, 'success');
        } else if (file.type.startsWith('image/')) {
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const result = reader.result as string;
              resolve(result.split(',')[1]); // Only keep base64 data
            };
            reader.readAsDataURL(file);
          });
          
          newPreviews.push({
            id: Math.random().toString(36).substring(7),
            data: base64Data,
            mimeType: file.type
          });
        } else {
          showToast(`不支援的檔案格式: ${file.name}`, 'error');
        }
      }

      if (appendedText) {
        setSourceText(prev => prev + appendedText);
      }
      setFilePreviews(newPreviews);
      
    } catch (err) {
      console.error(err);
      showToast('檔案解析失敗', 'error');
    } finally {
      setIsGenerating(false);
      // 清空 input 讓同一個檔案可以重複選取
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (cameraInputRef.current) cameraInputRef.current.value = '';
    }
  };

  const removeFilePreview = (idToRemove: string) => {
    setFilePreviews(prev => prev.filter(p => p.id !== idToRemove));
  };

  const handleGenerate = async () => {
    if (!sourceText.trim() && filePreviews.length === 0) {
      showToast('請輸入文本或上傳圖片', 'warning');
      return;
    }

    setIsGenerating(true);
    
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: sourceText,
          prompt: "請萃取重點，並轉換為卡片。",
          files: filePreviews,
          modelId: selectedModel
        }),
      });

      const data = await response.json();
      
      if (data.error) {
        if (data.rawText) {
          console.error("=== AI 原始回傳內容 (完整) ===");
          console.error(data.rawText);
          throw new Error(`${data.error}\n(詳細內容已印在 F12 Console)`);
        } else {
          throw new Error(data.error);
        }
      }

      // 為每張卡片加上 UUID，方便在列表中編輯與刪除
      const cardsWithId = (data.cards || []).map((c: any) => ({
        ...c,
        id: Math.random().toString(36).substring(2, 9)
      }));

      setGeneratedCards(cardsWithId);
      showToast(`成功生成 ${cardsWithId.length} 張卡片，請確認後儲存`, 'success');

    } catch (error: any) {
      showToast(error.message || '網路錯誤', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDeleteCard = (id: string) => {
    setGeneratedCards(prev => prev.filter(c => c.id !== id));
  };

  const handleCardChange = (id: string, field: 'front' | 'back', value: string) => {
    setGeneratedCards(prev => prev.map(c => 
      c.id === id ? { ...c, [field]: value } : c
    ));
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
        // 防止空卡片
        if (!card.front.trim() || !card.back.trim()) continue;
        
        await createCard({
          deckId: selectedDeckId,
          front: card.front,
          back: card.back,
          tags: ['AI生成']
        });
        successCount++;
      }
      
      showToast(`成功儲存 ${successCount} 張卡片到牌組！`, 'success');
      setGeneratedCards([]);
      setSourceText('');
      setFilePreviews([]);
      
    } catch (error) {
      showToast('儲存失敗，請稍後再試', 'error');
    }
  };

  return (
    <div className="animate-fadeIn" style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">AI 卡片生成</h1>
          <p className="page-subtitle">上傳筆記、PDF、Word 或直接拍照，讓 AI 為您萃取重點</p>
        </div>
      </div>

      <div className="editor-container" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 'var(--space-lg)' }}>
        
        {/* 左側：輸入區 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">🤖 選擇 AI 模型</label>
              <select 
                className="select"
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {AI_MODELS.map(model => (
                  <option key={model.id} value={model.id}>{model.name}</option>
                ))}
              </select>
            </div>
            
            <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
              <label className="input-label">📝 貼上文本 / 講義文字</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)', marginBottom: 'var(--space-sm)' }}>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => fileInputRef.current?.click()}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        📁 選擇檔案
                      </button>
                      <button 
                        className="btn btn-secondary" 
                        onClick={() => cameraInputRef.current?.click()}
                        style={{ flex: 1, justifyContent: 'center' }}
                      >
                        📷 拍照上傳
                      </button>
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*,.pdf,.docx" 
                      multiple
                      onChange={handleFileChange}
                    />
                    <input 
                      type="file" 
                      ref={cameraInputRef} 
                      style={{ display: 'none' }} 
                      accept="image/*" 
                      capture="environment"
                      multiple
                      onChange={handleFileChange}
                    />
              <textarea 
                className="textarea" 
                rows={6} 
                placeholder="在此貼上筆記內容. 或是上傳 PDF/Word 檔案自動為您解析填入。"
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-xl)' }}>
              {/* 圖片預覽區塊 */}
              {filePreviews.length > 0 && (
                    <div style={{ marginTop: 'var(--space-md)', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
                      {filePreviews.map((preview) => (
                        <div key={preview.id} style={{ position: 'relative', width: '100px', height: '100px' }}>
                          <img 
                            src={`data:${preview.mimeType};base64,${preview.data}`} 
                            alt="preview" 
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }} 
                          />
                          <button 
                            className="btn-icon btn-ghost" 
                            style={{ position: 'absolute', top: -8, right: -8, background: 'var(--surface)', border: '1px solid var(--glass-border)', borderRadius: '50%', padding: '4px', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => removeFilePreview(preview.id)}
                            title="移除圖片"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%' }}
              onClick={handleGenerate}
              disabled={isGenerating || (!sourceText.trim() && filePreviews.length === 0)}
            >
              {isGenerating ? '🔄 AI 正在萃取知識點...' : '✨ 魔術生成'}
            </button>
          </div>
        </div>

        {/* 右側：預覽與編輯區 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {generatedCards.length > 0 ? (
            <div className="card" style={{ padding: 'var(--space-lg)', flex: 1, display: 'flex', flexDirection: 'column', maxHeight: '80vh' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
                <h3 style={{ fontSize: 'var(--text-lg)' }}>確認生成結果 ({generatedCards.length} 張)</h3>
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>您可以直接修改內容或刪除不需要的卡片</span>
              </div>
              
              <div style={{ flex: 1, overflowY: 'auto', paddingRight: 'var(--space-sm)' }}>
                {generatedCards.map((card, idx) => (
                  <div key={card.id} style={{ marginBottom: 'var(--space-md)', padding: 'var(--space-md)', background: 'var(--surface)', borderRadius: 'var(--radius-md)', position: 'relative' }}>
                    <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-icon btn-ghost" 
                        onClick={() => handleCardChange(card.id, 'isEditing' as any, card.isEditing ? false : true as any)}
                        title={card.isEditing ? "切換至預覽" : "切換至編輯"}
                      >
                        {card.isEditing ? '👁️' : '✏️'}
                      </button>
                      <button 
                        className="btn-icon btn-ghost" 
                        onClick={() => handleDeleteCard(card.id)}
                        title="刪除此卡片"
                      >
                        ✕
                      </button>
                    </div>

                    {!card.isEditing ? (
                      <div style={{ marginTop: '24px' }}>
                        <div style={{ marginBottom: 'var(--space-md)' }}>
                          <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '8px' }}>正面 (題目)</strong>
                          <div style={{ padding: 'var(--space-sm)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                            <MarkdownLatex content={card.front} />
                          </div>
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '8px' }}>背面 (解答)</strong>
                          <div style={{ padding: 'var(--space-sm)', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                            <MarkdownLatex content={card.back} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ marginTop: '24px' }}>
                        <div style={{ marginBottom: 'var(--space-sm)' }}>
                          <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '4px' }}>正面 (題目)</strong>
                          <textarea 
                            className="textarea" 
                            value={card.front} 
                            onChange={(e) => handleCardChange(card.id, 'front', e.target.value)}
                            rows={3}
                            style={{ fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                        <div>
                          <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '4px' }}>背面 (解答)</strong>
                          <textarea 
                            className="textarea" 
                            value={card.back} 
                            onChange={(e) => handleCardChange(card.id, 'back', e.target.value)}
                            rows={4}
                            style={{ fontFamily: 'var(--font-mono)' }}
                          />
                        </div>
                      </div>
                    )}
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
                  disabled={!selectedDeckId || generatedCards.length === 0}
                >
                  📥 全部儲存到牌組
                </button>
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 'var(--space-lg)', flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '4rem', marginBottom: 'var(--space-md)', opacity: 0.5 }}>🤖</div>
                <p>AI 生成的卡片將顯示在這裡<br/>您可以在儲存前修改它們</p>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
