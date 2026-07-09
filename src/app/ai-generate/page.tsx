'use client';
import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getAllDecks } from '@/lib/db/deckRepo';
import { createCard } from '@/lib/db/cardRepo';
import { useToast } from '@/components/ui/Toast';
import mammoth from 'mammoth';

// Dynamic import for pdfjs will happen inside extractPdfText to avoid SSR DOMMatrix error

interface GeneratedCard {
  id: string; // for UI list key
  front: string;
  back: string;
}

const AI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
];

export default function AIGeneratePage() {
  const decks = useLiveQuery(() => getAllDecks());
  const { showToast } = useToast();
  
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [sourceText, setSourceText] = useState('');
  const [filePreview, setFilePreview] = useState<string>('');
  
  const [isProcessingFile, setIsProcessingFile] = useState(false);
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
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    try {
      setIsProcessingFile(true);
      const fileType = selectedFile.type;

      // 如果是 PDF
      if (fileType === 'application/pdf') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const text = await extractPdfText(arrayBuffer);
        setSourceText(prev => prev + (prev ? '\n\n' : '') + text);
        showToast('PDF 文字萃取成功，已加入文本框中', 'success');
        setFilePreview(''); // 清除圖片預覽
      } 
      // 如果是 Word (.docx)
      else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setSourceText(prev => prev + (prev ? '\n\n' : '') + result.value);
        showToast('Word 文字萃取成功，已加入文本框中', 'success');
        setFilePreview('');
      }
      // 如果是圖片 (支援直接送給 Gemini)
      else if (fileType.startsWith('image/')) {
        if (selectedFile.size > 4 * 1024 * 1024) {
          showToast('圖片大小不能超過 4MB', 'warning');
          return;
        }
        const reader = new FileReader();
        reader.onloadend = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(selectedFile);
      } else {
        showToast('不支援的檔案格式，請上傳圖片、PDF 或 Word (.docx)', 'error');
      }
    } catch (error) {
      console.error('File extraction error:', error);
      showToast('檔案解析失敗', 'error');
    } finally {
      setIsProcessingFile(false);
      // 重置 input，讓同一個檔案可以重複選取
      if (e.target) e.target.value = '';
    }
  };

  const handleGenerate = async () => {
    if (!sourceText.trim() && !filePreview) {
      showToast('請輸入文本或上傳圖片', 'warning');
      return;
    }

    setIsGenerating(true);
    
    try {
      let fileBase64 = '';
      let mimeType = '';
      
      if (filePreview) {
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
          mimeType,
          modelId: selectedModel
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '生成失敗');
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
      setFilePreview('');
      
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
              <textarea 
                className="textarea" 
                rows={6} 
                placeholder="在此貼上筆記內容... 或是上傳 PDF/Word 檔案自動為您解析填入。"
                value={sourceText}
                onChange={e => setSourceText(e.target.value)}
              />
            </div>

            <div className="input-group" style={{ marginBottom: 'var(--space-xl)' }}>
              <label className="input-label">📁 上傳檔案或拍照 (支援 PDF, Word, 圖片)</label>
              <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
                {/* 檔案上傳 */}
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingFile}
                >
                  {isProcessingFile ? '解析中...' : '📂 選擇檔案'}
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".pdf, .docx, image/*" 
                  style={{ display: 'none' }} 
                />
                
                {/* 拍照 */}
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                  onClick={() => cameraInputRef.current?.click()}
                  disabled={isProcessingFile}
                >
                  📷 拍照上傳
                </button>
                <input 
                  type="file" 
                  ref={cameraInputRef} 
                  onChange={handleFileChange} 
                  accept="image/*" 
                  capture="environment" 
                  style={{ display: 'none' }} 
                />
              </div>

              {/* 圖片預覽區塊 */}
              {filePreview && (
                <div style={{ marginTop: 'var(--space-md)', position: 'relative', display: 'inline-block' }}>
                  <img src={filePreview} alt="預覽" style={{ maxHeight: '150px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }} />
                  <button 
                    className="btn-icon" 
                    style={{ position: 'absolute', top: -10, right: -10, background: 'var(--danger)', color: 'white' }}
                    onClick={() => setFilePreview('')}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>

            <button 
              className="btn btn-primary btn-lg" 
              style={{ width: '100%' }}
              onClick={handleGenerate}
              disabled={isGenerating || (!sourceText.trim() && !filePreview)}
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
                    <button 
                      className="btn-icon btn-ghost" 
                      style={{ position: 'absolute', top: 5, right: 5 }}
                      onClick={() => handleDeleteCard(card.id)}
                      title="刪除此卡片"
                    >
                      ✕
                    </button>
                    <div style={{ marginBottom: 'var(--space-sm)' }}>
                      <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '4px' }}>正面 (題目)</strong>
                      <textarea 
                        className="textarea" 
                        value={card.front} 
                        onChange={(e) => handleCardChange(card.id, 'front', e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div>
                      <strong style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)', display: 'block', marginBottom: '4px' }}>背面 (解答)</strong>
                      <textarea 
                        className="textarea" 
                        value={card.back} 
                        onChange={(e) => handleCardChange(card.id, 'back', e.target.value)}
                        rows={3}
                      />
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
