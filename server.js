import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increase limit for large repos

// Check for API Key
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("FATAL ERROR: API_KEY is not defined in your .env file.");
  process.exit(1);
}

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- API Endpoints ---

// Endpoint for streaming code review
app.post('/api/review', async (req, res) => {
  const { code, fileName } = req.body;
  if (!code || !fileName) {
    return res.status(400).send('Missing code or fileName in request body.');
  }

  try {
    const prompt = `
      You are an expert senior software engineer and code reviewer.
      Your task is to review the following code from the file named "${fileName}".
      Please analyze it carefully for bugs, performance, style, and security.
      First, stream a detailed, markdown-formatted review. For each issue, reference line numbers using the format <span data-lines="15-18">L15-18</span>.
      After all comments, add the separator "<<CODE_SEPARATOR>>" on a new line.
      Finally, after the separator, provide the full, corrected version of the code in a markdown code block.
      Code to review:
      \`\`\`
      ${code}
      \`\`\`
    `;

    const responseStream = await ai.models.generateContentStream({
      model: "gemini-2.5-pro",
      contents: prompt,
    });
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
    res.end();
  } catch (error) {
    console.error("Error in /api/review:", error);
    res.status(500).send('Failed to get code review from Gemini API.');
  }
});

// Endpoint for linting
app.post('/api/lint', async (req, res) => {
    const { code, fileName } = req.body;
    if (!code || !fileName) {
        return res.status(400).send('Missing code or fileName in request body.');
    }
    try {
        const prompt = `
            You are an expert code linter and formatter. Your task is to take the following code from "${fileName}" and automatically fix all formatting and style issues.
            Do NOT make any logical changes. Return ONLY the full, corrected code inside a single markdown code block.
            Original code:
            \`\`\`
            ${code}
            \`\`\`
        `;
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        });
        res.json({ text: response.text });
    } catch (error) {
        console.error("Error in /api/lint:", error);
        res.status(500).send('Failed to get linted code from Gemini API.');
    }
});

// Endpoint for holistic analysis
app.post('/api/analyze', async (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
        return res.status(400).send('Missing "files" array in request body.');
    }
    try {
        const fileContentsString = files.map(f => `// FILE: ${f.path}\n${f.content}`).join('\n\n---\n\n');
        const prompt = `
            You are an expert solution architect. Conduct a holistic audit of this codebase. Return a JSON object with your findings.
            Your analysis must cover:
            1.  **Overall Analysis:** High-level architecture, strengths, weaknesses.
            2.  **Dependency Review:** Analyze package.json for issues.
            3.  **Error Trends:** Identify recurring problems across multiple files.
            4.  **Suggested Fixes:** A list of concrete fixes, each with a file path, description, and the complete corrected code.
            Codebase:
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
                        dependencyReview: { type: Type.OBJECT, properties: { analysis: { type: Type.STRING }, suggestions: { type: Type.ARRAY, items: { type: Type.STRING } } } },
                        errorTrends: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { trendDescription: { type: Type.STRING }, filesAffected: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
                        suggestedFixes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING }, description: { type: Type.STRING }, correctedCode: { type: Type.STRING } } } }
                    },
                    required: ["overallAnalysis", "dependencyReview", "errorTrends", "suggestedFixes"]
                }
            }
        });
        res.json(JSON.parse(response.text.trim()));
    } catch (error) {
        console.error("Error in /api/analyze:", error);
        res.status(500).send('Failed to get repository analysis from Gemini API.');
    }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('Ensure you have a .env file with your API_KEY.');
});
