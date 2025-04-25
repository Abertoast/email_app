import React, { createContext, useContext, useState } from 'react';
import { useSettings } from './SettingsContext';
import toast from 'react-hot-toast';
import OpenAI from 'openai';

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
}

interface EmailContextType {
  fetchEmails: (queryData: EmailQuery) => Promise<any[]>;
  processEmails: (emails: any[], prompt: string) => Promise<string>;
  isFetching: boolean;
  isProcessing: boolean;
  queryHistory: QueryHistoryItem[];
  clearQueryHistory: () => void;
  rerunQuery: (queryData: EmailQuery) => void;
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
  
  const saveQueryToHistory = (query: EmailQuery, prompt: string, results: string | null) => {
    const newHistory = [
      {
        timestamp: Date.now(),
        queryData: query,
        prompt,
        results
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
  
  const processEmails = async (emails: any[], prompt: string) => {
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    if (emails.length === 0) {
      return 'No emails to process';
    }
    
    setIsProcessing(true);
    
    try {
      // Log the full settings object received by the context to server
      logToServer('log', '[EmailContext] Settings object received:', settings);

      logToServer('log', '[EmailContext] Processing emails with prompt:', prompt);
      logToServer('log', '[EmailContext] Using OpenAI model:', settings.openaiModel);

      // --- START OpenAI API Call ---
      const openai = new OpenAI({
        apiKey: settings.openaiApiKey,
        dangerouslyAllowBrowser: true // Necessary for client-side calls
      });

      // Prepare email content for the prompt
      // Note: We might need the email body from the backend fetch for better context.
      // Assuming backend now provides 'sender', 'subject', 'date', 'body'
       const emailContext = emails.map(email =>
        `From: ${email.sender || 'N/A'}\nSubject: ${email.subject || 'N/A'}\nDate: ${new Date(email.date).toLocaleString()}\n\n${email.body || '(Body not fetched/available)'}`
      ).join('\n\n---\n\n'); // Separate emails

      // Construct the prompt using the user's actual request
      // System prompt now contains the user's specific instruction/request
      const systemPrompt = prompt; 
      // User prompt now only contains the email context
      const userPrompt = `Here are the relevant emails:\n\n${emailContext}`;

      // Log prompts to server
      logToServer('log', '[EmailContext] System Prompt (User Request):', systemPrompt);
      logToServer('log', '[EmailContext] User Prompt (Email Context):', userPrompt);

      logToServer('log', '[EmailContext] Sending request to OpenAI...');
      const completion = await openai.chat.completions.create({
        model: settings.openaiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      });

      logToServer('log', '[EmailContext] Received response from OpenAI.');
      const result = completion.choices[0]?.message?.content || 'No response from AI.';
      // --- END OpenAI API Call ---


      // Save the query to history
      // Ensure queryData exists, falling back if needed (should exist via fetchEmails)
      const queryDataToSave = emails[0]?.queryData || {
         dateRange: '', startDate: '', endDate: '', status: 'all', folder: 'INBOX', maxResults: 20
      };
      saveQueryToHistory(
        queryDataToSave,
        prompt,
        result
      );

      return result;
    } catch (error: any) {
      // Keep console.error for actual client-side errors
      console.error('Error processing emails with OpenAI:', error);
      // Provide more specific error feedback
      let errorMessage = 'Failed to process emails with AI';
      if (error.response) {
        // OpenAI API error
        errorMessage = `OpenAI Error: ${error.response.status} - ${error.response.data?.error?.message || error.message}`;
      } else if (error.request) {
        // Network error
        errorMessage = 'Network error contacting OpenAI API.';
      } else {
        // Other setup error
        errorMessage = error.message || errorMessage;
      }
      toast.error(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const rerunQuery = async (queryData: EmailQuery) => {
    if (!settings.emailConnected) {
      toast.error('Please connect your email in settings first');
      return;
    }
    
    if (!settings.openaiApiKey) {
      toast.error('Please add your OpenAI API key in settings');
      return;
    }
    
    try {
      // Find the prompt associated with this query in history
      const historyItem = queryHistory.find(
        item => JSON.stringify(item.queryData) === JSON.stringify(queryData)
      );
      
      if (!historyItem) {
        toast.error('Query not found in history');
        return;
      }
      
      // We need to re-fetch emails potentially, as they might have changed
      // Re-use the stored queryData from history
      const emails = await fetchEmails(historyItem.queryData);
      
      if (emails.length === 0) {
        toast('No emails found matching your criteria for rerun');
        // Still save the attempt to history? Maybe not if no emails found.
        return;
      }
      
      const result = await processEmails(emails, historyItem.prompt);
      
      // Result is already saved to history within processEmails
      toast.success('Query rerun and processed successfully');
      // Optionally, update UI state if needed to display the new result
    } catch (error) {
      // Error is already toasted within processEmails or fetchEmails
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
      rerunQuery
    }}>
      {children}
    </EmailContext.Provider>
  );
};