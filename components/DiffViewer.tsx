import React from 'react';
import { diffLines, type Change } from 'diff';

interface DiffViewerProps {
  originalCode: string;
  correctedCode: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ originalCode, correctedCode }) => {
  const diffs = diffLines(originalCode, correctedCode);

  const renderPart = (part: Change, index: number) => {
    const colorClass = part.added ? 'bg-green-800/30' : part.removed ? 'bg-red-800/30' : '';
    const prefix = part.added ? '+' : part.removed ? '-' : ' ';
    const prefixColor = part.added ? 'text-green-400' : part.removed ? 'text-red-400' : 'text-gray-500';
    
    // Split into lines, handling potential trailing newline
    const lines = part.value.endsWith('\n') ? part.value.slice(0, -1).split('\n') : part.value.split('\n');

    return (
        <React.Fragment key={index}>
            {lines.map((line, lineIndex) => (
                <div key={lineIndex} className={`flex text-gray-300 ${colorClass}`}>
                    <span className={`w-8 text-center select-none ${prefixColor}`}>{prefix}</span>
                    <span className="flex-grow pr-4">{line || ' '}</span>
                </div>
            ))}
        </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col gap-4 h-96">
      <div className="w-full flex flex-col bg-gray-900/70 rounded-lg border border-gray-700 overflow-hidden">
        <h3 className="text-md font-semibold p-3 bg-gray-800/80 border-b border-gray-700 flex-shrink-0">Code Diff</h3>
        <div className="overflow-auto flex-grow font-mono text-sm">
          <pre className="p-4">
              {diffs.map(renderPart)}
          </pre>
        </div>
      </div>
    </div>
  );
};