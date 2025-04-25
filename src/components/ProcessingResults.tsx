import React from 'react';
import { Copy, Check } from 'lucide-react';

interface ProcessingResultsProps {
  results: string | null;
}

const ProcessingResults: React.FC<ProcessingResultsProps> = ({ results }) => {
  const [copied, setCopied] = React.useState(false);
  
  const copyToClipboard = () => {
    if (results) {
      navigator.clipboard.writeText(results);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (!results) return null;
  
  return (
    <div className="relative">
      <div className="absolute top-2 right-2">
        <button
          onClick={copyToClipboard}
          className="p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors duration-200"
          title="Copy to clipboard"
        >
          {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
        </button>
      </div>
      <div className="bg-white border rounded-md p-4 max-h-96 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed">
        {results}
      </div>
    </div>
  );
};

export default ProcessingResults;