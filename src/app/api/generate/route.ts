import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { apiVersion: 'v1alpha' } // 嘗試使用 v1alpha 以支援最新測試版模型
});

function extractJson(text: string) {
  if (!text) throw new Error("AI 沒有回傳任何內容 (可能是因為圖片過大或安全過濾機制攔截)。");
  
  // 自動修復 AI 常犯的 LaTeX 單斜線轉義問題 (把 \ 改成 \\，但不影響 \" 與 \\)
  const cleanedText = text.replace(/(?<!\\)\\([^\\"])/g, '\\\\$1');

  try {
    return JSON.parse(cleanedText);
  } catch(e) {
    const firstBrace = cleanedText.indexOf('{');
    const lastBrace = cleanedText.lastIndexOf('}');
    const firstBracket = cleanedText.indexOf('[');
    const lastBracket = cleanedText.lastIndexOf(']');
    
    let start = -1;
    let end = -1;
    
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      start = firstBrace;
      end = lastBrace;
    }
    if (firstBracket !== -1 && lastBracket !== -1 && firstBracket < lastBracket) {
      if (start === -1 || (firstBracket < start && lastBracket > end)) {
        start = firstBracket;
        end = lastBracket;
      }
    }
    
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(cleanedText.substring(start, end + 1));
      } catch (e2) {
        throw new Error(`無法解析 JSON。原始片段: ${cleanedText.substring(start, start + 50)}...`);
      }
    }
    throw new Error(`回傳內容沒有 JSON。原始內容: ${cleanedText.substring(0, 100)}...`);
  }
}

export async function POST(req: NextRequest) {
  let rawAiResponse = '';
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY 尚未設定' }, { status: 500 });
    }

    const { text, prompt, files, modelId } = await req.json();

    const selectedModel = modelId || 'gemini-3.1-flash-lite';

    const systemInstruction = `
你是一個專業的記憶卡（Flashcard）產生器。你的任務是從使用者提供的文本或圖片中，萃取核心知識點，並產生高品質的問答卡片。

## 卡片設計原則
1. **精簡扼要**：正面（題目）應該是一個明確的問題或概念名詞；背面（答案）應該是簡潔的解釋。
2. **適度分割**：如果一個觀念太複雜，請將其拆分為多張卡片（Atomic 原則）。
3. **支援 LaTeX**：如果是數學公式或工程數學，請使用 LaTeX 語法（使用 $ 包覆單行公式，$$ 包覆獨立區塊公式）。

## 輸出格式要求與 JSON 轉義規則 (非常重要)
請確保輸出時「務必使用 Markdown 語法」，並且若有數學公式或專業符號，「務必使用 LaTeX 格式」。
**如果需要在卡片內容中換行，請絕對不要使用 \\n，請一律使用 HTML 標籤 <br> 來產生換行。**

**因為你的輸出必須是嚴格的 JSON 格式，在 JSON 字串中的所有 LaTeX 反斜線 (backslash) 都必須被「雙重轉義 (Double Escaped)」。**
- 錯誤範例 (會導致解析失敗)：{"back": "特徵值為 \\lambda，且 \\neq 0"}
- 正確範例 (雙重轉義)：{"back": "特徵值為 \\\\lambda，且 \\\\neq 0"}
- 正確範例 (雙重轉義)：{"back": "分子為 \\\\frac{1}{2}"}

不要輸出 markdown code block 符號 (\`\`\`json)，直接輸出 JSON 字串。

產出的 JSON Schema 格式如下：
{
  "cards": [
    { "front": "問題或知識點正面", "back": "答案或知識點背面" }
  ]
}

例如：
{
  "cards": [
    { "front": "什麼是 $E=mc^2$？", "back": "質能等價公式，表示質量與能量的轉換關係。" },
    { "front": "特徵值的定義？", "back": "若存在非零向量 $v$ 使得 $Av = \\\\lambda v$，則稱 \\\\lambda 為特徵值。" }
  ]
}
`;

    const parts: any[] = [];
    
    // 加上使用者提示或預設要求
    const userPrompt = prompt || '請幫我把以下內容轉換成重點記憶卡片。';
    parts.push({ text: userPrompt });

    if (text) {
      parts.push({ text: `\n文本內容：\n${text}` });
    }

    // 如果有多張圖片
    if (files && Array.isArray(files)) {
      files.forEach((file) => {
        if (file.data && file.mimeType) {
          parts.push({
            inlineData: {
              data: file.data,
              mimeType: file.mimeType
            }
          });
        }
      });
    }

    const result = await ai.models.generateContent({
      model: selectedModel,
      contents: [{ role: 'user', parts: parts }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        maxOutputTokens: 8192, // 明確指定最大 token，防止 Lite 模型提早截斷
        responseMimeType: "application/json",
      }
    });

    const textResponse = result.text || '';
    rawAiResponse = textResponse; // 保存以便除錯

    console.log("\n=== AI RAW RESPONSE START ===");
    console.log(rawAiResponse);
    console.log("=== AI RAW RESPONSE END ===\n");
      
    // 進行手動清理與防呆
    const rawText = textResponse.replace(/^```json/i, '').replace(/```$/i, '').trim();
      
    const parsedData = extractJson(rawText);
    let cards = parsedData.cards || [];
      
    // 相容如果 AI 只回傳陣列
    if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].front) {
      cards = parsedData;
    }

    return NextResponse.json({ cards });

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    return NextResponse.json({ 
      error: error.message || '生成失敗',
      rawText: rawAiResponse
    }, { status: 500 });
  }
}
