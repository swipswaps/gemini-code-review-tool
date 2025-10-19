
import React, { useRef, useEffect } from 'react';

interface LogViewerProps {
  logs: string[];
}

export const LogViewer: React.FC<LogViewerProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const formatLog = (log: string) => {
    if (log.startsWith('[ERROR]')) {
        return <span className="text-red-400">{log}</span>;
    }
    if (log.startsWith('[ANALYSIS]')) {
        return <span className="text-purple-400">{log}</span>;
    }
    if (log.startsWith('[SYSTEM]')) {
        return <span className="text-yellow-400">{log}</span>;
    }
    if (log.startsWith('Skipping')) {
        return <span className="text-gray-500">{log}</span>
    }
    return log;
  };

  return (
    <div ref={scrollRef} className="h-full bg-gray-900 font-mono text-xs text-gray-400 p-4 rounded-md border border-gray-700 overflow-y-auto">
      {logs.map((log, index) => (
        <div key={index} className="whitespace-pre-wrap leading-relaxed">
          <span className="text-gray-600 mr-2 select-none">{String(index + 1).padStart(3, ' ')}</span>
          {formatLog(log)}
        </div>
      ))}
    </div>
  );
};
