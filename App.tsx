

import React, { useReducer, useCallback, useEffect } from 'react';
import type { RepoTreeNode, HolisticAnalysisResult, RepoFileWithContent } from './types';
import { fetchRepoTree, fetchAllFileContents, fetchFileContent, parseGitHubUrl } from './services/githubService';
import { analyzeRepositoryHolistically } from './services/geminiService';
import { RepoInput } from './components/RepoInput';
import { FileBrowser } from './components/FileBrowser';
import { CodeReviewer } from './components/CodeReviewer';
import { RepoAnalyzer } from './components/RepoAnalyzer';
import { Spinner } from './components/Spinner';
import { GithubIcon } from './components/icons/GithubIcon';
import { InfoIcon } from './components/icons/InfoIcon';
import { ErrorBoundary } from './components/ErrorBoundary';

type AppState = {
  status: 'idle' | 'loading_repo' | 'repo_loaded' | 'fetching_files' | 'reviewing_files' | 'analyzing_repo' | 'error';
  repoUrl: string;
  githubToken: string;
  repoTree: RepoTreeNode[];
  selectedFilePaths: Set<string>;
  filesForReview: RepoFileWithContent[] | null;
  holisticAnalysisResult: HolisticAnalysisResult | null;
  allFilesWithContent: RepoFileWithContent[] | null;
  repoAnalysisStatusText: string;
  error: string | null;
};

type AppAction =
  | { type: 'SET_REPO_URL'; payload: string }
  | { type: 'SET_GITHUB_TOKEN'; payload: string }
  | { type: 'FETCH_REPO_START' }
  | { type: 'FETCH_REPO_SUCCESS'; payload: RepoTreeNode[] }
  | { type: 'FETCH_REPO_FAILURE'; payload: string }
  | { type: 'TOGGLE_FILE_SELECTION'; payload: string }
  | { type: 'SET_ALL_FILES_SELECTED'; payload: { nodes: RepoTreeNode[]; select: boolean } }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'START_FILE_REVIEW' }
  | { type: 'FILE_REVIEW_SUCCESS'; payload: RepoFileWithContent[] }
  | { type: 'FILE_REVIEW_FAILURE'; payload: string }
  | { type: 'START_REPO_ANALYSIS' }
  | { type: 'REPO_ANALYSIS_STATUS_UPDATE'; payload: string }
  | { type: 'REPO_ANALYSIS_SUCCESS'; payload: { result: HolisticAnalysisResult; files: RepoFileWithContent[] } }
  | { type: 'REPO_ANALYSIS_FAILURE'; payload: string }
  | { type: 'RESET' };

const initialState: AppState = {
  status: 'idle',
  repoUrl: 'https://github.com/microsoft/TypeScript-Node-Starter',
  githubToken: '',
  repoTree: [],
  selectedFilePaths: new Set(),
  filesForReview: null,
  holisticAnalysisResult: null,
  allFilesWithContent: null,
  repoAnalysisStatusText: '',
  error: null,
};

const getAllFilePaths = (nodes: RepoTreeNode[]): string[] => {
  const paths: string[] = [];
  const traverse = (node: RepoTreeNode) => {
    if (node.type === 'file') paths.push(node.path);
    else node.children.forEach(traverse);
  };
  nodes.forEach(traverse);
  return paths;
};


const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_REPO_URL':
      return { ...state, repoUrl: action.payload };
    case 'SET_GITHUB_TOKEN':
      return { ...state, githubToken: action.payload };
    case 'FETCH_REPO_START':
      return { ...initialState, repoUrl: state.repoUrl, githubToken: state.githubToken, status: 'loading_repo' };
    case 'FETCH_REPO_SUCCESS':
      return { ...state, status: 'repo_loaded', repoTree: action.payload, error: action.payload.length === 0 ? 'No files found in this repository.' : null };
    case 'FETCH_REPO_FAILURE':
      return { ...state, status: 'error', error: action.payload, repoTree: [] };
    case 'TOGGLE_FILE_SELECTION': {
      const newSet = new Set(state.selectedFilePaths);
      if (newSet.has(action.payload)) newSet.delete(action.payload);
      else newSet.add(action.payload);
      return { ...state, selectedFilePaths: newSet };
    }
    case 'SET_ALL_FILES_SELECTED': {
        if (action.payload.select) {
            const allPaths = getAllFilePaths(action.payload.nodes);
            return { ...state, selectedFilePaths: new Set(allPaths) };
        }
        return { ...state, selectedFilePaths: new Set() };
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedFilePaths: new Set() };
    case 'START_FILE_REVIEW':
      return { ...state, status: 'fetching_files', error: null };
    case 'FILE_REVIEW_SUCCESS':
      return { ...state, status: 'reviewing_files', filesForReview: action.payload, selectedFilePaths: new Set() };
    case 'FILE_REVIEW_FAILURE':
      return { ...state, status: 'error', error: action.payload };
    case 'START_REPO_ANALYSIS':
      return { ...state, status: 'analyzing_repo', holisticAnalysisResult: null, error: null };
    case 'REPO_ANALYSIS_STATUS_UPDATE':
      return { ...state, repoAnalysisStatusText: action.payload };
    case 'REPO_ANALYSIS_SUCCESS':
      return { ...state, status: 'repo_loaded', holisticAnalysisResult: action.payload.result, allFilesWithContent: action.payload.files };
    case 'REPO_ANALYSIS_FAILURE':
      return { ...state, status: 'error', error: action.payload };
    case 'RESET':
        const isRepoLoaded = state.repoTree.length > 0;
        return { ...initialState, repoUrl: state.repoUrl, githubToken: state.githubToken, repoTree: state.repoTree, status: isRepoLoaded ? 'repo_loaded' : 'idle' };
    default:
      return state;
  }
};

