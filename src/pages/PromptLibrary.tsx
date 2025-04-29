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
}

const PromptLibrary: React.FC = () => {
  const { savedPrompts, addPrompt, updatePrompt, deletePrompt, promptVariables, tags } = useSettings();
  const [isEditing, setIsEditing] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<PromptFormData>({
    id: '',
    name: '',
    prompt: ''
  });
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleAddNew = () => {
    setCurrentPrompt({
      id: Date.now().toString(),
      name: '',
      prompt: ''
    });
    setIsEditing(true);
  };
  
  const handleEdit = (prompt: any) => {
    setCurrentPrompt({
      id: prompt.id,
      name: prompt.name,
      prompt: prompt.prompt
    });
    setIsEditing(true);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentPrompt(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentPrompt.name.trim() || !currentPrompt.prompt.trim()) {
      toast.error('Name and prompt are required');
      return;
    }
    
    if (savedPrompts.some(p => p.id === currentPrompt.id)) {
      updatePrompt(currentPrompt);
      toast.success('Prompt updated successfully');
    } else {
      addPrompt(currentPrompt);
      toast.success('Prompt saved successfully');
    }
    
    setIsEditing(false);
    setCurrentPrompt({ id: '', name: '', prompt: '' });
  };
  
  const handleCancel = () => {
    setIsEditing(false);
    setCurrentPrompt({ id: '', name: '', prompt: '' });
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