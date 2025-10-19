
import React from 'react';
import { marked } from 'marked';
import type { ReviewState } from '../types';
import { WandIcon } from './icons/WandIcon';
import { CODE_SEPARATOR } from '../utils/constants';

interface ReviewCommentsProps {
  state: ReviewState;
  containerRef?: React.RefObject<HTMLDivElement>;
}

export const ReviewComments: React.FC<ReviewCommentsProps> = ({ state, containerRef }) => {
  const isStreaming = state.status === 'streaming';
  
  const getHeaderText = () => {
    if (isStreaming) return "Gemini's thought process...";
    return "Review Comments"; 
  };
  
  const getCommentsToParse = () => {
    const rawText = (state.status === 'complete' && state.result)
      ? state.result.reviewComments
      : state.streamedComments.split(CODE_SEPARATOR)[0];

    return marked.parse(rawText);
  };

  return (
    <div className="h-full flex flex-col bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <h3 className="text-lg font-semibold p-4 border-b border-gray-700 bg-gray-800/80 flex items-center gap-2 text-gray-300 flex-shrink-0">
        {isStreaming && <WandIcon className="w-5 h-5 animate-pulse text-purple-400" />}
        {getHeaderText()}
      </h3>
      <div 
        ref={containerRef}
        className="p-4 prose prose-invert max-w-none prose-pre:bg-gray-900 prose-span:cursor-pointer prose-span:bg-purple-600/30 prose-span:hover:bg-purple-600/50 prose-span:text-purple-300 prose-span:font-mono prose-span:px-1.5 prose-span:py-0.5 prose-span:rounded-md prose-span:mx-1 prose-span:transition-colors overflow-y-auto"
      >
        <div dangerouslySetInnerHTML={{ __html: getCommentsToParse() }} />
        {isStreaming && <span className="inline-block w-2.5 h-5 bg-purple-400 animate-pulse ml-1 align-bottom" />}
      </div>
    </div>
  );
};