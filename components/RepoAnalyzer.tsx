import React, { useState } from 'react';
import type { AnalysisTask, RepoFileWithContent } from '../types';
import { Spinner } from './Spinner';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { parseGitHubUrl } from '../services/githubService';
import { LogViewer } from './LogViewer';
import { AnalysisTaskItem } from './AnalysisTask';
import { InfoIcon } from './icons/InfoIcon';
import { ChevronIcon } from './icons/ChevronIcon';

interface RepoAnalyzerProps {
  repoUrl: string;
  analysisTasks: AnalysisTask[];
  filesWithContent: Map<string, string>; // Changed from array to map
  currentlyProcessingFile: string | null;
  isLoading: boolean;
  logs: string[];
  onReset: () => void;
}

export const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ repoUrl, analysisTasks, filesWithContent, currentlyProcessingFile, isLoading, logs, onReset }) => {
  const [isLogViewerOpen, setIsLogViewerOpen] = useState(false);

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

  const hasStartedTasks = analysisTasks.length > 0;
  const fileContent = currentlyProcessingFile ? filesWithContent.get(currentlyProcessingFile) : null;
  const isProcessingContext = isLoading && !hasStartedTasks;

  let headerText = "Analysis in Progress...";
  let subHeaderText = "Initializing...";

  if (isLoading) {
      if (isProcessingContext) {
          headerText = "Building Analysis Context...";
          subHeaderText = currentlyProcessingFile || '...';
      } else if (hasStartedTasks) {
          headerText = "Performing Analysis...";
          const currentTask = analysisTasks.find(t => t.status === 'in_progress');
          subHeaderText = currentTask ? currentTask.title : "Running analysis tasks...";
      } else {
          headerText = "Preparing Analysis...";
          subHeaderText = "Discovering all repository files...";
      }
  } else if (hasStartedTasks) {
      headerText = "Repository Architectural Analysis";
      subHeaderText = "Analysis complete.";
  }

  if (!isLoading && !hasStartedTasks) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
        <InfoIcon className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold">Ready for Analysis</h2>
        <p className="text-center">
          Use the "Analyze Entire Repository" button for a high-level architectural review,<br/>
          or select individual files to start a detailed code review.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. Unified Header */}
      <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
          <div className="flex items-center min-w-0">
            {isLoading && <Spinner className="h-8 w-8 mr-4" />}
            <div className="min-w-0">
                <h2 className="text-lg font-semibold text-gray-200 truncate">{headerText}</h2>
                <p className={`text-sm font-mono truncate ${isLoading ? 'text-purple-400' : 'text-green-400'}`}>{subHeaderText}</p>
            </div>
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

      {/* 2. Main Content Area (Tasks and Snippets) */}
      <div className="flex-grow min-h-0 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
          {isProcessingContext && currentlyProcessingFile && (
              <div className="bg-gray-900 p-3 rounded-md border border-gray-700 font-mono text-xs animate-pulse-once">
                  <h4 className="text-gray-500 mb-2">Processing: {currentlyProcessingFile}</h4>
                  <pre className="text-gray-400 overflow-hidden text-ellipsis whitespace-pre-wrap h-24">
                      {fileContent?.split('\n').slice(0, 10).join('\n') || '(Empty or binary file)'}
                  </pre>
              </div>
          )}
          
          {hasStartedTasks && analysisTasks.map(task => <AnalysisTaskItem key={task.id} task={task} />)}
      </div>
      
      {/* 3. Collapsible Log Viewer */}
       <div className="w-full flex-shrink-0">
          <div className="bg-gray-900 rounded-md border border-gray-700 flex flex-col transition-all duration-300">
              <button 
                  onClick={() => setIsLogViewerOpen(!isLogViewerOpen)}
                  className="p-2 w-full text-left flex justify-between items-center bg-gray-800/50 hover:bg-gray-700/50 rounded-t-md"
                  aria-expanded={isLogViewerOpen}
                  aria-controls="log-viewer-content"
              >
                  <h3 className="font-semibold text-gray-400">System Logs</h3>
                  <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full">{logs.length} entries</span>
                      <ChevronIcon className={`w-5 h-5 transition-transform ${isLogViewerOpen ? 'rotate-180' : ''}`} />
                  </div>
              </button>
              {isLogViewerOpen && (
                  <div id="log-viewer-content" className="h-48">
                      <LogViewer logs={logs} />
                  </div>
              )}
          </div>
      </div>
    </div>
  );
};