
import { GoogleGenAI, Type, Schema, Content } from '@google/genai';
import { AnalysisResult, ChatMessage, DiaryEntry, UserPreferences, AiConfig } from '../types';
import { appConfig } from '../config/appConfig';
import { logger } from './logger';

// Default static env key as fallback only
const DEFAULT_API_KEY = process.env.API_KEY || '';

const ANALYSIS_MODEL = appConfig.aiModels.analysis;
const CHAT_MODEL = appConfig.aiModels.chat;

// --- Schemas ---
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    sentimentScore: { type: Type.NUMBER, description: "A number between -1.0 (very negative) and 1.0 (very positive)." },
    mood: {
      type: Type.STRING,
      enum: ["Joyful", "Happy", "Neutral", "Sad", "Anxious", "Angry", "Reflective", "Tired"],
      description: "The dominant mood of the entry.",
    },
    entities: { 
        type: Type.ARRAY, 
        items: { 
            type: Type.OBJECT,
            properties: {
                name: { type: Type.STRING },
                type: { type: Type.STRING, enum: ['Person', 'Location', 'Event', 'Concept', 'Book', 'Movie', 'Other'] }
            },
            required: ["name", "type"]
        }, 
        description: "Extract important entities." 
    },
    summary: { type: Type.STRING, description: "A concise 1-2 sentence summary." },
  },
  required: ["sentimentScore", "mood", "entities", "summary"],
};

const catalogSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        items: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    type: { type: Type.STRING, enum: ['Person', 'Location', 'Event', 'Concept', 'Book', 'Movie', 'Other'] },
                    description: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["name", "type", "description"]
            }
        }
    },
    required: ["items"]
};

const chatResponseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
        text: { type: Type.STRING },
        sentimentScore: { type: Type.NUMBER }
    },
    required: ["text"]
};

// --- Helper: Extract JSON ---
const cleanJson = (text: string): any => {
    try { return JSON.parse(text); } catch (e) {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (match && match[1]) try { return JSON.parse(match[1]); } catch (err) { }
        const objMatch = text.match(/\{[\s\S]*\}/);
        if (objMatch) try { return JSON.parse(objMatch[0]); } catch (err) { }
        throw new Error("Could not parse JSON response from LLM");
    }
};

// --- Helper: Get Client ---
const getClient = (config: AiConfig) => {
    return new GoogleGenAI({ apiKey: config.apiKey || DEFAULT_API_KEY });
};

// --- Helper: Local LLM ---
const callLocalLLM = async (config: AiConfig, messages: any[], jsonMode = false) => {
    const url = config.localUrl || "http://localhost:11434/v1";
    const model = config.localModel || "llama3";
    const endpoint = url.endsWith('/') ? `${url}chat/completions` : `${url}/chat/completions`;

    const body: any = { model, messages, stream: false, temperature: 0.7 };
    if (jsonMode) body.response_format = { type: "json_object" };

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!response.ok) throw new Error(`Local LLM Error: ${response.status}`);
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "";
    } catch (e) {
        logger.error('AI', 'Local LLM Fetch Failed', e);
        throw e;
    }
};

