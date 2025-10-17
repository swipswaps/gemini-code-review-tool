import React from 'react';
import { Spinner } from './Spinner';

interface RepoInputProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  isLoading: boolean;
}

export const RepoInput: React.FC<RepoInputProps> = ({ repoUrl, setRepoUrl, isLoading }) => {
  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <div className="relative">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Enter GitHub repository URL"
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
  );
};