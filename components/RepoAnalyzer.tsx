import React from 'react';
import { marked } from 'marked';
import type { AnalysisTask, RepoFileWithContent } from '../types';
import { Spinner } from './Spinner';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { parseGitHubUrl } from '../services/githubService';
import { LogViewer } from './LogViewer';
import { AnalysisTaskItem } from './AnalysisTask';

interface RepoAnalyzerProps {
  repoUrl: string;
  analysisTasks: AnalysisTask[];
  originalFiles: RepoFileWithContent[] | null;
  isLoading: boolean;
  logs: string[];
  onReset: () => void;
}

export const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ repoUrl, analysisTasks, originalFiles, isLoading, logs, onReset }) => {
  
  const handleExport = () => {
    if (analysisTasks.length === 0 || !repoUrl) return;

    const parsedUrl = parseGitHubUrl(repoUrl);
    const repoName = parsedUrl ? parsedUrl.repo : 'repository';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${repoName}-analysis-${date}.md`;

    let markdownContent = `# Code Review Analysis for ${repoName}\n\n**Date:** ${date}\n\n---\n\n`;

    analysisTasks.forEach(task => {
        markdownContent += `## ${task.title}\n\n`;
        if (task.error) {
             markdownContent += `**Error during this step:** ${task.error}\n\n`;
        } else {
             markdownContent += `${task.content}\n\n`;
        }
        markdownContent += `---\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const hasStartedAnalysis = analysisTasks.length > 0;

  // Initial loading view: shown only during file fetching.
  if (isLoading && !hasStartedAnalysis) {
    return (
      <div className="flex flex-col h-full bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
        <div className="flex items-center flex-shrink-0">
            <Spinner className="h-10 w-10 mr-4" />
            <div>
                <h2 className="text-xl font-semibold text-gray-200">Preparing Analysis...</h2>
                <p className="text-sm text-purple-400">Fetching all repository files...</p>
            </div>
        </div>
        <div className="w-full flex-grow min-h-0">
            <LogViewer logs={logs} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-200">Repository Architectural Analysis</h2>
            {isLoading && (
                <div className="flex items-center gap-2 text-sm text-purple-400 mt-1">
                    <Spinner className="w-4 h-4" />
                    <span>Analysis in progress...</span>
                </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
              <button
                  onClick={handleExport}
                  disabled={isLoading || analysisTasks.length === 0}
                  className="flex items-center space-x-2 border border-gray-600 text-gray-300 font-semibold rounded-md px-4 py-2 hover:bg-gray-700/50 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Export analysis to Markdown"
              >
                  <DownloadIcon className="w-5 h-5" />
                  <span>Export</span>
              </button>
              <button
              onClick={onReset}
              className="flex items-center space-x-2 border border-purple-600 text-purple-300 font-semibold rounded-md px-4 py-2 hover:bg-purple-600/20 transition-colors duration-200"
              >
              <PlusCircleIcon className="w-5 h-5" />
              <span>New Review</span>
              </button>
          </div>
      </div>
      
      <div className="flex-grow space-y-4 overflow-y-auto pr-2 p-1">
          {!hasStartedAnalysis && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <AlertTriangleIcon className="h-12 w-12 mb-4" />
                  <h2 className="text-xl font-semibold">Analysis Not Started</h2>
                  <p>Click "Analyze Entire Repository" to begin.</p>
              </div>
          )}

          {analysisTasks.map(task => (
              <AnalysisTaskItem key={task.id} task={task} />
          ))}
          
      </div>
    </div>
  );
};