export const geminiService = {
  DEFAULT_PROMPTS: appConfig.prompts.defaults as Record<string, string>,

  analyzeEntry: async (text: string, prefs: UserPreferences | string, config: AiConfig): Promise<AnalysisResult> => {
    if (!text.trim()) throw new Error("Cannot analyze empty text");
    const language = typeof prefs === 'string' ? prefs : (prefs.language || 'English');
    
    const prompt = `Analyze entry. Output Language: ${language}.\nENTRY:\n${text}`;
    const sys = `Analyze. Output JSON {sentimentScore, mood, entities, summary}. Moods: ["Joyful", "Happy", "Neutral", "Sad", "Anxious", "Angry", "Reflective", "Tired"].`;

    try {
        let resultText = "";
        if (config.provider === 'local') {
            resultText = await callLocalLLM(config, [{ role: "system", content: sys }, { role: "user", content: prompt }], true);
        } else {
            const ai = getClient(config);
            const response = await ai.models.generateContent({
                model: ANALYSIS_MODEL,
                contents: prompt,
                config: { responseMimeType: "application/json", responseSchema: analysisSchema, systemInstruction: sys },
            });
            resultText = response.text || "";
        }
        return cleanJson(resultText) as AnalysisResult;
    } catch (error) {
      logger.error('AI', 'Entry Analysis Failed', error);
      return { sentimentScore: 0, mood: "Neutral" as any, entities: [], summary: "Analysis failed." };
    }
  },

  extractCatalog: async (text: string, prefs: UserPreferences | string, config: AiConfig): Promise<any[]> => {
      if (!text.trim()) return [];
      const language = typeof prefs === 'string' ? prefs : (prefs.language || 'English');
      const prompt = `Extract entities. Output Lang: ${language}.\nTEXT:\n${text}`;
      const sys = `Return JSON { items: [{ name, type, description, tags }] }. Types: ['Person', 'Location', 'Event', 'Concept', 'Book', 'Movie', 'Other'].`;

      try {
          let resultText = "";
          if (config.provider === 'local') {
              resultText = await callLocalLLM(config, [{ role: "system", content: sys }, { role: "user", content: prompt }], true);
          } else {
              const ai = getClient(config);
              const response = await ai.models.generateContent({
                  model: ANALYSIS_MODEL,
                  contents: prompt,
                  config: { responseMimeType: "application/json", responseSchema: catalogSchema }
              });
              resultText = response.text || "";
          }
          if (!resultText) return [];
          return cleanJson(resultText).items || [];
      } catch (error) {
          logger.error('AI', 'Catalog Extraction Failed', error);
          return [];
      }
  },

  translate: async (text: string, language: string, config: AiConfig): Promise<string> => {
      try {
          if (config.provider === 'local') return await callLocalLLM(config, [{ role: "user", content: `Translate to ${language}: ${text}` }]);
          const ai = getClient(config);
          const response = await ai.models.generateContent({ model: ANALYSIS_MODEL, contents: `Translate to ${language}:\n${text}` });
          return response.text?.trim() || text;
      } catch (e) { return text; }
  },

  chat: async (
      history: ChatMessage[], 
      newMessage: string, 
      customSystemInstruction: string | undefined, 
      prefsOrLang: UserPreferences | string,
      userBio: string | undefined,
      mode: 'Diary' | 'Interview' = 'Diary',
      config: AiConfig
  ): Promise<{ text: string, sentimentScore?: number }> => {
    try {
      const language = typeof prefsOrLang === 'string' ? prefsOrLang : (prefsOrLang.language || 'English');
      let defaultInstruction = mode === 'Interview' ? (appConfig.prompts.interview as any)[language] : (appConfig.prompts.defaults as any)[language];
      let baseInstruction = customSystemInstruction || defaultInstruction || "You are a helpful assistant.";
      if (userBio) baseInstruction += `\n\nUser Bio:\n${userBio}`;
      
      const fullSystemInstruction = `${baseInstruction}\n\nLanguage: ${language}. Output strictly JSON: { text, sentimentScore }`;

      let rawResponse = "";
      if (config.provider === 'local') {
          const messages = [
              { role: "system", content: fullSystemInstruction },
              ...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })),
              { role: "user", content: newMessage }
          ];
          rawResponse = await callLocalLLM(config, messages, true);
      } else {
          const ai = getClient(config);
          const chat = ai.chats.create({
            model: CHAT_MODEL,
            history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
            config: { systemInstruction: fullSystemInstruction, responseMimeType: "application/json", responseSchema: chatResponseSchema }
          });
          const result = await chat.sendMessage({ message: newMessage });
          rawResponse = result.text || "";
      }

      try {
          const parsed = cleanJson(rawResponse);
          return { text: parsed.text || rawResponse, sentimentScore: parsed.sentimentScore };
      } catch (e) { return { text: rawResponse }; }

    } catch (error) {
      logger.error('AI', 'Chat Error', error);
      return { text: "I'm having trouble connecting right now." };
    }
  },

  chatWithData: async (
      history: ChatMessage[], 
      newMessage: string, 
      allEntries: DiaryEntry[], 
      stats: string, 
      prefsOrLang: UserPreferences | string,
      config: AiConfig
  ): Promise<string> => {
      try {
          const language = typeof prefsOrLang === 'string' ? prefsOrLang : (prefsOrLang.language || 'English');
          const entryContext = allEntries.map(e => `ID:${e.id}|Date:${new Date(e.timestamp).toLocaleDateString()}|Mood:${e.analysis.mood}|Sum:${e.analysis.summary}`).join("\n");
          const systemPrompt = `Role: Data Analyst. Access to diary provided.\nCONTEXT: ${stats}\nENTRIES:\n${entryContext}\nQuery: ${newMessage}\nLang: ${language}`;

          if (config.provider === 'local') {
              const messages = [...history.map(m => ({ role: m.role === 'model' ? 'assistant' : 'user', content: m.text })), { role: "user", content: systemPrompt }];
              return await callLocalLLM(config, messages);
          } else {
              const ai = getClient(config);
              const chat = ai.chats.create({
                  model: CHAT_MODEL,
                  history: history.map(msg => ({ role: msg.role, parts: [{ text: msg.text }] })),
                  config: { systemInstruction: "Analyze user data." }
              });
              const result = await chat.sendMessage({ message: systemPrompt });
              return result.text || "";
          }
      } catch (error) {
          logger.error('AI', 'RAG Chat Error', error);
          return "I'm having trouble analyzing the data right now.";
      }
  }
};
