
import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ReviewState, RepoFileWithContent } from '../types';
import { reviewCodeStream, lintCode } from '../services/geminiService';
import { DiffViewer } from './DiffViewer';
import { Spinner } from './Spinner';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { WandIcon } from './icons/WandIcon';
import { ReviewComments } from './ReviewComments';
import { CODE_SEPARATOR } from '../utils/constants';

interface CodeReviewerProps {
  files: RepoFileWithContent[];
  onReset: () => void;
}

export const CodeReviewer: React.FC<CodeReviewerProps> = ({ files, onReset }) => {
  const [reviewStates, setReviewStates] = useState<Map<string, ReviewState>>(new Map());
  const [activeFilePath, setActiveFilePath] = useState<string | null>(files.length > 0 ? files[0].path : null);
  const [highlightedLines, setHighlightedLines] = useState<Set<number> | null>(null);
  const commentsRef = useRef<HTMLDivElement>(null);
  const mainPanelRef = useRef<HTMLElement>(null);

  const runReview = useCallback(async (file: RepoFileWithContent) => {
    setReviewStates(prev => new Map(prev).set(file.path, {
        status: 'streaming',
        lintingStatus: 'idle',
        streamedComments: '',
        result: null,
        error: null,
    }));

    try {
      const stream = reviewCodeStream(file.content, file.path);
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        setReviewStates(prev => {
            const currentState = prev.get(file.path);
            if (!currentState) return prev;
            const newStates = new Map(prev);
            newStates.set(file.path, { ...currentState, status: 'streaming', streamedComments: fullResponse });
            return newStates;
        });
      }

      const parts = fullResponse.split(CODE_SEPARATOR);
      if (parts.length < 2) throw new Error("Review response format is invalid. The model did not provide a code separator.");
      
      const comments = parts[0].trim();
      const correctedCodeRaw = parts.slice(1).join(CODE_SEPARATOR).trim();
      const codeMatch = correctedCodeRaw.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
      const correctedCode = codeMatch ? codeMatch[1] : correctedCodeRaw;

      setReviewStates(prev => new Map(prev).set(file.path, {
        status: 'complete',
        lintingStatus: 'idle',
        streamedComments: comments,
        result: { reviewComments: comments, correctedCode: correctedCode.trim() },
        error: null,
      }));

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setReviewStates(prev => {
          const currentState = prev.get(file.path);
          if (!currentState) return prev;
          const newStates = new Map(prev);
          newStates.set(file.path, { ...currentState, status: 'error', error: errorMessage });
          return newStates;
      });
    }
  }, []);
  
    const handleLintFile = useCallback(async (file: RepoFileWithContent) => {
        setReviewStates(prev => {
            const currentState = prev.get(file.path);
            if (!currentState) return prev;
            const newStates = new Map(prev);
            newStates.set(file.path, { ...currentState, lintingStatus: 'linting' });
            return newStates;
        });

        try {
            const lintedCode = await lintCode(file.content, file.path);
            
            setReviewStates(prev => {
                const currentState = prev.get(file.path);
                if (!currentState || !currentState.result) return prev;
                const newStates = new Map(prev);
                const newResult = { ...currentState.result, correctedCode: lintedCode };
                newStates.set(file.path, {
                    ...currentState,
                    result: newResult,
                    lintingStatus: 'complete',
                });
                return newStates;
            });

        } catch (err) {
            console.error("Linting failed:", err);
            setReviewStates(prev => {
                const currentState = prev.get(file.path);
                if (!currentState) return prev;
                const newStates = new Map(prev);
                newStates.set(file.path, { ...currentState, lintingStatus: 'error' });
                return newStates;
            });
        }
    }, []);

  useEffect(() => {
    const initialStates = new Map<string, ReviewState>();
    files.forEach(file => {
        if (file.error) {
             initialStates.set(file.path, {
                status: 'error',
                lintingStatus: 'idle',
                streamedComments: '',
                result: null,
                error: file.error,
            });
        } else {
            initialStates.set(file.path, {
                status: 'idle',
                lintingStatus: 'idle',
                streamedComments: '',
                result: null,
                error: null,
            });
        }
    });
    setReviewStates(initialStates);

    files.forEach(file => {
        if (!file.error) {
            runReview(file);
        }
    });
  }, [files, runReview]);
  
  useEffect(() => {
    const commentsElement = commentsRef.current;
    if (!commentsElement) return;
    
    const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const span = target.closest('span[data-lines]');
        
        if (span) {
            const linesAttr = span.getAttribute('data-lines');
            if (linesAttr) {
                const [startStr, endStr] = linesAttr.split('-');
                const start = parseInt(startStr, 10);
                const end = endStr ? parseInt(endStr, 10) : start;

                if (!isNaN(start)) {
                    const lines = new Set<number>();
                    for (let i = start; i <= end; i++) {
                        lines.add(i);
                    }
                    setHighlightedLines(lines);
                    
                    const diffViewer = mainPanelRef.current?.querySelector('.diff-viewer-container');
                    if (diffViewer instanceof HTMLElement) {
                        diffViewer.classList.remove('animate-pulse-once');
                        void diffViewer.offsetWidth; 
                        setTimeout(() => diffViewer.classList.add('animate-pulse-once'), 10);
                    }
                }
            }
        }
    };
    
    commentsElement.addEventListener('click', handleClick);
    
    return () => {
        commentsElement.removeEventListener('click', handleClick);
    };
  }, [reviewStates, activeFilePath]);

  const selectFile = (path: string) => {
    setActiveFilePath(path);
    setHighlightedLines(null);
  };
  
  const getStatusIndicator = (status: ReviewState['status']) => {
    switch(status) {
        case 'streaming': return <Spinner className="w-4 h-4 text-purple-400" />;
        case 'complete': return <span className="text-green-400 text-lg font-bold">✓</span>;
        case 'error': return <span className="text-red-400 text-lg font-bold">✗</span>;
        case 'idle': return <span className="text-gray-500">...</span>;
    }
  };

  const activeFile = files.find(f => f.path === activeFilePath);
  const activeFileState = activeFilePath ? reviewStates.get(activeFilePath) : null;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-200">Reviewing {files.length} file(s)</h2>
        <button
          onClick={onReset}
          className="flex items-center space-x-2 border border-purple-600 text-purple-300 font-semibold rounded-md px-4 py-2 hover:bg-purple-600/20 transition-colors duration-200"
        >
          <PlusCircleIcon className="w-5 h-5" />
          <span>New Review</span>
        </button>
      </div>
      
      <div className="flex-grow flex gap-4 min-h-0">
        {/* Sidebar */}
        <nav className="w-1/3 max-w-sm bg-gray-800/50 rounded-lg border border-gray-700 overflow-y-auto flex flex-col">
            <h3 className="p-4 font-semibold text-gray-300 border-b border-gray-700 flex-shrink-0 sticky top-0 bg-gray-800/80 backdrop-blur-sm">Files for Review</h3>
            <ul className="p-2 space-y-1">
                {files.map(file => {
                    const state = reviewStates.get(file.path);
                    const isActive = activeFilePath === file.path;
                    return (
                        <li key={file.path}>
                            <button 
                                onClick={() => selectFile(file.path)}
                                className={`w-full text-left flex items-center gap-3 p-2 rounded-md transition-colors ${isActive ? 'bg-purple-600/30 text-purple-200' : 'hover:bg-gray-700/50 text-gray-400'}`}
                            >
                                <div className="flex-shrink-0 w-4">
                                    {state ? getStatusIndicator(state.status) : null}
                                </div>
                                <span className="truncate text-sm" title={file.path}>{file.path}</span>
                            </button>
                        </li>
                    )
                })}
            </ul>
        </nav>

        {/* Main Content */}
        <main ref={mainPanelRef} className="flex-grow bg-gray-800/50 rounded-lg border border-gray-700 flex flex-col">
           {activeFile && activeFileState ? (
                <>
                    <div className="p-4 border-b border-gray-700 flex-shrink-0 flex justify-between items-center">
                        <h3 className="font-mono text-lg truncate text-gray-200" title={activeFile.path}>{activeFile.path}</h3>
                        {activeFileState.status === 'complete' && activeFileState.result && (
                             <button
                                onClick={() => handleLintFile(activeFile)}
                                disabled={activeFileState.lintingStatus === 'linting'}
                                className="flex items-center gap-2 text-sm bg-gray-700 text-white font-semibold rounded-md px-3 py-1.5 hover:bg-gray-600 transition-colors duration-200 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                                title="Automatically fix formatting and style issues"
                            >
                                {activeFileState.lintingStatus === 'linting' ? <Spinner className="w-4 h-4" /> : <WandIcon className="w-4 h-4" />}
                                <span>{activeFileState.lintingStatus === 'linting' ? 'Formatting...' : 'Auto-Fix & Format'}</span>
                            </button>
                        )}
                    </div>
                    
                    {activeFileState.status === 'error' && (
                        <div className="p-4 m-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg">{activeFileState.error}</div>
                    )}
                    
                    {activeFileState.status !== 'error' && (
                         <div className="flex flex-grow min-h-0 gap-4 p-4">
                            <div className="w-2/5 flex flex-col">
                                <ReviewComments state={activeFileState} containerRef={commentsRef} />
                            </div>
                            <div className="w-3/5 flex flex-col">
                                <DiffViewer 
                                  originalCode={activeFile.content} 
                                  correctedCode={activeFileState.result?.correctedCode ?? activeFile.content} 
                                  highlightedLines={highlightedLines} 
                                />
                            </div>
                         </div>
                    )}
                </>
           ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    <p>Select a file to view its review.</p>
                </div>
           )}
        </main>
      </div>
    </div>
  );
};