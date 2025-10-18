import { GoogleGenAI, Type } from "@google/genai";
import { CODE_SEPARATOR } from '../utils/constants';
import type { HolisticAnalysisResult } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });


export async function* reviewCodeStream(code: string, fileName: string): AsyncGenerator<string> {
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

      First, stream a detailed, markdown-formatted review of the code. Explain the issues you find and the reasoning behind your proposed corrections.
      For each distinct issue, reference the relevant line number(s) from the original code by wrapping them in a special HTML tag, for example: <span data-lines="15-18">L15-18</span>. This is critical for the UI to highlight the code.
      
      After you have finished writing all the review comments, add a separator token "${CODE_SEPARATOR}" on a new line by itself.

      Finally, after the separator, provide the full, corrected version of the code snippet in a markdown code block. This corrected code should be a drop-in replacement for the original file content.
      
      Here is the code to review:
      \`\`\`
      ${code}
      \`\`\`
    `;

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-pro",
      contents: prompt,
    });
    
    for await (const chunk of responseStream) {
        if (chunk.text) {
            yield chunk.text;
        }
    }

  } catch (error) {
    console.error("Error reviewing code:", error);
    throw new Error("Failed to get code review from Gemini API. Please check your API key and network connection.");
  }
}

export async function lintCode(code: string, fileName: string): Promise<string> {
  try {
    const prompt = `
      You are an expert code linter and formatter, acting like a combination of Prettier and ESLint with auto-fix enabled.
      Your task is to take the following code from the file named "${fileName}" and automatically fix all formatting, style, and minor convention issues.
      Do NOT make any logical changes, add features, or perform a detailed review. Your only goal is to clean up the existing code.

      Specifically:
      - Standardize indentation and spacing.
      - Enforce consistent code style.
      - Apply modern syntax where appropriate (e.g., const/let over var).
      - Remove unnecessary code or comments if they are truly redundant.

      Return ONLY the full, corrected code inside a single markdown code block. Do not add any explanation, preamble, or separator tokens.

      Original code:
      \`\`\`
      ${code}
      \`\`\`
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const text = response.text;
    if (!text) {
      throw new Error("Received an empty response from the Gemini API.");
    }
    
    const codeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1].trim();
    }
    
    // Fallback if the model doesn't use a markdown block
    return text.trim();

  } catch (error) {
    console.error("Error linting code:", error);
    throw new Error("Failed to get linted code from Gemini API.");
  }
}

export const analyzeRepositoryHolistically = async (
  files: { path: string; content: string }[]
): Promise<HolisticAnalysisResult> => {
    try {
        const fileContentsString = files.map(f => `
// FILE: ${f.path}
// --- START OF FILE ---
${f.content}
// --- END OF FILE ---
`).join('\n\n---\n\n');

        const prompt = `
            You are an expert solution architect and senior software engineer conducting a holistic audit of an entire codebase.
            I will provide you with the contents of all the files in the repository.

            Your task is to perform a comprehensive analysis and return a JSON object with your findings. The JSON object must conform to the specified schema.

            Your analysis should cover these key areas:
            1.  **Overall Analysis:** A high-level summary of the repository's architecture, purpose, strengths, and major weaknesses.
            2.  **Dependency Review:** If a package.json or similar dependency file is present, analyze the dependencies. Look for outdated packages, security vulnerabilities, or questionable choices. Provide a summary and a list of suggestions.
            3.  **Error Trends:** Identify recurring problems, anti-patterns, or "code smells" that appear across multiple files. For each trend, describe it and list the files where it was observed.
            4.  **Suggested Fixes:** Provide a list of concrete, actionable fixes for specific files. For each fix, specify the file path, a clear description of the issue and your proposed change, and the complete, corrected code for that file. The corrected code should be a drop-in replacement.

            Here is the codebase:
            ${fileContentsString}
        `;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        overallAnalysis: { type: Type.STRING },
                        dependencyReview: {
                            type: Type.OBJECT,
                            properties: {
                                analysis: { type: Type.STRING },
                                suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
                            },
                             required: ["analysis"]
                        },
                        errorTrends: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    trendDescription: { type: Type.STRING },
                                    filesAffected: { type: Type.ARRAY, items: { type: Type.STRING } }
                                },
                                required: ["trendDescription", "filesAffected"]
                            }
                        },
                        suggestedFixes: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    filePath: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                    correctedCode: { type: Type.STRING }
                                },
                                required: ["filePath", "description", "correctedCode"]
                            }
                        }
                    },
                    required: ["overallAnalysis", "dependencyReview", "errorTrends", "suggestedFixes"]
                }
            }
        });

        const jsonText = response.text.trim();
        return JSON.parse(jsonText) as HolisticAnalysisResult;

    } catch (error) {
        console.error("Error analyzing repository holistically:", error);
        throw new Error("Failed to get repository analysis from Gemini API. The model may have returned an invalid JSON structure.");
    }
};