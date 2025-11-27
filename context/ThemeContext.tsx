import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { ThemeMode, CustomThemeColors } from '../types';
import { appConfig } from '../config/appConfig';

interface ThemeContextType {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode, customColors?: CustomThemeColors) => void;
  customColors?: CustomThemeColors;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, updateProfile } = useAuth();
  
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('gemini_diary_theme');
    return (saved as ThemeMode) || 'system';
  });

  const [customColors, setCustomColors] = useState<CustomThemeColors>(appConfig.defaults.customColors);

  // Sync with user profile on login
  useEffect(() => {
    if (user?.preferences?.theme) {
      setThemeState(user.preferences.theme);
      if (user.preferences.customColors) {
        setCustomColors(user.preferences.customColors);
      }
    }
  }, [user]);

  // Apply Theme Logic
  useEffect(() => {
    const root = window.document.documentElement;
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    
    // Clean up previous classes and styles
    root.classList.remove('dark', 'light', 'high-contrast', 'custom-theme');
    const existingStyle = document.getElementById('gemini-theme-styles');
    if (existingStyle) existingStyle.remove();

    const applySystem = () => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    if (theme === 'system') {
      applySystem();
      // Listen for changes
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => applySystem();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } 
    else if (theme === 'dark') {
      root.classList.add('dark');
    } 
    else if (theme === 'light') {
      root.classList.remove('dark');
    }
    else if (theme === 'high-contrast') {
       root.classList.add('dark', 'high-contrast'); // Base on dark for tailwind compatibility
       injectHighContrastStyles();
    }
    else if (theme === 'custom') {
       root.classList.add('custom-theme');
       // We add 'dark' if the background is dark to help generic tailwind utilities
       // behave better (like white text on hover), but our custom CSS will override main colors.
       if (isDarkColor(customColors.background)) {
           root.classList.add('dark');
       } else {
           root.classList.remove('dark');
       }
       injectCustomStyles(customColors);
    }

    localStorage.setItem('gemini_diary_theme', theme);
  }, [theme, customColors]);

  const setTheme = (newTheme: ThemeMode, newColors?: CustomThemeColors) => {
    setThemeState(newTheme);
    if (newColors) setCustomColors(newColors);

    if (user) {
      updateProfile({
        preferences: {
          ...user.preferences,
          theme: newTheme,
          customColors: newColors || user.preferences.customColors || customColors
        }
      });
    }
  };

  // Helper: Hex to RGB for contrast calculation
  const isDarkColor = (hex: string) => {
      const c = hex.substring(1);      // strip #
      const rgb = parseInt(c, 16);   // convert rrggbb to decimal
      const r = (rgb >> 16) & 0xff;  // extract red
      const g = (rgb >>  8) & 0xff;  // extract green
      const b = (rgb >>  0) & 0xff;  // extract blue
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709
      return luma < 128;
  };

  const injectHighContrastStyles = () => {
    const style = document.createElement('style');
    style.id = 'gemini-theme-styles';
    style.innerHTML = `
      :root {
        --hc-bg: #000000;
        --hc-text: #ffff00;
        --hc-border: #ffffff;
        --hc-accent: #00ffff;
      }
      .high-contrast body, 
      .high-contrast main,
      .high-contrast .bg-slate-50, 
      .high-contrast .bg-slate-950,
      .high-contrast .dark\\:bg-slate-950 {
        background-color: var(--hc-bg) !important;
        color: var(--hc-text) !important;
      }
      .high-contrast .bg-white, 
      .high-contrast .dark\\:bg-slate-900,
      .high-contrast .bg-white\\/80 {
        background-color: #000000 !important;
        border: 2px solid var(--hc-border) !important;
      }
      .high-contrast h1, .high-contrast h2, .high-contrast h3, .high-contrast p, .high-contrast span, .high-contrast div {
        color: var(--hc-text) !important;
      }
      .high-contrast button {
        border: 2px solid var(--hc-border) !important;
        color: var(--hc-text) !important;
      }
      .high-contrast .bg-indigo-600, .high-contrast .text-indigo-600 {
        background-color: var(--hc-bg) !important;
        color: var(--hc-accent) !important;
        border-color: var(--hc-accent) !important;
      }
      .high-contrast input, .high-contrast textarea {
         background-color: #000000 !important;
         color: #ffffff !important;
         border: 2px solid #ffffff !important;
      }
    `;
    document.head.appendChild(style);
  };

  const injectCustomStyles = (colors: CustomThemeColors) => {
    const style = document.createElement('style');
    style.id = 'gemini-theme-styles';
    style.innerHTML = `
      :root {
        --custom-bg: ${colors.background};
        --custom-surface: ${colors.surface};
        --custom-text: ${colors.text};
        --custom-primary: ${colors.primary};
      }
      /* Main Backgrounds */
      .custom-theme body, 
      .custom-theme .bg-slate-50, 
      .custom-theme .dark\\:bg-slate-950,
      .custom-theme .bg-slate-950 {
        background-color: var(--custom-bg) !important;
        color: var(--custom-text) !important;
      }
      
      /* Surfaces (Cards, Sidebar) */
      .custom-theme .bg-white,
      .custom-theme .dark\\:bg-slate-900,
      .custom-theme .bg-white\\/80,
      .custom-theme .bg-slate-100,
      .custom-theme .bg-slate-50 {
         background-color: var(--custom-surface) !important;
         color: var(--custom-text) !important;
         border-color: color-mix(in srgb, var(--custom-text) 10%, transparent) !important;
      }

      /* Text */
      .custom-theme .text-slate-900,
      .custom-theme .dark\\:text-slate-200,
      .custom-theme .text-slate-500,
      .custom-theme .dark\\:text-slate-400 {
        color: var(--custom-text) !important;
      }

      /* Primary Elements (Buttons, Icons) */
      .custom-theme .bg-indigo-600 {
        background-color: var(--custom-primary) !important;
      }
      .custom-theme .text-indigo-600,
      .custom-theme .text-indigo-500,
      .custom-theme .dark\\:text-indigo-400 {
        color: var(--custom-primary) !important;
      }
      
      /* Inputs */
      .custom-theme input, .custom-theme textarea, .custom-theme select {
         background-color: var(--custom-surface) !important;
         color: var(--custom-text) !important;
         border-color: color-mix(in srgb, var(--custom-text) 20%, transparent) !important;
      }
    `;
    document.head.appendChild(style);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, customColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};