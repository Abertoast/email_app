import React, { createContext, useContext, useState, useEffect } from 'react';

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
  updateSettings: (newSettings: Partial<Settings>) => Promise<void>;
  testEmailConnection: (testSettings: Partial<EmailSettings>) => Promise<{ success: boolean; error?: string }>;
  addPrompt: (prompt: SavedPrompt) => void;
  updatePrompt: (prompt: SavedPrompt) => void;
  deletePrompt: (id: string) => void;
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
          prompt: 'Extract all action items and tasks assigned to me from these emails. For each item, include: the task description, who assigned it, when it\'s due (if mentioned), and the priority level (if mentioned).'
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
  
  return (
    <SettingsContext.Provider value={{
      settings,
      savedPrompts,
      updateSettings,
      testEmailConnection,
      addPrompt,
      updatePrompt,
      deletePrompt
    }}>
      {children}
    </SettingsContext.Provider>
  );
};