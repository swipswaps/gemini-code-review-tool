import React, { useState } from 'react';
import type { RepoTreeNode } from '../types';
import { FileIcon } from './icons/FileIcon';
import { FolderIcon } from './icons/FolderIcon';
import { FolderOpenIcon } from './icons/FolderOpenIcon';
import { Spinner } from './Spinner';

interface FileBrowserProps {
  nodes: RepoTreeNode[];
  selectedFilePaths: Set<string>;
  onToggleFile: (path: string) => void;
  onSelectAll: (select: boolean) => void;
  onExpandFolder: (folder: RepoTreeNode) => void;
}

const TreeNode: React.FC<{
  node: RepoTreeNode;
  selectedFilePaths: Set<string>;
  onToggleFile: (path: string) => void;
  onExpandFolder: (folder: RepoTreeNode) => void;
  level: number;
}> = ({ node, selectedFilePaths, onToggleFile, onExpandFolder, level }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const indentStyle = { paddingLeft: `${level * 1.25 + 0.75}rem` };

  if (node.type === 'folder') {
    const handleToggle = async () => {
        if (!isOpen && node.children === null) {
            setIsLoading(true);
            await onExpandFolder(node);
            setIsLoading(false);
        }
        setIsOpen(!isOpen);
    };

    return (
      <li>
        <button
          onClick={handleToggle}
          className="w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md transition-colors duration-150 text-gray-400 hover:bg-gray-700/50 hover:text-gray-200"
          style={indentStyle}
          title={node.path}
        >
          {isOpen ? <FolderOpenIcon className="h-5 w-5 flex-shrink-0" /> : <FolderIcon className="h-5 w-5 flex-shrink-0" />}
          <span className="truncate text-sm font-medium">{node.name}</span>
          {isLoading && <Spinner className="w-4 h-4 ml-auto" />}
        </button>
        {isOpen && node.children && (
          <ul>
            {node.children.map(child => (
              <TreeNode
                key={child.path}
                node={child}
                selectedFilePaths={selectedFilePaths}
                onToggleFile={onToggleFile}
                onExpandFolder={onExpandFolder}
                level={level + 1}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  const isSelected = selectedFilePaths.has(node.path);
  return (
    <li>
      <label
        htmlFor={`file-${node.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
        className={`w-full text-left flex items-center space-x-3 px-3 py-2 rounded-md transition-colors duration-150 cursor-pointer ${
          isSelected
            ? 'bg-purple-600/30 text-purple-300'
            : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
        }`}
        style={indentStyle}
        title={node.path}
      >
        <input
          id={`file-${node.path.replace(/[^a-zA-Z0-9]/g, '-')}`}
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleFile(node.path)}
          className="h-4 w-4 bg-gray-700 border-gray-500 rounded text-purple-600 focus:ring-purple-500 focus:ring-offset-gray-800 accent-purple-600"
        />
        <FileIcon className="h-5 w-5 flex-shrink-0" />
        <span className="truncate text-sm">{node.name}</span>
      </label>
    </li>
  );
};


export const FileBrowser: React.FC<FileBrowserProps> = ({ nodes, selectedFilePaths, onToggleFile, onSelectAll, onExpandFolder }) => {
  if (nodes.length === 0) {
    return <div className="p-4 text-gray-500 text-center">No files to display.</div>;
  }
  
  const allFilePaths = React.useMemo(() => {
    const paths: string[] = [];
    const traverse = (node: RepoTreeNode) => {
        if (node.type === 'file') paths.push(node.path);
        else if (node.children) node.children.forEach(traverse);
    };
    nodes.forEach(traverse);
    return paths;
  }, [nodes, selectedFilePaths]); // Re-calculate if selection changes to correctly get all known paths

  const allSelected = allFilePaths.length > 0 && selectedFilePaths.size >= allFilePaths.length;

  return (
    <>
      <div className="p-2 flex-shrink-0 border-b border-gray-700">
          <div className="flex justify-end gap-2 px-1">
              <button onClick={() => onSelectAll(true)} className="text-xs text-purple-400 hover:underline disabled:text-gray-600" disabled={allSelected}>Select All</button>
              <button onClick={() => onSelectAll(false)} className="text-xs text-purple-400 hover:underline disabled:text-gray-600" disabled={selectedFilePaths.size === 0}>Deselect All</button>
          </div>
      </div>
      <nav className="p-2 flex-grow overflow-y-auto">
        <ul>
          {nodes.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              selectedFilePaths={selectedFilePaths}
              onToggleFile={onToggleFile}
              onExpandFolder={onExpandFolder}
              level={0}
             />
          ))}
        </ul>
      </nav>
    </>
  );
};