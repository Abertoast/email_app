import React from 'react';
import { X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface UpdateNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
}

const UpdateNotificationModal: React.FC<UpdateNotificationModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
}) => {
  if (!isOpen) return null;

  return (
    // Overlay
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      {/* Modal Content */}
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            aria-label="Close update notification"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto prose prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {description}
          </ReactMarkdown>
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateNotificationModal; 