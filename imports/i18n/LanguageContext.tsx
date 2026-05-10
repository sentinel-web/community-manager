import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { locales, defaultLocale, getTranslation, translateDynamic, type Locale, type LocaleInfo, type LocaleKey, type ParamArgs } from './index';

const STORAGE_KEY = 'community-manager-language';

export interface LanguageContextValue {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  t: <K extends LocaleKey>(key: K, ...args: ParamArgs<K>) => string;
  tDynamic: (key: string, params?: Record<string, string | number>) => string;
  locales: Record<Locale, LocaleInfo>;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved in locales) {
        return saved as Locale;
      }
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang && browserLang in locales) {
        return browserLang as Locale;
      }
    }
    return defaultLocale;
  });

  const setLanguage = useCallback((lang: Locale) => {
    if (lang in locales) {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.setAttribute('lang', lang);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
    }
  }, [language]);

  const t = useMemo<LanguageContextValue['t']>(
    () =>
      function t<K extends LocaleKey>(key: K, ...args: ParamArgs<K>): string {
        return getTranslation(key, language, ...args);
      },
    [language],
  );

  const tDynamic = useCallback<LanguageContextValue['tDynamic']>(
    (key, params) => translateDynamic(key, language, params),
    [language],
  );

  const value: LanguageContextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      tDynamic,
      locales,
    }),
    [language, setLanguage, t, tDynamic],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

export function useTranslation(): { t: LanguageContextValue['t']; tDynamic: LanguageContextValue['tDynamic'] } {
  const { t, tDynamic } = useLanguage();
  return { t, tDynamic };
}

export default LanguageContext;
