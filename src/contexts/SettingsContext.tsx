import React, { createContext, useContext, useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

interface EmailSettings {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  email: string;
  password: string;
}

interface SavedPrompt {
  id: string;
  name: string;
  prompt: string;
}

export interface PromptVariable {
  id: string;
  key: string;
  value: string;
}

// Define the Tag interface
export interface Tag {
  id: string;       // Unique identifier
  name: string;     // User-friendly name (e.g., "Action Item") - Must be unique
  marker: string;   // Marker string (e.g., "[[Action Item]]") - Must be unique
  color: string;    // Hex color code (e.g., "#FF5733")
}

interface Settings {
  imapHost: string;
  imapPort: number;
  smtpHost: string;
  smtpPort: number;
  email: string;
  password: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiTemperature: number;
  emailConnected: boolean;
}

interface SettingsContextType {
  settings: Settings;
  savedPrompts: SavedPrompt[];
  promptVariables: PromptVariable[];
  tags: Tag[]; // Add tags state to context type
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  testEmailConnection: (testSettings: Partial<EmailSettings>) => Promise<{ success: boolean; error?: string }>;
  addPrompt: (prompt: SavedPrompt) => void;
  updatePrompt: (prompt: SavedPrompt) => void;
  deletePrompt: (id: string) => void;
  addVariable: (variable: Omit<PromptVariable, 'id'>) => void;
  updateVariable: (variable: PromptVariable) => void;
  deleteVariable: (id: string) => void;
  addTag: (tag: Omit<Tag, 'id'>) => void; // Add tag functions
  updateTag: (tag: Tag) => void;
  deleteTag: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<Settings>({
    imapHost: 'imap.gmail.com',
    imapPort: 993,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 465,
    email: '',
    password: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    openaiTemperature: 0.7,
    emailConnected: false
  });
  
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [promptVariables, setPromptVariables] = useState<PromptVariable[]>([]);
  const [tags, setTags] = useState<Tag[]>([]); // Add tags state
  
  // Load settings from localStorage
  useEffect(() => {
    const storedSettings = localStorage.getItem('emailai-settings');
    if (storedSettings) {
      try {
        const parsedSettings = JSON.parse(storedSettings);
        setSettings(prevSettings => ({
          ...prevSettings,
          ...parsedSettings,
          openaiTemperature: parsedSettings.openaiTemperature ?? prevSettings.openaiTemperature,
          emailConnected: !!parsedSettings.email && !!parsedSettings.password
        }));
      } catch (error) {
        console.error('Failed to parse stored settings', error);
      }
    }
    
    const storedPrompts = localStorage.getItem('emailai-prompts');
    if (storedPrompts) {
      try {
        setSavedPrompts(JSON.parse(storedPrompts));
      } catch (error) {
        console.error('Failed to parse stored prompts', error);
      }
    } else {
      // Set some example prompts if none exist
      const examplePrompts: SavedPrompt[] = [
        {
          id: '1',
          name: 'Extract Action Items',
          prompt: `Your objective is to analyze a list of provided emails and extract all the action items and tasks specifically assigned to the user "{USERNAME}." It is important to focus only on tasks that are addressed directly to {USERNAME} or can be inferred to be a responsibility of {USERNAME} from the context. {USERNAME}'s email address is "{EMAIL}"

## Analysis Guidelines:
- Direct Assignments: Identify any task explicitly addressed to {USERNAME} by name, such as "{USERNAME}", please handle this," {USERNAME} "This task is for you, {USERNAME}."
- Implicit Assignments: Recognize tasks implied to be {USERNAME}'s responsibility from email context, even if not explicitly named. For instance:
   - If an email thread is forwarded and the last email requests {USERNAME}'s assistance, deduce it as a task for {USERNAME}.
   - Notice phrases like "Can you take care of this?" {USERNAME} "Please review by the end of the week," if sent exclusively to {USERNAME}.
- Exclusions: Do not extract suggestions, questions, or general discussions that do not clearly assign a task to USERNAM. Ensure that only genuine action items meant for {USERNAME} are included.
- Contextual Cues: Be attentive to the sender's intent and urgency in sentences. Requests directly sent to {USERNAME} often indicate tasks, especially if they come with deadlines or require a follow-up.
- Thread Analysis: Efficiently analyze email threads to understand the flow of the conversation and identify when {USERNAME} becomes the sole recipient of a task-oriented email.
- Task Formating: For each task found, include: the email context, the task description, who assigned it, when it's due (if mentioned), and the priority level (if mentioned). Use markdown for clarity.

In cases where there are no clear tasks assigned to {USERNAME} respond only with "**No Tasks**"`
        },
        {
          id: '2',
          name: 'Summarize Meetings',
          prompt: 'Find and summarize all upcoming meetings and events from these emails. Include the date, time, participants, and main purpose of each meeting.'
        }
      ];
      setSavedPrompts(examplePrompts);
      localStorage.setItem('emailai-prompts', JSON.stringify(examplePrompts));
    }

    // Load prompt variables
    const storedVariables = localStorage.getItem('emailai-prompt-variables');
    if (storedVariables) {
      try {
        setPromptVariables(JSON.parse(storedVariables));
      } catch (error) {
        console.error('Failed to parse stored prompt variables', error);
      }
    } else {
      // Set default variables if none exist
      const defaultVariables: PromptVariable[] = [
        { id: uuidv4(), key: 'USERNAME', value: 'Your Name' },
        { id: uuidv4(), key: 'EMAIL', value: 'your.email@example.com' },
      ];
      setPromptVariables(defaultVariables);
      localStorage.setItem('emailai-prompt-variables', JSON.stringify(defaultVariables));
    }

    // Load tags
    const storedTags = localStorage.getItem('emailai-tags');
    if (storedTags) {
      try {
        setTags(JSON.parse(storedTags));
      } catch (error) {
        console.error('Failed to parse stored tags', error);
      }
    } else {
      // Optional: Set default tags if none exist (or leave empty)
      const defaultTags: Tag[] = [
        { id: uuidv4(), name: 'Action Item', marker: '[[Action Item]]', color: '#4CAF50'},
        { id: uuidv4(), name: 'Urgent', marker: '[[Urgent]]', color: '#f44336'},
        { id: uuidv4(), name: 'Follow Up', marker: '[[Follow Up]]', color: '#2196F3'},
      ];
      setTags(defaultTags);
      localStorage.setItem('emailai-tags', JSON.stringify(defaultTags));
    }
  }, []);
  
  const updateSettings = async (newSettings: Partial<Settings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    
    // Save settings to localStorage (in a real app, sensitive data should be encrypted)
    localStorage.setItem('emailai-settings', JSON.stringify(updatedSettings));
    
    // Update state
    setSettings({
      ...updatedSettings,
      emailConnected: !!updatedSettings.email && !!updatedSettings.password
    });
    
    return Promise.resolve();
  };
  
  const testEmailConnection = async (testSettings: Partial<EmailSettings>): Promise<{ success: boolean; error?: string }> => {
    // Call the backend API to perform a real connection test
    console.log('[SettingsContext] Calling /api/testConnection with settings:', testSettings);
    try {
      const response = await fetch('/api/testConnection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testSettings)
      });

      const data = await response.json();
      console.log('[SettingsContext] Received response from /api/testConnection:', data);

      if (response.ok && data.success) {
        return { success: true };
      } else {
        return { success: false, error: data.error || 'Unknown connection error' };
      }
    } catch (error) {
      console.error('[SettingsContext] Error calling /api/testConnection:', error);
      return { success: false, error: 'Failed to reach test connection API' };
    }
  };
  
  const addPrompt = (prompt: SavedPrompt) => {
    const newPrompts = [...savedPrompts, prompt];
    setSavedPrompts(newPrompts);
    localStorage.setItem('emailai-prompts', JSON.stringify(newPrompts));
  };
  
  const updatePrompt = (prompt: SavedPrompt) => {
    const newPrompts = savedPrompts.map(p => p.id === prompt.id ? prompt : p);
    setSavedPrompts(newPrompts);
    localStorage.setItem('emailai-prompts', JSON.stringify(newPrompts));
  };
  
  const deletePrompt = (id: string) => {
    const newPrompts = savedPrompts.filter(p => p.id !== id);
    setSavedPrompts(newPrompts);
    localStorage.setItem('emailai-prompts', JSON.stringify(newPrompts));
  };
  
  // --- Prompt Variable Management ---

  const addVariable = (variable: Omit<PromptVariable, 'id'>) => {
    if (!variable.key.trim()) {
        console.error("Variable key cannot be empty.");
        return;
    }
    if (promptVariables.some(v => v.key.toUpperCase() === variable.key.trim().toUpperCase())) {
        console.error(`Variable with key "${variable.key}" already exists.`);
        return;
    }

    const newVariable = { ...variable, key: variable.key.trim(), id: uuidv4() };
    const newVariables = [...promptVariables, newVariable];
    setPromptVariables(newVariables);
    localStorage.setItem('emailai-prompt-variables', JSON.stringify(newVariables));
  };

  const updateVariable = (variable: PromptVariable) => {
     if (!variable.key.trim()) {
        console.error("Variable key cannot be empty.");
        return;
    }
     if (promptVariables.some(v => v.id !== variable.id && v.key.toUpperCase() === variable.key.trim().toUpperCase())) {
        console.error(`Variable with key "${variable.key}" already exists.`);
        return;
    }

    const newVariables = promptVariables.map(v =>
      v.id === variable.id ? { ...variable, key: variable.key.trim() } : v
    );
    setPromptVariables(newVariables);
    localStorage.setItem('emailai-prompt-variables', JSON.stringify(newVariables));
  };

  const deleteVariable = (id: string) => {
    const newVariables = promptVariables.filter(v => v.id !== id);
    setPromptVariables(newVariables);
    localStorage.setItem('emailai-prompt-variables', JSON.stringify(newVariables));
  };

  // --- End Prompt Variable Management ---

  // --- Tag Management ---

  const addTag = (tag: Omit<Tag, 'id'>) => {
      const name = tag.name.trim();
      const marker = tag.marker.trim();

      // Validation
      if (!name) {
          console.error("Tag name cannot be empty.");
          // TODO: Provide user feedback (e.g., toast notification)
          return;
      }
      if (!marker.match(/^\[\[.+\]\]$/)) {
          console.error("Tag marker must be in the format [[Marker Name]].");
          // TODO: Provide user feedback
          return;
      }
      if (tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
          console.error(`Tag with name "${name}" already exists (case-insensitive).`);
          // TODO: Provide user feedback
          return;
      }
      if (tags.some(t => t.marker.toLowerCase() === marker.toLowerCase())) {
          console.error(`Tag with marker "${marker}" already exists (case-insensitive).`);
          // TODO: Provide user feedback
          return;
      }

      const newTag: Tag = { ...tag, name, marker, id: uuidv4() };
      const newTags = [...tags, newTag];
      setTags(newTags);
      localStorage.setItem('emailai-tags', JSON.stringify(newTags));
  };

  const updateTag = (tag: Tag) => {
      const name = tag.name.trim();
      const marker = tag.marker.trim();

      // Validation
       if (!name) {
          console.error("Tag name cannot be empty.");
          // TODO: Provide user feedback
          return;
      }
      if (!marker.match(/^\[\[.+\]\]$/)) {
          console.error("Tag marker must be in the format [[Marker Name]].");
          // TODO: Provide user feedback
          return;
      }
      if (tags.some(t => t.id !== tag.id && t.name.toLowerCase() === name.toLowerCase())) {
          console.error(`Tag with name "${name}" already exists (case-insensitive).`);
          // TODO: Provide user feedback
          return;
      }
      if (tags.some(t => t.id !== tag.id && t.marker.toLowerCase() === marker.toLowerCase())) {
          console.error(`Tag with marker "${marker}" already exists (case-insensitive).`);
          // TODO: Provide user feedback
          return;
      }

      const newTags = tags.map(t =>
          t.id === tag.id ? { ...tag, name, marker } : t
      );
      setTags(newTags);
      localStorage.setItem('emailai-tags', JSON.stringify(newTags));
  };

  const deleteTag = (id: string) => {
      const newTags = tags.filter(t => t.id !== id);
      setTags(newTags);
      localStorage.setItem('emailai-tags', JSON.stringify(newTags));
  };

  // --- End Tag Management ---

  const value = {
    settings,
    savedPrompts,
    promptVariables,
    tags, // Provide tags in context value
    updateSettings,
    testEmailConnection,
    addPrompt,
    updatePrompt,
    deletePrompt,
    addVariable,
    updateVariable,
    deleteVariable,
    addTag, // Provide tag functions
    updateTag,
    deleteTag,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};