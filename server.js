
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


// Helper to perform a streaming analysis task
const performStreamingTask = async (res, taskId, taskTitle, prompt) => {
    sendEvent(res, { type: 'task_start', id: taskId, title: taskTitle });
    try {
        const responseStream = await ai.models.generateContentStream({
            model: "gemini-2.5-pro",
            contents: prompt,
        });

        for await (const chunk of responseStream) {
            if (chunk.text) {
                sendEvent(res, { type: 'task_chunk', id: taskId, chunk: chunk.text });
            }
        }
        sendEvent(res, { type: 'task_end', id: taskId });
    } catch (error) {
        console.error(`Error during task "${taskTitle}":`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        sendEvent(res, { type: 'task_end', id: taskId, error: errorMessage });
        throw error; // Propagate to stop the main analysis
    }
};

// Streaming endpoint for holistic analysis
app.post('/api/analyze', async (req, res) => {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) {
        return res.status(400).send('Missing "files" array in request body.');
    }
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    try {
        // Make the "context building" step visible to the client
        for (const file of files) {
            sendEvent(res, { type: 'processing_file', path: file.path });
            // Add a small delay to ensure the event is rendered on the frontend
            await new Promise(resolve => setTimeout(resolve, 20)); 
        }

        const fileContentsString = files.map(file => `// FILE: ${file.path}\n${file.content}\n\n---\n\n`).join('');
        
        // Define the sequence of analysis tasks
        const tasks = [
            { id: 'summary', title: '1. Project Summary', prompt: `Provide a concise, one-paragraph summary of this project's purpose based on its file structure and code. Codebase:\n${fileContentsString}` },
            { id: 'tech_stack', title: '2. Tech Stack Analysis', prompt: `Analyze the tech stack. Identify the primary languages, frameworks, and key libraries. Present as a markdown list. Codebase:\n${fileContentsString}` },
            { id: 'architecture', title: '3. Architectural Review', prompt: `Critique the overall architecture. Discuss strengths, weaknesses, and potential improvements in markdown format. Codebase:\n${fileContentsString}` },
            { id: 'error_trends', title: '4. Common Error Trends', prompt: `Identify up to 3 recurring problems or anti-patterns. For each, describe the trend and list affected files. Codebase:\n${fileContentsString}` },
            { id: 'suggestions', title: '5. Actionable Suggestions', prompt: `List up to 5 specific, actionable improvements for this codebase. Codebase:\n${fileContentsString}` },
        ];
        
        // Execute tasks sequentially
        for (const task of tasks) {
            await performStreamingTask(res, task.id, task.title, task.prompt);
        }

        res.end();

    } catch (error) {
        console.error("Analysis process terminated due to an error.");
        if (!res.headersSent) {
           res.status(500).send('An unexpected error occurred during analysis.');
        } else if (!res.writableEnded) {
            // An error event has already been sent, just end the response.
            res.end();
        }
    }
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('Ensure you have a .env file with your API_KEY.');
});
