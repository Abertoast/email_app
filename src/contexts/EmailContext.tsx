import React, { createContext, useContext, useState } from 'react';
import { useSettings } from './SettingsContext';
import toast from 'react-hot-toast';
import OpenAI from 'openai';
import { useNavigate } from 'react-router-dom';

// Helper function to send logs to the backend
const logToServer = (level: 'log' | 'warn' | 'error', ...args: any[]) => {
  // Format arguments similar to how console.log would
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');

  fetch('/api/log', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ level, message })
  }).catch(error => {
    // Fallback to console if logging endpoint fails
    console.error('Failed to send log to server:', error, 'Original message:', message);
  });
};

interface EmailQuery {
  dateRange: string;
  startDate: string;
  endDate: string;
  status: string;
  folder: string;
  maxResults: number;
}

interface QueryHistoryItem {
  timestamp: number;
  queryData: EmailQuery;
  prompt: string;
  results: string | null;
  processIndividually: boolean;
}

// Define structure for latest results
interface LatestResults {
  results: string | null;
  timestamp: number; // To help trigger updates
}

// Define models that support temperature (can share or redefine here)
const MODELS_SUPPORTING_TEMP = new Set(['gpt-4o', 'gpt-4.1']);

interface EmailContextType {
  fetchEmails: (queryData: EmailQuery) => Promise<any[]>;
  processEmails: (emails: any[], prompt: string, processIndividually: boolean) => Promise<string>;
  isFetching: boolean;
  isProcessing: boolean;
  queryHistory: QueryHistoryItem[];
  clearQueryHistory: () => void;
  rerunQuery: (queryData: EmailQuery, navigate: ReturnType<typeof useNavigate>) => void;
  latestResults: LatestResults | null;
  clearLatestResults: () => void;
}

const EmailContext = createContext<EmailContextType | undefined>(undefined);

export const useEmail = () => {
  const context = useContext(EmailContext);
  if (context === undefined) {
    throw new Error('useEmail must be used within an EmailProvider');
  }
  return context;
};

