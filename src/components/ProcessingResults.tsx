import React, { useState, useMemo } from 'react';
import { Copy, Check, Tag as TagIcon, Filter, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// Only import Components type
import type { Components } from 'react-markdown';
import { useEmail } from '../contexts/EmailContext'; // Import useEmail
import { useSettings, Tag } from '../contexts/SettingsContext'; // Import useSettings and Tag

export type ProcessingResultsProps = {
  results?: any[] | string | null;
  processIndividually?: boolean;
  definedTags?: Tag[];
};

// No longer needs props
const ProcessingResults: React.FC<ProcessingResultsProps> = ({
  results,
  processIndividually,
  definedTags,
}) => {
  const { latestResults } = useEmail(); // Get latestResults from context
  const settingsContext = useSettings();
  // Use prop if provided, otherwise fallback to context
  const tags = definedTags ?? settingsContext.tags;
  const [copiedStates, setCopiedStates] = useState<Record<string | number, boolean>>({});
  const [selectedFilterTags, setSelectedFilterTags] = useState<string[]>([]); // State for active tag filters
  const [isCopyAllCopied, setIsCopyAllCopied] = useState(false); // State for Copy All button

  // Early exit if no results
  if (!latestResults?.results) return null;

  const copyToClipboard = (text: string | null | undefined, key: string | number) => {
    if (text != null) {
      navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [key]: true }));
      setTimeout(() => setCopiedStates(prev => ({ ...prev, [key]: false })), 2000);
    }
  };

  // Define custom markdown components (can be memoized if needed)
  const customComponents: Components = {
    hr: ({ ...props }) => <hr className="my-4 border-gray-200" {...props} />, // Style the hr separator
    p: ({ node, children, ...props }) => {
      // Removed special subject handling as results are now structured
      return <p className="mb-2 text-gray-700" {...props}>{children}</p>; // Use appropriate light mode text color
    },
    // Add more custom components as needed (e.g., for tables, lists)
    // ...
  };

  // Determine if results are individual or combined
  const isIndividual = processIndividually && Array.isArray(results);
  const resultsData = results;

  // --- Filtering Logic ---
  // Calculate unique available tags from the current results
  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    if (isIndividual) {
      (resultsData as any[]).forEach(item => {
        if (item.tags && Array.isArray(item.tags)) {
          item.tags.forEach((tagName: string) => tagSet.add(tagName));
        }
      });
    } // No tags available in combined mode currently
    return Array.from(tagSet).sort();
  }, [resultsData, isIndividual]);

  // Filter the results based on selected tags (only applies to individual results)
  const filteredResults = useMemo(() => {
    if (!isIndividual || selectedFilterTags.length === 0) {
      return resultsData; // Return all if not individual or no filters
    }
    return (resultsData as any[]).filter(item => {
      if (!item.tags || !Array.isArray(item.tags)) return false; // Item must have tags
      // Check if item.tags contains ANY selectedFilterTags ("OR" logic)
      return selectedFilterTags.some(filterTag => item.tags.includes(filterTag)); // Use .some() for OR
    });
  }, [resultsData, isIndividual, selectedFilterTags]);
  // --- End Filtering Logic ---

  // Handler for copying all filtered results
  const handleCopyAll = () => {
    if (!isIndividual || !filteredResults || (filteredResults as any[]).length === 0) return;
    
    const combinedContent = (filteredResults as any[])
      .map(item => item.content || '') // Get content, default to empty string if null/undefined
      .join('\n\n---\n\n'); // Join with a separator
      
    if (combinedContent) {
      navigator.clipboard.writeText(combinedContent);
      setIsCopyAllCopied(true);
      setTimeout(() => setIsCopyAllCopied(false), 2000); // Reset after 2 seconds
    } else {
      // Optional: feedback if there was nothing to copy (e.g., all results had no content)
      console.log('No content found in filtered results to copy.');
    }
  };

  const toggleFilterTag = (tagName: string) => {
    setSelectedFilterTags(prev =>
      prev.includes(tagName)
        ? prev.filter(t => t !== tagName)
        : [...prev, tagName]
    );
  };

  const clearFilters = () => {
    setSelectedFilterTags([]);
  };

  const getTagColor = (tagName: string): string => {
    const tag = tags.find(t => t.name === tagName);
    return tag?.color || '#cccccc'; // Default grey if tag not found
  };

  return (
    <div className="space-y-4">
       {/* --- Tag Filter UI --- */}
      {isIndividual && availableTags.length > 0 && (
        <div className="p-3 bg-gray-100 rounded-md border border-gray-300">
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center">
                <Filter size={16} className="mr-2 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Filter by Tag:</span>
             </div>
              {selectedFilterTags.length > 0 && (
                <button
                  onClick={clearFilters}
                  className="text-xs text-blue-600 hover:underline flex items-center"
                >
                   <X size={12} className="mr-1"/> Clear Filters
                </button>
              )}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTags.map(tagName => (
              <button
                key={tagName}
                onClick={() => toggleFilterTag(tagName)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-150 ${selectedFilterTags.includes(tagName)
                    ? 'text-white'
                    : 'hover:bg-opacity-20'
                }`}
                style={{
                   backgroundColor: selectedFilterTags.includes(tagName)
                      ? getTagColor(tagName)
                      : getTagColor(tagName) + '1A',
                   borderColor: getTagColor(tagName),
                   color: selectedFilterTags.includes(tagName) ? '#ffffff' : getTagColor(tagName)
                }}
              >
                {tagName}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* --- End Tag Filter UI --- */}
      
      {/* --- Copy All Button --- */}
      {isIndividual && (filteredResults as any[]).length > 0 && (
         <div className="mb-4 flex justify-end"> {/* Add margin bottom */} 
             <button
               onClick={handleCopyAll}
               className="px-3 py-1.5 text-sm rounded-md flex items-center transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
               title="Copy content of all filtered results"
             >
               {isCopyAllCopied ? (
                   <> 
                     <Check className="h-4 w-4 mr-1.5 text-green-600" /> Copied!
                   </>
                 ) : (
                   <>
                     <Copy className="h-4 w-4 mr-1.5" /> Copy All
                   </>
               )}
             </button>
         </div>
      )}
      {/* --- End Copy All Button --- */}

      {/* --- Results Display --- */}
      {isIndividual ? (
        // Display individual results
        (filteredResults as any[]).length > 0 ? (
          (filteredResults as any[]).map((item, index) => (
            <div key={item.originalUid || index} className="relative bg-white border border-gray-300 rounded-md shadow-sm">
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={() => copyToClipboard(item.content, item.originalUid || index)}
                  className="p-1.5 rounded-md text-gray-500 bg-white bg-opacity-75 hover:bg-gray-100 transition-colors duration-200"
                  title="Copy content to clipboard"
                >
                  {copiedStates[item.originalUid || index] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              {/* Header with Subject/Sender/Date and Tags */}
               <div className="p-4 border-b border-gray-300">
                  <p className="font-semibold text-gray-800 text-sm mb-1">{item.subject || '(No Subject)'}</p>
                  <p className="text-xs text-gray-500">
                    From: {item.sender || 'N/A'} | On: {new Date(item.date).toLocaleDateString()}
                  </p>
                  {/* Display Tags */} 
                  {item.tags && item.tags.length > 0 && (
                     <div className="mt-2 flex flex-wrap gap-1.5">
                       {item.tags.map((tagName: string) => (
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
              {/* Content Body */}
              <div className="p-4 prose prose-sm max-w-none">
                  {item.content ? (
                     <ReactMarkdown remarkPlugins={[remarkGfm]} components={customComponents}>
                       {item.content}
                     </ReactMarkdown>
                  ) : (
                     <p className="text-gray-500 italic">(No content returned)</p>
                  )}
              </div>
            </div>
          ))
        ) : (
            <div className="p-4 text-center text-gray-500 bg-gray-50 rounded-md">
               No results match the selected tag filters.
            </div>
        )
      ) : (
        // Display combined result (as a single block)
        <div className="relative bg-white border border-gray-300 rounded-md shadow-sm">
           <div className="absolute top-2 right-2 z-10">
             <button
               onClick={() => copyToClipboard(resultsData as string, 'combined')}
               className="p-1.5 rounded-md text-gray-500 bg-white bg-opacity-75 hover:bg-gray-100 transition-colors duration-200"
               title="Copy content to clipboard"
             >
               {copiedStates['combined'] ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
             </button>
           </div>
           <div className="p-4 prose prose-sm max-w-none">
             <ReactMarkdown remarkPlugins={[remarkGfm]} components={customComponents}>
                {resultsData as string}
             </ReactMarkdown>
           </div>
        </div>
      )}
      {/* --- End Results Display --- */}
    </div>
  );
};

export default ProcessingResults;