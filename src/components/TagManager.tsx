import React, { useState } from 'react';
import { useSettings, Tag } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';
import { X, Edit, Plus, Trash2 } from 'lucide-react';

// Simple Modal Component
const Modal: React.FC<{ isOpen: boolean; onClose: () => void; children: React.ReactNode; title: string }> = ({ isOpen, onClose, children, title }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-500 hover:text-gray-700">
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
  );
};

const TagManager: React.FC = () => {
  const { tags, addTag, updateTag, deleteTag } = useSettings();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentTag, setCurrentTag] = useState<Tag | null>(null);
  const [tagName, setTagName] = useState('');
  const [tagColor, setTagColor] = useState('#cccccc'); // Default color

  const openModalForAdd = () => {
    setCurrentTag(null);
    setTagName('');
    setTagColor('#cccccc');
    setIsModalOpen(true);
  };

  const openModalForEdit = (tag: Tag) => {
    setCurrentTag(tag);
    setTagName(tag.name);
    setTagColor(tag.color);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentTag(null);
  };

  const handleSave = () => {
    const trimmedName = tagName.trim();
    const generatedMarker = `[[${trimmedName}]]`; 

    if (!trimmedName) {
      toast.error('Tag name cannot be empty.');
      return;
    }
    
    if (!currentTag && tags.some((t: Tag) => t.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error(`Tag name "${trimmedName}" already exists.`);
      return;
    }
    if (!currentTag && tags.some((t: Tag) => t.marker.toLowerCase() === generatedMarker.toLowerCase())) {
      toast.error(`Tag marker "${generatedMarker}" (derived from name) already exists.`);
      return;
    }
     if (currentTag && tags.some((t: Tag) => t.id !== currentTag.id && t.name.toLowerCase() === trimmedName.toLowerCase())) {
      toast.error(`Tag name "${trimmedName}" already exists.`);
      return;
    }
    if (currentTag && tags.some((t: Tag) => t.id !== currentTag.id && t.marker.toLowerCase() === generatedMarker.toLowerCase())) {
      toast.error(`Tag marker "${generatedMarker}" (derived from name) already exists.`);
      return;
    }

    try {
      if (currentTag) {
        updateTag({ ...currentTag, name: trimmedName, marker: generatedMarker, color: tagColor });
        toast.success('Tag updated successfully!');
      } else {
        addTag({ name: trimmedName, marker: generatedMarker, color: tagColor });
        toast.success('Tag added successfully!');
      }
      closeModal();
    } catch (error: any) {
      console.error("Error saving tag:", error);
      toast.error(error.message || "Failed to save tag.");
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this tag?')) {
      try {
        deleteTag(id);
        toast.success('Tag deleted successfully!');
      } catch (error: any) {
         console.error("Error deleting tag:", error);
         toast.error(error.message || "Failed to delete tag.");
      }
    }
  };

  return (
    <div className="mt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900">Manage Tags</h3>
        <button
          onClick={openModalForAdd}
          className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <Plus size={18} className="-ml-0.5 mr-1" />
          Add Tag
        </button>
      </div>

      {tags.length === 0 ? (
        <p className="text-sm text-gray-500">No tags defined yet. Add tags to help categorize processed emails.</p>
      ) : (
        <ul className="space-y-3">
          {tags.map((tag: Tag) => (
            <li key={tag.id} className="bg-white shadow px-4 py-3 rounded-md sm:flex sm:items-center sm:justify-between">
              <div className="flex items-center">
                 <span className="inline-block h-4 w-4 rounded-full mr-3" style={{ backgroundColor: tag.color }}></span>
                 <span className="text-sm font-medium text-gray-900 mr-2">{tag.name}</span>
                 <span className="text-xs text-gray-500">({tag.marker})</span>
              </div>
              <div className="mt-2 sm:mt-0 sm:ml-4 flex space-x-3">
                 <button onClick={() => openModalForEdit(tag)} className="text-indigo-600 hover:text-indigo-900">
                   <Edit size={18} />
                 </button>
                 <button onClick={() => handleDelete(tag.id)} className="text-red-600 hover:text-red-900">
                   <Trash2 size={18} />
                 </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal} title={currentTag ? 'Edit Tag' : 'Add New Tag'}>
        <div className="space-y-4">
          <div>
            <label htmlFor="tagName" className="block text-sm font-medium text-gray-700">Tag Name</label>
            <input
              type="text"
              id="tagName"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder='e.g., Action Item'
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="tagColor" className="block text-sm font-medium text-gray-700">Color</label>
            <input
              type="color"
              id="tagColor"
              value={tagColor}
              onChange={(e) => setTagColor(e.target.value)}
              className="mt-1 block w-full h-10 px-1 py-1 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div className="flex justify-end space-x-3 pt-2">
            <button
              onClick={closeModal}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              {currentTag ? 'Save Changes' : 'Add Tag'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default TagManager; 