import React from 'react';
import { marked } from 'marked';
import type { AnalysisTask } from '../types';
import { Spinner } from './Spinner';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';

interface AnalysisTaskProps {
  task: AnalysisTask;
}

export const AnalysisTaskItem: React.FC<AnalysisTaskProps> = ({ task }) => {

  const getStatusIndicator = () => {
    switch(task.status) {
        case 'in_progress': return <Spinner className="w-5 h-5 text-purple-400" />;
        case 'complete': return <span className="text-green-400 text-2xl font-bold">✓</span>;
        case 'error': return <span className="text-red-400"><AlertTriangleIcon className="w-5 h-5" /></span>;
        default: return <div className="w-5 h-5 border-2 border-gray-600 rounded-full" />;
    }
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden flex items-start p-4 space-x-4">
        <div className="flex-shrink-0 pt-1">
            {getStatusIndicator()}
        </div>
        <div className="flex-grow min-w-0">
            <h3 className="text-lg font-semibold text-gray-300">{task.title}</h3>
            {task.error && (
                <div className="mt-2 text-sm text-red-400 bg-red-900/30 p-2 rounded-md">
                    <strong>Error:</strong> {task.error}
                </div>
            )}
            {task.content && (
                <div className="prose prose-invert max-w-none mt-2">
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(task.content) }} />
                    {task.status === 'in_progress' && (
                        <span className="inline-block w-2.5 h-5 bg-purple-400 animate-pulse ml-1 align-bottom" />
                    )}
                </div>
            )}
        </div>
    </div>
  );
};
