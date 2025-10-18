export interface RepoTreeFile {
  type: 'file';
  path: string;
  name: string;
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

export interface HolisticAnalysisResult {
  overallAnalysis?: string;
  dependencyReview?: DependencyReview;
  errorTrends?: ErrorTrend[];
  suggestedFixes?: SuggestedFix[];
}

export type ReviewStatus = 'idle' | 'streaming' | 'complete' | 'error';
export type LintingStatus = 'idle' | 'linting' | 'complete' | 'error';

export interface ReviewState {
  status: ReviewStatus;
  lintingStatus: LintingStatus;
  streamedComments: string;
  result: ReviewResult | null;
  error: string | null;
}

// Type for streaming analysis updates from the server
export type RepoAnalysisStreamEvent = 
    | { type: 'status', message: string }
    | { type: 'data', payload: HolisticAnalysisResult };