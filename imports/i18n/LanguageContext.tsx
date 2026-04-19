import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { locales, defaultLocale, getTranslation, type Locale, type LocaleInfo, type TranslationParams } from './index';

const STORAGE_KEY = 'community-manager-language';

export interface LanguageContextValue {
  language: Locale;
  setLanguage: (lang: Locale) => void;
  t: (key: string, params?: TranslationParams) => string;
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

  const translations = useMemo(() => locales[language]?.translations || locales[defaultLocale].translations, [language]);

  const t = useCallback(
    (key: string, params: TranslationParams = {}) => {
      return getTranslation(translations, key, params);
    },
    [translations],
  );

  const value: LanguageContextValue = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      locales,
    }),
    [language, setLanguage, t],
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

export function useTranslation(): { t: LanguageContextValue['t'] } {
  const { t } = useLanguage();
  return { t };
}

export default LanguageContext;
