import { translations, type Locale } from './translations';
import type { ExtractParams } from './extract-params';

export type { Locale, TranslationSet } from './translations';
export { translations };

export type LocaleKey = keyof typeof translations;

export type ParamArgs<K extends LocaleKey> = keyof ExtractParams<(typeof translations)[K]['en']> extends never
  ? []
  : [params: ExtractParams<(typeof translations)[K]['en']>];

export type Translator = <K extends LocaleKey>(key: K, ...args: ParamArgs<K>) => string;

// Subset of LocaleKey for translations that take no interpolation params.
// Use this as the type of label-key fields stored in static config so callers
// can do `t(config.labelKey)` without TS demanding a params argument for the
// (potentially param-taking) keys also living in the LocaleKey union.
export type ParameterlessLocaleKey = {
  [K in LocaleKey]: ParamArgs<K> extends [] ? K : never;
}[LocaleKey];

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
