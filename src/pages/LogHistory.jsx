import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase, logSupabaseError, checkRLSPolicies, checkSupabaseHealth } from '../lib/supabase';

function LogHistory() {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [healthCheckResult, setHealthCheckResult] = useState(null);
  const [showHealthCheck, setShowHealthCheck] = useState(false);
  const [runningHealthCheck, setRunningHealthCheck] = useState(false);
  const logsPerPage = 10;

  useEffect(() => {
    fetchLogs();
  }, [user, currentPage, searchTerm]);

  async function fetchLogs() {
    try {
      setLoading(true);
      
      let query = supabase
        .from('daily_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      // Apply search filter if present
      if (searchTerm) {
        query = query.ilike('notes', `%${searchTerm}%`);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * logsPerPage;
      const to = from + logsPerPage - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) {
        logSupabaseError(error, 'fetching logs', { user_id: user.id });
        throw error;
      }
      
      setLogs(data || []);
      setTotalPages(Math.ceil((count || 0) / logsPerPage));
    } catch (error) {
      console.error('Error fetching logs:', error);
      setError('Failed to fetch logs');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this log?')) {
      return;
    }
    
    try {
      // First check if this log belongs to the current user
      const { data: logData, error: logError } = await supabase
        .from('daily_logs')
        .select('user_id')
        .eq('id', id)
        .single();
      
      if (logError) {
        logSupabaseError(logError, 'fetching log before delete', { log_id: id, user_id: user.id });
        throw logError;
      }
      
      // Verify the log belongs to the current user
      if (logData.user_id !== user.id) {
        const permError = new Error('Permission denied: This log belongs to another user');
        logSupabaseError(permError, 'verifying log ownership', { log_id: id, expected_user: user.id, actual_user: logData.user_id });
        throw permError;
      }
      
      // Check for permission issues (removed reference to undefined 'error' variable)
      const { data: policyData, error: policyError } = await supabase
        .from('daily_logs')
        .select('id')
        .limit(1);

      // Diagnose RLS policies if there's a previous issue
      if (policyError && policyError.message.includes('permission denied')) {
        console.log('Checking RLS policies...');
        const policyCheck = await checkRLSPolicies('daily_logs');
        console.log('RLS policy check result:', policyCheck);
      }
      
      const { error: deleteError } = await supabase
        .from('daily_logs')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id); // Add user_id check for extra security
      
      if (deleteError) {
        logSupabaseError(deleteError, 'deleting log', { log_id: id, user_id: user.id });
        throw deleteError;
      }
      
      // Refresh logs
      fetchLogs();
    } catch (error) {
      console.error('Error deleting log:', error);
      
      // Provide more specific error messages
      if (error.message?.includes('permission denied')) {
        setError('Failed to delete log: Permission denied. This could be due to missing database permissions.');
        setShowHealthCheck(true);
      } else if (error.message?.includes('not found')) {
        setError('Failed to delete log: The log no longer exists or you do not have access to it.');
      } else if (error.message?.includes('does not exist')) {
        setError('Failed to delete log: Database schema mismatch. See diagnostics for details.');
        setShowHealthCheck(true);
      } else {
        setError(`Failed to delete log: ${error.message || 'Unknown error'}`);
        setShowHealthCheck(true);
      }
    }
  };

  const runHealthCheck = async () => {
    try {
      setRunningHealthCheck(true);
      const results = await checkSupabaseHealth();
      setHealthCheckResult(results);
    } catch (error) {
      console.error('Error running health check:', error);
      setError('Failed to run database health check');
    } finally {
      setRunningHealthCheck(false);
    }
  };

  const dismissHealthCheck = () => {
    setShowHealthCheck(false);
    setHealthCheckResult(null);
  };

  // Format date for display
  const formatDate = (dateString) => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  // Check if the error is specifically about a missing column
  const isMissingColumnError = error && error.includes('column') && error.includes('does not exist');

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header section with gradient background */}
      <div className="glassmorphism p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-primary-300 to-purple-300 rounded-full filter blur-3xl opacity-10 -mr-20 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-t from-blue-300 to-primary-300 rounded-full filter blur-3xl opacity-10 -ml-20 -mb-20"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text mb-1">Daily Log History</h1>
            <p className="text-gray-600 text-sm md:text-base">Review and manage your daily OJT activity logs</p>
          </div>
          <Link to="/daily-log" className="btn btn-primary flex items-center gap-2 self-start md:self-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add New Log
          </Link>
        </div>
      </div>
      
      {/* Error display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm animate-fade-in">
          <div className="flex justify-between items-start">
            <p className="text-sm text-red-700">{error}</p>
            {showHealthCheck && (
              <button 
                onClick={runHealthCheck} 
                disabled={runningHealthCheck}
                className="text-xs bg-red-100 text-red-800 px-3 py-1 rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors duration-200"
              >
                {runningHealthCheck ? 'Running Diagnostics...' : 'Run Diagnostics'}
              </button>
            )}
          </div>
          
          {/* Health check results - keeping existing implementation */}
          {healthCheckResult && (
            <div className="mt-4 border-t border-red-200 pt-3">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-medium text-red-700">Database Connection Diagnostics</h4>
                <button 
                  onClick={dismissHealthCheck}
                  className="text-xs text-red-700 hover:text-red-900"
                >
                  Close
                </button>
              </div>
              
              <div className="text-xs space-y-2 bg-white p-3 rounded border border-red-200 text-gray-700 overflow-x-auto max-h-60">
                <div>
                  <strong>Configuration:</strong> {healthCheckResult.configuration.usingDevFallbacks ? 
                    'Using development fallbacks (not connected to a real database)' : 
                    'Database configuration looks good'}
                </div>
                
                <div>
                  <strong>Connectivity:</strong> {
                    typeof healthCheckResult.connectivity === 'string' ? 
                    healthCheckResult.connectivity : 
                    healthCheckResult.connectivity.status === 'Connected' ? 
                      `Connected (latency: ${healthCheckResult.connectivity.latency})` : 
                      `Failed: ${healthCheckResult.connectivity.error}`
                  }
                </div>
                
                <div>
                  <strong>Authentication:</strong> {
                    typeof healthCheckResult.auth === 'string' ? 
                    healthCheckResult.auth : 
                    healthCheckResult.auth.status === 'OK' ? 
                      `OK (${healthCheckResult.auth.authenticated ? 'Authenticated' : 'Not authenticated'})` : 
                      `Error: ${healthCheckResult.auth.error}`
                  }
                </div>
                
                <div>
                  <strong>Database tables:</strong>
                  <ul className="list-disc pl-5 mt-1">
                    {Object.entries(healthCheckResult.database).map(([table, result]) => (
                      <li key={table}>
                        {table}: {result.success ? 'Accessible' : `Access failed - ${result.message}`}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {healthCheckResult.tests.delete && (
                  <div>
                    <strong>DELETE Operation Test:</strong> {
                      healthCheckResult.tests.delete.status === 'Success' ? 
                      'Successful' : 
                      `Failed: ${healthCheckResult.tests.delete.error || healthCheckResult.tests.delete.status}`
                    }
                  </div>
                )}
                
                {isMissingColumnError ? (
                  <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400">
                    <p><strong>Database Schema Issue Detected:</strong> The error shows that your code is trying to access a column that doesn't exist in your database.</p>
                    <p className="mt-1">You have two options to fix this:</p>
                    <ol className="list-decimal pl-5 mt-1">
                      <li className="mb-1">Run this SQL in your Supabase SQL editor to add the missing column:</li>
                      <pre className="mt-1 text-xs bg-gray-100 p-1 overflow-x-auto">
                        {`ALTER TABLE daily_logs ADD COLUMN audio_url TEXT;`}
                      </pre>
                      <li className="mt-2">Or update your code to not rely on this column.</li>
                    </ol>
                    <p className="mt-2 text-xs italic">The first solution is recommended if you plan to use audio recording features.</p>
                  </div>
                ) : (
                  <div className="mt-2 p-2 bg-yellow-50 border-l-2 border-yellow-400">
                    <p>If diagnostics show issues with DELETE operations, your database may be missing the RLS policy for deletes. Please ask your administrator to add the following policy:</p>
                    <pre className="mt-1 text-xs bg-gray-100 p-1 overflow-x-auto">
                      {`CREATE POLICY "Users can delete their own logs"
  ON daily_logs FOR DELETE
  USING (auth.uid() = user_id);`}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Search section */}
      <div className="glassmorphism p-5 transition-all duration-300 hover:shadow-lg">
        <form onSubmit={handleSearch} className="flex gap-3 items-center">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search notes..."
              className="input pl-10 border-gray-200 focus:border-primary-400 bg-white/80 backdrop-blur-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary px-6">
            Search
          </button>
        </form>
      </div>
      
      {/* Loading state */}
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-primary-600 animate-spin"></div>
        </div>
      ) : logs.length > 0 ? (
        <div className="glassmorphism p-0 overflow-hidden">
          {/* Table head */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-primary-50 to-purple-50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Hours
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Notes
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-primary-700 uppercase tracking-wider">
                    Audio
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatDate(log.date)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary-100 text-primary-800">
                        {log.hours_worked} hours
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-700 max-h-20 overflow-y-auto">
                        {log.notes ? log.notes : <span className="text-gray-400 italic">No notes</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.audio_url ? (
                        <audio src={log.audio_url} controls className="w-full max-w-xs rounded-lg" />
                      ) : (
                        <span className="text-gray-400 italic">No audio</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleDelete(log.id)}
                        className="text-red-500 hover:text-red-700 transition-colors duration-200 inline-flex items-center gap-1"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-4 bg-gradient-to-r from-gray-50 to-white border-t flex items-center justify-between">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                  disabled={currentPage === 1}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg transition-colors duration-200 ${
                    currentPage === 1 
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                      : 'bg-white border-primary-300 text-primary-700 hover:bg-primary-50'
                  }`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                  disabled={currentPage === totalPages}
                  className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg transition-colors duration-200 ${
                    currentPage === totalPages
                      ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                      : 'bg-white border-primary-300 text-primary-700 hover:bg-primary-50'
                  }`}
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-center">
                <nav className="relative z-0 inline-flex rounded-lg shadow-sm -space-x-px" aria-label="Pagination">
                  <button
                    onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-3 py-2 rounded-l-lg border text-sm font-medium transition-colors duration-200 ${
                      currentPage === 1 
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Previous</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  {Array.from({ length: totalPages }, (_, i) => (
                    <button
                      key={i + 1}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium transition-colors duration-200 ${
                        currentPage === i + 1
                          ? 'z-10 bg-gradient-to-r from-primary-100 to-primary-200 border-primary-400 text-primary-800 font-semibold'
                          : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  
                  <button
                    onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                    disabled={currentPage === totalPages}
                    className={`relative inline-flex items-center px-3 py-2 rounded-r-lg border text-sm font-medium transition-colors duration-200 ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="sr-only">Next</span>
                    <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </nav>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="glassmorphism p-10 text-center flex flex-col items-center">
          <div className="bg-primary-50 rounded-full p-6 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2 text-gray-700">No logs found</h3>
          <p className="text-gray-500 mb-4">You haven't created any OJT logs yet.</p>
          <Link 
            to="/daily-log" 
            className="btn btn-primary inline-flex items-center gap-2 transform transition-transform hover:scale-105"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Create your first log
          </Link>
        </div>
      )}
    </div>
  );
}

export default LogHistory;