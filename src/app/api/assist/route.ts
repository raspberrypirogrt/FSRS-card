import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: { apiVersion: 'v1alpha' }
});

function extractJson(text: string) {
  if (!text) throw new Error("AI 沒有回傳任何內容 (可能是因為安全過濾機制攔截)。");
  
  try {
    return JSON.parse(text);
  } catch(e) {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    const firstBracket = text.indexOf('[');
    const lastBracket = text.lastIndexOf(']');
    
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
        return JSON.parse(text.substring(start, end + 1));
      } catch (e2) {
        throw new Error(`無法解析 JSON。原始片段: ${text.substring(start, start + 50)}...`);
      }
    }
    throw new Error(`回傳內容沒有 JSON。原始內容: ${text.substring(0, 100)}...`);
  }
}

export async function POST(req: NextRequest) {
  let rawAiResponse = '';
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

## 輸出格式要求與 JSON 轉義規則 (非常重要)
1. 請維持 Markdown 與 LaTeX 語法（使用 $ 或 $$ 包覆數學公式）。
2. **因為你的輸出必須是嚴格的 JSON 格式，在 JSON 字串中的所有 LaTeX 反斜線 (backslash) 都必須被「雙重轉義 (Double Escaped)」。**
   - 錯誤範例：{"back": "\\lambda \\neq 0"}
   - 正確範例：{"back": "\\\\lambda \\\\neq 0"}
3. 你的輸出必須是合法的 JSON 格式。這非常重要！不要輸出 markdown code block 符號 (\`\`\`json)。
4. 只回傳需要修改後的最終結果，不需要解釋。

產出的 JSON Schema 格式如下：
{
  "front": "修改後的正面內容 (LaTeX 請雙重轉義)",
  "back": "修改後的背面內容 (LaTeX 請雙重轉義)"
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
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      }
    });

    const textResponse = result.text || '';
    rawAiResponse = textResponse;
    
    console.log("\n=== AI ASSIST RAW RESPONSE START ===");
    console.log(rawAiResponse);
    console.log("=== AI ASSIST RAW RESPONSE END ===\n");

    const rawText = textResponse.replace(/^```json/i, '').replace(/```$/i, '').trim();
    const parsedData = extractJson(rawText);

    return NextResponse.json({ 
      front: parsedData.front || front, 
      back: parsedData.back || back 
    });

  } catch (error: any) {
    console.error('AI Assist Error:', error);
    return NextResponse.json({ 
      error: error.message || 'AI 修改失敗',
      rawText: rawAiResponse
    }, { status: 500 });
  }
}
