import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 });
    }

    const { text, prompt, fileBase64, mimeType, modelId } = await req.json();

    const selectedModel = modelId || 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({ model: selectedModel });

    const systemInstruction = `
你是一個專業的記憶卡（Flashcard）產生器。你的任務是從使用者提供的文本或圖片中，萃取核心知識點，並產生高品質的問答卡片。
這些卡片將被用於間隔重複學習（Spaced Repetition）。

**要求：**
1. **精準度**：問題必須明確，答案必須精確簡潔。
2. **適度分割**：如果一個觀念太複雜，請將其拆分為多張卡片（Atomic 原則）。
3. **支援 LaTeX**：如果是數學公式或工程數學，請使用 LaTeX 語法（使用 $ 包覆單行公式，$$ 包覆獨立區塊公式）。
4. **輸出格式**：你必須嚴格輸出 JSON 陣列格式，不要包含額外的 Markdown 標籤，只能輸出純 JSON。
例如：
[
  { "front": "什麼是 $E=mc^2$？", "back": "質能等價公式，表示質量與能量的轉換關係。" }
]
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

    const responseText = result.response.text();
    let cards = [];
    
    try {
      cards = JSON.parse(responseText);
    } catch (e) {
      // 嘗試清理 markdown 區塊
      const cleaned = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
      cards = JSON.parse(cleaned);
    }

    return NextResponse.json({ cards });

  } catch (error: any) {
    console.error('AI Generation Error:', error);
    return NextResponse.json({ error: error.message || '生成失敗' }, { status: 500 });
  }
}
