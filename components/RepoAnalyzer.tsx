import React from 'react';
import { marked } from 'marked';
import { WandIcon } from './icons/WandIcon';
import { PlusCircleIcon } from './icons/PlusCircleIcon';

interface RepoAnalyzerProps {
  analysisStream: string;
  isStreaming: boolean;
  onReset: () => void;
}

export const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ analysisStream, isStreaming, onReset }) => {
  const parsedContent = marked.parse(analysisStream);

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-200">Repository Architectural Analysis</h2>
        <button
          onClick={onReset}
          className="flex items-center space-x-2 border border-purple-600 text-purple-300 font-semibold rounded-md px-4 py-2 hover:bg-purple-600/20 transition-colors duration-200"
        >
          <PlusCircleIcon className="w-5 h-5" />
          <span>New Review</span>
        </button>
      </div>
      
      <div className="flex-grow flex flex-col bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <h3 className="text-lg font-semibold p-4 border-b border-gray-700 sticky top-0 bg-gray-800/80 backdrop-blur-sm flex items-center gap-2 text-gray-300 flex-shrink-0">
          <WandIcon className="w-5 h-5 animate-pulse text-purple-400" />
          Gemini's thought process...
        </h3>
        <div 
          className="p-4 prose prose-invert max-w-none prose-pre:bg-gray-900 overflow-y-auto"
        >
          <div dangerouslySetInnerHTML={{ __html: parsedContent }} />
          {isStreaming && <span className="inline-block w-2.5 h-5 bg-purple-400 animate-pulse ml-1 align-bottom" />}
        </div>
      </div>
    </div>
  );
};
