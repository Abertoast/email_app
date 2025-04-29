import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import PromptLibrary from './pages/PromptLibrary';
import { EmailProvider } from './contexts/EmailContext';
import { SettingsProvider } from './contexts/SettingsContext';
import UpdateNotificationModal from './components/UpdateNotificationModal';

function App() {
  // State for update notification modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);

  const updateLocalStorageKey = 'emailai-last-seen-update-id';

  // Effect to check for updates on mount
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const response = await fetch('/latest-update.json'); // Path relative to public folder
        if (!response.ok) {
          throw new Error(`Failed to fetch update info: ${response.statusText}`);
        }
        const updateData = await response.json();
        
        if (updateData && updateData.updateId) {
          const fetchedUpdateId = updateData.updateId;
          setCurrentUpdateId(fetchedUpdateId); // Store the latest ID from file

          const lastSeenUpdateId = localStorage.getItem(updateLocalStorageKey);

          console.log('[AppUpdateCheck] Fetched Update ID:', fetchedUpdateId);
          console.log('[AppUpdateCheck] Last Seen Update ID:', lastSeenUpdateId);

          // Show modal if fetched ID is different from the one in localStorage
          if (fetchedUpdateId !== lastSeenUpdateId) {
            console.log('[AppUpdateCheck] New update found. Showing modal.');
            setUpdateTitle(updateData.title || 'Application Update');
            setUpdateDescription(updateData.description || 'Please review the latest changes.');
            setIsUpdateModalOpen(true);
          } else {
             console.log('[AppUpdateCheck] No new update. Modal not shown.');
          }
        } else {
          console.warn('[AppUpdateCheck] Invalid update data format in latest-update.json');
        }
      } catch (error) {
        console.error('[AppUpdateCheck] Error checking for updates:', error);
        // Don't show modal on error
      }
    };

    checkForUpdates();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Handler for closing the modal and updating localStorage
  const handleCloseUpdateModal = () => {
    setIsUpdateModalOpen(false);
    if (currentUpdateId) {
      localStorage.setItem(updateLocalStorageKey, currentUpdateId);
      console.log('[AppUpdateCheck] Marked update as seen:', currentUpdateId);
    }
  };

  return (
    <Router>
      <SettingsProvider>
        <EmailProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/prompts" element={<PromptLibrary />} />
            </Routes>
          </Layout>
          <Toaster position="bottom-right" />
          {/* Render the Update Notification Modal */}
          <UpdateNotificationModal
            isOpen={isUpdateModalOpen}
            onClose={handleCloseUpdateModal}
            title={updateTitle}
            description={updateDescription}
          />
        </EmailProvider>
      </SettingsProvider>
    </Router>
  );
}

export default App;