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

// --- Helper Functions ---
const sendEvent = (res, event) => {
    res.write(`EVENT: ${JSON.stringify(event)}\n`);
};

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

// Streaming endpoint for holistic analysis
app.post('/api/analyze', async (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
        return res.status(400).send('Missing "files" array in request body.');
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    try {
        const fileContentsString = files.map(f => `// FILE: ${f.path}\n${f.content}`).join('\n\n---\n\n');
        
        // Step 1: Overall Analysis (Streaming)
        sendEvent(res, { type: 'status', message: 'Analyzing overall architecture...' });
        const overallAnalysisStream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: `Analyze the overall architecture of this codebase. What are its strengths and weaknesses? Provide a concise, high-level summary in markdown. Codebase:\n${fileContentsString}`,
        });
        
        let accumulatedAnalysis = '';
        for await (const chunk of overallAnalysisStream) {
            if (chunk.text) {
                accumulatedAnalysis += chunk.text;
                sendEvent(res, { type: 'data', payload: { overallAnalysis: accumulatedAnalysis }});
            }
        }

        // Step 2: Dependency Review
        const packageJsonFile = files.find(f => f.path.endsWith('package.json'));
        if (packageJsonFile) {
            sendEvent(res, { type: 'status', message: 'Reviewing package.json for dependencies...' });
            const depReviewResponse = await ai.models.generateContent({
                model: "gemini-2.5-pro",
                contents: `Analyze this package.json for potential issues like outdated dependencies, security vulnerabilities, or strange configurations. Provide a markdown summary of your analysis and a list of suggestions. package.json:\n${packageJsonFile.content}`,
                config: { responseMimeType: "application/json", responseSchema: { type: Type.OBJECT, properties: { analysis: { type: Type.STRING }, suggestions: { type: Type.ARRAY, items: { type: Type.STRING }}}}}
            });
            sendEvent(res, { type: 'data', payload: { dependencyReview: JSON.parse(depReviewResponse.text.trim()) }});
        }

        // Step 3: Error Trends
        sendEvent(res, { type: 'status', message: 'Identifying common error trends...' });
        const errorTrendsResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Identify up to 3 recurring problems or anti-patterns in this codebase. For each trend, provide a description and a list of files affected. Codebase:\n${fileContentsString}`,
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { trendDescription: { type: Type.STRING }, filesAffected: { type: Type.ARRAY, items: { type: Type.STRING } } } } } }
        });
        sendEvent(res, { type: 'data', payload: { errorTrends: JSON.parse(errorTrendsResponse.text.trim()) }});

        // Step 4: Suggested Fixes
        sendEvent(res, { type: 'status', message: 'Generating suggested fixes...' });
        const suggestedFixesResponse = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: `Based on the codebase, provide a list of up to 5 specific, actionable improvements. For each, give the file path, a markdown description of the fix, and the complete, corrected code for that file. Codebase:\n${fileContentsString}`,
            config: { responseMimeType: "application/json", responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { filePath: { type: Type.STRING }, description: { type: Type.STRING }, correctedCode: { type: Type.STRING } } } } }
        });
        sendEvent(res, { type: 'data', payload: { suggestedFixes: JSON.parse(suggestedFixesResponse.text.trim()) }});

        sendEvent(res, { type: 'status', message: 'Analysis complete.' });
        res.end();

    } catch (error) {
        console.error("Error in /api/analyze stream:", error);
        sendEvent(res, { type: 'status', message: `An error occurred: ${error.message}` });
        res.end();
    }
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('Ensure you have a .env file with your API_KEY.');
});