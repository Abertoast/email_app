import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Clock, RefreshCw, Inbox, Search, Loader, X, Mail, ChevronDown, ChevronRight } from 'lucide-react';
import { useEmail } from '../contexts/EmailContext';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';
import EmailFilterForm from '../components/EmailFilterForm';
import SavedPromptSelector from '../components/SavedPromptSelector';
import ProcessingResults from '../components/ProcessingResults';

const Dashboard: React.FC = () => {
  const { settings, savedPrompts, tags, promptVariables } = useSettings();
  const { 
    fetchEmails, 
    processEmails, 
    isFetching, 
    isProcessing, 
    latestResults,
    clearLatestResults
  } = useEmail();
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  const [results, setResults] = useState<string | any[] | null>(null);
  const [emailCount, setEmailCount] = useState<number | null>(null);
  const [fetchedEmails, setFetchedEmails] = useState<any[]>([]);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const customPromptTextareaRef = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    if (latestResults) {
      // No need to set results here anymore, ProcessingResults will use latestResults directly
      // setResults(latestResults.results);
    } else {
      // Clear local results state if latestResults is cleared
      setResults(null);
    }
  }, [latestResults]);
  
  useEffect(() => {
    if (!isProcessing && results && resultsContainerRef.current) {
      resultsContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isProcessing, results]);
  
  const handleProcess = async (data: { formData: any; processIndividually: boolean; groupBySubject: boolean }) => {
    const { formData, processIndividually, groupBySubject } = data;

    clearLatestResults();
    
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
      
      let emailsToProcess = emails;
      
      // Apply grouping only if the checkbox was checked
      if (groupBySubject) {
        const emailThreads = new Map<string, any>();
        emails.forEach(email => {
          const subject = email.subject || '(no subject)';
          if (!emailThreads.has(subject)) {
            emailThreads.set(subject, email);
          }
        });
        emailsToProcess = Array.from(emailThreads.values());
      }
      
      // Update state and processing with the potentially filtered list
      setEmailCount(emailsToProcess.length); 
      setFetchedEmails(emailsToProcess); 
      
      if (emailsToProcess.length === 0) {
        toast('No emails found matching your criteria');
        setResults([]); // Set results to empty array to clear previous results display
        return;
      }
      
      // Process emails (this now updates latestResults in EmailContext)
      await processEmails(emailsToProcess, finalPrompt, processIndividually);
    } catch (error) {
      toast.error('Error processing emails');
      console.error(error);
      setResults(null); // Clear results on error
    }
  };

  const resetForm = () => {
    setCustomPrompt('');
    setSelectedPromptId(null);
    setResults(null);
    setEmailCount(null);
    setFetchedEmails([]);
    clearLatestResults();
  };
  
  const toggleEmailExpansion = (emailId: string) => {
    setExpandedEmailId(prevId => (prevId === emailId ? null : emailId));
  };
  
  // Handler for inserting text (variables or tags) into the custom prompt textarea
  const handleInsertIntoCustomPrompt = (textToInsert: string) => {
    if (customPromptTextareaRef.current) {
      const textarea = customPromptTextareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = textarea.value;
      const newText = text.substring(0, start) + textToInsert + text.substring(end);

      setCustomPrompt(newText);
      setSelectedPromptId(null); // Clear selected prompt if using custom prompt

      // Set cursor position after insertion
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + textToInsert.length;
        textarea.focus();
      }, 0);
    }
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
                  ref={customPromptTextareaRef}
                  className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={5}
                  placeholder="E.g., List all the open items assigned to me from these emails"
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setSelectedPromptId(null);
                  }}
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
                        onClick={() => handleInsertIntoCustomPrompt(`{${variable.key}}`)}
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
                        onClick={() => handleInsertIntoCustomPrompt(tag.marker)}
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
            
            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {fetchedEmails.map((email) => {
                const isExpanded = expandedEmailId === email.id;
                return (
                  <div 
                    key={email.id}
                    className="bg-white rounded-md border border-gray-200 overflow-hidden"
                  >
                    <div 
                      className="p-3 cursor-pointer hover:bg-gray-50 transition-colors duration-150"
                      onClick={() => toggleEmailExpansion(email.id)}
                      aria-expanded={isExpanded}
                      aria-controls={`email-body-${email.id}`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center mr-2">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" /> 
                          ) : (
                            <ChevronRight className="w-4 h-4 mr-2 text-gray-500 flex-shrink-0" />
                          )}
                          <div>
                            <p className="font-medium text-gray-900">{email.subject || '(no subject)'}</p>
                            <p className="text-sm text-gray-600">{email.sender}</p>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                          {new Date(email.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center pl-6">
                        <span className={`w-2 h-2 rounded-full mr-2 ${
                          email.read ? 'bg-gray-400' : 'bg-blue-500'
                        }`} />
                        <span className="text-xs text-gray-600">
                          {email.read ? 'Read' : 'Unread'}
                        </span>
                        <div className="ml-auto flex space-x-1">
                          {email.flags && Array.isArray(email.flags) && email.flags
                            .filter((flag: string) => !flag.startsWith('\\'))
                            .slice(0, 3)
                            .map((flag: string) => (
                              <span 
                                key={flag} 
                                className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 rounded-full"
                              >
                                {flag.replace(/^\\?/, '')} 
                              </span>
                            ))}
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <div 
                        id={`email-body-${email.id}`}
                        className="border-t border-gray-200 p-4 bg-gray-50 max-h-96 overflow-y-auto"
                      >
                        <div 
                          className="prose prose-sm max-w-none whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: email.body || '<p>No content available.</p>' }} 
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        
        {/* Results area */}
        {(isProcessing || latestResults) && (
          <div ref={resultsContainerRef} className="border-t border-gray-200 p-6 bg-gray-50">
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
              <ProcessingResults />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;