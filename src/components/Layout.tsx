import React from 'react';
import { NavLink } from 'react-router-dom';
import { Mail, Settings as SettingsIcon, BookOpen, History, Menu, X, RefreshCw } from 'lucide-react';
import { useSettings } from '../contexts/SettingsContext';

interface LayoutProps {
  children: React.ReactNode;
  isUpdateAvailableForRefresh: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, isUpdateAvailableForRefresh }) => {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { settings } = useSettings();
  
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);
  
  const navItems = [
    { path: '/', name: 'Dashboard', icon: <Mail size={20} /> },
    { path: '/prompts', name: 'Prompt Library', icon: <BookOpen size={20} /> },
    { path: '/history', name: 'Query History', icon: <History size={20} /> },
    { path: '/settings', name: 'Settings', icon: <SettingsIcon size={20} /> },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile menu button */}
      <button 
        onClick={toggleSidebar}
        className="md:hidden fixed z-20 top-4 left-4 p-2 rounded-md bg-white shadow-md text-gray-600"
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
      {/* Sidebar */}
      <div 
        className={`fixed inset-y-0 left-0 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 z-10 w-64 bg-white shadow-lg transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-center h-16 border-b border-gray-200">
            <h1 className="text-xl font-semibold text-gray-800">EmailAI</h1>
          </div>
          
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => 
                  `flex items-center px-4 py-3 text-gray-600 transition-colors duration-200 rounded-md ${
                    isActive 
                      ? 'bg-blue-50 text-blue-600' 
                      : 'hover:bg-gray-100'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <span className="mr-3">{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            ))}
            <NavLink
              to="/settings"
              className={({ isActive }) => 
                `flex items-center px-4 py-3 text-gray-600 transition-colors duration-200 rounded-md ${
                  isActive 
                    ? 'bg-blue-50 text-blue-600' 
                    : 'hover:bg-gray-100'
                }`
              }
              onClick={() => setSidebarOpen(false)}
            >
              <SettingsIcon size={20} className="mr-3" />
              <span>Settings</span>
            </NavLink>
          </nav>
          
          {/* Bottom section with status */}
          <div className="px-4 py-6 border-t border-gray-200 space-y-3">
            {/* Conditionally render update indicator HERE */}
            {isUpdateAvailableForRefresh && (
                <div 
                   className="flex items-center text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-md animate-pulse"
                   title="Application update available. Please refresh the page."
                 >
                    <RefreshCw size={12} className="mr-1.5 flex-shrink-0"/>
                    <span>Refresh page for update</span>
                </div>
             )}
           {/* Email Status */}
           <div className="flex items-center">
             {/* Status Dot Logic */}
             <div className={`w-2.5 h-2.5 mr-2 rounded-full ${settings.emailConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
             <span className="text-sm font-medium text-gray-700">
               {settings.emailConnected ? 'Email Connected' : 'Email Disconnected'}
             </span>
           </div>
            {/* API Status */}
           <div className="flex items-center mt-2"> {/* Consider removing mt-2 if space-y-3 is enough */}
             {/* Status Dot Logic */}
             <div className={`w-2.5 h-2.5 mr-2 rounded-full ${settings.openaiApiKey ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
             <span className="text-sm font-medium text-gray-700">
               {settings.openaiApiKey ? 'API Connected' : 'API Disconnected'}
             </span>
           </div>
         </div>
        </div>
      </div>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col md:ml-64">
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;