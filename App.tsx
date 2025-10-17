import React, { useState, useCallback, useEffect } from 'react';
import type { RepoTreeNode } from './types';
import { fetchRepoTree, fetchFileContent } from './services/githubService';
import { RepoInput } from './components/RepoInput';
import { FileBrowser } from './components/FileBrowser';
import { CodeReviewer } from './components/CodeReviewer';
import { Spinner } from './components/Spinner';
import { GithubIcon } from './components/icons/GithubIcon';
import { InfoIcon } from './components/icons/InfoIcon';

const parseGitHubUrl = (url: string): { owner: string; repo: string } | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname !== 'github.com') return null;
        const parts = urlObj.pathname.split('/').filter(Boolean);
        if (parts.length < 2) return null;
        return { owner: parts[0], repo: parts[1].replace('.git', '') };
    } catch (e) {
        return null;
    }
};

export default function App(): React.ReactElement {
  const [repoUrl, setRepoUrl] = useState<string>('https://github.com/microsoft/TypeScript-Node-Starter');
  const [files, setFiles] = useState<RepoTreeNode[]>([]);
  const [selectedFilePaths, setSelectedFilePaths] = useState<Set<string>>(new Set());
  const [filesForReview, setFilesForReview] = useState<{ path: string; content: string }[] | null>(null);
  
  const [isLoadingRepo, setIsLoadingRepo] = useState<boolean>(false);
  const [isFetchingContent, setIsFetchingContent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchFiles = useCallback(async (urlToFetch: string) => {
    const parsed = parseGitHubUrl(urlToFetch);
    if (!parsed) {
      setError('Please enter a valid GitHub repository URL.');
      return;
    }
    
    setIsLoadingRepo(true);
    setError(null);
    setFilesForReview(null);
    setSelectedFilePaths(new Set());
    setFiles([]);

    try {
      const fetchedTree = await fetchRepoTree(urlToFetch);
      setFiles(fetchedTree);
       if (fetchedTree.length === 0) {
        setError('No files found in this repository. Check the console for more details.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setFiles([]);
    } finally {
      setIsLoadingRepo(false);
    }
  }, []);

  // Effect to automatically fetch files when repoUrl changes (with debounce)
  useEffect(() => {
    const handler = setTimeout(() => {
      if (repoUrl && parseGitHubUrl(repoUrl)) {
        handleFetchFiles(repoUrl);
      }
    }, 500); // 500ms debounce delay

    return () => {
      clearTimeout(handler);
    };
  }, [repoUrl, handleFetchFiles]);
  
  const handleToggleFileSelection = useCallback((path: string) => {
    setSelectedFilePaths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  }, []);

  const handleStartReview = useCallback(async () => {
    if (selectedFilePaths.size === 0) return;

    setIsFetchingContent(true);
    setError(null);
    
    const parsed = parseGitHubUrl(repoUrl);
    if (!parsed) {
      setError("Could not parse repository URL to fetch files.");
      setIsFetchingContent(false);
      return;
    }
    const { owner, repo } = parsed;

    try {
        const filesToReview = await Promise.all(
            Array.from(selectedFilePaths).map(async path => {
                const content = await fetchFileContent(owner, repo, path);
                return { path, content };
            })
        );
        setFilesForReview(filesToReview);
        setSelectedFilePaths(new Set());
    } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching file content.');
        setFilesForReview(null);
    } finally {
        setIsFetchingContent(false);
    }
  }, [repoUrl, selectedFilePaths]);


  const handleResetReview = () => {
    setFilesForReview(null);
  };

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

      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 flex flex-col lg:flex-row gap-6">
        <div className="lg:w-1/4 flex flex-col gap-6">
          <RepoInput
            repoUrl={repoUrl}
            setRepoUrl={setRepoUrl}
            isLoading={isLoadingRepo}
          />
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col flex-grow min-h-0">
            <h2 className="text-lg font-semibold p-4 border-b border-gray-700 text-gray-300 flex-shrink-0">Files</h2>
            {isLoadingRepo ? (
              <div className="flex justify-center items-center h-48">
                <Spinner />
              </div>
            ) : files.length > 0 ? (
              <FileBrowser nodes={files} selectedFilePaths={selectedFilePaths} onToggleFile={handleToggleFileSelection} />
            ) : (
               <div className="p-4 text-center text-gray-500 flex-grow flex items-center justify-center">{error || 'Enter a repository URL to begin.'}</div>
            )}
             {files.length > 0 && (
                <div className="p-4 border-t border-gray-700 flex-shrink-0 bg-gray-900/50 rounded-b-lg">
                    <p className="text-sm text-gray-400 mb-3">{selectedFilePaths.size} file(s) selected.</p>
                    <div className="flex gap-2">
                        <button
                            onClick={handleStartReview}
                            disabled={isFetchingContent || selectedFilePaths.size === 0}
                            className="flex-grow flex items-center justify-center bg-purple-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors duration-200"
                        >
                            {isFetchingContent ? <Spinner className="w-5 h-5"/> : `Review Selected (${selectedFilePaths.size})`}
                        </button>
                        <button onClick={() => setSelectedFilePaths(new Set())} disabled={selectedFilePaths.size === 0} className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed">
                            Clear
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>

        <div className="lg:w-3/4">
           {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-4">{error}</div>}
           {filesForReview ? (
             <CodeReviewer files={filesForReview} onReset={handleResetReview} />
           ) : (
              <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
                <InfoIcon className="h-12 w-12 mb-4" />
                <h2 className="text-xl font-semibold">Select files to begin</h2>
                <p>Check one or more files from the list on the left to start a review.</p>
              </div>
           )}
        </div>
      </main>
    </div>
  );
}