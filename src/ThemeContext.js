import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

/**
 * Global theme: one switch drives every page.
 * - `data-app-theme` on <html> selects the palette defined in App.css
 * - `data-bs-theme` on <html> switches Bootstrap 5.3's own light/dark mode
 * - `theme` exposes raw colours for libraries that cannot read CSS variables (charts)
 */
export const THEME_ORDER = ['dark', 'light', 'vibrant'];

const STORAGE_KEY = 'appTheme';

export const THEMES = {
  dark: {
    name: 'dark',
    label: 'Dark',
    icon: 'bi-moon-stars-fill',
    bs: 'dark',
    meta: '#0e1424',
    primary: '#3dd5f3',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    secondary: '#94a3b8',
    text: '#e6ebf7',
    muted: '#8a97b5',
    card: '#151d33',
    grid: 'rgba(138, 151, 181, 0.22)',
  },
  light: {
    name: 'light',
    label: 'Light',
    icon: 'bi-sun-fill',
    bs: 'light',
    meta: '#f4f6fb',
    primary: '#2f6bff',
    success: '#16a36a',
    warning: '#e09a06',
    danger: '#e5484d',
    secondary: '#64748b',
    text: '#1b2236',
    muted: '#6b7690',
    card: '#ffffff',
    grid: 'rgba(107, 118, 144, 0.22)',
  },
  vibrant: {
    name: 'vibrant',
    label: 'Vibrant',
    icon: 'bi-palette-fill',
    bs: 'light',
    meta: '#fff1cf',
    primary: '#8b5cf6',
    success: '#0d9488',
    warning: '#ea7a10',
    danger: '#e11d48',
    secondary: '#c026d3',
    text: '#2b2140',
    muted: '#7a6a93',
    card: '#fffaf0',
    grid: 'rgba(122, 106, 147, 0.25)',
  },
};

const readStoredTheme = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return THEMES[stored] ? stored : 'dark';
  } catch (err) {
    return 'dark';
  }
};

const ThemeContext = createContext({
  themeName: 'dark',
  theme: THEMES.dark,
  setThemeName: () => {},
  cycleTheme: () => {},
});

export function AppThemeProvider({ children }) {
  const [themeName, setThemeNameState] = useState(readStoredTheme);

  const setThemeName = useCallback((name) => {
    if (!THEMES[name]) return;
    setThemeNameState(name);
    try {
      window.localStorage.setItem(STORAGE_KEY, name);
    } catch (err) {
      /* storage unavailable (private mode): the theme still applies for this session */
    }
  }, []);

  const cycleTheme = useCallback(() => {
    setThemeNameState((current) => {
      const next = THEME_ORDER[(THEME_ORDER.indexOf(current) + 1) % THEME_ORDER.length];
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch (err) {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const t = THEMES[themeName];
    const root = document.documentElement;
    root.setAttribute('data-app-theme', t.name);
    root.setAttribute('data-bs-theme', t.bs);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.meta);
  }, [themeName]);

  const value = useMemo(
    () => ({ themeName, theme: THEMES[themeName], setThemeName, cycleTheme }),
    [themeName, setThemeName, cycleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useAppTheme = () => useContext(ThemeContext);

/* Icon button that cycles dark -> light -> vibrant (used by the shell and the auth pages) */
export function ThemeToggleButton({ className = 'icon-btn' }) {
  const { theme, cycleTheme } = useAppTheme();
  return (
    <button
      type="button"
      className={className}
      onClick={cycleTheme}
      title={`Theme: ${theme.label} (tap to change)`}
      aria-label="Change colour theme"
    >
      <i className={`bi ${theme.icon}`} aria-hidden="true" />
    </button>
  );
}
