import assert from 'node:assert';
import { findUnstableValue } from '/imports/ui/hooks/useStableValue';

// useStableValue compares with EJSON.equals, which is blind in two ways:
// every RegExp serializes to the same empty object (so a changed pattern would
// be swallowed — exactly the stale-filter bug #358 fixed), and no two functions
// are ever equal (so the hook would churn instead of stabilising). The dev-only
// guard rejects both before either can be mistaken for a working filter.
describe('findUnstableValue — useStableValue contract guard (#358)', () => {
  it('accepts the values EJSON compares by content', () => {
    assert.strictEqual(findUnstableValue({ name: { $regex: 'op', $options: 'i' }, start: { $lte: new Date() } }), null);
    assert.strictEqual(findUnstableValue({ eventType: { $in: ['a', 'b'] }, limit: 20, ready: true, none: null }), null);
    assert.strictEqual(findUnstableValue(undefined), null);
  });

  it('reports a RegExp with its path', () => {
    assert.strictEqual(findUnstableValue(/op/i), 'value (RegExp)');
    assert.strictEqual(findUnstableValue({ name: /op/i }), 'name (RegExp)');
    assert.strictEqual(findUnstableValue({ $or: [{ hosts: 'u1' }, { name: /op/i }] }), '$or.1.name (RegExp)');
  });

  it('reports a function with its path', () => {
    assert.strictEqual(findUnstableValue({ sort: () => 0 }), 'sort (function)');
  });

  it('terminates on a cyclic value instead of recursing forever', () => {
    const cyclic: Record<string, unknown> = { name: 'a' };
    cyclic.self = cyclic;

    assert.strictEqual(findUnstableValue(cyclic), null);
  });
});
