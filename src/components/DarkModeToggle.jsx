import { useTheme } from '../contexts/ThemeContext';

function DarkModeToggle() {
  const { theme, toggleTheme, isTransitioning } = useTheme();
  
  return (
    <button
      onClick={toggleTheme}
      className={`
        relative inline-flex items-center justify-center p-2 rounded-full 
        ${theme === 'dark' 
          ? 'bg-gray-700 text-yellow-300 hover:bg-gray-600' 
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
        }
        focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm
        transition-all duration-300 ease-in-out transform
        ${isTransitioning ? 'scale-90' : 'scale-100'}
      `}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      disabled={isTransitioning}
    >
      <div className="relative w-5 h-5 overflow-hidden">
        {theme === 'dark' ? (
          // Sun icon with animation
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`absolute inset-0 h-5 w-5 transition-transform duration-300 ${isTransitioning ? '-rotate-90 scale-0' : 'rotate-0 scale-100'}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
          </svg>
        ) : (
          // Moon icon with animation
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`absolute inset-0 h-5 w-5 transition-transform duration-300 ${isTransitioning ? 'rotate-90 scale-0' : 'rotate-0 scale-100'}`} 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
          </svg>
        )}
      </div>
      
      {/* Optional: Small indicator showing theme name */}
      <span className="sr-only">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
    </button>
  );
}

export default DarkModeToggle; 