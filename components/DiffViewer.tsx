import React, { useMemo } from 'react';
import { diffLines, type Change } from 'diff';

interface DiffViewerProps {
  originalCode: string;
  correctedCode: string;
  highlightedLines: Set<number> | null;
}

type DiffLine = {
  content: string;
  lineNumber?: number;
  type: 'add' | 'remove' | 'equal' | 'placeholder';
};

const processDiff = (originalCode: string, correctedCode: string): { left: DiffLine[], right: DiffLine[] } => {
    const diffs = diffLines(originalCode, correctedCode);
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    let leftLineNum = 1;
    let rightLineNum = 1;

    diffs.forEach((part: Change) => {
        const lines = part.value.replace(/\n$/, '').split('\n');
        
        if (part.added) {
            lines.forEach(line => {
                left.push({ type: 'placeholder', content: '' });
                right.push({ type: 'add', content: line, lineNumber: rightLineNum++ });
            });
        } else if (part.removed) {
            lines.forEach(line => {
                left.push({ type: 'remove', content: line, lineNumber: leftLineNum++ });
                right.push({ type: 'placeholder', content: '' });
            });
        } else {
            lines.forEach(line => {
                left.push({ type: 'equal', content: line, lineNumber: leftLineNum++ });
                right.push({ type: 'equal', content: line, lineNumber: rightLineNum++ });
            });
        }
    });

    return { left, right };
};


export const DiffViewer: React.FC<DiffViewerProps> = ({ originalCode, correctedCode, highlightedLines }) => {
    const { left: leftLines, right: rightLines } = useMemo(() => processDiff(originalCode, correctedCode), [originalCode, correctedCode]);
    
    const renderPanel = (lines: DiffLine[], isLeftPanel: boolean) => (
        <div className="w-1/2 overflow-auto font-mono text-sm bg-gray-900">
            <pre className="p-4">
                {lines.map((line, index) => {
                    let bgClass = '';
                    let highlightClass = '';
                    
                    if (line.type === 'add') bgClass = 'bg-green-800/30';
                    if (line.type === 'remove') bgClass = 'bg-red-800/30';
                    
                    if (isLeftPanel && line.lineNumber && highlightedLines?.has(line.lineNumber)) {
                       highlightClass = 'bg-purple-600/40 border-l-2 border-purple-400';
                    }

                    return (
                        <div key={index} className={`flex ${bgClass} ${highlightClass} transition-colors duration-300`}>
                            <span className="w-10 text-right pr-4 select-none text-gray-500">
                                {line.lineNumber || ' '}
                            </span>
                            <span className="flex-grow pr-4 text-gray-300">{line.content || ' '}</span>
                        </div>
                    );
                })}
            </pre>
        </div>
    );
    
  return (
    <div className="flex flex-col gap-4 h-full diff-viewer-container">
      <div className="w-full flex flex-col bg-gray-900/70 rounded-lg border border-gray-700 overflow-hidden h-full">
        <div className="flex-shrink-0 text-md font-semibold p-3 bg-gray-800/80 border-b border-gray-700 flex">
            <div className="w-1/2">Original</div>
            <div className="w-1/2">Corrected</div>
        </div>
        <div className="flex flex-grow min-h-0">
            {renderPanel(leftLines, true)}
            <div className="w-px bg-gray-700 flex-shrink-0"></div>
            {renderPanel(rightLines, false)}
        </div>
      </div>
    </div>
  );
};