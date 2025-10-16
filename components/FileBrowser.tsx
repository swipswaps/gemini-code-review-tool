import React from 'react';
import type { RepoFile } from '../types';
import { FileIcon } from './icons/FileIcon';

interface FileBrowserProps {
  files: RepoFile[];
  selectedFile: { path: string, content: string } | null;
  onSelectFile: (file: RepoFile) => void;
}

export const FileBrowser: React.FC<FileBrowserProps> = ({ files, selectedFile, onSelectFile }) => {
  if (files.length === 0) {
    return <div className="p-4 text-gray-500 text-center">No files to display.</div>;
  }

  return (
    <nav className="p-2 max-h-[60vh] overflow-y-auto">
      <ul>
        {files.map((file) => (
          <li key={file.path}>
            <button
              onClick={() => onSelectFile(file)}
              className={`w-full text-left flex items-center space-x-2 px-3 py-2 rounded-md transition-colors duration-150 ${
                selectedFile?.path === file.path
                  ? 'bg-purple-600/30 text-purple-300'
                  : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
              }`}
            >
              <FileIcon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-sm">{file.path}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
