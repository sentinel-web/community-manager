import { useContext } from 'react';
import { ThemeContext } from '../app/App';

export type ThemeMode = 'dark' | 'light';

export interface ThemeContextValue {
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}

export function getPreferedTheme(): ThemeMode {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export default function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext) as ThemeContextValue;

  return { theme: value.theme, setTheme: value.setTheme };
}
