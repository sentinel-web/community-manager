/* global describe, it */
import assert from 'node:assert';

// Use require() to avoid circular dependency issues during module initialization.
function loadHelpers() {
  return require('../../server/apis/questionnaireResponses.server');
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const TOLERANCE_MS = 1000; // 1 second tolerance for timing

describe('getIntervalCutoffDate', () => {
  it('returns null for null input', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    assert.strictEqual(getIntervalCutoffDate(null), null);
  });

  it('returns null for undefined input', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    assert.strictEqual(getIntervalCutoffDate(undefined), null);
  });

  it('returns null for empty string', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    assert.strictEqual(getIntervalCutoffDate(''), null);
  });

  it('returns null for "once"', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    assert.strictEqual(getIntervalCutoffDate('once'), null);
  });

  it('returns epoch date for "unlimited"', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    const result = getIntervalCutoffDate('unlimited');
    assert.strictEqual(result.getTime(), 0);
  });

  it('returns ~24 hours ago for "daily"', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    const before = Date.now() - ONE_DAY_MS;
    const result = getIntervalCutoffDate('daily');
    const after = Date.now() - ONE_DAY_MS;
    assert.ok(result instanceof Date);
    assert.ok(Math.abs(result.getTime() - before) < TOLERANCE_MS);
  });

  it('returns ~7 days ago for "weekly"', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    const expected = Date.now() - 7 * ONE_DAY_MS;
    const result = getIntervalCutoffDate('weekly');
    assert.ok(result instanceof Date);
    assert.ok(Math.abs(result.getTime() - expected) < TOLERANCE_MS);
  });

  it('returns ~30 days ago for "monthly"', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    const expected = Date.now() - 30 * ONE_DAY_MS;
    const result = getIntervalCutoffDate('monthly');
    assert.ok(result instanceof Date);
    assert.ok(Math.abs(result.getTime() - expected) < TOLERANCE_MS);
  });

  it('returns null for unknown interval', () => {
    const { getIntervalCutoffDate } = loadHelpers();
    assert.strictEqual(getIntervalCutoffDate('biweekly'), null);
  });
});
