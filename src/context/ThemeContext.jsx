import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem('ews-theme') || 'system');
  const [resolved, setResolved] = useState('dark');

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const resolve = () => {
      if (mode === 'system') setResolved(mq.matches ? 'dark' : 'light');
      else setResolved(mode);
    };
    resolve();
    mq.addEventListener('change', resolve);
    return () => mq.removeEventListener('change', resolve);
  }, [mode]);

  useEffect(() => {
    localStorage.setItem('ews-theme', mode);
    document.documentElement.setAttribute('data-theme', resolved);
  }, [mode, resolved]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, resolved }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
