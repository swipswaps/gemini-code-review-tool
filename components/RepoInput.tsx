import React from 'react';
import { Spinner } from './Spinner';

interface RepoInputProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  githubToken: string;
  setGithubToken: (token: string) => void;
  isLoading: boolean;
}

export const RepoInput: React.FC<RepoInputProps> = ({ repoUrl, setRepoUrl, githubToken, setGithubToken, isLoading }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 space-y-4">
      <div>
        <label htmlFor="repoUrl" className="block text-sm font-medium text-gray-400 mb-1">
          GitHub Repository URL
        </label>
        <div className="relative">
          <input
            id="repoUrl"
            type="text"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition pr-10"
            disabled={isLoading}
          />
          {isLoading && (
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                  <Spinner className="w-5 h-5 text-gray-400" />
              </div>
          )}
        </div>
      </div>
       <div>
        <label htmlFor="githubToken" className="block text-sm font-medium text-gray-400 mb-1">
          GitHub Personal Access Token (Optional)
        </label>
        <div className="relative">
          <input
            id="githubToken"
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_..."
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
            disabled={isLoading}
          />
        </div>
         <p className="text-xs text-gray-500 mt-2">
            Provide a token to avoid GitHub API rate limits. 
            <a 
                href="https://github.com/settings/tokens?type=beta" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:underline"
            >
             Create one here
            </a> with `public_repo` access.
        </p>
      </div>
    </div>
  );
};