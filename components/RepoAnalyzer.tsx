import React, { useState, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import type { HolisticAnalysisResult, RepoFileWithContent } from '../types';
import { DiffViewer } from './DiffViewer';
import { Spinner } from './Spinner';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { ChevronIcon } from './icons/ChevronIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { parseGitHubUrl } from '../services/githubService';
import { LogViewer } from './LogViewer';

interface RepoAnalyzerProps {
  repoUrl: string;
  analysisResult: HolisticAnalysisResult | null;
  originalFiles: RepoFileWithContent[] | null;
  isLoading: boolean;
  statusText: string;
  logs: string[];
  onReset: () => void;
}

const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; count?: number, defaultOpen?: boolean }> = ({ title, children, count, defaultOpen = true }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const fullTitle = count !== undefined ? `${title} (${count})` : title;

    return (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700/50 text-lg font-semibold bg-gray-800/80 text-gray-300"
            >
                <span>{fullTitle}</span>
                <ChevronIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="border-t border-gray-700">{children}</div>}
        </div>
    );
};

export const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ repoUrl, analysisResult, originalFiles, isLoading, statusText, logs, onReset }) => {
  const [openFixPath, setOpenFixPath] = useState<string | null>(null);

  const originalFilesMap = useMemo(() => {
    if (!originalFiles) return new Map();
    return new Map(originalFiles.map(f => [f.path, f.content]));
  }, [originalFiles]);
  
  const handleExport = useCallback(() => {
    if (!analysisResult || !repoUrl) return;

    const { overallAnalysis, dependencyReview, errorTrends, suggestedFixes } = analysisResult;

    const parsedUrl = parseGitHubUrl(repoUrl);
    const repoName = parsedUrl ? parsedUrl.repo : 'repository';
    const date = new Date().toISOString().split('T')[0];
    const filename = `${repoName}-analysis-${date}.md`;

    let markdownContent = `# Code Review Analysis for ${repoName}\n\n**Date:** ${date}\n\n---\n\n`;

    if (overallAnalysis) {
        markdownContent += `## Overall Analysis\n\n${overallAnalysis}\n\n---\n\n`;
    }

    if (dependencyReview) {
        markdownContent += `## Dependency Review\n\n`;
        markdownContent += `### Analysis\n${dependencyReview.analysis}\n\n`;
        if (dependencyReview.suggestions?.length > 0) {
            markdownContent += `### Suggestions\n\n`;
            markdownContent += dependencyReview.suggestions.map(s => `- ${s}`).join('\n');
            markdownContent += `\n\n`;
        }
        markdownContent += `---\n\n`;
    }

    if (errorTrends && errorTrends.length > 0) {
        markdownContent += `## Common Error Trends\n\n`;
        errorTrends.forEach(trend => {
            markdownContent += `### ${trend.trendDescription}\n\n`;
            markdownContent += `- **Files Affected:** ${trend.filesAffected.join(', ')}\n\n`;
        });
        markdownContent += `---\n\n`;
    }

    if (suggestedFixes && suggestedFixes.length > 0) {
        markdownContent += `## Suggested Fixes\n\n`;
        suggestedFixes.forEach((fix, index) => {
            const lang = fix.filePath.split('.').pop() || '';
            markdownContent += `### ${index + 1}. \`${fix.filePath}\`\n\n`;
            markdownContent += `${fix.description}\n\n`;
            markdownContent += `**Corrected Code:**\n`;
            markdownContent += `\`\`\`${lang}\n${fix.correctedCode}\n\`\`\`\n\n`;
        });
    }

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }, [analysisResult, repoUrl]);


  // Initial loading view: shown during file fetching, before any analysis results arrive.
  if (isLoading && !analysisResult?.overallAnalysis) {
    return (
      <div className="flex flex-col h-full bg-gray-800/50 rounded-lg border border-gray-700 p-4 space-y-4">
        <div className="flex items-center flex-shrink-0">
            <Spinner className="h-10 w-10 mr-4" />
            <div>
                <h2 className="text-xl font-semibold text-gray-200">Analysis in Progress</h2>
                <p className="text-sm text-purple-400">{statusText || 'Please wait...'}</p>
            </div>
        </div>
        <div className="w-full flex-grow min-h-0">
            <LogViewer logs={logs} />
        </div>
      </div>
    );
  }

  // Results View: shown once analysis starts and data begins to stream in.
  const { overallAnalysis, dependencyReview, errorTrends, suggestedFixes } = analysisResult ?? {};
  
  const toggleAccordion = (path: string) => {
      setOpenFixPath(prev => (prev === path ? null : path));
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
          <div>
                <h2 className="text-lg font-semibold text-gray-200">Repository Architectural Analysis</h2>
                {isLoading && (
                    <div className="flex items-center gap-2 text-sm text-purple-400 mt-1">
                        <Spinner className="w-4 h-4" />
                        <span>{statusText}</span>
                    </div>
                )}
          </div>
          <div className="flex items-center space-x-2">
              <button
                  onClick={handleExport}
                  disabled={isLoading || !analysisResult?.overallAnalysis}
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
      
      <div className="flex-grow space-y-6 overflow-y-auto pr-2 p-1">
          {isLoading && (
              <CollapsibleSection title="Analysis Log" defaultOpen={true}>
                  <div className="p-2 h-64">
                      <LogViewer logs={logs} />
                  </div>
              </CollapsibleSection>
          )}

          {!isLoading && !analysisResult && (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <AlertTriangleIcon className="h-12 w-12 mb-4" />
                  <h2 className="text-xl font-semibold">Analysis Not Started</h2>
              </div>
          )}

          {overallAnalysis &&
              <CollapsibleSection title="Overall Analysis">
                  <div className="p-4">
                    <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(overallAnalysis) }} />
                    {isLoading && <span className="inline-block w-2.5 h-5 bg-purple-400 animate-pulse ml-1 align-bottom" />}
                  </div>
              </CollapsibleSection>
          }
          {dependencyReview &&
              <CollapsibleSection title="Dependency Review">
                  <div className="p-4 prose prose-invert max-w-none">
                      <div dangerouslySetInnerHTML={{ __html: marked.parse(dependencyReview.analysis) }} />
                      {dependencyReview.suggestions?.length > 0 && (
                          <>
                              <h4 className="font-semibold mt-4">Suggestions:</h4>
                              <ul>
                                  {dependencyReview.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                              </ul>
                          </>
                      )}
                  </div>
              </CollapsibleSection>
          }

          {errorTrends && errorTrends.length > 0 &&
              <CollapsibleSection title="Common Error Trends" count={errorTrends.length}>
                  <div className="p-4 space-y-4">
                      {errorTrends.map((trend, i) => (
                          <div key={i} className="p-3 bg-gray-900/50 rounded-md border border-gray-600">
                              <p className="font-semibold text-gray-200">{trend.trendDescription}</p>
                              <p className="text-sm text-gray-400 mt-2">Files affected: {trend.filesAffected.join(', ')}</p>
                          </div>
                      ))}
                  </div>
              </CollapsibleSection>
          }

          {suggestedFixes && suggestedFixes.length > 0 &&
              <CollapsibleSection title="Suggested Fixes" count={suggestedFixes.length}>
                  <div className="p-2 space-y-2">
                  {suggestedFixes.map(fix => {
                      const originalCode = originalFilesMap.get(fix.filePath);
                      const isOpen = openFixPath === fix.filePath;
                      return (
                          <div key={fix.filePath} className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden transition-all duration-300 flex flex-col">
                              <button onClick={() => toggleAccordion(fix.filePath)} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700/50">
                                  <span className="font-medium text-gray-300 truncate" title={fix.filePath}>{fix.filePath}</span>
                                  <ChevronIcon className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {isOpen && (
                                  <div className="border-t border-gray-700 bg-gray-900/50 p-4 space-y-4">
                                      <div className="prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(fix.description) }} />
                                      {originalCode ? (
                                          <DiffViewer originalCode={originalCode} correctedCode={fix.correctedCode} highlightedLines={null} />
                                      ) : (
                                          <div className="text-red-400">Could not find original code to create a diff for {fix.filePath}.</div>
                                      )}
                                  </div>
                              )}
                          </div>
                      )
                  })}
                  </div>
              </CollapsibleSection>
          }
      </div>
    </div>
  );
};