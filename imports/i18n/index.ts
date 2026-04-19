import en from './locales/en.json';
import de from './locales/de.json';
import fr from './locales/fr.json';

export type Locale = 'en' | 'de' | 'fr';

export interface TranslationTree {
  [key: string]: string | TranslationTree;
}

export interface LocaleInfo {
  name: string;
  flag: string;
  translations: TranslationTree;
}

export const locales: Record<Locale, LocaleInfo> = {
  en: { name: 'English', flag: '🇬🇧', translations: en as TranslationTree },
  de: { name: 'Deutsch', flag: '🇩🇪', translations: de as TranslationTree },
  fr: { name: 'Français', flag: '🇫🇷', translations: fr as TranslationTree },
};

export const defaultLocale: Locale = 'en';

export type TranslationParams = Record<string, string | number>;

export function getTranslation(translations: TranslationTree, key: string, params: TranslationParams = {}): string {
  const keys = key.split('.');
  let value: string | TranslationTree | undefined = translations;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as TranslationTree)[k];
    } else {
      return key;
    }
  }

  if (typeof value !== 'string') {
    return key;
  }

  return value.replace(/\{\{(\w+)\}\}/g, (_, param: string) => {
    return params[param] !== undefined ? String(params[param]) : `{{${param}}}`;
  });
}
