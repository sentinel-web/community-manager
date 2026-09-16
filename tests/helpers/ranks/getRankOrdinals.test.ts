import assert from 'node:assert';
import getRankOrdinals from '../../../imports/helpers/ranks/getRankOrdinals';

describe('getRankOrdinals', () => {
  it('returns an empty map for no ranks', () => {
    assert.strictEqual(getRankOrdinals([]).size, 0);
  });

  it('orders a consistent chain highest rank first (top = 0)', () => {
    const ordinals = getRankOrdinals([
      { _id: 'rct', nextRankId: 'pvt' },
      { _id: 'pvt', previousRankId: 'rct', nextRankId: 'cpl' },
      { _id: 'cpl', previousRankId: 'pvt' },
    ]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), { cpl: 0, pvt: 1, rct: 2 });
  });

  it('is independent of input order', () => {
    const ordinals = getRankOrdinals([
      { _id: 'cpl', previousRankId: 'pvt' },
      { _id: 'rct', nextRankId: 'pvt' },
      { _id: 'pvt', previousRankId: 'rct', nextRankId: 'cpl' },
    ]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), { cpl: 0, pvt: 1, rct: 2 });
  });

  it('repairs a one-sided link using previousRankId', () => {
    // pvt lost its nextRankId, but cpl still points back to it.
    const ordinals = getRankOrdinals([{ _id: 'rct', nextRankId: 'pvt' }, { _id: 'pvt' }, { _id: 'cpl', previousRankId: 'pvt' }]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), { cpl: 0, pvt: 1, rct: 2 });
  });

  it('ignores links to ranks that do not exist, leaving the ranks unranked', () => {
    // Neither link survives, so neither rank may claim ordinal 0 — that is the top of a real chain.
    const ordinals = getRankOrdinals([
      { _id: 'rct', nextRankId: 'missing' },
      { _id: 'pvt', previousRankId: 'gone' },
    ]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), {});
  });

  it('ignores self-links, leaving the rank unranked', () => {
    const ordinals = getRankOrdinals([{ _id: 'a', nextRankId: 'a', previousRankId: 'a' }]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), {});
  });

  it('gives an unchained rank no ordinal, so it never outranks the top of a real chain', () => {
    const ordinals = getRankOrdinals([
      { _id: 'rct', nextRankId: 'pvt' },
      { _id: 'pvt', nextRankId: 'cpl' },
      { _id: 'cpl' },
      { _id: 'lone' },
    ]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), { cpl: 0, pvt: 1, rct: 2 });
  });

  it('repairs a malformed chain deterministically, whatever order the ranks arrive in', () => {
    // `top` lost its nextRankId and both `a` and `b` point back at it; the lower _id wins, every run.
    const links = [{ _id: 'top' }, { _id: 'b', previousRankId: 'top' }, { _id: 'a', previousRankId: 'top' }];
    const expected = { a: 0, top: 1 };
    assert.deepStrictEqual(Object.fromEntries(getRankOrdinals(links)), expected);
    assert.deepStrictEqual(Object.fromEntries(getRankOrdinals([...links].reverse())), expected);
  });

  it('leaves ranks in or leading into a cycle without an ordinal', () => {
    const ordinals = getRankOrdinals([
      { _id: 'a', nextRankId: 'b' },
      { _id: 'b', nextRankId: 'c' },
      { _id: 'c', nextRankId: 'b' },
      { _id: 'x', nextRankId: 'y' },
      { _id: 'y' },
    ]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), { x: 1, y: 0 });
  });

  it('handles separate chains independently', () => {
    const ordinals = getRankOrdinals([
      { _id: 'p1', nextRankId: 'p2' },
      { _id: 'p2' },
      { _id: 'z1', nextRankId: 'z2' },
      { _id: 'z2', nextRankId: 'z3' },
      { _id: 'z3' },
    ]);
    assert.deepStrictEqual(Object.fromEntries(ordinals), { p1: 1, p2: 0, z1: 2, z2: 1, z3: 0 });
  });
});
