import React, { createContext, useContext, useState } from 'react';
import { useSettings, Tag } from './SettingsContext';
import toast from 'react-hot-toast';
import OpenAI from 'openai';
import { useNavigate } from 'react-router-dom';
import { substitutePromptVariables } from '../utils/promptUtils';
import { v4 as uuidv4 } from 'uuid';

// Near the top of the file, add a debug flag
const DEBUG_MODE = false; // Set to true only during development for verbose logging

// Modify the logToServer function to filter more logs
const logToServer = (level: 'log' | 'warn' | 'error', ...args: any[]) => {
  // Skip verbose debug logs when not in debug mode
  if (level === 'log') {
    // Skip tag parsing logs unless in debug mode 
    if (!DEBUG_MODE && args[0]?.includes('[TagParse]')) {
      return;
    }
    
    // Skip verbose prompt logs
    if (args[0]?.includes('[EmailContext] Original Prompt:') || 
        args[0]?.includes('[EmailContext] Substituted Prompt:') ||
        args[0]?.includes('[EmailContext] Prompt (no substitutions made):')) {
      return;
    }
    
    // Skip verbose result structure logs
    if (args[0]?.includes('Result structure:')) {
      return;
    }
  }

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
  subjectSearchTerm?: string;
  fetchAllFolders: boolean;
  groupBySubject?: boolean;
}

// Structure for a single processed email result
interface ProcessedEmailResult {
  subject: string;
  sender: string; // Added sender for context
  date: string; // Added date for context
  originalUid: number | string; // Keep track of original email ID
  content: string | null; // The main text content from the LLM
  tags: string[]; // Array of extracted tag *names*
  error?: string; // Added error field to track processing errors
}

interface QueryHistoryItem {
  historyId: string;
  timestamp: number;
  queryData: EmailQuery;
  prompt: string;
  promptType: 'custom' | 'saved';
  promptId: string | null;
  results: string | ProcessedEmailResult[] | null;
  processIndividually: boolean;
  rawEmails: any[]; // NEW: store the raw emails fetched for the query
  uiState?: {
    expandedItems: string[];
    selectedTags: string[];
    selectedFlags: string[];
  }; // NEW: optional UI state for restoring exploration
}

// Define structure for latest results
interface LatestResults {
  // Results follow the same structure as history
  results: string | ProcessedEmailResult[] | null;
  timestamp: number; // To help trigger updates
  processIndividually: boolean; // Store how it was processed
}

// Define models that support temperature (can share or redefine here)
const MODELS_SUPPORTING_TEMP = new Set(['gpt-4o', 'gpt-4.1']);

interface EmailContextType {
  fetchEmails: (queryData: EmailQuery) => Promise<any[]>;
  // processEmails returns type now depends on processIndividually
  processEmails: (
    emails: any[],
    prompt: string,
    processIndividually: boolean,
    promptType?: 'custom' | 'saved',
    promptId?: string | null
  ) => Promise<string | ProcessedEmailResult[]>;
  isFetching: boolean;
  isProcessing: boolean;
  queryHistory: QueryHistoryItem[];
  clearQueryHistory: () => void;
  rerunQuery: (queryData: EmailQuery, navigate: ReturnType<typeof useNavigate>, historyId?: string) => void;
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
  const { settings, savedPrompts, promptVariables, tags: definedTags } = useSettings();
  const [isFetching, setIsFetching] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [latestResults, setLatestResults] = useState<LatestResults | null>(null);
  
