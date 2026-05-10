import assert from 'node:assert';
import { extractParams } from '../../imports/i18n/extract-params';
import { translations, type Locale, type LocaleKey } from '../../imports/i18n';

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function findParamDrift(target: Locale): string[] {
  const failures: string[] = [];
  for (const key of Object.keys(translations) as LocaleKey[]) {
    const enParams = extractParams(translations[key].en);
    const targetParams = extractParams(translations[key][target]);
    if (!setsEqual(enParams, targetParams)) {
      const enList = [...enParams].sort().join(', ') || '(none)';
      const targetList = [...targetParams].sort().join(', ') || '(none)';
      failures.push(`  ${key}: en=[${enList}] ${target}=[${targetList}]`);
    }
  }
  return failures;
}

describe('LocaleSet cross-locale param invariants', () => {
  it('every key has the same {{params}} in de as in en', () => {
    const drift = findParamDrift('de');
    assert.strictEqual(drift.length, 0, `${drift.length} key(s) have placeholder drift between en and de:\n${drift.join('\n')}`);
  });

  it('every key has the same {{params}} in fr as in en', () => {
    const drift = findParamDrift('fr');
    assert.strictEqual(drift.length, 0, `${drift.length} key(s) have placeholder drift between en and fr:\n${drift.join('\n')}`);
  });
});