export const EmailProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { settings } = useSettings();
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [latestResults, setLatestResults] = useState<LatestResults | null>(null);
  
  // Load query history from localStorage
  React.useEffect(() => {
    const storedHistory = localStorage.getItem('emailai-query-history');
    if (storedHistory) {
      try {
        setQueryHistory(JSON.parse(storedHistory));
      } catch (error) {
        console.error('Failed to parse stored query history', error);
      }
    }
  }, []);
  
  const saveQueryToHistory = (query: EmailQuery, prompt: string, results: string | null, processIndividually: boolean) => {
    const newHistory = [
      {
        timestamp: Date.now(),
        queryData: query,
        prompt,
        results,
        processIndividually
      },
      ...queryHistory
    ].slice(0, 20); // Keep only the last 20 queries
    
    setQueryHistory(newHistory);
    localStorage.setItem('emailai-query-history', JSON.stringify(newHistory));
  };
  
  const clearQueryHistory = () => {
    setQueryHistory([]);
    localStorage.removeItem('emailai-query-history');
  };
  
  const fetchEmails = async (queryData: EmailQuery) => {
    if (!settings.emailConnected) {
      throw new Error('Email not connected');
    }
    
    setIsFetching(true);
    
    try {
      // Call backend API that connects to the IMAP server and returns matching emails
      const apiBody = {
        imapHost: settings.imapHost,
        imapPort: settings.imapPort,
        email: settings.email,
        password: settings.password,
        folder: queryData.folder,
        startDate: queryData.startDate,
        endDate: queryData.endDate,
        status: queryData.status,
        maxResults: queryData.maxResults
      };

      // Use logToServer for backend-related info
      logToServer('log', '[EmailContext] Calling /api/fetchEmails with body:', apiBody);
      const response = await fetch('/api/fetchEmails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(apiBody)
      });

      logToServer('log', '[EmailContext] Received response from /api/fetchEmails:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        // Keep console.error for actual client-side errors
        console.error('[EmailContext] API fetch error:', errorData);
        throw new Error(errorData?.error || 'Failed to fetch emails');
      }

      const data = await response.json();
      // Attach queryData reference for history tracking
      // Also ensure we have email body if backend provides it
      const emailsWithMetadata = (data.emails || []).map((email: any) => ({
        ...email,
        // Ensure 'body' field exists, default to empty string if not provided by backend yet
        body: email.body || '',
        queryData,
      }));
      return emailsWithMetadata;
    } catch (error) {
      // Keep console.error for actual client-side errors
      console.error('Error fetching emails:', error);
      throw error;
    } finally {
      setIsFetching(false);
    }
  };
  
  const processEmails = async (emails: any[], prompt: string, processIndividually: boolean) => {
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    if (emails.length === 0) {
      return 'No emails to process';
    }
    
    setIsProcessing(true);
    logToServer('log', `[EmailContext] Processing ${emails.length} emails. Individual processing: ${processIndividually}`);
    logToServer('log', '[EmailContext] Using OpenAI model:', settings.openaiModel);

    let result = ''; // Initialize result variable

    try {
      const openai = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: true
      });
      
      // Check if the selected model supports temperature
      const modelSupportsTemp = MODELS_SUPPORTING_TEMP.has(settings.openaiModel);
      const apiTemperature = modelSupportsTemp ? settings.openaiTemperature : undefined;

      if (processIndividually) {
        // --- START Individual OpenAI API Calls ---
        logToServer('log', '[EmailContext] Starting individual email processing.');

        const processedResultsPromises = emails.map(async (email, index) => {
          const singleEmailContext = `From: ${email.sender || 'N/A'}\\nSubject: ${email.subject || 'N/A'}\\nDate: ${new Date(email.date).toLocaleString()}\\n\\n${email.body || '(Body not fetched/available)'}`;
          const systemPrompt = prompt;
          const userPrompt = `Here is the email content:\\n\\n${singleEmailContext}`;

          logToServer('log', `[EmailContext] Processing email ${index + 1}/${emails.length} (UID: ${email.id}) individually.`);
          let individualResult = '';
          try {
            const completion = await openai.chat.completions.create({
              model: settings.openaiModel,
              temperature: apiTemperature,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            });
            logToServer('log', `[EmailContext] Received response for email ${index + 1}/${emails.length}.`);
            individualResult = completion.choices[0]?.message?.content || `(No response for email ${index + 1})`;
          } catch (error: any) {
             logToServer('error', `[EmailContext] Error processing email ${index + 1}/${emails.length}:`, error.message);
             individualResult = `(Error processing email ${index + 1}: ${error.message})`;
          }
          // Return object containing both subject and result
          return {
            subject: email.subject || '(No Subject)', 
            result: individualResult
          };
        });

        const processedResultsWithSubjects = await Promise.all(processedResultsPromises);
        
        // Format the results with subjects before joining
        result = processedResultsWithSubjects.map(item => 
          `Subject: ${item.subject}\n\n${item.result}`
        ).join('\n\n---\n\n'); 

        logToServer('log', '[EmailContext] Finished individual email processing.');
        // --- END Individual OpenAI API Calls ---

      } else {
        // --- START Batch OpenAI API Call (Existing Logic) ---
        logToServer('log', '[EmailContext] Starting batch email processing.');
        // Prepare combined email content for the prompt
        const emailContext = emails.map(email =>
          `From: ${email.sender || 'N/A'}\\nSubject: ${email.subject || 'N/A'}\\nDate: ${new Date(email.date).toLocaleString()}\\n\\n${email.body || '(Body not fetched/available)'}`
        ).join('\\n\\n---\\n\\n'); // Separate emails

        const systemPrompt = prompt;
        const userPrompt = `Here are the relevant emails:\\n\\n${emailContext}`;

        // Log prompts to server
        logToServer('log', '[EmailContext] System Prompt (User Request):', systemPrompt);
        logToServer('log', '[EmailContext] User Prompt (Email Context):', userPrompt);

        logToServer('log', '[EmailContext] Sending batch request to OpenAI...');
        const completion = await openai.chat.completions.create({
          model: settings.openaiModel,
          temperature: apiTemperature,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });

        logToServer('log', '[EmailContext] Received batch response from OpenAI.');
        result = completion.choices[0]?.message?.content || 'No response from AI.';
        // --- END Batch OpenAI API Call ---
      }

      // Save the query to history (using the final 'result')
      const queryDataToSave = emails[0]?.queryData || {
         dateRange: '', startDate: '', endDate: '', status: 'all', folder: 'INBOX', maxResults: 20
      };
      saveQueryToHistory(
        queryDataToSave,
        prompt,
        result,
        processIndividually
      );
      
      // Update latest results state
      setLatestResults({ results: result, timestamp: Date.now() });

      return result; // Return the combined or single result

    } catch (error: any) {
      // General error handling (e.g., if Promise.all fails catastrophically, though individual errors are caught above)
      logToServer('error', '[EmailContext] Error processing emails:', error);
      console.error('Error processing emails with OpenAI:', error);
      let errorMessage = 'Failed to process emails with AI';
      if (error.response) {
        errorMessage = `OpenAI Error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`;
      } else if (error.request) {
        errorMessage = 'Network error contacting OpenAI API.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      toast.error(errorMessage);
      // Save history even on error, potentially with null result
      const queryDataToSave = emails[0]?.queryData || { dateRange: '', startDate: '', endDate: '', status: 'all', folder: 'INBOX', maxResults: 20 };
      saveQueryToHistory(
        queryDataToSave, 
        prompt, 
        `Error: ${errorMessage}`, 
        processIndividually
      );
      
      // Update latest results state with error
      setLatestResults({ results: `Error: ${errorMessage}`, timestamp: Date.now() });
      
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const clearLatestResults = () => {
    setLatestResults(null);
  };

  const rerunQuery = async (queryData: EmailQuery, navigate: ReturnType<typeof useNavigate>) => {
    if (!settings.emailConnected) {
      toast.error('Please connect your email in settings first');
      return;
    }
    
    if (!settings.openaiApiKey) {
      toast.error('Please add your OpenAI API key in settings');
      return;
    }
    
    // Clear previous latest results before starting rerun
    clearLatestResults(); 
    
    // Navigate immediately to dashboard
    navigate('/'); 
    toast('Rerunning query on the dashboard...'); // Give feedback

    try {
      // Find the prompt associated with this query in history
      const historyItem = queryHistory.find(
        item => JSON.stringify(item.queryData) === JSON.stringify(queryData)
      );
      
      if (!historyItem) {
        toast.error('Query not found in history');
        return;
      }
      
      // Extract the processIndividually setting from the history item
      const shouldProcessIndividually = historyItem.processIndividually;
      logToServer('log', `[EmailContext] Rerunning query. Process individually: ${shouldProcessIndividually}`); // Log the setting

      // We need to re-fetch emails potentially, as they might have changed
      // Re-use the stored queryData from history
      const emails = await fetchEmails(historyItem.queryData);
      
      if (emails.length === 0) {
        toast('No emails found matching your criteria for rerun');
        // Still save the attempt to history? Maybe not if no emails found.
        return;
      }
      
      // Pass the retrieved processIndividually setting to processEmails
      const result = await processEmails(emails, historyItem.prompt, shouldProcessIndividually);
      
      // Result is already saved to history and latestResults state updated within processEmails
      toast.success('Query rerun and processed successfully');
      // Optionally, update UI state if needed to display the new result
    } catch (error) {
      // Error is already toasted and saved to latestResults within processEmails or fetchEmails
      // Keep console.error for actual client-side errors
      console.error('Error rerunning query:', error);
    }
  };
  
  return (
    <EmailContext.Provider value={{
      fetchEmails,
      processEmails,
      isFetching,
      isProcessing,
      queryHistory,
      clearQueryHistory,
      rerunQuery,
      latestResults,
      clearLatestResults
    }}>
      {children}
    </EmailContext.Provider>
  );
};