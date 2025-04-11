import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

function DailyLogForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!date || !hours) {
      setError('Please enter both date and hours');
      return;
    }
    
    const hoursNum = parseFloat(hours);
    if (isNaN(hoursNum) || hoursNum <= 0 || hoursNum > 24) {
      setError('Hours must be a positive number between 0 and 24');
      return;
    }
    
    try {
      setError('');
      setLoading(true);
      
      // Check if this would exceed the 500 hour limit
      const { data: totalData, error: totalError } = await supabase
        .from('daily_logs')
        .select('hours_worked')
        .eq('user_id', user.id);
      
      if (totalError) throw totalError;
      
      const currentTotal = totalData.reduce((sum, log) => sum + parseFloat(log.hours_worked), 0);
      if (currentTotal + hoursNum > 500) {
        throw new Error(`This entry would exceed the 500 hour limit. You have ${500 - currentTotal} hours remaining.`);
      }
      
      // Check if there's already an entry for this date
      const { data: existingData, error: existingError } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('date', date)
        .limit(1);
      
      if (existingError) throw existingError;
      
      if (existingData && existingData.length > 0) {
        throw new Error('You already have an entry for this date. Please edit the existing entry instead.');
      }
      
      // Create the log object
      const logData = {
        user_id: user.id,
        date,
        hours_worked: hoursNum,
        notes
      };
      
      // Insert the new log
      const { data, error: insertError } = await supabase
        .from('daily_logs')
        .insert([logData])
        .select();
      
      if (insertError) throw insertError;
      
      setSuccess(true);
      setTimeout(() => {
        navigate('/logs');
      }, 2000);
      
    } catch (error) {
      console.error('Error adding daily log:', error);
      setError(error.message || 'Failed to add daily log');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 animate-fade-in">
      <div className="flex flex-col md:flex-row items-start justify-between mb-10">
        <div>
          <h1 className="text-4xl font-extrabold gradient-text mb-2">Daily Activity Log</h1>
          <p className="text-gray-600 dark:text-gray-300 text-lg">Record your OJT hours and activities</p>
        </div>
        <button
          onClick={() => navigate('/logs')}
          className="mt-4 md:mt-0 btn btn-outline group flex items-center"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 group-hover:-translate-x-1 transition-transform" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          View Log History
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-5 mb-8 rounded-lg shadow-md animate-slide-up">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border-l-4 border-green-500 p-5 mb-8 rounded-lg shadow-md animate-slide-up">
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-green-700 font-medium">Daily log added successfully! Redirecting to log history...</p>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="glassmorphism p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="relative">
              <label htmlFor="date" className="label text-base font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                </svg>
                Select Date
              </label>
              <input
                id="date"
                type="date"
                className="input text-lg py-3 focus:ring-4 focus:ring-primary-300 hover:border-primary-300 transition-all"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
                disabled={loading}
              />
            </div>
            
            <div className="relative">
              <label htmlFor="hours" className="label text-base font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                Hours Worked
              </label>
              <div className="relative">
                <input
                  id="hours"
                  type="number"
                  className="input text-lg py-3 focus:ring-4 focus:ring-primary-300 hover:border-primary-300 transition-all"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  min="0.5"
                  max="24"
                  step="0.5"
                  required
                  disabled={loading}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 font-medium">hrs</span>
              </div>
              <p className="text-sm text-gray-500 mt-2 ml-1 flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 mt-0.5 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Enter hours from 0.5 to 24, in half-hour increments
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="relative h-full">
              <label htmlFor="notes" className="label text-base font-bold flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-primary-600" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
                </svg>
                Activity Details
              </label>
              
              <textarea
                id="notes"
                className="input h-40 text-base focus:ring-4 focus:ring-primary-300 hover:border-primary-300 transition-all w-full"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Describe your activities today in detail..."
                disabled={loading}
              ></textarea>
              <p className="text-xs text-gray-500 mt-2 ml-1 italic flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-primary-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                Be specific about tasks, skills practiced, and what you learned.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-12 flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/logs')}
            className="btn btn-outline px-6"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 text-white px-8 py-3 text-base shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed disabled:from-gray-400 disabled:to-gray-500"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 mr-3 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Saving Log...
              </div>
            ) : 'Save Daily Log'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default DailyLogForm; 