export default function App(): React.ReactElement {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const { status, repoUrl, githubToken, repoTree, selectedFilePaths, filesForReview, holisticAnalysisResult, allFilesWithContent, repoAnalysisStatusText, error } = state;

  const handleFetchFiles = useCallback(async (urlToFetch: string) => {
    if (parseGitHubUrl(urlToFetch)) {
      dispatch({ type: 'FETCH_REPO_START' });
      try {
        const fetchedTree = await fetchRepoTree(urlToFetch, githubToken);
        dispatch({ type: 'FETCH_REPO_SUCCESS', payload: fetchedTree });
      } catch (err) {
        dispatch({ type: 'FETCH_REPO_FAILURE', payload: err instanceof Error ? err.message : 'An unknown error occurred.' });
      }
    } else {
      dispatch({ type: 'FETCH_REPO_FAILURE', payload: 'Please enter a valid GitHub repository URL.' });
    }
  }, [githubToken]);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (repoUrl) handleFetchFiles(repoUrl);
    }, 500);
    return () => clearTimeout(handler);
  }, [repoUrl, githubToken, handleFetchFiles]);

  const handleStartReview = useCallback(async () => {
    if (selectedFilePaths.size === 0) return;
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      dispatch({ type: 'FILE_REVIEW_FAILURE', payload: "Could not parse repository URL to fetch files." });
      return;
    }

    dispatch({ type: 'START_FILE_REVIEW' });
    const { owner, repo } = parsed;
    try {
      const paths = Array.from(selectedFilePaths);
      const results = await Promise.allSettled(paths.map(path => fetchFileContent(owner, repo, path, githubToken)));
      const filesToReview = results.map((result, index) => {
        const path = paths[index];
        if (result.status === 'fulfilled') return { path, content: result.value };
        return { path, content: '', error: result.reason instanceof Error ? result.reason.message : 'An unknown error occurred.' };
      });
      dispatch({ type: 'FILE_REVIEW_SUCCESS', payload: filesToReview });
    } catch (err) {
      dispatch({ type: 'FILE_REVIEW_FAILURE', payload: err instanceof Error ? err.message : 'An unknown error occurred while fetching files.' });
    }
  }, [repoUrl, selectedFilePaths, githubToken]);

  const handleStartRepoAnalysis = useCallback(async () => {
    if (repoTree.length === 0 || !repoUrl) return;
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      dispatch({ type: 'REPO_ANALYSIS_FAILURE', payload: 'Cannot analyze repository: Invalid GitHub URL.' });
      return;
    }

    dispatch({ type: 'START_REPO_ANALYSIS' });
    const { owner, repo } = parsed;
    try {
      dispatch({ type: 'REPO_ANALYSIS_STATUS_UPDATE', payload: 'Fetching all file contents...' });
      const fetchedContents = await fetchAllFileContents(owner, repo, repoTree, githubToken);
      
      dispatch({ type: 'REPO_ANALYSIS_STATUS_UPDATE', payload: 'Analyzing repository with Gemini...' });
      const result = await analyzeRepositoryHolistically(fetchedContents);
      dispatch({ type: 'REPO_ANALYSIS_SUCCESS', payload: { result, files: fetchedContents } });
    } catch (err) {
      dispatch({ type: 'REPO_ANALYSIS_FAILURE', payload: err instanceof Error ? err.message : 'An unknown error occurred.' });
    }
  }, [repoTree, repoUrl, githubToken]);

  const renderMainContent = () => {
    if (status === 'reviewing_files' && filesForReview) {
      return (
        <ErrorBoundary onReset={() => dispatch({ type: 'RESET' })}>
          <CodeReviewer files={filesForReview} onReset={() => dispatch({ type: 'RESET' })} />
        </ErrorBoundary>
      );
    }
    if (holisticAnalysisResult) {
      return (
        <ErrorBoundary onReset={() => dispatch({ type: 'RESET' })}>
          <RepoAnalyzer 
              analysisResult={holisticAnalysisResult}
              originalFiles={allFilesWithContent}
              isLoading={status === 'analyzing_repo'}
              statusText={repoAnalysisStatusText}
              onReset={() => dispatch({ type: 'RESET' })}
          />
        </ErrorBoundary>
      );
    }
     if (status === 'analyzing_repo') {
        return (
             <RepoAnalyzer 
                analysisResult={null}
                originalFiles={null}
                isLoading={true}
                statusText={repoAnalysisStatusText}
                onReset={() => dispatch({ type: 'RESET' })}
            />
        );
     }
    // Fix: Handle loading states to show a spinner instead of the default panel.
    if (status === 'loading_repo' || status === 'fetching_files') {
        return (
            <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
                <Spinner className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-semibold text-gray-300">
                    {status === 'loading_repo' ? 'Loading Repository...' : 'Fetching Files...'}
                </h2>
            </div>
        );
    }
    // Fix: Removed a confusing comment about a type error that was likely outdated. The `if (error)` check is correct.
    if (error) {
        return <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>
    }
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
        <InfoIcon className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold">Ready for Analysis</h2>
        <p className="text-center">
          Use the "Analyze Entire Repository" button for a high-level architectural review,<br/>
          or select individual files to start a detailed code review.
        </p>
      </div>
    );
  };
  
  // Fix for error on line 283: The `isLoading` constant was removed because it was unused and causing a TypeScript error.
  // Loading states are handled directly using the `status` variable within the JSX below.

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <header className="bg-gray-800/50 backdrop-blur-sm border-b border-gray-700 p-4 shadow-lg sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
             <GithubIcon className="h-8 w-8 text-purple-400" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Gemini Code Reviewer</h1>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 min-h-0">
        <div className="lg:w-1/4 flex flex-col gap-6">
          <RepoInput
            repoUrl={repoUrl}
            setRepoUrl={(url) => dispatch({ type: 'SET_REPO_URL', payload: url })}
            githubToken={githubToken}
            setGithubToken={(token) => dispatch({ type: 'SET_GITHUB_TOKEN', payload: token })}
            isLoading={status === 'loading_repo'}
          />
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col flex-grow min-h-0">
            <div className="p-4 border-b border-gray-700 text-gray-300 flex-shrink-0">
                <h2 className="text-lg font-semibold">Repository Explorer</h2>
            </div>
            {status === 'loading_repo' ? (
              <div className="flex justify-center items-center h-48"><Spinner /></div>
            ) : repoTree.length > 0 ? (
                <>
                    <div className="p-4 border-b border-gray-700">
                        <button
                            onClick={handleStartRepoAnalysis}
                            // Fix: Removed `|| status === 'loading_repo'` check, which is invalid in this code branch due to TypeScript's control flow analysis and caused a type error. The button is not rendered in the 'loading_repo' state anyway.
                            disabled={status === 'analyzing_repo'}
                            className="w-full bg-indigo-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                        >
                            {status === 'analyzing_repo' ? <><Spinner className="w-5 h-5 mr-2"/><span>{repoAnalysisStatusText || 'Analyzing...'}</span></> : 'Analyze Entire Repository'}
                        </button>
                    </div>
                    <FileBrowser 
                        nodes={repoTree} 
                        selectedFilePaths={selectedFilePaths} 
                        onToggleFile={(path) => dispatch({ type: 'TOGGLE_FILE_SELECTION', payload: path })}
                        onSelectAll={(select) => dispatch({ type: 'SET_ALL_FILES_SELECTED', payload: { nodes: repoTree, select }})}
                    />
                </>
            ) : (
               <div className="p-4 text-center text-gray-500 flex-grow flex items-center justify-center">{error || 'Enter a repository URL to begin.'}</div>
            )}
             {repoTree.length > 0 && (
                <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-900/50 rounded-b-lg">
                    <p className="text-sm text-gray-400 mb-3">{selectedFilePaths.size} file(s) selected.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleStartReview}
                            disabled={status === 'fetching_files' || selectedFilePaths.size === 0}
                            className="flex-grow flex items-center justify-center bg-purple-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {status === 'fetching_files' ? <Spinner className="w-5 h-5"/> : `Review Selected (${selectedFilePaths.size})`}
                        </button>
                        <button onClick={() => dispatch({ type: 'CLEAR_SELECTION' })} disabled={selectedFilePaths.size === 0} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                            Clear
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="lg:w-3/4 flex flex-col min-h-0">
           {renderMainContent()}
        </div>
      </main>
    </div>
  );
}
