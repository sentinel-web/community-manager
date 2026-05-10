import assert from 'node:assert';
import { frecencyScore } from '../../imports/ui/palette/palette.recents';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('frecencyScore', () => {
  const now = Date.now();

  it('higher count outranks lower count when timestamps are equal', () => {
    const a = frecencyScore({ ts: now, count: 5 }, now);
    const b = frecencyScore({ ts: now, count: 1 }, now);
    assert.ok(a > b, `expected count=5 (${a}) to outrank count=1 (${b})`);
  });

  it('more-recent timestamp outranks older when counts are equal', () => {
    const recent = frecencyScore({ ts: now - DAY_MS, count: 1 }, now);
    const stale = frecencyScore({ ts: now - 7 * DAY_MS, count: 1 }, now);
    assert.ok(recent > stale, `expected recent (${recent}) > stale (${stale})`);
  });

  it('1-day-old count=2 outranks 7-day-old count=1', () => {
    const a = frecencyScore({ ts: now - 1 * DAY_MS, count: 2 }, now);
    const b = frecencyScore({ ts: now - 7 * DAY_MS, count: 1 }, now);
    assert.ok(a > b, `expected fresh frequent (${a}) to outrank stale rare (${b})`);
  });

  it('decays toward zero for very old entries', () => {
    const ancient = frecencyScore({ ts: now - 365 * DAY_MS, count: 50 }, now);
    assert.ok(ancient < 0.001, `expected near-zero score for 1-year-old entry, got ${ancient}`);
  });

  it('returns positive scores for valid entries', () => {
    const score = frecencyScore({ ts: now, count: 1 }, now);
    assert.ok(score > 0, `expected positive score, got ${score}`);
  });
});
