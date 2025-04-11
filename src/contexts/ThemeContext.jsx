import { createContext, useContext, useState, useEffect } from 'react';

// Create context
const ThemeContext = createContext();

// Hook to use the theme context
export function useTheme() {
  return useContext(ThemeContext);
}

// Theme provider component
export function ThemeProvider({ children }) {
  // Check if dark mode is saved in local storage or use system preference
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme;
    }
    // Check system preference
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setTheme] = useState(getInitialTheme);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Toggle between light and dark mode
  const toggleTheme = () => {
    setIsTransitioning(true);
    
    setTheme(prevTheme => {
      const newTheme = prevTheme === 'light' ? 'dark' : 'light';
      localStorage.setItem('theme', newTheme);
      return newTheme;
    });
    
    // Allow time for transition to complete
    setTimeout(() => {
      setIsTransitioning(false);
    }, 300);
  };

  // Apply theme to the document
  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove the previous theme
    root.classList.remove('light', 'dark');
    
    // Add the current theme
    root.classList.add(theme);
    
    // Add transition styles to smooth theme changes
    root.style.transition = 'background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease';
  }, [theme]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const handleChange = () => {
      if (!localStorage.getItem('theme')) {
        setIsTransitioning(true);
        setTheme(mediaQuery.matches ? 'dark' : 'light');
        
        // Allow time for transition to complete
        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Provide theme context to children
  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isTransitioning }}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext; 