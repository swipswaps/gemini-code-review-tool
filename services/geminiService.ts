import { GoogleGenAI } from "@google/genai";

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
      
      After you have finished writing all the review comments, add a separator token "<<CODE_SEPARATOR>>" on a new line by itself.

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
