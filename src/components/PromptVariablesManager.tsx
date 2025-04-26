import React, { useState } from 'react';
import { useSettings, PromptVariable } from '../contexts/SettingsContext';
import { Trash2, PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const PromptVariablesManager: React.FC = () => {
  const { promptVariables, addVariable, deleteVariable, updateVariable } = useSettings();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingVariable, setEditingVariable] = useState<PromptVariable | null>(null);
  const [editKey, setEditKey] = useState('');
  const [editValue, setEditValue] = useState('');

  const handleAddVariable = () => {
    if (!newKey.trim()) {
      toast.error('Variable key cannot be empty.');
      return;
    }
    // Basic validation for key format (allow letters, numbers, underscore)
    if (!/^[A-Z0-9_]+$/.test(newKey.trim().toUpperCase())) {
      toast.error('Key must contain only uppercase letters, numbers, and underscores (e.g., MY_VARIABLE).');
      return;
    }
    // Check for duplicates (case-insensitive)
    if (promptVariables.some(v => v.key.toUpperCase() === newKey.trim().toUpperCase())) {
        toast.error(`Variable key "${newKey.trim().toUpperCase()}" already exists.`);
        return;
    }

    addVariable({ key: newKey.trim().toUpperCase(), value: newValue });
    setNewKey('');
    setNewValue('');
    toast.success(`Variable {${newKey.trim().toUpperCase()}} added.`);
  };

  const handleDeleteVariable = (id: string, key: string) => {
    if (window.confirm(`Are you sure you want to delete the variable {${key}}?`)) {
      deleteVariable(id);
      toast.success(`Variable {${key}} deleted.`);
    }
  };

  const handleStartEdit = (variable: PromptVariable) => {
    setEditingVariable(variable);
    setEditKey(variable.key);
    setEditValue(variable.value);
  };

  const handleCancelEdit = () => {
    setEditingVariable(null);
    setEditKey('');
    setEditValue('');
  };

  const handleSaveEdit = () => {
    if (!editingVariable) return;

    if (!editKey.trim()) {
      toast.error('Variable key cannot be empty.');
      return;
    }
    // Basic validation for key format (allow letters, numbers, underscore)
    if (!/^[A-Z0-9_]+$/.test(editKey.trim().toUpperCase())) {
      toast.error('Key must contain only uppercase letters, numbers, and underscores (e.g., MY_VARIABLE).');
      return;
    }
    // Check for duplicates (case-insensitive, excluding self)
    if (promptVariables.some(v => v.id !== editingVariable.id && v.key.toUpperCase() === editKey.trim().toUpperCase())) {
        toast.error(`Variable key "${editKey.trim().toUpperCase()}" already exists.`);
        return;
    }

    updateVariable({ ...editingVariable, key: editKey.trim().toUpperCase(), value: editValue });
    toast.success(`Variable {${editKey.trim().toUpperCase()}} updated.`);
    handleCancelEdit(); // Exit editing mode
  };


  return (
    <div className="bg-white shadow rounded-lg p-6 mt-6">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Prompt Variables</h3>
      <p className="text-sm text-gray-600 mb-4">
        Define reusable variables (e.g., `{'{USERNAME}'}`, `{'{EMAIL}'}`) to insert into your prompts. 
        Keys should be uppercase letters, numbers, or underscores.
      </p>

      {/* List Existing Variables */}
      <div className="mb-6 space-y-3">
        {promptVariables.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No variables defined yet.</p>
        ) : (
          promptVariables.map(variable => (
            <div key={variable.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md">
              {editingVariable?.id === variable.id ? (
                // Editing Mode
                <div className="flex-grow flex items-center space-x-2 mr-2">
                  <input
                    type="text"
                    value={`{${editKey}}`}
                    onChange={(e) => setEditKey(e.target.value.replace(/[{}]/g, ''))} // Prevent braces
                    placeholder="{KEY}"
                    className="flex-shrink-0 w-48 px-2 py-1 border rounded-md text-sm bg-white"
                  />
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    placeholder="Value"
                    className="flex-grow px-2 py-1 border rounded-md text-sm bg-white"
                  />
                   <button
                    onClick={handleSaveEdit}
                    className="px-3 py-1 bg-green-500 text-white text-xs rounded-md hover:bg-green-600 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-3 py-1 bg-gray-400 text-white text-xs rounded-md hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                // Display Mode
                <div className="flex-grow flex items-center space-x-2 mr-2">
                  <span className="font-mono text-sm text-purple-700 bg-purple-100 px-2 py-1 rounded flex-shrink-0 w-48 truncate">{`{${variable.key}}`}</span>
                  <span className="text-sm text-gray-700 truncate flex-grow">{variable.value}</span>
                </div>
              )}
              {editingVariable?.id !== variable.id && (
                <div className="flex-shrink-0 flex items-center space-x-2">
                   <button
                    onClick={() => handleStartEdit(variable)}
                    className="text-blue-600 hover:text-blue-800"
                    title="Edit Variable"
                  >
                    Edit
                  </button>
                   <button
                    onClick={() => handleDeleteVariable(variable.id, variable.key)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete Variable"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
               )}
            </div>
          ))
        )}
      </div>

      {/* Add New Variable Form */}
      <div className="flex items-end space-x-2 border-t pt-4">
        <div className="flex-grow">
          <label htmlFor="newKey" className="block text-xs font-medium text-gray-600 mb-1">Key (e.g., USERNAME)</label>
          <input
            id="newKey"
            type="text"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))} // Enforce format
            placeholder="VARIABLE_KEY"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
          />
        </div>
        <div className="flex-grow">
          <label htmlFor="newValue" className="block text-xs font-medium text-gray-600 mb-1">Value</label>
          <input
            id="newValue"
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="The replacement text"
            className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={handleAddVariable}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 flex items-center text-sm"
        >
          <PlusCircle size={16} className="mr-1" /> Add Variable
        </button>
      </div>
    </div>
  );
};

export default PromptVariablesManager; 