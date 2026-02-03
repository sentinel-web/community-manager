import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { locales, defaultLocale, getTranslation } from './index';

const STORAGE_KEY = 'community-manager-language';

const LanguageContext = createContext(null);

/**
 * Provider component for language/i18n context
 */
export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    // Try to get saved language from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && locales[saved]) {
        return saved;
      }
      // Try to detect browser language
      const browserLang = navigator.language?.split('-')[0];
      if (browserLang && locales[browserLang]) {
        return browserLang;
      }
    }
    return defaultLocale;
  });

  const setLanguage = useCallback(lang => {
    if (locales[lang]) {
      setLanguageState(lang);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, lang);
        document.documentElement.setAttribute('lang', lang);
      }
    }
  }, []);

  // Update HTML lang attribute on mount and language change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('lang', language);
    }
  }, [language]);

  const translations = useMemo(() => locales[language]?.translations || locales[defaultLocale].translations, [language]);

  /**
   * Translation function
   * @param {string} key - Dot-notation key like 'navigation.dashboard'
   * @param {object} params - Optional interpolation parameters
   * @returns {string} Translated string
   */
  const t = useCallback(
    (key, params = {}) => {
      return getTranslation(translations, key, params);
    },
    [translations]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      locales,
    }),
    [language, setLanguage, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

LanguageProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

/**
 * Hook to access language context
 * @returns {{ language: string, setLanguage: function, t: function, locales: object }}
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

/**
 * Hook for translations only (shorthand)
 * @returns {function} Translation function t(key, params)
 */
export function useTranslation() {
  const { t } = useLanguage();
  return t;
}

export default LanguageContext;
