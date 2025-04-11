import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import DarkModeToggle from '../components/DarkModeToggle';

function JournalHistory() {
  const { user } = useAuth();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const journalsPerPage = 5;

  useEffect(() => {
    fetchJournals();
  }, [user, currentPage, searchTerm]);

  async function fetchJournals() {
    try {
      setLoading(true);
      
      let query = supabase
        .from('weekly_journals')
        .select('*', { count: 'exact' })
        .eq('user_id', user.id)
        .order('week_start_date', { ascending: false });
      
      // Apply search filter if present
      if (searchTerm) {
        query = query.ilike('journal_text', `%${searchTerm}%`);
      }
      
      // Apply pagination
      const from = (currentPage - 1) * journalsPerPage;
      const to = from + journalsPerPage - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      setJournals(data || []);
      setTotalPages(Math.ceil((count || 0) / journalsPerPage));
    } catch (error) {
      console.error('Error fetching journals:', error);
      setError('Failed to fetch journals');
    } finally {
      setLoading(false);
    }
  }

  const handleSearch = (e) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this journal entry?')) {
      return;
    }
    
    try {
      const { error } = await supabase
        .from('weekly_journals')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      // Refresh journals
      fetchJournals();
    } catch (error) {
      console.error('Error deleting journal:', error);
      setError('Failed to delete journal');
    }
  };

  const formatDateRange = (weekStartDate) => {
    try {
      const weekStart = new Date(weekStartDate);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      
      const options = { month: 'long', day: 'numeric', year: 'numeric' };
      return `${weekStart.toLocaleDateString(undefined, options)} - ${weekEnd.toLocaleDateString(undefined, options)}`;
    } catch (error) {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-8 py-6 animate-fade-in">
      {/* Hero Section */}
      <div className="glassmorphism p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-primary-300 to-purple-300 rounded-full filter blur-3xl opacity-20 -mr-20 -mt-20 animate-pulse-slow"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-t from-blue-300 to-primary-300 rounded-full filter blur-3xl opacity-20 -ml-20 -mb-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold gradient-text">Weekly Journal History</h1>
            <DarkModeToggle />
          </div>
          
          {/* Search and New Journal Button */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
            <form onSubmit={handleSearch} className="flex-grow">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search journals..."
                  className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-dark-surface/50 backdrop-blur-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </form>
            <Link 
              to="/weekly-journal" 
              className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all transform hover:scale-105 shadow-md flex items-center justify-center whitespace-nowrap"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Write New Journal
            </Link>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="glassmorphism p-6 border-l-4 border-red-500 animate-slide-up">
          <div className="flex">
            <div className="flex-shrink-0">
              <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="h-7 w-7 text-red-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-bold text-red-800">Error</h3>
              <div className="mt-2 text-base text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="flex justify-center items-center h-64 animate-pulse">
          <div className="h-24 w-24 rounded-full border-t-4 border-b-4 border-primary-600 animate-spin"></div>
        </div>
      ) : journals.length > 0 ? (
        <div className="space-y-6">
          {journals.map((journal, index) => (
            <div 
              key={journal.id} 
              className="glassmorphism p-6 hover-lift transition-all duration-300 animate-slide-up" 
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4">
                <h2 className="text-xl font-semibold gradient-text">
                  <span className="flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                    </svg>
                    Week of {formatDateRange(journal.week_start_date)}
                  </span>
                </h2>
                <div className="flex items-center space-x-3">
                  <Link 
                    to="/weekly-journal" 
                    className="px-4 py-2 bg-white/50 dark:bg-dark-surface/50 text-primary-600 dark:text-primary-400 rounded-lg border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(journal.id)}
                    className="px-4 py-2 bg-white/50 dark:bg-dark-surface/50 text-red-600 dark:text-red-400 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Delete
                  </button>
                </div>
              </div>
              
              <div className="bg-white/30 dark:bg-dark-surface/30 backdrop-blur-sm p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50 my-4">
                <p className="whitespace-pre-line text-gray-800 dark:text-gray-200">{journal.journal_text}</p>
              </div>
              
              <div className="mt-4 text-sm text-gray-500 dark:text-gray-400 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                {journal.updated_at !== journal.created_at 
                  ? `Updated on ${new Date(journal.updated_at).toLocaleString()}`
                  : `Created on ${new Date(journal.created_at).toLocaleString()}`
                }
              </div>
            </div>
          ))}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center space-x-4 mt-8">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-white/70 dark:bg-dark-surface/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover-scale flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Previous
              </button>
              
              <span className="px-4 py-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg text-primary-700 dark:text-primary-300 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-white/70 dark:bg-dark-surface/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-dark-surface transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover-scale flex items-center"
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="glassmorphism p-12 text-center animate-fade-in">
          <div className="bg-gray-50 dark:bg-gray-800/30 p-6 rounded-full inline-block mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13c-1.168-.775-2.754-1.253-4.5-1.253-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">No Journal Entries Found</h3>
          <p className="mt-1 text-base text-gray-500 dark:text-gray-400 mb-6">Start writing weekly reflections to document your OJT journey.</p>
          <Link 
            to="/weekly-journal" 
            className="px-6 py-3 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all transform hover:scale-105 shadow-md inline-flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Write Your First Journal
          </Link>
        </div>
      )}
    </div>
  );
}

export default JournalHistory; 