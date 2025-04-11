import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import AIService from '../services/AIService';
import DarkModeToggle from '../components/DarkModeToggle';

function WeeklySummary() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasJournal, setHasJournal] = useState(false);
  const [journalId, setJournalId] = useState(null);
  const [useAI, setUseAI] = useState(true); // Default to using AI
  const [aiProvider, setAiProvider] = useState('gemini'); // Default to Gemini
  
  // Use a single state object for week-related data
  const [weekData, setWeekData] = useState({
    weekStart: getCurrentWeekStart(),
    weekEnd: getWeekEnd(getCurrentWeekStart()),
    weeklyHours: 0,
    dailyBreakdown: [],
  });

  // Get the Monday of the current ISO week (week starts on Monday)
  function getCurrentWeekStart() {
    const now = new Date();
    return startOfWeek(now, { weekStartsOn: 1 });
  }

  // Get the end date of the week (Sunday)
  function getWeekEnd(weekStart) {
    return endOfWeek(new Date(weekStart), { weekStartsOn: 1 });
  }

  // Format date to YYYY-MM-DD for database queries
  function formatDate(date) {
    return format(date, 'yyyy-MM-dd');
  }

  // Format date range for display
  function formatDateRange(start, end) {
    if (!start || !end) return '';
    
    return `${format(start, 'MMMM d')} - ${format(end, 'MMMM d, yyyy')}`;
  }

  // Navigate to previous or next week
  function navigateWeek(direction) {
    const { weekStart } = weekData;
    const newWeekStart = direction === 'prev' 
      ? subWeeks(weekStart, 1) 
      : addWeeks(weekStart, 1);
    
    const newWeekEnd = getWeekEnd(newWeekStart);
    
    setWeekData({
      ...weekData,
      weekStart: newWeekStart,
      weekEnd: newWeekEnd
    });
  }

  // Fetch weekly summary data whenever user or selected week changes
  useEffect(() => {
    if (user) {
      fetchWeeklySummary();
    }
  }, [user, weekData.weekStart]);

  // Fetch all data for the selected week
  const fetchWeeklySummary = async () => {
    try {
      setLoading(true);
      setError('');

      const { weekStart, weekEnd } = weekData;
      const formattedWeekStart = formatDate(weekStart);
      const formattedWeekEnd = formatDate(weekEnd);

      // Fetch daily logs for the selected week
      const { data: logsData, error: logsError } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', formattedWeekStart)
        .lte('date', formattedWeekEnd)
        .order('date', { ascending: true });

      if (logsError) throw logsError;

      // Process the data to get daily breakdown and total hours
      const dailyBreakdown = [];
      let weeklyHours = 0;

      // Create an array of all days in the week
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(weekStart.getDate() + i);
        const formattedDate = formatDate(currentDate);
        
        // Find the log for this date if it exists
        const log = logsData.find(log => log.date === formattedDate);
        
        dailyBreakdown.push({
          date: currentDate,
          formattedDate: format(currentDate, 'EEE, MMM d'),
          hours: log ? parseFloat(log.hours_worked) : 0,
          notes: log ? log.notes : '',
          hasLog: !!log
        });
        
        if (log) {
          weeklyHours += parseFloat(log.hours_worked);
        }
      }

      // Check if there's an existing journal for this week
      const { data: journalData, error: journalError } = await supabase
        .from('weekly_journals')
        .select('id, journal_text')
        .eq('user_id', user.id)
        .eq('week_start_date', formattedWeekStart)
        .single();
      
      if (journalError && journalError.code !== 'PGRST116') { // PGRST116 = not found
        throw journalError;
      }
      
      if (journalData) {
        setHasJournal(true);
        setJournalId(journalData.id);
        setSummary(journalData.journal_text);
      } else {
        setHasJournal(false);
        setJournalId(null);
        setSummary('');
      }

      setWeekData({
        ...weekData,
        weeklyHours,
        dailyBreakdown
      });
      
    } catch (error) {
      console.error('Error fetching weekly summary:', error);
      setError('Failed to load weekly summary. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Generate a summary of the weekly activities
  async function generateSummary() {
    if (weekData.dailyBreakdown.length === 0 || weekData.weeklyHours === 0) {
      setError('No daily logs found for this week');
      return;
    }
    
    setIsGenerating(true);
    setError('');
    
    try {
      if (useAI) {
        // Use AI to generate summary
        const aiSummary = await AIService.generateSummary(weekData, aiProvider);
        setSummary(aiSummary);
      } else {
        // Create a manual structured summary based on daily logs
        let summaryText = `Weekly Summary: ${format(weekData.weekStart, 'MMMM d')} - ${format(weekData.weekEnd, 'MMMM d, yyyy')}\n\n`;
        summaryText += `Total Hours: ${weekData.weeklyHours.toFixed(2)}\n\n`;
        summaryText += `Daily Activities:\n\n`;
        
        weekData.dailyBreakdown.forEach(day => {
          if (day.hasLog) {
            summaryText += `${day.formattedDate} - ${day.hours} hours\n`;
            if (day.notes && day.notes.trim()) {
              summaryText += `Activities: ${day.notes}\n`;
            }
            summaryText += '\n';
          }
        });
        
        setSummary(summaryText);
      }
      setSuccess(true);
    } catch (error) {
      console.error('Error generating summary:', error);
      setError(`Failed to generate summary: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  // Save the generated summary to a weekly journal
  async function saveToJournal() {
    if (!summary) {
      setError('Please generate a summary first');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      const formattedWeekStart = formatDate(weekData.weekStart);
      
      if (hasJournal) {
        // Update existing journal
        const { error } = await supabase
          .from('weekly_journals')
          .update({
            journal_text: summary,
            updated_at: new Date().toISOString()
          })
          .eq('id', journalId);
        
        if (error) throw error;
      } else {
        // Create new journal
        const { error } = await supabase
          .from('weekly_journals')
          .insert([
            {
              user_id: user.id,
              week_start_date: formattedWeekStart,
              journal_text: summary
            }
          ]);
        
        if (error) throw error;
      }
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/journals');
      }, 2000);
      
    } catch (error) {
      console.error('Error saving to journal:', error);
      setError(error.message || 'Failed to save journal');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 py-6 animate-fade-in">
      {/* Hero Section */}
      <div className="glassmorphism p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-b from-primary-300 to-purple-300 rounded-full filter blur-3xl opacity-20 -mr-20 -mt-20 animate-pulse-slow"></div>
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-gradient-to-t from-blue-300 to-primary-300 rounded-full filter blur-3xl opacity-20 -ml-20 -mb-20 animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-extrabold gradient-text">Weekly Summary</h1>
            <DarkModeToggle />
          </div>
          
          {/* Week Navigation */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <button
              onClick={() => navigateWeek('prev')}
              className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-dark-surface/30 transition-colors duration-200 hover-scale"
            >
              <ChevronLeftIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </button>
            
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white px-4 py-2 bg-white/50 dark:bg-dark-surface/50 rounded-lg backdrop-blur-sm">
              {formatDateRange(weekData.weekStart, weekData.weekEnd)}
            </h2>
            
            <button
              onClick={() => navigateWeek('next')}
              className="p-2 rounded-full hover:bg-white/30 dark:hover:bg-dark-surface/30 transition-colors duration-200 hover-scale"
            >
              <ChevronRightIcon className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 animate-pulse">
          <div className="h-24 w-24 rounded-full border-t-4 border-b-4 border-primary-600 animate-spin"></div>
        </div>
      ) : error ? (
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Stats */}
          <div className="lg:col-span-1 space-y-6">
            {/* Weekly Hours Card */}
            <div className="glassmorphism p-6 hover-lift transition-all duration-300">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-lg">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Weekly Hours</p>
                  <p className="text-3xl font-extrabold text-gray-800 dark:text-white">{weekData.weeklyHours.toFixed(2)}</p>
                </div>
              </div>
            </div>
            
            {/* AI Options Card */}
            <div className="glassmorphism p-6 hover-lift transition-all duration-300">
              <h3 className="text-lg font-semibold gradient-text mb-4">Generation Options</h3>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="useAI"
                    checked={useAI}
                    onChange={(e) => setUseAI(e.target.checked)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useAI" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Use AI to enhance summary
                  </label>
                </div>
                
                {useAI && (
                  <div className="ml-6 space-y-3">
                    <p className="text-xs text-gray-500 dark:text-gray-400">Select AI Provider:</p>
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center p-2 rounded-lg hover:bg-white/30 dark:hover:bg-dark-surface/30">
                        <input
                          type="radio"
                          id="providerGemini"
                          name="aiProvider"
                          value="gemini"
                          checked={aiProvider === 'gemini'}
                          onChange={() => setAiProvider('gemini')}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <label htmlFor="providerGemini" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Gemini
                        </label>
                      </div>
                      <div className="flex items-center p-2 rounded-lg hover:bg-white/30 dark:hover:bg-dark-surface/30">
                        <input
                          type="radio"
                          id="providerOpenAI"
                          name="aiProvider"
                          value="openai"
                          checked={aiProvider === 'openai'}
                          onChange={() => setAiProvider('openai')}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                        />
                        <label htmlFor="providerOpenAI" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          OpenAI
                        </label>
                      </div>
                    </div>
                  </div>
                )}
                
                <button
                  onClick={generateSummary}
                  disabled={isGenerating || weekData.weeklyHours === 0}
                  className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-lg hover:from-primary-700 hover:to-primary-800 transition-all transform hover:scale-105 shadow-md disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </span>
                  ) : (
                    `Generate Summary${useAI ? ' with ' + (aiProvider === 'gemini' ? 'Gemini' : 'OpenAI') : ''}`
                  )}
                </button>
                
                <button
                  onClick={saveToJournal}
                  disabled={loading || !summary}
                  className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 shadow-md disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {hasJournal ? 'Update Journal' : 'Save to Journal'}
                </button>
              </div>
              
              {success && (
                <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md border border-green-200 dark:border-green-800 animate-fade-in">
                  {hasJournal ? 'Journal updated successfully!' : 'Journal created successfully!'}
                </div>
              )}
            </div>
          </div>
          
          {/* Right Column - Activity Table and Summary */}
          <div className="lg:col-span-2 space-y-6">
            {/* Daily Activity Card */}
            <div className="glassmorphism p-6 hover-lift transition-all duration-300">
              <h3 className="text-lg font-semibold gradient-text flex items-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Daily Activities
              </h3>
              
              {weekData.dailyBreakdown.some(day => day.hasLog) ? (
                <div className="overflow-hidden rounded-lg">
                  <div className="max-h-96 overflow-y-auto custom-scrollbar">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-white/50 dark:bg-dark-surface/50 sticky top-0 backdrop-blur-sm">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Day
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Hours
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Notes
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/30 dark:bg-dark-surface/30 backdrop-blur-sm divide-y divide-gray-200 dark:divide-gray-700">
                        {weekData.dailyBreakdown.map((day, index) => (
                          <tr 
                            key={index} 
                            className={`${!day.hasLog ? "bg-gray-50/50 dark:bg-dark-surface/50" : "hover:bg-white/50 dark:hover:bg-white/10"} transition-colors duration-150 animate-slide-up`}
                            style={{ animationDelay: `${index * 0.05}s` }}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                              {day.formattedDate}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              {day.hours > 0 ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900/30 dark:text-primary-300">
                                  {day.hours.toFixed(2)} hours
                                </span>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 italic">No log</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {day.notes ? (
                                <div className="max-h-20 overflow-y-auto custom-scrollbar">
                                  {day.notes}
                                </div>
                              ) : (
                                <span className="text-gray-400 dark:text-gray-500 italic">No notes</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 animate-fade-in">
                  <div className="bg-gray-50 dark:bg-gray-800/30 p-6 rounded-full inline-block mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="mt-2 text-xl font-bold text-gray-900 dark:text-white">No logs for this week</h3>
                  <p className="mt-1 text-base text-gray-500 dark:text-gray-400">Add daily logs first to generate a weekly summary.</p>
                </div>
              )}
            </div>
            
            {/* Summary Card */}
            {summary && (
              <div className="glassmorphism p-6 hover-lift transition-all duration-300 animate-slide-up">
                <h3 className="text-lg font-semibold gradient-text flex items-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" />
                  </svg>
                  Weekly Summary
                </h3>
                <div className="bg-white/30 dark:bg-dark-surface/30 backdrop-blur-sm p-4 rounded-lg border border-gray-200/50 dark:border-gray-700/50 whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 max-h-96 overflow-y-auto custom-scrollbar">
                  {summary}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default WeeklySummary; 