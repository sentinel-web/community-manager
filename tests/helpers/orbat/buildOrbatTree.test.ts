import assert from 'node:assert';
import buildOrbatTree, { type OrbatTreeNode } from '../../../imports/helpers/orbat/buildOrbatTree';

interface TestSquad {
  _id?: string;
  parentSquadId?: string;
}

function shape(nodes: OrbatTreeNode<TestSquad>[]): unknown[] {
  return nodes.map(node => (node.children.length > 0 ? { [node.item._id!]: shape(node.children) } : node.item._id));
}

describe('buildOrbatTree', () => {
  it('returns an empty forest for no squads', () => {
    assert.deepStrictEqual(buildOrbatTree([]), []);
  });

  it('keeps sibling order from the input, regardless of whether siblings have children', () => {
    // alpha has a child, bravo does not — previously alpha was always attached first.
    const tree = buildOrbatTree<TestSquad>([
      { _id: 'hq' },
      { _id: 'bravo', parentSquadId: 'hq' },
      { _id: 'alpha', parentSquadId: 'hq' },
      { _id: 'alpha-1', parentSquadId: 'alpha' },
    ]);
    assert.deepStrictEqual(shape(tree), [{ hq: ['bravo', { alpha: ['alpha-1'] }] }]);
  });

  it('attaches deeply nested squads whose parents appear later in the input', () => {
    const tree = buildOrbatTree<TestSquad>([{ _id: 'c', parentSquadId: 'b' }, { _id: 'b', parentSquadId: 'a' }, { _id: 'a' }]);
    assert.deepStrictEqual(shape(tree), [{ a: [{ b: ['c'] }] }]);
  });

  it('treats squads whose parent is not in the list as roots', () => {
    const tree = buildOrbatTree<TestSquad>([{ _id: 'orphan', parentSquadId: 'excluded' }, { _id: 'root' }]);
    assert.deepStrictEqual(shape(tree), ['orphan', 'root']);
  });

  it('does not lose squads caught in a parent cycle', () => {
    const tree = buildOrbatTree<TestSquad>([
      { _id: 'a', parentSquadId: 'b' },
      { _id: 'b', parentSquadId: 'a' },
      { _id: 'self', parentSquadId: 'self' },
    ]);
    assert.deepStrictEqual(shape(tree), ['a', 'b', 'self']);
  });

  it('promotes a squad hanging below a cycle to a root as well', () => {
    // `child`'s own parent exists, but its ancestor chain loops, so no root could ever reach it.
    // The whole subtree below the cycle is flattened into roots rather than being hidden.
    const tree = buildOrbatTree<TestSquad>([
      { _id: 'a', parentSquadId: 'b' },
      { _id: 'b', parentSquadId: 'a' },
      { _id: 'child', parentSquadId: 'a' },
      { _id: 'grandchild', parentSquadId: 'child' },
    ]);
    assert.deepStrictEqual(shape(tree), ['a', 'b', 'child', 'grandchild']);
  });

  it('skips squads without an _id and ignores duplicates', () => {
    const tree = buildOrbatTree<TestSquad>([{}, { _id: 'a' }, { _id: 'a' }]);
    assert.deepStrictEqual(shape(tree), ['a']);
  });
});
