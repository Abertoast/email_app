import React, { useState, useEffect } from 'react';
import { Save, Mail, Key, RefreshCw } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';
import toast from 'react-hot-toast';

// Define models that support temperature
const MODELS_SUPPORTING_TEMP = new Set(['gpt-4o', 'gpt-4.1']);

const Settings: React.FC = () => {
  const { settings, updateSettings, testEmailConnection } = useSettings();
  const [formData, setFormData] = useState({
    imapHost: settings.imapHost || 'imap.gmail.com',
    imapPort: settings.imapPort || 993,
    smtpHost: settings.smtpHost || 'smtp.gmail.com',
    smtpPort: settings.smtpPort || 465,
    email: settings.email || '',
    password: settings.password || '',
    openaiApiKey: settings.openaiApiKey || '',
    openaiModel: settings.openaiModel || 'gpt-4o',
    openaiTemperature: settings.openaiTemperature ?? 0.7
  });
  const [isTesting, setIsTesting] = useState(false);
  
  // Determine if the current model supports temperature
  const currentModelSupportsTemp = MODELS_SUPPORTING_TEMP.has(formData.openaiModel);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      imapHost: settings.imapHost || 'imap.gmail.com',
      imapPort: settings.imapPort || 993,
      smtpHost: settings.smtpHost || 'smtp.gmail.com',
      smtpPort: settings.smtpPort || 465,
      email: settings.email || '',
      password: settings.password || '',
      openaiApiKey: settings.openaiApiKey || '',
      openaiModel: settings.openaiModel || 'gpt-4o',
      openaiTemperature: settings.openaiTemperature ?? 0.7
    }));
  }, [settings]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const valueToSet = type === 'number' ? parseFloat(value) : value;
    setFormData(prev => ({ ...prev, [name]: valueToSet }));
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const settingsToSave = {
        ...formData,
        openaiTemperature: Number(formData.openaiTemperature) || 0.7
      };
      await updateSettings(settingsToSave);
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    }
  };
  
  const handleTestConnection = async () => {
    if (!formData.email || !formData.password) {
      toast.error('Email and password are required');
      return;
    }
    
    setIsTesting(true);
    try {
      const result = await testEmailConnection({
        imapHost: formData.imapHost,
        imapPort: formData.imapPort,
        email: formData.email,
        password: formData.password
      });
      
      if (result.success) {
        toast.success('Email connection successful');
      } else {
        toast.error(`Connection failed: ${result.error}`);
      }
    } catch (error) {
      toast.error('Connection test failed');
      console.error(error);
    } finally {
      setIsTesting(false);
    }
  };
  
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Settings</h1>
        <p className="text-gray-600">Configure your email and API connections</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          {/* Email Settings */}
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center mb-4">
              <Mail className="w-5 h-5 text-blue-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">Email Connection</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="your.email@gmail.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password/App Password
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="For Gmail, use an app password"
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  For Gmail, use an <a href="https://support.google.com/accounts/answer/185833" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">app password</a> instead of your regular password
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IMAP Server
                </label>
                <input
                  type="text"
                  name="imapHost"
                  value={formData.imapHost}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="imap.gmail.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  IMAP Port
                </label>
                <input
                  type="number"
                  name="imapPort"
                  value={formData.imapPort}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="993"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Server
                </label>
                <input
                  type="text"
                  name="smtpHost"
                  value={formData.smtpHost}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  SMTP Port
                </label>
                <input
                  type="number"
                  name="smtpPort"
                  value={formData.smtpPort}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="465"
                  required
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              className={`mt-4 px-4 py-2 rounded-md text-white font-medium ${
                isTesting 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 transition-colors duration-200'
              }`}
            >
              <div className="flex items-center">
                {isTesting ? (
                  <>
                    <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                    Testing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="-ml-1 mr-2 h-4 w-4" />
                    Test Connection
                  </>
                )}
              </div>
            </button>
          </div>
          
          {/* API Settings */}
          <div className="p-6">
            <div className="flex items-center mb-4">
              <Key className="w-5 h-5 text-purple-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-800">OpenAI API Configuration</h2>
            </div>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI API Key
                </label>
                <input
                  type="password"
                  name="openaiApiKey"
                  value={formData.openaiApiKey}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="sk-..."
                  required
                />
                <p className="mt-1 text-xs text-gray-500">
                  Your key is stored locally and never sent to our servers
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenAI Model
                </label>
                <select
                  name="openaiModel"
                  value={formData.openaiModel}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="gpt-4o">gpt-4o</option>
                  <option value="o4-mini">o4-mini</option>
                  <option value="o3">o3</option>
                  <option value="o3-mini">o3-mini</option>
                  <option value="o1">o1</option>
                  <option value="o1-mini">o1-mini</option>
                  <option value="o1-pro">o1-pro</option>
                  <option value="gpt-4.1">gpt-4.1</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Select the OpenAI model to use for processing emails
                </p>
              </div>
              
              <div>
                <label 
                  className={`block text-sm font-medium mb-1 ${currentModelSupportsTemp ? 'text-gray-700' : 'text-gray-400'}`}
                >
                  Temperature
                </label>
                <input
                  type="number"
                  name="openaiTemperature"
                  value={formData.openaiTemperature}
                  onChange={handleChange}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${currentModelSupportsTemp ? 'focus:ring-blue-500' : 'bg-gray-100 text-gray-500 cursor-not-allowed'}`}
                  min="0"
                  max="2"
                  step="0.1"
                  required
                  disabled={!currentModelSupportsTemp}
                />
                <p className={`mt-1 text-xs ${currentModelSupportsTemp ? 'text-gray-500' : 'text-gray-400'}`}>
                  Controls randomness (only for {Array.from(MODELS_SUPPORTING_TEMP).join(', ')}). Default: 0.7
                </p>
              </div>
            </div>
          </div>
          
          {/* Save Button */}
          <div className="px-6 py-4 bg-gray-50 text-right">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 font-medium flex items-center justify-center ml-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default Settings;