import { GoogleGenAI } from "@google/genai";
import { DataRow } from "../types";

// Safety check for API Key
const apiKey = process.env.API_KEY;

export const analyzeData = async (
  data: DataRow[],
  columns: string[],
  userPrompt?: string
): Promise<string> => {
  if (!apiKey) {
    return "Error: API Key not configured in environment.";
  }

  const ai = new GoogleGenAI({ apiKey });

  // Truncate data to avoid excessive tokens, send first 25 rows
  const sampleData = data.slice(0, 25);
  const dataString = JSON.stringify(sampleData, null, 2);
  
  const basePrompt = `
    You are an expert data analyst. 
    Analyze the following dataset (showing first 25 rows).
    Columns: ${columns.join(', ')}
    
    Dataset:
    ${dataString}
  `;

  const specificPrompt = userPrompt 
    ? `User Question: ${userPrompt}`
    : `Please provide a concise summary of this data, identifying patterns, outliers, or interesting trends. Format the output in Markdown.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `${basePrompt}\n\n${specificPrompt}`,
      config: {
        thinkingConfig: { thinkingBudget: 0 } // Speed over deep thinking for UI responsiveness
      }
    });

    return response.text || "No analysis could be generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to analyze data via Gemini. Please check your connection or API limits.";
  }
};
