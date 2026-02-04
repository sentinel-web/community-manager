import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

export const locales = {
  en: { name: 'English', flag: '🇬🇧', translations: en },
  de: { name: 'Deutsch', flag: '🇩🇪', translations: de },
  fr: { name: 'Français', flag: '🇫🇷', translations: fr },
};

export const defaultLocale = 'en';

/**
 * Get a nested translation value by dot-notation key
 * @param {object} translations - The translations object
 * @param {string} key - Dot-notation key like 'navigation.dashboard'
 * @param {object} params - Optional interpolation parameters
 * @returns {string} The translated string or the key if not found
 */
export function getTranslation(translations, key, params = {}) {
  const keys = key.split('.');
  let value = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  // Handle interpolation {{param}}
  return value.replace(/\{\{(\w+)\}\}/g, (_, param) => {
    return params[param] !== undefined ? params[param] : `{{${param}}}`;
  });
}
