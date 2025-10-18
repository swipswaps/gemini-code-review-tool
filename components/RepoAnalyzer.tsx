import React, { useState, useMemo } from 'react';
import { marked } from 'marked';
import type { HolisticAnalysisResult, RepoFileWithContent } from '../types';
import { DiffViewer } from './DiffViewer';
import { Spinner } from './Spinner';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { AlertTriangleIcon } from './icons/AlertTriangleIcon';
import { ChevronIcon } from './icons/ChevronIcon';

interface RepoAnalyzerProps {
  analysisResult: HolisticAnalysisResult | null;
  originalFiles: RepoFileWithContent[] | null;
  isLoading: boolean;
  statusText: string;
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

export const RepoAnalyzer: React.FC<RepoAnalyzerProps> = ({ analysisResult, originalFiles, isLoading, statusText, onReset }) => {
  const [openFixPath, setOpenFixPath] = useState<string | null>(null);

  const originalFilesMap = useMemo(() => {
    if (!originalFiles) return new Map();
    return new Map(originalFiles.map(f => [f.path, f.content]));
  }, [originalFiles]);
  
  const renderLoading = () => (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
        <Spinner className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold text-gray-300">Analysis in Progress</h2>
        <p className="text-center">{statusText}</p>
      </div>
  );

  const renderIdle = () => (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
        <AlertTriangleIcon className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold">Analysis Not Started</h2>
        <p className="text-center">
            Click the "Analyze Entire Repository" button to begin.
        </p>
    </div>
  );
  
  const renderResults = () => {
    if (!analysisResult) return renderIdle();
    const { overallAnalysis, dependencyReview, errorTrends, suggestedFixes } = analysisResult;

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
            <button
            onClick={onReset}
            className="flex items-center space-x-2 border border-purple-600 text-purple-300 font-semibold rounded-md px-4 py-2 hover:bg-purple-600/20 transition-colors duration-200"
            >
            <PlusCircleIcon className="w-5 h-5" />
            <span>New Review</span>
            </button>
        </div>
        
        <div className="flex-grow space-y-6 overflow-y-auto pr-2 p-1">
            {overallAnalysis &&
                <CollapsibleSection title="Overall Analysis">
                    <div className="p-4 prose prose-invert max-w-none" dangerouslySetInnerHTML={{ __html: marked.parse(overallAnalysis) }} />
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
  
  if (isLoading && !analysisResult?.overallAnalysis) return renderLoading();
  return renderResults();
};