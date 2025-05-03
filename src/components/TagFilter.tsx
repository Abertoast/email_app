import React from 'react';
import { Filter, X } from 'lucide-react';

interface TagFilterProps {
  availableTags: string[];
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onClearAll: () => void;
  getTagColor: (tag: string) => string;
}

const TagFilter: React.FC<TagFilterProps> = ({
  availableTags,
  selectedTags,
  onTagToggle,
  onClearAll,
  getTagColor
}) => {
  // If no tags available, don't render anything
  if (!availableTags.length) {
    return null;
  }

  return (
    <div className="p-3 bg-gray-100 rounded-md border border-gray-300">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Filter size={16} className="mr-2 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">Filter by Tag:</span>
        </div>
        
        {/* Only show clear button if there are selected tags */}
        {selectedTags.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-xs text-blue-600 hover:underline flex items-center"
            aria-label="Clear all filters"
          >
            <X size={12} className="mr-1" /> Clear Filters
          </button>
        )}
      </div>
      
      {/* Tag buttons */}
      <div className="flex flex-wrap gap-2">
        {availableTags.map(tagName => (
          <button
            key={tagName}
            onClick={() => onTagToggle(tagName)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors duration-150 ${
              selectedTags.includes(tagName)
                ? 'text-white'
                : 'hover:bg-opacity-20'
            }`}
            style={{
              backgroundColor: selectedTags.includes(tagName)
                ? getTagColor(tagName)
                : getTagColor(tagName) + '1A', // 10% opacity
              borderColor: getTagColor(tagName),
              color: selectedTags.includes(tagName) ? '#ffffff' : getTagColor(tagName)
            }}
            aria-pressed={selectedTags.includes(tagName)}
          >
            {tagName}
          </button>
        ))}
      </div>
      
      {/* Help text */}
      {availableTags.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Select one or more tags to filter results. Results with any selected tag will be shown.
        </p>
      )}
    </div>
  );
};

export default TagFilter; 