import React, { useState, useEffect, useCallback } from 'react';
import type { ReviewResult } from '../types';
import { reviewCodeStream, lintCode } from '../services/geminiService';
import { DiffViewer } from './DiffViewer';
import { Spinner } from './Spinner';
import { StreamingResponse } from './StreamingResponse';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { WandIcon } from './icons/WandIcon';

interface CodeReviewerProps {
  files: { path: string; content: string }[];
  onReset: () => void;
}

type ReviewStatus = 'idle' | 'streaming' | 'complete' | 'error';
type LintingStatus = 'idle' | 'linting' | 'complete' | 'error';

interface ReviewState {
  status: ReviewStatus;
  lintingStatus: LintingStatus;
  streamedComments: string;
  result: ReviewResult | null;
  error: string | null;
}

const ChevronIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="m6 9 6 6 6-6"/>
    </svg>
);


export const CodeReviewer: React.FC<CodeReviewerProps> = ({ files, onReset }) => {
  const [reviewStates, setReviewStates] = useState<Map<string, ReviewState>>(new Map());
  const [openFilePath, setOpenFilePath] = useState<string | null>(files.length > 0 ? files[0].path : null);

  const runReview = useCallback(async (file: { path: string; content: string }) => {
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
            if (currentState) {
                newStates.set(file.path, { ...currentState, status: 'streaming', streamedComments: fullResponse });
            }
            return newStates;
        });
      }

      const parts = fullResponse.split('<<CODE_SEPARATOR>>');
      if (parts.length < 2) throw new Error("Review response format is invalid. The model did not provide a code separator.");
      
      const comments = parts[0].trim();
      const correctedCodeRaw = parts.slice(1).join('<<CODE_SEPARATOR>>').trim();
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
          if (currentState) {
              newStates.set(file.path, { ...currentState, status: 'error', error: errorMessage });
          }
          return newStates;
      });
    }
  }, []);
  
    const handleLintFile = useCallback(async (file: { path: string; content: string }) => {
        setReviewStates(prev => {
            const newStates = new Map(prev);
            const currentState = newStates.get(file.path);
            if (currentState) {
                newStates.set(file.path, { ...currentState, lintingStatus: 'linting' });
            }
            return newStates;
        });

        try {
            const lintedCode = await lintCode(file.content, file.path);
            
            setReviewStates(prev => {
                const newStates = new Map(prev);
                const currentState = newStates.get(file.path);
                if (currentState && currentState.result) {
                    const newResult = { ...currentState.result, correctedCode: lintedCode };
                    newStates.set(file.path, {
                        ...currentState,
                        result: newResult,
                        lintingStatus: 'complete',
                    });
                }
                return newStates;
            });

        } catch (err) {
            console.error("Linting failed:", err);
            setReviewStates(prev => {
                const newStates = new Map(prev);
                const currentState = newStates.get(file.path);
                if (currentState) {
                    newStates.set(file.path, { ...currentState, lintingStatus: 'error' });
                }
                return newStates;
            });
        }
    }, []);

  useEffect(() => {
    const initialStates = new Map<string, ReviewState>();
    files.forEach(file => {
        initialStates.set(file.path, {
            status: 'idle',
            lintingStatus: 'idle',
            streamedComments: '',
            result: null,
            error: null,
        });
    });
    setReviewStates(initialStates);

    files.forEach(file => runReview(file));

  }, [files, runReview]);

  const toggleAccordion = (path: string) => {
    setOpenFilePath(prev => (prev === path ? null : path));
  };
  
  const getStatusIndicator = (status: ReviewStatus) => {
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
          className="flex items-center space-x-2 bg-gray-700 text-white font-semibold rounded-md px-4 py-2 hover:bg-gray-600 transition-colors duration-200"
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
            <div key={file.path} className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden transition-all duration-300">
                <button onClick={() => toggleAccordion(file.path)} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-700/50">
                    <div className="flex items-center gap-3 truncate">
                        {getStatusIndicator(state.status)}
                        <span className="font-medium text-gray-300 truncate" title={file.path}>{file.path}</span>
                    </div>
                    <ChevronIcon className={`w-5 h-5 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                    <div className="p-4 border-t border-gray-700 bg-gray-900/50">
                        {state.status === 'streaming' && <StreamingResponse text={state.streamedComments} />}
                        {state.status === 'complete' && state.result && (
                             <div className="flex flex-col gap-4">
                                <DiffViewer originalCode={file.content} correctedCode={state.result.correctedCode} />
                                
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

                                <div className="bg-gray-800 rounded-lg border border-gray-700 max-h-96 overflow-y-auto">
                                    <h3 className="text-md font-semibold p-3 border-b border-gray-700 sticky top-0 bg-gray-800/80 backdrop-blur-sm">Review Comments</h3>
                                    <div className="p-4 prose prose-invert max-w-none prose-pre:bg-gray-900" dangerouslySetInnerHTML={{ __html: state.result.reviewComments.replace(/\n/g, '<br />') }} />
                                </div>
                            </div>
                        )}
                        {state.status === 'error' && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{state.error}</div>}
                    </div>
                )}
            </div>
          )
        })}
      </div>
    </div>
  );
};