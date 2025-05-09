import React, { useState, useRef } from 'react';
import { Plus, Edit, Trash2, Save, X, Variable } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';
import PromptVariablesManager from '../components/PromptVariablesManager';
import TagManager from '../components/TagManager';

interface PromptFormData {
  id: string;
  name: string;
  prompt: string;
  model?: string;
  temperature?: number;
}

// Define models that support temperature (should match Settings.tsx)
const MODELS_SUPPORTING_TEMP = new Set(['gpt-4o', 'gpt-4.1']);
const MODEL_OPTIONS = [
  { value: 'gpt-4o', label: 'gpt-4o ($2.50/$10.00)' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini ($0.15/$0.60)' },
  { value: 'gpt-4.1', label: 'gpt-4.1 ($2.00/$8.00)' },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini ($0.40/$1.60)' },
  { value: 'o1-pro', label: 'o1-pro ($150.00/$600.00)' },
  { value: 'o3', label: 'o3 ($10.00/$40.00)' },
  { value: 'o4-mini', label: 'o4-mini ($1.10/$4.40)' },
];

const PromptLibrary: React.FC = () => {
  const { savedPrompts, addPrompt, updatePrompt, deletePrompt, promptVariables, tags } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<PromptFormData>({
    id: '',
    name: '',
    prompt: '',
    model: undefined,
    temperature: undefined,
  });
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleAddNew = () => {
    setCurrentPrompt({
      id: Date.now().toString(),
      name: '',
      prompt: '',
      model: undefined,
      temperature: undefined,
    });
    setIsEditing(true);
  };
  
  const handleEdit = (prompt: any) => {
    setCurrentPrompt({
      id: prompt.id,
      name: prompt.name,
      prompt: prompt.prompt,
      model: prompt.model,
      temperature: prompt.temperature,
    });
    setIsEditing(true);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let valueToSet: any = value;
    if (name === 'temperature') {
      valueToSet = value === '' ? undefined : parseFloat(value);
    }
    setCurrentPrompt(prev => ({ ...prev, [name]: valueToSet }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPrompt.name.trim() || !currentPrompt.prompt.trim()) {
      toast.error('Name and prompt are required');
      return;
    }
    
    // Only save model/temperature if set (undefined means use global)
    const promptToSave = {
      id: currentPrompt.id,
      name: currentPrompt.name,
      prompt: currentPrompt.prompt,
      model: currentPrompt.model || undefined,
      temperature: typeof currentPrompt.temperature === 'number' ? currentPrompt.temperature : undefined,
    };
    
    if (savedPrompts.some(p => p.id === currentPrompt.id)) {
      updatePrompt(promptToSave);
      toast.success('Prompt updated successfully');
    } else {
      addPrompt(promptToSave);
      toast.success('Prompt saved successfully');
    }
    
    setIsEditing(false);
    setCurrentPrompt({ id: '', name: '', prompt: '', model: undefined, temperature: undefined });
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setCurrentPrompt({ id: '', name: '', prompt: '', model: undefined, temperature: undefined });
  };
  
  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this prompt?')) {
      deletePrompt(id);
      toast.success('Prompt deleted successfully');
    }
  };
  
  const handleInsertVariable = (key: string) => {
    if (promptTextareaRef.current) {
      const textarea = promptTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const variableToInsert = `{${key}}`;
      const newText = text.substring(0, start) + variableToInsert + text.substring(end);
      
      setCurrentPrompt(prev => ({ ...prev, prompt: newText }));

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + variableToInsert.length;
        textarea.focus();
      }, 0);
    }
  };

  const handleInsertTagMarker = (marker: string) => {
    if (promptTextareaRef.current) {
      const textarea = promptTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + marker + text.substring(end);

      setCurrentPrompt(prev => ({ ...prev, prompt: newText }));

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + marker.length;
        textarea.focus();
      }, 0);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Prompt Library</h1>
          <p className="text-gray-600">Save and manage your prompts for reuse</p>
        </div>
        <button
          onClick={handleAddNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center"
          disabled={isEditing}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Prompt
        </button>
      </div>
      
      {isEditing ? (
        <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300">
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">
                {currentPrompt.id && savedPrompts.some(p => p.id === currentPrompt.id) 
                  ? 'Edit Prompt' 
                  : 'New Prompt'
                }
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prompt Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={currentPrompt.name}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="E.g., Extract Action Items"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prompt Content
                  </label>
                  <textarea
                    ref={promptTextareaRef}
                    name="prompt"
                    value={currentPrompt.prompt}
                    onChange={handleChange}
                    rows={10}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    placeholder="Enter your prompt here... You can use variables like {USERNAME} and tag markers like [[Action Item]]."
                    required
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
                          onClick={() => handleInsertVariable(variable.key)}
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
                     <div className="mt-1 flex flex-wrap gap-2 items-center"> {/* Use mt-1 for closer spacing */}
                       <span className="text-xs text-gray-500 self-center mr-1">Insert Tag:</span>
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => handleInsertTagMarker(tag.marker)}
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
                {/* Model Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model (optional)</label>
                  <select
                    name="model"
                    value={currentPrompt.model || ''}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">(Use default model)</option>
                    {MODEL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-500">(input/output per 1M tokens)</span>
                </div>
                {/* Temperature Selection */}
                <div>
                  {/* Determine if the selected model supports temperature */}
                  {(() => {
                    const selectedModel = currentPrompt.model || '';
                    const supportsTemp = MODELS_SUPPORTING_TEMP.has(selectedModel) || !selectedModel;
                    return (
                      <>
                        <label className={`block text-sm font-medium mb-1 ${supportsTemp ? 'text-gray-700' : 'text-gray-400'}`}>Temperature (optional)</label>
                        <input
                          type="number"
                          name="temperature"
                          value={typeof currentPrompt.temperature === 'number' ? currentPrompt.temperature : ''}
                          onChange={handleChange}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${supportsTemp ? 'focus:ring-blue-500' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                          min="0"
                          max="2"
                          step="0.1"
                          placeholder="(Use default)"
                          disabled={!supportsTemp}
                        />
                        <p className={`mt-1 text-xs ${supportsTemp ? 'text-gray-500' : 'text-gray-400'}`}>
                          Controls randomness (only for GPT-4o, GPT-4 Turbo). Leave blank to use the default temperature from Settings.
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors duration-200 flex items-center"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Prompt
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {savedPrompts.length === 0 ? (
            <div className="md:col-span-2 bg-white rounded-xl shadow-md p-8 text-center border border-dashed border-gray-300">
              <div className="text-gray-400 mb-4">
                <Plus className="h-12 w-12 mx-auto" />
              </div>
              <h3 className="text-xl font-medium text-gray-700 mb-2">
                No prompts saved yet
              </h3>
              <p className="text-gray-500 mb-4">
                Create your first prompt to get started
              </p>
              <button
                onClick={handleAddNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200"
              >
                Create a Prompt
              </button>
            </div>
          ) : (
            savedPrompts.map(prompt => (
              <div 
                key={prompt.id} 
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden"
              >
                <div className="p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {prompt.name}
                  </h3>
                  <div className="text-gray-600 text-sm mb-4 h-32 overflow-y-auto">
                    <p className="whitespace-pre-wrap">{prompt.prompt}</p>
                  </div>
                  <div className="flex justify-end space-x-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors duration-200"
                      title="Edit"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                      title="Delete"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <div className="mt-12">
        <PromptVariablesManager />
      </div>

      <div className="mt-12 pt-8 border-t border-gray-200">
        <TagManager />
      </div>
    </div>
  );
};

export default PromptLibrary;