import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch(e) {
    // 若 JSON.parse 失敗，嘗試從字串中尋找最外層的 {} 或 []
    const start = text.search(/[\{\[]/);
    const end = text.search(/[\}\]][^}\]]*$/);
    if (start !== -1 && end !== -1 && start <= end) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e2) {
        throw new Error("無法解析 AI 回傳的 JSON 格式 (即使經過提取)。");
      }
    }
    throw new Error("AI 回傳的內容不包含有效的 JSON 結構。");
  }
}

export async function POST(req: NextRequest) {
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

## 輸出格式要求
請確保輸出時「務必使用 Markdown 語法」，並且若有數學公式或專業符號，「務必使用 LaTeX 格式」。
你的輸出必須是合法的 JSON 格式。這非常重要！不要輸出 markdown code block 符號 (\`\`\`json)，直接輸出 JSON 字串。

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
        responseMimeType: "application/json",
      }
    });

    const textResponse = result.text || '';
      
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
    return NextResponse.json({ error: error.message || '生成失敗' }, { status: 500 });
  }
}
