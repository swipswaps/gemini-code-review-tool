
export interface RepoTreeFile {
  type: 'file';
  path: string;
  name: string;
  size: number;
}

export interface RepoTreeFolder {
  type: 'folder';
  path: string;
  name: string;
  children: RepoTreeNode[] | null; // Null indicates contents have not been fetched yet
}

export type RepoTreeNode = RepoTreeFile | RepoTreeFolder;

export interface RepoFileWithContent {
    path: string;
    content: string;
    error?: string;
}

export interface ReviewResult {
  reviewComments: string;
  correctedCode: string;
}

// --- Holistic Analysis Types ---

export interface SuggestedFix {
  filePath: string;
  description: string;
  correctedCode: string;
}

export interface ErrorTrend {
  trendDescription: string;
  filesAffected: string[];
}

export interface DependencyReview {
  analysis: string;
  suggestions: string[];
}

// Represents the state of a single step in the holistic analysis
export interface AnalysisTask {
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'complete' | 'error';
    content: string; // The streamed markdown content
    error: string | null;
    // We can store structured data here later if needed
    result?: DependencyReview | ErrorTrend[] | SuggestedFix[];
}

// --- Component State Types ---

export type ReviewStatus = 'idle' | 'streaming' | 'complete' | 'error';
export type LintingStatus = 'idle' | 'linting' | 'complete' | 'error';

export interface ReviewState {
  status: ReviewStatus;
  lintingStatus: LintingStatus;
  streamedComments: string;
  result: ReviewResult | null;
  error: string | null;
}

// --- Server Communication Types ---

// Type for streaming analysis updates from the server, now task-based
export type RepoAnalysisStreamEvent = 
    | { type: 'system', message: string }
    | { type: 'processing_file', path: string, content: string }
    | { type: 'task_start', id: string, title: string }
    | { type: 'task_chunk', id: string, chunk: string }
    | { type: 'task_end', id: string, error?: string }
    | { type: 'error', message: string };
