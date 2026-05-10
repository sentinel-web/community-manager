import { translations, type Locale } from './translations';
import type { ExtractParams } from './extract-params';

export type { Locale, TranslationSet } from './translations';
export { translations };

export type LocaleKey = keyof typeof translations;

export type ParamArgs<K extends LocaleKey> = keyof ExtractParams<(typeof translations)[K]['en']> extends never
  ? []
  : [params: ExtractParams<(typeof translations)[K]['en']>];

export interface LocaleInfo {
  name: string;
  flag: string;
}

export const locales: Record<Locale, LocaleInfo> = {
  en: { name: 'English', flag: '🇬🇧' },
  de: { name: 'Deutsch', flag: '🇩🇪' },
  fr: { name: 'Français', flag: '🇫🇷' },
};

export const defaultLocale: Locale = 'en';

const PLACEHOLDER_PATTERN = /\{\{(\w+)\}\}/g;

function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(PLACEHOLDER_PATTERN, (_, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{{${name}}}`,
  );
}

export function getTranslation<K extends LocaleKey>(key: K, locale: Locale, ...args: ParamArgs<K>): string {
  const value = translations[key][locale];
  const params = (args[0] ?? {}) as Record<string, string | number>;
  return interpolate(value, params);
}
