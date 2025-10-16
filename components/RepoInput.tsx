
import React from 'react';
import { Spinner } from './Spinner';

interface RepoInputProps {
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  onFetch: () => void;
  isLoading: boolean;
}

export const RepoInput: React.FC<RepoInputProps> = ({ repoUrl, setRepoUrl, onFetch, isLoading }) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFetch();
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="Enter GitHub repository URL"
          className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition"
          disabled={isLoading}
        />
        <button
          type="submit"
          disabled={isLoading}
          className="flex items-center justify-center bg-purple-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? <Spinner className="w-5 h-5" /> : 'Fetch Files'}
        </button>
      </form>
    </div>
  );
};
