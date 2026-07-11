import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function extractJson(text: string) {
  try {
    return JSON.parse(text);
  } catch(e) {
    const start = text.search(/[\{\[]/);
    const end = text.search(/[\}\]][^}\]]*$/);
    if (start !== -1 && end !== -1 && start <= end) {
      try {
        return JSON.parse(text.substring(start, end + 1));
      } catch (e2) {
        throw new Error("無法解析 AI 回傳的 JSON 格式。");
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

    const { front, back, instruction } = await req.json();

    if (!instruction) {
      return NextResponse.json({ error: '請提供修改需求指令' }, { status: 400 });
    }

    const systemInstruction = `
你是一個專業的記憶卡（Flashcard）編輯助手。使用者的卡片可能包含 Markdown 與 LaTeX 語法。
你的任務是根據「使用者的修改需求指令」，去修改使用者提供的「卡片正面」與「卡片背面」，並回傳修改後的結果。

## 輸出格式要求
1. 請維持 Markdown 與 LaTeX 語法（使用 $ 或 $$ 包覆數學公式）。
2. 你的輸出必須是合法的 JSON 格式。這非常重要！不要輸出 markdown code block 符號 (\`\`\`json)。
3. 只回傳需要修改後的最終結果，不需要解釋。

產出的 JSON Schema 格式如下：
{
  "front": "修改後的正面內容",
  "back": "修改後的背面內容"
}
`;

    const userPrompt = `
目前的卡片內容：
【正面】：
${front}

【背面】：
${back}

使用者的修改需求指令：
${instruction}

請依據需求修改卡片，並回傳 JSON。`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
        responseMimeType: "application/json",
      }
    });

    const textResponse = result.text || '';
    const rawText = textResponse.replace(/^```json/i, '').replace(/```$/i, '').trim();
    const parsedData = extractJson(rawText);

    return NextResponse.json({ 
      front: parsedData.front || front, 
      back: parsedData.back || back 
    });

  } catch (error: any) {
    console.error('AI Assist Error:', error);
    return NextResponse.json({ error: error.message || 'AI 修改失敗' }, { status: 500 });
  }
}
