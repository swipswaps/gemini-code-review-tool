
import React from 'react';

interface DiffViewerProps {
  originalCode: string;
  correctedCode: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ originalCode, correctedCode }) => {
  return (
    <div className="flex flex-col md:flex-row gap-4 h-96">
      <div className="w-full md:w-1/2 flex flex-col bg-gray-900 rounded-lg border border-red-700/50 overflow-hidden">
        <h3 className="text-md font-semibold p-3 bg-red-900/30 border-b border-red-700/50">Original Code</h3>
        <div className="overflow-auto flex-grow">
          <pre className="p-4 text-sm">
            <code>{originalCode}</code>
          </pre>
        </div>
      </div>
      <div className="w-full md:w-1/2 flex flex-col bg-gray-900 rounded-lg border border-green-700/50 overflow-hidden">
        <h3 className="text-md font-semibold p-3 bg-green-900/30 border-b border-green-700/50">Corrected Code</h3>
        <div className="overflow-auto flex-grow">
          <pre className="p-4 text-sm">
            <code>{correctedCode}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};
