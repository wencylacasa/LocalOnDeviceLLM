/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { createContext, useContext } from 'react';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * Forces a light or dark palette for everything below the provider, regardless
 * of the device setting. Used by AI-generated dashboards that ask for a theme.
 */
export const ThemeOverrideContext = createContext<'light' | 'dark' | null>(null);

export function useTheme() {
  const scheme = useColorScheme();
  const override = useContext(ThemeOverrideContext);
  const theme = override ?? (scheme === 'dark' ? 'dark' : 'light');

  return Colors[theme];
}
