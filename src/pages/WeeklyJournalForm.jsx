import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function WeeklyJournalForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [journalText, setJournalText] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [existingJournal, setExistingJournal] = useState(null);
  const [weekDates, setWeekDates] = useState({ start: null, end: null });
  const [wordCount, setWordCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  // Get the current ISO week's Monday
  const getCurrentWeekStart = () => {
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Sunday
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  };

  // Get the end date of the week (Sunday)
  const getWeekEnd = (weekStart) => {
    const sunday = new Date(weekStart);
    sunday.setDate(sunday.getDate() + 6);
    return sunday;
  };

  useEffect(() => {
    const weekStart = getCurrentWeekStart();
    const weekEnd = getWeekEnd(weekStart);
    
    setWeekDates({
      start: weekStart,
      end: weekEnd
    });

    // Check if there's an existing journal for this week
    async function checkExistingJournal() {
      try {
        setLoadingData(true);
        
        const { data, error } = await supabase
          .from('weekly_journals')
          .select('*')
          .eq('user_id', user.id)
          .eq('week_start_date', weekStart.toISOString().split('T')[0])
          .single();
        
        if (error && error.code !== 'PGRST116') { // PGRST116 means not found
          throw error;
        }
        
        if (data) {
          setExistingJournal(data);
          setJournalText(data.journal_text);
          updateWordCount(data.journal_text);
        }
      } catch (error) {
        console.error('Error checking for existing journal:', error);
        setError('Failed to load journal data');
      } finally {
        setLoadingData(false);
      }
    }

    checkExistingJournal();
  }, [user]);

  const updateWordCount = (text) => {
    const words = text.trim().split(/\s+/);
    setWordCount(text.trim() ? words.length : 0);
  };

  const formatDateRange = (start, end) => {
    if (!start || !end) return '';
    
    const options = { month: 'long', day: 'numeric', year: 'numeric' };
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  };

  const handleTextChange = (e) => {
    setJournalText(e.target.value);
    updateWordCount(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!journalText.trim()) {
      setError('Please enter your journal reflection');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      if (existingJournal) {
        // Update existing journal
        const { error } = await supabase
          .from('weekly_journals')
          .update({
            journal_text: journalText,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingJournal.id);
        
        if (error) throw error;
      } else {
        // Create new journal
        const { error } = await supabase
          .from('weekly_journals')
          .insert([
            {
              user_id: user.id,
              week_start_date: weekDates.start.toISOString().split('T')[0],
              journal_text: journalText
            }
          ]);
        
        if (error) throw error;
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/journals');
      }, 2000);
      
    } catch (error) {
      console.error('Error saving journal:', error);
      setError(error.message || 'Failed to save journal');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-16 w-16 rounded-full border-t-4 border-b-4 border-primary-600 animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header with gradient background */}
      <div className="glassmorphism p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-b from-purple-300 to-primary-300 rounded-full filter blur-3xl opacity-10 -mr-20 -mt-40"></div>
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-t from-blue-300 to-primary-300 rounded-full filter blur-3xl opacity-10 -ml-20 -mb-20"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold gradient-text mb-1">Weekly Reflection Journal</h1>
            <p className="text-gray-600 text-sm md:text-base">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 mr-2">
                Week of {formatDateRange(weekDates.start, weekDates.end)}
              </span>
              <span className="text-gray-500">
                {existingJournal ? 'Editing existing journal' : 'Creating new journal'}
              </span>
            </p>
          </div>
          <Link to="/journals" className="btn btn-outline flex items-center gap-2 self-start md:self-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd" />
            </svg>
            View All Journals
          </Link>
        </div>
      </div>
      
      {/* Error and success messages */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm animate-fade-in">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-lg shadow-sm animate-fade-in">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-green-700">Journal saved successfully! Redirecting...</p>
          </div>
        </div>
      )}
      
      {/* Journal form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-6">
          {/* Prompt section with expand/collapse */}
          <div className="glassmorphism p-0 overflow-hidden">
            <div 
              className="bg-gradient-to-r from-primary-50 to-purple-50 p-4 cursor-pointer flex justify-between items-center"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <h2 className="font-semibold text-primary-800">Reflection Prompt</h2>
              <button type="button" className="text-primary-600 hover:text-primary-800 transition-colors">
                {isExpanded ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className={`p-5 border-t border-gray-100 transition-all duration-300 ${isExpanded ? 'block' : 'hidden'}`}>
              <div className="prose max-w-none">
                <p className="text-gray-700">
                  Reflect on your experiences this week. Consider addressing the following questions:
                </p>
                <ul className="space-y-2 text-gray-700 list-disc pl-5 mt-2">
                  <li>What specific tasks did you accomplish this week?</li>
                  <li>What challenges did you encounter and how did you overcome them?</li>
                  <li>What skills did you develop or improve during these activities?</li>
                  <li>How does this week's experience connect to your broader career goals?</li>
                  <li>What specific lessons or insights did you gain that you'll apply going forward?</li>
                </ul>
                <p className="text-sm text-gray-500 mt-4 italic">
                  Remember to be specific about your experiences and reflect deeply on what you've learned.
                </p>
              </div>
            </div>
          </div>
          
          {/* Text editor with stats */}
          <div className="glassmorphism p-5">
            <label htmlFor="journalText" className="block text-lg font-semibold text-gray-800 mb-2">
              Your Weekly Reflection
            </label>
            
            <div className="relative">
              <textarea
                id="journalText"
                className="input h-64 bg-white/70 backdrop-blur-sm border-gray-200 focus:border-primary-400 transition-all duration-200 p-4"
                value={journalText}
                onChange={handleTextChange}
                placeholder="Begin your weekly reflection here..."
                required
              />
              
              <div className="absolute right-3 bottom-3 text-xs text-gray-500 flex items-center gap-1 bg-white/80 backdrop-blur-sm px-2 py-1 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18" />
                </svg>
                {wordCount} words
              </div>
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate('/journals')}
              className="btn btn-outline py-2 px-4 flex items-center gap-2"
              disabled={loading}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary py-2 px-6 flex items-center gap-2 transform transition hover:scale-105"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 rounded-full border-t-2 border-b-2 border-white animate-spin"></div>
                  Saving...
                </>
              ) : existingJournal ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Update Journal
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Save Journal
                </>
              )}
            </button>
          </div>
        </div>
      </form>
      
      {/* Tips section */}
      <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg p-5 shadow-sm border border-primary-100">
        <h3 className="text-sm font-semibold text-primary-800 mb-2 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Tips for Effective Reflection
        </h3>
        <ul className="text-xs text-gray-700 space-y-1">
          <li>• Be specific about tasks, challenges, and outcomes</li>
          <li>• Connect your experiences to your career development</li>
          <li>• Include both successes and learning opportunities</li>
          <li>• Reflect on feedback received and how you applied it</li>
          <li>• Consider how this week's experiences build on previous weeks</li>
        </ul>
      </div>
    </div>
  );
}

export default WeeklyJournalForm; 