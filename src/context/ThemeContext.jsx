import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem('memoria_theme') || 'dark');
  const [retroMode, setRetroMode] = useState(() => localStorage.getItem('memoria_retro') === 'true');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('memoria_theme', theme);
  }, [theme]);

  useEffect(() => {
    if (retroMode) {
      document.documentElement.classList.add('retro-mode');
    } else {
      document.documentElement.classList.remove('retro-mode');
    }
    localStorage.setItem('memoria_retro', retroMode);
  }, [retroMode]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const toggleRetro = () => setRetroMode(r => !r);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, retroMode, toggleRetro }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
