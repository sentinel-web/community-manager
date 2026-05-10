import assert from 'node:assert';
import { extractParams, assertValidPlaceholders } from '../../imports/i18n/extract-params';
import { translations, locales, defaultLocale, type Locale, type LocaleKey } from '../../imports/i18n';

const ALL_LOCALES: readonly Locale[] = Object.keys(locales) as Locale[];

// Derived from the runtime `locales` object so adding a fourth language to
// imports/i18n/index.ts automatically grows this test rather than silently
// leaving the new locale unchecked.
const NON_CANONICAL_LOCALES: readonly Locale[] = (Object.keys(locales) as Locale[]).filter(l => l !== defaultLocale);

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function collectDriftMessages(target: Locale): string[] {
  const failures: string[] = [];
  for (const key of Object.keys(translations) as LocaleKey[]) {
    const enParams = extractParams(translations[key][defaultLocale]);
    const targetParams = extractParams(translations[key][target]);
    if (!setsEqual(enParams, targetParams)) {
      const enList = [...enParams].sort().join(', ') || '(none)';
      const targetList = [...targetParams].sort().join(', ') || '(none)';
      failures.push(`  ${key}: ${defaultLocale}=[${enList}] ${target}=[${targetList}]`);
    }
  }
  return failures;
}

describe('LocaleSet cross-locale param invariants', () => {
  for (const target of NON_CANONICAL_LOCALES) {
    it(`every key has the same {{params}} in ${target} as in ${defaultLocale}`, () => {
      const drift = collectDriftMessages(target);
      assert.strictEqual(drift.length, 0, `${drift.length} key(s) have placeholder drift between ${defaultLocale} and ${target}:\n${drift.join('\n')}`);
    });
  }
});

describe('LocaleSet placeholder-syntax invariants', () => {
  for (const locale of ALL_LOCALES) {
    it(`every value in ${locale} uses only valid placeholder names (\\w+)`, () => {
      const failures: string[] = [];
      for (const key of Object.keys(translations) as LocaleKey[]) {
        try {
          assertValidPlaceholders(translations[key][locale], key);
        } catch (e) {
          failures.push(`  ${(e as Error).message}`);
        }
      }
      assert.strictEqual(failures.length, 0, `${failures.length} key(s) in ${locale} have invalid placeholder syntax:\n${failures.join('\n')}`);
    });
  }
});
