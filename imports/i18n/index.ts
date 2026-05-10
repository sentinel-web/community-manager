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

// Escape hatch for sites that compute the key dynamically (e.g. `collections.${name}`).
// Returns the key string verbatim if it isn't in the unified source — preserves the
// pre-cutover defensive behavior at sites that can't statically prove their key set.
// Prefer `getTranslation` (or the typed `t` from useTranslation) wherever the key is
// known statically.
export function translateDynamic(key: string, locale: Locale, params: Record<string, string | number> = {}): string {
  const entry = (translations as Record<string, Record<Locale, string> | undefined>)[key];
  if (!entry) return key;
  return interpolate(entry[locale], params);
}
