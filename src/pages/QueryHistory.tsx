import React from 'react';
import { Clock, Search, Mail, Trash2, ArrowRight } from 'lucide-react';
import { useEmail } from '../contexts/EmailContext';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const QueryHistory: React.FC = () => {
  const { queryHistory, clearQueryHistory, rerunQuery } = useEmail();
  const navigate = useNavigate();
  
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your entire query history?')) {
      clearQueryHistory();
      toast.success('Query history cleared');
    }
  };
  
  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  
  const handleRerun = (queryData: any) => {
    rerunQuery(queryData, navigate);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Query History</h1>
          <p className="text-gray-600">Your past email queries and their results</p>
        </div>
        
        {queryHistory.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition-colors duration-200 flex items-center"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear History
          </button>
        )}
      </div>
      
      {queryHistory.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center border border-dashed border-gray-300">
          <div className="text-gray-400 mb-4">
            <Clock className="h-12 w-12 mx-auto" />
          </div>
          <h3 className="text-xl font-medium text-gray-700 mb-2">
            No query history yet
          </h3>
          <p className="text-gray-500">
            Your past email queries will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {queryHistory.map((query, index) => (
            <div 
              key={index} 
              className="bg-white rounded-xl shadow-md overflow-hidden transition-all duration-300 hover:shadow-lg"
            >
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center text-sm text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{formatDate(query.timestamp)}</span>
                  </div>
                  <button
                    onClick={() => handleRerun(query.queryData)}
                    className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors duration-200 flex items-center text-sm"
                  >
                    <ArrowRight className="h-3 w-3 mr-1" />
                    Run Again
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="flex items-center text-md font-medium text-gray-700 mb-3">
                      <Mail className="h-4 w-4 mr-2 text-blue-500" />
                      Email Query
                    </h3>
                    <div className="bg-gray-50 rounded-md p-3 text-sm">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <span className="font-medium">Date Range:</span> 
                          <span className="text-gray-600 ml-1">
                            {query.queryData.dateRange === 'custom' 
                              ? `${query.queryData.startDate} to ${query.queryData.endDate}`
                              : query.queryData.dateRange.replace(/([A-Z])/g, ' $1').toLowerCase()
                            }
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Status:</span> 
                          <span className="text-gray-600 ml-1 capitalize">{query.queryData.status}</span>
                        </div>
                        <div>
                          <span className="font-medium">Folder:</span> 
                          <span className="text-gray-600 ml-1">{query.queryData.folder}</span>
                        </div>
                        <div>
                          <span className="font-medium">Max Results:</span> 
                          <span className="text-gray-600 ml-1">{query.queryData.maxResults}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="font-medium">Processed Individually:</span> 
                          <span className="text-gray-600 ml-1">
                            {query.processIndividually ? 'Yes' : 'No'} 
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h3 className="flex items-center text-md font-medium text-gray-700 mb-3">
                      <Search className="h-4 w-4 mr-2 text-purple-500" />
                      Prompt Used
                    </h3>
                    <div className="bg-gray-50 rounded-md p-3 text-sm">
                      <p className="text-gray-600 line-clamp-3">{query.prompt}</p>
                    </div>
                  </div>
                </div>
                
                {query.results && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <h3 className="text-md font-medium text-gray-700 mb-3">
                      Results
                    </h3>
                    <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
                      <p className="text-gray-600 text-sm whitespace-pre-wrap">
                        {typeof query.results === 'string'
                          ? query.results
                          : Array.isArray(query.results)
                            ? query.results.map((r: any) => r.content).join('\n\n---\n\n')
                            : '(No results available)'
                        }
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QueryHistory;