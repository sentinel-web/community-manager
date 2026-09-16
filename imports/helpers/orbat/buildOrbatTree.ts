export interface OrbatTreeNode<T> {
  item: T;
  children: OrbatTreeNode<T>[];
}

interface TreeSquad {
  _id?: string;
  parentSquadId?: string;
}

/**
 * Builds the ORBAT forest from a flat squad list. Siblings keep the order of the input list, so sort the
 * squads first (e.g. with `compareByOrderThenName`). Nothing is ever dropped: a squad becomes a root when
 * its parent is missing from the list, or when its ancestor chain loops. The loop check walks the whole
 * ancestor chain, so the whole subtree hanging *below* a cycle is flattened into roots too, rather than
 * being attached to a parent that can never be reached from any root.
 */
export default function buildOrbatTree<T extends TreeSquad>(squads: readonly T[]): OrbatTreeNode<T>[] {
  const nodes = new Map<string, OrbatTreeNode<T>>();
  for (const squad of squads) {
    if (squad._id && !nodes.has(squad._id)) nodes.set(squad._id, { item: squad, children: [] });
  }

  const hasCycle = (id: string): boolean => {
    const seen = new Set<string>([id]);
    let parentId = nodes.get(id)?.item.parentSquadId;
    while (parentId && nodes.has(parentId)) {
      if (seen.has(parentId)) return true;
      seen.add(parentId);
      parentId = nodes.get(parentId)?.item.parentSquadId;
    }
    return false;
  };

  const roots: OrbatTreeNode<T>[] = [];
  for (const [id, node] of nodes) {
    const parent = node.item.parentSquadId ? nodes.get(node.item.parentSquadId) : undefined;
    if (parent && !hasCycle(id)) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}
