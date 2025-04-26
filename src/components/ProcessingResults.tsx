import React from 'react';
import { Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Only import Components type
import type { Components } from 'react-markdown';

interface ProcessingResultsProps {
  results: string | null | undefined;
}

const ProcessingResults: React.FC<ProcessingResultsProps> = ({ results }) => {
  const [copied, setCopied] = React.useState(false);
  
  const copyToClipboard = () => {
    if (results != null) {
      navigator.clipboard.writeText(results);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  if (results == null) return null;
  
  // Define custom components, let TS infer props for p
  const customComponents: Components = {
    hr: ({ ...props }) => <hr className="my-4 border-gray-200" {...props} />, // Style the hr separator
    p: ({ node, ...props }) => {
      // Check if node and its properties exist before accessing
      const firstChild = node?.children?.[0];
      const content = firstChild?.type === 'text' ? firstChild.value : '';

      if (content.startsWith('Subject: ')) {
        // Use optional chaining and nullish coalescing for safety
        const splitIndex = content.indexOf('\n\n');
        // Extract the full line first
        const fullSubjectLine = splitIndex !== -1 ? content.substring(0, splitIndex) : content;
        // Remove the prefix "Subject: " (9 characters)
        const subjectText = fullSubjectLine.substring(9);
        const restOfContent = splitIndex !== -1 ? content.substring(splitIndex + 2) : '';
        
        return (
          <div className="mb-2"> 
            {/* Render only the subject text */}
            <span className="block font-bold text-gray-500 text-xs mb-1">{subjectText}</span>
            {restOfContent && <p {...props}>{restOfContent}</p>}
          </div>
        );
      }
      // Render standard paragraphs
      return <p {...props} />;
    },
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
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} // Remove type casting
          components={customComponents} 
        >
          {results}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ProcessingResults;