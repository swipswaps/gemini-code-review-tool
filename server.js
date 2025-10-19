
import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());

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

// Apply express.json() middleware ONLY to the routes that need it.
app.post('/api/review', express.json(), async (req, res) => {
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

app.post('/api/lint', express.json(), async (req, res) => {
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

const runAnalysis = async (res, body) => {
    try {
        const { repoUrl, paths, githubToken } = JSON.parse(body);
        if (!repoUrl || !paths || !Array.isArray(paths)) {
            throw new Error('Missing repoUrl or paths in request body.');
        }
        sendEvent(res, { type: 'system', message: `Received ${paths.length} file paths. Starting processing.` });
        
        const parsedRepo = parseGitHubUrl(repoUrl);
        if (!parsedRepo) throw new Error("Invalid GitHub URL provided.");
        const { owner, repo } = parsedRepo;

        const MAX_CONTEXT_CHAR_LIMIT = 750000; // A safe character limit for the prompt context
        let fileContentsString = '';
        let totalChars = 0;
        let filesIncludedCount = 0;

        sendEvent(res, { type: 'system', message: 'Fetching repository files from GitHub...' });
        
        for (const path of paths) {
            let content = '';
            try {
                content = await fetchFileContent(owner, repo, path, githubToken);

                // Ensure at least one file is included, but stop if adding the next one exceeds the limit.
                if (filesIncludedCount > 0 && totalChars + content.length > MAX_CONTEXT_CHAR_LIMIT) {
                    sendEvent(res, { type: 'system', message: `[SYSTEM] Context limit of ${MAX_CONTEXT_CHAR_LIMIT} characters reached. Analyzing the first ${filesIncludedCount} files.` });
                    break; // Stop the loop, don't process this file or any after it.
                }

                sendEvent(res, { type: 'processing_file', path: path, content: content });
                fileContentsString += `// FILE: ${path}\n${content}\n\n---\n\n`;
                totalChars += content.length;
                filesIncludedCount++;

            } catch (fetchError) {
                console.warn(`Could not fetch ${path}:`, fetchError.message);
                const errorMessage = `// Error fetching content: ${fetchError.message}`;
                // Send an event so UI can show the error for this file, but don't add to Gemini context.
                sendEvent(res, { type: 'processing_file', path: path, content: errorMessage });
            }
            // Small delay to prevent overwhelming GitHub API and to allow UI to update
            await new Promise(resolve => setTimeout(resolve, 50)); 
        }
        
        if (totalChars === 0 && paths.length > 0) {
            sendEvent(res, { type: 'system', message: '[SYSTEM] Could not fetch content for any files. Aborting analysis.' });
            // End the execution here as there's nothing to analyze.
            return;
        }
        
        sendEvent(res, { type: 'system', message: `Context built with ${filesIncludedCount} files. Starting analysis tasks.` });
        
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
}


const analyzeRepoRequestHandler = (req, res) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    
    sendEvent(res, { type: 'system', message: 'Backend connection established. Receiving file list...' });

    // CRITICAL FIX: Explicitly flush the headers and the first event to the client.
    // This forces Node.js to send the initial message immediately, bypassing any network buffering.
    if (res.flushHeaders) {
        res.flushHeaders();
    }

    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        // Yield to the event loop with setTimeout to ensure the initial connection message is sent
        // before we start the potentially long-running analysis process. This fixes the stall.
        setTimeout(() => runAnalysis(res, body), 100);
    });

    req.on('error', (err) => {
        console.error('Request stream error:', err);
        sendEvent(res, { type: 'error', message: `A fatal error occurred during request: ${err.message}` });
        if (!res.writableEnded) res.end();
    });
};

// This route does NOT have the blocking express.json() middleware.
// It uses the custom handler that establishes a stream immediately.
app.post('/api/analyze', analyzeRepoRequestHandler);


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
  console.log('Ensure you have a .env file with your API_KEY.');
});
