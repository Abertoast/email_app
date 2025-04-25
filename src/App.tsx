import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import PromptLibrary from './pages/PromptLibrary';
import QueryHistory from './pages/QueryHistory';
import { EmailProvider } from './contexts/EmailContext';
import { SettingsProvider } from './contexts/SettingsContext';

function App() {
  return (
    <SettingsProvider>
      <EmailProvider>
        <Router>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/prompts" element={<PromptLibrary />} />
              <Route path="/history" element={<QueryHistory />} />
            </Routes>
          </Layout>
        </Router>
      </EmailProvider>
    </SettingsProvider>
  );
}

export default App;