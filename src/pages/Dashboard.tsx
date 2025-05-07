import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar, Clock, RefreshCw, Inbox, Search, Loader, X, Mail, ChevronDown, ChevronRight, Copy, Filter } from 'lucide-react';
import { useEmail } from '../contexts/EmailContext';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';
import EmailFilterForm from '../components/EmailFilterForm';
import SavedPromptSelector from '../components/SavedPromptSelector';
import UnifiedEmailCard from '../components/UnifiedEmailCard';
import TagFilter from '../components/TagFilter';
import BulkActionsMenu from '../components/BulkActionsMenu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLocation } from 'react-router-dom';

// Define our unified data structure
interface UnifiedEmailResult {
  id: string;
  subject: string;
  sender: string;
  date: string;
  read: boolean;
  flags: string[];
  body: string;
  folder: string;
  folders: string[];
  processed: boolean;
  processing_error?: string;
  result?: {
    content: string;
    tags: string[];
  };
}

const Dashboard: React.FC = () => {
  const { settings, savedPrompts, tags, promptVariables } = useSettings();
  const { 
    fetchEmails, 
    processEmails, 
    isFetching, 
    isProcessing, 
    latestResults,
    clearLatestResults
  } = useEmail();
  const location = useLocation();
  
  // State for form and inputs
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  
  // State for emails and results
  const [emailCount, setEmailCount] = useState<number | null>(null);
  const [fetchedEmails, setFetchedEmails] = useState<any[]>([]);
  const [unifiedResults, setUnifiedResults] = useState<UnifiedEmailResult[]>([]);
  
  // UI state
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isAllExpanded, setIsAllExpanded] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
  
  // Refs
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const customPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  // State for rerun filter and prompt
  const [rerunFilterState, setRerunFilterState] = useState<any>(null);
  const [rerunPromptState, setRerunPromptState] = useState<{promptType: 'custom' | 'saved', prompt: string, promptId: string | null} | null>(null);
  
  // When latestResults change, update our unified results structure
  useEffect(() => {
    if (latestResults && latestResults.processIndividually && Array.isArray(latestResults.results)) {
      // Create unified data structure matching emails with their processed results
      const unified = fetchedEmails.map(email => {
        // Find matching processed result by ID
        const processed = (latestResults.results as any[])
          .find(r => r.originalUid === email.id);
        // If email.folders exists, use it; otherwise, fallback to single folder
        return {
          // Original email data
          id: email.id,
          subject: email.subject || '(No Subject)',
          sender: email.sender || 'N/A',
          date: email.date,
          read: email.read,
          flags: email.flags || [],
          body: email.body || '',
          folder: email.folder || 'INBOX',
          folders: email.folders || (email.folder ? [email.folder] : []),
          // Processing result data
          processed: !!processed,
          processing_error: processed?.error,
          result: processed ? {
            content: processed.content || '',
            tags: processed.tags || []
          } : undefined
        };
      });
      setUnifiedResults(unified);
    } else {
      // For combined processing (not individual), we don't have unified results
      setUnifiedResults([]);
    }
  }, [latestResults, fetchedEmails]);
  
  // Scroll when processing is finished AND there are new results
  useEffect(() => {
    if (!isProcessing && latestResults && latestResults.results && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isProcessing, latestResults]);
  
  // Load expanded state from localStorage
  useEffect(() => {
    const savedExpansionState = localStorage.getItem('emailai-expansion-state');
    if (savedExpansionState) {
      try {
        setExpandedItems(JSON.parse(savedExpansionState));
      } catch (e) {
        console.error('Failed to parse saved expansion state');
      }
    }
  }, []);
  
  // Save expanded state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('emailai-expansion-state', JSON.stringify(expandedItems));
  }, [expandedItems]);
  
  // Calculate unique tags from unifiedResults
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    unifiedResults.forEach(item => {
      if (item.processed && item.result?.tags) {
        item.result.tags.forEach(tag => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [unifiedResults]);

  // Calculate unique flags from unifiedResults (system/user labels only, not folders)
  const uniqueFlags = useMemo(() => {
    const flagSet = new Set<string>();
    unifiedResults.forEach(item => {
      if (item.flags && Array.isArray(item.flags)) {
        item.flags.forEach(flag => flagSet.add(flag));
      }
    });
    return Array.from(flagSet).sort();
  }, [unifiedResults]);

  // Filter unified results by (tags OR) AND (flags OR)
  const filteredResults = useMemo(() => {
    return unifiedResults.filter(item => {
      // Tag filter (OR logic)
      const tagMatch = selectedTags.length === 0 || (item.processed && item.result && Array.isArray(item.result.tags) && selectedTags.some(tag => item.result!.tags.includes(tag)));
      // Flag filter (OR logic)
      const flagMatch = selectedFlags.length === 0 || (item.flags && selectedFlags.some(flag => item.flags.includes(flag)));
      // AND between tag and flag groups
      return tagMatch && flagMatch;
    });
  }, [unifiedResults, selectedTags, selectedFlags]);

  // Process form submission
  const handleProcess = async (data: { formData: any; processIndividually: boolean; groupBySubject: boolean }) => {
    const { formData, processIndividually, groupBySubject } = data;

    clearLatestResults();
    setUnifiedResults([]);
    setSelectedTags([]);
    setSelectedFlags([]);
    setExpandedItems([]);
    
    if (!settings.emailConnected) {
      toast.error('Please connect your email in settings first');
      return;
    }
    
    if (!settings.openaiApiKey) {
      toast.error('Please add your OpenAI API key in settings');
      return;
    }
    
    let finalPrompt = customPrompt;
    let promptType: 'custom' | 'saved' = 'custom';
    let promptId: string | null = null;

    if (selectedPromptId) {
      const selected = savedPrompts.find(p => p.id === selectedPromptId);
      if (selected) {
        finalPrompt = selected.prompt;
        promptType = 'saved';
        promptId = selected.id;
      } else {
        toast.error('Selected saved prompt not found.');
        return;
      }
    } else if (!customPrompt) {
      toast.error('Please enter a prompt or select a saved one');
      return;
    }
    
    try {
      const emails = await fetchEmails({ ...formData, groupBySubject });
      
      let emailsToProcess = emails;
      
      // Apply grouping only if the checkbox was checked
      if (groupBySubject) {
        // Group by Gmail thread id if present, otherwise by normalised subject
        const emailGroups = new Map<string, any[]>();

        emails.forEach(email => {
          // Normalise subject by removing typical reply/forward prefixes and trimming/normalising whitespace
          const normalisedSubject = (email.subject || '')
            .replace(/^(re|fw|fwd):\s*/i, '') // strip common prefixes
            .replace(/\s+/g, ' ')             // collapse whitespace
            .trim()
            .toLowerCase();

          const groupKey = (email.gmThreadId ? String(email.gmThreadId) : normalisedSubject) || '(no subject)';

          if (!emailGroups.has(groupKey)) {
            emailGroups.set(groupKey, []);
          }
          const group = emailGroups.get(groupKey);
          if (group) group.push(email);
        });
        // For each group, pick the newest email and merge all unique flags and folders
        emailsToProcess = Array.from(emailGroups.values()).map(group => {
          // Pick newest by date
          const newest = group.reduce((a, b) => new Date(a.date) > new Date(b.date) ? a : b);
          // Merge all unique flags and folders
          const allFlags = Array.from(new Set(group.flatMap(e => e.flags || [])));
          const allFolders = Array.from(new Set(group.map(e => e.folder)));
          return {
            ...newest,
            flags: allFlags,
            folders: allFolders, // Add folders array for display
          };
        });
      }
      
      // Update state with the potentially filtered list
      setEmailCount(emailsToProcess.length); 
      setFetchedEmails(emailsToProcess); 
      
      if (emailsToProcess.length === 0) {
        toast('No emails found matching your criteria');
        return;
      }
      
      // Process emails (this updates latestResults in EmailContext)
      await processEmails(emailsToProcess, finalPrompt, processIndividually, promptType, promptId);
    } catch (error) {
      toast.error('Error processing emails');
      console.error(error);
    }
  };

  const resetForm = () => {
    setCustomPrompt('');
    setSelectedPromptId(null);
    setEmailCount(null);
    setFetchedEmails([]);
    setUnifiedResults([]);
    setSelectedTags([]);
    setSelectedFlags([]);
    setExpandedItems([]);
    clearLatestResults();
  };
  
  // Toggle expansion of a single item
  const handleToggleExpansion = (id: string) => {
    setExpandedItems(prev => {
      if (prev.includes(id)) {
        return prev.filter(itemId => itemId !== id);
      } else {
        return [...prev, id];
      }
    });
  };
  
  // Expand all items
  const handleExpandAll = () => {
    const allIds = unifiedResults.map(item => item.id);
    setExpandedItems(allIds);
    setIsAllExpanded(true);
  };
  
  // Collapse all items
  const handleCollapseAll = () => {
    setExpandedItems([]);
    setIsAllExpanded(false);
  };
  
  // Toggle a tag filter
  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => {
      if (prev.includes(tag)) {
        return prev.filter(t => t !== tag);
      } else {
        return [...prev, tag];
      }
    });
  };
  
  // Clear all tag filters
  const handleClearAllTags = () => {
    setSelectedTags([]);
  };
  
  // Handlers for flag filter
  const handleFlagToggle = (flag: string) => {
    setSelectedFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]);
  };
  const handleClearAllFlags = () => setSelectedFlags([]);
  
  // Get tag color based on defined tags
  const getTagColor = (tagName: string): string => {
    const tag = tags.find(t => t.name === tagName);
    return tag?.color || '#cccccc'; // Default grey if tag not found
  };
  
  // Copy content from an item
  const handleCopyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    // Update the copied state for this specific item
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    // Reset after 2 seconds
    setTimeout(() => {
      setCopiedStates(prev => ({ ...prev, [id]: false }));
    }, 2000);
  };
  
  // Copy all filtered content at once
  const handleCopyAll = () => {
    if (filteredResults.length === 0) return;
    
    const combinedContent = filteredResults
      .filter(item => item.processed && item.result?.content)
      .map(item => item.result!.content)
      .join('\n\n---\n\n'); // Add separator between items
      
    if (combinedContent) {
      navigator.clipboard.writeText(combinedContent);
      toast.success('Copied all content to clipboard');
    }
  };
  
  // Insert variables or tags into the custom prompt
  const handleInsertIntoCustomPrompt = (textToInsert: string) => {
    if (customPromptTextareaRef.current) {
      const textarea = customPromptTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + textToInsert + text.substring(end);

      setCustomPrompt(newText);
      setSelectedPromptId(null); // Clear selected prompt if using custom prompt

      // Set cursor position after insertion
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
        textarea.focus();
      }, 0);
    }
  };

  // On mount, check for rerun state and trigger process if present
  const rerunRef = useRef(false);
  useEffect(() => {
    if (rerunRef.current) return; // Prevent double-processing
    if (location.state && (location.state as any).rerun) {
      const rerun = (location.state as any).rerun;
      // Set form state
      setRerunFilterState({ ...rerun.formData, processIndividually: rerun.processIndividually, groupBySubject: rerun.groupBySubject });
      setRerunPromptState({ promptType: rerun.promptType, prompt: rerun.prompt, promptId: rerun.promptId });
      if (rerun.promptType === 'custom') {
        setCustomPrompt(rerun.prompt);
        setSelectedPromptId(null);
      } else if (rerun.promptType === 'saved') {
        setCustomPrompt('');
        setSelectedPromptId(rerun.promptId);
      }
      rerunRef.current = true;
    }
    // eslint-disable-next-line
  }, []);

  // Trigger handleProcess only when rerun state and prompt are ready
  useEffect(() => {
    if (!rerunRef.current) return;
    if (location.state && (location.state as any).rerun) {
      const rerun = (location.state as any).rerun;
      if (rerun.promptType === 'custom' && customPrompt) {
        handleProcess({
          formData: rerun.formData,
          processIndividually: rerun.processIndividually,
          groupBySubject: rerun.groupBySubject,
        });
        setRerunFilterState(null);
        setRerunPromptState(null);
        window.history.replaceState({}, document.title);
        rerunRef.current = false;
      } else if (rerun.promptType === 'saved' && selectedPromptId) {
        // Ensure the prompt exists in savedPrompts
        const found = savedPrompts.find(p => p.id === selectedPromptId);
        if (found) {
          handleProcess({
            formData: rerun.formData,
            processIndividually: rerun.processIndividually,
            groupBySubject: rerun.groupBySubject,
          });
          setRerunFilterState(null);
          setRerunPromptState(null);
          window.history.replaceState({}, document.title);
          rerunRef.current = false;
        }
      }
    }
    // eslint-disable-next-line
  }, [customPrompt, selectedPromptId, savedPrompts]);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email AI Dashboard</h1>
        <p className="text-gray-600">Process your emails with AI to extract insights and information</p>
      </div>
      
      {/* Main card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Inbox className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-800">Email Query</h2>
            </div>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              Reset Form
            </button>
          </div>
          
          {/* Updated grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Email filter form */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                Email Filters
              </h3>
              <EmailFilterForm onSubmit={handleProcess} isLoading={isFetching || isProcessing} initialValues={rerunFilterState} />
            </div>
            
            {/* Prompt form */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-purple-500" />
                Processing Prompt
              </h3>
              
              <SavedPromptSelector
                onPromptSelect={(id) => {
                  setSelectedPromptId(id);
                  setCustomPrompt('');
                }}
                selectedPromptId={selectedPromptId}
              />
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Prompt
                </label>
                <textarea
                  ref={customPromptTextareaRef}
                  className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="E.g., List all the open items assigned to me from these emails"
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setSelectedPromptId(null);
                  }}
                />
                {/* Insert Buttons Section */}
                {/* Variables */}
                {promptVariables.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-500 self-center mr-1">Insert Variable:</span>
                    {promptVariables.map(variable => (
                      <button
                        key={variable.id}
                        type="button"
                        onClick={() => handleInsertIntoCustomPrompt(`{${variable.key}}`)}
                        className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 text-xs font-mono transition-colors"
                        title={`Insert {${variable.key}}`}
                      >
                        {`{${variable.key}}`}
                      </button>
                    ))}
                  </div>
                )}
                {/* Tags */}
                {tags.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-500 self-center mr-1">Insert Tag:</span>
                    {tags.map(tag => (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => handleInsertIntoCustomPrompt(tag.marker)}
                        className="px-2 py-1 rounded-md text-xs font-mono transition-colors border"
                        style={{
                          backgroundColor: tag.color + '20',
                          borderColor: tag.color,
                          color: tag.color
                        }}
                        title={`Insert ${tag.marker}`}
                      >
                        {tag.marker}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Results Area - Unified UI for emails and their processed results */}
        {(isFetching || isProcessing || latestResults) && (
          <div ref={resultsContainerRef} className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex items-center mb-4">
              <RefreshCw 
                className={`w-5 h-5 mr-2 text-blue-600 ${isProcessing || isFetching ? 'animate-spin' : ''}`} 
              />
              <h3 className="text-lg font-medium text-gray-700">
                {isProcessing ? 'Processing Emails...' : 'Results'}
              </h3>
              {emailCount !== null && (
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {emailCount} emails
                </span>
              )}
            </div>
            
            {isFetching || isProcessing ? (
              // Loading state
              <div className="flex flex-col items-center justify-center py-8">
                <Loader className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600">
                  {isFetching ? 'Fetching your emails...' : 'Processing your emails...'}
                </p>
              </div>
            ) : latestResults ? (
              // Results display
              latestResults.processIndividually ? (
                // Individual processing mode (unified email cards)
                <>
                  {/* Tag and Flag filtering */}
                  {(uniqueTags.length > 0 || uniqueFlags.length > 0) && (
                    <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {uniqueTags.length > 0 && (
                        <div className="h-full flex flex-col">
                          <TagFilter 
                            availableTags={uniqueTags}
                            selectedTags={selectedTags}
                            onTagToggle={handleTagToggle}
                            onClearAll={handleClearAllTags}
                            getTagColor={getTagColor}
                          />
                        </div>
                      )}
                      {uniqueFlags.length > 0 && (
                        <div className="p-3 bg-gray-100 rounded-md border border-gray-300 h-full flex flex-col">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <Filter size={16} className="mr-2 text-gray-600" />
                              <span className="text-sm font-medium text-gray-700">Filter by Flag:</span>
                            </div>
                            {selectedFlags.length > 0 && (
                              <button
                                onClick={handleClearAllFlags}
                                className="text-xs text-blue-600 hover:underline flex items-center"
                                aria-label="Clear all flag filters"
                              >
                                <X size={12} className="mr-1" /> Clear Flags
                              </button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {uniqueFlags.map(flagName => (
                              <button
                                key={flagName}
                                onClick={() => handleFlagToggle(flagName)}
                                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-150 ${selectedFlags.includes(flagName)
                                  ? 'text-white'
                                  : 'hover:bg-opacity-20'
                                }`}
                                style={{
                                  backgroundColor: selectedFlags.includes(flagName)
                                    ? '#6366f1'
                                    : '#6366f11A', // Indigo 600, 10% opacity
                                  borderColor: '#6366f1',
                                  color: selectedFlags.includes(flagName) ? '#ffffff' : '#6366f1'
                                }}
                                aria-pressed={selectedFlags.includes(flagName)}
                              >
                                {flagName.replace(/^\\/, '')}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            Select one or more flags to filter results. Results with any selected flag will be shown.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Bulk actions */}
                  {filteredResults.length > 0 && (
                    <div className="mb-4">
                      <BulkActionsMenu 
                        isAllExpanded={isAllExpanded}
                        onExpandAll={handleExpandAll}
                        onCollapseAll={handleCollapseAll}
                        onCopyAll={handleCopyAll}
                        isCopyAllEnabled={filteredResults.some(item => 
                          item.processed && item.result?.content
                        )}
                      />
                    </div>
                  )}
                  
                  {/* Unified email cards */}
                  {filteredResults.length > 0 ? (
                    <div className="space-y-4">
                      {filteredResults.map(item => (
                        <UnifiedEmailCard 
                          key={item.id}
                          item={item}
                          isExpanded={expandedItems.includes(item.id)}
                          isLoading={false}
                          onToggleExpansion={handleToggleExpansion}
                          onCopyContent={handleCopyContent}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-100 rounded-md border border-gray-300">
                      <p className="text-gray-600">
                        {uniqueTags.length > 0 && selectedTags.length > 0 
                          ? 'No emails match the selected tag filters.'
                          : 'No emails were found. Try adjusting your search criteria.'}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                // Combined processing mode (not individual emails)
                <div className="bg-white border rounded-md shadow-sm overflow-hidden">
                  <div className="p-4 flex justify-end border-b border-gray-200">
                    <button
                      onClick={() => {
                        if (typeof latestResults.results === 'string') {
                          navigator.clipboard.writeText(latestResults.results);
                          toast.success('Copied to clipboard');
                        }
                      }}
                      className="px-3 py-1.5 text-sm rounded-md flex items-center transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
                      title="Copy content to clipboard"
                    >
                      <Copy className="h-4 w-4 mr-1.5" /> Copy
                    </button>
                  </div>
                  <div className="p-4 prose prose-sm max-w-none">
                    {typeof latestResults.results === 'string' ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {latestResults.results}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-gray-500 italic">No results returned.</p>
                    )}
                  </div>
                </div>
              )
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;