import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import PromptLibrary from './pages/PromptLibrary';
import QueryHistory from './pages/QueryHistory';
import { EmailProvider } from './contexts/EmailContext';
import { SettingsProvider } from './contexts/SettingsContext';
import UpdateNotificationModal from './components/UpdateNotificationModal';

function App() {
  // State for update notification modal
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateTitle, setUpdateTitle] = useState('');
  const [updateDescription, setUpdateDescription] = useState('');
  const [currentUpdateId, setCurrentUpdateId] = useState<string | null>(null);
  const [isUpdateAvailableForRefresh, setIsUpdateAvailableForRefresh] = useState(false);

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

  // Effect to check for updates when window gains focus (sets refresh indicator)
  useEffect(() => {
    const handleFocusCheck = async () => {
      // Only run check if we have successfully loaded an initial update ID
      if (!currentUpdateId) return;
      
      console.log('[AppFocusCheck] Window focused, checking for background update...');
      try {
        // Fetch the latest update info again
        const response = await fetch('/latest-update.json?cacheBust=' + Date.now()); // Add cache busting
        if (!response.ok) {
          // Don't show indicator if fetch fails
          console.warn('[AppFocusCheck] Failed to fetch update info on focus.');
          return;
        }
        const updateData = await response.json();

        if (updateData && updateData.updateId) {
          const latestFetchedId = updateData.updateId;
          console.log('[AppFocusCheck] Fetched update ID on focus:', latestFetchedId);
          console.log('[AppFocusCheck] Update ID from initial load:', currentUpdateId);
          
          // If the latest ID differs from the one loaded initially, flag for refresh
          if (latestFetchedId !== currentUpdateId) {
            console.log('[AppFocusCheck] Update detected in background. Setting refresh indicator.');
            setIsUpdateAvailableForRefresh(true);
          } else {
             console.log('[AppFocusCheck] No change detected since initial load.');
          }
        }
      } catch (error) {
        console.error('[AppFocusCheck] Error checking for updates on focus:', error);
      }
    };

    // Add event listener
    window.addEventListener('focus', handleFocusCheck);
    console.log('[AppFocusCheck] Focus event listener added.');

    // Cleanup listener on unmount
    return () => {
      window.removeEventListener('focus', handleFocusCheck);
      console.log('[AppFocusCheck] Focus event listener removed.');
    };
    // Depend on currentUpdateId so the check uses the correct comparison value
  }, [currentUpdateId]); 

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
          <Layout isUpdateAvailableForRefresh={isUpdateAvailableForRefresh}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/prompts" element={<PromptLibrary />} />
              <Route path="/history" element={<QueryHistory />} />
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