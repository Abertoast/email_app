import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, AlertCircle, Mail } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useSettings } from '../contexts/SettingsContext';

// Define the UnifiedEmailResult interface for TypeScript typing
interface UnifiedEmailResult {
  // Original email data
  id: string;                 // Unique identifier (from original email)
  subject: string;            // Email subject
  sender: string;             // Email sender
  date: string;               // Email date
  read: boolean;              // Read status
  flags: string[];            // Email flags from IMAP
  body: string;               // Original email HTML body
  folder: string;             // Email folder
  folders?: string[];         // All folders (for deduplication)
  
  // Processing result data
  processed: boolean;         // Whether this email has been processed
  processing_error?: string;  // Error message if processing failed
  result?: {
    content: string;          // Processed content from LLM
    tags: string[];           // Extracted tags
  };
}

interface UnifiedEmailCardProps {
  // Required data
  item: UnifiedEmailResult;
  
  // UI state
  isExpanded: boolean;
  isLoading?: boolean;
  
  // Event handlers
  onToggleExpansion: (id: string) => void;
  onCopyContent: (id: string, content: string) => void;
  
  // Optional props for customization
  showTagBadges?: boolean;
  showEmailControls?: boolean;
  className?: string;
}

const UnifiedEmailCard: React.FC<UnifiedEmailCardProps> = ({
  item,
  isExpanded,
  isLoading = false,
  onToggleExpansion,
  onCopyContent,
  showTagBadges = true,
  showEmailControls = true,
  className = '',
}) => {
  const { tags: definedTags } = useSettings();
  const [isCopied, setIsCopied] = useState(false);
  const [showFullContent, setShowFullContent] = useState(false);

  // Reset the copied state after 2 seconds
  useEffect(() => {
    if (isCopied) {
      const timeout = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      
      return () => clearTimeout(timeout);
    }
  }, [isCopied]);

  // Handle copy button click
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.result?.content) {
      onCopyContent(item.id, item.result.content);
      setIsCopied(true);
    }
  };

  // Toggle expansion state
  const toggleExpansion = () => {
    onToggleExpansion(item.id);
  };

  // Toggle showing full email content
  const toggleFullContent = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowFullContent(!showFullContent);
  };

  // Get tag color based on defined tags
  const getTagColor = (tagName: string): string => {
    const tag = definedTags.find(t => t.name === tagName);
    return tag?.color || '#cccccc'; // Default grey if tag not found
  };

  // Determine if the card has any tags to display
  const hasTags = item.processed && item.result?.tags && item.result.tags.length > 0;

  // Helper: Map system label to user-friendly name
  const systemLabelMap: Record<string, string> = {
    '\\Inbox': 'Inbox',
    '\\Sent': 'Sent Mail',
    '\\Draft': 'Drafts',
    '\\Trash': 'Trash',
    '\\Important': 'Important',
    '\\Starred': 'Starred',
    '\\Spam': 'Spam',
  };

  // Helper: Extract system labels from flags
  const systemLabels = (item.flags || []).filter(f => systemLabelMap[f]);
  const userLabels = (item.flags || []).filter(f => !systemLabelMap[f] && !f.startsWith('\\'));
  const labelDisplayNames = [
    ...systemLabels.map(l => systemLabelMap[l] || l),
    ...userLabels
  ];

  // Support multiple folders (for deduplication)
  const folders: string[] = Array.isArray(item.folders) ? item.folders : item.folder ? [item.folder] : [];
  const uniqueFolders = Array.from(new Set(folders));
  // Map folder names to display names (remove [Gmail]/ prefix)
  const folderDisplayNames = uniqueFolders
    .filter(f => f !== 'INBOX')
    .map(f => f === '[Gmail]/All Mail' ? 'All Mail' : f.replace(/^\[Gmail\]\//, ''));

  // Merge: show all unique labelDisplayNames, then any folderDisplayNames not already present as a label
  const mergedChips = [
    ...labelDisplayNames,
    ...folderDisplayNames.filter(fd => !labelDisplayNames.includes(fd))
  ];

  return (
    <div className={`bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {/* Card Header - Always visible */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-start mb-2">
          <div className="flex items-center flex-grow">
            <div className="min-w-0 flex-grow">
              <p className="font-medium text-gray-900 truncate">{item.subject || '(no subject)'}</p>
              <p className="text-sm text-gray-600 truncate">{item.sender}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-gray-500 flex-shrink-0">
              {new Date(item.date).toLocaleDateString()}
            </span>
            <button
              onClick={toggleExpansion}
              className="p-1 rounded hover:bg-gray-100"
              aria-expanded={isExpanded}
              title={isExpanded ? "Hide original email" : "Show original email"}
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-500" /> 
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-500" />
              )}
            </button>
          </div>
        </div>

        {/* Status indicators and tags */}
        <div className="flex flex-wrap items-center mt-1 gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {/* Read/Unread indicator */}
            <span className="flex items-center">
              <span className={`w-2 h-2 rounded-full mr-1.5 ${
                item.read ? 'bg-gray-400' : 'bg-blue-500'
              }`} />
              <span className="text-xs text-gray-600">
                {item.read ? 'Read' : 'Unread'}
              </span>
            </span>

            {/* Merged label/folder chips */}
            {mergedChips.map((chip, idx) => {
              // If it's a label, color by type
              if (labelDisplayNames.includes(chip)) {
                // System label (purple), user label (green)
                const isSystem = Object.values(systemLabelMap).includes(chip);
                return (
                  <span
                    key={chip + idx}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${isSystem ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'}`}
                    title={isSystem ? 'Gmail system label' : 'Gmail user label'}
                  >
                    {chip}
                  </span>
                );
              } else {
                // Folder chip (blue for most, gray for All Mail)
                return (
                  <span
                    key={chip + idx}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${chip === 'All Mail' ? 'bg-gray-200 text-gray-800' : 'bg-blue-100 text-blue-800'}`}
                    title={chip === 'All Mail' ? "Gmail 'All Mail' folder" : 'IMAP folder'}
                  >
                    {chip}
                  </span>
                );
              }
            })}
          </div>
          {/* Processing tags - keep outlined style, align right */}
          {showTagBadges && hasTags && (
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              {item.result?.tags.map(tagName => (
                <span
                  key={tagName}
                  className="px-2 py-0.5 rounded-full text-xs font-medium border"
                  style={{
                    backgroundColor: getTagColor(tagName) + '20',
                    borderColor: getTagColor(tagName),
                    color: getTagColor(tagName)
                  }}
                >
                  {tagName}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Original Email Content - Only visible when expanded */}
      {isExpanded && (
        <div className="bg-gray-50 p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <Mail className="w-4 h-4 mr-1.5 text-gray-600" />
              <h4 className="text-sm font-medium text-gray-700">Original Email</h4>
            </div>
            <button
              onClick={toggleFullContent}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              {showFullContent ? 'Show Less' : 'Show Full Content'}
            </button>
          </div>
          <div 
            className={`prose prose-sm max-w-none whitespace-pre-wrap ${showFullContent ? '' : 'max-h-40 overflow-y-hidden relative'}`}
          >
            {showFullContent ? (
              <div dangerouslySetInnerHTML={{ __html: item.body || '<p>No content available.</p>' }} />
            ) : (
              <>
                <div dangerouslySetInnerHTML={{ 
                  __html: item.body?.substring(0, 500) || '<p>No content available.</p>' 
                }} />
                <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-gray-50 to-transparent"></div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Processed Content - Always visible */}
      <div className="p-4 relative">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-gray-700">AI Processing Result</h4>
          {item.processed && item.result?.content && (
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
              title="Copy content to clipboard"
            >
              {isCopied ? 
                <Check className="h-4 w-4 text-green-500" /> : 
                <Copy className="h-4 w-4" />
              }
            </button>
          )}
        </div>
        
        {renderProcessedContent()}
      </div>
    </div>
  );
  
  // Helper function to render the processed content based on its state
  function renderProcessedContent() {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
          <span className="ml-2 text-sm text-gray-600">Processing...</span>
        </div>
      );
    }
    
    if (!item.processed) {
      return (
        <div className="py-2 text-gray-500 italic text-sm">
          Not processed yet
        </div>
      );
    }
    
    if (item.processing_error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded p-3 text-red-700 text-sm">
          <AlertCircle className="inline-block mr-2 h-4 w-4" />
          Processing failed: {item.processing_error}
        </div>
      );
    }
    
    if (!item.result?.content) {
      return (
        <div className="py-2 text-gray-500 italic text-sm">
          No content was returned from the AI
        </div>
      );
    }
    
    return (
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {item.result.content}
        </ReactMarkdown>
      </div>
    );
  }
};

export default UnifiedEmailCard; 