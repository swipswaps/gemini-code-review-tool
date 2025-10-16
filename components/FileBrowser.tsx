
import React from 'react';
import type { RepoFile } from '../types';
import { FileIcon } from './icons/FileIcon';

interface FileBrowserProps {
  files: RepoFile[];
  selectedFilePaths: Set<string>;
  onToggleFile: (path: string) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ files, selectedFilePaths, onToggleFile }) => {
  if (files.length === 0) {
    return <div className="p-4 text-gray-500 text-center">No files to display.</div>;
  }

  return (
    <nav className="p-2 flex-grow overflow-y-auto">
      <ul>
        {files.map((file) => {
          const isSelected = selectedFilePaths.has(file.path);
          return (
            <li key={file.path}>
              <label
                htmlFor={`file-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                className={`w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md transition-colors duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/30 text-purple-300'
                    : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                }`}
              >
                <input
                  id={`file-${file.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleFile(file.path)}
                  className="h-4 w-4 bg-gray-700 border-gray-500 rounded text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800 accent-purple-600"
                />
                <FileIcon className="h-4 w-4 flex-shrink-0" />
                <span className="truncate text-sm">{file.path}</span>
              </label>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
