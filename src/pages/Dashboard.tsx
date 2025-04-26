import React, { useState } from 'react';
import { Calendar, Clock, RefreshCw, Inbox, Search, Loader, X, Mail } from 'lucide-react';
import { useEmail } from '../contexts/EmailContext';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';
import EmailFilterForm from '../components/EmailFilterForm';
import SavedPromptSelector from '../components/SavedPromptSelector';
import ProcessingResults from '../components/ProcessingResults';

const Dashboard: React.FC = () => {
  const { settings, savedPrompts } = useSettings();
  const { fetchEmails, processEmails, isFetching, isProcessing } = useEmail();
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [results, setResults] = useState<string | null>(null);
  const [emailCount, setEmailCount] = useState<number | null>(null);
  const [fetchedEmails, setFetchedEmails] = useState<any[]>([]);
  
  const handleProcess = async (data: { formData: any; processIndividually: boolean }) => {
    const { formData, processIndividually } = data;

    if (!settings.emailConnected) {
      toast.error('Please connect your email in settings first');
      return;
    }
    
    if (!settings.openaiApiKey) {
      toast.error('Please add your OpenAI API key in settings');
      return;
    }
    
    let finalPrompt = customPrompt;

    if (selectedPromptId) {
      const selected = savedPrompts.find(p => p.id === selectedPromptId);
      if (selected) {
        finalPrompt = selected.prompt;
      } else {
        toast.error('Selected saved prompt not found.');
        return;
      }
    } else if (!customPrompt) {
      toast.error('Please enter a prompt or select a saved one');
      return;
    }
    
    try {
      const emails = await fetchEmails(formData);
      setEmailCount(emails.length);
      setFetchedEmails(emails);
      
      if (emails.length === 0) {
        toast('No emails found matching your criteria');
        return;
      }
      
      const processedResults = await processEmails(emails, finalPrompt, processIndividually);
      setResults(processedResults);
    } catch (error) {
      toast.error('Error processing emails');
      console.error(error);
    }
  };

  const resetForm = () => {
    setCustomPrompt('');
    setSelectedPromptId(null);
    setResults(null);
    setEmailCount(null);
    setFetchedEmails([]);
  };
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Email AI Dashboard</h1>
        <p className="text-gray-600">Process your emails with AI to extract insights and information</p>
      </div>
      
      {/* Main card */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <Inbox className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-800">Email Query</h2>
            </div>
            <button
              onClick={resetForm}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 flex items-center"
            >
              <X className="w-4 h-4 mr-1" />
              Reset Form
            </button>
          </div>
          
          {/* Updated grid layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Email filter form */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-500" />
                Email Filters
              </h3>
              <EmailFilterForm onSubmit={handleProcess} isLoading={isFetching || isProcessing} />
            </div>
            
            {/* Prompt form */}
            <div>
              <h3 className="text-lg font-medium text-gray-700 mb-4 flex items-center">
                <Search className="w-5 h-5 mr-2 text-purple-500" />
                Processing Prompt
              </h3>
              
              <SavedPromptSelector
                onPromptSelect={(id) => {
                  setSelectedPromptId(id);
                  setCustomPrompt('');
                }}
                selectedPromptId={selectedPromptId}
              />
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Custom Prompt
                </label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="E.g., List all the open items assigned to me from these emails"
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setSelectedPromptId(null);
                  }}
                />
                <p className="mt-1 text-sm text-gray-500">
                  Enter instructions for how to process the emails
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Fetched Emails */}
        {fetchedEmails.length > 0 && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex items-center mb-4">
              <Mail className="w-5 h-5 mr-2 text-blue-600" />
              <h3 className="text-lg font-medium text-gray-700">
                Fetched Emails
              </h3>
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                {fetchedEmails.length} emails
              </span>
            </div>
            
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {fetchedEmails.map((email) => (
                <div 
                  key={email.id}
                  className="bg-white p-3 rounded-md border border-gray-200"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-gray-900">{email.subject}</p>
                      <p className="text-sm text-gray-600">{email.sender}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(email.date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center">
                    <span className={`w-2 h-2 rounded-full mr-2 ${
                      email.read ? 'bg-gray-400' : 'bg-blue-500'
                    }`} />
                    <span className="text-xs text-gray-600">
                      {email.read ? 'Read' : 'Unread'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Results area */}
        {(isProcessing || results) && (
          <div className="border-t border-gray-200 p-6 bg-gray-50">
            <div className="flex items-center mb-4">
              <RefreshCw 
                className={`w-5 h-5 mr-2 text-blue-600 ${isProcessing ? 'animate-spin' : ''}`} 
              />
              <h3 className="text-lg font-medium text-gray-700">
                Processing Results
              </h3>
              {emailCount !== null && (
                <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                  {emailCount} emails
                </span>
              )}
            </div>
            
            {isProcessing ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-600">Processing your emails...</p>
              </div>
            ) : (
              <ProcessingResults results={results} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;