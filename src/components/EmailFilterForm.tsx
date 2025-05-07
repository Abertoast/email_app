import React, { useState, useEffect } from 'react';
import DateRangePicker from './DateRangePicker';
import { Clock, Filter } from 'lucide-react';

interface EmailFilterFormProps {
  onSubmit: (data: { formData: any; processIndividually: boolean; groupBySubject: boolean }) => void;
  isLoading: boolean;
  initialValues?: any;
}

const LOCAL_STORAGE_KEY = 'emailai-last-email-filters';

const EmailFilterForm: React.FC<EmailFilterFormProps> = ({ onSubmit, isLoading, initialValues }) => {
  // Load initial state from localStorage if available
  const getInitialFormData = () => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Defensive: Only use known keys
        return {
          dateRange: parsed.dateRange || 'last24hours',
          startDate: parsed.startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: parsed.endDate || new Date().toISOString().split('T')[0],
          status: parsed.status || 'unread',
          maxResults: parsed.maxResults || 20,
          folder: parsed.folder || 'INBOX',
          subjectSearchTerm: parsed.subjectSearchTerm || '',
          fetchAllFolders: parsed.fetchAllFolders || false,
        };
      }
    } catch (e) {
      // Ignore parse errors
    }
    // Default values
    return {
      dateRange: 'last24hours',
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      status: 'unread',
      maxResults: 20,
      folder: 'INBOX',
      subjectSearchTerm: '',
      fetchAllFolders: false,
    };
  };

  const getInitialToggle = (key: string, defaultValue: boolean) => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed[key] === 'boolean') return parsed[key];
      }
    } catch {}
    return defaultValue;
  };

  const [formData, setFormData] = useState(getInitialFormData);
  const [processIndividually, setProcessIndividually] = useState(() => getInitialToggle('processIndividually', false));
  const [groupBySubject, setGroupBySubject] = useState(() => getInitialToggle('groupBySubject', true));

  // Update form state when initialValues prop changes (for rerun)
  useEffect(() => {
    if (initialValues) {
      setFormData({
        ...getInitialFormData(),
        ...initialValues,
      });
      if (typeof initialValues.processIndividually === 'boolean') setProcessIndividually(initialValues.processIndividually);
      if (typeof initialValues.groupBySubject === 'boolean') setGroupBySubject(initialValues.groupBySubject);
    }
    // eslint-disable-next-line
  }, [initialValues]);

  // Persist to localStorage on any change
  useEffect(() => {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        ...formData,
        processIndividually,
        groupBySubject,
      })
    );
  }, [formData, processIndividually, groupBySubject]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;

    if (type === 'checkbox') {
        const { checked } = e.target as HTMLInputElement;
        setFormData(prev => ({
          ...prev,
          [name]: checked,
          ...(name === 'fetchAllFolders' && !checked && { folder: 'INBOX' })
        }));
    } else {
        setFormData(prev => ({ ...prev, [name]: value }));
    }
  };
  
  const handleDateRangeChange = (range: string) => {
    let startDate;
    const endDate = new Date().toISOString().split('T')[0];
    
    switch (range) {
      case 'today':
        startDate = new Date().toISOString().split('T')[0];
        break;
      case 'last24hours':
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last7days':
        startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'last30days':
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        break;
      case 'custom':
        return setFormData(prev => ({ ...prev, dateRange: range }));
      default:
        startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }
    
    setFormData(prev => ({
      ...prev,
      dateRange: range,
      startDate,
      endDate
    }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ formData, processIndividually, groupBySubject });
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Date Range
        </label>
        <DateRangePicker
          value={formData.dateRange}
          onChange={handleDateRangeChange}
        />
      </div>
      
      {formData.dateRange === 'custom' && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              max={formData.endDate}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={formData.startDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
      )}
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Email Status
        </label>
        <div className="flex space-x-4">
          {['all', 'read', 'unread'].map(status => (
            <label key={status} className="inline-flex items-center">
              <input
                type="radio"
                name="status"
                value={status}
                checked={formData.status === status}
                onChange={handleChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="ml-2 text-gray-700 capitalize">{status}</span>
            </label>
          ))}
        </div>
      </div>
      
      <div>
        <label htmlFor="folder" className="block text-sm font-medium text-gray-700 mb-1">
          Folder
        </label>
        <select
          id="folder"
          name="folder"
          value={formData.folder}
          onChange={handleChange}
          disabled={formData.fetchAllFolders}
          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            formData.fetchAllFolders ? 'bg-gray-100 cursor-not-allowed' : ''
          }`}
        >
          <option value="INBOX">Inbox</option>
          <option value="[Gmail]/Sent Mail">Sent Mail</option>
          <option value="[Gmail]/Drafts">Drafts</option>
          <option value="[Gmail]/Starred">Starred</option>
          <option value="[Gmail]/All Mail">All Mail (Gmail)</option>
          <option value="Archive">Archive</option>
        </select>
      </div>
      
      <div className="flex items-center">
        <input
          type="checkbox"
          id="fetchAllFolders"
          name="fetchAllFolders"
          checked={formData.fetchAllFolders}
          onChange={handleChange}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="fetchAllFolders" className="ml-2 block text-sm text-gray-900">
          Fetch from all folders
        </label>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Subject Search
        </label>
        <input
          type="text"
          name="subjectSearchTerm"
          value={formData.subjectSearchTerm}
          onChange={handleChange}
          placeholder="Enter subject keyword..."
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Leave blank to ignore subject.
        </p>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Max Results
        </label>
        <input
          type="number"
          name="maxResults"
          value={formData.maxResults}
          onChange={handleChange}
          min={1}
          max={100}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <p className="mt-1 text-xs text-gray-500">
          Maximum number of emails to fetch
        </p>
      </div>
      
      <div className="mt-4 flex items-center">
        <input
          type="checkbox"
          id="groupBySubject"
          checked={groupBySubject}
          onChange={(e) => setGroupBySubject(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="groupBySubject" className="ml-2 block text-sm text-gray-900">
          Group emails by subject (show newest only)
        </label>
      </div>
      
      <div className="mt-4 flex items-center">
        <input
          type="checkbox"
          id="processIndividually"
          checked={processIndividually}
          onChange={(e) => setProcessIndividually(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="processIndividually" className="ml-2 block text-sm text-gray-900">
          Process each email individually
        </label>
      </div>
      
      <button
        type="submit"
        className={`w-full mt-4 px-4 py-2 rounded-md text-white font-medium ${
          isLoading 
            ? 'bg-blue-400 cursor-not-allowed' 
            : 'bg-blue-600 hover:bg-blue-700 transition-colors duration-200'
        }`}
        disabled={isLoading}
      >
        <div className="flex items-center justify-center">
          {isLoading ? (
            <>
              <Clock className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" />
              Fetching Emails...
            </>
          ) : (
            <>
              <Filter className="-ml-1 mr-2 h-4 w-4" />
              Fetch and Process Emails
            </>
          )}
        </div>
      </button>
    </form>
  );
};

export default EmailFilterForm;