import assert from 'node:assert';
import { extractParams, assertValidPlaceholders } from '../../imports/i18n/extract-params';
import { translations, locales, defaultLocale, type Locale, type LocaleKey } from '../../imports/i18n';
import { COLLECTION_LABEL_KEYS } from '../../imports/ui/backup/Backup';
import { STATS_LABEL_KEYS, PROFILE_LABEL_KEYS } from '../../imports/ui/dashboard/Dashboard';

// Derived from the runtime `locales` object so adding a fourth language to
// imports/i18n/index.ts automatically grows these tests rather than silently
// leaving the new locale unchecked.
const ALL_LOCALES: readonly Locale[] = Object.keys(locales) as Locale[];
const NON_CANONICAL_LOCALES: readonly Locale[] = ALL_LOCALES.filter(l => l !== defaultLocale);

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

// Each map is the closed translation-key set for a category of dynamic-data keys
// (collection names, stat names, profile field names). These tests fail if a new
// LocaleKey under a covered prefix is added to translations.ts without being
// added to the corresponding map — the alternative would be silent rendering of
// the raw data string at runtime.
function findKeysMissingFromMap(prefix: string, map: Readonly<Record<string, LocaleKey>>): LocaleKey[] {
  const expected = (Object.keys(translations) as LocaleKey[]).filter(k => k.startsWith(prefix));
  const present = new Set<LocaleKey>(Object.values(map));
  return expected.filter(k => !present.has(k));
}

describe('LocaleSet dynamic-key map completeness', () => {
  it('COLLECTION_LABEL_KEYS covers every collections.* LocaleKey', () => {
    const missing = findKeysMissingFromMap('collections.', COLLECTION_LABEL_KEYS);
    assert.deepEqual(missing, [], `Missing from COLLECTION_LABEL_KEYS: ${missing.join(', ')}`);
  });

  it('STATS_LABEL_KEYS covers every dashboard.stats.* LocaleKey', () => {
    const missing = findKeysMissingFromMap('dashboard.stats.', STATS_LABEL_KEYS);
    assert.deepEqual(missing, [], `Missing from STATS_LABEL_KEYS: ${missing.join(', ')}`);
  });

  it('PROFILE_LABEL_KEYS covers every dashboard.profileLabels.* LocaleKey', () => {
    const missing = findKeysMissingFromMap('dashboard.profileLabels.', PROFILE_LABEL_KEYS);
    assert.deepEqual(missing, [], `Missing from PROFILE_LABEL_KEYS: ${missing.join(', ')}`);
  });
});
