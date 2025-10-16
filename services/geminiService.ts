
import { GoogleGenAI, Type } from "@google/genai";
import type { ReviewResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const reviewSchema = {
  type: Type.OBJECT,
  properties: {
    reviewComments: {
      type: Type.STRING,
      description: "A detailed, markdown-formatted review of the code. Explain the issues found (e.g., bugs, performance, style, best practices) and the reasoning behind the corrections.",
    },
    correctedCode: {
      type: Type.STRING,
      description: "The full, corrected version of the provided code snippet, ready to be used as a replacement.",
    },
  },
  required: ["reviewComments", "correctedCode"],
};

export async function reviewCode(code: string, fileName: string): Promise<ReviewResult> {
  try {
    const prompt = `
      You are an expert senior software engineer and code reviewer.
      Your task is to review the following code from the file named "${fileName}".
      
      Please analyze it carefully for any of the following issues:
      - Bugs and logical errors
      - Performance optimizations
      - Adherence to modern best practices (e.g., React hooks rules, async/await usage)
      - Code style and readability
      - Security vulnerabilities
      - Type safety (if applicable, e.g., TypeScript)

      Provide a corrected, complete version of the file and a summary of your review.
      The corrected code should be a drop-in replacement for the original file content.
      The review comments should be in Markdown format.

      Here is the code:
      \`\`\`
      ${code}
      \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: reviewSchema,
      },
    });
    
    const jsonText = response.text.trim();
    const result = JSON.parse(jsonText) as ReviewResult;

    if (!result.correctedCode || !result.reviewComments) {
        throw new Error("Invalid response format from API.");
    }
    
    return result;

  } catch (error) {
    console.error("Error reviewing code:", error);
    throw new Error("Failed to get code review from Gemini API. Please check your API key and network connection.");
  }
}
