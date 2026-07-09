import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const { text, prompt, fileBase64, mimeType, modelId } = await req.json();

    const selectedModel = modelId || 'gemini-2.0-flash';
    const model = genAI.getGenerativeModel({ 
      model: selectedModel,
      generationConfig: {
        responseMimeType: "application/json"
      }
    });

    const systemInstruction = `
你是一個專業的記憶卡（Flashcard）產生器。你的任務是從使用者提供的文本或圖片中，萃取核心知識點，並產生高品質的問答卡片。

## 卡片設計原則
1. **精簡扼要**：正面（題目）應該是一個明確的問題或概念名詞；背面（答案）應該是簡潔的解釋。
2. **適度分割**：如果一個觀念太複雜，請將其拆分為多張卡片（Atomic 原則）。
3. **支援 LaTeX**：如果是數學公式或工程數學，請使用 LaTeX 語法（使用 $ 包覆單行公式，$$ 包覆獨立區塊公式）。

## 輸出格式要求
請確保輸出時「務必使用 Markdown 語法」，並且若有數學公式或專業符號，「務必使用 LaTeX 格式」。
你的輸出必須是合法的 JSON 格式。這非常重要！不要輸出 markdown code block 符號 (```json)，直接輸出 JSON 字串。

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
    { "front": "解釋 **Atomic 原則**", "back": "指在製作記憶卡時，一張卡片只測試一個核心概念，避免過度複雜。" }
  ]
}
`;

    const contents: any[] = [];
    
    // 如果有圖片
    if (fileBase64 && mimeType) {
      contents.push({
        inlineData: {
          data: fileBase64,
          mimeType: mimeType
        }
      });
    }

    // 加上使用者提示或預設要求
    const userPrompt = prompt || '請幫我把以下內容轉換成重點記憶卡片。';
    contents.push(userPrompt);

    if (text) {
      contents.push(`\n文本內容：\n${text}`);
    }

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: contents.map(c => typeof c === 'string' ? { text: c } : c) }],
      systemInstruction: { role: 'system', parts: [{ text: systemInstruction }] },
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      }
    });

    const textResponse = result.response.text();
      
    // 有些模型可能會多包一層 ```json，我們手動清掉它以防萬一
    const rawText = textResponse.replace(/^```json/g, '').replace(/```$/g, '').trim();
      
    const parsedData = JSON.parse(rawText);
    let cards = parsedData.cards || [];
      
    // 相容如果 AI 只回傳陣列
    if (Array.isArray(parsedData) && parsedData.length > 0 && parsedData[0].front) {
      cards = parsedData;
    }

    return NextResponse.json({ cards });

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    return NextResponse.json({ error: error.message || '生成失敗' }, { status: 500 });
  }
}
