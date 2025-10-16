import React from 'react';
import { WandIcon } from './icons/WandIcon';

interface StreamingResponseProps {
  text: string;
}

export const StreamingResponse: React.FC<StreamingResponseProps> = ({ text }) => {
  return (
    <div className="flex-grow flex flex-col gap-4 overflow-hidden">
      <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-y-auto h-full">
          <h3 className="text-lg font-semibold p-4 border-b border-gray-700 sticky top-0 bg-gray-800/80 backdrop-blur-sm flex items-center gap-2 text-gray-300">
            <WandIcon className="w-5 h-5 animate-pulse text-purple-400" />
            Gemini's thought process...
          </h3>
          <div className="p-4 prose prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-600">
             <div style={{ whiteSpace: 'pre-wrap' }}>{text}<span className="inline-block w-2.5 h-5 bg-purple-400 animate-pulse ml-1 align-bottom" /></div>
          </div>
      </div>
    </div>
  );
};