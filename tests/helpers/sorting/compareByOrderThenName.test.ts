import assert from 'node:assert';
import compareByOrderThenName from '../../../imports/helpers/sorting/compareByOrderThenName';

describe('compareByOrderThenName', () => {
  it('sorts by order ascending', () => {
    const sorted = [
      { name: 'C', order: 3 },
      { name: 'A', order: 1 },
      { name: 'B', order: 2 },
    ].sort(compareByOrderThenName);
    assert.deepStrictEqual(
      sorted.map(s => s.name),
      ['A', 'B', 'C']
    );
  });

  it('places items without an order last', () => {
    const sorted = [{ name: 'A' }, { name: 'B', order: 5 }, { name: 'C', order: null }, { name: 'D', order: 0 }].sort(compareByOrderThenName);
    assert.deepStrictEqual(
      sorted.map(s => s.name),
      ['D', 'B', 'A', 'C']
    );
  });

  it('breaks ties by name', () => {
    const sorted = [{ name: 'Charlie', order: 1 }, { name: 'Alpha', order: 1 }, { name: 'Bravo' }, { name: 'Able' }].sort(compareByOrderThenName);
    assert.deepStrictEqual(
      sorted.map(s => s.name),
      ['Alpha', 'Charlie', 'Able', 'Bravo']
    );
  });

  it('treats a missing name as empty', () => {
    assert.ok(compareByOrderThenName({ name: undefined }, { name: 'A' }) < 0);
    assert.strictEqual(compareByOrderThenName({}, {}), 0);
  });
});
