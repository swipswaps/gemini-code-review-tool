


import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { ReviewState, RepoFileWithContent } from '../types';
import { reviewCodeStream, lintCode } from '../services/geminiService';
import { DiffViewer } from './DiffViewer';
import { Spinner } from './Spinner';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { WandIcon } from './icons/WandIcon';
import { ReviewComments } from './ReviewComments';
import { CODE_SEPARATOR } from '../utils/constants';
import { ChevronIcon } from './icons/ChevronIcon';

interface CodeReviewerProps {
  files: RepoFileWithContent[];
  onReset: () => void;
}

export const CodeReviewer: React.FC<CodeReviewerProps> = ({ files, onReset }) => {
  const [reviewStates, setReviewStates] = useState<Map<string, ReviewState>>(new Map());
  const [openFilePath, setOpenFilePath] = useState<string | null>(files.length > 0 ? files[0].path : null);
  const [highlightedLines, setHighlightedLines] = useState<Set<number> | null>(null);
  const commentsRef = useRef<HTMLDivElement>(null);

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
            const newStates = new Map(prev);
            const currentState = newStates.get(file.path);
            // FIX: Guard against undefined currentState before spreading.
            if (!currentState) return newStates;
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
          const newStates = new Map(prev);
          const currentState = newStates.get(file.path);
          // FIX: Guard against undefined currentState before spreading.
          if (!currentState) return newStates;
          newStates.set(file.path, { ...currentState, status: 'error', error: errorMessage });
          return newStates;
      });
    }
  }, []);
  
    const handleLintFile = useCallback(async (file: RepoFileWithContent) => {
        setReviewStates(prev => {
            const newStates = new Map(prev);
            const currentState = newStates.get(file.path);
            // FIX: Guard against undefined currentState before spreading.
            if (!currentState) return newStates;
            newStates.set(file.path, { ...currentState, lintingStatus: 'linting' });
            return newStates;
        });

        try {
            const lintedCode = await lintCode(file.content, file.path);
            
            setReviewStates(prev => {
                const newStates = new Map(prev);
                const currentState = newStates.get(file.path);
                // FIX: Guard against undefined currentState and null result before spreading.
                if (!currentState || !currentState.result) return newStates;
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
                const newStates = new Map(prev);
                const currentState = newStates.get(file.path);
                // FIX: Guard against undefined currentState before spreading.
                if (!currentState) return newStates;
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
    const currentRef = commentsRef.current;
    if (!currentRef) return;
    
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
                    
                    const diffViewer = currentRef.closest('.review-panel-content')?.querySelector('.diff-viewer-container');
                    if (diffViewer instanceof HTMLElement) {
                        diffViewer.classList.remove('animate-pulse-once');
                        void diffViewer.offsetWidth; 
                        setTimeout(() => diffViewer.classList.add('animate-pulse-once'), 10);
                    }
                }
            }
        }
    };
    
    currentRef.addEventListener('click', handleClick);
    
    return () => {
        currentRef.removeEventListener('click', handleClick);
    };
  }, [reviewStates, openFilePath]);


  const toggleAccordion = (path: string) => {
    setOpenFilePath(prev => (prev === path ? null : path));
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
      
      <div className="flex-grow space-y-2 overflow-y-auto pr-2">
        {files.map(file => {
          const state = reviewStates.get(file.path);
          if (!state) return null;
          const isOpen = openFilePath === file.path;

          return (
            <div key={file.path} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden transition-all duration-300 flex flex-col">
                <button onClick={() => toggleAccordion(file.path)} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700/50 flex-shrink-0">
                    <div className="flex items-center gap-3 truncate">
                        {getStatusIndicator(state.status)}
                        <span className="font-medium text-gray-300 truncate" title={file.path}>{file.path}</span>
                    </div>
                    <ChevronIcon className={`w-5 h-5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                     <div className="review-panel-content border-t border-gray-700 bg-gray-900/50 flex-grow min-h-0 flex flex-col">
                        {state.status === 'error' ? (
                            <div className="p-4 bg-red-900/50 border border-red-700 text-red-300 rounded-lg m-4">{state.error}</div>
                        ) : (
                            <div className="flex flex-col gap-4 p-4 flex-grow min-h-0">
                                <DiffViewer 
                                  originalCode={file.content} 
                                  correctedCode={state.result?.correctedCode ?? file.content} 
                                  highlightedLines={highlightedLines} 
                                />
                                
                                {state.status === 'complete' && state.result && (
                                    <div className="flex justify-end border-b border-gray-700 pb-4">
                                        <button
                                            onClick={() => handleLintFile(file)}
                                            disabled={state.lintingStatus === 'linting'}
                                            className="flex items-center gap-2 text-sm bg-gray-700 text-white font-semibold rounded-md px-3 py-1.5 hover:bg-gray-600 transition-colors duration-200 disabled:bg-gray-800 disabled:text-gray-500 disabled:cursor-not-allowed"
                                            title="Automatically fix formatting and style issues"
                                        >
                                            {state.lintingStatus === 'linting' ? 
                                                <Spinner className="w-4 h-4" /> : 
                                                <WandIcon className="w-4 h-4" />
                                            }
                                            <span>{state.lintingStatus === 'linting' ? 'Formatting...' : 'Auto-Fix & Format'}</span>
                                        </button>
                                    </div>
                                )}
                                
                                <ReviewComments state={state} containerRef={commentsRef} />
                            </div>
                        )}
                    </div>
                )}
            </div>
          )
        })}
      </div>
    </div>
  );
};