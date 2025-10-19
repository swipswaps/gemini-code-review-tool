import { CODE_SEPARATOR } from '../utils/constants';
// FIX: Removed unused HolisticAnalysisResult type
import type { RepoAnalysisStreamEvent } from '../types';

async function* streamFetch(response: Response): AsyncGenerator<string> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }
        yield decoder.decode(value);
    }
}

export async function* reviewCodeStream(code: string, fileName: string): AsyncGenerator<string> {
  const response = await fetch('/api/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, fileName }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get code review from server: ${errorText}`);
  }

  yield* streamFetch(response);
}

export async function lintCode(code: string, fileName: string): Promise<string> {
    const response = await fetch('/api/lint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, fileName }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to lint code from server: ${errorText}`);
    }
    
    const data = await response.json();
    const text = data.text;

    if (!text) {
      throw new Error("Received an empty response from the server.");
    }
    
    const codeMatch = text.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1].trim();
    }
    
    return text.trim();
}

export async function* analyzeRepositoryStream(
  files: { path: string; content: string }[]
): AsyncGenerator<RepoAnalysisStreamEvent> {
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
    });

     if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get repository analysis from server: ${errorText}`);
    }
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the last, possibly incomplete, line

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('EVENT: ')) {
                try {
                    const event = JSON.parse(trimmedLine.substring(7));
                    yield event as RepoAnalysisStreamEvent;
                } catch(e) {
                    console.error("Failed to parse analysis stream event:", e, "Line:", trimmedLine);
                    // Yield a structured error event so the UI can display it for troubleshooting.
                    yield { type: 'error', message: `[CLIENT PARSE ERROR] Failed to parse event: ${trimmedLine}` };
                }
            } else if (trimmedLine) { // If the line is not empty and not a standard event, treat it as a server log/error.
                console.warn("Received non-event line from analysis stream:", trimmedLine);
                // Yield a structured error event to make this visible in the UI for troubleshooting.
                yield { type: 'error', message: `[SERVER LOG] ${trimmedLine}` };
            }
        }
    }
};