
export interface RepoTreeFile {
  type: 'file';
  path: string;
  name: string;
}

export interface RepoTreeFolder {
  type: 'folder';
  path: string;
  name: string;
  children: RepoTreeNode[];
}

export type RepoTreeNode = RepoTreeFile | RepoTreeFolder;

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
  overallAnalysis: string;
  dependencyReview: DependencyReview;
  errorTrends: ErrorTrend[];
  suggestedFixes: SuggestedFix[];
}