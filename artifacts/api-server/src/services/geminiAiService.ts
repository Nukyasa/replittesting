import { logger } from "../lib/logger";

// Gemini API Key for ASA Central AI Tender Intelligence (read from environment variable)
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim() || "";

export const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";

export interface ChatMessage {
  role: "user" | "model" | "assistant" | "system";
  content: string;
}

export interface CallGeminiOptions {
  systemPrompt?: string;
  messages: ChatMessage[];
  temperature?: number;
  maxOutputTokens?: number;
  responseJson?: boolean;
}

/**
 * Call Google Gemini API (supporting new AQ. authentication keys)
 */
export async function callGemini(options: CallGeminiOptions): Promise<string | null> {
  const apiKey = GEMINI_API_KEY;
  if (!apiKey) {
    logger.warn("Gemini API key is not configured");
    return null;
  }

  const model = GEMINI_MODEL;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = options.messages
    .filter(m => m.role !== "system")
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const body: any = {
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.2,
      maxOutputTokens: options.maxOutputTokens ?? 2500,
    },
  };

  if (options.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: options.systemPrompt }],
    };
  }

  if (options.responseJson) {
    body.generationConfig.responseMimeType = "application/json";
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      logger.warn({ status: res.status, err: errText }, "Gemini API call failed");
      return null;
    }

    const data: any = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    return reply || null;
  } catch (error: any) {
    logger.error({ error: error?.message || error }, "Error executing Gemini API call");
    return null;
  }
}

/**
 * Check if Gemini AI is available and active
 */
export function isGeminiConfigured(): boolean {
  return Boolean(GEMINI_API_KEY && GEMINI_API_KEY.length > 20);
}
