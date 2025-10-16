
import React, { useState, useCallback } from 'react';
import type { RepoFile } from './types';
import { fetchRepoFiles, fetchFileContent } from './services/githubService';
import { RepoInput } from './components/RepoInput';
import { FileBrowser } from './components/FileBrowser';
import { CodeReviewer } from './components/CodeReviewer';
import { Spinner } from './components/Spinner';
import { GithubIcon } from './components/icons/GithubIcon';

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
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; content: string } | null>(null);
  const [isLoadingRepo, setIsLoadingRepo] = useState<boolean>(false);
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchFiles = useCallback(async () => {
    if (!repoUrl) {
      setError('Please enter a GitHub repository URL.');
      return;
    }
    setIsLoadingRepo(true);
    setError(null);
    setSelectedFile(null);
    setFiles([]);
    try {
      const fetchedFiles = await fetchRepoFiles(repoUrl);
      setFiles(fetchedFiles);
       if (fetchedFiles.length === 0) {
        setError('No reviewable files found in this repository. Check the console for more details.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setFiles([]);
    } finally {
      setIsLoadingRepo(false);
    }
  }, [repoUrl]);

  const handleSelectFile = useCallback(async (file: RepoFile) => {
    setIsLoadingFile(true);
    setError(null);
    setSelectedFile(null);

    const parsedUrl = parseGitHubUrl(repoUrl);
    if (!parsedUrl) {
      setError("Could not parse repository URL to fetch file.");
      setIsLoadingFile(false);
      return;
    }

    try {
      const content = await fetchFileContent(parsedUrl.owner, parsedUrl.repo, file.path);
      setSelectedFile({ path: file.path, content });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred while fetching file content.');
      setSelectedFile(null);
    } finally {
      setIsLoadingFile(false);
    }
  }, [repoUrl]);

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
            onFetch={handleFetchFiles}
            isLoading={isLoadingRepo}
          />
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 flex-grow">
            <h2 className="text-lg font-semibold p-4 border-b border-gray-700 text-gray-300">Files</h2>
            {isLoadingRepo ? (
              <div className="flex justify-center items-center h-48">
                <Spinner />
              </div>
            ) : files.length > 0 ? (
              <FileBrowser files={files} selectedFile={selectedFile} onSelectFile={handleSelectFile} />
            ) : (
               <div className="p-4 text-center text-gray-500">{error || 'Enter a repository URL and click "Fetch Files" to begin.'}</div>
            )}
          </div>
        </div>

        <div className="lg:w-3/4">
          <CodeReviewer file={selectedFile} isLoadingFile={isLoadingFile} />
        </div>
      </main>
    </div>
  );
}