  // Load query history from localStorage
  React.useEffect(() => {
    const storedHistory = localStorage.getItem('emailai-query-history');
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        // MIGRATION: Add missing fields for old items
        const migrated = parsedHistory.map((item: any) => ({
          ...item,
          queryData: {
            ...item.queryData,
            groupBySubject: item.queryData?.groupBySubject ?? false,
          },
          promptType: item.promptType || 'custom',
          promptId: typeof item.promptId !== 'undefined' ? item.promptId : null,
          rawEmails: Array.isArray(item.rawEmails) ? item.rawEmails : [], // fallback for old items
          // uiState is optional, fallback to undefined
        }));
        setQueryHistory(migrated);
      } catch (error) {
        console.error('Failed to parse stored query history', error);
        localStorage.removeItem('emailai-query-history');
      }
    }
  }, []);
  
  const saveQueryToHistory = (
    query: EmailQuery,
    prompt: string,
    results: string | ProcessedEmailResult[] | null,
    processIndividually: boolean,
    promptType: 'custom' | 'saved',
    promptId: string | null,
    rawEmails: any[], // NEW
    uiState?: { expandedItems: string[]; selectedTags: string[]; selectedFlags: string[] } // NEW
  ) => {
    const newHistory = [
      {
        historyId: uuidv4(),
        timestamp: Date.now(),
        queryData: query,
        prompt,
        promptType,
        promptId,
        results,
        processIndividually,
        rawEmails,
        uiState,
      },
      ...queryHistory
    ].slice(0, 20);
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
        maxResults: queryData.maxResults,
        subjectSearchTerm: queryData.subjectSearchTerm,
        fetchAllFolders: queryData.fetchAllFolders,
      };

      // Use logToServer for backend-related info
      // logToServer('log', '[EmailContext] Calling /api/fetchEmails with body:', apiBody);
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
      const emailsWithMetadata = (data.emails || []).map((email: any) => {
        // Log email flags for debugging
        logToServer('log', `[EmailContext][Flags] Email ID: ${email.id}, Subject: "${email.subject}", Flags: ${JSON.stringify(email.flags || [])}`);
        
        return {
          ...email,
          // Ensure 'body' field exists, default to empty string if not provided by backend yet
          body: email.body || '',
          queryData,
        };
      });
      return emailsWithMetadata;
    } catch (error) {
      // Keep console.error for actual client-side errors
      console.error('Error fetching emails:', error);
      throw error;
    } finally {
      setIsFetching(false);
    }
  };
  
  const processEmails = async (
    emails: any[],
    prompt: string,
    processIndividually: boolean,
    promptType: 'custom' | 'saved' = 'custom',
    promptId: string | null = null
  ) => {
    if (!settings.openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }
    
    if (emails.length === 0) {
      return 'No emails to process';
    }
    
    // ---> Substitute variables in the prompt <---
    const substitutedPrompt = substitutePromptVariables(prompt, promptVariables);
    // Remove detailed prompt logging and replace with a simple count
    if (prompt !== substitutedPrompt) {
      logToServer('log', `[EmailContext] Prompt with ${promptVariables.length} variables substituted`);
    }
    // ---> End Substitution <---

    setIsProcessing(true);
    logToServer('log', `[EmailContext] Processing ${emails.length} emails. Individual processing: ${processIndividually}`);
    logToServer('log', '[EmailContext] Using OpenAI model:', settings.openaiModel);

    let result: string | ProcessedEmailResult[] = ''; // Initialize result variable with correct type

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
          // Use the substituted prompt here
          const systemPrompt = substitutedPrompt;
          const userPrompt = `Here is the email content:\\n\\n${singleEmailContext}`;

          logToServer('log', `[EmailContext] Processing email ${index + 1}/${emails.length} (UID: ${email.id}) individually.`);
          let individualResult = '';
          let processedData: ProcessedEmailResult | null = null; // Use ProcessedEmailResult structure

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
            individualResult = completion.choices[0]?.message?.content || ''; // Get raw response

            // --- START Tag Parsing Logic ---
            const extractedTagNames: string[] = [];
            let cleanedContent = individualResult;

            if (individualResult && definedTags.length > 0) {
              // Log only once at the start of tag parsing rather than for each tag
              if (DEBUG_MODE) {
                logToServer('log', `[EmailContext][TagParse] Raw content for email ${index + 1}:`, JSON.stringify(individualResult));
              }

              // --- START New String Rebuilding Logic ---
              definedTags.forEach(tag => {
                const marker = tag.marker; // e.g., [[No Task]]
                const markerLower = marker.toLowerCase();
                let contentLower = cleanedContent.toLowerCase(); // Lowercase for searching
                
                // Check if marker *might* exist before entering loop
                if (contentLower.includes(markerLower)) {
                    // Log only if in debug mode
                    if (DEBUG_MODE) {
                      logToServer('log', `[EmailContext][TagParse] Marker \"${marker}\" might exist. Entering removal loop.`);
                    }
                    
                    // Add tag name ONCE if marker is found at least once
                    if (!extractedTagNames.includes(tag.name)) {
                       extractedTagNames.push(tag.name);
                       // Keep this important log as it shows what tags were found
                       logToServer('log', `[EmailContext][TagParse] Added tag name: ${tag.name}`);
                    }

                    // Loop to remove ALL occurrences using string rebuilding
                    let startIndex = contentLower.indexOf(markerLower);
                    while (startIndex > -1) {
                        // Remove per-occurrence logs that create lots of noise
                        // logToServer('log', `[EmailContext][TagParse] Found \"${marker}\" at index ${startIndex}.`);
                        const endIndex = startIndex + marker.length;
                        const beforeRemoval = cleanedContent;
                        
                        // Rebuild the string without this occurrence
                        cleanedContent = cleanedContent.substring(0, startIndex) + cleanedContent.substring(endIndex);
                        contentLower = cleanedContent.toLowerCase(); // Update lower case version for next search
                        
                        // Remove this noisy log
                        // logToServer('log', `[EmailContext][TagParse] Content after removing occurrence at ${startIndex}:`, JSON.stringify(cleanedContent));
                        if (beforeRemoval === cleanedContent) {
                           logToServer('error', `[EmailContext][TagParse] FAILED TO REMOVE marker \"${marker}\" at index ${startIndex}. Content unchanged. Breaking loop.`);
                           break; // Prevent infinite loop if removal somehow fails
                        }

                        // Find the next occurrence in the modified string
                        startIndex = contentLower.indexOf(markerLower, startIndex); // Start next search from current index
                    }
                    // Remove end of loop log
                    // logToServer('log', `[EmailContext][TagParse] Finished removal loop for marker \"${marker}\".`);
                } else {
                   // Already commented out
                   // logToServer('log', `[EmailContext][TagParse] Marker not found initially: ${marker}`);
                }
              });
              // --- END New String Rebuilding Logic ---
            
            } else {
               // Skip this verbose log
               // logToServer('log', `[EmailContext][TagParse] No content or no defined tags for email ${index + 1}. Skipping parsing.`);
            }
            logToServer('log', `[EmailContext][TagParse] Final extracted tags for email ${index + 1}:`, extractedTagNames);
            // But make content logging conditional based on debug mode
            if (DEBUG_MODE) {
              logToServer('log', `[EmailContext][TagParse] Final cleaned content for email ${index + 1}:`, JSON.stringify(cleanedContent));
            }
            // --- END Tag Parsing Logic ---

            // Construct the ProcessedEmailResult object
            processedData = {
              subject: email.subject || '(No Subject)',
              sender: email.sender || 'N/A',
              date: email.date,
              originalUid: email.id,
              content: cleanedContent, // Use cleaned content
              tags: extractedTagNames, // Use extracted tags
            };

          } catch (error: any) {
             logToServer('error', `[EmailContext] Error processing email ${index + 1}/${emails.length}:`, error.message);
             // Still create a result object, but with error content and error field
             processedData = {
               subject: email.subject || '(No Subject)',
               sender: email.sender || 'N/A',
               date: email.date,
               originalUid: email.id,
               content: `Error processing this email: ${error.message}`,
               tags: [],
               error: error.message, // Add the error message to the result
             };
          }
          // Return the structured result object (or null if something went wrong before try/catch)
          return processedData;
        });

        try {
          // Filter out any null results in case of unexpected errors before try/catch
          const processedResultsArray = (await Promise.all(processedResultsPromises))
                                            .filter((item): item is ProcessedEmailResult => item !== null);
          
          // The result IS the array of processed objects
          result = processedResultsArray; 

          logToServer('log', '[EmailContext] Finished individual email processing. Result structure:', result);
        } catch (error: any) {
          // Handle errors in the Promise.all itself
          logToServer('error', '[EmailContext] Error during Promise.all for email processing:', error.message);
          throw new Error(`Error processing emails in batch: ${error.message}`);
        }
        // --- END Individual OpenAI API Calls ---

      } else {
        // --- START Batch OpenAI API Call (Existing Logic) ---
        logToServer('log', '[EmailContext] Starting batch email processing.');
        // Prepare combined email content for the prompt
        const emailContext = emails.map(email =>
          `From: ${email.sender || 'N/A'}\\nSubject: ${email.subject || 'N/A'}\\nDate: ${new Date(email.date).toLocaleString()}\\n\\n${email.body || '(Body not fetched/available)'}`
        ).join('\\n\\n---\\n\\n'); // Separate emails

        // Use the substituted prompt here
        const systemPrompt = substitutedPrompt;
        const userPrompt = `Here are the relevant emails:\\n\\n${emailContext}`;

        // Log prompts to server
        // logToServer('log', '[EmailContext] System Prompt (User Request):', systemPrompt);
        // logToServer('log', '[EmailContext] User Prompt (Email Context):', userPrompt);

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
      
      // Save the *original* prompt to history, not the substituted one
      saveQueryToHistory(
        queryDataToSave,
        prompt, // <-- Save original prompt
        result, // Pass the result directly (now typed correctly)
        processIndividually,
        promptType,
        promptId,
        emails, // Pass rawEmails
        undefined // Pass undefined for uiState for now
      );
      
      // Update latest results state
      setLatestResults({ 
          results: result, // Pass the result directly
          timestamp: Date.now(), 
          processIndividually: processIndividually 
      });

      // After processing, only log a summary instead of the entire result structure
      if (processIndividually) {
        const resultArray = result as ProcessedEmailResult[];
        const tagCounts: Record<string, number> = {};
        
        // Count tags for summary
        resultArray.forEach(item => {
          if (item.tags && Array.isArray(item.tags)) {
            item.tags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
        });
        
        // Log a summary instead of the full structure
        logToServer('log', `[EmailContext] Finished processing ${resultArray.length} emails individually`);
        logToServer('log', `[EmailContext] Tag summary: ${JSON.stringify(tagCounts)}`);
      } else {
        logToServer('log', '[EmailContext] Finished batch email processing');
      }

      // Return the result (string or array)
      return result; 

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
      // Determine type for saving history/latest results on error
      const errorResultToSave = `Error: ${errorMessage}`;

      // Save history even on error, potentially with null result
      const queryDataToSave = emails[0]?.queryData || { dateRange: '', startDate: '', endDate: '', status: 'all', folder: 'INBOX', maxResults: 20 };
      // Save the *original* prompt to history on error as well
      saveQueryToHistory(
        queryDataToSave,
        prompt, // <-- Save original prompt
        errorResultToSave, // Save error string
        processIndividually,
        promptType,
        promptId,
        emails, // Pass rawEmails (may be empty)
        undefined // Pass undefined for uiState
      );
      
      // Update latest results state with error
      setLatestResults({ 
          results: errorResultToSave, // Save error string
          timestamp: Date.now(), 
          processIndividually: processIndividually 
      });
      
      throw new Error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const clearLatestResults = () => {
    setLatestResults(null);
  };

  const rerunQuery = (
    queryData: EmailQuery,
    navigate: ReturnType<typeof useNavigate>,
    historyId?: string
  ) => {
    let historyItem;
    if (historyId) {
      historyItem = queryHistory.find(item => item.historyId === historyId);
    } else {
      historyItem = queryHistory.find(item => JSON.stringify(item.queryData) === JSON.stringify(queryData));
    }
    if (!historyItem) {
      toast.error('Query not found in history');
      return;
    }
    // Pass all needed info to Dashboard via navigation state
    navigate('/', {
      state: {
        rerun: {
          formData: historyItem.queryData,
          processIndividually: historyItem.processIndividually,
          groupBySubject: historyItem.queryData.groupBySubject ?? false,
          promptType: historyItem.promptType,
          promptId: historyItem.promptId,
          prompt: historyItem.prompt,
        }
      }
    });
    toast('Rerunning query on the dashboard...');
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

// Helper function to escape regex special characters in a string
function escapeRegExp(string: string): string {
  return string.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&');
}