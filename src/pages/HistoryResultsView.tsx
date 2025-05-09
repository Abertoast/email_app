import React, { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEmail } from '../contexts/EmailContext';
import UnifiedEmailCard from '../components/UnifiedEmailCard';
import TagFilter from '../components/TagFilter';
import { useSettings } from '../contexts/SettingsContext';

const HistoryResultsView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { queryHistory } = useEmail();
  const { tags: definedTags } = useSettings();
  const navigate = useNavigate();

  const historyItem = queryHistory.find(item => item.historyId === id);

  // UI state for tag/flag filtering and expansion
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFlags, setSelectedFlags] = useState<string[]>([]);
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  if (!historyItem) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded shadow text-center">
        <h2 className="text-xl font-bold mb-2">History Item Not Found</h2>
        <p className="mb-4">No results found for this history entry.</p>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200">Go Back</button>
      </div>
    );
  }

  // Merge rawEmails and results into UnifiedEmailResult[]
  const unifiedResults = useMemo(() => {
    if (!Array.isArray(historyItem.rawEmails) || !Array.isArray(historyItem.results)) return [];
    return historyItem.rawEmails.map(email => {
      const processed = (historyItem.results as any[]).find((r: any) => r.originalUid === email.id);
      return {
        id: email.id,
        subject: email.subject || '(No Subject)',
        sender: email.sender || 'N/A',
        date: email.date,
        read: email.read,
        flags: email.flags || [],
        body: email.body || '',
        folder: email.folder || 'INBOX',
        folders: email.folders || (email.folder ? [email.folder] : []),
        processed: !!processed,
        processing_error: processed?.error,
        result: processed ? {
          content: processed.content || '',
          tags: processed.tags || []
        } : undefined
      };
    });
  }, [historyItem]);

  // Tag/flag filter logic (same as dashboard)
  const uniqueTags = useMemo(() => {
    const tagSet = new Set<string>();
    unifiedResults.forEach(item => {
      if (item.processed && item.result?.tags) {
        item.result.tags.forEach((tag: string) => tagSet.add(tag));
      }
    });
    return Array.from(tagSet).sort();
  }, [unifiedResults]);

  const uniqueFlags = useMemo(() => {
    const flagSet = new Set<string>();
    unifiedResults.forEach(item => {
      if (item.flags && Array.isArray(item.flags)) {
        item.flags.forEach((flag: string) => flagSet.add(flag));
      }
    });
    return Array.from(flagSet).sort();
  }, [unifiedResults]);

  const filteredResults = useMemo(() => {
    return unifiedResults.filter(item => {
      const tagMatch = selectedTags.length === 0 || (item.processed && item.result && Array.isArray(item.result.tags) && selectedTags.some(tag => item.result!.tags.includes(tag)));
      const flagMatch = selectedFlags.length === 0 || (item.flags && selectedFlags.some(flag => item.flags.includes(flag)));
      return tagMatch && flagMatch;
    });
  }, [unifiedResults, selectedTags, selectedFlags]);

  // Expansion logic
  const handleToggleExpansion = (id: string) => {
    setExpandedItems(prev => prev.includes(id) ? prev.filter(eid => eid !== id) : [...prev, id]);
  };

  // Copy logic
  const handleCopyContent = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedStates(prev => ({ ...prev, [id]: true }));
    setTimeout(() => setCopiedStates(prev => ({ ...prev, [id]: false })), 2000);
  };

  // Tag color helper
  const getTagColor = (tagName: string): string => {
    const tag = definedTags.find(t => t.name === tagName);
    return tag?.color || '#cccccc';
  };

  return (
    <div className="max-w-4xl mx-auto mt-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Past Query Results</h1>
        <button onClick={() => navigate(-1)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200">Back to History</button>
      </div>
      {/* Prompt Info Section */}
      <div className="bg-gray-50 rounded-md p-3 text-sm mb-4">
        <div className="mb-1">
          <span className="font-medium">Type:</span>
          <span className="ml-1 text-gray-600">
            {historyItem.promptType === 'saved' ? 'Saved Prompt' : 'Custom Prompt'}
          </span>
          {historyItem.promptType === 'saved' && (
            <>
              <span className="ml-2 font-medium">Name:</span>
              <span className="ml-1 text-gray-600">
                {(() => {
                  try {
                    const prompts = JSON.parse(localStorage.getItem('emailai-prompts') || '[]');
                    const found = prompts.find((p: any) => p.id === historyItem.promptId);
                    return found ? found.name : <span className="text-red-500">(Deleted)</span>;
                  } catch {
                    return <span className="text-red-500">(Unknown)</span>;
                  }
                })()}
              </span>
            </>
          )}
        </div>
        {/* Model/Temperature Info */}
        <div className="mb-1">
          <span className="font-medium">Model:</span>
          <span className="ml-1 text-gray-600">
            {historyItem.model ? historyItem.model : <span className="italic text-gray-400">(Default)</span>}
          </span>
          <span className="ml-2 font-medium">Temperature:</span>
          <span className="ml-1 text-gray-600">
            {typeof historyItem.temperature === 'number' ? historyItem.temperature : <span className="italic text-gray-400">(Default)</span>}
          </span>
        </div>
        <p className="text-gray-600 line-clamp-3 whitespace-pre-line">{historyItem.prompt}</p>
      </div>
      {/* Tag/Flag Filters (dashboard design) */}
      <div className="flex flex-col md:flex-row gap-4 mb-4">
        <div className="flex-1">
          <TagFilter
            availableTags={uniqueTags}
            selectedTags={selectedTags}
            onTagToggle={tag => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
            onClearAll={() => setSelectedTags([])}
            getTagColor={getTagColor}
          />
        </div>
        {uniqueFlags.length > 0 && (
          <div className="flex-1 p-3 bg-gray-100 rounded-md border border-gray-300">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" className="mr-2 text-gray-600" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                <span className="text-sm font-medium text-gray-700">Filter by Flag:</span>
              </div>
              {selectedFlags.length > 0 && (
                <button
                  onClick={() => setSelectedFlags([])}
                  className="text-xs text-green-600 hover:underline flex items-center"
                  aria-label="Clear all flag filters"
                >
                  <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  Clear Filters
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {uniqueFlags.map(flag => (
                <button
                  key={flag}
                  onClick={() => setSelectedFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag])}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-150 ${selectedFlags.includes(flag)
                    ? 'bg-green-600 text-white'
                    : 'hover:bg-opacity-20 text-green-700 bg-green-50'
                  }`}
                  style={{ borderColor: '#22c55e' }}
                  aria-pressed={selectedFlags.includes(flag)}
                >
                  {flag.replace(/^\\/, '')}
                </button>
              ))}
            </div>
            {uniqueFlags.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Select one or more flags to filter results. Results with any selected flag will be shown.
              </p>
            )}
          </div>
        )}
      </div>
      {/* UnifiedEmailCards */}
      <div className="space-y-4">
        {filteredResults.length === 0 ? (
          <div className="text-gray-500 text-center py-8">No results to display.</div>
        ) : (
          filteredResults.map(item => (
            <UnifiedEmailCard
              key={item.id}
              item={item}
              isExpanded={expandedItems.includes(item.id)}
              onToggleExpansion={handleToggleExpansion}
              onCopyContent={handleCopyContent}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default HistoryResultsView; 