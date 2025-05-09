import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Copy, Check, MoreVertical, Download } from 'lucide-react';

interface BulkActionsMenuProps {
  isAllExpanded: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCopyAll: () => void;
  isCopyAllEnabled: boolean;
  onDownloadCsv: () => void;
  isDownloadCsvEnabled: boolean;
}

const BulkActionsMenu: React.FC<BulkActionsMenuProps> = ({
  isAllExpanded,
  onExpandAll,
  onCollapseAll,
  onCopyAll,
  isCopyAllEnabled,
  onDownloadCsv,
  isDownloadCsvEnabled
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };
  
  const handleCopyAll = () => {
    onCopyAll();
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
    setIsDropdownOpen(false);
  };
  
  const handleExpandCollapseAll = () => {
    if (isAllExpanded) {
      onCollapseAll();
    } else {
      onExpandAll();
    }
    setIsDropdownOpen(false);
  };
  
  return (
    <div className="flex justify-end">
      {/* Main actions as regular buttons on larger screens */}
      <div className="hidden sm:flex space-x-2">
        <button
          onClick={isAllExpanded ? onCollapseAll : onExpandAll}
          className="px-3 py-1.5 text-sm rounded-md flex items-center transition-colors duration-200 bg-gray-200 text-gray-700 hover:bg-gray-300"
          title={isAllExpanded ? "Hide all original emails" : "Show all original emails"}
        >
          {isAllExpanded ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1.5" /> 
              Hide Originals
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1.5" /> 
              Show Originals
            </>
          )}
        </button>
        
        <button
          onClick={handleCopyAll}
          disabled={!isCopyAllEnabled}
          className={`px-3 py-1.5 text-sm rounded-md flex items-center transition-colors duration-200 ${
            isCopyAllEnabled 
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          title={isCopyAllEnabled ? "Copy content of all filtered results" : "No content to copy"}
        >
          {isCopied ? (
            <>
              <Check className="h-4 w-4 mr-1.5 text-green-600" /> 
              Copied!
            </>
          ) : (
            <>
              <Copy className="h-4 w-4 mr-1.5" /> 
              Copy All
            </>
          )}
        </button>
        <button
          onClick={onDownloadCsv}
          disabled={!isDownloadCsvEnabled}
          className={`px-3 py-1.5 text-sm rounded-md flex items-center transition-colors duration-200 ${
            isDownloadCsvEnabled 
              ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
          title={isDownloadCsvEnabled ? "Download filtered results as CSV" : "No content to download"}
        >
          <Download className="h-4 w-4 mr-1.5" /> Download CSV
        </button>
      </div>
      
      {/* Dropdown menu for mobile/smaller screens */}
      <div className="relative sm:hidden">
        <button
          onClick={toggleDropdown}
          className="p-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
          aria-label="Actions menu"
          aria-expanded={isDropdownOpen}
        >
          <MoreVertical className="h-4 w-4" />
        </button>
        
        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
            <div className="py-1">
              <button
                onClick={handleExpandCollapseAll}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
              >
                {isAllExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4 mr-2" /> 
                    Hide Originals
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 mr-2" /> 
                    Show Originals
                  </>
                )}
              </button>
              
              <button
                onClick={handleCopyAll}
                disabled={!isCopyAllEnabled}
                className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                  isCopyAllEnabled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                {isCopied ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" /> 
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" /> 
                    Copy All
                  </>
                )}
              </button>
              <button
                onClick={onDownloadCsv}
                disabled={!isDownloadCsvEnabled}
                className={`w-full text-left px-4 py-2 text-sm flex items-center ${
                  isDownloadCsvEnabled 
                    ? 'text-gray-700 hover:bg-gray-100' 
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <Download className="h-4 w-4 mr-2" /> Download CSV
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkActionsMenu;