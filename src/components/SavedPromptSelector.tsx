import React from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { BookOpen } from 'lucide-react';

interface SavedPromptSelectorProps {
  onPromptSelect: (id: string) => void;
  selectedPromptId: string | null;
}

const SavedPromptSelector: React.FC<SavedPromptSelectorProps> = ({ 
  onPromptSelect, 
  selectedPromptId 
}) => {
  const { savedPrompts } = useSettings();
  
  if (!savedPrompts || savedPrompts.length === 0) {
    return (
      <div className="border border-dashed border-gray-300 rounded-md p-4 text-center bg-gray-50">
        <BookOpen className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-gray-600">No saved prompts</p>
        <p className="text-sm text-gray-500 mt-1">
          Create and save prompts in the Prompt Library
        </p>
      </div>
    );
  }
  
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Saved Prompts
      </label>
      <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
        {savedPrompts.map((prompt) => (
          <button
            key={prompt.id}
            type="button"
            onClick={() => onPromptSelect(prompt.id)}
            className={`w-full text-left px-3 py-2 rounded-md transition-colors duration-200 ${
              selectedPromptId === prompt.id
                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-transparent'
            }`}
          >
            <p className="font-medium">{prompt.name}</p>
            <p className="text-xs text-gray-500 truncate mt-1">
              {prompt.prompt.substring(0, 70)}{prompt.prompt.length > 70 ? '...' : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default SavedPromptSelector;