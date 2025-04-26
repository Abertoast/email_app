import React from 'react';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Import Components type if needed for stricter typing (optional but good practice)
// import type { Components } from 'react-markdown'; 

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
  
  // Define custom components to add styling
  const customComponents = {
    hr: ({...props}) => <hr className="my-4" {...props} />, // Add vertical margin to hr
  };

  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={copyToClipboard}
          className="p-2 rounded-md text-gray-500 bg-white bg-opacity-75 hover:bg-gray-100 transition-colors duration-200"
          title="Copy raw Markdown to clipboard"
        >
          {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
        </button>
      </div>
      <div className="bg-white border rounded-md p-4 max-h-96 overflow-y-auto prose prose-sm max-w-none">
        {/* Pass the custom components to ReactMarkdown */}
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          components={customComponents} 
        >
          {results}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ProcessingResults;