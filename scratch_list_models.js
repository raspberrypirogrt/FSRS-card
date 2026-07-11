const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const apiKeyMatch = envFile.match(/GEMINI_API_KEY=(.+)/);
const apiKey = apiKeyMatch ? apiKeyMatch[1].trim() : '';

async function run() {
  const ai = new GoogleGenAI({ 
    apiKey: apiKey,
    httpOptions: { apiVersion: 'v1alpha' }
  });
  
  try {
    const response = await ai.models.list();
    const models = [];
    for await (const model of response) {
      if (model.name.includes('gemini')) {
        models.push(model.name);
      }
    }
    console.log("Found Gemini models:", models.filter(m => m.includes('3')));
  } catch (err) {
    console.error(err);
  }
}

run();
