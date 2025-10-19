import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
// We will handle JSON parsing manually for the streaming analysis endpoint
app.use(express.json({ limit: '50mb' }));

// Check for API Key
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("FATAL ERROR: API_KEY is not defined in your .env file.");
  process.exit(1);
}

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- Server-side GitHub Helpers ---
const API_BASE = 'https://api.github.com';

const parseGitHubUrl = (url) => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') return null;
    const parts = urlObj.pathname.split('/').filter(Boolean);
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace('.git', '') };
  } catch (error) { return null; }
};

const fetchWithTimeout = async (resource, options = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
};

const fetchFileContent = async (owner, repo, path, token) => {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetchWithTimeout(`${API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!res.ok) throw new Error(`Failed to fetch ${path} from GitHub (status: ${res.status})`);
    const data = await res.json();
    if (data.size === 0) return '';
    if (data.encoding !== 'base64' || typeof data.content !== 'string') throw new Error(`Unsupported encoding for ${path}`);
    return Buffer.from(data.content, 'base64').toString('utf-8');
};


// --- Helper Functions ---
const sendEvent = (res, event) => {
    res.write(`EVENT: ${JSON.stringify(event)}\n`);
};

// --- API Endpoints ---

// This endpoint remains the same as it handles smaller, non-streaming requests.
app.post('/api/review', async (req, res) => {
  const { code, fileName } = req.body;
  if (!code || !fileName) return res.status(400).send('Missing code or fileName.');
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
    const responseStream = await ai.models.generateContentStream({ model: "gemini-2.5-pro", contents: prompt });
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    for await (const chunk of responseStream) {
      if (chunk.text) res.write(chunk.text);
    }
    res.end();
  } catch (error) {
    console.error("Error in /api/review:", error);
    res.status(500).send('Failed to get code review from Gemini API.');
  }
});

// This endpoint remains the same as it handles smaller, non-streaming requests.
app.post('/api/lint', async (req, res) => {
    const { code, fileName } = req.body;
    if (!code || !fileName) return res.status(400).send('Missing code or fileName.');
    try {
        const prompt = `
            You are an expert code linter and formatter. Your task is to take the following code from "${fileName}" and automatically fix all formatting and style issues.
            Do NOT make any logical changes. Return ONLY the full, corrected code inside a single markdown code block.
            Original code:
            \`\`\`
            ${code}
            \`\`\`
        `;
        const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
        res.json({ text: response.text });
    } catch (error) {
        console.error("Error in /api/lint:", error);
        res.status(500).send('Failed to get linted code from Gemini API.');
    }
});

const performStreamingTask = async (res, taskId, taskTitle, prompt) => {
    sendEvent(res, { type: 'task_start', id: taskId, title: taskTitle });
    try {
        const responseStream = await ai.models.generateContentStream({ model: "gemini-2.5-pro", contents: prompt });
        for await (const chunk of responseStream) {
            if (chunk.text) sendEvent(res, { type: 'task_chunk', id: taskId, chunk: chunk.text });
        }
        sendEvent(res, { type: 'task_end', id: taskId });
    } catch (error) {
        console.error(`Error during task "${taskTitle}":`, error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        sendEvent(res, { type: 'task_end', id: taskId, error: errorMessage });
        throw error;
    }
};

const analyzeRepoRequestHandler = async (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    // CRITICAL FIX: Send connection message IMMEDIATELY, before processing the request body.
    sendEvent(res, { type: 'system', message: 'Backend connection established. Receiving file list...' });

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', async () => {
        try {
            const { repoUrl, paths, githubToken } = JSON.parse(body);
            if (!repoUrl || !paths || !Array.isArray(paths)) {
                throw new Error('Missing repoUrl or paths in request body.');
            }
            sendEvent(res, { type: 'system', message: `Received ${paths.length} file paths. Starting processing.` });
            
            const parsedRepo = parseGitHubUrl(repoUrl);
            if (!parsedRepo) throw new Error("Invalid GitHub URL provided.");
            const { owner, repo } = parsedRepo;

            let fileContentsString = '';
            sendEvent(res, { type: 'system', message: 'Fetching repository files from GitHub...' });
            
            for (const path of paths) {
                let content = '';
                try {
                    content = await fetchFileContent(owner, repo, path, githubToken);
                    sendEvent(res, { type: 'processing_file', path: path, content: content });
                } catch (fetchError) {
                    console.warn(`Could not fetch ${path}:`, fetchError.message);
                    content = `// Error fetching content: ${fetchError.message}`;
                    sendEvent(res, { type: 'processing_file', path: path, content: content });
                }
                fileContentsString += `// FILE: ${path}\n${content}\n\n---\n\n`;
                await new Promise(resolve => setTimeout(resolve, 10)); 
            }
            
            sendEvent(res, { type: 'system', message: 'All files processed. Starting analysis tasks.' });
            
            const tasks = [
                { id: 'summary', title: '1. Project Summary', prompt: `Provide a concise, one-paragraph summary of this project's purpose based on its file structure and code. Codebase:\n${fileContentsString}` },
                { id: 'tech_stack', title: '2. Tech Stack Analysis', prompt: `Analyze the tech stack. Identify the primary languages, frameworks, and key libraries. Present as a markdown list. Codebase:\n${fileContentsString}` },
                { id: 'architecture', title: '3. Architectural Review', prompt: `Critique the overall architecture. Discuss strengths, weaknesses, and potential improvements in markdown format. Codebase:\n${fileContentsString}` },
                { id: 'error_trends', title: '4. Common Error Trends', prompt: `Identify up to 3 recurring problems or anti-patterns. For each, describe the trend and list affected files. Codebase:\n${fileContentsString}` },
                { id: 'suggestions', title: '5. Actionable Suggestions', prompt: `List up to 5 specific, actionable improvements for this codebase. Codebase:\n${fileContentsString}` },
            ];
            
            for (const task of tasks) {
                await performStreamingTask(res, task.id, task.title, task.prompt);
            }

        } catch (error) {
            console.error("Analysis process terminated due to an error:", error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown server error occurred';
            sendEvent(res, { type: 'error', message: `A fatal error occurred: ${errorMessage}` });
        } finally {
            if (!res.writableEnded) res.end();
        }
    });

    req.on('error', (err) => {
        console.error('Request stream error:', err);
        sendEvent(res, { type: 'error', message: `A fatal error occurred during request: ${err.message}` });
        if (!res.writableEnded) res.end();
    });
};

// CRITICAL FIX: We remove the blocking express.json() middleware from this specific route
// and use our custom handler that establishes a stream immediately.
app.post('/api/analyze', analyzeRepoRequestHandler);


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('Ensure you have a .env file with your API_KEY.');
});