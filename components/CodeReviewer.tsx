import React, { useState, useEffect, useCallback } from 'react';
import type { ReviewResult } from '../types';
import { reviewCodeStream } from '../services/geminiService';
import { DiffViewer } from './DiffViewer';
import { Spinner } from './Spinner';
import { WandIcon } from './icons/WandIcon';
import { InfoIcon } from './icons/InfoIcon';
import { StreamingResponse } from './StreamingResponse';

interface CodeReviewerProps {
  file: { path: string; content: string } | null;
  isLoadingFile: boolean;
}

export const CodeReviewer: React.FC<CodeReviewerProps> = ({ file, isLoadingFile }) => {
  const [reviewResult, setReviewResult] = useState<ReviewResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [streamedComments, setStreamedComments] = useState<string>('');

  useEffect(() => {
    setReviewResult(null);
    setError(null);
    setStreamedComments('');
  }, [file]);

  const handleReview = useCallback(async () => {
    if (!file) return;
    setIsLoading(true);
    setError(null);
    setReviewResult(null);
    setStreamedComments('');

    try {
      const stream = reviewCodeStream(file.content, file.path);
      let fullResponse = '';
      for await (const chunk of stream) {
        fullResponse += chunk;
        setStreamedComments(fullResponse);
      }

      const parts = fullResponse.split('<<CODE_SEPARATOR>>');
      if (parts.length < 2) {
        throw new Error("Review response format is invalid. The model did not provide a code separator.");
      }
      
      const comments = parts[0].trim();
      const correctedCodeRaw = parts.slice(1).join('<<CODE_SEPARATOR>>').trim();
      
      const codeMatch = correctedCodeRaw.match(/```(?:\w+)?\n([\s\S]*?)\n```/);
      const correctedCode = codeMatch ? codeMatch[1] : correctedCodeRaw;

      setReviewResult({
        reviewComments: comments,
        correctedCode: correctedCode.trim(),
      });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred during review.');
    } finally {
      setIsLoading(false);
    }
  }, [file]);

  const renderContent = () => {
    if (isLoading) {
      return <StreamingResponse text={streamedComments} />;
    }
    if (reviewResult) {
      return (
        <div className="flex-grow flex flex-col gap-4 overflow-hidden">
            <DiffViewer originalCode={file!.content} correctedCode={reviewResult.correctedCode} />
            <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-y-auto">
                <h3 className="text-lg font-semibold p-4 border-b border-gray-700 sticky top-0 bg-gray-800/80 backdrop-blur-sm">Review Comments</h3>
                <div className="p-4 prose prose-invert max-w-none prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-600" dangerouslySetInnerHTML={{ __html: reviewResult.reviewComments.replace(/\n/g, '<br />') }}></div>
            </div>
        </div>
      );
    }
    if(file) {
      return (
        <div className="flex-grow bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
            <pre className="h-full overflow-auto p-4 text-sm"><code className="language-javascript">{file.content}</code></pre>
        </div>
      );
    }
    return null; // Should not happen if !file is handled outside
  };

  if (isLoadingFile) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
        <Spinner />
        <p className="mt-4 text-lg">Loading file content...</p>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 p-8 text-gray-500">
        <InfoIcon className="h-12 w-12 mb-4" />
        <h2 className="text-xl font-semibold">Select a file to begin</h2>
        <p>Choose a file from the list on the left to view its content and start a review.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0 bg-gray-800/50 rounded-lg p-4 border border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-200 truncate pr-4" title={file.path}>{file.path}</h2>
        <button
          onClick={handleReview}
          disabled={isLoading}
          className="flex items-center space-x-2 bg-purple-600 text-white font-semibold rounded-md px-4 py-2 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed transition-colors duration-200"
        >
          {isLoading ? <Spinner className="w-5 h-5" /> : <WandIcon className="w-5 h-5" />}
          <span>{isLoading ? 'Reviewing...' : 'Review Code'}</span>
        </button>
      </div>

      {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg">{error}</div>}
      
      {renderContent()}

    </div>
  );
};