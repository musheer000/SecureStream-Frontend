import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  // Semantic color helpers
  colors: {
    bg: string;
    bgSecondary: string;
    surface: string;
    surfaceHover: string;
    border: string;
    text: string;
    textSub: string;
    textMuted: string;
    navBg: string;
    sidebarBg: string;
    accent: string;
  };
}

const DARK = {
  bg: '#060d1a',
  bgSecondary: '#0b1120',
  surface: 'rgba(15,23,42,0.98)',
  surfaceHover: 'rgba(30,41,59,0.95)',
  border: 'rgba(56,189,248,0.12)',
  text: '#e2e8f0',
  textSub: '#94a3b8',
  textMuted: '#475569',
  navBg: 'rgba(9,21,37,0.97)',
  sidebarBg: 'linear-gradient(180deg,#0f172a,#0b1120)',
  accent: '#38bdf8',
};

const LIGHT = {
  bg: '#f0f4f8',
  bgSecondary: '#e8eef5',
  surface: '#ffffff',
  surfaceHover: '#f8fafc',
  border: 'rgba(56,189,248,0.25)',
  text: '#0f172a',
  textSub: '#475569',
  textMuted: '#94a3b8',
  navBg: '#0f172a',
  sidebarBg: 'linear-gradient(180deg,#0f172a,#1e293b)',
  accent: '#0ea5e9',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('securestream_theme') as Theme) || 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('securestream_theme', next);
      return next;
    });
  };

  const isDark = theme === 'dark';
  const colors = isDark ? DARK : LIGHT;

  // Apply global background and CSS variables
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.style.setProperty('--bg-primary', '#090d16');
      root.style.setProperty('--bg-secondary', '#0f172a');
      root.style.setProperty('--bg-card', '#131c31');
      root.style.setProperty('--bg-card-hover', '#1e293b');
      root.style.setProperty('--bg-glass', 'rgba(19, 28, 49, 0.7)');
      root.style.setProperty('--text-primary', '#f8fafc');
      root.style.setProperty('--text-secondary', '#94a3b8');
      root.style.setProperty('--text-muted', '#64748b');
      root.style.setProperty('--border-glow', 'rgba(51, 65, 85, 0.6)');
      root.style.setProperty('--border-accent', 'rgba(6, 182, 212, 0.3)');
    } else {
      root.style.setProperty('--bg-primary', '#f0f4f8');
      root.style.setProperty('--bg-secondary', '#e8eef5');
      root.style.setProperty('--bg-card', '#ffffff');
      root.style.setProperty('--bg-card-hover', '#f8fafc');
      root.style.setProperty('--bg-glass', 'rgba(255, 255, 255, 0.7)');
      root.style.setProperty('--text-primary', '#0f172a');
      root.style.setProperty('--text-secondary', '#475569');
      root.style.setProperty('--text-muted', '#94a3b8');
      root.style.setProperty('--border-glow', 'rgba(148, 163, 184, 0.5)');
      root.style.setProperty('--border-accent', 'rgba(14, 165, 233, 0.5)');
    }
    
    document.body.style.background = colors.bg;
    document.body.style.color = colors.text;
  }, [theme, isDark, colors]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
