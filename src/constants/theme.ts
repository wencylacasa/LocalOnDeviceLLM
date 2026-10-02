/**
 * Premium Theme Configuration for LocalAI
 */

import '@/global.css';
import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1C1E',
    background: '#F2F2F7',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E5E5EA',
    textSecondary: '#8E8E93',
    primary: '#5E5CE6', // Premium Indigo
    primaryLight: '#5E5CE622',
  },
  dark: {
    text: '#F2F2F7',
    background: '#000000',
    backgroundElement: '#1C1C1E',
    backgroundSelected: '#2C2C2E',
    textSecondary: '#98989D',
    primary: '#5E5CE6', // Premium Indigo
    primaryLight: '#5E5CE633',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
