// ============================================================
// ThemeContext — the app's entire look derives from here.
// Defaults match the Hero brand; after login the org's branding
// is fetched and applied, and the Design Studio can update it
// live (refresh() re-fetches and re-renders every screen).
// ============================================================
import React, { createContext, useContext, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiV1 } from '../api/client';

export const DEFAULT_THEME = {
  app_name: 'Hero One Eleven',
  tagline: 'A community that meets you where you are.',
  primary: '#12123D',
  accent: '#E43024',
  light: '#F4F4F8',
  surface: '#FFFFFF',
  success: '#2FA84F',
  logo_url: null,
  login_background_url: null,
  mascot_url: null,
};

const ThemeContext = createContext({ ...DEFAULT_THEME, refresh: () => {} });
export const useTheme = () => useContext(ThemeContext);

function flatten(branding) {
  return {
    app_name: branding.app_name,
    tagline: branding.tagline,
    ...branding.colors,
    ...branding.images,
  };
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);

  const refresh = useCallback(async () => {
    try {
      const branding = await apiV1.branding();
      const next = { ...DEFAULT_THEME, ...flatten(branding) };
      setTheme(next);
      await AsyncStorage.setItem('theme', JSON.stringify(next));
    } catch {
      // Offline / pre-login: use cached theme if present
      const cached = await AsyncStorage.getItem('theme');
      if (cached) setTheme({ ...DEFAULT_THEME, ...JSON.parse(cached) });
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ ...theme, refresh }}>
      {children}
    </ThemeContext.Provider>
  );
}
